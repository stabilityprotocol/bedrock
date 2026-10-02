# button.py
# Single button, hold-duration based gestures:
#   IDLE      — hold 2s → start recording
#   RECORDING — hold 3s → stop recording
#   IDLE      — hold 5s → shutdown
#
# Keyboard stub:
#   Press '2' + Enter → simulate 2s hold (start)
#   Press '3' + Enter → simulate 3s hold (stop)
#   Press '5' + Enter → simulate 5s hold (shutdown)
#
# When hardware arrives: set USE_GPIO = True (one line change).

import threading
import time
from config import BUTTON_RECORD_PIN

# ── Toggle this when GPIO hardware is connected ───────────────────────────────
USE_GPIO = True

# Hold durations (seconds)
HOLD_START = 2
HOLD_STOP  = 3

if USE_GPIO:
    import RPi.GPIO as GPIO
    # Delay setup until handler starts to avoid init timing issues
    _gpio_initialized = False


class ButtonHandler:
    """
    Single button handler. Caller provides:
        on_hold(seconds)        — called with hold duration when button released
        on_holding(seconds)     — called every 0.1s while held (for live LCD countdown)

    main.py decides what each duration means based on current app state.
    """

    def __init__(self, on_hold, on_holding=None):
        self.on_hold    = on_hold
        self.on_holding = on_holding or (lambda s: None)
        self._running   = False
        self._threads   = []

    def start(self):
        self._running = True
        if USE_GPIO:
            self._start_gpio()
        else:
            self._start_keyboard()

    def stop(self):
        self._running = False
        for t in self._threads:
            t.join(timeout=2)

    # ── GPIO mode ─────────────────────────────────────────────────────────────

    def _start_gpio(self):
        global _gpio_initialized
        if not _gpio_initialized:
            GPIO.setmode(GPIO.BCM)
            GPIO.setup(BUTTON_RECORD_PIN, GPIO.IN, pull_up_down=GPIO.PUD_UP)
            _gpio_initialized = True
        t = threading.Thread(target=self._gpio_loop, daemon=True)
        t.start()
        self._threads.append(t)

    def _gpio_loop(self):
        """Poll button state; measure hold duration; fire callbacks."""
        while self._running:
            if GPIO.input(BUTTON_RECORD_PIN) == GPIO.LOW:
                hold_start = time.time()
                while GPIO.input(BUTTON_RECORD_PIN) == GPIO.LOW:
                    held = time.time() - hold_start
                    self.on_holding(held)
                    time.sleep(0.1)
                # Button released — report total hold duration
                total = time.time() - hold_start
                if total >= 0.2:   # ignore sub-200ms noise
                    self.on_hold(total)
            time.sleep(0.05)

    # ── Keyboard stub mode ────────────────────────────────────────────────────

    def _start_keyboard(self):
        print("\n[BUTTON] Keyboard stub — single button hold simulation:")
        print("         '2' + Enter  → hold 2s  (START recording — from IDLE)")
        print("         '3' + Enter  → hold 3s  (STOP  recording — from RECORDING)\n")
        t = threading.Thread(target=self._keyboard_loop, daemon=True)
        t.start()
        self._threads.append(t)

    def _keyboard_loop(self):
        while self._running:
            try:
                key = input().strip()
                try:
                    duration = float(key)
                    # Simulate the on_holding ticks
                    steps = int(duration / 0.1)
                    for i in range(steps):
                        self.on_holding(i * 0.1)
                        time.sleep(0.02)   # fast-forward for keyboard sim
                    self.on_hold(duration)
                except ValueError:
                    print("[BUTTON] Enter '2', '3', or '5' to simulate hold durations.")
            except EOFError:
                break


def cleanup():
    """Call on exit when USE_GPIO = True."""
    if USE_GPIO:
        GPIO.cleanup()
