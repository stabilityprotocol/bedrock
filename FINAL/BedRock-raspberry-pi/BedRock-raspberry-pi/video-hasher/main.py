# main.py
# Orchestrator — wires button, display, pipeline, and blockchain together.
# Run with: python3 main.py
#
# Single button hold gestures:
#   IDLE      + hold 2s → start recording
#   RECORDING + hold 3s → stop recording
#   IDLE      + hold 5s → shutdown
#   FINALIZING          → all input ignored ("do not interrupt")

import csv
import os
import signal
import time
import threading
from datetime import datetime

import blockchain
import display
import usb
from button   import ButtonHandler, HOLD_START, HOLD_STOP
from config   import SEG_SIZE
from pipeline import RecordingPipeline


# ── State ─────────────────────────────────────────────────────────────────────

class AppState:
    IDLE       = "idle"
    RECORDING  = "recording"
    FINALIZING = "finalizing"

state           = AppState.IDLE
pipeline        = None
contract_addr   = None
recording_start = None
_display_timer  = None
hash_records    = []   # cleared on each new recording
hash_worker     = None # blockchain.HashQueueWorker — real-time queue thread

# Single lock: only one thing renders to the display at a time.
# The display loop holds it briefly each update; button callbacks acquire it
# to take over the display, then release when done.
_display_lock   = threading.Lock()
_button_holding = threading.Event()  # Set while button is held — loop stops rendering


# ── Hash callback (pipeline → real-time blockchain queue) ─────────────────────

def on_chunk_hashed(chunk_index: int, rolling_hash: str, seg_hash: str,
                    is_first: bool, is_final: bool):
    record = {
        "index":      chunk_index,
        "segHashHex": seg_hash,
        "rollingHex": rolling_hash,
        "timestamp":  int(time.time() * 1000),
    }
    if is_first:
        record["type"] = "genesis"
    if is_final:
        record["isFinalHash"] = True
    hash_records.append(record)
    if hash_worker:
        hash_worker.submit(record)


# ── Button: live hold feedback ────────────────────────────────────────────────

def on_holding(seconds_held: float):
    """Called every ~0.1s while button is held."""
    if state == AppState.FINALIZING:
        return

    _button_holding.set()  # Stop the display loop from rendering

    if state == AppState.IDLE:
        remaining = max(0.0, HOLD_START - seconds_held)
        with _display_lock:
            display.show_hold_progress("START", remaining, HOLD_START)

    elif state == AppState.RECORDING:
        remaining = max(0.0, HOLD_STOP - seconds_held)
        with _display_lock:
            display.show_hold_progress("STOP", remaining, HOLD_STOP)


# ── Button: released ──────────────────────────────────────────────────────────

def on_hold(seconds_held: float):
    """Fired once when button is released."""
    global state, pipeline, contract_addr, recording_start, _display_timer
    _button_holding.clear()  # Let the display loop resume after button released

    if state == AppState.FINALIZING:
        with _display_lock:
            display.show_finalizing(pipeline.chunk_count if pipeline else 0)
        print("[MAIN] Input ignored — writing to blockchain, do not interrupt.")
        return

    if state == AppState.IDLE:
        if seconds_held >= HOLD_START:
            with _display_lock:
                display.show_hold_progress("START", 0.0, HOLD_START)
            time.sleep(0.2)
            _do_start()
        else:
            with _display_lock:
                display.show_ready()

    elif state == AppState.RECORDING:
        if seconds_held >= HOLD_STOP:
            # Show completion frame before transitioning
            with _display_lock:
                display.show_hold_progress("STOP", 0.0, HOLD_STOP)
            time.sleep(0.2)  # Let user see the 100% bar + 0.0s
            _do_stop()
        else:
            # Too short — restore recording screen
            elapsed = int(time.time() - recording_start) if recording_start else 0
            with _display_lock:
                display.show_recording(elapsed, pipeline.chunk_count if pipeline else 0)


# ── Actions ───────────────────────────────────────────────────────────────────

_SETUP_STEPS = [
    "Connecting to network...",
    "Deploying your secure record...",
    "Retrieving record address...",
    "Preparing camera...",
]

_FINALIZE_STEPS = [
    "Stopping camera...",
    "Draining hash queue...",
    "Writing session files...",
]


