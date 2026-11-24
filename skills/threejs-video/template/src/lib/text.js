// Text for video. Two options:
//  1. makeText(): 2D canvas drawn onto a plane. Proven, any web font, rich accents, exact pixel size. Default for UI,
//     captions, headlines and labels.
//  2. makeText3D(): real extruded geometry (TextGeometry) straight from a .ttf/.otf/.woff file (not .woff2).
//     Use for hero type that turns in 3D. @fontsource packages ship .woff files under files/.
// Fonts must be loaded before any text is drawn, or the first frames render in a fallback face.
import * as THREE from 'three';

// Call once at startup. families: [['900 100px "Anton"'], ...] or plain strings like '700 64px Inter'.
export async function loadFonts(specs) {
  await Promise.all(specs.map(s => document.fonts.load(s)));
  await document.fonts.ready;
  const missing = specs.filter(s => !document.fonts.check(s));
  if (missing.length) throw new Error('fonts failed to load: ' + missing.join(', '));
}

// three.js allocates fixed-size GPU storage for a texture. When a canvas changes size the old storage must be freed,
// or the new drawing is clipped and mixed with stale pixels (GL_INVALID_VALUE: Offset overflows texture dimensions).
export function resizeCanvas(cv, tex, w, h) {
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; tex.dispose(); }
}

export function canvasTexture(cv) {
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.generateMipmaps = false; t.minFilter = THREE.LinearFilter;
  return t;
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// Rich text: "PAYS PER |TOKEN|" -> the part between bars uses `accent`.
const parseRich = s => s.split('|').map((p, i) => ({ text: p, accent: i % 2 === 1 })).filter(p => p.text);

/**
 * Draw text to a canvas and return a Mesh sized in pixels (1 unit = 1 px when used with a pixel ortho camera).
 * opts: font ('900 96px Anton'), color, accent, align ('center'|'left'|'right'), maxWidth (wraps), lineHeight (multiplier),
 *       letterSpacing (px), stroke {color,width}, shadow {color,blur,y}, bg {color,padX,padY,radius}, pixelRatio (2).
 * Returns mesh with mesh.userData.{width,height}. Redraw with mesh.userData.redraw(newText) (cheap enough per frame
 * for captions, but don't redraw dozens of meshes every frame).
 */
export function makeText(text, opts = {}) {
  const o = { font: '700 64px Inter', color: '#fff', accent: '#FFD60A', align: 'center', lineHeight: 1.1, letterSpacing: 0, pixelRatio: 2, ...opts };
  const cv = document.createElement('canvas'); const ctx = cv.getContext('2d');
  const tex = canvasTexture(cv);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);

  function layout(str) {
    ctx.font = o.font; ctx.letterSpacing = o.letterSpacing + 'px';
    const size = parseFloat(o.font.match(/(\d+(?:\.\d+)?)px/)[1]);
    const words = str.split(/(\s+)/); const lines = []; let line = '';
    for (const w of words) {
      const test = line + w;
      if (o.maxWidth && ctx.measureText(test.replace(/\|/g, '')).width > o.maxWidth && line.trim()) { lines.push(line.trim()); line = w.trimStart(); }
      else line = test;
    }
    if (line.trim()) lines.push(line.trim());
    const widths = lines.map(l => ctx.measureText(l.replace(/\|/g, '')).width);
    return { lines, widths, size, w: Math.max(1, ...widths), h: lines.length * size * o.lineHeight };
  }

  function redraw(str) {
    const L = layout(str);
    const padX = o.bg?.padX ?? 0, padY = o.bg?.padY ?? 0, sw = o.stroke?.width ?? 0, blur = o.shadow?.blur ?? 0;
    const margin = Math.ceil(sw + blur + 4);
    const W = Math.ceil(L.w + 2 * (padX + margin)), H = Math.ceil(L.h + 2 * (padY + margin));
    resizeCanvas(cv, tex, W * o.pixelRatio, H * o.pixelRatio);
    ctx.setTransform(o.pixelRatio, 0, 0, o.pixelRatio, 0, 0); ctx.clearRect(0, 0, W, H);
    if (o.bg) { ctx.fillStyle = o.bg.color; roundRect(ctx, margin, margin, W - 2 * margin, H - 2 * margin, o.bg.radius ?? 12); ctx.fill(); }
    ctx.font = o.font; ctx.letterSpacing = o.letterSpacing + 'px'; ctx.textBaseline = 'middle';
    L.lines.forEach((line, li) => {
      let x = o.align === 'left' ? margin + padX : o.align === 'right' ? W - margin - padX - L.widths[li] : (W - L.widths[li]) / 2;
      const y = margin + padY + (li + 0.5) * L.size * o.lineHeight;
      for (const part of parseRich(line)) {
        if (o.shadow) { ctx.shadowColor = o.shadow.color ?? 'rgba(0,0,0,.6)'; ctx.shadowBlur = blur; ctx.shadowOffsetY = o.shadow.y ?? 4; }
        if (o.stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = sw * 2; ctx.strokeStyle = o.stroke.color; ctx.strokeText(part.text, x, y); }
        ctx.fillStyle = part.accent ? o.accent : o.color; ctx.fillText(part.text, x, y);
        ctx.shadowColor = 'transparent';
        x += ctx.measureText(part.text).width;
      }
    });
    tex.needsUpdate = true;
    mesh.scale.set(W, H, 1);
    mesh.userData.width = W; mesh.userData.height = H;
  }
  redraw(text);
  mesh.userData.redraw = redraw;
  return mesh;
}

