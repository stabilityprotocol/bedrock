# usb.py
# Handles USB drive detection, MP4 copy, and session file sync.
#
# Files written/synced to USB root after each session:
#   {recording_id}.mp4   — the video recording
#   {recording_id}.json  — full hash chain log (all seg+rolling hashes, metadata)
#   sessions.csv         — running log of all sessions (overwritten with latest local copy)

import os
import shutil
import glob
import subprocess

# Pi automounts USB drives here
USB_MOUNT_GLOB = "/media/bedrock/*"


def find_usb() -> str | None:
    """
    Return the mount path of the first USB drive found, or None.
    Pi OS automounts USB drives to /media/bedrock/<label>/
    """
    mounts = glob.glob(USB_MOUNT_GLOB)
    for mount in mounts:
        if os.path.ismount(mount):
            return mount
    return None


def _sync_drive(mount_path: str):
    """Force sync to ensure data is written to USB drive."""
    try:
        subprocess.run(["sync"], check=True, timeout=10)
    except Exception as e:
        print(f"[USB] Warning: sync failed: {e}")


def copy_session(
    mp4_path: str,
    contract_address: str,
    json_log_path: str | None = None,
) -> tuple[bool, str]:
    """
    Copy session files to the USB drive.

    Copies:
      - MP4 video
      - JSON hash-chain log (if json_log_path provided)
      - sessions.csv (local copy overwritten onto USB so it stays in sync)

    Returns (success: bool, message: str)
    """
    usb_path = find_usb()
    if usb_path is None:
        return False, "no USB drive found"

    # ── Copy MP4 ──────────────────────────────────────────────────────────────
    filename = os.path.basename(mp4_path)
    try:
        dest_path = os.path.join(usb_path, filename)
        shutil.copy2(mp4_path, dest_path)
        print(f"[USB] Copied: {filename}")
    except OSError as e:
        return False, f"MP4 copy failed: {e}"

    # ── Copy JSON hash-chain log ───────────────────────────────────────────────
    if json_log_path and os.path.exists(json_log_path):
        try:
            dest_path = os.path.join(usb_path, os.path.basename(json_log_path))
            shutil.copy2(json_log_path, dest_path)
            print(f"[USB] Copied: {os.path.basename(json_log_path)}")
        except OSError as e:
            return True, f"MP4 copied but JSON log copy failed: {e}"

    # ── Sync sessions.csv (overwrite USB with latest local copy) ──────────────
    local_csv = os.path.join(os.path.dirname(mp4_path), "sessions.csv")
    if os.path.exists(local_csv):
        try:
            dest_path = os.path.join(usb_path, "sessions.csv")
            shutil.copy2(local_csv, dest_path)
            print(f"[USB] Copied: sessions.csv")
        except OSError as e:
            return True, f"MP4 copied but sessions.csv sync failed: {e}"

    # ── Force sync to ensure all data is written to USB drive ──────────────────
    print("[USB] Syncing to USB drive...")
    _sync_drive(usb_path)
    print("[USB] Sync complete")

    return True, f"copied to {usb_path}"
