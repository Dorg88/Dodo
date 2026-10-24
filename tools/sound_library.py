"""Procedural, fully original music cues and ambience for the storybook.

Every sound here is synthesised from scratch with numpy/scipy (Karplus-Strong
plucked strings, additive pads, a ney-like flute with quarter tones, filtered
noise ambiences). No third-party recordings are used, so the output carries no
licensing obligations. Each generator returns a float32 stereo array shaped
(n, 2) at SR.
"""

import numpy as np
from scipy import signal

SR = 44100


def _rng(seed):
    return np.random.default_rng(seed)


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12.0)


# --- building blocks -------------------------------------------------------

def butter(x, kind, freq, order=2):
    nyq = SR / 2
    if isinstance(freq, (tuple, list)):
        wn = [f / nyq for f in freq]
    else:
        wn = freq / nyq
    sos = signal.butter(order, wn, btype=kind, output="sos")
    return signal.sosfilt(sos, x, axis=0)


def env_adsr(n, a, d, s, r):
    e = np.ones(n) * s
    na, nd, nr = int(a * SR), int(d * SR), int(r * SR)
    na = min(na, n)
    e[:na] = np.linspace(0, 1, na, endpoint=False)
    nd = min(nd, n - na)
    e[na:na + nd] = np.linspace(1, s, nd, endpoint=False)
    if nr and nr < n:
        e[-nr:] *= np.linspace(1, 0, nr)
    return e


def pan(mono, p):
    """p in [-1, 1]; constant-power."""
    ang = (p + 1) * np.pi / 4
    return np.stack([mono * np.cos(ang), mono * np.sin(ang)], axis=1)


def reverb(x, rt60=2.6, wet=0.35, seed=1, predelay=0.02):
    """Stereo convolution reverb with a decorrelated exponential-noise IR."""
    rng = _rng(seed)
    n = int(rt60 * SR)
    t = np.arange(n) / SR
    decay = np.exp(-6.9 * t / rt60)
    irs = []
    for _ in range(2):
        ir = rng.standard_normal(n) * decay
        ir = butter(ir, "low", 6500)
        irs.append(ir)
    pd = int(predelay * SR)
    ir = np.stack(irs, axis=1)
    ir = np.vstack([np.zeros((pd, 2)), ir])
    ir /= np.sqrt((ir ** 2).sum(axis=0, keepdims=True))
    if x.ndim == 1:
        x = np.stack([x, x], axis=1)
    out = np.stack([signal.fftconvolve(x[:, c], ir[:, c])[: len(x)] for c in range(2)], axis=1)
    return (1 - wet) * x + wet * out * 0.9


def ks_pluck(freq, dur, decay=0.996, bright=0.6, seed=0):
    """Karplus-Strong plucked string (oud/qanun-like)."""
    rng = _rng(seed)
    n = int(dur * SR)
    p = max(2, int(round(SR / freq)))
    buf = rng.uniform(-1, 1, p)
    buf = butter(buf, "low", 800 + 6000 * bright, 1)
    out = np.zeros(n)
    idx = 0
    for i in range(n):
        out[i] = buf[idx]
        nxt = (idx + 1) % p
        buf[idx] = decay * 0.5 * (buf[idx] + buf[nxt])
        idx = nxt
    out *= env_adsr(n, 0.002, 0.0, 1.0, min(0.08, dur / 4))
    return out


def pad_voice(freqs, dur, cutoff=1400, detune=0.004, seed=0, attack=1.6, release=1.8):
    """Warm additive pad from detuned saw-like partials."""
    rng = _rng(seed)
    n = int(dur * SR)
    t = np.arange(n) / SR
    left = np.zeros(n)
    right = np.zeros(n)
    for f in freqs:
        for k, dt in enumerate((-detune, 0.0, detune)):
            ph = rng.uniform(0, 2 * np.pi)
            lfo = 1 + 0.0015 * np.sin(2 * np.pi * (0.13 + 0.05 * k) * t + ph)
            v = np.zeros(n)
            for h in range(1, 9):
                fh = f * (1 + dt) * h
                if fh > SR / 2.2:
                    break
                v += np.sin(2 * np.pi * fh * t * lfo + ph * h) / h
            if k == 0:
                left += v
            elif k == 2:
                right += v
            else:
                left += 0.7 * v
                right += 0.7 * v
    st = np.stack([left, right], axis=1)
    st = butter(st, "low", cutoff, 2)
    st *= env_adsr(n, attack, 0.5, 0.85, release)[:, None]
    return st / (len(freqs) * 3)


