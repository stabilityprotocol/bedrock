# config.py — all constants in one place
# Change values here only; nothing else needs to be touched for tuning.

# --- VIDEO ---
RESOLUTION = (640, 480)       # width x height
FRAMERATE = 24                # fps
BITRATE = 2_000_000           # 2 Mbps H.264 encoding
VIDEO_FORMAT = "mp4"          # output container
OUTPUT_DIR = "/home/bedrock/recordings"  # where .mp4 files are saved

# --- WHITE BALANCE ---
# AWB_MODE sets the preset colour temperature used by the camera.
# 0=Auto  1=Incandescent  2=Tungsten  3=Fluorescent  4=Indoor  5=Daylight  6=Cloudy
# Indoor (4) is a safe warm default for typical room lighting and prevents
# the camera drifting cold when a bright light source is in frame.
AWB_MODE     = 4              # Indoor — warm preset, avoids cold drift

# --- HASHING ---
SEG_SIZE = 1_310_720  # 1.25 MB — must match backend/frontend SEG_SIZE_BYTES

# --- GPIO (hardware) ---
BUTTON_RECORD_PIN = 17        # single button — all gestures
# Hold durations defined in button.py: 2s=start, 3s=stop, 5s=shutdown

# --- DISPLAY ---
# Set USE_LCD = True when hardware arrives; False = terminal output only
USE_LCD = False
# SPI pins for ST7735 1.8" display (128x160)
LCD_DC_PIN  = 24   # DC  → GPIO24 (physical pin 18)
LCD_RST_PIN = 25   # RST → GPIO25 (physical pin 22)
LCD_BL_PIN  = 23   # BLK → GPIO23 (physical pin 16) — S8050 transistor, active HIGH

# --- REDIS ---
REDIS_URL = "redis://localhost:6379"  # local Redis on the Pi (used by BullMQ queue)

# --- BACKEND ---
BACKEND_URL     = "http://placeholder-backend"  # base URL — replace with real backend
BACKEND_TIMEOUT = 30          # seconds; hash submit may be slow under load
