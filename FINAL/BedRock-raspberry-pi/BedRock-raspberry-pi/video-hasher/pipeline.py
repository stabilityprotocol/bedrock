# pipeline.py
# Camera → annotate frames (timestamp overlay) → encode to fragmented MP4 →
# hash encoded bytes in real time as they stream from ffmpeg stdout.
#
# Hashing mirrors the webapp's recording.js exactly:
#   - ffmpeg stdout bytes are fed into a SEG_SIZE accumulator
#   - each full segment is hashed immediately (rolling SHA-256 chain)
#   - final partial segment is flushed on stop
#
# Timestamp is burned into frames via Pillow BEFORE encoding,
# so it is part of the hashed content.

import hashlib
import os
import subprocess
import threading
import time
from datetime import datetime
from config import (
    RESOLUTION, FRAMERATE, BITRATE,
    OUTPUT_DIR, SEG_SIZE,
    AWB_MODE,
)

from PIL import Image, ImageDraw, ImageFont
from picamera2 import Picamera2

# ── Font setup ────────────────────────────────────────────────────────────────

def _load_font(size: int):
    paths = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationMono-Bold.ttf",
        "/usr/share/fonts/truetype/freefont/FreeMono.ttf",
    ]
    for p in paths:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()

_FONT = _load_font(18)


# ── Timestamp overlay ─────────────────────────────────────────────────────────

def annotate_frame(frame_array) -> Image.Image:
    """Burn current datetime into bottom-left of frame."""
    img  = Image.fromarray(frame_array[:, :, ::-1], "RGB")
    draw = ImageDraw.Draw(img)

    text          = datetime.now().strftime("%Y-%m-%d  %H:%M:%S")
    width, height = img.size
    margin        = 10

    bbox   = draw.textbbox((0, 0), text, font=_FONT)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x, y   = margin, height - th - margin

    for dx, dy in [(-1,-1),(1,-1),(-1,1),(1,1)]:
        draw.text((x + dx, y + dy), text, font=_FONT, fill=(0, 0, 0))
    draw.text((x, y), text, font=_FONT, fill=(255, 255, 255))

    return img


# ── Hash algorithm ────────────────────────────────────────────────────────────

def _sha256(data: bytes) -> bytes:
    return hashlib.sha256(data).digest()


def _pad_to_seg(data: bytes) -> bytes:
    buf = bytearray(SEG_SIZE)
    buf[:len(data)] = data
    return bytes(buf)


def compute_rolling_hash(prev_roll: bytes | None, chunk: bytes) -> tuple[bytes, str, str]:
    """
    Mirrors webapp hashing.js and tools/rehash.py exactly.
      segHash  = SHA-256(zeroPad(chunk, SEG_SIZE))
      genesis: rolling = SHA-256(segHash)
      other:   rolling = SHA-256(prev_roll || segHash)
    Returns (rolling_bytes, rolling_hex, seg_hash_hex).
    """
    seg_hash = _sha256(_pad_to_seg(chunk))
    rolling  = _sha256(seg_hash) if prev_roll is None else _sha256(prev_roll + seg_hash)
    return rolling, rolling.hex(), seg_hash.hex()


# ── Recording pipeline ────────────────────────────────────────────────────────

