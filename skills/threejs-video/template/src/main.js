// Three.js video. The one rule: seek(t) draws the frame for time t from t alone.
// No clock, no requestAnimationFrame, no state carried from the previous frame, no Math.random().
// The renderer calls seek() on several browsers at once, each on its own slice of frames, in any order.
import * as THREE from 'three';
import { clamp, tween, env, ease, rng, lerp } from './lib/time.js';
import { loadFonts, makeText } from './lib/text.js';
import { cameraPath } from './lib/camera.js';
import { makeBloom } from './lib/post.js';

// ---------- format ----------
// The renderer reads window.VIDEO. 1080x1920 (9:16), 1080x1350 (4:5), 1080x1080, 1920x1080.
const VIDEO = { width: 1080, height: 1920, fps: 30, duration: 6, audio: null /* e.g. '../assets/track.mp3' */ };
window.VIDEO = VIDEO;
const { width: W, height: H } = VIDEO;

await loadFonts(['900 100px Inter', '700 48px Inter']);

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.autoClear = false;
document.body.appendChild(renderer.domElement);

// ---------- layers (render order = stacking order) ----------
// 1. world: perspective 3D scene. 2. glow: objects that also bloom. 3. ui: pixel-exact 2D (1 unit = 1 px, origin centre).
// Add more passes as needed, e.g. a video plate behind world and a cutout plate in front of it (recipes/video-overlay.md).
const world = new THREE.Scene();
const glow = new THREE.Scene();
const ui = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(35, W / H, 0.1, 200);
const uiCam = new THREE.OrthographicCamera(-W / 2, W / 2, H / 2, -H / 2, -1000, 1000);
// px(x, y): place UI by top-left pixel coordinates.
const px = (x, y) => new THREE.Vector3(x - W / 2, H / 2 - y, 0);
const bloom = makeBloom(renderer, W, H, { strength: 1.1, radius: 0.5 });

// ---------- look ----------
// Placeholder neutral look. Design the real one per piece (references/look.md): palette, light, material, ground.
const BG = new THREE.Color('#151515');
world.add(new THREE.HemisphereLight(0xffffff, 0x222222, 1.2));
const key = new THREE.DirectionalLight(0xffffff, 2.5); key.position.set(3, 5, 4); world.add(key);

// ---------- timeline ----------
// Hand-placed marks and/or cues from data (words.json, beats.json, rows). Key every animation to a cue.
const T = { intro: 0.2, hero: 0.8, title: 1.6, outro: 5.2 };

// ---------- scene content (replace) ----------
const R = rng(7);
const hero = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0xbbbbbb, roughness: 0.35, metalness: 0.2, flatShading: true }));
world.add(hero);
bloom.occluder(hero, glow);   // keeps the ring's glow from drawing over the sphere where the sphere is in front
const ring = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.02, 8, 128), new THREE.MeshBasicMaterial({ color: 0xffffff }));
glow.add(ring);
const dots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.03, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }), 200);
const dotSeeds = Array.from({ length: 200 }, () => [R() * Math.PI * 2, (R() - 0.5) * 6, 2 + R() * 3, 0.2 + R() * 0.6]);
world.add(dots);
const title = makeText('THREE.JS |VIDEO|', { font: '900 120px Inter', color: '#fff', accent: '#bbbbbb' });
title.position.copy(px(W / 2, H * 0.2)); ui.add(title);

const path = cameraPath([
  { t: 0, pos: [0, 0.5, 9], look: [0, 0, 0] },
  { t: 3, pos: [2.5, 1.2, 7], look: [0, 0, 0] },
  { t: 6, pos: [0, 0.2, 6], look: [0, 0.2, 0] },
], { shake: 0.015 });

const m4 = new THREE.Matrix4();
function update(t) {
  path.apply(cam, t);
  const k = tween(t, T.hero, 0.9, ease.outBack);
  hero.scale.setScalar(Math.max(0.0001, k));
  hero.rotation.set(t * 0.3, t * 0.5, 0);
  ring.scale.setScalar(lerp(0.6, 1, tween(t, T.hero + 0.2, 1.2)));
  ring.rotation.set(Math.PI / 2 + Math.sin(t) * 0.2, 0, t * 0.4);
  ring.material.opacity = env(t, T.hero, T.outro + 0.6, 0.5, 0.6); ring.material.transparent = true;
  dotSeeds.forEach(([a, y, r, s], i) => { const ang = a + t * s * 0.3; m4.makeTranslation(Math.cos(ang) * r, y + Math.sin(t * s + a) * 0.2, Math.sin(ang) * r); dots.setMatrixAt(i, m4); });
  dots.instanceMatrix.needsUpdate = true;
  const tk = tween(t, T.title, 0.6);
  title.material.opacity = tk * (1 - tween(t, T.outro, 0.5));
  title.position.y = px(0, H * 0.2).y - (1 - tk) * 40;
}

// ---------- frame ----------
function render() {
  renderer.setClearColor(BG, 1); renderer.clear();
  renderer.render(world, cam);
  renderer.clearDepth(); bloom.render(glow, cam);
  renderer.clearDepth(); renderer.render(ui, uiCam);
}

window.seek = async t => {
  t = clamp(t, 0, VIDEO.duration);
  // await any media here first: e.g. await plate.set(t)
  update(t);
  render();
};
window.ready = Promise.resolve();
// Preview in a normal browser: open with ?play to scrub in real time (never used for the final render).
if (location.search.includes('play')) { const t0 = performance.now(); const loop = () => { window.seek(((performance.now() - t0) / 1000) % VIDEO.duration); requestAnimationFrame(loop); }; loop(); }
else window.seek(0);
