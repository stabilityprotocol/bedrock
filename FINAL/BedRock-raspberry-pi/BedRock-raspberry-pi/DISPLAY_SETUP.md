# Video Hasher Display Setup - Generic ST7735 ✓

## Issue
The ST7735 1.8" LCD display was previously configured with Adafruit libraries which may be incompatible or excessive for a generic (non-Adafruit) TFT module.

## Root Cause
The `adafruit-circuitpython-rgb-display` library is part of the Adafruit ecosystem and requires the "Blinka" compatibility layer. Generic ST7735 modules often work more reliably with a direct SPI driver like the Pimoroni `st7735-python` library, which talks directly to `/dev/spidev`.

## Solution

### 1. **Install Pimoroni ST7735 Library** (on Raspberry Pi)
This library is lightweight and specifically designed for ST7735 controllers.

```bash
# Install system dependencies for SPI and GPIO
sudo apt-get update
sudo apt-get install -y python3-dev python3-rpi.gpio python3-pil python3-numpy

# Install the library (using --break-system-packages if not in a venv)
python3 -m pip install st7735 --break-system-packages
```

### 2. **Enable SPI**
Ensure SPI is enabled via `raspi-config`:
1. Run `sudo raspi-config`
2. Go to **Interface Options** -> **SPI** -> **Yes**
3. Reboot if prompted.

### 3. **Hardware Wiring** (Standard ST7735 1.8")
| Display Pin | Pi Pin (BCM) | Physical Pin |
| :--- | :--- | :--- |
| **VCC** | 5V | 1 or 2 |
| **GND** | GND | 6, 9, 14, 20, 25 |
| **CS** | CE0 (8) | 24 |
| **RESET** | 25 | 22 |
| **DC / A0** | 24 | 18 |
| **SDA / MOSI** | 10 | 19 |
| **SCL / SCK** | 11 | 23 |
| **LED / BL** | Unplugged | - |

## Verification
1. Run the main application: `python3 main.py`
2. The screen should clear to black and display **READY** in green.
3. If colors are swapped (e.g., Red/Blue), toggle `invert=True/False` in `video-hasher/display.py`.
4. If the screen is shifted, adjust `offset_left` or `offset_top` in the `ST7735` constructor.

## Troubleshooting
- **White Screen**: Check SPI wiring (MOSI/SCLK) and ensure SPI is enabled.
- **Black Screen**: Check Backlight (LED) wiring to 3.3V.
- **Garbage/Noise**: Check DC and RESET pins; ensure they match `config.py`.
- **Import Error**: Ensure `pip install st7735` was successful.
