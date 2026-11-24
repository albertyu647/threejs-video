# Text options

| Need | Use | Notes |
|---|---|---|
| Headlines, labels, captions, name tags, anything flat in screen space | `makeText` on the UI layer | Exact pixel size and any web font. Supports `|accent|` markup, wrapping (`maxWidth`), stroke, shadow and pill background. Cheapest and sharpest. |
| Flat text placed in the 3D world (signs, labels on objects) | `makeText` mesh added to the world scene, scaled down (e.g. `mesh.scale.multiplyScalar(0.01)`) | Use `pixelRatio: 3` if the camera gets close. |
| Hero type that turns, extrudes or catches light | `makeText3D(text, fontUrl, { size, depth, bevel, material })` | Real geometry from .ttf/.otf/.woff (`@fontsource/<family>/files/*.woff`). Use two-tone extrusion via `material: [face, side]`. Build once at startup; geometry is expensive. |
| Per-letter animation | One `makeText` (or `makeText3D`) per glyph, positioned by measuring with `ctx.measureText` | Stagger with `tween(t, t0 + i * 0.04, 0.4)`. |
| Word-synced karaoke | `makeCaptions(chunkWords(words))` | Redraws only when the chunk or the lit word changes. |
| A typed-out quote | `makeText` with `redraw(text.slice(0, n))`, where n comes from the word cues | Reveal by word, not by letter, when it should match speech. |

Fonts: install with `npm i @fontsource/<family>`, link the weight CSS in `index.html`, then
`await loadFonts(['900 100px "Family"'])`. Quote family names that contain spaces.

Faces that worked for short-form: Inter (900 for headlines, 700–800 for captions), Anton or Bebas Neue for
condensed impact, and a serif like Fraunces or Playfair for editorial and legal subjects.
