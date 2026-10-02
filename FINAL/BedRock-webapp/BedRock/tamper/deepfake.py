#!/usr/bin/env python3
"""
deepfake.py — genesis-hash-preserving face overlay for BedRock tamper demo.

Usage:
  python3 deepfake.py <input_video> <face_image> <output_video>

Approach:
  1. Copy bytes 0..split_byte verbatim (first moof at/after 1.25 MB).
  2. Re-encode frames from split_time onward with face overlay (video only).
  3. Patch suffix moof track_ids, tfdt timing, and mfhd sequence numbers
     so they continue seamlessly from the prefix.
  4. Inject re-encoded SPS/PPS into the suffix mdat so the decoder can
     handle the codec parameter change mid-stream.
  Result: segment 0 bytes identical → genesis hash preserved.
"""

import sys
import os
import subprocess
import json
import struct
import hashlib
import cv2
import numpy as np

SEG_SIZE = 1_310_720  # 1.25 MB — must match BedRock


# ── MP4 box iteration ────────────────────────────────────────────────────────

def iter_boxes(data, start=0, end=None):
    """Yield (type_bytes, offset, size) for consecutive boxes in data[start:end]."""
    if end is None:
        end = len(data)
    pos = start
    while pos + 8 <= end:
        size = struct.unpack_from('>I', data, pos)[0]
        btype = data[pos+4:pos+8]
        if size == 1 and pos + 16 <= end:
            size = struct.unpack_from('>Q', data, pos+8)[0]
        if size == 0:
            size = end - pos
        if size < 8:
            break
        yield btype, pos, size
        pos += size


def children(data, parent_pos, parent_size):
    """Yield child boxes of a container box (skip the 8-byte box header)."""
    return iter_boxes(data, parent_pos + 8, parent_pos + parent_size)


# ── MP4 structure helpers ────────────────────────────────────────────────────

def find_split_byte(data):
    """First moof offset at or after SEG_SIZE."""
    for btype, pos, size in iter_boxes(data):
        if btype == b'moof' and pos >= SEG_SIZE:
            return pos
    return None


def strip_header(data):
    """Drop ftyp/moov/free/skip — return bytes starting at first moof."""
    for btype, pos, size in iter_boxes(data):
        if btype == b'moof':
            return data[pos:]
    return data


def get_moov_track_info(data):
    """
    Parse moov to build {track_id: {'handler': b'vide'|b'soun', 'timescale': int}}.
    """
    tracks = {}
    for at, moov_pos, moov_sz in iter_boxes(data):
        if at != b'moov':
            continue
        for at2, trak_pos, trak_sz in children(data, moov_pos, moov_sz):
            if at2 != b'trak':
                continue
            track_id = None
            handler = None
            timescale = None
            for at3, pos3, sz3 in children(data, trak_pos, trak_sz):
                if at3 == b'tkhd':
                    ver = data[pos3 + 8]
                    off = 20 if ver == 0 else 28
                    track_id = struct.unpack_from('>I', data, pos3 + off)[0]
                elif at3 == b'mdia':
                    for at4, pos4, sz4 in children(data, pos3, sz3):
                        if at4 == b'hdlr' and pos4 + 20 <= pos3 + sz3:
                            handler = data[pos4 + 16:pos4 + 20]
                        elif at4 == b'mdhd':
                            ver = data[pos4 + 8]
                            off = 20 if ver == 0 else 28
                            timescale = struct.unpack_from('>I', data, pos4 + off)[0]
            if track_id is not None:
                tracks[track_id] = {
                    'handler': handler,
                    'timescale': timescale,
                }
        break  # only first moov
    return tracks


