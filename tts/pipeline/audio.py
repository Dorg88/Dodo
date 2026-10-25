"""Audio helpers: WAV I/O, silence trimming, loudness, assembly, MP3."""

import subprocess
import wave

import numpy as np
from scipy.signal import resample_poly

SR = 24000  # Gemini TTS native rate; everything is assembled at this rate


def write_wav(path, pcm, sr=SR):
    data = (np.clip(pcm, -1, 1) * 32767).astype("<i2").tobytes()
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(data)


def read_wav(path):
    with wave.open(path) as w:
        sr, ch, width = w.getframerate(), w.getnchannels(), w.getsampwidth()
        raw = w.readframes(w.getnframes())
    if width != 2:
        raise ValueError(f"{path}: expected 16-bit PCM")
    pcm = np.frombuffer(raw, dtype="<i2").astype(np.float64) / 32768.0
    if ch > 1:
        pcm = pcm.reshape(-1, ch).mean(axis=1)
    return pcm, sr


def to_rate(pcm, sr, target=SR):
    if sr == target:
        return pcm
    g = np.gcd(sr, target)
    return resample_poly(pcm, target // g, sr // g)


def _frame_db(pcm, sr, frame_ms=20):
    f = max(1, int(sr * frame_ms / 1000))
    n = len(pcm) // f
    if n == 0:
        return np.array([-120.0]), f
    rms = np.sqrt((pcm[: n * f].reshape(n, f) ** 2).mean(axis=1) + 1e-12)
    return 20 * np.log10(rms), f


def trim_silence(pcm, sr, keep_ms=90, threshold_db=-45):
    db, f = _frame_db(pcm, sr)
    voiced = np.where(db > threshold_db)[0]
    if len(voiced) == 0:
        return pcm[:0]
    keep = int(sr * keep_ms / 1000)
    start = max(0, voiced[0] * f - keep)
    end = min(len(pcm), (voiced[-1] + 1) * f + keep)
    return pcm[start:end]


def speech_rms_db(pcm, sr):
    db, _ = _frame_db(pcm, sr, 30)
    active = db[db > -45]
    if len(active) == 0:
        return -120.0
    return float(20 * np.log10(np.sqrt(np.mean((10 ** (active / 20)) ** 2))))


def normalize(pcm, sr, target_db=-20.0, ceiling_db=-1.0):
    level = speech_rms_db(pcm, sr)
    if level <= -100:
        return pcm
    out = pcm * 10 ** ((target_db - level) / 20)
    peak = np.max(np.abs(out)) + 1e-12
    ceiling = 10 ** (ceiling_db / 20)
    if peak > ceiling:
        out *= ceiling / peak
    return out


def fade(pcm, sr, ms=10):
    n = min(int(sr * ms / 1000), len(pcm) // 2)
    if n:
        pcm = pcm.copy()
        pcm[:n] *= np.linspace(0, 1, n)
        pcm[-n:] *= np.linspace(1, 0, n)
    return pcm


def silence(ms, sr=SR):
    return np.zeros(int(sr * ms / 1000))


def export_mp3(wav_path, mp3_path, bitrate="96k"):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", wav_path, "-codec:a", "libmp3lame", "-b:a", bitrate,
                    mp3_path], check=True)


def duration_ms(pcm, sr=SR):
    return int(round(len(pcm) * 1000 / sr))
