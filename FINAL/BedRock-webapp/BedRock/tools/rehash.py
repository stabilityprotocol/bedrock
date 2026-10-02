#!/usr/bin/env python3
"""
rehash.py — Offline verifier for the rolling-hash chain produced by recording.js

Algorithm (mirrors recording.js / hashing.js exactly):

  SEG_SIZE = 1.25 MB (1,310,720 bytes) by default — configurable via SEG_SIZE_BYTES env var

  Split the file into sequential SEG_SIZE blocks (zero-pad the last one).

  segHash_i = SHA-256(block_i)
  roll_0    = SHA-256(segHash_0)
  roll_i    = SHA-256(roll_{i-1} || segHash_i)   for i >= 1

  The first block (index 0) is the genesis segment.
  No genesis_byte_count parameter is needed.

Usage:
  python rehash.py <mp4_file>
"""

import hashlib
import sys
import os

SEG_SIZE = int(os.environ.get("SEG_SIZE_BYTES", 1_310_720))  # default 1.25 MB — must match recording.js


def sha256(data: bytes) -> bytes:
    return hashlib.sha256(data).digest()


def pad_to_seg(data: bytes) -> bytes:
    """Zero-pad `data` to exactly SEG_SIZE bytes.

    Uses bytearray so the zero-fill is unambiguous — mirrors:
        const segBytes = new Uint8Array(SEG_SIZE);  // zero-filled
        segBytes.set(fragment, offset);
    """
    buf = bytearray(SEG_SIZE)   # SEG_SIZE zero bytes
    buf[: len(data)] = data     # copy real bytes; remainder stays 0x00
    return bytes(buf)


def rehash(mp4_path: str):
    """
    Re-compute the full rolling-hash chain for an MP4 file.

    The file is split into sequential SEG_SIZE blocks starting at byte 0.
    The first block is the genesis segment (index 0).

    Returns a list of dicts:
        { index, seg_hash_hex, rolling_hex }
        (index 0 also has: type="genesis")
    """
    with open(mp4_path, "rb") as f:
        mp4 = f.read()

    total_bytes = len(mp4)
    print(f"File     : {mp4_path}")
    print(f"Size     : {total_bytes:,} bytes")
    print(f"SEG_SIZE : {SEG_SIZE:,} bytes ({SEG_SIZE / (1024 * 1024):.2f} MB)")
    print()

    records = []
    rolling = None
    offset  = 0
    seg_index = 0

    while offset < total_bytes:
        chunk  = mp4[offset: offset + SEG_SIZE]
        offset += SEG_SIZE

        padded   = pad_to_seg(chunk)
        seg_hash = sha256(padded)

        if rolling is None:
            # roll_0 = SHA-256(segHash_0)
            rolling = sha256(seg_hash)
        else:
            # roll_i = SHA-256(roll_{i-1} || segHash_i)
            rolling = sha256(rolling + seg_hash)

        is_partial = len(chunk) < SEG_SIZE
        is_genesis = seg_index == 0

        record = {
            "index":        seg_index,
            "seg_hash_hex": seg_hash.hex(),
            "rolling_hex":  rolling.hex(),
        }
        if is_genesis:
            record["type"] = "genesis"
        records.append(record)

        label  = "SEG 0 (genesis)" if is_genesis else f"SEG {seg_index}"
        suffix = f" (partial {len(chunk):,} bytes padded->{SEG_SIZE})" if is_partial else ""
        print(
            f"{label}{suffix}"
            f"\n         segHash = {seg_hash.hex()}"
            f"\n         rolling = {rolling.hex()}"
        )

        seg_index += 1

    print()
    print(f"Total segments : {len(records)}")
    print(f"FINAL rolling  : {rolling.hex() if rolling else 'n/a'}")

    return records


def main():
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(1)

    mp4_path = sys.argv[1]

    if not os.path.isfile(mp4_path):
        print(f"ERROR: file not found: {mp4_path}", file=sys.stderr)
        sys.exit(1)

    rehash(mp4_path)


if __name__ == "__main__":
    main()