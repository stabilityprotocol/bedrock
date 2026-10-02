# display.py
# ST7735S 1.8" LCD — BedRock Brand UI  (landscape 160×128)
# Modern dashboard design: Hero metrics, action footer, minimal labels.
# Pixel-perfect centering with Pillow anchors.
# Brand colours from BedRock Brand Guide v1.1.
# Public API is unchanged — main.py needs no edits.

import textwrap
import time
import board
import busio
import digitalio
from adafruit_rgb_display import st7735
from PIL import Image, ImageDraw, ImageFont

# ── LCD Init Sequence (from test_display.py) ──────────────────────────────────

_RAW_INIT = [
    (0x11, None,                     0.120),   # Sleep out

    # Frame rate
    (0xB1, bytes([0x05, 0x3C, 0x3C]), 0),
    (0xB2, bytes([0x05, 0x3C, 0x3C]), 0),
    (0xB3, bytes([0x05, 0x3C, 0x3C, 0x05, 0x3C, 0x3C]), 0),

    (0xB4, bytes([0x03]),             0),       # Dot inversion

    # Power sequence
    (0xC0, bytes([0x28, 0x08, 0x04]), 0),
    (0xC1, bytes([0xC0]),             0),
    (0xC2, bytes([0x0D, 0x00]),       0),
    (0xC3, bytes([0x8D, 0x2A]),       0),
    (0xC4, bytes([0x8D, 0xEE]),       0),

    (0xC5, bytes([0x1A]),             0),       # VCOM
    (0x36, bytes([0xC0]),             0),       # MX, MY, RGB mode

    # Positive gamma
    (0xE0, bytes([0x04, 0x22, 0x07, 0x0A, 0x2E, 0x30, 0x25, 0x2A,
                  0x28, 0x26, 0x2E, 0x3A, 0x00, 0x01, 0x03, 0x13]), 0),
    # Negative gamma
    (0xE1, bytes([0x04, 0x16, 0x06, 0x0D, 0x2D, 0x26, 0x23, 0x27,
                  0x27, 0x25, 0x2D, 0x3B, 0x00, 0x01, 0x04, 0x13]), 0),

    (0x3A, bytes([0x05]),             0),       # 65k colour mode
    (0x29, None,                      0),       # Display on
]

CTC180_INIT   = [(cmd, data) for cmd, data, _ in _RAW_INIT]
CTC180_DELAYS = {i: delay for i, (_, _, delay) in enumerate(_RAW_INIT) if delay}


# ── Hardware Setup ────────────────────────────────────────────────────────────

cs    = digitalio.DigitalInOut(board.D5)    # BCM 5  — moved off CE0
reset = digitalio.DigitalInOut(board.D25)   # BCM 25
dc    = digitalio.DigitalInOut(board.D24)   # BCM 24

spi = busio.SPI(clock=board.SCLK, MOSI=board.MOSI)  # BCM 11, BCM 10


class ST7735S_CTC180(st7735.ST7735):
    """ST7735S subclass using the CTC180 module's own init sequence."""

    _INIT = CTC180_INIT

    def init(self):
        for i, (command, data) in enumerate(self._INIT):
            self.write(command, data)
            if i in CTC180_DELAYS:
                time.sleep(CTC180_DELAYS[i])


# Initialize display — landscape 160×128
display = ST7735S_CTC180(
    spi,
    cs=cs,
    dc=dc,
    rst=reset,
    width=128,
    height=160,
    rotation=90,        # Landscape: 90° clockwise → 160 wide × 128 tall
    baudrate=5000000,
)

# ── Constants ─────────────────────────────────────────────────────────────────

W, H = 160, 128   # Landscape canvas dimensions
HEADER_H = 18     # Compact merged header
FOOTER_H = 22     # Action footer (Y=106 to 128)

# ── Palette — mirrors webapp brandColors, adapted for TFT ───────────────────

C_BG          = (12,  10,  23)    # appBg #0C0A17
C_DIVIDER     = (45,  40,  70)    # subtle purple-grey divider

C_GOLD        = (255, 215, 0)     # pure gold
C_OFF_WHITE   = (244, 238, 255)   # offWhite #F4EEFF
C_SILVER      = (137, 130, 170)   # subheader #8982AA
C_PURPLE      = (113, 66,  255)   # gradientViolet #7142FF

# Status badge backgrounds
C_SUCCESS_BG  = (16,  185, 129)   # emerald #10b981
C_ERROR_BG    = (220, 38,  38)    # red #dc2626
C_WARNING_BG  = (245, 158, 11)    # amber #f59e0b
C_PURPLE_BG   = (113, 66,  255)   # violet #7142FF

