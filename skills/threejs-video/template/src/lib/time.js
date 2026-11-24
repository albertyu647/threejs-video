// Time helpers. Everything here is a pure function: same input, same output, no clock.

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const mapRange = (x, a, b, c = 0, d = 1) => lerp(c, d, clamp((x - a) / (b - a)));

// Easing. Pass 0..1, get 0..1.
export const ease = {
  linear: k => k,
  inQuad: k => k * k,
  outQuad: k => 1 - (1 - k) * (1 - k),
  inOut: k => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2),
  outCubic: k => 1 - Math.pow(1 - k, 3),
  inOutCubic: k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
  outExpo: k => (k >= 1 ? 1 : 1 - Math.pow(2, -10 * k)),
  outBack: (k, s = 1.70158) => 1 + (s + 1) * Math.pow(k - 1, 3) + s * Math.pow(k - 1, 2),
  outElastic: k => (k === 0 || k === 1 ? k : Math.pow(2, -10 * k) * Math.sin((k * 10 - 0.75) * (2 * Math.PI / 3)) + 1),
};

// 0 -> 1 over [t0, t0+dur] with easing. The workhorse: `const k = tween(t, cue.start, 0.4)`.
export const tween = (t, t0, dur, fn = ease.outCubic) => fn(clamp((t - t0) / dur));

// Envelope: fades in at `a`, holds, fades out ending at `b`. Returns 0..1.
export function env(t, a, b, fadeIn = 0.4, fadeOut = 0.4, fn = ease.inOut) {
  if (t <= a || t >= b) return 0;
  return Math.min(fn(clamp((t - a) / fadeIn)), fn(clamp((b - t) / fadeOut)));
}

// Damped spring settle from 0 to 1 starting at t0 (overshoots, then rests). Deterministic.
export function spring(t, t0, { freq = 2.2, damping = 5 } = {}) {
  const x = t - t0; if (x <= 0) return 0;
  return 1 - Math.exp(-damping * x) * Math.cos(2 * Math.PI * freq * x);
}

// Seeded random. Never use Math.random(): frames render out of order on several workers.
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// Cheap smooth noise for drift and wobble: noise1(t * speed, seed) in -1..1.
export function noise1(x, seed = 0) {
  const h = n => { const s = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453; return s - Math.floor(s); };
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return lerp(h(i), h(i + 1), u) * 2 - 1;
}

// ---------- cues ----------
// A cue is anything with a time: { t, ...data } or { start, end, ...data }.
// Sources: word timings (Whisper), music beats/onsets, data rows, hand-placed scene marks.
export const cueStart = c => (c.start ?? c.t);
export const cueEnd = c => (c.end ?? c.start ?? c.t);

// Index of the last cue that has started at time t (-1 if none). Binary search; cues sorted by start.
export function activeIndex(cues, t) {
  let lo = 0, hi = cues.length - 1, ans = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (cueStart(cues[m]) <= t) { ans = m; lo = m + 1; } else hi = m - 1; }
  return ans;
}

// Find the first cue whose text matches (case-insensitive, punctuation ignored), optionally after a time.
// Key animations to words by name, not by hardcoded seconds, so a re-timed transcript still lines up.
export function findCue(cues, text, after = -Infinity) {
  const norm = s => String(s).toLowerCase().replace(/[^\p{L}\p{N}' ]/gu, '').trim();
  const want = norm(text);
  const c = cues.find(c => cueStart(c) >= after && norm(c.word ?? c.text ?? c.label ?? '') === want);
  if (!c) throw new Error(`cue not found: "${text}" after ${after}`);
  return c;
}

// Group word cues into caption chunks of minWords..maxWords, breaking after punctuation or long pauses.
export function chunkWords(words, { minWords = 2, maxWords = 4, pause = 0.35 } = {}) {
  const groups = []; let cur = [];
  words.forEach((w, i) => {
    cur.push(w);
    const next = words[i + 1];
    const punct = /[,.?!;:]$/.test((w.word ?? w.text ?? '').trim());
    const gap = next ? cueStart(next) - cueEnd(w) : Infinity;
    if (cur.length >= maxWords || (cur.length >= minWords && (punct || gap > pause)) || !next) { groups.push(cur); cur = []; }
  });
  // merge a trailing one-word group into the previous one
  const out = [];
  for (const g of groups) { if (g.length === 1 && out.length && out.at(-1).length < maxWords + 1) out.at(-1).push(...g); else out.push(g); }
  return out.map(g => ({ words: g, start: cueStart(g[0]), end: cueEnd(g.at(-1)) }));
}
