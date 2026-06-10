#!/usr/bin/env python3
"""
build-email-wordmark.py — solid black consumer wordmark for transactional email.

Mirrors logo-wordmark.css layout (landing SSOT) at LOGO_HEIGHT px, then exports
email-wordmark.png (1x) and email-wordmark@2x.png (2x).

Usage (repo root):
  npm run brand:email-wordmark
  python3 unified-dashboard/assets/brand/scripts/build-email-wordmark.py

See docs/Brand/WORDMARK_BY_SURFACE.md
"""

from __future__ import annotations

import os
import sys

from PIL import Image, ImageDraw, ImageFont

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BRAND_DIR = os.path.dirname(SCRIPT_DIR)
FONTS_DIR = os.path.join(BRAND_DIR, "fonts")

SKIN_FONT = os.path.join(FONTS_DIR, "BeVietnamPro-BoldItalic.ttf")
CARE_FONT = os.path.join(FONTS_DIR, "BeVietnamPro-Bold.ttf")
TULIP_SVG = os.path.join(BRAND_DIR, "tulip-mark.svg")
TULIP_PNG = os.path.join(BRAND_DIR, "tulip-mark.png")

OUT_1X = os.path.join(BRAND_DIR, "email-wordmark.png")
OUT_2X = os.path.join(BRAND_DIR, "email-wordmark@2x.png")

# Landing header height — matches LogoWordmark height={52}
LOGO_HEIGHT = 52
RENDER_SCALE = 8
# Email layout displays logo at this width (skin-care-email-layout.js)
EMAIL_DISPLAY_WIDTH = 240
# CSS: font-size = calc(var(--logo-height) * 0.58)
FONT_SIZE_RATIO = 0.58
GAP_EM = 0.03
SKIN_MR_EM = -0.02
CARE_ML_EM = -0.02
SLOT_WIDTH_EM = 0.62
SLOT_LIFT_EM = 0.48
MARK_WIDTH_EM = 0.9
MARK_BOTTOM_EM = 0.02
TULIP_ASPECT = 215 / 600
TIGHT_PAD = 4


def text_bbox(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont) -> tuple[int, int, int, int]:
    return draw.textbbox((0, 0), text, font=font)


def render_tulip_rgba(width: int, height: int) -> Image.Image:
    """Prefer SVG rasterization; fall back to cropped tulip-mark.png."""
    try:
        import cairosvg
        from io import BytesIO

        png_bytes = cairosvg.svg2png(
            url=TULIP_SVG,
            output_width=width,
            output_height=height,
        )
        return Image.open(BytesIO(png_bytes)).convert("RGBA")
    except Exception:
        if not os.path.isfile(TULIP_PNG):
            raise RuntimeError(
                "Install cairosvg (with libcairo) or provide tulip-mark.png beside tulip-mark.svg"
            )
        raw = Image.open(TULIP_PNG).convert("RGBA")
        bbox = raw.getbbox()
        if not bbox:
            raise RuntimeError("tulip-mark.png is empty")
        cropped = raw.crop(bbox)
        return cropped.resize((max(1, width), max(1, height)), Image.LANCZOS)


def build() -> Image.Image:
    for path, label in (
        (SKIN_FONT, "Be Vietnam Pro Bold Italic"),
        (CARE_FONT, "Be Vietnam Pro Bold"),
        (TULIP_SVG, "tulip-mark.svg"),
        (TULIP_PNG, "tulip-mark.png"),
    ):
        if not os.path.isfile(path):
            raise FileNotFoundError(f"Missing {label}: {path}")

    scale = RENDER_SCALE
    logo_h = LOGO_HEIGHT * scale
    em = logo_h * FONT_SIZE_RATIO
    font_size = int(round(em))

    tmp = Image.new("RGBA", (1, 1))
    measure = ImageDraw.Draw(tmp)
    font_skin = ImageFont.truetype(SKIN_FONT, font_size)
    font_care = ImageFont.truetype(CARE_FONT, font_size)

    bb_skin = text_bbox(measure, "skin", font_skin)
    bb_care = text_bbox(measure, "care", font_care)
    skin_w = bb_skin[2] - bb_skin[0]
    care_w = bb_care[2] - bb_care[0]
    text_h = max(bb_skin[3] - bb_skin[1], bb_care[3] - bb_care[1])

    gap_px = int(round(em * GAP_EM))
    skin_mr = int(round(em * SKIN_MR_EM))
    care_ml = int(round(em * CARE_ML_EM))
    slot_w = int(round(em * SLOT_WIDTH_EM))
    mark_w = int(round(em * MARK_WIDTH_EM))
    mark_h = max(1, int(round(mark_w * TULIP_ASPECT)))

    total_w = skin_w + skin_mr + gap_px + slot_w + gap_px + care_w + care_ml + scale * 8
    lift_px = int(round(em * SLOT_LIFT_EM))
    canvas_h = text_h + lift_px + mark_h + scale * 8

    img = Image.new("RGBA", (total_w, canvas_h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    baseline_y = canvas_h - int(scale * 4) - bb_skin[3]
    x = int(scale * 2)

    draw.text((x - bb_skin[0], baseline_y - bb_skin[1]), "skin", fill=(0, 0, 0, 255), font=font_skin)
    x += skin_w + skin_mr + gap_px

    slot_x = x
    slot_top = baseline_y + bb_skin[1] - lift_px
    tulip = render_tulip_rgba(mark_w, mark_h)
    tulip_x = slot_x + (slot_w - mark_w) // 2
    tulip_y = slot_top + int(round(em * MARK_BOTTOM_EM)) + max(0, int(em) - mark_h)
    img.paste(tulip, (tulip_x, tulip_y), tulip)

    x += slot_w + gap_px
    draw.text((x + care_ml - bb_care[0], baseline_y - bb_care[1]), "care", fill=(0, 0, 0, 255), font=font_care)

    bbox = img.getbbox()
    if not bbox:
        raise RuntimeError("Email wordmark composite produced an empty image")

    img = img.crop(
        (
            max(0, bbox[0] - TIGHT_PAD),
            max(0, bbox[1] - TIGHT_PAD),
            min(img.width, bbox[2] + TIGHT_PAD),
            min(img.height, bbox[3] + TIGHT_PAD),
        )
    )

    w1 = max(1, img.width // scale)
    h1 = max(1, img.height // scale)
    img_natural = img.resize((w1, h1), Image.LANCZOS)
    header_w = max(1, int(round(w1 * LOGO_HEIGHT / h1)))
    img_header = img_natural.resize((header_w, LOGO_HEIGHT), Image.LANCZOS)
    img_1x = img_header.resize((EMAIL_DISPLAY_WIDTH, LOGO_HEIGHT), Image.LANCZOS)
    img_2x = img_1x.resize((EMAIL_DISPLAY_WIDTH * 2, LOGO_HEIGHT * 2), Image.LANCZOS)

    img_1x.save(OUT_1X, optimize=True)
    img_2x.save(OUT_2X, optimize=True)

    print(f"1x: {img_1x.width}x{img_1x.height} -> {OUT_1X}")
    print(f"2x: {img_2x.width}x{img_2x.height} -> {OUT_2X}")
    return img_1x


if __name__ == "__main__":
    try:
        build()
    except Exception as exc:
        print(f"error: {exc}", file=sys.stderr)
        sys.exit(1)