def get_prefix_tail(data, tracks):
    """
    Walk moof boxes in prefix data.  Return (last_seq, {track_id: end_ticks}).
    end_ticks = last tfdt + sum(trun sample durations) for that track.
    """
    last_seq = 0
    track_ends = {}

    for at, moof_pos, moof_sz in iter_boxes(data):
        if at != b'moof':
            continue
        for at2, pos2, sz2 in children(data, moof_pos, moof_sz):
            if at2 == b'mfhd':
                seq = struct.unpack_from('>I', data, pos2 + 12)[0]
                last_seq = max(last_seq, seq)
            elif at2 == b'traf':
                tid = None
                tfdt_val = None
                dur = 0
                default_dur = 0
                for at3, pos3, sz3 in children(data, pos2, sz2):
                    if at3 == b'tfhd':
                        tfhd_flags = struct.unpack_from('>I', data, pos3 + 8)[0] & 0xFFFFFF
                        tid = struct.unpack_from('>I', data, pos3 + 12)[0]
                        off = pos3 + 16
                        if tfhd_flags & 0x01:
                            off += 8   # base_data_offset
                        if tfhd_flags & 0x02:
                            off += 4   # sample_description_index
                        if tfhd_flags & 0x08:
                            default_dur = struct.unpack_from('>I', data, off)[0]
                    elif at3 == b'tfdt':
                        ver = data[pos3 + 8]
                        tfdt_val = struct.unpack_from(
                            '>Q' if ver == 1 else '>I', data, pos3 + 12)[0]
                    elif at3 == b'trun':
                        flags = struct.unpack_from('>I', data, pos3 + 8)[0] & 0xFFFFFF
                        count = struct.unpack_from('>I', data, pos3 + 12)[0]
                        if flags & 0x100:
                            cur = pos3 + 16
                            if flags & 0x001:
                                cur += 4
                            if flags & 0x004:
                                cur += 4
                            for _ in range(count):
                                dur += struct.unpack_from('>I', data, cur)[0]
                                cur += 4
                                if flags & 0x200:
                                    cur += 4
                                if flags & 0x400:
                                    cur += 4
                                if flags & 0x800:
                                    cur += 4
                        elif default_dur > 0:
                            dur += count * default_dur
                if tid is not None and tfdt_val is not None:
                    track_ends[tid] = tfdt_val + dur

    return last_seq, track_ends


# ── SPS/PPS extraction and injection ────────────────────────────────────────

def extract_sps_pps_from_avcc(data):
    """
    Search for avcC box in moov and extract SPS/PPS NAL units.
    Returns list of raw NAL unit bytes (without length prefix).
    """
    nals = []
    for at, moov_pos, moov_sz in iter_boxes(data):
        if at != b'moov':
            continue
        # Search for b'avcC' anywhere inside the moov
        moov_bytes = data[moov_pos:moov_pos + moov_sz]
        idx = moov_bytes.find(b'avcC')
        if idx < 0:
            return nals
        avcc_box_pos = moov_pos + idx - 4  # size field is 4 bytes before type
        avcc_sz = struct.unpack_from('>I', data, avcc_box_pos)[0]
        rec = data[avcc_box_pos + 8:avcc_box_pos + avcc_sz]
        if len(rec) < 6:
            return nals

        # Parse AVCDecoderConfigurationRecord
        num_sps = rec[5] & 0x1F
        p = 6
        for _ in range(num_sps):
            if p + 2 > len(rec):
                break
            sps_len = struct.unpack_from('>H', rec, p)[0]
            p += 2
            if p + sps_len > len(rec):
                break
            nals.append(rec[p:p + sps_len])
            p += sps_len

        if p >= len(rec):
            return nals
        num_pps = rec[p]
        p += 1
        for _ in range(num_pps):
            if p + 2 > len(rec):
                break
            pps_len = struct.unpack_from('>H', rec, p)[0]
            p += 2
            if p + pps_len > len(rec):
                break
            nals.append(rec[p:p + pps_len])
            p += pps_len

        break
    return nals


