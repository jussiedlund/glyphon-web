# Font Import Instructions - Step by Step

This document walks you through importing real open-source bitmap fonts into Glyphon.

## Prerequisites Checklist

- [ ] Python 3.6 or later installed
- [ ] Access to `/Users/jussi/Dropbox/_Transfer/Software/Glyphon/web/`
- [ ] Network access or ability to download files manually
- [ ] The three BDF files: `cozette.bdf`, `spleen.bdf`, `terminus.bdf`

## Complete Workflow

### Step 1: Obtain BDF Files

**Method A: Automatic Download (if you have network access)**

```bash
cd /Users/jussi/Dropbox/_Transfer/Software/Glyphon/web
python3 assets/fonts-source/fetch-and-convert.py
```

This downloads all three fonts and converts them automatically. Jump to Step 3.

**Method B: Manual Download**

Download these files and save to `assets/fonts-source/`:

1. **Cozette** (6×8 grid, ~95 glyphs)
   - URL: `https://raw.githubusercontent.com/the-moonwitch/Cozette/main/bdf/CozetteVector.bdf`
   - Save as: `assets/fonts-source/cozette.bdf`

2. **Spleen 6×12** (6×12 grid, ~95 glyphs)
   - URL: `https://raw.githubusercontent.com/fcambus/spleen/master/bdf/spleen-6x12.bdf`
   - Save as: `assets/fonts-source/spleen.bdf`

3. **Terminus 8×16** (8×16 grid, ~190 glyphs)
   - URL: `https://raw.githubusercontent.com/Tecate/bitmap-fonts/master/bitmap/terminus-font-4.49/TerminusTTF-Regular-4.49.bdf`
   - Save as: `assets/fonts-source/terminus.bdf`

### Step 2: Convert BDF Files to JSON

From the `web/` directory, run these commands:

```bash
cd /Users/jussi/Dropbox/_Transfer/Software/Glyphon/web

# Convert Cozette (6×8)
python3 assets/fonts-source/bdf-to-json.py assets/fonts-source/cozette.bdf \
  src/cozette-font.json "Cozette"

# Convert Spleen (6×12)
python3 assets/fonts-source/bdf-to-json.py assets/fonts-source/spleen.bdf \
  src/spleen-font.json "Spleen 6×12"

# Convert Terminus (8×16)
python3 assets/fonts-source/bdf-to-json.py assets/fonts-source/terminus.bdf \
  src/terminus-font.json "Terminus 8×16"
```

**Expected Output:**
```
Parsing assets/fonts-source/cozette.bdf...
Found 95 glyphs, bbox: (6, 8)
Wrote src/cozette-font.json
  95 glyphs
  Grid: 6×8
```

Now you should have three new JSON files in `src/`:
- `src/cozette-font.json`
- `src/spleen-font.json`
- `src/terminus-font.json`

### Step 3: Update bundled-fonts.js

Open `src/bundled-fonts.js` and replace the entire file with:

```javascript
/* global PFM */

// Bundled open-source bitmap fonts with complete character sets.
// See FONTS.md for attribution and licenses.

import cozetteFontData from './cozette-font.json' assert { type: 'json' };
import spleenFontData from './spleen-font.json' assert { type: 'json' };
import terminusFontData from './terminus-font.json' assert { type: 'json' };

PFM.bundledFonts = [
  {
    ...cozetteFontData,
    name: 'Cozette',
    credit: 'the-moonwitch · github.com/the-moonwitch/Cozette',
    license: 'SIL OFL',
  },
  {
    ...spleenFontData,
    name: 'Spleen 6×12',
    credit: 'Frederic Cambus · github.com/fcambus/spleen',
    license: 'BSD 2-Clause',
  },
  {
    ...terminusFontData,
    name: 'Terminus 8×16',
    credit: 'Dimitar Zhekov · terminus-font.sourceforge.net',
    license: 'SIL OFL',
  },
];
```

### Step 4: Test in the Web App

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Open `http://localhost:3000` in your browser

3. Click the "Library" button to see the new fonts

4. Verify:
   - All three fonts appear in "Open Source" section
   - Font cards display proper thumbnails
   - "Load" button works and loads each font for editing
   - Attribution is visible on each card

### Step 5: Commit and Push

```bash
cd /Users/jussi/Dropbox/_Transfer/Software/Glyphon/web

git add assets/fonts-source/cozette.bdf src/cozette-font.json
git add assets/fonts-source/spleen.bdf src/spleen-font.json
git add assets/fonts-source/terminus.bdf src/terminus-font.json
git add src/bundled-fonts.js

git commit -m "feat: import real open-source bitmap fonts

- Import Cozette (6×8), Spleen 6×12 (6×12), Terminus 8×16 (8×16)
- Replace hand-crafted sample glyphs with complete authentic fonts
- Update bundled-fonts.js to use JSON imports
- All fonts include proper attribution and licensing info"

git push origin main
```

## Troubleshooting

**"ModuleNotFoundError: No module named 'json'"**
- Python built-in `json` module not available (rare). Try Python 3.8+

**"Error: Could not find FONTBOUNDINGBOX in BDF"**
- BDF file is corrupted or not a valid BDF 2.1 file
- Re-download the file from the source repository

**"Import assertion failed" in browser**
- Make sure the JSON files are in `src/` directory (not elsewhere)
- Check JSON syntax with `python3 -m json.tool src/cozette-font.json`

**Glyphs show as blank in library**
- Reload the page (Ctrl+R or Cmd+R)
- Check browser console for JavaScript errors
- Verify font grid size matches in JSON meta vs display code

**Download keeps failing**
- If network is blocked on your machine, try:
  - Using a different device with internet access
  - Downloading via GitHub web UI and copying files
  - Using a VPN or different network connection
  - Asking a colleague with network access to download for you

## What Gets Imported

Each font includes:
- **Cozette**: ~95 printable ASCII glyphs in a tight 6×8 grid
- **Spleen**: ~95 printable ASCII glyphs in a clean 6×12 grid
- **Terminus**: ~200 glyphs with extended Latin and symbols in 8×16 grid

The JSON conversion preserves:
- Exact pixel bitmaps from the BDF files
- Font metrics (baseline, ascender, descender, cap height)
- Grid dimensions (width × height)
- All printable ASCII characters (codes 32-126)

## Files Changed

- `src/bundled-fonts.js` — Now imports JSON files instead of inline data
- `src/cozette-font.json` — New (generated from BDF)
- `src/spleen-font.json` — New (generated from BDF)
- `src/terminus-font.json` — New (generated from BDF)
- `assets/fonts-source/cozette.bdf` — New (downloaded)
- `assets/fonts-source/spleen.bdf` — New (downloaded)
- `assets/fonts-source/terminus.bdf` — New (downloaded)

## Next Steps

Once fonts are imported and tested:
1. Update FONTS.md with actual font sizes and glyph counts from JSON
2. Consider adding more open-source fonts from the community
3. Add a web UI for BDF import directly in the app (future feature)