C_DARK_TEXT   = (12,  10,  23)    # dark navy for text on bright backgrounds

# Data accent colours (bright for TFT visibility)
C_SUCCESS     = (52,  211, 153)   # bright emerald
C_ERROR       = (248, 113, 113)   # bright red
C_WARNING     = (251, 191, 36)    # bright amber

# ── Font loading ─────────────────────────────────────────────────────────────

_FONT_PATHS_BOLD = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
]
_FONT_PATHS_REG = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
]
_FONT_PATHS_MONO = [
    "/usr/share/fonts/truetype/liberation/LiberationMono-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf",
    "/usr/share/fonts/truetype/freefont/FreeMonoBold.ttf",
]


def _load(size, bold=False, mono=False):
    if mono:
        paths = _FONT_PATHS_MONO
    elif bold:
        paths = _FONT_PATHS_BOLD
    else:
        paths = _FONT_PATHS_REG
    for path in paths:
        try:
            return ImageFont.truetype(path, size)
        except (IOError, OSError):
            continue
    return ImageFont.load_default()


FONT_BRAND      = _load(14, bold=True)   # Header "BEDROCK"
FONT_STATUS     = _load(9,  bold=True)   # Header status text (small)
FONT_HERO       = _load(36, bold=True)   # Hero numbers (clock, fractions) — max for 160px
FONT_HERO_TEXT  = _load(18, bold=True)   # Hero text (ERROR, COPYING, etc.) — fits 160px
FONT_TIMER_MONO = _load(24, mono=True)   # Monospace timer — 8 chars fit within 144px safe zone
FONT_META       = _load(11, bold=False)  # Metadata below hero
FONT_FOOTER     = _load(12, bold=True)   # Footer action text
FONT_SMALL      = _load(11, bold=False)  # Secondary text


# ── Internal helpers ──────────────────────────────────────────────────────────

def _new_canvas():
    img  = Image.new("RGB", (W, H), C_BG)
    draw = ImageDraw.Draw(img)
    return img, draw


def _text_w(draw, text, font):
    """Get width of text in pixels."""
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[2] - bbox[0]


def _text_h(draw, text, font):
    """Get height of text in pixels."""
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[3] - bbox[1]


def _push(img):
    try:
        display.image(img)
    except Exception as e:
        print(f"[DISPLAY] Error: {e}")


