#!/usr/bin/env python3
"""Synthesise the game's original instrumental music (maqam Hijaz on D).

Instruments are generated from scratch, no samples:
  - oud / qanun: Karplus-Strong plucked strings (qanun plays tremolo on long notes)
  - daf: frame drum (dum = low thump, tak = slap, plus soft jingles)
  - pad: a soft sustained drone on D and A

Outputs (stereo, seamless loops) into game/audio/:
  menu.ogg/.mp3  calm theme for menus        (84 BPM, 16 bars)
  game.ogg/.mp3  lively theme while playing  (104 BPM, 16 bars, maqsum rhythm)
  win.ogg/.mp3   short victory jingle

Run:  python3 tools/make-music.py        (needs numpy and ffmpeg)
To use your own recordings instead, just replace the files in game/audio/ with the same names.
"""
import os
import subprocess
import numpy as np

SR = 44100
ROOT = os.path.join(os.path.dirname(__file__), '..', 'audio')
rng = np.random.default_rng(7)

# Hijaz on D: D Eb F# G A Bb C (semitones from D)
HIJAZ = [0, 1, 4, 5, 7, 8, 10]
D3 = 146.83


def freq(degree, octave=0):
    o, d = divmod(degree, 7)
    return D3 * 2 ** ((HIJAZ[d] + 12 * (o + octave)) / 12)


# ---------- instruments ----------
_pluck_cache = {}


def pluck(f, dur, bright=0.5, decay=0.996):
    """Karplus-Strong plucked string, computed block-wise with numpy."""
    key = (round(f, 2), round(dur, 3), bright, decay)
    if key in _pluck_cache:
        return _pluck_cache[key]
    n = int(SR * dur)
    period = max(2, int(round(SR / f)))
    buf = rng.uniform(-1, 1, period + 1)
    # soften the excitation for a warmer (oud-like) tone
    for _ in range(int((1 - bright) * 6)):
        buf = 0.5 * (buf + np.roll(buf, 1))
    out = np.zeros(n + period + 2)
    out[:period + 1] = buf
    i = period + 1
    while i < n:  # y[n] = decay * (y[n-N-1] + y[n-N]) / 2, one delay-line block at a time
        j = min(i + period, n)
        prev = out[i - period - 1:j - period]
        out[i:j] = decay * 0.5 * (prev[:-1] + prev[1:])
        i = j
    out = out[:n]
    env = np.ones(n)
    rel = int(0.04 * SR)
    env[-rel:] = np.linspace(1, 0, rel)
    out *= env
    out /= max(1e-9, np.abs(out).max())
    _pluck_cache[key] = out
    return out


def dum(dur=0.45):
    t = np.arange(int(SR * dur)) / SR
    f = 95 * np.exp(-t * 9) + 52
    phase = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(phase) * np.exp(-t * 7)
    s += 0.15 * rng.uniform(-1, 1, len(t)) * np.exp(-t * 60)
    return s / np.abs(s).max()


def tak(dur=0.18, tone=2600):
    n = int(SR * dur)
    t = np.arange(n) / SR
    noise = rng.uniform(-1, 1, n)
    spec = np.fft.rfft(noise)
    fr = np.fft.rfftfreq(n, 1 / SR)
    spec *= np.exp(-((fr - tone) / 1400) ** 2)
    s = np.fft.irfft(spec, n) * np.exp(-t * 38)
    s += 0.35 * np.sin(2 * np.pi * 330 * t) * np.exp(-t * 45)
    return s / np.abs(s).max()


def jingle(dur=0.35):
    t = np.arange(int(SR * dur)) / SR
    s = sum(np.sin(2 * np.pi * f * t + rng.uniform(0, 6)) for f in (5200, 6100, 7350, 8400))
    s = s * np.exp(-t * 14) * (0.6 + 0.4 * np.sin(2 * np.pi * 31 * t))
    return s / np.abs(s).max()


def pad(f, dur):
    t = np.arange(int(SR * dur)) / SR
    lfo = 1 + 0.003 * np.sin(2 * np.pi * 0.25 * t)
    s = np.zeros_like(t)
    for k, a in ((1, 1), (2, 0.35), (3, 0.12)):
        s += a * (np.sin(2 * np.pi * f * k * lfo * t) + np.sin(2 * np.pi * f * k * 1.004 * t))
    att = np.minimum(1, t / 1.5)
    rel = np.minimum(1, (dur - t) / 1.5)
    return s * att * rel / np.abs(s).max()


