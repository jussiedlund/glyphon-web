# Glyphon Web

A browser-based pixel font editor. Design bitmap glyphs on a pixel grid, manage a font library, and export to TTF, BDF, or JSON.

**Live:** [pixelfontmaker.com](https://pixelfontmaker.com)  
**Format:** HTML5 + vanilla JavaScript  
**Data format:** `.pfm.json` (shared with the native macOS/iPad app)

---

## What It Does

Glyphon Web lets you design bitmap (pixel) fonts directly in your browser. Fonts are stored as `.pfm.json` files — a portable, human-readable format that round-trips with the [native Glyphon app](https://github.com/jussiedlund/glyphon). When you're done, export to:

- **TTF** — install on any device
- **BDF** — bitmap standard for terminals and embedded systems
- **JSON** — round-trip with the native app or any other tool

---

## Architecture

Single-page application (index.html + style.css + modules in src/).

```
src/
├── main.js              # App initialization, UI event handlers
├── state.js             # Persistent editor state (tool, zoom, font, glyph)
├── data-model.js        # FontMeta, Glyph, FontProject, validation
│
├── canvas-editor.js     # Pixel grid canvas, drawing, guides
├── char-navigator.js    # Glyph selector grid, Unicode ranges
├── metrics-panel.js     # Font metadata form
├── preview.js           # Live text rendering canvas
│
├── export-ttf.js        # TTF builder (opentype.js compatible)
├── export-bdf.js        # BDF serializer
├── export-json.js       # JSON round-trip
├── storage.js           # Browser localStorage persistence
└── shortcuts.js         # Keyboard shortcuts (Cmd+Z, B, F, etc.)
```

---

## Data Model

Identical to the native app:

```javascript
FontMeta {
  glyphWidth: Int        // grid columns
  glyphHeight: Int       // grid rows
  originX: Int           // left-bearing width (default 2)
  advanceWidth: Int      // default advance
  baseline: Int          // baseline row index
  ascender: Int
  descender: Int
  capHeight: Int
  xHeight: Int
  unitsPerEm: Int        // TTF units (default 1000)
}

Glyph {
  codePoint: Int
  pixels: [0..255]       // flat row-major array
  advanceWidth: Int?     // nil = use font default
}

FontProject {
  meta: FontMeta
  glyphs: { "65": {...}, "66": {...}, ... }
}
```

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `⌘Z` / `Ctrl+Z` | Undo |
| `⌘⇧Z` / `Ctrl+⇧Z` | Redo |
| `⌘C` / `Ctrl+C` | Copy glyph pixels |
| `⌘V` / `Ctrl+V` | Paste glyph pixels |
| `B` | Draw tool |
| `F` | Flood fill tool |
| `G` | Toggle grid |
| `H` | Flip horizontal |
| `V` | Flip vertical |
| `+` / `-` | Zoom in / out |
| `0` | Reset zoom |
| `↑ ↓ ← →` | Shift pixels |
| `[` / `]` | Previous / next glyph |

---

## Development

```bash
# No build step required for development — open index.html in a browser

# For production, use the Python build script to minify and cache-bust:
python3 build.py
```

Built files go to `dist/`. Deployed to Vercel via `.vercelignore`.

---

## Round-tripping with Native App

Font files (`.pfm.json`) are identical across web and native. Open a file exported from the web app in the native editor, make changes, and export back — no conversion needed. The `originX` field defaults to `0` for backward compatibility with older saves.
