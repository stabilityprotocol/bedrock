# Display & Button-Hold Logic Fix
## Pixel-Perfect Alignment + Timer Completion Bug

---

## Part 1: display.py — DEPLOYED ✓

**Changes:**
- ✅ Replaced manual centering with Pillow `anchor="mm"` parameter
- ✅ Split hero fonts: `FONT_HERO` (48px) for numbers, `FONT_HERO_TEXT` (20px) for words
- ✅ Removed unused `_text_w()` and `_text_h()` from helper functions
- ✅ All metadata, heroes, and footers now use perfect anchor centering

**Key Functions:**
- `_draw_hero_number(draw, text, color)` — Use for clock/timer/counts
- `_draw_hero_text(draw, text, color)` — Use for ERROR/COPYING/SHUTTING DOWN
- `_draw_metadata(draw, metadata_list)` — Centered below hero
- `_draw_footer_action(draw, text, color)` — Bottom action bar

File has been deployed to the Pi.

---

## Part 2: main.py — Button-Hold Logic Fix (CRITICAL)

### The Problem

In `main.py`, the button-hold callback `on_holding()` runs in a loop with `time.sleep(0.1)` intervals. When the hold duration is met (e.g., 2.0s for start), the loop breaks **before rendering the final 0.0s frame**. The display freezes at 0.1s or 0.2s.

### The Solution

In `main.py`, locate the `on_hold()` function (around line 85). After the state change and before the next screen renders, **force one final explicit render at 0.0s**, then sleep briefly to let the user see it.

### Code to Implement in main.py

Find the `on_holding()` function and the `on_hold()` function. The fix goes inside `on_hold()` in the IDLE → START and RECORDING → STOP branches:

```python
# ── In main.py, inside on_hold(seconds_held) ────────────────────────────────

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
            # HOLD COMPLETED: Force final 0.0s frame before transition
            with _display_lock:
                display.show_hold_progress("START", 0.0, HOLD_START)
            time.sleep(0.2)  # Let user see the 100% bar + 0.0s
            _do_start()
        else:
            with _display_lock:
                display.show_ready()

    elif state == AppState.RECORDING:
        if seconds_held >= HOLD_STOP:
            # HOLD COMPLETED: Force final 0.0s frame before transition
            with _display_lock:
                display.show_hold_progress("STOP", 0.0, HOLD_STOP)
            time.sleep(0.2)  # Let user see the 100% bar + 0.0s
            _do_stop()
        else:
            # Too short — restore recording screen
            elapsed = int(time.time() - recording_start) if recording_start else 0
            with _display_lock:
                display.show_recording(elapsed, pipeline.chunk_count if pipeline else 0)
```

### Why This Works

1. **`display.show_hold_progress("START", 0.0, HOLD_START)`** forces the display to render:
   - The timer text as "0.0s"
   - The progress bar at 100% full
   - The footer action text transitioned from "HOLDING" to "STARTING…"

2. **`time.sleep(0.2)`** ensures the render is visible on the physical TFT before the state changes (the screen will change to the next state after this, but the user will see the 0.0s completion).

3. The `_display_lock` ensures the frame is not overwritten by other threads during this critical moment.

### Apply This Fix

1. Open `/Users/NicoleMichaella/Desktop/SMU/MODS/4.2/FYP/BedRock/video-hasher/main.py`
2. Find the `on_hold()` function (around line 85)
3. In the `if seconds_held >= HOLD_START:` block, add the two lines above `_do_start()`
4. In the `elif seconds_held >= HOLD_STOP:` block, add the two lines above `_do_stop()`
5. Test: Hold the button for 2s on IDLE, watch the progress bar hit 100% and timer show 0.0s before recording starts

---

## Summary

| Component | Status | Change |
|-----------|--------|--------|
| `display.py` | ✅ Deployed | Anchor centering, split fonts |
| `main.py` button-hold | ⏳ Manual edit needed | Add 2 lines in `on_hold()` |

The display.py file is ready to push. The main.py fix requires manual editing of the `on_hold()` function in the two branches where hold time is met.