class RecordingPipeline:
    """
    Real-time pipeline: camera → annotate → ffmpeg (fragmented MP4 on stdout)
    → hash bytes as they stream → on_chunk_hashed callback per segment.

    Hashing is identical to the webapp: bytes are fed into a SEG_SIZE
    accumulator as ffmpeg produces them. Full segments are hashed immediately.
    The final partial segment is flushed when recording stops.

    Callbacks:
        on_chunk_hashed(chunk_index, rolling_hash_hex, seg_hash_hex, is_first, is_final)
    """

    def __init__(self, on_chunk_hashed=None):
        self.on_chunk_hashed = on_chunk_hashed or (lambda *a: None)
        self._stop_event     = threading.Event()
        self._camera_thread  = None
        self._hash_thread    = None
        self.chunk_count     = 0
        self.latest_hash     = ""
        self.start_time      = None
        self.end_time        = None
        self.output_path     = None
        self.file_size_bytes = 0
        os.makedirs(OUTPUT_DIR, exist_ok=True)

    # ── Public ────────────────────────────────────────────────────────────────

    def start(self):
        self._stop_event.clear()
        self.chunk_count = 0
        self.latest_hash = ""
        self.start_time  = time.time()

        self._camera_thread = threading.Thread(target=self._capture_loop, daemon=True)
        self._camera_thread.start()

    def stop(self):
        """Signal stop; blocks until camera stops and all chunks are hashed."""
        self.end_time = time.time()
        self._stop_event.set()
        if self._camera_thread:
            self._camera_thread.join()
        if self._hash_thread:
            self._hash_thread.join()

    @property
    def recording_id(self) -> str:
        if self.output_path:
            return os.path.splitext(os.path.basename(self.output_path))[0]
        return f"rec_{int(self.start_time or 0)}"

    def elapsed_seconds(self) -> int:
        if self.start_time is None:
            return 0
        return int(time.time() - self.start_time)

    # ── Capture loop ──────────────────────────────────────────────────────────

    def _capture_loop(self):
        """
        1. picamera2 → annotated RGB frames → ffmpeg stdin
        2. ffmpeg encodes to fragmented MP4, writes to stdout
        3. stdout reader thread hashes bytes in real time and writes to file
        """
        timestamp        = datetime.now().strftime("%Y%m%d_%H%M%S")
        mp4_path         = os.path.join(OUTPUT_DIR, f"{timestamp}.mp4")
        self.output_path = mp4_path

        width, height = RESOLUTION

        picam2 = Picamera2()
        config = picam2.create_video_configuration(
            main={"size": (width, height), "format": "RGB888"},
            controls={"FrameRate": FRAMERATE},
        )
        picam2.configure(config)
        picam2.start()
        picam2.set_controls({"AwbMode": AWB_MODE})

        # Fragmented MP4 on stdout — moov atom written inline so bytes are
        # valid and hashable as they stream (mirrors MediaRecorder behaviour).
        ffmpeg_cmd = [
            "ffmpeg", "-y",
            "-f",         "rawvideo",
            "-pix_fmt",   "rgb24",
            "-s",         f"{width}x{height}",
            "-r",         str(FRAMERATE),
            "-i",         "pipe:0",
            "-c:v",       "libx264",
            "-preset",    "ultrafast",
            "-b:v",       str(BITRATE),
            "-pix_fmt",   "yuv420p",
            "-f",         "mp4",
            "-movflags",  "frag_keyframe+empty_moov",
            "pipe:1",     # encoded bytes → stdout for real-time hashing
        ]

        ffmpeg = subprocess.Popen(
            ffmpeg_cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
        )

        # Start hash thread — reads ffmpeg stdout, hashes in real time, writes file
        self._hash_thread = threading.Thread(
            target=self._stdout_hasher,
            args=(ffmpeg.stdout, mp4_path),
            daemon=True,
        )
        self._hash_thread.start()

        print("[PIPELINE] Recording started — annotating frames in real time.")

        frame_interval  = 1.0 / FRAMERATE
        next_frame_time = time.time()

        try:
            while not self._stop_event.is_set():
                now = time.time()
                if now < next_frame_time:
                    time.sleep(next_frame_time - now)
                next_frame_time += frame_interval

                frame_array = picam2.capture_array("main")
                annotated   = annotate_frame(frame_array)
                ffmpeg.stdin.write(annotated.tobytes())

        except BrokenPipeError:
            print("[PIPELINE] ffmpeg pipe closed unexpectedly.")
        finally:
            print("[PIPELINE] Stopping camera...")
            try:
                picam2.stop()
                picam2.close()
            except Exception as e:
                print(f"[PIPELINE] Warning: camera cleanup: {e}")

            print("[PIPELINE] Closing ffmpeg...")
            try:
                ffmpeg.stdin.close()
                ffmpeg.wait(timeout=15)
            except subprocess.TimeoutExpired:
                print("[PIPELINE] ffmpeg timeout — killing")
                ffmpeg.kill()
            except Exception as e:
                print(f"[PIPELINE] Warning: ffmpeg cleanup: {e}")

        if os.path.exists(mp4_path):
            self.file_size_bytes = os.path.getsize(mp4_path)
        print(f"[PIPELINE] MP4 saved: {mp4_path}")

    # ── Stdout hasher ─────────────────────────────────────────────────────────

    def _stdout_hasher(self, stdout_pipe, mp4_path: str):
        """
        Reads ffmpeg stdout in real time. Each 64KB block is:
          - written to the output MP4 file
          - fed into the SEG_SIZE hash accumulator

        Full SEG_SIZE segments are hashed immediately (mirrors webapp onEncodedChunk).
        The final partial segment is flushed on EOF with is_final=True.
        """
        prev_roll = None
        buf       = bytearray()
        idx       = 0

        with open(mp4_path, "wb") as f:
            while True:
                block = stdout_pipe.read(65536)
                if not block:
                    break   # EOF — ffmpeg finished

                f.write(block)
                buf.extend(block)

                # Hash every complete SEG_SIZE segment immediately.
                # is_final is metadata only — doesn't affect hash value.
                # Mark all mid-stream chunks final=False; flush handles final=True.
                while len(buf) >= SEG_SIZE:
                    chunk    = bytes(buf[:SEG_SIZE])
                    buf      = buf[SEG_SIZE:]
                    is_first = (idx == 0)
                    prev_roll, rolling_hex, seg_hash_hex = compute_rolling_hash(prev_roll, chunk)
                    self.chunk_count += 1
                    self.latest_hash  = rolling_hex
                    print(f"[HASH] chunk={idx}  seg={seg_hash_hex[:16]}...  "
                          f"roll={rolling_hex[:16]}...  first={is_first}  final=False")
                    self.on_chunk_hashed(idx, rolling_hex, seg_hash_hex, is_first, False)
                    idx += 1

        # EOF: flush any remaining partial bytes as the final chunk.
        # If buf is empty, all chunks were exact SEG_SIZE multiples —
        # blockchain.py already marks the last record as final via (i == total-1).
        if buf:
            is_first = (idx == 0)
            chunk    = bytes(buf)
            prev_roll, rolling_hex, seg_hash_hex = compute_rolling_hash(prev_roll, chunk)
            self.chunk_count += 1
            self.latest_hash  = rolling_hex
            print(f"[HASH] chunk={idx}  seg={seg_hash_hex[:16]}...  "
                  f"roll={rolling_hex[:16]}...  first={is_first}  final=True")
            self.on_chunk_hashed(idx, rolling_hex, seg_hash_hex, is_first, True)

        print(f"[PIPELINE] Real-time hashing complete — {self.chunk_count} chunks.")
