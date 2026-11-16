# Self-hosted web fonts

These are the WOFF2 files that `next/font/google` used to download from Google Fonts at build time. They were copied on 16 Nov 2026 from Google's own servers: the `fonts.googleapis.com/css2` request and user-agent of the Next 15.5 loader, with files from `fonts.gstatic.com`. They are now loaded with `next/font/local` (`lib/fonts/`, `lib/trustseal/noto-fonts.ts`), so builds no longer depend on Google Fonts (vercel/next.js#99114).

| Folder | Family | Weights | Subsets (one file each) | Licence |
|---|---|---|---|---|
| `inter/` | Inter | 100–900 (variable) | cyrillic-ext, cyrillic, greek-ext, greek, vietnamese, latin-ext, latin | SIL OFL 1.1, `inter/OFL.txt` |
| `jetbrains-mono/` | JetBrains Mono | 400, 500, 600 (one variable file per subset) | cyrillic-ext, cyrillic, greek, vietnamese, latin-ext, latin | SIL OFL 1.1, `jetbrains-mono/OFL.txt` |
| `noto-sans-arabic/` | Noto Sans Arabic | 100–900 (variable) | arabic, math, symbols, latin-ext, latin | SIL OFL 1.1, `noto-sans-arabic/OFL.txt` |
| `noto-sans-devanagari/` | Noto Sans Devanagari | 100–900 (variable) | devanagari, latin-ext, latin | SIL OFL 1.1, `noto-sans-devanagari/OFL.txt` |

`manifest.json` records, for every face:
- the subset;
- the weight and style;
- the exact `unicode-range`;
- the source URL;
- the byte size and SHA-256.

The `OFL.txt` files come from the official google/fonts repository (`ofl/<family>/OFL.txt`) and must stay next to the fonts. The OFL allows the fonts to be bundled and redistributed with software, provided the copyright notice and licence travel with them. The fonts must not be sold on their own.

To update a font, regenerate the files the same way and keep the `unicode-range` values in the font modules in sync with `manifest.json`.
