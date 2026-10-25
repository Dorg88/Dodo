"""Checks on each generated chunk: format, duration plausibility and, when a
local Whisper model is available, an Arabic transcript comparison that
catches missing words, mispronunciations and instructions read aloud."""

import difflib
import os
import re

import numpy as np

DIACRITICS = re.compile(r"[ؗ-ًؚ-ْٰۖ-ۭـ]")


def normalize_ar(text):
    text = DIACRITICS.sub("", text)
    text = re.sub("[إأآٱ]", "ا", text)
    text = text.replace("ى", "ي").replace("ة", "ه").replace("ؤ", "و").replace("ئ", "ي")
    text = re.sub(r"[^ء-ي0-9 ]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def similarity(expected, heard):
    a, b = normalize_ar(expected), normalize_ar(heard)
    if not a:
        return 1.0
    return difflib.SequenceMatcher(None, a.split(), b.split()).ratio()


def word_diff(expected, heard):
    missing, extra, _ = _diff(expected, heard)
    return missing, extra


def _diff(expected, heard):
    a, b = normalize_ar(expected).split(), normalize_ar(heard).split()
    missing, extra, longest_drop = [], [], 0
    for op, i1, i2, j1, j2 in difflib.SequenceMatcher(None, a, b).get_opcodes():
        if op in ("delete", "replace"):
            missing += a[i1:i2]
        if op == "delete":
            longest_drop = max(longest_drop, i2 - i1)
        if op in ("insert", "replace"):
            extra += b[j1:j2]
    return missing, extra, longest_drop


class Transcriber:
    """Lazy faster-whisper wrapper; disabled if the model or package is missing."""

    def __init__(self, model_dir):
        self.model_dir = model_dir
        self.model = None
        self.available = bool(model_dir) and os.path.isdir(model_dir)
        if self.available:
            try:
                import faster_whisper  # noqa: F401  (availability check)
            except ImportError:
                self.available = False

    def transcribe(self, pcm, sr):
        if not self.available:
            return None
        if self.model is None:
            from faster_whisper import WhisperModel
            self.model = WhisperModel(self.model_dir, device="cpu", compute_type="int8")
        from scipy.signal import resample_poly
        audio = resample_poly(pcm, 16000, sr) if sr != 16000 else pcm
        segs, _ = self.model.transcribe(audio.astype(np.float32), language="ar", beam_size=5)
        return " ".join(s.text for s in segs).strip()


def check_chunk(text, pcm, sr, cfg, transcriber=None):
    """Return a dict of findings; `ok` is False when the chunk needs review."""
    issues = []
    dur = len(pcm) / sr if sr else 0
    if sr <= 0 or len(pcm) == 0:
        return {"ok": False, "issues": ["empty audio"], "duration_s": 0}
    if np.max(np.abs(pcm)) < 1e-3:
        issues.append("audio is silent")
    lo, hi = cfg["chars_per_second_range"]
    rate = len(text) / max(dur, 1e-3)
    if rate > hi:
        issues.append(f"too short for the text ({rate:.1f} chars/s): words may be missing")
    if rate < lo:
        issues.append(f"too long for the text ({rate:.1f} chars/s): extra speech or long silences")
    result = {"duration_s": round(dur, 3), "chars_per_second": round(rate, 2)}
    if transcriber is not None and transcriber.available:
        heard = transcriber.transcribe(pcm, sr)
        sim = similarity(text, heard)
        missing, extra, longest_drop = _diff(text, heard)
        expected_words = max(1, len(normalize_ar(text).split()))
        result.update({"transcript": heard, "similarity": round(sim, 3), "missing_words": missing[:20],
                       "extra_words": extra[:20]})
        if sim < cfg["min_similarity"]:
            issues.append(f"transcript similarity {sim:.2f} below {cfg['min_similarity']}")
        if longest_drop >= 3 or len(missing) / expected_words > 0.2:
            issues.append(f"dialogue may be missing: {len(missing)} of {expected_words} words not heard")
        if re.search(r"[A-Za-z]{4,}", heard or "") or re.search(r"\b(TEXT|Voice|Accent|Delivery)\b", heard or ""):
            issues.append("Latin words heard: the prompt instructions may have been read aloud")
    result["issues"] = issues
    result["ok"] = not issues
    return result
