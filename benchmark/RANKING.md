# Benchmark: 9 ways to add 3D and explainer graphics to a talking-head clip

The job: a 43-second, two-speaker podcast clip, cut to 4:5. Add captions with the current word highlighted, open space for explainer graphics at five idea beats, keep the speaker cut out in front, and make the whole thing work as a social short.

Each method got the same inputs and the same written brief, and ran as its own Claude Code agent with a fresh context:

- the 4:5 edit (42.9 s, 4 trims)
- a per-frame speaker cutout ([BiRefNet](https://huggingface.co/ZhengPeng7/BiRefNet-portrait) on Apple MPS)
- Whisper word timings (`words.json`)
- `BRIEF.md`: layout rules and the five idea beats, with no visual direction

The source footage, transcript and renders aren't published here, because the clip isn't mine to share. This page has the scores, the reasoning and the build costs.

## Methods

| # | Method | What it is |
|---|---|---|
| 01 | Raw [Three.js](https://github.com/mrdoob/three.js) | No skill. The agent wrote a seek-based page and a Puppeteer renderer from scratch |
| 02 | [HyperFrames](https://github.com/heygen-com/hyperframes) | HTML compositions rendered to video, with its agent skill |
| 03 | [Remotion skills](https://github.com/remotion-dev/skills) | React video framework, with its official agent skills |
| 04 | [motionmaxxing](https://github.com/Tejashmakwana/motionmaxxing) | Motion-design direction skill with its own render and review gates |
| 05 | [explainroo](https://github.com/vincentsch/explainroo) | Explainer-video skill with Remix Icon and built-in captions |
| 06 | [anatomy](https://github.com/wheresryan22/anatomy) (isometric style) | A style skill only; the agent used a neutral Puppeteer renderer |
| 07 | [video-agent-skills](https://github.com/melvynx/video-agent-skills) | Agent skills plus a renderer for social formats |
| 08 | [attentionmachine-skills](https://github.com/robinebers/attentionmachine-skills) | Remotion-based short-form skills |
| 09 | [script-skill](https://github.com/tenfoldmarc/script-skill) | A scriptwriting skill only; the agent used the neutral renderer |

## Ranking

Each was scored 1–10 on five criteria. Ties are broken on virality, since that's the point of the format.

| Rank | Method | Creativity | Word timing | Pace | Virality | Professionalism | **Total /50** |
|---|---|---|---|---|---|---|---|
| 1 | 09 script-skill | 8 | 8 | 8 | 9 | 8 | **41** |
| 2 | 02 HyperFrames | 7 | 9 | 8 | 8 | 9 | **41** |
| 3 | 01 Raw Three.js | 8 | 9 | 8 | 8 | 7 | **40** |
| 4 | 03 Remotion | 8 | 9 | 8 | 8 | 7 | **40** |
| 5 | 05 explainroo | 7 | 7 | 8 | 7 | 8 | **37** |
| 6 | 07 video-agent-skills | 7 | 7 | 8 | 8 | 7 | **37** |
| 7 | 04 motionmaxxing | 8 | 8 | 6 | 5 | 7 | **34** |
| 8 | 06 anatomy (isometric) | 8 | 8 | 7 | 4 | 7 | **34** |
| 9 | 08 attentionmachine | 6 | 8 | 6 | 7 | 6 | **33** |

## Why each landed where it did

**1. script-skill.** Of the nine, it had the best writing. The opening line sets up a payoff the second speaker delivers 40 seconds later, and every headline adds something the speech doesn't say outright. The layout is clean, with the video in a framed card. One flaw: keywords that were already spoken stay yellow next to the yellow current-word highlight, which makes the current word a little harder to pick out. The skill covers only the writing, so the visuals came from the agent and the neutral renderer. Its win shows that a scriptwriting pass lifts any renderer.

**2. HyperFrames.** This had the most consistent look: an amber-and-charcoal design system, crisp type, a hook on screen from frame 0, and exact caption timing. It loses points because the explainer graphics are small, sit in a short top band, and are more tasteful than striking. The audio was also left at source level (about −22 LUFS).

**3. Raw Three.js.** It's the most 3D of the nine: a glowing building, orbiting nodes, a node that shatters, a gavel and a row of figures. Headlines and captions are bold, and the timing is exact. Professionalism scored lower because the props look simple and clip-art-like and the dark-blue scenes all look alike.

**4. Remotion.** It had clever word-locked moments: a stamp, a cursor flipping a toggle on the key word, and a document card whose quote types in time with the speech. It also added sound effects. Three things held it back:
- the blank card shows a blinking cursor for about 1.5 s before anything types;
- captions wrap onto two lines;
- the dim unhighlighted words are hard to read against the speakers' clothes.

**5. explainroo.** Clean and legible, with good icon use, an animated flow diagram, a rounded video card and audio mastered to −14 LUFS. Its built-in captions fill in progressively instead of highlighting a single current word. That misses the brief's main caption rule.

**6. video-agent-skills.** Bright paper panels pop against the dark room, there's a believable dialog box with a cursor click, and it has a music bed and sound effects at −14 LUFS. Several caption words carry a highlight box at once, though, so it's unclear which word is current. One headline transition also shows a ghosted double. The agent had to patch the renderer to get 4:5.

**7. motionmaxxing.** It had the smartest single idea: concrete files fly out to a third party and come back as evidence. It also passed its own quality gates and was mastered to −14 LUFS. Against that, the explainer area is often dark and nearly empty, the text on the papers is tiny, and the captions are small white pills mid-frame with no hook. On a phone it wouldn't stop a scroll.

**8. anatomy (isometric).** A distinctive editorial look: one isometric machine carries four beats, then a balance scale tips on the payoff. The concept is coherent and the timing good. The line art is low-contrast and the labels are tiny at phone size, so it scored lowest on virality.

**9. attentionmachine-skills.** It has a decent hook, clean lowercase captions, sound effects and −14 LUFS audio. The explainer panels are mostly empty for two long stretches, and the graphics are flat and small. The agent also spent much of its time fighting the toolchain (see below).

## Caption timing check

I sampled 11 test words in all nine videos, once at each word's midpoint and once 120 ms before it starts. All nine highlight the right word at the midpoint, and none highlights it early. Where they differ is how clearly the current word stands out:

- Clearest: Three.js, HyperFrames and Remotion.
- Muddy: explainroo, because it fills progressively, and video-agent-skills, because several words are boxed at once.

## Build cost

The token numbers come from each agent's transcript. "Tokens processed" counts every input token the model read, including cache reads, plus output. Three agents spent part of their time idle while the speaker cutout finished, and that wait is subtracted in the "active" column.

| Method | Wall time | Active time (cutout wait removed) | Tokens processed | Output tokens | Final render | Main fights |
|---|---|---|---|---|---|---|
| 01 Raw Three.js | 43.2 min | 25.9 min | 3.96M | 74.4k | 275 s | No 3D-text font ships in npm `three`; font loading |
| 02 HyperFrames | 43.7 min | 26.2 min | 13.94M | 71.5k | 115 s | Scenes share one root id; the skill expects a human to answer |
| 03 Remotion | 37.7 min | 28.4 min | 10.27M | 64.6k | 133 s | Bundled Chrome 158 wouldn't launch; symlinked assets returned 404 |
| 04 motionmaxxing | 15.7 min | 15.7 min | 11.18M | 61.2k | ~120 s | Caption bug (caught by its own seek test); its look check needs ffmpeg `drawtext` |
| 05 explainroo | 15.3 min | 15.3 min | 11.31M | 55.9k | 38 s | No alpha for clips (matte blend workaround); its own Whisper timing was off by up to 0.9 s |
| 06 anatomy | 17.0 min | 17.0 min | 10.80M | 83.5k | ~90 s | Global-only install; camera framing |
| 07 video-agent-skills | 13.0 min | 13.0 min | 17.12M | 68.2k | 18 s | Renderer only knew 9:16, 1:1 and 16:9; patched for 4:5 |
| 08 attentionmachine | 29.4 min | 29.4 min | 10.27M | 69.3k | 67 s | esbuild hung under `~/Downloads`; ran from a `/tmp` mirror |
| 09 script-skill | 9.3 min | 9.3 min | 3.76M | 49.8k | 72 s | Needs Apify for research; used its fallback hooks |

Raw Three.js placed third. It also used the fewest tokens of any method that rendered its own graphics, at 3.96M against 10–17M for the framework skills. Most of its time went into one-off setup work: a font loader, a renderer and caption plumbing. Turning that setup into a reusable template is the idea behind the [`threejs-video`](../skills/threejs-video) skill in this repo. The [A/B test](../ab-test) measures whether it helps.

## Caveats

- I scored from frame samples and contact sheets rather than watching each video at real speed. Pace and transition smoothness are inferred from the timing structure and the agents' notes.
- Loudness varies: 04, 05, 07 and 08 were mastered to −14 LUFS and the others sit around −22 to −25 LUFS. The side-by-side review grid evened this out.
- 06 and 09 brought only a style or writing skill, so part of their visual quality depends on the agent.
- There was one run per method. A second run of any method could score a few points differently.
