#!/usr/bin/env python3
"""
Parse BDF bitmap font files and extract printable ASCII to JSON format
compatible with Glyphon's pfm.json structure.

BDF spec notes:
- FONTBOUNDINGBOX defines the global canvas (width, height, xoff, yoff)
- Each glyph has BBX (bw, bh, x_off, y_off) — its own bitmap dimensions + placement
- Bitmap rows are stored MSB-first, padded to 8-bit boundaries
- y increases upward in BDF; we convert to screen coords (y increases downward)
"""

import json
import math
import sys


def parse_bdf(filename):
    """Parse BDF file and extract glyph bitmap data with per-glyph BBX."""
    with open(filename, 'r', encoding='utf-8', errors='ignore') as f:
        lines = f.readlines()

    font_bbox = None   # (fw, fh, fx_off, fy_off)
    glyphs = {}

    code_point = None
    char_width = char_height = char_x_off = char_y_off = None
    in_bitmap = False
    bitmap_rows = []

    for line in lines:
        line = line.rstrip('\r\n')

        if line.startswith('FONTBOUNDINGBOX'):
            parts = line.split()
            if len(parts) >= 5:
                font_bbox = (int(parts[1]), int(parts[2]), int(parts[3]), int(parts[4]))

        elif line.startswith('ENCODING'):
            code_point = int(line.split()[1])

        elif line.startswith('BBX'):
            parts = line.split()
            char_width  = int(parts[1])
            char_height = int(parts[2])
            char_x_off  = int(parts[3])
            char_y_off  = int(parts[4])

        elif line.startswith('BITMAP'):
            in_bitmap = True
            bitmap_rows = []

        elif line.startswith('ENDCHAR'):
            if in_bitmap and code_point is not None and 32 <= code_point <= 126:
                glyphs[code_point] = {
                    'bitmap': bitmap_rows.copy(),
                    'bbx': (char_width, char_height, char_x_off, char_y_off),
                }
            in_bitmap = False
            bitmap_rows = []
            code_point = char_width = char_height = char_x_off = char_y_off = None

        elif in_bitmap and line and not line.startswith('COMMENT'):
            try:
                bitmap_rows.append(int(line, 16))
            except ValueError:
                pass

    return font_bbox, glyphs


def glyphs_to_pfm(font_name, font_bbox, glyphs):
    """Convert parsed glyphs to pfm.json format, respecting per-glyph BBX placement."""
    if not font_bbox:
        return None

    fw, fh, fx_off, fy_off = font_bbox

    pfm_glyphs = {}
    for code_point, glyph_data in glyphs.items():
        bitmap = glyph_data['bitmap']
        bw, bh, bx_off, by_off = glyph_data['bbx']

        # Pixels in FONTBOUNDINGBOX canvas (screen coords: row 0 = top)
        pixels = [0] * (fw * fh)

        # Bytes and bits per bitmap row (BDF pads to 8-bit boundaries)
        bytes_per_row = math.ceil(bw / 8)
        bits_per_row  = bytes_per_row * 8

        # Canvas column where the glyph's left edge starts
        canvas_col_start = bx_off - fx_off

        for b, row_val in enumerate(bitmap):
            if b >= bh:
                break
            # Convert BDF y (up) to canvas row (down)
            # BDF y of this row = by_off + (bh - 1 - b)
            # Canvas row = (fh - 1) - (bdf_y - fy_off) = fh - 1 - bdf_y + fy_off
            bdf_y      = by_off + (bh - 1 - b)
            canvas_row = (fh - 1) - bdf_y + fy_off

            if canvas_row < 0 or canvas_row >= fh:
                continue

            for c in range(bw):
                # BDF bitmap is MSB-first; bit 0 of the row is the leftmost pixel
                pixel = (row_val >> (bits_per_row - 1 - c)) & 1
                canvas_col = canvas_col_start + c
                if 0 <= canvas_col < fw:
                    pixels[canvas_row * fw + canvas_col] = pixel

        pfm_glyphs[str(code_point)] = {
            'codePoint': code_point,
            'pixels': pixels,
            'advanceWidth': None,
        }

    # Baseline = canvas row of the BDF baseline (y=0 in glyph coords)
    # baseline_row = (fh - 1) - (0 - fy_off) = fh - 1 + fy_off
    baseline_row = fh - 1 + fy_off

    return {
        'meta': {
            'name':        font_name,
            'glyphWidth':  fw,
            'glyphHeight': fh,
            'originX':     -fx_off,   # canvas column of the origin (x=0)
            'advanceWidth': fw + 1,
            'baseline':    baseline_row,
            'ascender':    0,
            'descender':   fh - 1,
            'capHeight':   fh // 2,
            'xHeight':     fh // 2,
            'unitsPerEm':  fh * 100,
        },
        'glyphs': pfm_glyphs,
    }


def main():
    if len(sys.argv) < 3:
        print('Usage: bdf-to-json.py <input.bdf> <output.json> [font_name]')
        sys.exit(1)

    bdf_file  = sys.argv[1]
    json_file = sys.argv[2]
    font_name = sys.argv[3] if len(sys.argv) > 3 else 'Font'

    print(f'Parsing {bdf_file}...')
    font_bbox, glyphs = parse_bdf(bdf_file)

    if not font_bbox:
        print('Error: FONTBOUNDINGBOX not found')
        sys.exit(1)

    fw, fh, fx_off, fy_off = font_bbox
    print(f'Found {len(glyphs)} glyphs, canvas: {fw}×{fh} (offset {fx_off},{fy_off})')

    pfm = glyphs_to_pfm(font_name, font_bbox, glyphs)

    with open(json_file, 'w') as f:
        json.dump(pfm, f, indent=2)

    print(f'Wrote {json_file}')
    print(f'  Grid: {fw}×{fh}, baseline row: {pfm["meta"]["baseline"]}')


if __name__ == '__main__':
    main()
