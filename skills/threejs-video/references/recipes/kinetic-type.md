# Recipe: kinetic typography

Type is the subject: quotes, manifestos, lyric-style pieces, stat callouts, title sequences.

- **Drive it from cues.** With a voiceover or song, get word timestamps (Whisper) and reveal by word. Without
  audio, set a reading pace of about 3–4 words per second for short phrases, and hold the last word of each phrase
  for 0.3–0.6 s.
- **One idea per screen.** Use 1–5 words at large size. Emphasise one word per phrase with size, weight, colour or
  motion, never all four.
- **Layout grid.** Pick 2–3 anchor positions and sizes, and reuse them so the piece feels designed. Use `px(x, y)`
  on the UI layer for exact placement.
- **Transitions between phrases carry the energy:**
  - push the old phrase out in the direction the new one comes from;
  - scale the old phrase through the camera (`makeText3D` + camera move);
  - mask-wipe with a solid bar mesh;
  - cut on a beat.
- **3D depth.** Put phrases at different z in the world scene and fly the camera through them (`cameraPath`).
  This works well for vertical formats.
- **Per-letter motion:** one mesh per glyph, staggered 30–50 ms, with `outBack` for pop or `spring` for bounce. Keep
  it for display words; body text animated per letter is hard to read.
- **Texture.** Subtle grain, a paper or concrete background, and a slow drift on everything (`noise1`) keep large
  type from feeling static.

Check stills at the moment each phrase lands: it must be readable at 270 px wide, and nothing important should
sit in the bottom 15% of a 9:16 frame or under platform UI on the right edge.
