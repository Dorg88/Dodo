"""Speech backends: Google Gemini TTS, plus an offline fake used only by tests."""

import os
import random
import re
import time
import zlib

import numpy as np

TRANSIENT_CODES = {408, 429, 500, 502, 503, 504}


def load_api_key(root):
    """GOOGLE_API_KEY or GEMINI_API_KEY from the environment or <root>/.env.
    The key is never printed or logged."""
    for name in ("GOOGLE_API_KEY", "GEMINI_API_KEY"):
        if os.environ.get(name):
            return os.environ[name]
    env = os.path.join(root, ".env")
    if os.path.exists(env):
        with open(env, encoding="utf-8") as fh:
            for line in fh:
                k, _, v = line.strip().partition("=")
                if k.strip() in ("GOOGLE_API_KEY", "GEMINI_API_KEY") and v.strip():
                    return v.strip().strip('"').strip("'")
    return None


class SynthesisResult:
    def __init__(self, pcm, sample_rate, input_tokens=None, output_tokens=None, mime=""):
        self.pcm = pcm  # float64 mono in [-1, 1]
        self.sample_rate = sample_rate
        self.input_tokens = input_tokens
        self.output_tokens = output_tokens
        self.mime = mime


class RateLimiter:
    def __init__(self, per_minute):
        self.interval = 60.0 / max(per_minute, 1)
        self.last = 0.0

    def wait(self):
        delay = self.last + self.interval - time.monotonic()
        if delay > 0:
            time.sleep(delay)
        self.last = time.monotonic()


def _rate_from_mime(mime, default=24000):
    m = re.search(r"rate=(\d+)", mime or "")
    return int(m.group(1)) if m else default


class GeminiBackend:
    name = "gemini"

    def __init__(self, api_key, model, requests_per_minute=8, max_retries=6, log=None):
        from google import genai
        from google.genai import errors, types

        self.genai, self.types, self.errors = genai, types, errors
        self.client = genai.Client(api_key=api_key)
        self.model = model
        self.limiter = RateLimiter(requests_per_minute)
        self.max_retries = max_retries
        self.log = log or (lambda **kw: None)

    def _call(self, fn, what):
        for attempt in range(self.max_retries + 1):
            self.limiter.wait()
            try:
                return fn()
            except self.errors.APIError as e:
                transient = e.code in TRANSIENT_CODES
                self.log(event="api_error", what=what, code=e.code, status=e.status, message=str(e.message)[:300],
                         attempt=attempt, transient=transient)
                if not transient or attempt == self.max_retries:
                    raise
            except (OSError, TimeoutError) as e:  # network hiccups
                self.log(event="network_error", what=what, error=type(e).__name__, attempt=attempt)
                if attempt == self.max_retries:
                    raise
            time.sleep(min(60, 2 ** attempt + random.uniform(0, 1)))

    def list_tts_models(self):
        names = []
        for m in self._call(lambda: list(self.client.models.list()), "models.list"):
            n = (m.name or "").removeprefix("models/")
            if "tts" in n:
                names.append(n)
        return sorted(names)

    def search_voices(self, query):
        """Live catalog search (display name / description substring)."""
        found, token = [], None
        while True:
            resp = self._call(lambda: self.client.voices.list(search=query, page_size=200, page_token=token),
                              f"voices.list:{query}")
            found += resp.voices or []
            token = resp.next_page_token
            if not token:
                return found

    def synthesize(self, prompt, voice_id, language_code=None, model=None):
        t = self.types

        def run(voice_cfg):
            speech = t.SpeechConfig(voice_config=voice_cfg, language_code=language_code) if language_code \
                else t.SpeechConfig(voice_config=voice_cfg)
            cfg = t.GenerateContentConfig(response_modalities=["AUDIO"], speech_config=speech)
            return self._call(lambda: self.client.models.generate_content(model=model or self.model,
                                                                          contents=prompt, config=cfg),
                              f"tts:{voice_id}")

        resp = run(t.VoiceConfig(voice=voice_id))
        part = resp.candidates[0].content.parts[0]
        blob = part.inline_data
        if blob is None or not blob.data:
            raise RuntimeError("response contained no audio")
        mime = blob.mime_type or ""
        if "wav" in mime:
            import io
            import wave
            with wave.open(io.BytesIO(blob.data)) as w:
                rate, raw = w.getframerate(), w.readframes(w.getnframes())
        else:  # raw little-endian 16-bit PCM (audio/L16)
            rate, raw = _rate_from_mime(mime), blob.data
        pcm = np.frombuffer(raw, dtype="<i2").astype(np.float64) / 32768.0
        usage = resp.usage_metadata
        return SynthesisResult(pcm, rate, getattr(usage, "prompt_token_count", None),
                               getattr(usage, "candidates_token_count", None), mime)


class FakeBackend:
    """Deterministic speech-like noise, about 10 chars/s. For pipeline tests only;
    its output is marked fake and never exported to the app."""

    name = "fake"

    def __init__(self, fail_first=0):
        self.calls = 0
        self.fail_first = fail_first

    def list_tts_models(self):
        return ["fake-tts"]

    def search_voices(self, query):
        return []

    def synthesize(self, prompt, voice_id, language_code=None, model=None):
        self.calls += 1
        if self.calls <= self.fail_first:
            raise OSError("simulated transient failure")
        text = prompt.rsplit("TEXT:", 1)[-1]
        sr = 24000
        n = int(sr * (0.3 + len(text) / 10.0))
        rng = np.random.default_rng(zlib.crc32(f"{voice_id}|{text}".encode()))
        t = np.arange(n) / sr
        env = (np.sin(2 * np.pi * 4 * t) > 0).astype(float) * 0.2
        pcm = rng.standard_normal(n) * env
        pad = np.zeros(int(0.25 * sr))
        return SynthesisResult(np.concatenate([pad, pcm, pad]), sr, len(prompt) // 3, int(n / sr * 25), "fake")
