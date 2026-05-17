/* global PFM */
window.PFM = window.PFM || {};

PFM.BASIC_LATIN = [0x0020, 0x007E];
PFM.LATIN_1_SUPPLEMENT = [0x00A0, 0x00FF];
PFM.LATIN_EXTENDED_A = [0x0100, 0x017F];

PFM.UNICODE_RANGES = [
  { name: 'Basic Latin',           start: 0x0020, end: 0x007E },
  { name: 'Latin-1 Supplement',    start: 0x00A0, end: 0x00FF },
  { name: 'Latin Extended-A',      start: 0x0100, end: 0x017F },
  { name: 'Latin Extended-B',      start: 0x0180, end: 0x024F },
  { name: 'Greek & Coptic',        start: 0x0370, end: 0x03FF },
  { name: 'Cyrillic',              start: 0x0400, end: 0x04FF },
  { name: 'Hiragana',              start: 0x3040, end: 0x309F },
  { name: 'Katakana',              start: 0x30A0, end: 0x30FF },
  { name: 'Box Drawing',           start: 0x2500, end: 0x257F },
  { name: 'Block Elements',        start: 0x2580, end: 0x259F },
];

PFM.createGlyph = function(codePoint, width, height) {
  return {
    codePoint,
    label: String.fromCodePoint(codePoint),
    pixels: new Uint8Array(width * height),
    advanceWidth: null,
  };
};

PFM.createFontProject = function({ name = 'Untitled', glyphWidth = 10, glyphHeight = 12 } = {}) {
  const glyphs = {};
  for (let cp = PFM.BASIC_LATIN[0]; cp <= PFM.BASIC_LATIN[1]; cp++) {
    glyphs[cp] = PFM.createGlyph(cp, glyphWidth, glyphHeight);
  }
  for (let cp = PFM.LATIN_1_SUPPLEMENT[0]; cp <= PFM.LATIN_1_SUPPLEMENT[1]; cp++) {
    glyphs[cp] = PFM.createGlyph(cp, glyphWidth, glyphHeight);
  }

  const originX     = 2;
  const baseline    = Math.round(glyphHeight * 0.75);
  const ascender    = Math.round(glyphHeight * 0.08);
  const descender   = glyphHeight - 1;
  const capHeight   = Math.round(glyphHeight * 0.17);
  const xHeight     = Math.round(glyphHeight * 0.42);

  return {
    meta: {
      name,
      author: '',
      version: '1.0',
      description: '',
      glyphWidth,
      glyphHeight,
      originX,
      baseline,
      ascender,
      descender,
      capHeight,
      xHeight,
      advanceWidth: glyphWidth + 1,
      spaceWidth: Math.max(2, Math.round((glyphWidth - originX) * 0.55)),
      unitsPerEm: 1000,
    },
    glyphs,
    activeCodePoint: 65, // 'A'
  };
};

// Compute effective advance width for a glyph (columns from grid left edge).
// If glyph.advanceWidth is explicitly set, use it.
// Otherwise: rightmost set pixel col + 2 (one col of right spacing), or font default for empty glyphs.
PFM.computeGlyphAdvance = function(glyph, meta) {
  if (glyph.advanceWidth != null) return glyph.advanceWidth;
  const { glyphWidth: gw, glyphHeight: gh } = meta;
  let rightmost = -1;
  for (let r = 0; r < gh; r++) {
    for (let c = 0; c < gw; c++) {
      if (glyph.pixels[r * gw + c] && c > rightmost) rightmost = c;
    }
  }
  if (rightmost < 0) return meta.advanceWidth; // empty glyph — use font default
  return rightmost + 2; // one column of right spacing
};

PFM.serializeProject = function(project) {
  const out = {
    meta: { ...project.meta },
    glyphs: {},
    activeCodePoint: project.activeCodePoint,
  };
  for (const cp of Object.keys(project.glyphs)) {
    const g = project.glyphs[cp];
    out.glyphs[cp] = {
      codePoint: g.codePoint,
      label: g.label,
      pixels: Array.from(g.pixels),
      advanceWidth: g.advanceWidth,
    };
  }
  return out;
};

PFM.deserializeProject = function(data) {
  const project = {
    meta: { originX: 0, ...data.meta },
    glyphs: {},
    activeCodePoint: data.activeCodePoint || 65,
  };
  for (const cp of Object.keys(data.glyphs)) {
    const g = data.glyphs[cp];
    project.glyphs[cp] = {
      codePoint: g.codePoint,
      label: g.label || String.fromCodePoint(g.codePoint),
      pixels: new Uint8Array(g.pixels),
      advanceWidth: g.advanceWidth ?? null,
    };
  }
  return project;
};
