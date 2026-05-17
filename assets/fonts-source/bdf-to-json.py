#!/usr/bin/env python3
"""
Parse BDF bitmap font files and extract printable ASCII to JSON format
compatible with Glyphon's pfm.json structure.
"""

import json
import re
import sys

def parse_bdf(filename):
    """Parse BDF file and extract glyph bitmap data."""
    with open(filename, 'r', encoding='utf-8', errors='ignore') as f:
        lines = f.readlines()

    font_bbox = None
    glyphs = {}
    current_glyph = None
    in_bitmap = False
    bitmap_rows = []

    for i, line in enumerate(lines):
        line = line.rstrip('\n')

        # Get font bounding box
        if line.startswith('FONTBOUNDINGBOX'):
            parts = line.split()
            if len(parts) >= 5:
                width = int(parts[1])
                height = int(parts[2])
                font_bbox = (width, height)

        # Start of character definition
        if line.startswith('STARTCHAR'):
            char_name = line.split(maxsplit=1)[1] if len(line.split(maxsplit=1)) > 1 else ''

        # Get encoding (Unicode code point)
        if line.startswith('ENCODING'):
            code_point = int(line.split()[1])

        # Get character bounding box
        if line.startswith('BBX'):
            parts = line.split()
            char_width = int(parts[1])
            char_height = int(parts[2])

        # Start bitmap data
        if line.startswith('BITMAP'):
            in_bitmap = True
            bitmap_rows = []
            continue

        # End of character
        if line.startswith('ENDCHAR'):
            if in_bitmap and 32 <= code_point <= 126:  # Printable ASCII
                glyphs[code_point] = bitmap_rows.copy()
            in_bitmap = False
            bitmap_rows = []
            continue

        # Collect bitmap rows (hex values)
        if in_bitmap and line and not line.startswith('COMMENT'):
            try:
                bitmap_rows.append(int(line, 16))
            except ValueError:
                pass

    return font_bbox, glyphs

def glyphs_to_pfm(font_name, font_bbox, glyphs):
    """Convert parsed glyphs to pfm.json format."""
    if not font_bbox:
        return None

    width, height = font_bbox

    pfm_glyphs = {}
    for code_point, rows in glyphs.items():
        pixels = []
        for row_idx in range(height):
            if row_idx < len(rows):
                byte_val = rows[row_idx]
            else:
                byte_val = 0

            # Convert byte to individual pixel values
            for col in range(width):
                bit_set = (byte_val >> (width - 1 - col)) & 1
                pixels.append(bit_set)

        pfm_glyphs[str(code_point)] = {
            'codePoint': code_point,
            'pixels': pixels,
            'advanceWidth': None,
        }

    return {
        'meta': {
            'name': font_name,
            'glyphWidth': width,
            'glyphHeight': height,
            'originX': 0,
            'advanceWidth': width + 1,
            'baseline': height - 2,
            'ascender': 0,
            'descender': height - 1,
            'capHeight': height // 2,
            'xHeight': height // 2,
            'unitsPerEm': height * 100,
        },
        'glyphs': pfm_glyphs,
    }

def main():
    if len(sys.argv) < 3:
        print('Usage: bdf-to-json.py <input.bdf> <output.json> <font_name>')
        sys.exit(1)

    bdf_file = sys.argv[1]
    json_file = sys.argv[2]
    font_name = sys.argv[3] if len(sys.argv) > 3 else 'Font'

    print(f'Parsing {bdf_file}...')
    font_bbox, glyphs = parse_bdf(bdf_file)

    if not font_bbox:
        print('Error: Could not find FONTBOUNDINGBOX in BDF')
        sys.exit(1)

    print(f'Found {len(glyphs)} glyphs, bbox: {font_bbox}')

    pfm = glyphs_to_pfm(font_name, font_bbox, glyphs)

    with open(json_file, 'w') as f:
        json.dump(pfm, f, indent=2)

    print(f'Wrote {json_file}')
    glyph_count = len(pfm['glyphs'])
    print(f'  {glyph_count} glyphs')
    print(f'  Grid: {pfm["meta"]["glyphWidth"]}×{pfm["meta"]["glyphHeight"]}')

if __name__ == '__main__':
    main()