def _draw_header(draw, status_text: str, status_color: tuple):
    """Full-width header bar: colored left accent strip + brand + status pill."""
    # Solid colored left accent bar (4px wide, full header height)
    draw.rectangle([0, 0, 3, HEADER_H - 1], fill=status_color)

    # "BEDROCK" brand — white, left-aligned after accent
    draw.text((10, 2), "BEDROCK", font=FONT_BRAND, fill=C_OFF_WHITE)

    # Status pill: rounded rect on the right with colored bg + dark text
    pill_text = status_text
    pill_w = 52
    pill_x = W - pill_w - 4
    pill_y = 2
    pill_h = HEADER_H - 5
    draw.rounded_rectangle([pill_x, pill_y, pill_x + pill_w, pill_y + pill_h],
                            radius=3, fill=status_color)
    draw.text((pill_x + pill_w // 2, pill_y + pill_h // 2),
              pill_text, font=FONT_STATUS, fill=C_DARK_TEXT, anchor="mm")

    # Bright divider line below header
    draw.line([(0, HEADER_H - 1), (W - 1, HEADER_H - 1)], fill=C_DIVIDER, width=1)


def _draw_hero_number(draw, text: str, color: tuple):
    """Hero number at strict Y=50 center. FONT_HERO (36px)."""
    draw.text((W // 2, 50), text, font=FONT_HERO, fill=color, anchor="mm")


def _draw_hero_text(draw, text: str, color: tuple):
    """Hero text at strict Y=50 center. FONT_HERO_TEXT (20px)."""
    draw.text((W // 2, 50), text, font=FONT_HERO_TEXT, fill=color, anchor="mm")


def _draw_metadata(draw, metadata_list: list[str]):
    """Metadata lines starting at strict Y=75, 14px spacing."""
    for i, text in enumerate(metadata_list):
        fill = C_OFF_WHITE if i == 0 else C_SILVER
        draw.text((W // 2, 75 + i * 14), text, font=FONT_META, fill=fill, anchor="mm")


def _draw_footer_action(draw, text: str, color: tuple):
    """Action footer: Y=106–128. Bright background, bold dark text."""
    draw.rectangle([0, 106, W - 1, H - 1], fill=color)
    # Thin top-edge highlight for depth
    draw.line([(0, 106), (W - 1, 106)], fill=C_OFF_WHITE, width=1)
    draw.text((W // 2, 117), text, font=FONT_FOOTER, fill=C_DARK_TEXT, anchor="mm")


# ── Public API ────────────────────────────────────────────────────────────────

def clear():
    """Clear the display to app background."""
    img = Image.new("RGB", (W, H), C_BG)
    _push(img)


def show_ready():
    """Idle / standby screen: shows massive clock."""
    clock = time.strftime("%H:%M")
    img, draw = _new_canvas()

    _draw_header(draw, "IDLE", C_SUCCESS_BG)
    _draw_hero_number(draw, clock, C_GOLD)
    # No metadata — clock is the sole focus
    _draw_footer_action(draw, "HOLD 2S TO START", C_SUCCESS_BG)

    _push(img)


def show_loading_step(step: int, steps: list, header_text: str,
                      color_bg: tuple, color_accent: tuple):
    """
    Single-step centered display with step counter and progress dots.
    One step at a time — no overflow, no alignment issues on 160×128.

    Layout:
      Header      Y=0-18
      Counter     Y=32    "Step 2 of 4"  (silver, centered)
      Label L1    Y=52    Step text line 1 (white, centered)
      Label L2    Y=66    Step text line 2 if wrapped (white, centered)
      Dots        Y=100   ● ● ○ ○  progress indicator
    """
    img, draw = _new_canvas()
    _draw_header(draw, header_text, color_bg)

    total = len(steps)
    label = steps[step - 1]

    # Step counter centered
    counter = f"Step {step} of {total}"
    draw.text((W // 2, 32), counter, font=FONT_META, fill=C_SILVER, anchor="mm")

    # Wrap label to ~20 chars per line, center each line
    wrapped = textwrap.wrap(label, width=20)[:2]
    if len(wrapped) == 1:
        draw.text((W // 2, 58), wrapped[0], font=FONT_META,
                  fill=C_OFF_WHITE, anchor="mm")
    else:
        draw.text((W // 2, 52), wrapped[0], font=FONT_META,
                  fill=C_OFF_WHITE, anchor="mm")
        draw.text((W // 2, 66), wrapped[1], font=FONT_META,
                  fill=C_OFF_WHITE, anchor="mm")

    # Progress dots: filled for done/active, outline for pending
    dot_r    = 4
    dot_gap  = 16
    dots_w   = (total - 1) * dot_gap
    dot_y    = 100
    dot_x0   = (W - dots_w) // 2

    C_DOT_PENDING = (50, 45, 75)

    for i in range(total):
        cx = dot_x0 + i * dot_gap
        if i + 1 <= step:
            draw.ellipse([cx - dot_r, dot_y - dot_r,
                          cx + dot_r, dot_y + dot_r],
                         fill=color_accent)
        else:
            draw.ellipse([cx - dot_r, dot_y - dot_r,
                          cx + dot_r, dot_y + dot_r],
                         outline=C_DOT_PENDING, width=1)

    _push(img)


def show_recording(elapsed_seconds: int, chunk_count: int, latest_hash: str = ""):
    """Live recording screen: monospace timer, chunk count metadata."""
    elapsed = _fmt_elapsed(elapsed_seconds)

    img, draw = _new_canvas()

    _draw_header(draw, "REC", C_ERROR_BG)
    # Use monospace font so fixed-width digits never spill past 160px
    draw.text((W // 2, 50), elapsed, font=FONT_TIMER_MONO, fill=C_ERROR, anchor="mm")

    # Metadata: live hash count + rolling hash preview
    if chunk_count > 0:
        meta_line1 = f"✓ {chunk_count} seg{'s' if chunk_count != 1 else ''} hashed"
        meta_line2 = latest_hash[:14] + "…" if latest_hash else ""
    else:
        meta_line1 = "Hashing live…"
        meta_line2 = "Segments appear here"
    _draw_metadata(draw, [meta_line1, meta_line2])

    _draw_footer_action(draw, "HOLD 3S TO STOP", C_ERROR_BG)

    _push(img)


def show_finalizing(chunk_count: int):
    img, draw = _new_canvas()

    _draw_header(draw, "FINALIZING", C_WARNING_BG)
    _draw_hero_number(draw, str(chunk_count), C_WARNING)

    # Metadata
    _draw_metadata(draw, ["Chunks", "Writing to blockchain…"])

    _draw_footer_action(draw, "DO NOT INTERRUPT", C_WARNING_BG)

    _push(img)


def show_saved(filename: str, duration_seconds: int):
    dur = _fmt_elapsed(duration_seconds)
    short_name = filename[:20] + ("…" if len(filename) > 20 else "")

    img, draw = _new_canvas()

    _draw_header(draw, "SAVED", C_SUCCESS_BG)
    _draw_hero_number(draw, dur, C_GOLD)

    # Metadata: filename
    _draw_metadata(draw, [short_name])

    _draw_footer_action(draw, "COPYING TO USB", C_SUCCESS_BG)

    _push(img)


def show_error(reason: str):
    short = reason[:30] + ("…" if len(reason) > 30 else "")

    img, draw = _new_canvas()

    _draw_header(draw, "ERROR", C_ERROR_BG)
    _draw_hero_text(draw, "ERROR", C_ERROR)

    # Metadata: error reason
    _draw_metadata(draw, [short])

    _draw_footer_action(draw, "TAP TO RETRY", C_ERROR_BG)

    _push(img)


def show_hold_progress(action: str, seconds_remaining: float, total: float):
    """Show hold progress: countdown timer as hero, progress bar as metadata."""
    # CRITICAL FIX: Clamp floating-point inaccuracy
    if seconds_remaining <= 0.05:
        seconds_remaining = 0.0

    secs_text = f"{seconds_remaining:.1f}s"

    colour_map = {"START": C_SUCCESS_BG, "STOP": C_ERROR_BG, "SHUTDOWN": C_WARNING_BG}
    bar_color = colour_map.get(action, C_PURPLE_BG)
    data_color_map = {"START": C_SUCCESS, "STOP": C_ERROR, "SHUTDOWN": C_WARNING}
    data_color = data_color_map.get(action, C_PURPLE)

    action_text_map = {"START": "STARTING…", "STOP": "STOPPING…", "SHUTDOWN": "SHUTTING DOWN…"}
    action_text = action_text_map.get(action, f"HOLD {action}")

    img, draw = _new_canvas()

    _draw_header(draw, "HOLDING", bar_color)

    # Hero: countdown timer at strict Y=50
    draw.text((W // 2, 50), secs_text, font=FONT_HERO, fill=C_OFF_WHITE, anchor="mm")

    # Graphical progress bar at Y=75
    bar_y = 75
    bar_w = 90
    bar_h = 8
    bar_x = (W - bar_w) // 2

    # Background track
    draw.rectangle([bar_x, bar_y, bar_x + bar_w, bar_y + bar_h],
                   fill=C_DIVIDER, outline=C_SILVER, width=1)

    # Filled portion
    if total > 0:
        pct = max(0.0, 1.0 - (seconds_remaining / total))
    else:
        pct = 1.0
    fill_w = int(pct * bar_w)
    if fill_w > 0:
        draw.rectangle([bar_x, bar_y, bar_x + fill_w, bar_y + bar_h], fill=data_color)

    _draw_footer_action(draw, action_text, bar_color)

    _push(img)


def show_copying():
    img, draw = _new_canvas()

    _draw_header(draw, "COPYING", C_WARNING_BG)
    _draw_hero_text(draw, "COPYING", C_WARNING)

    # Metadata
    _draw_metadata(draw, ["Writing to USB drive"])

    _draw_footer_action(draw, "PLEASE WAIT", C_WARNING_BG)

    _push(img)


def show_copy_ok(filename: str):
    short_name = filename[:20] + ("…" if len(filename) > 20 else "")

    img, draw = _new_canvas()

    _draw_header(draw, "COPIED", C_SUCCESS_BG)
    _draw_hero_text(draw, "✓", C_SUCCESS)

    # Metadata: filename
    _draw_metadata(draw, [short_name])

    _draw_footer_action(draw, "COPY SUCCESSFUL", C_SUCCESS_BG)

    _push(img)


def show_copy_failed(reason: str):
    short = reason[:20] + ("…" if len(reason) > 20 else "")

    img, draw = _new_canvas()

    _draw_header(draw, "COPY FAILED", C_ERROR_BG)
    _draw_hero_text(draw, "✗", C_ERROR)

    # Metadata: reason
    _draw_metadata(draw, [short])

    _draw_footer_action(draw, "FILES ON SD CARD", C_ERROR_BG)

    _push(img)


def show_shutdown():
    img, draw = _new_canvas()

    _draw_header(draw, "SHUTDOWN", C_WARNING_BG)
    _draw_hero_text(draw, "SHUTTING DOWN", C_WARNING)

    _draw_footer_action(draw, "PLEASE WAIT", C_WARNING_BG)

    _push(img)


# ── Helper ────────────────────────────────────────────────────────────────────

def _fmt_elapsed(seconds: int) -> str:
    h = seconds // 3600
    m = (seconds % 3600) // 60
    s = seconds % 60
    return f"{h:02d}:{m:02d}:{s:02d}"