def ney(notes, seed=0, vib=5.2):
    """Breathy ney-like flute. notes: list of (freq, dur, amp)."""
    rng = _rng(seed)
    parts = []
    for f, d, a in notes:
        n = int(d * SR)
        t = np.arange(n) / SR
        vib_depth = np.clip(t / 0.6, 0, 1) * 0.006
        ph = 2 * np.pi * np.cumsum(f * (1 + vib_depth * np.sin(2 * np.pi * vib * t))) / SR
        tone = np.sin(ph) + 0.25 * np.sin(2 * ph) + 0.08 * np.sin(3 * ph)
        breath = butter(rng.standard_normal(n), "band", (max(f * 0.8, 120), min(f * 4, 9000)), 2)
        x = tone * 0.8 + breath * 0.18
        x *= env_adsr(n, min(0.25, d / 3), 0.2, 0.8, min(0.5, d / 3)) * a
        parts.append(x)
    return np.concatenate(parts) if parts else np.zeros(1)


def frame_drum(dur=0.6, f0=95, f1=48, seed=0):
    rng = _rng(seed)
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t * 18)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7)
    click = butter(rng.standard_normal(n), "band", (400, 2500), 2) * np.exp(-t * 90) * 0.15
    return body + click


def place(buf, x, start):
    """Mix mono or stereo x into stereo buf at sample offset start."""
    if x.ndim == 1:
        x = np.stack([x, x], axis=1)
    s = max(0, start)
    e = min(len(buf), start + len(x))
    if e > s:
        buf[s:e] += x[s - start:e - start]


def norm(x, peak=0.5):
    m = np.max(np.abs(x)) + 1e-9
    return x * (peak / m)


# --- music cues ------------------------------------------------------------
# D-based modes: Nahawand (minor), Hijaz, Bayati (E half-flat = 63.5)

def cue_nostalgic(dur, seed=11):
    """Gentle nostalgic opening: pad progression + slow plucked melody."""
    n = int(dur * SR)
    out = np.zeros((n, 2))
    chords = [(50, 53, 57), (46, 50, 53), (43, 46, 50), (45, 49, 52)]  # Dm Bb Gm A
    clen = 4.8
    t = 0.0
    i = 0
    while t < dur:
        c = chords[i % 4]
        place(out, pad_voice([midi(m - 12) for m in c] + [midi(c[0])], clen + 1.8, cutoff=1100, seed=seed + i,
                             attack=1.8, release=1.8) * 0.9, int(t * SR))
        t += clen
        i += 1
    melody = [(69, 1.2), (67, 0.6), (65, 0.6), (64, 1.2), (62, 2.4), (None, 0.6),
              (65, 0.6), (67, 0.6), (69, 1.2), (70, 1.2), (69, 2.4), (None, 0.6),
              (72, 0.6), (70, 0.6), (69, 1.2), (67, 0.6), (65, 0.6), (64, 1.2), (62, 3.0), (None, 1.2)]
    t = 1.4
    k = 0
    while t < dur - 1:
        m, d = melody[k % len(melody)]
        if m is not None:
            x = ks_pluck(midi(m), min(3.5, d + 2.0), decay=0.9975, bright=0.45, seed=seed + k)
            place(out, pan(x * 0.32, 0.25 * np.sin(k)), int(t * SR))
            if k % 3 == 0:
                place(out, pan(ks_pluck(midi(m - 12), 3.0, 0.997, 0.3, seed + 100 + k) * 0.12, -0.3), int(t * SR))
        t += d
        k += 1
    return norm(reverb(out, 3.0, 0.4, seed), 0.42)


