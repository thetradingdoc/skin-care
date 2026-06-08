#!/usr/bin/env python3
"""
build-logo-wordmark-portable.py — design archive (deprecated for production)
============================================================================
Portable reference copy of the original design-time PNG compositor.

Composites the Skin&Care logo wordmark:
  italic serif  "skin"  +  dove icon (centred above gap)  +  bold sans  "care"

Output (transparent PNG, black mark):
  logo-wordmark.png       (1x  ≈ 1100×300)
  logo-wordmark@2x.png    (2x  ≈ 2200×600)

Usage:
  python build-logo-wordmark-portable.py

Requirements:
  pip install pillow numpy

Font requirements (edit paths below if needed):
  SERIF_ITALIC  — Times New Roman Italic, Crimson Pro Italic, FreeSerifItalic, etc.
  SANS_BOLD     — Be Vietnam Pro Bold (or any geometric/humanist bold sans)

Dove source:
  DOVE_PNG      — white tulip/dove mark on black background (from 10.svg export)

Production wordmark: DoveIcon.jsx LogoWordmark + tulip-mark.svg (see docs/Brand/BRAND_IP_AND_LICENSES.md).
Monorepo adapter: unified-dashboard/skin-care-landing/scripts/build-logo-wordmark.py
"""

from PIL import Image, ImageDraw, ImageFont
import numpy as np
import os

# ── PATHS — edit these ───────────────────────────────────────────────────────
SERIF_ITALIC = '/usr/share/fonts/truetype/freefont/FreeSerifItalic.ttf'
SANS_BOLD    = 'BeVietnamPro-Bold.ttf'   # drop next to this script, or full path
DOVE_PNG     = '10_img0.png'             # white dove on black, extracted from 10.svg

OUT_1X = 'logo-wordmark.png'
OUT_2X = 'logo-wordmark@2x.png'

# ── TUNING ───────────────────────────────────────────────────────────────────
SCALE       = 4       # internal supersampling (downsample at end → crisp edges)
FONT_SIZE   = 260 * SCALE
CANVAS_H    = 360 * SCALE
PADDING     = 60  * SCALE   # left/right outer padding
GAP         = 80  * SCALE   # gap between "skin" and "care"
DOVE_SCALE  = 0.65          # dove height as fraction of text cap-height
DOVE_GAP_PX = 12 * SCALE    # pixels of breathing room between dove bottom and text top
TIGHT_PAD   = 18 * SCALE    # padding after tight-crop


def build(serif_path=SERIF_ITALIC, sans_path=SANS_BOLD, dove_path=DOVE_PNG):
    font_skin = ImageFont.truetype(serif_path, FONT_SIZE)
    font_care = ImageFont.truetype(sans_path,  FONT_SIZE)

    # Measure text
    tmp = Image.new('RGBA', (1, 1))
    d   = ImageDraw.Draw(tmp)
    bb_skin = d.textbbox((0, 0), 'skin', font=font_skin)
    bb_care = d.textbbox((0, 0), 'care', font=font_care)

    skin_w = bb_skin[2] - bb_skin[0]
    care_w = bb_care[2] - bb_care[0]
    text_h = max(bb_skin[3] - bb_skin[1], bb_care[3] - bb_care[1])

    total_w = PADDING + skin_w + GAP + care_w + PADDING

    # ── Draw text ────────────────────────────────────────────────────────────
    img  = Image.new('RGBA', (total_w, CANVAS_H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Place text starting 38% down so dove has room above
    baseline_y = int(CANVAS_H * 0.38) - bb_care[1]
    skin_x     = PADDING - bb_skin[0]
    care_x     = PADDING + skin_w + GAP - bb_care[0]

    draw.text((skin_x, baseline_y), 'skin', fill=(0, 0, 0, 255), font=font_skin)
    draw.text((care_x, baseline_y), 'care', fill=(0, 0, 0, 255), font=font_care)

    # ── Dove ─────────────────────────────────────────────────────────────────
    dove_raw = Image.open(dove_path).convert('RGBA')
    arr = np.array(dove_raw)
    brightness = arr[:,:,0].astype(int) + arr[:,:,1].astype(int) + arr[:,:,2].astype(int)
    out = np.zeros_like(arr)
    out[brightness > 300] = [0, 0, 0, 255]   # white → black, black → transparent
    dove_clean   = Image.fromarray(out, 'RGBA')
    dove_cropped = dove_clean.crop(dove_clean.getbbox())

    # Scale
    dove_h = int(text_h * DOVE_SCALE)
    dw, dh = dove_cropped.size
    dove_w = int(dove_h * dw / dh)
    dove   = dove_cropped.resize((dove_w, dove_h), Image.LANCZOS)

    # Centre horizontally over the gap, sit above text
    gap_cx    = PADDING + skin_w + GAP // 2
    text_top  = baseline_y + bb_care[1]
    dove_x    = gap_cx - dove_w // 2
    dove_y    = text_top - dove_h - DOVE_GAP_PX

    img.paste(dove, (dove_x, dove_y), dove)

    # ── Tight crop + downsample ───────────────────────────────────────────────
    bbox = img.getbbox()
    img  = img.crop((
        max(0, bbox[0] - TIGHT_PAD),
        max(0, bbox[1] - TIGHT_PAD),
        min(img.width,  bbox[2] + TIGHT_PAD),
        min(img.height, bbox[3] + TIGHT_PAD),
    ))

    w1, h1 = img.width // SCALE, img.height // SCALE
    img_1x = img.resize((w1,    h1   ), Image.LANCZOS)
    img_2x = img.resize((w1*2,  h1*2 ), Image.LANCZOS)

    img_1x.save(OUT_1X)
    img_2x.save(OUT_2X)
    print(f'✓  {OUT_1X}  ({w1}×{h1})')
    print(f'✓  {OUT_2X}  ({w1*2}×{h1*2})')
    return img_1x


if __name__ == '__main__':
    build()
