# Recipe: beat-synced pieces

Music drives the cuts and hits.

## Get beats as cues

With Python (librosa):

```python
import librosa, json
y, sr = librosa.load('assets/track.mp3', sr=None, mono=True)
tempo, beats = librosa.beat.beat_track(y=y, sr=sr, units='time')
onsets = librosa.onset.onset_detect(y=y, sr=sr, units='time', backtrack=True)
env = librosa.onset.onset_strength(y=y, sr=sr); times = librosa.times_like(env, sr=sr)
json.dump({'tempo': float(tempo), 'beats': [float(b) for b in beats], 'onsets': [float(o) for o in onsets],
           'energy': {'t': times[::4].tolist(), 'v': (env[::4] / env.max()).tolist()}}, open('assets/beats.json', 'w'))
```

No librosa? `ffmpeg -i track.mp3 -af "silencedetect=n=-30dB:d=0.1" -f null -` gives rough hit points. If you know
the tempo, compute the beat grid: `t = offset + i * 60 / bpm`.

## Use them

- `const beats = data.beats.map(t => ({ t }))`, then `activeIndex(beats, t)` gives the current beat. `t - beats[i].t`
  is the time since the hit, so `Math.exp(-8 * (t - beats[i].t))` is a decaying pulse for scale, light intensity,
  bloom `amount` or camera shake.
- Use energy for continuous motion: interpolate `energy.v` at `t` (binary search on `energy.t`) and map it to
  particle speed or emission.
- Make scene changes on downbeats (every 4th beat, or on big onsets). Make small accents on off-beats.
- Lead visual hits by about 1 frame (33 ms at 30 fps). Light reaches the eye's sense of sync slightly before
  sound does.
- Set `VIDEO.audio` to the track so `render.mjs` muxes it. Trim with `--from/--to` for previews; audio is only
  muxed for renders that start at 0.