def cue_suspense(dur, seed=21):
    """Soft suspense: low Hijaz drone, heartbeat frame drum, faint high tension."""
    n = int(dur * SR)
    out = np.zeros((n, 2))
    place(out, pad_voice([midi(38), midi(45), midi(50)], dur + 0.5, cutoff=700, seed=seed, attack=2.5,
                         release=2.0) * 1.1, 0)
    t = 0.8
    k = 0
    while t < dur - 0.6:
        place(out, pan(frame_drum(0.7, seed=seed + k) * 0.22, -0.1), int(t * SR))
        place(out, pan(frame_drum(0.6, 85, 46, seed + 50 + k) * 0.12, 0.1), int((t + 0.32) * SR))
        t += 1.45
        k += 1
    tt = np.arange(n) / SR
    hi = np.sin(2 * np.pi * midi(75) * tt) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.11 * tt - 1.5)) * 0.03
    hi *= np.clip(tt / 3, 0, 1)
    place(out, pan(hi, 0.4), 0)
    for j, m in enumerate((62, 63, 66, 63)):
        x = ks_pluck(midi(m), 3.0, 0.9972, 0.35, seed + 200 + j) * 0.16
        place(out, pan(x, -0.35 + 0.2 * j), int((1.6 + j * 2.9) * SR))
    return norm(reverb(out, 3.2, 0.42, seed), 0.38)


def cue_reverent(dur, seed=31):
    """Quiet reverent mosque ambience: airy high pad over a soft drone."""
    n = int(dur * SR)
    out = np.zeros((n, 2))
    place(out, pad_voice([midi(38), midi(50)], dur + 0.5, cutoff=500, seed=seed, attack=3.0) * 0.9, 0)
    place(out, pad_voice([midi(62), midi(69), midi(74)], dur + 0.5, cutoff=2600, detune=0.006, seed=seed + 1,
                         attack=3.5) * 0.35, 0)
    return norm(reverb(out, 4.5, 0.55, seed), 0.3)


def cue_warm(dur, seed=41):
    """Warm emotional swell after the successful prayer."""
    n = int(dur * SR)
    out = np.zeros((n, 2))
    chords = [(46, 50, 53, 57), (41, 45, 48, 53), (43, 46, 50, 55), (45, 48, 53, 57)]  # Bbmaj7 F Gm F/A
    clen = 4.2
    t = 0.0
    i = 0
    while t < dur:
        c = chords[i % 4]
        place(out, pad_voice([midi(m) for m in c], clen + 1.6, cutoff=1500 + 150 * (i % 4), seed=seed + i,
                             attack=1.5) * 0.85, int(t * SR))
        arp = [c[0] + 12, c[1] + 12, c[2] + 12, c[3] + 12, c[2] + 12, c[1] + 12]
        for j, m in enumerate(arp):
            x = ks_pluck(midi(m), 2.2, 0.9968, 0.55, seed + 10 * i + j) * 0.18
            place(out, pan(x, -0.4 + 0.16 * j), int((t + 0.15 + j * 0.7) * SR))
        t += clen
        i += 1
    tt = np.arange(n) / SR
    out *= (0.6 + 0.4 * np.clip(tt / max(dur * 0.6, 1), 0, 1))[:, None]
    return norm(reverb(out, 3.0, 0.38, seed), 0.42)