# ---------- mixing ----------
class Mix:
    def __init__(self, seconds):
        self.L = np.zeros(int(SR * seconds) + SR * 4)
        self.R = np.zeros_like(self.L)

    def add(self, sig, at, gain=1.0, pan=0.0):
        i = int(at * SR)
        if i < 0:  # starts before the buffer: keep only the audible part
            sig, i = sig[-i:], 0
        if i >= len(self.L) or not len(sig):
            return
        sig = sig[: len(self.L) - i]
        lg = gain * np.sqrt((1 - pan) / 2)
        rg = gain * np.sqrt((1 + pan) / 2)
        self.L[i:i + len(sig)] += sig * lg
        self.R[i:i + len(sig)] += sig * rg


def reverb(x, seconds=1.8, wet=0.22):
    n = int(SR * seconds)
    t = np.arange(n) / SR
    ir = rng.uniform(-1, 1, n) * np.exp(-t * 3.2)
    ir[0] = 0
    size = 1 << int(np.ceil(np.log2(len(x) + n)))
    y = np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)[: len(x)]
    y /= max(1e-9, np.abs(y).max())
    return (1 - wet) * x / max(1e-9, np.abs(x).max()) + wet * y


def render(events, loop_seconds, name, loop=True):
    """events: callable(mix, offset) that writes one cycle starting at `offset` seconds."""
    cycles = 3 if loop else 1
    mix = Mix(loop_seconds * cycles)
    for c in range(cycles):
        events(mix, c * loop_seconds)
    L, R = reverb(mix.L), reverb(mix.R)
    if loop:  # take the middle cycle so the reverb tail wraps around seamlessly
        a, b = int(SR * loop_seconds), int(SR * loop_seconds * 2)
        L, R = L[a:b], R[a:b]
    else:
        end = int(SR * loop_seconds)
        L, R = L[:end], R[:end]
        fade = int(0.3 * SR)
        L[-fade:] *= np.linspace(1, 0, fade)
        R[-fade:] *= np.linspace(1, 0, fade)
    peak = max(np.abs(L).max(), np.abs(R).max())
    st = np.stack([L, R], axis=1) / peak * 0.85
    pcm = (st * 32767).astype('<i2').tobytes()
    os.makedirs(ROOT, exist_ok=True)
    for ext, args in (('ogg', ['-c:a', 'libvorbis', '-q:a', '3']), ('mp3', ['-c:a', 'libmp3lame', '-b:a', '112k'])):
        out = os.path.join(ROOT, f'{name}.{ext}')
        subprocess.run(
            ['ffmpeg', '-y', '-loglevel', 'error', '-f', 's16le', '-ar', str(SR), '-ac', '2', '-i', 'pipe:0', *args, out],
            input=pcm, check=True,
        )
        print(f'{out}  {os.path.getsize(out) // 1024} KB')


def play_phrases(mix, start, beat, phrases, octave, gain, pan, qanun=False):
    t = start
    for phrase in phrases:
        for degree, dur in phrase:
            seconds = dur * beat
            f = freq(degree, octave)
            if qanun and dur >= 1.5:
                # qanun tremolo: fast repeated plucks on long notes
                k, step = 0, beat / 4
                while k * step < seconds - step / 2:
                    mix.add(pluck(f, 0.5, bright=0.8, decay=0.994), t + k * step, gain * (0.55 if k else 0.8), pan)
                    k += 1
            else:
                mix.add(pluck(f, max(0.6, seconds + 0.4), bright=0.8 if qanun else 0.45), t, gain, pan)
            t += seconds


# ---------- menu theme ----------
MENU_A = [(4, 1), (5, .5), (4, .5), (3, 1), (2, 1), (1, 1), (2, 1), (0, 2)]
MENU_B = [(4, 1), (7, 1), (6, .5), (5, .5), (4, 1), (5, 1), (4, .5), (3, .5), (2, 1), (4, 1)]
MENU_C = [(7, 1.5), (8, .5), (9, 1), (8, 1), (7, 1), (6, 1), (5, 1), (4, 1)]
MENU_D = [(3, 1), (2, .5), (1, .5), (2, 1), (3, 1), (2, 1), (1, 1), (0, 2)]