def _do_start():
    global state, pipeline, contract_addr, recording_start, _display_timer, hash_worker
    hash_records.clear()
    print("\n[MAIN] Starting recording...")

    # Step 1: Connecting
    with _display_lock:
        display.show_loading_step(1, _SETUP_STEPS, "SETUP",
                                  display.C_PURPLE_BG, display.C_PURPLE)
    time.sleep(0.5)

    # Step 2: Deploy (blocking)
    with _display_lock:
        display.show_loading_step(2, _SETUP_STEPS, "SETUP",
                                  display.C_PURPLE_BG, display.C_PURPLE)
    contract_addr = blockchain.deploy_session_contract()
    if contract_addr is None:
        with _display_lock:
            display.show_error("contract deploy failed")
        return

    # Step 3: Retrieving address
    with _display_lock:
        display.show_loading_step(3, _SETUP_STEPS, "SETUP",
                                  display.C_PURPLE_BG, display.C_PURPLE)
    time.sleep(0.5)

    # Step 4: Preparing camera
    with _display_lock:
        display.show_loading_step(4, _SETUP_STEPS, "SETUP",
                                  display.C_PURPLE_BG, display.C_PURPLE)
    time.sleep(0.3)

    recording_start = time.time()
    state = AppState.RECORDING

    # Start real-time hash queue worker before pipeline so it's ready
    rec_id = datetime.now().strftime("%Y%m%d_%H%M%S")
    hash_worker = blockchain.HashQueueWorker(contract_addr, rec_id)
    hash_worker.start()

    pipeline = RecordingPipeline(on_chunk_hashed=on_chunk_hashed)
    pipeline.start()

    _display_timer = threading.Thread(target=_display_loop, daemon=True)
    _display_timer.start()

    print("[MAIN] Recording started.")


def _do_stop():
    global state
    print("\n[MAIN] Stopping...")
    # Change state first so the display loop exits on its next iteration
    state = AppState.FINALIZING
    # Wait for the display loop thread to finish its current render and exit
    if _display_timer and _display_timer.is_alive():
        _display_timer.join(timeout=2)
    # Now we own the display exclusively — no lock needed here
    display.show_finalizing(pipeline.chunk_count)
    threading.Thread(target=_finalize, daemon=True).start()



# ── Finalize ──────────────────────────────────────────────────────────────────

def _finalize():
    global state

    duration = pipeline.elapsed_seconds()

    # Step 1: Stop camera + flush final hash from ffmpeg EOF
    display.show_loading_step(1, _FINALIZE_STEPS, "FINALIZING",
                              display.C_WARNING_BG, display.C_WARNING)
    pipeline.stop()

    # Step 2: Drain the real-time hash queue — block until every hash
    # has been enqueued to BullMQ. Nothing proceeds until this completes.
    display.show_loading_step(2, _FINALIZE_STEPS, "FINALIZING",
                              display.C_WARNING_BG, display.C_WARNING)
    if hash_worker:
        ok = hash_worker.drain(timeout=120)
    else:
        ok = True
    if not ok:
        display.show_error("hash queue drain failed")
        state = AppState.IDLE
        display.show_ready()
        return

    # Step 3: Writing session files
    display.show_loading_step(3, _FINALIZE_STEPS, "FINALIZING",
                              display.C_WARNING_BG, display.C_WARNING)
    json_path = _write_session_files()

    filename = os.path.basename(pipeline.output_path) if pipeline.output_path else "unknown"
    display.show_saved(filename, duration)
    print(f"[MAIN] Saved: {pipeline.output_path}  ({duration}s)")
    time.sleep(3)

    if pipeline.output_path:
        display.show_copying()
        success, msg = usb.copy_session(pipeline.output_path, contract_addr or "unknown", json_path)
        if success:
            print(f"[MAIN] USB copy OK -- {msg}")
            display.show_copy_ok(filename)
        else:
            print(f"[MAIN] USB copy skipped -- {msg}")
            display.show_copy_failed(msg)
        time.sleep(2)

    state = AppState.IDLE
    display.show_ready()


# ── Session file writer ───────────────────────────────────────────────────────

