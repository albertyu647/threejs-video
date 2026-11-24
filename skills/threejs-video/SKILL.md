---
name: threejs-video
description: Make videos with raw Three.js, rendered frame-exactly to MP4 (or transparent ProRes). Covers product promos, logo stings, kinetic typography, 3D explainers, data animations, music/beat-synced pieces, social shorts, and 3D overlays on existing footage (captions, speaker cutouts, word-synced graphics). Ships a ready template (deterministic seek(t), layered scenes, cue timeline, canvas + extruded 3D text, selective bloom, camera paths, image-sequence media), a multi-worker headless-Chrome renderer, and a QA script. Use this whenever the user wants a video, animation, reel, short, promo, intro or motion graphic made with Three.js or WebGL, or asks for "3D video" without naming another tool, even if they don't mention this skill.
---

# Three.js video

Build a Three.js page whose `window.seek(t)` draws the frame for time `t`, then render it with `render.mjs`, which
screenshots every frame in headless Chrome across several workers and encodes with ffmpeg. The template already
handles setup, layering, fonts, timing helpers and rendering, so your time goes into the idea, the look and the
scenes.

## The one rule: a frame is a pure function of t

`seek(t)` must produce the same pixels for the same `t`, no matter which frame was drawn before it. The renderer
splits the timeline into slices and renders them on separate browsers in parallel, and stills jump straight to any
time. So:

- No `requestAnimationFrame`, `performance.now()`, `Date`, `THREE.Clock`, or `Math.random()` (use `rng(seed)`).
- No state built up frame by frame (positions integrated with `+=`, physics stepped per frame, trails grown over
  time). Compute positions directly from `t`. For a trail or history, recompute it from the formula for the last N
  samples.
- Async work (fonts, textures, models, image-sequence frames) is awaited before drawing: fonts and assets in
  startup code or `window.ready`, per-frame media inside `seek`.
- Simulations that truly need stepping (cloth, fluids, particle physics): bake them first with a fixed step, store
  per-frame results in an array or JSON, and look them up in `seek(t)`.

If you break this, frames at slice boundaries jump, stills don't match the video, and parallel renders stutter.

## Workflow

1. **Scaffold:** `bash <skill>/scripts/new.sh <project-dir>`. This copies `template/`, `render.mjs` and `qa.py`, then
   runs `npm install` (three, puppeteer-core, Inter, opentype.js). If the project lives under `~/Downloads` and npm
   or a bundler hangs, see Gotchas.
2. **Set the format** in `src/main.js`: `window.VIDEO = { width, height, fps, duration, audio }`. Common sizes:
   1080x1920 (9:16 shorts), 1080x1350 (4:5 feed), 1080x1080, 1920x1080.
3. **Write the idea down before code.** Do this in a comment block at the top of `main.js` or in a `PLAN.md`:
   - The hook in the first 1–2 s.
   - The beats, each with a time or a cue.
   - What each beat shows, and why it says something the audio or text doesn't already say.
   - The look (see `references/look.md`).

   In a 9-method benchmark, the best results came from strong writing (a hook that pays off later, headlines that
   add meaning instead of repeating the speech), not from more effects.
4. **Build the cue list.** Every animation is keyed to a cue, not to a loose number of seconds:
   - Words: from Whisper word timestamps (`words.json`).
   - Beats: audio onsets, see `references/recipes/beat-sync.md`.
   - Data rows.
   - Hand-placed marks: `const T = { hook: 0.2, ... }`.

   Use `findCue(words, 'launch')` so a re-timed transcript still lines up.
5. **Build the scenes.** Use the layer order in the template and `lib/` helpers. Put each scene in its own
   function or closure with a `(t) => void` update, gated by an `env()` window so it costs nothing off-screen.
6. **Check stills before rendering:** `node render.mjs check`, then `node render.mjs stills 0.5,2,4.1,...`. Pick
   the hook, each beat's peak and each transition midpoint, and open the stills to look at them. This is where you
   catch layout collisions, tiny text, wrong colour and empty frames, and it costs about one second instead of a
   full render.
7. **Render:** `node render.mjs video`. Workers default to about cores/3 (max 6). The renderer prints fps and an
   estimate. Use `--from/--to` to re-render a slice, and `--alpha` for a transparent ProRes 4444 `.mov`.
8. **QA:** `python3 qa.py final.mp4 --expect 1080x1920@30 --duration 12 --cues cues.json`. It checks specs,
   yuv420p, loudness and black frames, and writes `out/qa/contact.jpg` plus `out/qa/cues.jpg`, which shows each
   cue's frame and the frame 120 ms before it. Open both. A thing that should appear on a word must be visible at
   "AT" and not at "-120ms". Fix, re-render the affected slice, and repeat.

Report to the user: what the video does beat by beat, render time, anything you couldn't verify, and the path to
`final.mp4`.

## Template map