def inject_sps_pps(suffix_data, sps_pps_nals):
    """
    Insert SPS/PPS NAL units (length-prefixed) at the start of the first mdat
    in suffix_data.  Updates the first mdat size and the first trun's first
    sample_size accordingly.  Returns modified bytes.
    """
    if not sps_pps_nals:
        return suffix_data

    # Build injection payload: [4-byte length][NAL bytes] per NAL
    injection = b''
    for nal in sps_pps_nals:
        injection += struct.pack('>I', len(nal)) + nal
    inj_len = len(injection)

    buf = bytearray(suffix_data)

    # Locate first moof and first mdat
    first_moof_pos = first_moof_sz = None
    first_mdat_pos = None
    for btype, pos, sz in iter_boxes(buf):
        if btype == b'moof' and first_moof_pos is None:
            first_moof_pos = pos
            first_moof_sz = sz
        elif btype == b'mdat' and first_mdat_pos is None:
            first_mdat_pos = pos
            break

    if first_moof_pos is None or first_mdat_pos is None:
        return suffix_data

    # Update first trun's first sample_size (must do BEFORE inserting bytes,
    # since insertion shifts the mdat but not the moof)
    for at2, pos2, sz2 in children(buf, first_moof_pos, first_moof_sz):
        if at2 != b'traf':
            continue
        for at3, pos3, sz3 in children(buf, pos2, sz2):
            if at3 != b'trun':
                continue
            flags = struct.unpack_from('>I', buf, pos3 + 8)[0] & 0xFFFFFF
            count = struct.unpack_from('>I', buf, pos3 + 12)[0]
            if count == 0:
                continue
            cur = pos3 + 16
            if flags & 0x001:
                cur += 4   # data_offset present
            if flags & 0x004:
                cur += 4   # first_sample_flags present
            # Walk to the sample_size field of the first sample
            if flags & 0x100:
                cur += 4   # skip sample_duration
            if flags & 0x200:
                old_size = struct.unpack_from('>I', buf, cur)[0]
                struct.pack_into('>I', buf, cur, old_size + inj_len)
            break  # only first traf's trun
        break  # only first traf

    # Insert injection payload at start of mdat data (after 8-byte mdat header)
    mdat_data_start = first_mdat_pos + 8
    buf[mdat_data_start:mdat_data_start] = injection

    # Update mdat box size
    old_mdat_sz = struct.unpack_from('>I', buf, first_mdat_pos)[0]
    struct.pack_into('>I', buf, first_mdat_pos, old_mdat_sz + inj_len)

    return bytes(buf)


# ── Suffix patching ──────────────────────────────────────────────────────────

def patch_suffix(data, start_seq, track_id_map, track_tfdt_adds):
    """
    In suffix moof+mdat bytes:
      - Renumber mfhd sequence_number starting from start_seq
      - Remap traf track_ids via track_id_map {old_id: new_id}
      - Add per-track tfdt offset via track_tfdt_adds {new_track_id: ticks}
    Returns patched bytes.
    """
    buf = bytearray(data)
    seq = start_seq

    for at, moof_pos, moof_sz in iter_boxes(buf):
        if at != b'moof':
            continue
        for at2, pos2, sz2 in children(buf, moof_pos, moof_sz):
            if at2 == b'mfhd':
                struct.pack_into('>I', buf, pos2 + 12, seq)
                seq += 1
            elif at2 == b'traf':
                # Read and remap track_id in tfhd
                new_tid = None
                for at3, pos3, sz3 in children(buf, pos2, sz2):
                    if at3 == b'tfhd':
                        old_tid = struct.unpack_from('>I', buf, pos3 + 12)[0]
                        new_tid = track_id_map.get(old_tid, old_tid)
                        if new_tid != old_tid:
                            struct.pack_into('>I', buf, pos3 + 12, new_tid)
                    elif at3 == b'tfdt' and new_tid is not None:
                        tfdt_add = track_tfdt_adds.get(new_tid, 0)
                        if tfdt_add == 0:
                            continue
                        ver = buf[pos3 + 8]
                        if ver == 1:
                            old = struct.unpack_from('>Q', buf, pos3 + 12)[0]
                            struct.pack_into('>Q', buf, pos3 + 12, old + tfdt_add)
                        else:
                            old = struct.unpack_from('>I', buf, pos3 + 12)[0]
                            struct.pack_into('>I', buf, pos3 + 12,
                                             (old + tfdt_add) & 0xFFFFFFFF)

    return bytes(buf)


# ── Face overlay helpers ─────────────────────────────────────────────────────

def load_replacement_face(img_path, cascade):
    img = cv2.imread(img_path, cv2.IMREAD_UNCHANGED)
    if img is None:
        raise ValueError(f"Cannot read face image: {img_path}")
    if img.shape[2] == 3:
        img = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)
    gray = cv2.cvtColor(img, cv2.COLOR_BGRA2GRAY)
    faces = cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5,
                                     minSize=(40, 40))
    if len(faces) > 0:
        x, y, w, h = faces[0]
        px, py = int(w * 0.20), int(h * 0.20)
        return img[max(0, y - py):min(img.shape[0], y + h + py),
                   max(0, x - px):min(img.shape[1], x + w + px)]
    return img


