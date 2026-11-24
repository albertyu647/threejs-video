# Recipe: graphics over existing footage

Use for talking heads, podcasts, interviews, tutorials and reaction clips. The footage stays visible, captions
track the speech, and at explainer moments the footage slides down and dims while the speaker (cut out) stays in
front and the explanation appears in the space above.

## Inputs to prepare (outside Three.js)

| Input | How |
|---|---|
| Edited clip at the target aspect ratio | ffmpeg. Trim dead air with short audio fades (`afade` 25 ms) at each cut, and check each cut with a loudness envelope so you don't clip a word. Crop each camera shot separately. |
| Frames | `scripts/extract_frames.sh clip.mp4 assets/clip 30` |
| Word timings | Whisper with word timestamps (mlx-whisper large-v3 on Apple silicon). Save as `{ "words": [{ "word", "start", "end", "speaker" }] }`. Spot-check boundaries against the loudness envelope, because Whisper often stretches a word over a pause. |
| Speaker cutout (RGBA PNG per frame) | BiRefNet-portrait (transformers, `trust_remote_code`) on MPS in fp16: about 1.4 s/frame on an M-series Mac, versus 27 s on CPU. Smooth the alpha over time (`a = 0.7*a + 0.3*prev`), but reset the smoothing at every camera cut. Write `assets/cutout/%04d.png`. |

The cutout is the slow step. Start it first and build with the plain frames while it runs.

## Layer order

```
background (gradient / particles / 3D set; seen only when the plate slides down)
plate      (footage: makePlate().plate.mesh, pixel camera)
world      (3D explainer, perspective camera)
glow       (bloom for selected explainer objects)
cutout     (makePlate().cut.mesh, pixel camera: the speaker in front of the explainer)
ui         (headline, captions, name tags)
```

In `render()`, each pass is `renderer.render(scene, cam)` with `renderer.clearDepth()` between passes. The plate
and the cutout are the same size and get the same transform, so they can never misalign.

## Explainer windows

```js
import { makePlate } from './lib/plate.js';
const P = makePlate({ W, H, frames: '../assets/clip/%04d.jpg', cutout: '../assets/cutout/%04d.png', fps: 30, count: NFRAMES });
plateScene.add(P.plate.mesh); cutScene.add(P.cut.mesh);
const WINDOWS = [[2.3, 13.6], [15.4, 21.9]];               // derive from cues: [findCue(w,'pay').start - .3, ...]
const amt = t => Math.max(0, ...WINDOWS.map(([a, b]) => env(t, a, b, 0.55, 0.45)));
// in seek(t):
const s = amt(t);
await P.set(t, { shift: 540 * s, dim: 1 - 0.65 * s, blur: s, fade: s });
```

- Drop the plate by about 35–40% of the frame height so the explainer gets a real stage. In past runs the main
  weakness was explainers too small to read on a phone.
- Move captions down a little during windows so they sit on the speaker's chest, not on the explainer.
- Leave 1–2 s of plain talking head between windows. Constant graphics tire the eye and hide the speaker.
- Line transitions up with camera cuts where possible (`camera_cuts_at`); a slide that starts on a cut feels
  intentional.

## Captions

`chunkWords(words, { minWords: 2, maxWords: 4 })` and `makeCaptions(chunks)` give you 2–4 word chunks broken at
punctuation and pauses, with the current word highlighted (30 ms lead). Rules that judged well:
- One clearly highlighted word. Progressive fill or several boxed words make the current word ambiguous.
- Keep a caption on one line; two lines read as subtitles, not short-form captions.
- Use a heavy face at about 60–70 px on a 1080-wide frame, with a dark stroke for footage behind it.
- Check with `qa.py --cues words.json`: at "AT" the right word is lit, and at "-120ms" it isn't yet.

## Writing the explainers

Each explainer should add something the speech doesn't, using the speaker's own nouns. A headline that only
repeats the caption wastes the slot. Open with a hook on screen in the first second that sets up a payoff later in
the clip.
