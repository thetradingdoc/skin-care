#!/usr/bin/env python3
"""
DEPRECATED for production — design archive PNG compositor (monorepo paths).

Production wordmark: DoveIcon.jsx LogoWordmark + tulip-mark.svg.
Portable reference: unified-dashboard/assets/brand/scripts/build-logo-wordmark-portable.py
Documentation: docs/Brand/BRAND_IP_AND_LICENSES.md

Composites the Skin&Care logo wordmark:
  italic serif "skin" + dove icon (centred above gap) + bold sans "care"

Output (transparent PNG, black mark):
  logo-wordmark.png       (1x)
  logo-wordmark@2x.png    (2x)

Usage (from skin-care-landing/):
  python3 scripts/build-logo-wordmark.py

Requirements:
  pip install pillow numpy
"""

from __future__ import annotations

import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
LANDING_DIR = os.path.dirname(SCRIPT_DIR)
UD_ROOT = os.path.dirname(LANDING_DIR)
BRAND_DIR = os.path.join(UD_ROOT, "assets", "brand")
FONTS_DIR = os.path.join(BRAND_DIR, "fonts")

SERIF_ITALIC = os.path.join(FONTS_DIR, "CrimsonPro-Italic.ttf")
SANS_BOLD = os.path.join(FONTS_DIR, "BeVietnamPro-Bold.ttf")
DOVE_PNG = os.path.join(BRAND_DIR, "dove-mark.png")

OUT_DIRS = [
    os.path.join(UD_ROOT, "assets", "images"),
    os.path.join(LANDING_DIR, "public", "assets", "images"),
]

SCALE = 4
FONT_SIZE = 260 * SCALE
CANVAS_H = 360 * SCALE
PADDING = 60 * SCALE
GAP = 80 * SCALE
DOVE_SCALE = 0.65
DOVE_GAP_PX = 12 * SCALE
TIGHT_PAD = 18 * SCALE


def text_bbox(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont) -> tuple[int, int, int, int]:
    return draw.textbbox((0, 0), text, font=font)


def x_height(draw: ImageDraw.ImageDraw, font: ImageFont.FreeTypeFont) -> int:
    bb = text_bbox(draw, "x", font)
    return bb[3] - bb[1]


def care_font_for_xheight(
    draw: ImageDraw.ImageDraw,
    sans_path: str,
    target_xheight: int,
    base_size: int,
) -> ImageFont.FreeTypeFont:
    care_size = base_size
    for _ in range(24):
        font_care = ImageFont.truetype(sans_path, care_size)
        care_h = x_height(draw, font_care)
        if abs(care_h - target_xheight) <= 2 * SCALE:
            return font_care
        if care_h == 0:
            break
        care_size = max(1, int(care_size * target_xheight / care_h))
    return ImageFont.truetype(sans_path, care_size)


def build(
    serif_path: str = SERIF_ITALIC,
    sans_path: str = SANS_BOLD,
    dove_path: str = DOVE_PNG,
) -> Image.Image:
    for path, label in (
        (serif_path, "serif italic font"),
        (sans_path, "sans bold font"),
        (dove_path, "dove PNG"),
    ):
        if not os.path.isfile(path):
            raise FileNotFoundError(f"Missing {label}: {path}")

    tmp = Image.new("RGBA", (1, 1))
    measure = ImageDraw.Draw(tmp)

    font_skin = ImageFont.truetype(serif_path, FONT_SIZE)
    skin_xheight = x_height(measure, font_skin)
    font_care = care_font_for_xheight(measure, sans_path, skin_xheight, FONT_SIZE)

    bb_skin = text_bbox(measure, "skin", font_skin)
    bb_care = text_bbox(measure, "care", font_care)

    skin_w = bb_skin[2] - bb_skin[0]
    care_w = bb_care[2] - bb_care[0]
    text_h = max(bb_skin[3] - bb_skin[1], bb_care[3] - bb_care[1])

    total_w = PADDING + skin_w + GAP + care_w + PADDING

    img = Image.new("RGBA", (total_w, CANVAS_H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    baseline_y = int(CANVAS_H * 0.38) - bb_care[1]
    skin_x = PADDING - bb_skin[0]
    care_x = PADDING + skin_w + GAP - bb_care[0]

    draw.text((skin_x, baseline_y), "skin", fill=(0, 0, 0, 255), font=font_skin)
    draw.text((care_x, baseline_y), "care", fill=(0, 0, 0, 255), font=font_care)

    dove_raw = Image.open(dove_path).convert("RGBA")
    arr = np.array(dove_raw)
    brightness = arr[:, :, 0].astype(int) + arr[:, :, 1].astype(int) + arr[:, :, 2].astype(int)
    out = np.zeros_like(arr)
    out[brightness > 300] = [0, 0, 0, 255]
    dove_clean = Image.fromarray(out, "RGBA")
    dove_cropped = dove_clean.crop(dove_clean.getbbox())

    dove_h = int(text_h * DOVE_SCALE)
    dw, dh = dove_cropped.size
    dove_w = int(dove_h * dw / dh)
    dove = dove_cropped.resize((dove_w, dove_h), Image.LANCZOS)

    gap_cx = PADDING + skin_w + GAP // 2
    text_top = baseline_y + min(bb_skin[1], bb_care[1])
    dove_x = gap_cx - dove_w // 2
    dove_y = text_top - dove_h - DOVE_GAP_PX

    img.paste(dove, (dove_x, dove_y), dove)

    bbox = img.getbbox()
    if not bbox:
        raise RuntimeError("Logo composite produced an empty image")

    img = img.crop(
        (
            max(0, bbox[0] - TIGHT_PAD),
            max(0, bbox[1] - TIGHT_PAD),
            min(img.width, bbox[2] + TIGHT_PAD),
            min(img.height, bbox[3] + TIGHT_PAD),
        )
    )

    w1, h1 = img.width // SCALE, img.height // SCALE
    img_1x = img.resize((w1, h1), Image.LANCZOS)
    img_2x = img.resize((w1 * 2, h1 * 2), Image.LANCZOS)

    for out_dir in OUT_DIRS:
        os.makedirs(out_dir, exist_ok=True)
        img_1x.save(os.path.join(out_dir, "logo-wordmark.png"), optimize=True)
        img_2x.save(os.path.join(out_dir, "logo-wordmark@2x.png"), optimize=True)

    print(f"skin x-height: {skin_xheight // SCALE}px @1x")
    print(f"care font size: {font_care.size // SCALE}pt (skin: {FONT_SIZE // SCALE}pt)")
    print(f"1x: {w1}x{h1} -> {OUT_DIRS[0]}/logo-wordmark.png")
    print(f"2x: {w1 * 2}x{h1 * 2} -> logo-wordmark@2x.png")

    return img_1x


if __name__ == "__main__":
    try:
        build()
    except Exception as exc:
        print(f"error: {exc}", file=sys.stderr)
        sys.exit(1)