def cue_reflective(dur, seed=51):
    """Mysterious, reflective Bayati: ney phrases with quarter tones over a drone."""
    n = int(dur * SR)
    out = np.zeros((n, 2))
    place(out, pad_voice([midi(38), midi(45)], dur + 0.5, cutoff=600, seed=seed, attack=2.2) * 1.0, 0)
    Eb_half = midi(63.5)
    phrase = [(midi(62), 1.6, 0.5), (Eb_half, 0.9, 0.45), (midi(65), 1.2, 0.5), (midi(67), 2.2, 0.55),
              (midi(65), 0.8, 0.45), (Eb_half, 1.0, 0.45), (midi(62), 2.8, 0.5)]
    t = 1.2
    k = 0
    while t < dur - 2:
        x = ney(phrase, seed=seed + k)
        place(out, pan(x * 0.22, 0.15), int(t * SR))
        t += len(x) / SR + 2.0
        k += 1
    for j in range(int(dur // 3)):
        m = (62, 69, 65, 74, 67)[j % 5]
        place(out, pan(ks_pluck(midi(m), 3.0, 0.9975, 0.3, seed + 300 + j) * 0.1, -0.4 + 0.2 * (j % 5)),
              int((0.5 + j * 3.0) * SR))
    return norm(reverb(out, 4.0, 0.5, seed), 0.36)


def cue_ending(dur, seed=61):
    """Subtle cinematic ending: rising pad Dm-Bb-C-D with a final ney note."""
    n = int(dur * SR)
    out = np.zeros((n, 2))
    chords = [(38, 50, 53, 57), (34, 50, 53, 58), (36, 48, 52, 55), (38, 50, 54, 57)]
    seg = dur / 4
    for i, c in enumerate(chords):
        place(out, pad_voice([midi(m) for m in c], seg + 2.0, cutoff=1000 + 400 * i, seed=seed + i, attack=1.8,
                             release=2.0) * (0.7 + 0.12 * i), int(i * seg * SR))
        place(out, pan(ks_pluck(midi(c[1] + 12), 3.5, 0.9978, 0.5, seed + 20 + i) * 0.22, 0.2), int((i * seg + 0.3) * SR))
    last = max(0.0, dur - seg - 1.0)
    place(out, pan(ney([(midi(62), seg + 1.0, 0.5)], seed=seed) * 0.2, 0.1), int(last * SR))
    return norm(reverb(out, 4.0, 0.45, seed), 0.45)


# --- ambiences / sound effects --------------------------------------------

def fx_night(dur, seed=71):
    """Calm Ramadan night: distant crickets and a soft breeze."""
    rng = _rng(seed)
    n = int(dur * SR)
    t = np.arange(n) / SR
    wind = butter(np.cumsum(rng.standard_normal(n)) * 0.02, "band", (60, 500), 2)
    wind *= 0.6 + 0.4 * np.sin(2 * np.pi * 0.07 * t + 1.0)
    out = np.stack([wind, np.roll(wind, 900)], axis=1) * 1.2
    for c in range(3):
        f = rng.uniform(4300, 5200)
        p = rng.uniform(-0.8, 0.8)
        tc = rng.uniform(0, 0.8)
        while tc < dur:
            for k in range(3):
                m = int(0.018 * SR)
                tt = np.arange(m) / SR
                chirp = np.sin(2 * np.pi * f * tt) * np.hanning(m) * 0.05
                place(out, pan(chirp, p), int((tc + k * 0.032) * SR))
            tc += rng.uniform(0.55, 1.1)
    return reverb(out, 1.8, 0.3, seed)


def fx_footsteps(dur, seed=81):
    """Adult and child footsteps on an old stone alley with slapback echo."""
    rng = _rng(seed)
    n = int(dur * SR)
    out = np.zeros((n, 2))

    def step(heavy):
        m = int(0.12 * SR)
        tt = np.arange(m) / SR
        scuff = butter(rng.standard_normal(m), "band", (900, 3800) if not heavy else (600, 3000), 2)
        scuff *= np.exp(-tt * (55 if heavy else 70))
        thump = np.sin(2 * np.pi * (90 if heavy else 130) * tt) * np.exp(-tt * 40)
        return scuff * (0.5 if heavy else 0.35) + thump * (0.6 if heavy else 0.3)

    t = 0.05
    k = 0
    while t < dur:
        place(out, pan(step(True) * rng.uniform(0.8, 1.0), -0.15 if k % 2 else -0.05), int(t * SR))
        tc = t + 0.29
        place(out, pan(step(False) * rng.uniform(0.7, 0.9), 0.2 if k % 2 else 0.1), int(tc * SR))
        t += 0.6 + rng.uniform(-0.03, 0.03)
        k += 1
    d = int(0.075 * SR)
    echo = np.vstack([np.zeros((d, 2)), out[:-d]]) * 0.3
    return reverb(out + echo, 0.9, 0.2, seed) * 0.8


def fx_door(dur, seed=91):
    """Heavy wooden mosque door creaking open, then settling."""
    rng = _rng(seed)
    n = int(dur * SR)
    m = int(min(1.7, dur * 0.7) * SR)
    t = np.arange(m) / SR
    f = 38 + 22 * np.sin(np.pi * t / t[-1]) + rng.standard_normal(m).cumsum() * 0.02
    ph = 2 * np.pi * np.cumsum(f) / SR
    saw = (ph / (2 * np.pi)) % 1.0 - 0.5
    creak = butter(saw, "band", (500, 1500), 2) * 1.2 + butter(saw, "band", (1800, 2600), 2) * 0.4
    creak *= env_adsr(m, 0.15, 0.2, 0.8, 0.3)
    out = np.zeros((n, 2))
    place(out, pan(creak * 0.5, 0.1), 0)
    thud = frame_drum(0.5, 70, 40, seed) * 0.5
    place(out, pan(thud, 0.0), m - int(0.1 * SR))
    return reverb(out, 2.4, 0.45, seed)


def fx_roomtone(dur, seed=101):
    rng = _rng(seed)
    n = int(dur * SR)
    x = butter(rng.standard_normal((n, 2)), "low", 420, 2) * 0.05
    return reverb(x, 3.0, 0.5, seed)


def _babble(dur, voices, seed, level, rate=(3.5, 6.0)):
    rng = _rng(seed)
    n = int(dur * SR)
    out = np.zeros((n, 2))
    t = np.arange(n) / SR
    for v in range(voices):
        r = rng.uniform(*rate)
        sylls = (np.sin(2 * np.pi * r * t + rng.uniform(0, 6)) > 0.2).astype(float)
        phrase = (np.sin(2 * np.pi * rng.uniform(0.15, 0.35) * t + rng.uniform(0, 6)) > -0.2).astype(float)
        e = butter(sylls * phrase, "low", 12, 1)
        f1 = rng.uniform(350, 700)
        src = rng.standard_normal(n)
        voice = butter(src, "band", (f1 * 0.6, f1 * 1.6), 2) + 0.5 * butter(src, "band", (1400, 2600), 2)
        out += pan(voice * e * level, rng.uniform(-0.8, 0.8))
    return out


def fx_murmur(dur, seed=111):
    """Soft whispers of the congregation inside the mosque."""
    out = _babble(dur, 7, seed, 0.06)
    return reverb(butter(out, "high", 180, 2), 3.2, 0.6, seed)


def fx_crowd(dur, seed=121):
    """Warm, approving murmur of worshippers after the prayer."""
    out = _babble(dur, 12, seed, 0.08, rate=(4.0, 7.0))
    return reverb(butter(out, "high", 150, 2), 2.8, 0.5, seed)


def fx_rustle(dur, seed=131):
    """Soft cloth movement as worshippers straighten their rows."""
    rng = _rng(seed)
    n = int(dur * SR)
    out = np.zeros((n, 2))
    for k in range(int(dur * 4)):
        m = int(rng.uniform(0.15, 0.45) * SR)
        x = butter(rng.standard_normal(m), "band", (1800, 7000), 2) * np.hanning(m) * rng.uniform(0.02, 0.05)
        place(out, pan(x, rng.uniform(-0.9, 0.9)), int(rng.uniform(0, max(dur - 0.5, 0.1)) * SR))
    return reverb(out, 2.5, 0.45, seed)


MUSIC = {
    "nostalgic": cue_nostalgic,
    "suspense": cue_suspense,
    "reverent": cue_reverent,
    "warm": cue_warm,
    "reflective": cue_reflective,
    "ending": cue_ending,
}

SFX = {
    "night": fx_night,
    "footsteps": fx_footsteps,
    "door": fx_door,
    "roomtone": fx_roomtone,
    "murmur": fx_murmur,
    "crowd": fx_crowd,
    "rustle": fx_rustle,
}
