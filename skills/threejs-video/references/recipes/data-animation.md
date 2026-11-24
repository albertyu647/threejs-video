# Recipe: data animation

Charts, counters, comparisons, maps and timelines that build on cue.

- **Data in, cues out.** Load the data as JSON at startup. Each row or milestone becomes a cue
  (`{ t, label, value }`), spaced to the narration or 0.4–0.8 s apart.
- **Bars and columns:** use `BoxGeometry` with the origin moved to the base (`geo.translate(0, 0.5, 0)`) so
  `scale.y = value * tween(t, cue.t, 0.6)` grows from the floor. Put the value label on top and drive its number
  from the same tween.
- **Counters:** `Math.round(lerp(from, to, tween(...)))`. Format with `Intl.NumberFormat`. Use tabular figures
  (`font-variant-numeric` isn't available in canvas, so pick a font with tabular digits like Inter) so the digits
  don't jitter.
- **Lines:** build the full line once, then reveal it by setting `geometry.setDrawRange(0, n)` from `t`, with a
  dot riding the head. For thick lines use `Line2` from `three/addons/lines/`.
- **Many points** (scatter, particles as people/units): use `InstancedMesh`, positions computed from `t` per
  instance (lerp from a start layout to a target layout with a per-instance delay from `rng`).
- **Maps:** project lon/lat to a plane (equirectangular is fine for short pieces) or onto a sphere
  (`setFromSphericalCoords`). Load GeoJSON and extrude regions with `ExtrudeGeometry`.
- **Make the one number land.** Every data piece has a takeaway. Give it the accent colour, a camera push-in and a
  hold of at least 1.5 s.
- **Honesty.** Start axes at zero for bars, label units, and never animate a value past its real number for
  effect.