def overlay_face(frame, replacement, fx, fy, fw, fh):
    face_r = cv2.resize(replacement, (fw, fh), interpolation=cv2.INTER_LINEAR)
    mask = np.zeros((fh, fw), dtype=np.float32)
    cv2.ellipse(mask, (fw // 2, fh // 2),
                (max(1, fw // 2 - 4), max(1, fh // 2 - 4)),
                0, 0, 360, 1.0, -1)
    mask = cv2.GaussianBlur(mask, (31, 31), 0)
    m3 = np.stack([mask] * 3, axis=2)
    if face_r.shape[2] == 4:
        m3 *= face_r[:, :, 3:4].astype(np.float32) / 255.0
        face_rgb = face_r[:, :, :3].astype(np.float32)
    else:
        face_rgb = face_r.astype(np.float32)
    roi = frame[fy:fy + fh, fx:fx + fw].astype(np.float32)
    frame[fy:fy + fh, fx:fx + fw] = np.clip(
        roi * (1 - m3) + face_rgb * m3, 0, 255).astype(np.uint8)
    return frame


def get_video_info(path):
    r = subprocess.run([
        "ffprobe", "-v", "quiet", "-print_format", "json", "-show_streams", path
    ], capture_output=True, text=True)
    streams = json.loads(r.stdout).get("streams", [])
    s = next((s for s in streams if s.get("codec_type") == "video"), None)
    if not s:
        raise ValueError(f"No video stream in {path}")
    w, h = int(s["width"]), int(s["height"])
    num, den = s.get("r_frame_rate", "30/1").split("/")
    fps = float(num) / float(den)
    frames = int(s.get("nb_frames", 0))
    dur = float(s.get("duration", 0))
    if frames == 0 and dur > 0:
        frames = int(dur * fps)
    return w, h, fps, frames, dur


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    if len(sys.argv) != 4:
        print("Usage: deepfake.py <input_video> <face_image> <output_video>",
              file=sys.stderr)
        sys.exit(1)

    input_video, face_image, output_video = sys.argv[1], sys.argv[2], sys.argv[3]

    cascade = cv2.CascadeClassifier(
        cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    replacement = load_replacement_face(face_image, cascade)

    # ── 1. Read file, find split point ────────────────────────────────────────
    with open(input_video, 'rb') as f:
        file_data = f.read()

    split_byte = find_split_byte(file_data)
    if split_byte is None:
        print("[warn] No moof boundary past SEG_SIZE — processing whole file",
              file=sys.stderr)
        split_byte = 0

    r = subprocess.run([
        "ffprobe", "-v", "quiet", "-print_format", "json",
        "-show_packets", "-select_streams", "v:0", input_video
    ], capture_output=True, text=True, timeout=60)
    packets = json.loads(r.stdout).get("packets", [])

    split_time = None
    for pkt in packets:
        pos = int(pkt.get("pos", 0) or 0)
        if pos >= split_byte and "K" in pkt.get("flags", ""):
            split_time = float(pkt.get("pts_time", 0) or 0)
            break

    if split_time is None:
        dur = get_video_info(input_video)[4]
        split_time = (split_byte / len(file_data)) * dur

    print(f"[info] Verbatim prefix: 0–{split_byte:,} bytes", file=sys.stderr)
    print(f"[info] Face overlay starts at ≈{split_time:.2f}s", file=sys.stderr)

    prefix_bytes = file_data[:split_byte]

    # ── 2. Analyse prefix moov and fragment tail ──────────────────────────────
    orig_tracks = get_moov_track_info(file_data)
    orig_video_tid = None
    for tid, info in orig_tracks.items():
        print(f"[info] Original track {tid}: handler={info['handler']!r} "
              f"timescale={info['timescale']}", file=sys.stderr)
        if info['handler'] == b'vide':
            orig_video_tid = tid

    if orig_video_tid is None:
        print("[error] No video track in input", file=sys.stderr)
        sys.exit(1)

    orig_video_ts = orig_tracks[orig_video_tid]['timescale']

    last_seq, track_ends = get_prefix_tail(prefix_bytes, orig_tracks)
    for tid, end in track_ends.items():
        ts = orig_tracks[tid]['timescale']
        print(f"[info] Prefix track {tid} end: {end} ticks "
              f"({end / ts:.3f}s at {ts} Hz)", file=sys.stderr)

    # ── 3. Decode + overlay + encode suffix (video only) ──────────────────────
    width, height, fps, _, duration = get_video_info(input_video)
    frame_size = width * height * 3
    total_remaining = max(1, int((duration - split_time) * fps))

    tmp_suffix = output_video + "_suffix.mp4"

    # -err_detect ignore_err: continue decoding past the corrupted keyframe
    # from byte injection, instead of stopping early.
    decode_proc = subprocess.Popen([
        "ffmpeg", "-v", "quiet",
        "-err_detect", "ignore_err",
        "-ss", str(split_time), "-i", input_video,
        "-f", "rawvideo", "-pix_fmt", "bgr24", "pipe:1"
    ], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)

    # Video-only encode — no audio, no setpts (we patch tfdt manually).
    # -video_track_timescale forces the suffix to use the same timescale as
    # the original moov so that trun sample_durations are in the right units.
    # default_base_moof ensures trun data_offsets are relative to moof start,
    # which stays correct after we strip the suffix's ftyp/moov header.
    encode_proc = subprocess.Popen([
        "ffmpeg", "-v", "quiet", "-y",
        "-f", "rawvideo", "-pix_fmt", "bgr24",
        "-s", f"{width}x{height}", "-r", str(fps),
        "-i", "pipe:0",
        "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23",
        "-video_track_timescale", str(orig_video_ts),
        "-an",
        "-movflags", "frag_keyframe+empty_moov+default_base_moof",
        tmp_suffix
    ], stdin=subprocess.PIPE, stderr=subprocess.DEVNULL)

    # Stabilised face detection
    smoothed_box = None
    EMA_ALPHA = 0.18       # smoother tracking, less jitter
    MAX_JUMP = 0.18        # tighter jump rejection
    MISS_LIMIT = 15        # hold overlay longer through brief misses
    miss_count = 0
    frame_idx = 0

    while True:
        raw = decode_proc.stdout.read(frame_size)
        if len(raw) < frame_size:
            break

        frame = np.frombuffer(raw, dtype=np.uint8).reshape(
            (height, width, 3)).copy()

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        gray = cv2.equalizeHist(gray)
        raw_faces = cascade.detectMultiScale(
            gray, scaleFactor=1.05, minNeighbors=8,
            minSize=(60, 60), flags=cv2.CASCADE_SCALE_IMAGE)

        accepted = None
        if len(raw_faces) > 0:
            raw_faces = sorted(raw_faces,
                               key=lambda f: f[2] * f[3], reverse=True)
            rx, ry, rw, rh = raw_faces[0]
            if smoothed_box is None:
                accepted = (rx, ry, rw, rh)
            else:
                sx, sy, sw, sh = smoothed_box
                dist = (((rx + rw / 2) - (sx + sw / 2)) ** 2 +
                        ((ry + rh / 2) - (sy + sh / 2)) ** 2) ** 0.5
                if dist < MAX_JUMP * width:
                    accepted = (rx, ry, rw, rh)

        if accepted is not None:
            miss_count = 0
            if smoothed_box is None:
                smoothed_box = tuple(float(v) for v in accepted)
            else:
                smoothed_box = tuple(
                    s + EMA_ALPHA * (n - s)
                    for s, n in zip(smoothed_box, accepted))
        else:
            miss_count += 1
            if miss_count > MISS_LIMIT:
                smoothed_box = None

        if smoothed_box is not None:
            fx = max(0, int(round(smoothed_box[0])))
            fy = max(0, int(round(smoothed_box[1])))
            fw = min(int(round(smoothed_box[2])), width - fx)
            fh = min(int(round(smoothed_box[3])), height - fy)
            if fw > 10 and fh > 10:
                frame = overlay_face(frame, replacement, fx, fy, fw, fh)

        encode_proc.stdin.write(frame.tobytes())
        frame_idx += 1
        if frame_idx % 15 == 0:
            print(f"progress:{min(99, int(frame_idx / total_remaining * 100))}",
                  flush=True)

    decode_proc.stdout.close()
    decode_proc.wait()
    encode_proc.stdin.close()
    encode_proc.wait()

    # ── 4. Read suffix, analyse its structure ─────────────────────────────────
    with open(tmp_suffix, 'rb') as f:
        suffix_data = f.read()
    os.remove(tmp_suffix)

    # Get suffix track info (video-only, so one track with track_id=1)
    suffix_tracks = get_moov_track_info(suffix_data)
    for tid, info in suffix_tracks.items():
        print(f"[info] Suffix track {tid}: handler={info['handler']!r} "
              f"timescale={info['timescale']}", file=sys.stderr)

    # Extract SPS/PPS from suffix's avcC (before we strip the moov)
    suffix_sps_pps = extract_sps_pps_from_avcc(suffix_data)
    print(f"[info] Extracted {len(suffix_sps_pps)} SPS/PPS NAL units "
          f"({sum(len(n) for n in suffix_sps_pps)} bytes)", file=sys.stderr)

    # Strip ftyp/moov
    suffix_stripped = strip_header(suffix_data)

    # ── 5. Build track-id remap and per-track tfdt offsets ────────────────────
    # Suffix is video-only: its video track_id is 1.
    # Prefix video track_id might be different (e.g. 2).  Remap suffix to match.
    suffix_video_tid = None
    suffix_video_ts = None
    for tid, info in suffix_tracks.items():
        if info['handler'] == b'vide':
            suffix_video_tid = tid
            suffix_video_ts = info['timescale']

    if suffix_video_tid is None or suffix_video_ts is None:
        print("[error] No video track in suffix", file=sys.stderr)
        sys.exit(1)

    track_id_map = {}
    if suffix_video_tid != orig_video_tid:
        track_id_map[suffix_video_tid] = orig_video_tid
        print(f"[info] Remapping suffix video track_id "
              f"{suffix_video_tid} → {orig_video_tid}", file=sys.stderr)

    # Compute per-track tfdt add.  Only video track needs patching.
    # Since we force -video_track_timescale to match the original, the suffix
    # and prefix use the same timescale — tfdt_add is just the prefix end ticks.
    orig_video_ts = orig_tracks[orig_video_tid]['timescale']
    prefix_video_end_ticks = track_ends.get(orig_video_tid, 0)

    if suffix_video_ts == orig_video_ts:
        video_tfdt_add = prefix_video_end_ticks
    else:
        # Fallback: cross-timescale conversion
        prefix_video_end_secs = prefix_video_end_ticks / orig_video_ts
        video_tfdt_add = int(round(prefix_video_end_secs * suffix_video_ts))

    track_tfdt_adds = {orig_video_tid: video_tfdt_add}

    print(f"[info] video tfdt_add = {video_tfdt_add} "
          f"({video_tfdt_add / suffix_video_ts:.3f}s at {suffix_video_ts} Hz)",
          file=sys.stderr)

    # ── 6. Patch suffix: track_ids, tfdt, seq numbers ─────────────────────────
    suffix_patched = patch_suffix(suffix_stripped, last_seq + 1,
                                  track_id_map, track_tfdt_adds)

    # ── 7. Inject SPS/PPS into first mdat ─────────────────────────────────────
    suffix_patched = inject_sps_pps(suffix_patched, suffix_sps_pps)

    # ── 8. Assemble genesis-hash-preserving file ────────────────────────────
    with open(output_video, 'wb') as f:
        f.write(prefix_bytes)
        f.write(suffix_patched)

    # ── 9. Verify genesis hash ────────────────────────────────────────────────
    with open(input_video, 'rb') as f:
        orig_seg0 = f.read(SEG_SIZE)
    with open(output_video, 'rb') as f:
        out_seg0 = f.read(SEG_SIZE)
    preserved = (hashlib.sha256(orig_seg0).hexdigest() ==
                 hashlib.sha256(out_seg0).hexdigest())
    print(f"[info] Genesis hash preserved: {preserved}", file=sys.stderr)

    # ── 10. Create playable copy (re-encode for VLC/browser) ──────────────────
    playable = output_video.replace('.mp4', '_play.mp4')
    print("[info] Re-encoding playable copy for VLC...", file=sys.stderr)
    subprocess.run([
        "ffmpeg", "-v", "quiet", "-y",
        "-err_detect", "ignore_err",
        "-i", output_video,
        "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23",
        "-c:a", "aac",
        "-movflags", "+faststart",
        playable
    ], check=True)

    print("progress:100", flush=True)
    print(f"done:{output_video}", flush=True)
    print(f"playable:{playable}", flush=True)


if __name__ == "__main__":
    main()
