# Importing Real Open-Source Bitmap Fonts

The bundled fonts include sample glyphs inspired by Cozette, Spleen, and Terminus. To import the **complete, authentic fonts**, download the BDF source files and convert them using the included parser.

## Automated Import (Requires Network)

If you have network access, run this script to fetch and convert all three fonts:

```bash
cd /Users/jussi/Dropbox/_Transfer/Software/Glyphon/web/
python3 assets/fonts-source/fetch-and-convert.py
```

This script:
1. Downloads Cozette, Spleen 6×12, and Terminus 8×16 from GitHub
2. Converts each to JSON format
3. Places them in `src/` directory for import

## Manual Import (Recommended if Automated Fails)

If the automated script fails or network is blocked, download manually and convert:

### Step 1: Download BDF Files

Choose one of these methods:

**Option A: Direct GitHub Links**
```bash
# From /Users/jussi/Dropbox/_Transfer/Software/Glyphon/web/
mkdir -p assets/fonts-source

curl -o assets/fonts-source/cozette.bdf \
  "https://raw.githubusercontent.com/the-moonwitch/Cozette/main/bdf/CozetteVector.bdf"

curl -o assets/fonts-source/spleen.bdf \
  "https://raw.githubusercontent.com/fcambus/spleen/master/bdf/spleen-6x12.bdf"

curl -o assets/fonts-source/terminus.bdf \
  "https://raw.githubusercontent.com/Tecate/bitmap-fonts/master/bitmap/terminus-font-4.49/TerminusTTF-Regular-4.49.bdf"
```

**Option B: Download via GitHub Web UI** (if scripts fail)
1. Visit each repository and download the .bdf file manually
2. Place in `assets/fonts-source/` directory

### Step 2: Convert BDF to JSON

```bash
# From /Users/jussi/Dropbox/_Transfer/Software/Glyphon/web/
python3 assets/fonts-source/bdf-to-json.py assets/fonts-source/cozette.bdf \
  src/cozette-font.json "Cozette"

python3 assets/fonts-source/bdf-to-json.py assets/fonts-source/spleen.bdf \
  src/spleen-font.json "Spleen 6×12"

python3 assets/fonts-source/bdf-to-json.py assets/fonts-source/terminus.bdf \
  src/terminus-font.json "Terminus 8×16"
```

## Alternative Sources (If GitHub is Blocked)

If GitHub links don't work on your network, try these alternatives:

### Cozette
- **GitHub Repository:** https://github.com/the-moonwitch/Cozette
- **Releases:** https://github.com/the-moonwitch/Cozette/releases
- **Direct File:** `bdf/CozetteVector.bdf` in the repository
- Look for the latest release and download the BDF file

### Spleen
- **GitHub Repository:** https://github.com/fcambus/spleen
- **Releases:** https://github.com/fcambus/spleen/releases
- **File Path:** `bdf/spleen-6x12.bdf`
- Available in source downloads or releases

### Terminus
- **Official Site:** https://terminus-font.sourceforge.net/
- **SourceForge Page:** https://sourceforge.net/projects/terminus-font/
- **GitHub Mirror:** https://github.com/Tecate/bitmap-fonts (may have limited access)
- **Download:** BDF source packages available from both sites
- **File:** `TerminusTTF-Regular-4.49.bdf` or similar version

**Tips:**
- If you have network access on another machine, download there and copy via Dropbox
- Releases pages often have pre-packaged archives with BDF files
- The files are text files, so you can copy/paste the content if downloading fails

## Integrating Converted Fonts

Once you have JSON files from the conversion:

1. Move them to `src/` directory
2. Update `src/bundled-fonts.js` to import from the JSON files instead of hardcoded data:

```javascript
// Add at the top of bundled-fonts.js
import cozetteFontData from './cozette-font.json' assert { type: 'json' };
import spleenFontData from './spleen-font.json' assert { type: 'json' };
import terminusFontData from './terminus-font.json' assert { type: 'json' };

// Then reference in the fonts array:
PFM.bundledFonts = [
  { ...cozetteFontData, credit: 'the-moonwitch · github.com/the-moonwitch/Cozette', license: 'SIL OFL' },
  { ...spleenFontData, credit: 'Frederic Cambus · github.com/fcambus/spleen', license: 'BSD 2-Clause' },
  { ...terminusFontData, credit: 'Dimitar Zhekov · terminus-font.sourceforge.net', license: 'SIL OFL' },
];
```

## Troubleshooting

**"BDF parser not found"**: Make sure `assets/fonts-source/bdf-to-json.py` exists.

**"FONTBOUNDINGBOX not found"**: Some BDF variants use different headers. Check the file format is standard BDF 2.1.

**"Out of memory"**: Large BDF files (1000+ glyphs) can be slow. Process one at a time.

## Future: Automated Import

In the future, we could add a web UI to import BDF files directly in Glyphon, making this process seamless.