def _write_session_files() -> str | None:
    if not pipeline or not pipeline.output_path:
        print("[MAIN] No output path — skipping session file write.")
        return None

    recording_id = pipeline.recording_id
    output_dir   = os.path.dirname(pipeline.output_path)
    start_dt     = datetime.fromtimestamp(pipeline.start_time)
    end_dt       = datetime.fromtimestamp(pipeline.end_time or time.time())
    duration     = int((pipeline.end_time or time.time()) - pipeline.start_time)
    final_hash   = hash_records[-1]["rollingHex"] if hash_records else ""
    contract     = contract_addr or "pending"
    video_file   = os.path.basename(pipeline.output_path)

    log_path = os.path.join(output_dir, f"{recording_id}.log")
    with open(log_path, "w") as f:
        f.write("BEDROCK RECORDING SESSION\n")
        f.write("=" * 57 + "\n")
        f.write(f"Recording ID  : {recording_id}\n")
        f.write(f"Video File    : {video_file}\n")
        f.write(f"Start         : {start_dt.strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"End           : {end_dt.strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"Duration      : {duration} s\n")
        f.write(f"File Size     : {pipeline.file_size_bytes:,} bytes\n")
        f.write(f"Segments      : {len(hash_records)}\n")
        f.write(f"Segment Size  : {SEG_SIZE:,} bytes\n")
        f.write(f"Contract      : {contract}\n")
        f.write(f"Final Hash    : {final_hash}\n")
        f.write("\n")
        f.write("HASH CHAIN\n")
        f.write("-" * 57 + "\n")
        for rec in hash_records:
            idx    = rec["index"]
            label  = " [GENESIS]" if rec.get("type") == "genesis" else ""
            final  = " [FINAL]"   if rec.get("isFinalHash")        else ""
            ts_ms  = rec.get("timestamp", 0)
            ts_str = datetime.fromtimestamp(ts_ms / 1000).strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
            f.write(f"\n[{idx}]{label}{final}\n")
            f.write(f"  seg_hash  : {rec['segHashHex']}\n")
            f.write(f"  rolling   : {rec['rollingHex']}\n")
            f.write(f"  timestamp : {ts_str}\n")

    csv_path     = os.path.join(output_dir, "sessions.csv")
    write_header = not os.path.exists(csv_path)
    with open(csv_path, "a", newline="") as f:
        w = csv.writer(f)
        if write_header:
            w.writerow(["video_title", "start_datetime", "end_datetime", "contract_address"])
        w.writerow([
            recording_id,
            start_dt.strftime("%Y-%m-%d %H:%M:%S"),
            end_dt.strftime("%Y-%m-%d %H:%M:%S"),
            contract,
        ])

    print(f"[MAIN] Session files written: {log_path}")
    return log_path


# ── Display refresh loop ──────────────────────────────────────────────────────

def _display_loop():
    """Updates recording screen every second. Pauses while button is held."""
    while state == AppState.RECORDING:
        # Block until button is released (event cleared), then render once
        if _button_holding.wait(timeout=1.0):
            # Event was set (button held) — skip this render cycle
            continue
        # Event not set — button is free, render the recording screen
        if state != AppState.RECORDING:
            break
        with _display_lock:
            elapsed     = int(time.time() - recording_start) if recording_start else 0
            chunks      = pipeline.chunk_count if pipeline else 0
            latest_hash = pipeline.latest_hash if pipeline else ""
            display.show_recording(elapsed, chunks, latest_hash)
    # Exits cleanly when state changes to FINALIZING


# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    print("[MAIN] Video Hasher starting...")
    display.clear()
    time.sleep(0.1)
    display.show_ready()

    buttons = ButtonHandler(
        on_hold=on_hold,
        on_holding=on_holding,
    )
    buttons.start()

    def _sig_shutdown(signum, frame):
        """SIGTERM: stop pipeline, keep display alive (no white screen)."""
        print("\n[MAIN] Shutdown signal received.")
        if state == AppState.RECORDING and pipeline:
            pipeline.stop()
        display.show_ready()
        # Hold process alive so GPIO pins stay HIGH — prevents white screen
        while True:
            time.sleep(1)

    signal.signal(signal.SIGTERM, _sig_shutdown)

    try:
        while True:
            time.sleep(0.5)
    except KeyboardInterrupt:
        print("\n[MAIN] Ctrl-C received.")
        if state == AppState.RECORDING and pipeline:
            pipeline.stop()
        display.show_ready()
        # Hold process alive — prevents white screen from GPIO cleanup
        while True:
            time.sleep(1)


if __name__ == "__main__":
    main()
