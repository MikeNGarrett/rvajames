# Brand Source Notes

Provenance record for color and typography values used in `app/globals.css` and `docs/brand.md`.

**Fetched:** 2026-05-23  
**Source URL:** https://www.rva.gov/strategic-communications/brand  
**Method:** WebFetch of page HTML + direct fetch of inline image assets. Color values read from PNG swatches displayed as images on the page (no machine-readable color data is exposed in the page HTML).

---

## Primary palette — raw extracted values

Images fetched from:
- `https://www.rva.gov/sites/default/files/inline-images/images-primary-palette_0.png`

| Name | Pantone | CMYK | RGB | HEX (from image) |
|---|---|---|---|---|
| CoR Blue | 7687 C | 95, 78, 27, 12 | 38, 70, 119 | `#264677` |
| CoR Red | 7621 C | 23, 98, 92, 16 | 170, 36, 42 | `#AA242A` |
| Light Blue | 284 C | 52, 17, 0, 0 | 127, 177, 229 | `#7fb1e5` |
| Navy Blue | 534 C | 100, 82, 36, 25 | 30, 56, 95 | `#282938` ⚠️ |

> **⚠️ Navy Blue discrepancy:** The source image shows hex `#282938` (= rgb 40, 41, 56 — a dark charcoal) but the RGB values shown are 30, 56, 95. The correct hex conversion of rgb(30, 56, 95) is `#1E385F`, which is a true deep navy and visually matches the swatch. We use `#1E385F` in the codebase. The `#282938` value in the source image appears to be a typographic error.

---

## Accent palette — raw extracted values

Image fetched from:
- `https://www.rva.gov/sites/default/files/inline-images/images-accent-colors.png`

| Name | Pantone | CMYK | RGB | HEX (from image) |
|---|---|---|---|---|
| Capitol Gold | 2003 C | 2, 5, 71, 0 | 255, 232, 107 | `#ffe86b` |
| Southside Sunset | 2064 C | 11, 42, 0, 0 | 224, 162, 212 | `#e0a2d4` |
| Libby Sunrise | 1635 C | 0, 59, 59, 0 | 255, 134, 102 | `#ff8666` |
| Walker Green | 359 C | 36, 0, 64, 0 | 168, 221, 131 | `#a8dd83` |

All hex values verified against RGB: no discrepancies.

---

## Typography — raw extracted values

Images fetched from:
- `https://www.rva.gov/sites/default/files/inline-images/images_brand-typeface.png`
- `https://www.rva.gov/sites/default/files/inline-images/images_user-typeface.png`

**Brand Typeface:**  
Name: **Nunito Sans**  
Source: Google Fonts  
Weights shown: Regular (400), Medium (500), SemiBold (600), Bold (700), Extra Bold (800)

**User Typeface (fallback for non-brand contexts):**  
Name: **Arial**  
Type: System Font  
Styles shown: Regular, Italic, Bold, Bold Italic

---

## Brand voice — raw extracted values

From page text at https://www.rva.gov/strategic-communications/brand (fetched 2026-05-23):

- "commitment to transparency, accessibility, and community connection"
- "approachable character that defines our city"
- "trust and professionalism"
- "consistent visual standards across every interaction"
- Guidelines apply to "digital communications and design materials"

No additional voice guidelines (do/don't lists, tone adjectives) were published in machine-readable form on the page as of this fetch. The extended voice guidance in `docs/brand.md` is derived from these stated values and adapted for the dashboard context.

---

## Color usage ratio

An image at `https://www.rva.gov/sites/default/files/inline-images/images-color-usage-ratio_0.png` shows proportional color usage guidelines, but specific percentages are encoded in the image only (not readable as text). General guidance: CoR Blue is dominant; CoR Red is accent.