def menu_events(mix, off):
    beat = 60 / 84
    bars = 16
    phrases = [MENU_A, MENU_B, MENU_C, MENU_D] * 2
    play_phrases(mix, off, beat, phrases, 1, 0.55, -0.3)                      # oud melody
    play_phrases(mix, off + beat * 32, beat, phrases[4:], 2, 0.28, 0.4, True)  # qanun answers in 2nd half
    for bar in range(bars):
        t = off + bar * 4 * beat
        root = 0 if bar % 4 != 2 else 3
        mix.add(pluck(freq(root, -1), 2.2, bright=0.3), t, 0.45, -0.1)       # oud bass
        mix.add(pluck(freq(4, -1), 1.6, bright=0.3), t + 2 * beat, 0.3, -0.1)
        mix.add(dum(), t, 0.35, 0)                                              # gentle daf
        mix.add(tak(), t + 2 * beat, 0.12, 0.2)
        mix.add(tak(), t + 3.5 * beat, 0.08, 0.2)
        if bar % 2:
            mix.add(jingle(), t + 2 * beat, 0.05, 0.5)
    for k in range(4):                                                          # drone pad
        mix.add(pad(D3 / 2, 16 * beat + 1.5), off + k * 16 * beat - 0.75, 0.12, 0)
        mix.add(pad(freq(4, -1), 16 * beat + 1.5), off + k * 16 * beat - 0.75, 0.06, 0)


# ---------- game theme (maqsum rhythm) ----------
GAME_1 = [(0, .5), (1, .5), (2, .5), (3, .5), (4, 1), (4, .5), (5, .5), (4, .5), (3, .5), (2, .5), (1, .5), (2, 1), (0, 1)]
GAME_2 = [(4, .5), (5, .5), (4, .5), (3, .5), (4, 1), (7, 1), (6, .5), (5, .5), (4, .5), (3, .5), (4, 2)]
GAME_3 = [(7, .5), (8, .5), (9, .5), (8, .5), (7, 1), (6, 1), (5, .5), (6, .5), (5, .5), (4, .5), (3, 1), (4, 1)]
GAME_4 = [(2, .5), (3, .5), (4, .5), (3, .5), (2, .5), (1, .5), (0, 1), (1, .5), (2, .5), (1, .5), (0, .5), (0, 2)]
MAQSUM = [('D', 0), ('T', .5), ('T', 1.5), ('D', 2), ('T', 3)]


def game_events(mix, off):
    beat = 60 / 104
    phrases = [GAME_1, GAME_2, GAME_3, GAME_4] * 2
    play_phrases(mix, off, beat, phrases[:4], 1, 0.5, -0.3)                   # oud states the theme
    play_phrases(mix, off + beat * 32, beat, phrases[4:], 2, 0.34, 0.35, True)  # qanun takes it up
    play_phrases(mix, off + beat * 32, beat, phrases[4:], 1, 0.22, -0.3)
    for bar in range(16):
        t = off + bar * 4 * beat
        for kind, b in MAQSUM:
            if kind == 'D':
                mix.add(dum(), t + b * beat, 0.5, 0)
            else:
                mix.add(tak(), t + b * beat, 0.22, 0.25)
        mix.add(tak(tone=3400), t + 3.5 * beat, 0.1, -0.25)
        mix.add(jingle(), t + 1 * beat, 0.05, 0.5)
        mix.add(jingle(), t + 3 * beat, 0.05, -0.5)
        root = [0, 0, 3, 4][bar % 4]
        for b in (0, 1.5, 2):                                                    # bass ostinato
            mix.add(pluck(freq(root, -1), 0.9, bright=0.35), t + b * beat, 0.4, -0.1)
    mix.add(pad(D3 / 2, 64 * beat + 1.5), off - 0.75, 0.08, 0)


# ---------- victory jingle ----------
def win_events(mix, off):
    beat = 60 / 132
    run = [0, 1, 2, 3, 4, 5, 6, 7]
    for i, d in enumerate(run):
        mix.add(pluck(freq(d, 1), 0.8, bright=0.8), off + i * beat / 4, 0.45, 0.3)
    t = off + 2 * beat
    for d in (0, 2, 4, 7):  # final rolled chord (D F# A D)
        mix.add(pluck(freq(d, 1), 2.4, bright=0.6), t, 0.4, -0.2)
        mix.add(pluck(freq(d, 2), 2.4, bright=0.8), t + 0.03, 0.25, 0.3)
        t += 0.05
    for k in range(6):
        mix.add(pluck(freq(7, 1), 0.4, bright=0.8), off + 2 * beat + 0.4 + k * beat / 4, 0.18, 0.4)
    for b in (0, 1, 1.5, 2):
        mix.add(dum() if b in (0, 2) else tak(), off + b * beat, 0.5, 0)
    mix.add(jingle(0.8), off + 2 * beat, 0.15, 0)


if __name__ == '__main__':
    render(menu_events, 64 * 60 / 84, 'menu')
    render(game_events, 64 * 60 / 104, 'game')
    render(win_events, 3.4, 'win', loop=False)
