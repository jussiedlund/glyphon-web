# Font Attribution & Licenses

Glyphon's bundled fonts are carefully selected from excellent open-source bitmap font projects. All are freely available under permissive licenses.

## Bundled Fonts

### Cozette
- **Author:** [the-moonwitch](https://github.com/the-moonwitch)
- **Repository:** https://github.com/the-moonwitch/Cozette
- **License:** [SIL Open Font License 1.1](https://github.com/the-moonwitch/Cozette/blob/main/LICENSE)
- **Description:** A bitmap programming font optimized for coziness. Available in bitmap (.otb, .bdf, .psf) and vector (.ttf) formats. Popular among developers for its readable, friendly proportions.
- **Usage:** Load from the Open Source library and edit as a starting point for your own fonts.

### Spleen
- **Author:** [Frederic Cambus](https://github.com/fcambus)
- **Repository:** https://github.com/fcambus/spleen
- **License:** [BSD 2-Clause](https://github.com/fcambus/spleen/blob/master/LICENSE)
- **Description:** Monospaced bitmap font with multiple sizes (5×8, 6×12, 8×16, 12×24). Clean, professional style. Ideal for terminals and retro interfaces.
- **Available sizes:** 5×8, 6×12, 8×16, 12×24

### Terminus
- **Author:** [Dimitar Zhekov](https://sourceforge.net/projects/terminus-font/)
- **Repository (mirrors):** 
  - Official: https://terminus-font.sourceforge.net/
  - GitHub mirror: https://github.com/Tecate/bitmap-fonts
- **License:** [SIL Open Font License 1.1](https://terminus-font.sourceforge.net/)
- **Description:** The gold standard monospaced bitmap font, designed for long hours of terminal work. 1356+ characters covering ~120 language sets. Highly readable and professional.
- **Versions:** Regular, Bold; multiple sizes from 8×16 to 14×28

---

## How to Import Your Own BDF Fonts

BDF (Bitmap Distribution Format) is the standard text format for bitmap fonts. You can import any open-source BDF font:

1. Export a BDF font from a font editor or find one on GitHub
2. Use the BDF parser to convert to Glyphon's JSON format
3. Add to the **Open Source** library section

### Example: Adding a Custom Font

```bash
python3 assets/fonts-source/bdf-to-json.py your-font.bdf your-font.json "My Font Name"
```

This generates a JSON file that Glyphon can load.

---

## Thanks

We're grateful to these font designers for sharing their work under open-source licenses. Their fonts inspire Glyphon users and demonstrate the beauty of well-crafted bitmap typography.