/**
 * Real 3D extruded text from a font file URL (.ttf/.otf/.woff; opentype.js can't read .woff2).
 * e.g. await makeText3D('HELLO', '../node_modules/@fontsource/inter/files/inter-latin-900-normal.woff', { size: 1 })
 * Returns a centred Mesh. Pass material as [face, side] for two-tone extrusions. Fonts are parsed once and cached.
 */
const fontCache = new Map();
export async function makeText3D(text, fontUrl, { size = 1, depth = 0.25, bevel = 0.02, curveSegments = 8, letterSpacing = 0, material } = {}) {
  if (!fontCache.has(fontUrl)) fontCache.set(fontUrl, (async () => {
    const { TTFLoader } = await import('three/addons/loaders/TTFLoader.js');
    const { FontLoader } = await import('three/addons/loaders/FontLoader.js');
    return new FontLoader().parse(await new TTFLoader().loadAsync(fontUrl));
  })());
  const font = await fontCache.get(fontUrl);
  const { TextGeometry } = await import('three/addons/geometries/TextGeometry.js');
  const geo = new TextGeometry(text, { font, size, depth, curveSegments, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.6, bevelSegments: 3 });
  geo.computeBoundingBox(); geo.center();
  return new THREE.Mesh(geo, material ?? new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.1 }));
}

/**
 * Karaoke captions: shows one chunk at a time with the current word highlighted.
 * chunks from chunkWords(); returns { mesh, update(t) }. Highlight leads the word by `lead` seconds (perceived sync).
 */
export function makeCaptions(chunks, opts = {}) {
  const o = { font: '800 64px Inter', color: '#fff', hiColor: '#111', hiBg: '#FFD60A', lead: 0.03, stroke: { color: 'rgba(0,0,0,.85)', width: 6 }, popIn: 0.12, ...opts };
  const cv = document.createElement('canvas'); const ctx = cv.getContext('2d');
  const tex = canvasTexture(cv);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }));
  let lastKey = '';
  const wordOf = w => (w.word ?? w.text).trim();
  function draw(chunk, hi) {
    const PR = 2, size = parseFloat(o.font.match(/(\d+)px/)[1]), padX = size * 0.28, padY = size * 0.16, gap = size * 0.28;
    ctx.font = o.font;
    const ws = chunk.words.map(w => ctx.measureText(wordOf(w)).width);
    const W = Math.ceil(ws.reduce((a, b) => a + b, 0) + gap * (ws.length - 1) + padX * 2 + 24), H = Math.ceil(size * 1.5 + 24);
    resizeCanvas(cv, tex, W * PR, H * PR); ctx.clearRect(0, 0, cv.width, cv.height); ctx.setTransform(PR, 0, 0, PR, 0, 0); ctx.font = o.font; ctx.textBaseline = 'middle';
    let x = 12 + padX; const y = H / 2;
    chunk.words.forEach((w, i) => {
      if (i === hi) { ctx.fillStyle = o.hiBg; roundRect(ctx, x - padX * 0.6, y - size * 0.5 - padY, ws[i] + padX * 1.2, size + padY * 2, size * 0.2); ctx.fill(); }
      if (o.stroke && i !== hi) { ctx.lineJoin = 'round'; ctx.lineWidth = o.stroke.width * 2; ctx.strokeStyle = o.stroke.color; ctx.strokeText(wordOf(w), x, y); }
      ctx.fillStyle = i === hi ? o.hiColor : o.color; ctx.fillText(wordOf(w), x, y);
      x += ws[i] + gap;
    });
    tex.needsUpdate = true; mesh.scale.set(W, H, 1);
  }
  function update(t) {
    const ci = chunks.findIndex((c, i) => t + o.lead >= c.start && t + o.lead < (chunks[i + 1]?.start ?? c.end + 0.4));
    if (ci < 0) { mesh.visible = false; return; }
    const c = chunks[ci]; mesh.visible = true;
    let hi = -1; c.words.forEach((w, i) => { if (t + o.lead >= w.start) hi = i; });
    const key = ci + ':' + hi; if (key !== lastKey) { draw(c, hi); lastKey = key; }
    const k = Math.min(1, (t - c.start + o.lead) / o.popIn);
    mesh.material.opacity = Math.min(1, k * 1.5); mesh.userData.pop = 0.9 + 0.1 * Math.min(1, k);
  }
  return { mesh, update };
}
