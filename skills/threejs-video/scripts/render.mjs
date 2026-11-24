// Deterministic multi-worker renderer for a Three.js page that defines window.seek(t).
//
//   node render.mjs video   [--out final.mp4] [--workers 4] [--from 0 --to 6] [--audio path] [--alpha] [--crf 16]
//   node render.mjs stills  1.5,3,4.2 [--dir frames]
//   node render.mjs check                      # loads the page, prints window.VIDEO, renders t=0, reports errors
//
// Options for all modes: --page src/index.html  --root .  (the static server root; set it higher if the page
// loads assets from outside the project, e.g. --root ..)  --w/--h/--fps/--duration override window.VIDEO.
// Env: CHROME=/path/to/chrome-headless-shell to pin a browser build.
//
// How it works: a tiny static HTTP server (ES modules don't load over file://), N headless Chrome instances,
// each rendering a contiguous slice of frames into its own H.264 segment, then a lossless concat and audio mux.
// Because seek(t) is a pure function of t, slices can render in parallel and in any order.
import puppeteer from 'puppeteer-core';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const mode = args[0] || 'video';
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const flag = k => args.includes('--' + k);
const CWD = process.cwd();
const ROOT = path.resolve(opt('root', CWD));
const PAGE = path.resolve(CWD, opt('page', 'src/index.html'));
if (!PAGE.startsWith(ROOT)) { console.error(`--page ${PAGE} is outside --root ${ROOT}`); process.exit(1); }

function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const base = path.join(os.homedir(), '.cache/puppeteer');
  for (const kind of ['chrome-headless-shell', 'chrome']) {
    const dir = path.join(base, kind); if (!fs.existsSync(dir)) continue;
    const vers = fs.readdirSync(dir).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    for (const v of vers) {
      const cands = [
        `${kind}-mac-arm64/chrome-headless-shell`, `${kind}-mac-x64/chrome-headless-shell`, `${kind}-linux64/chrome-headless-shell`,
        'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
        'chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing', 'chrome-linux64/chrome',
      ];
      for (const c of cands) { const p = path.join(dir, v, c); if (fs.existsSync(p)) return p; }
    }
  }
  console.error('No Chrome found. Install one into ~/.cache/puppeteer with:\n  npx @puppeteer/browsers install chrome-headless-shell@stable --path ~/.cache/puppeteer\nor set CHROME=/path/to/chrome.');
  process.exit(1);
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff': 'font/woff',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.hdr': 'application/octet-stream',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ktx2': 'image/ktx2', '.bin': 'application/octet-stream' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(p, (err, data) => {
    if (err) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p).toLowerCase()] || 'application/octet-stream' }); res.end(data);
  });
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const URL_ = `http://127.0.0.1:${server.address().port}/${path.relative(ROOT, PAGE).split(path.sep).join('/')}`;
const CHROME = findChrome();