| File | What it gives you |
|---|---|
| `src/main.js` | Format, renderer, the three layers (world 3D, glow, pixel UI), a placeholder scene, `seek`/`ready`, `?play` preview |
| `src/lib/time.js` | `clamp lerp mapRange`, `ease.*`, `tween(t, t0, dur, ease)`, `env(t, a, b, in, out)`, `spring`, `rng(seed)`, `noise1`, cues: `activeIndex`, `findCue`, `chunkWords` |
| `src/lib/text.js` | `loadFonts`, `makeText` (canvas text with `|accent|` markup, wrap, stroke, shadow, pill background), `makeText3D` (extruded type from .ttf/.otf/.woff), `makeCaptions` (karaoke chunks with current-word highlight), `resizeCanvas` |
| `src/lib/camera.js` | `cameraPath(keys, {shake})` (Catmull-Rom path + eased look target + fov), `orbit` |
| `src/lib/post.js` | `makeBloom` (selective bloom: only the glow scene blooms; `occluder(mesh, glow)` keeps solid objects in front) |
| `src/lib/media.js` | `imageSequence(pattern, {fps})` (frame-exact footage as textures), `loadTexture` |
| `src/lib/plate.js` | `makePlate` (footage plate with shift/dim/blur/feather + optional cut-out subject that moves with it) |
| `render.mjs` | `check`, `stills`, `video` (multi-worker, audio mux, `--alpha`) |
| `qa.py` | Spec check, contact sheet, cue sheet |
| `scripts/extract_frames.sh` | Footage to numbered JPG/PNG sequence (with optional crop/scale) |

Layer order is draw order. Background, then 3D world, then glow, then UI. To put a video or a cut-out person in the
mix, add ortho plates between passes (see the video-overlay recipe). UI uses a pixel camera: 1 unit = 1 px, and
`px(x, y)` places by top-left coordinates.

## Recipes (read the one that matches the job)

- `references/recipes/video-overlay.md`: graphics over existing footage. Covers captions, a speaker cutout in
  front, and the plate sliding and dimming to open space for explainers. Use for talking heads, podcasts and
  tutorials.
- `references/recipes/kinetic-type.md`: type-led pieces, quotes, lyric-style text.
- `references/recipes/data-animation.md`: charts, counters, maps and comparisons that build on cue.
- `references/recipes/beat-sync.md`: music-driven cuts and hits from audio onsets.
- `references/recipes/logo-sting.md`: short brand reveals, transparent export, loops.
- `references/look.md`: designing the look (palette, light, material, ground, camera). Read before building any
  scene.
- `references/text.md`: text options and when to use each.

## Gotchas (each cost a past run real time)

- **Fonts before text.** Canvas text drawn before a web font loads renders in a fallback face and stays that way.
  `await loadFonts([...])` at the top of `main.js`, using local `@fontsource` files, never a CDN.
- **No 3D text fonts ship with npm `three`.** The `examples/fonts` folder isn't in the package. `makeText3D` loads
  a .ttf/.otf/.woff directly. The importmap redirects TTFLoader's CDN import of opentype.js to `node_modules`.
  `.woff2` won't parse.
- **ES modules don't load over `file://`.** `render.mjs` runs its own static server rooted at `--root` (default:
  project dir). If assets live outside it, pass `--root ..` (paths must stay inside the root).
- **Canvas textures that change size** must be disposed, or you get clipped, stale text and
  `GL_INVALID_VALUE: Offset overflows texture dimensions`. Use `resizeCanvas(cv, tex, w, h)`; `makeText` and
  `makeCaptions` already do.
- **Glow drawn over solid objects.** The glow scene renders alone. Register solid objects that pass in front with
  `bloom.occluder(mesh, glow)`.
- **Footage in a `<video>` element** seeks imprecisely and asynchronously. Use `extract_frames.sh` and
  `imageSequence`.
- **Pixel format.** JPEG frames make ffmpeg output `yuvj420p`, which some players reject. `render.mjs` converts to
  true `yuv420p` (`qa.py` flags it if not).
- **Homebrew ffmpeg has no `drawtext`.** Draw labels in the page or with Pillow, not ffmpeg.
- **Chrome builds.** `render.mjs` uses the newest `~/.cache/puppeteer` chrome-headless-shell. If a new build fails
  to launch (Chrome 158 failed to launch on one macOS setup; 157 worked), pin one with `CHROME=/path/...`. Install with
  `npx @puppeteer/browsers install chrome-headless-shell@stable --path ~/.cache/puppeteer`.
- **Bundlers under `~/Downloads`.** esbuild (and tools that use it, like Remotion and Vite) has hung there on
  macOS file-access checks. The template needs no bundler. If you add one, build from a `/tmp` mirror.
- **Symlinked assets** work with `render.mjs` (it doesn't resolve links), but some other servers return 404 on
  them. Hard links or copies are the safe default.
- **Loudness.** Source audio is often around −24 LUFS, and social platforms expect about −14. Normalise when
  muxing music or voice:
  `ffmpeg -i final.mp4 -af loudnorm=I=-14:TP=-1.5:LRA=11 -c:v copy -c:a aac out.mp4`.

## Taste notes

- A static camera makes 3D look like clip art. Give every beat a slow move (`cameraPath`, small `shake`).
- Hit cues a touch early: animations that start 30–80 ms before a word or beat feel in sync. Captions highlight
  with a 30 ms lead.
- Text must survive a phone screen. The smallest important text is about 40 px on a 1080-wide frame. Check it in
  stills at 270 px wide; if you can't read it there, it's too small.
- Every frame should have one clear focal point. Empty dark panels and tiny props were the most common weakness
  across nine past attempts at this kind of video.
- Avoid the default "tech" look (navy background, cyan glow) unless the brand calls for it. Design a look per
  piece.
