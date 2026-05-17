#!/usr/bin/env python3
"""
Download BDF fonts from GitHub and convert to Glyphon JSON format.
"""

import json
import re
import urllib.request
import urllib.error
import sys

FONTS = [
    {
        'url': 'https://raw.githubusercontent.com/the-moonwitch/Cozette/main/bdf/CozetteVector.bdf',
        'name': 'Cozette',
        'output': '../../../src/cozette-font.json',
    },
    {
        'url': 'https://raw.githubusercontent.com/fcambus/spleen/master/bdf/spleen-6x12.bdf',
        'name': 'Spleen 6×12',
        'output': '../../../src/spleen-font.json',
    },
    {
        'url': 'https://raw.githubusercontent.com/Tecate/bitmap-fonts/master/bitmap/terminus-font-4.49/TerminusTTF-Regular-4.49.bdf',
        'name': 'Terminus 8×16',
        'output': '../../../src/terminus-font.json',
    },
]

def download_bdf(url):
    """Download BDF file from URL."""
    print(f'Downloading {url}...', file=sys.stderr)
    try:
        with urllib.request.urlopen(url, timeout=10) as response:
            content = response.read().decode('utf-8', errors='ignore')
            return content
    except urllib.error.URLError as e:
        print(f'Error downloading: {e}', file=sys.stderr)
        return None

def parse_bdf(content):
    """Parse BDF file content and extract glyph bitmap data."""
    lines = content.split('\n')

    font_bbox = None
    glyphs = {}
    current_glyph = None
    code_point = None
    in_bitmap = False
    bitmap_rows = []

    for line in lines:
        line = line.rstrip('\n')

        # Get font bounding box
        if line.startswith('FONTBOUNDINGBOX'):
            parts = line.split()
            if len(parts) >= 5:
                width = int(parts[1])
                height = int(parts[2])
                font_bbox = (width, height)

        # Get encoding (Unicode code point)
        if line.startswith('ENCODING'):
            code_point = int(line.split()[1])

        # Start bitmap data
        if line.startswith('BITMAP'):
            in_bitmap = True
            bitmap_rows = []
            continue

        # End of character
        if line.startswith('ENDCHAR'):
            if in_bitmap and code_point is not None and 32 <= code_point <= 126:
                glyphs[code_point] = bitmap_rows.copy()
            in_bitmap = False
            bitmap_rows = []
            code_point = None
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
            byte_val = rows[row_idx] if row_idx < len(rows) else 0
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
    for font_info in FONTS:
        url = font_info['url']
        name = font_info['name']
        output = font_info['output']

        print(f'\n--- {name} ---')

        # Download
        content = download_bdf(url)
        if not content:
            print(f'Failed to download {name} from {url}', file=sys.stderr)
            print(f'  → Download manually and save as .bdf, then run conversion script', file=sys.stderr)
            print(f'  → Or run: curl -o {name.lower().replace(" ", "-")}.bdf "{url}"', file=sys.stderr)
            continue

        # Parse
        font_bbox, glyphs = parse_bdf(content)
        if not font_bbox:
            print(f'Failed to parse {name}', file=sys.stderr)
            continue

        print(f'Parsed: {len(glyphs)} glyphs, bbox: {font_bbox}')

        # Convert
        pfm = glyphs_to_pfm(name, font_bbox, glyphs)
        if not pfm:
            print(f'Failed to convert {name}', file=sys.stderr)
            continue

        # Write
        output_path = output
        with open(output_path, 'w') as f:
            json.dump(pfm, f, indent=2)

        glyph_count = len(pfm['glyphs'])
        width = pfm['meta']['glyphWidth']
        height = pfm['meta']['glyphHeight']
        print(f'Wrote: {output_path}')
        print(f'  {glyph_count} glyphs, {width}×{height} grid')

if __name__ == '__main__':
    main()