const errors = [];
async function openPage(tag, alpha) {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true,
    args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--hide-scrollbars', '--mute-audio'] });
  const page = await browser.newPage();
  page.on('console', m => { if (['error', 'warn'].includes(m.type()) || tag === 0) console.log(`[page${tag}] ${m.text()}`); });
  page.on('pageerror', e => { errors.push(e.message); console.error(`[page${tag} error] ${e.message}`); });
  page.on('requestfailed', r => console.error(`[page${tag}] failed: ${r.url()}`));
  page.on('response', r => { if (r.status() >= 400) { errors.push(`${r.status()} ${r.url()}`); console.error(`[page${tag}] ${r.status()} ${r.url()}`); } });
  await page.setViewport({ width: 800, height: 800, deviceScaleFactor: 1 });
  await page.goto(URL_, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction('typeof window.seek === "function"', { timeout: 120000 });
  await page.evaluate(async () => { if (window.ready) await window.ready; });
  const cfg = await page.evaluate(() => window.VIDEO || {});
  const V = { width: +opt('w', cfg.width || 1080), height: +opt('h', cfg.height || 1920), fps: +opt('fps', cfg.fps || 30),
    duration: +opt('duration', cfg.duration || 5), audio: opt('audio', cfg.audio || null) };
  await page.setViewport({ width: V.width, height: V.height, deviceScaleFactor: 1 });
  if (alpha) await page.evaluate(() => { document.documentElement.style.background = 'transparent'; document.body.style.background = 'transparent'; });
  const grab = async t => {
    await page.evaluate(async t => { await window.seek(t); }, t);
    return page.screenshot({ type: alpha ? 'png' : 'jpeg', ...(alpha ? {} : { quality: 95 }), omitBackground: !!alpha,
      clip: { x: 0, y: 0, width: V.width, height: V.height }, captureBeyondViewport: false });
  };
  return { browser, page, V, grab };
}

const t0 = Date.now();
const secs = () => ((Date.now() - t0) / 1000).toFixed(1);

if (mode === 'check') {
  const { browser, V, grab, page } = await openPage(0, false);
  console.log('VIDEO', V);
  const buf = await grab(0); fs.mkdirSync('out', { recursive: true }); fs.writeFileSync('out/check_t0.jpg', buf);
  const ms = []; for (const t of [0, V.duration / 2, V.duration * 0.9]) { const s = Date.now(); await grab(t); ms.push(Date.now() - s); }
  const est = (ms.reduce((a, b) => a + b) / ms.length) * V.fps * V.duration / 1000;
  console.log(`frame ~${Math.round(ms.reduce((a, b) => a + b) / ms.length)} ms -> ~${est.toFixed(0)} s single-worker for ${Math.round(V.fps * V.duration)} frames`);
  console.log(errors.length ? `ERRORS: ${errors.length}` : 'no page errors', '| wrote out/check_t0.jpg');
  await browser.close(); server.close(); process.exit(errors.length ? 1 : 0);
}

if (mode === 'stills') {
  const times = (args[1] && !args[1].startsWith('--') ? args[1] : '0').split(',').map(Number);
  const dir = path.resolve(opt('dir', 'frames')); fs.mkdirSync(dir, { recursive: true });
  const { browser, V, grab } = await openPage(0, flag('alpha'));
  for (const t of times) {
    const f = Math.round(t * V.fps);
    fs.writeFileSync(path.join(dir, `t${t.toFixed(2)}_f${String(f).padStart(5, '0')}.${flag('alpha') ? 'png' : 'jpg'}`), await grab(f / V.fps));
  }
  console.log(`wrote ${times.length} stills to ${dir} in ${secs()}s`);
  await browser.close(); server.close(); process.exit(errors.length ? 1 : 0);
}

// ---------- video ----------
const alpha = flag('alpha');
const probe = await openPage(0, alpha);
const V = probe.V;
const N = Math.round(V.fps * V.duration);
const from = Math.round(+opt('from', 0) * V.fps), to = Math.min(N, Math.round(+opt('to', V.duration) * V.fps));
const workers = Math.max(1, Math.min(+opt('workers', Math.max(1, Math.min(6, Math.floor(os.cpus().length / 3)))), to - from));
const out = path.resolve(opt('out', alpha ? 'final.mov' : 'final.mp4'));
const tmp = path.resolve('out/segments'); fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp, { recursive: true });
const crf = opt('crf', '16');
console.log(`rendering frames ${from}-${to - 1} of ${N} (${V.width}x${V.height} @${V.fps}) on ${workers} workers -> ${out}`);

const encArgs = alpha
  ? ['-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le']
  : ['-vf', 'scale=in_range=pc:out_range=tv,format=yuv420p', '-c:v', 'libx264', '-crf', crf, '-preset', 'medium', '-pix_fmt', 'yuv420p', '-color_range', 'tv', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709'];
const ext = alpha ? 'mov' : 'mp4';
const per = Math.ceil((to - from) / workers);
let done = 0;
const progress = setInterval(() => console.log(`  ${done}/${to - from} frames, ${secs()}s, ${(done / ((Date.now() - t0) / 1000)).toFixed(1)} fps`), 10000);

async function runSlice(w) {
  const a = from + w * per, b = Math.min(to, a + per); if (a >= b) return null;
  const ctx = w === 0 ? probe : await openPage(w, alpha);
  const seg = path.join(tmp, `seg${String(w).padStart(2, '0')}.${ext}`);
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(V.fps), '-c:v', alpha ? 'png' : 'mjpeg', '-i', '-',
    ...encArgs, '-r', String(V.fps), seg], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let i = a; i < b; i++) {
    const buf = await ctx.grab(i / V.fps);
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    done++;
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r));
  await ctx.browser.close();
  return seg;
}
const segs = (await Promise.all(Array.from({ length: workers }, (_, w) => runSlice(w)))).filter(Boolean);
clearInterval(progress);

const list = path.join(tmp, 'list.txt'); fs.writeFileSync(list, segs.map(s => `file '${s}'`).join('\n'));
const joined = path.join(tmp, `joined.${ext}`);
let r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', joined], { stdio: 'inherit' });
if (r.status) { console.error('concat failed'); process.exit(1); }
const audio = V.audio ? path.resolve(path.dirname(PAGE), V.audio) : null;
if (audio && fs.existsSync(audio) && from === 0) {
  r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', joined, '-i', audio, '-map', '0:v', '-map', '1:a', '-c:v', 'copy',
    '-c:a', alpha ? 'pcm_s16le' : 'aac', '-b:a', '192k', '-t', String((to - from) / V.fps), '-movflags', '+faststart', out], { stdio: 'inherit' });
} else {
  if (V.audio && !fs.existsSync(audio)) console.error(`audio not found: ${audio} (rendering silent)`);
  r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', joined, '-c', 'copy', '-movflags', '+faststart', out], { stdio: 'inherit' });
}
server.close();
console.log(`${r.status ? 'FAILED' : 'wrote'} ${out}: ${to - from} frames in ${secs()}s (${((to - from) / ((Date.now() - t0) / 1000)).toFixed(1)} fps)${errors.length ? `, ${errors.length} page errors` : ''}`);
process.exit(r.status || (errors.length ? 1 : 0));
