// Frame-exact media: image sequences instead of <video>. A <video> element seeks to the nearest keyframe-ish
// position and decodes asynchronously, so frames drift or repeat under load. Pre-extract frames with
// scripts/extract_frames.sh and load the exact one per frame here.
import * as THREE from 'three';

const cache = new Map();
function loadImage(url) {
  if (cache.has(url)) return cache.get(url);
  const p = new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('missing ' + url)); im.src = url; });
  cache.set(url, p);
  if (cache.size > 120) cache.delete(cache.keys().next().value); // keep memory bounded on long renders
  return p;
}

/**
 * An image-sequence texture. pattern: 'assets/clip/%04d.jpg'. fps: the sequence's own frame rate.
 * await seq.set(t) inside seek(t) before rendering. Missing frames keep the last good one and are counted
 * in seq.missing, so the render log can report them instead of silently showing a stale frame.
 */
export function imageSequence(pattern, { fps = 30, count = Infinity, offset = 0 } = {}) {
  const tex = new THREE.Texture(); tex.colorSpace = THREE.SRGBColorSpace; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  const seq = { texture: tex, missing: 0, frame: -1 };
  const url = f => pattern.replace(/%0(\d)d/, (_, n) => String(f).padStart(+n, '0'));
  seq.set = async t => {
    const f = Math.max(0, Math.min(count - 1, Math.round((t - offset) * fps)));
    if (f === seq.frame) return;
    try { tex.image = await loadImage(url(f)); tex.needsUpdate = true; seq.frame = f; }
    catch { seq.missing++; }
    // prefetch the next frame
    if (f + 1 < count) loadImage(url(f + 1)).catch(() => {});
  };
  return seq;
}

export async function loadTexture(url) {
  const t = await new THREE.TextureLoader().loadAsync(url); t.colorSpace = THREE.SRGBColorSpace; return t;
}
