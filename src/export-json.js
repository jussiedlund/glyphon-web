/* global PFM */

PFM.exportJSON = function() {
  const state = PFM.state.getState();
  const data = PFM.serializeProject(state);
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = (state.meta.name || 'font').replace(/[^a-zA-Z0-9_-]/g, '-') + '.pfm.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

PFM.importJSON = function(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.meta && data.glyphs) {
          resolve(PFM.deserializeProject(data));
        } else if (_isBFM2Format(data)) {
          resolve(_importBFM2(data));
        } else {
          reject(new Error('Unrecognised font file format'));
        }
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsText(file);
  });
};

function _isBFM2Format(data) {
  // BitFontMaker2 JSON has numeric string keys + string metadata, no "meta"/"glyphs" keys
  return !data.meta && !data.glyphs && typeof data.name === 'string' &&
    Object.keys(data).some(k => !isNaN(parseInt(k)));
}

function _importBFM2(data) {
  // Decode advance width from BFM2 letterspace: stored as a bitmask where
  // bit_length(value) = advance width (e.g. 64 = 0b1000000 → 7 columns)
  const lsRaw = parseInt(data.letterspace);
  const bfm2Advance = (lsRaw > 0) ? lsRaw.toString(2).length : 0;

  // Grid width = highest bit used across all glyph data
  let maxBit = 3; // minimum 4 columns
  for (const key of Object.keys(data)) {
    if (isNaN(parseInt(key))) continue;
    for (const val of data[key]) {
      if (val > 0) maxBit = Math.max(maxBit, Math.floor(Math.log2(val)));
    }
  }
  const gridWidth  = maxBit + 1;
  const advanceWidth = bfm2Advance || (gridWidth + 1);
  const gridHeight = 16; // BFM2 always stores 16 rows

  const ascMeta  = parseInt(data.ascender)  || 5;
  const descMeta = parseInt(data.descender) || 2;

  // Detect baseline by scanning actual pixel data.
  // Most non-descender glyphs share a common last-pixel row; baseline = that row + 1.
  const glyphKeys = Object.keys(data).filter(k => !isNaN(parseInt(k)));

  const lastPixelRows = [];
  for (const key of glyphKeys) {
    const rows = data[key];
    for (let r = rows.length - 1; r >= 0; r--) {
      if (rows[r] !== 0) { lastPixelRows.push(r); break; }
    }
  }
  lastPixelRows.sort((a, b) => a - b);
  const medianLast = lastPixelRows.length
    ? lastPixelRows[Math.floor(lastPixelRows.length / 2)]
    : 11;
  const baseline = medianLast + 1;

  // Ascender: top of the tallest uppercase letter (A-Z scan)
  const capFirstRows = [];
  for (let cp = 65; cp <= 90; cp++) {
    const rows = data[cp];
    if (!rows) continue;
    for (let r = 0; r < rows.length; r++) {
      if (rows[r] !== 0) { capFirstRows.push(r); break; }
    }
  }
  capFirstRows.sort((a, b) => a - b);
  const ascenderRow  = capFirstRows.length
    ? capFirstRows[0]
    : baseline - ascMeta;

  // x-height: top of short lowercase letters (excluding ascenders b,d,f,h,i,j,k,l,t)
  const skipAsc = new Set([98,100,102,104,105,106,107,108,116]);
  const xhFirstRows = [];
  for (let cp = 97; cp <= 122; cp++) {
    if (skipAsc.has(cp)) continue;
    const rows = data[cp];
    if (!rows) continue;
    for (let r = 0; r < rows.length; r++) {
      if (rows[r] !== 0) { xhFirstRows.push(r); break; }
    }
  }
  xhFirstRows.sort((a, b) => a - b);
  const xHeightRow = xhFirstRows.length
    ? xhFirstRows[Math.floor(xhFirstRows.length / 2)]
    : baseline - Math.round(ascMeta * 0.5);

  const capHeightRow  = capFirstRows.length
    ? capFirstRows[Math.floor(capFirstRows.length / 2)]
    : baseline - Math.round(ascMeta * 0.8);

  const descenderRow = baseline + descMeta - 1;

  const spaceWidth  = parseInt(data.wordspacing) > 1
    ? parseInt(data.wordspacing)
    : Math.max(2, Math.round(gridWidth * 0.55));

  const project = {
    meta: {
      name:         data.name    || 'Imported',
      author:       data.copy    || '',
      version:      '1.0',
      description:  '',
      glyphWidth:   gridWidth,
      glyphHeight:  gridHeight,
      originX:      2,
      baseline:     baseline,
      ascender:     ascenderRow,
      descender:    descenderRow,
      capHeight:    capHeightRow,
      xHeight:      xHeightRow,
      advanceWidth: advanceWidth,
      spaceWidth,
      unitsPerEm:   1000,
    },
    glyphs: {},
    activeCodePoint: 65,
  };

  for (const key of Object.keys(data)) {
    const cp = parseInt(key);
    if (isNaN(cp)) continue;

    const rows   = data[key];
    const pixels = new Uint8Array(gridWidth * gridHeight);

    for (let row = 0; row < Math.min(rows.length, gridHeight); row++) {
      const val = rows[row];
      for (let col = 0; col < gridWidth; col++) {
        // LSB = leftmost column (BitFontMaker2 convention)
        if ((val >> col) & 1) pixels[row * gridWidth + col] = 1;
      }
    }

    project.glyphs[cp] = {
      codePoint: cp,
      label: cp >= 32 ? String.fromCodePoint(cp) : `U+${cp.toString(16).toUpperCase()}`,
      pixels,
      advanceWidth: null, // all glyphs use the font-level advance
    };
  }

  // Always ensure a space glyph exists
  if (!project.glyphs[32]) {
    project.glyphs[32] = {
      codePoint: 32, label: ' ',
      pixels: new Uint8Array(gridWidth * gridHeight),
      advanceWidth: null,
    };
  }

  if (!project.glyphs[65]) {
    const first = Math.min(...Object.keys(project.glyphs).map(Number));
    project.activeCodePoint = first;
  }

  return project;
}
