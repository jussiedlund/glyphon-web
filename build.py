#!/usr/bin/env python3
"""
build.py — bundles all JS and CSS into a single self-contained HTML file.
Output: dist/pixelfontmaker.html

Usage:
    python3 build.py
"""

import base64
import mimetypes
import os
import re
import sys

BASE = os.path.dirname(os.path.abspath(__file__))
SRC  = os.path.join(BASE, 'index.html')
DIST = os.path.join(BASE, 'dist', 'pixelfontmaker.html')

def read(path):
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()

def inline_scripts(html, base_dir):
    """Replace <script src="..."> tags with inline <script> blocks."""
    def replacer(m):
        src = m.group(1).split('?')[0]  # strip cache-busting query params
        path = os.path.join(base_dir, src.replace('/', os.sep))
        if not os.path.exists(path):
            print(f'  WARNING: {src} not found, skipping', file=sys.stderr)
            return m.group(0)
        content = read(path)
        print(f'  + {src} ({len(content):,} chars)')
        return f'<script>\n{content}\n</script>'
    return re.sub(r'<script\s+src="([^"]+)"[^>]*>', replacer, html)

def inline_images(html, base_dir):
    """Replace <img src="..."> local paths with inline base64 data URIs."""
    def replacer(m):
        src = m.group(1)
        if src.startswith('http') or src.startswith('data:'):
            return m.group(0)
        path = os.path.join(base_dir, src.replace('/', os.sep))
        if not os.path.exists(path):
            print(f'  WARNING: {src} not found, skipping', file=sys.stderr)
            return m.group(0)
        mime = mimetypes.guess_type(path)[0] or 'image/png'
        with open(path, 'rb') as f:
            data = base64.b64encode(f.read()).decode()
        print(f'  + {src} ({len(data):,} chars base64)')
        return m.group(0).replace(src, f'data:{mime};base64,{data}')
    return re.sub(r'<img\b[^>]*\bsrc="([^"]+)"', replacer, html)

def inline_styles(html, base_dir):
    """Replace <link rel="stylesheet" href="..."> tags with inline <style> blocks."""
    def replacer(m):
        href = m.group(1).split('?')[0]  # strip cache-busting query params
        path = os.path.join(base_dir, href.replace('/', os.sep))
        if not os.path.exists(path):
            print(f'  WARNING: {href} not found, skipping', file=sys.stderr)
            return m.group(0)
        content = read(path)
        print(f'  + {href} ({len(content):,} chars)')
        return f'<style>\n{content}\n</style>'
    return re.sub(r'<link\s+rel="stylesheet"\s+href="([^"]+)"[^>]*/?\s*>', replacer, html)

def main():
    print(f'Building {DIST}...')
    os.makedirs(os.path.dirname(DIST), exist_ok=True)

    html = read(SRC)
    html = inline_styles(html, BASE)
    html = inline_images(html, BASE)
    html = inline_scripts(html, BASE)

    with open(DIST, 'w', encoding='utf-8') as f:
        f.write(html)

    size_kb = os.path.getsize(DIST) / 1024
    print(f'\nDone! {DIST}')
    print(f'Size: {size_kb:.1f} KB')

if __name__ == '__main__':
    main()
