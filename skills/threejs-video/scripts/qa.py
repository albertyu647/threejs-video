#!/usr/bin/env python3
"""Check a rendered video before calling it done.

  python3 qa.py final.mp4                       # specs + contact sheet (12 frames)
  python3 qa.py final.mp4 --cues cues.json      # + one frame AT each cue and one 120 ms BEFORE it
  python3 qa.py final.mp4 --expect 1080x1920@30 --duration 6

cues.json: a list of {"t": 1.2, "label": "logo hits"} or {"start": .., "word": ..}, or {"words": [...]} (words.json).
Writes out/qa/contact.jpg and out/qa/cues.jpg. Look at them: is each thing on screen at its cue, and not before?
Exit code 1 if specs don't match --expect/--duration, the audio is silent, or frames are black.
Needs ffmpeg/ffprobe; Pillow for labels (falls back to unlabeled ffmpeg tiles without it).
"""
import argparse, json, os, subprocess, sys
from io import BytesIO

ap = argparse.ArgumentParser()
ap.add_argument('video'); ap.add_argument('--cues'); ap.add_argument('--n', type=int, default=12)
ap.add_argument('--expect'); ap.add_argument('--duration', type=float); ap.add_argument('--out', default='out/qa')
ap.add_argument('--max-cues', type=int, default=24)
a = ap.parse_args()
os.makedirs(a.out, exist_ok=True)
problems = []

def probe(v):
    j = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', v], capture_output=True, text=True).stdout)
    vs = next(s for s in j['streams'] if s['codec_type'] == 'video'); au = next((s for s in j['streams'] if s['codec_type'] == 'audio'), None)
    num, den = map(int, vs['r_frame_rate'].split('/'))
    return dict(w=vs['width'], h=vs['height'], fps=num / den, pix=vs.get('pix_fmt'), codec=vs['codec_name'], dur=float(j['format']['duration']), audio=au is not None)

s = probe(a.video)
print(f"{a.video}: {s['w']}x{s['h']} @{s['fps']:.3f} {s['codec']} {s['pix']} {s['dur']:.3f}s audio={'yes' if s['audio'] else 'no'}")
if s['codec'] == 'h264' and s['pix'] != 'yuv420p': problems.append(f"pix_fmt {s['pix']} (use yuv420p: QuickTime/phones may not play it)")
if a.expect:
    wh, fps = a.expect.split('@') if '@' in a.expect else (a.expect, None)
    w, h = map(int, wh.split('x'))
    if (s['w'], s['h']) != (w, h): problems.append(f"size {s['w']}x{s['h']} != {w}x{h}")
    if fps and abs(s['fps'] - float(fps)) > 0.01: problems.append(f"fps {s['fps']} != {fps}")
if a.duration and abs(s['dur'] - a.duration) > 0.1: problems.append(f"duration {s['dur']:.2f} != {a.duration}")
if s['audio']:
    r = subprocess.run(['ffmpeg', '-v', 'info', '-i', a.video, '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr
    try:
        lufs = float(r.rsplit('I:', 1)[1].split('LUFS')[0]); print(f'loudness {lufs:.1f} LUFS (social media target about -14)')
        if lufs < -50: problems.append('audio is silent')
    except Exception: pass

def grab(t, w=360):
    t = max(0, min(t, s['dur'] - 1 / s['fps']))
    for tt in (t, t - 0.1, t - 0.3):  # seeking right at the end can return nothing
        b = subprocess.run(['ffmpeg', '-v', 'error', '-ss', f'{max(0, tt):.3f}', '-i', a.video, '-frames:v', '1', '-vf', f'scale={w}:-2',
                            '-f', 'image2pipe', '-vcodec', 'png', '-'], capture_output=True).stdout
        if b: return b
    raise RuntimeError(f'could not grab a frame at {t:.2f}s')

try:
    from PIL import Image, ImageDraw, ImageFont, ImageStat
    try: font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 20)
    except Exception: font = ImageFont.load_default()
    def tile(t, label, w=360):
        im = Image.open(BytesIO(grab(t, w))).convert('RGB')
        out = Image.new('RGB', (im.width, im.height + 28), (20, 20, 20)); out.paste(im, (0, 28))
        ImageDraw.Draw(out).text((6, 3), label[:40], fill=(255, 220, 0), font=font); return out, im
    def sheet(tiles, cols, path):
        rows = (len(tiles) + cols - 1) // cols; W, H = tiles[0].width, tiles[0].height
        sh = Image.new('RGB', (W * cols, H * rows), (0, 0, 0))
        for i, t in enumerate(tiles): sh.paste(t, ((i % cols) * W, (i // cols) * H))
        sh.save(path, quality=85); print('wrote', path)
    times = [(i + 0.5) * s['dur'] / a.n for i in range(a.n)]
    tiles, black = [], 0
    for t in times:
        tl, im = tile(t, f'{t:.2f}s', 270); tiles.append(tl)
        if max(ImageStat.Stat(im).extrema[0][1], ImageStat.Stat(im.convert('L')).mean[0]) < 8: black += 1
    sheet(tiles, 6, f'{a.out}/contact.jpg')
    if black == len(times): problems.append('every sampled frame is black')
    if a.cues:
        c = json.load(open(a.cues)); c = c.get('words', c.get('cues', c)) if isinstance(c, dict) else c
        c = [x for x in c if isinstance(x, dict) and 0 <= x.get('t', x.get('start', -1)) < s['dur']]
        step = max(1, len(c) // a.max_cues); pick = c[::step][:a.max_cues]
        tiles = []
        for x in pick:
            t = x.get('t', x.get('start')); lab = str(x.get('label', x.get('word', x.get('text', ''))))
            tiles += [tile(t - 0.12, f'-120ms {lab}')[0], tile(t + min(0.08, (x.get('end', t + .16) - t) / 2), f'AT {lab} {t:.2f}')[0]]
        sheet(tiles, 6, f'{a.out}/cues.jpg')
except ImportError:
    print('Pillow not installed: writing an unlabeled contact sheet with ffmpeg')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', a.video, '-vf', f"fps={a.n}/{s['dur']},scale=270:-2,tile=6x{(a.n + 5) // 6}", '-frames:v', '1', f'{a.out}/contact.jpg'])

if problems:
    print('PROBLEMS:'); [print(' -', p) for p in problems]; sys.exit(1)
print('specs ok. Now look at the sheets.')
