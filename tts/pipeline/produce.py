"""Episode production: script -> cached chunks -> lines -> episode + timeline.

Resumable by construction: every chunk is cached under a hash of everything
that affects its sound (backend, model, voice, prompt, language). A chunk
whose cache entry exists is never requested again, so an interrupted run
simply continues where it stopped.
"""

import hashlib
import json
import os
import shutil
import time
import zipfile

import numpy as np

from . import audio
from .script_parser import parse_script, render_by_character, render_chronological, split_chunks
from .validate import check_chunk


class Paths:
    def __init__(self, root):
        self.root = root
        self.tts = os.path.join(root, "tts")
        self.config = os.path.join(self.tts, "config")
        self.scripts = os.path.join(self.tts, "scripts")
        self.work = os.path.join(self.tts, "work")
        self.cache = os.path.join(self.work, "cache")
        self.logs = os.path.join(self.work, "logs")
        self.output = os.path.join(self.tts, "output")
        self.app_assets = os.path.join(root, "storybook", "assets")
        for d in (self.cache, self.logs, self.output):
            os.makedirs(d, exist_ok=True)


class Logger:
    def __init__(self, path):
        self.path = path

    def __call__(self, **event):
        event = {"ts": time.strftime("%Y-%m-%dT%H:%M:%S"), **event}
        with open(self.path, "a", encoding="utf-8") as fh:
            fh.write(json.dumps(event, ensure_ascii=False) + "\n")


def load_config(paths):
    with open(os.path.join(paths.config, "pipeline.json"), encoding="utf-8") as fh:
        return json.load(fh)


def load_episode(paths, registry, script_file):
    with open(script_file, encoding="utf-8") as fh:
        return parse_script(fh.read(), registry.ids(), frozenset(registry.data.get("historical_ids", [])))


def chunk_key(backend, model, voice, prompt, lang):
    raw = json.dumps([backend, model, voice, prompt, lang], ensure_ascii=False)
    return hashlib.sha256(raw.encode()).hexdigest()[:24]


class Producer:
    def __init__(self, paths, cfg, registry, backend, transcriber=None, log=None):
        self.paths, self.cfg, self.registry, self.backend = paths, cfg, registry, backend
        self.transcriber = transcriber
        self.log = log or Logger(os.path.join(paths.logs, "requests.jsonl"))
        self.model = getattr(backend, "model", cfg["model"])

    def check_voices(self, ep):
        missing = self.registry.unverified({l.speaker_id for l in ep.lines})
        if missing and self.backend.name != "fake":
            raise RuntimeError("voices not verified for: " + ", ".join(missing) +
                               ". Run verify-voices, or set api_voice/status in voice_registry.json after review.")

    def voice_for(self, cid):
        if self.backend.name == "fake":
            return self.registry.api_voice(cid) or f"fake-{self.registry.voice_choice(cid)}"
        return self.registry.api_voice(cid)

    def chunk(self, cid, emotion, text, ep_log):
        """Return (pcm, meta) for one chunk, from cache when available."""
        prompt = self.cfg["prompt_template"].format(text=text, **self.registry.prompt_fields(cid, emotion))
        voice = self.voice_for(cid)
        key = chunk_key(self.backend.name, self.model, voice, prompt, self.registry.language_code)
        wav = os.path.join(self.paths.cache, key + ".wav")
        meta_path = os.path.join(self.paths.cache, key + ".json")
        if os.path.exists(wav) and os.path.exists(meta_path):
            with open(meta_path, encoding="utf-8") as fh:
                meta = json.load(fh)
            pcm, sr = audio.read_wav(wav)
            ep_log(event="chunk_cached", key=key, speaker=cid)
            return pcm, meta
        t0 = time.time()
        res = self.backend.synthesize(prompt, voice, self.registry.language_code, self.model)
        pcm = audio.to_rate(res.pcm, res.sample_rate)
        check = check_chunk(text, pcm, audio.SR, self.cfg["validation"], self.transcriber)
        meta = {"key": key, "backend": self.backend.name, "model": self.model, "voice": voice, "speaker": cid,
                "emotion": emotion, "text": text, "source_rate": res.sample_rate, "mime": res.mime,
                "input_tokens": res.input_tokens, "output_tokens": res.output_tokens,
                "seconds": round(time.time() - t0, 2), "validation": check}
        audio.write_wav(wav, pcm)
        with open(meta_path + ".tmp", "w", encoding="utf-8") as fh:
            json.dump(meta, fh, ensure_ascii=False, indent=1)
        os.replace(meta_path + ".tmp", meta_path)
        ep_log(event="chunk_generated", key=key, speaker=cid, voice=voice, chars=len(text),
               duration_s=check.get("duration_s"), ok=check["ok"], issues=check["issues"],
               input_tokens=res.input_tokens, output_tokens=res.output_tokens)
        return pcm, meta

    def produce(self, ep, out_dir, export_app=False, app_prefix=None):
        """Generate every line, assemble the episode and write all outputs."""
        self.check_voices(ep)
        os.makedirs(out_dir, exist_ok=True)
        lines_dir = os.path.join(out_dir, "lines")
        os.makedirs(lines_dir, exist_ok=True)
        ep_log = Logger(os.path.join(self.paths.logs, f"episode_{ep.episode}.jsonl"))
        ep_log(event="episode_start", episode=ep.episode, lines=len(ep.lines), backend=self.backend.name)
        cfg, pauses = self.cfg, self.cfg["pauses_ms"]

        line_audio, reviews = [], []
        for line in ep.lines:
            parts = []
            for i, text in enumerate(split_chunks(line.text, cfg["max_chunk_chars"])):
                pcm, meta = self.chunk(line.speaker_id, line.emotion, text, ep_log)
                pcm = audio.trim_silence(pcm, audio.SR, cfg["trim_silence_keep_ms"])
                if not meta["validation"]["ok"]:
                    reviews.append({"line": line.index, "chunk": i, "speaker": line.speaker_id, "text": text,
                                    **{k: meta["validation"].get(k) for k in
                                       ("issues", "similarity", "transcript", "missing_words", "extra_words")}})
                if parts:
                    parts.append(audio.silence(pauses["chunk"]))
                parts.append(pcm)
            pcm = audio.normalize(np.concatenate(parts), audio.SR, cfg["target_speech_rms_dbfs"],
                                  cfg["peak_ceiling_dbfs"])
            pcm = audio.fade(pcm, audio.SR)
            name = f"ep{ep.episode}_l{line.index:03d}_{line.speaker_id.lower()}"
            audio.write_wav(os.path.join(lines_dir, name + ".wav"), pcm)
            line_audio.append((line, name, pcm))

        # assemble chronologically
        timeline, track = [], [audio.silence(pauses["lead_in"])]
        cursor = audio.duration_ms(track[0])
        prev = None
        for line, name, pcm in line_audio:
            if prev is not None:
                gap = pauses["scene_change"] if line.scene_id != prev.scene_id else \
                    pauses["same_speaker"] if line.speaker_id == prev.speaker_id else pauses["speaker_change"]
                track.append(audio.silence(gap))
                cursor += gap
            start = cursor
            track.append(pcm)
            cursor += audio.duration_ms(pcm)
            timeline.append((line, name, start, cursor))
            prev = line
        track.append(audio.silence(pauses["tail"]))
        full = np.concatenate(track)
        total_ms = audio.duration_ms(full)

        stem = f"episode_{ep.episode}"
        full_wav = os.path.join(out_dir, stem + "_full.wav")
        audio.write_wav(full_wav, full)
        audio.export_mp3(full_wav, os.path.join(out_dir, stem + "_full.mp3"), "128k")

        scenes_by_id = {s.scene_id: s for s in ep.scenes}
        missing_images = [s.scene_id for s in ep.scenes
                          if not s.image or not os.path.exists(os.path.join(self.paths.root, "storybook", s.image))]
        prefix = app_prefix or f"assets/audio/episode_{ep.episode}"
        data = {
            "schema": "thumma_ihtadayt.tts_episode.v1",
            "episode": ep.episode,
            "title": ep.title,
            "source_status": ep.source_status,
            "generated_with": {"backend": self.backend.name, "model": self.model},
            "duration_ms": total_ms,
            "full_audio": f"{prefix}/{stem}_full.mp3",
            "scenes": [],
            "lines": [],
            "missing_images": missing_images,
        }
        for s in ep.scenes:
            items = [t for t in timeline if t[0].scene_id == s.scene_id]
            if items:
                data["scenes"].append({"scene_id": s.scene_id, "title": s.title,
                                       "image": s.image if s.scene_id not in missing_images else None,
                                       "start_ms": items[0][2], "end_ms": items[-1][3]})
        for line, name, start, end in timeline:
            data["lines"].append({
                "index": line.index,
                "speaker_id": line.speaker_id,
                "speaker_name": self.registry.name_ar(line.speaker_id),
                "voice_choice": self.registry.voice_choice(line.speaker_id),
                "api_voice": self.voice_for(line.speaker_id),
                "text": line.text,
                "emotion": line.emotion,
                "content_type": line.type,
                "quote_source": line.source or None,
                "audio_file": f"{prefix}/{name}.mp3",
                "start_ms": start,
                "end_ms": end,
                "image_scene_id": line.scene_id,
                "scene_title": scenes_by_id[line.scene_id].title,
            })
        with open(os.path.join(out_dir, stem + ".json"), "w", encoding="utf-8") as fh:
            json.dump(data, fh, ensure_ascii=False, indent=1)

        with open(os.path.join(out_dir, "script_chronological.md"), "w", encoding="utf-8") as fh:
            fh.write(render_chronological(ep, self.registry))
        with open(os.path.join(out_dir, "script_by_character.md"), "w", encoding="utf-8") as fh:
            fh.write(render_by_character(ep, self.registry))
        self._write_review(out_dir, ep, reviews, missing_images, total_ms)

        for _, name, _ in line_audio:
            audio.export_mp3(os.path.join(lines_dir, name + ".wav"), os.path.join(lines_dir, name + ".mp3"))

        if export_app:
            if self.backend.name == "fake":
                raise RuntimeError("refusing to export fake test audio into the app")
            self._export_app(ep, out_dir, data, line_audio)
        self._zip(out_dir, stem)
        ep_log(event="episode_done", episode=ep.episode, duration_ms=total_ms, flagged=len(reviews),
               missing_images=len(missing_images))
        return data, reviews

    def _write_review(self, out_dir, ep, reviews, missing_images, total_ms):
        rep = [f"# Review — episode {ep.episode}: {ep.title}", "",
               f"Duration: {total_ms / 1000:.1f} s · lines: {len(ep.lines)} · flagged chunks: {len(reviews)}", ""]
        if reviews:
            rep += ["## Chunks to check by ear", ""]
            for r in reviews:
                rep.append(f"- line {r['line']} ({r['speaker']}): {'; '.join(r['issues'])}")
                if r.get("transcript") is not None:
                    rep.append(f"  - heard: {r['transcript']}")
                    if r.get("missing_words"):
                        rep.append(f"  - missing/misheard: {' '.join(r['missing_words'])}")
        rep += ["", "## Scene images", ""]
        rep += [f"- {sid}: no matching image in the project" for sid in missing_images] or ["- all scenes have images"]
        with open(os.path.join(out_dir, "review.md"), "w", encoding="utf-8") as fh:
            fh.write("\n".join(rep) + "\n")

    def _export_app(self, ep, out_dir, data, line_audio):
        stem = f"episode_{ep.episode}"
        adir = os.path.join(self.paths.app_assets, "audio", stem)
        ddir = os.path.join(self.paths.app_assets, "data")
        os.makedirs(adir, exist_ok=True)
        os.makedirs(ddir, exist_ok=True)
        shutil.copy(os.path.join(out_dir, stem + "_full.mp3"), adir)
        for _, name, _ in line_audio:
            shutil.copy(os.path.join(out_dir, "lines", name + ".mp3"), adir)
        with open(os.path.join(ddir, stem + ".json"), "w", encoding="utf-8") as fh:
            json.dump(data, fh, ensure_ascii=False, indent=1)

    def _zip(self, out_dir, stem):
        zpath = os.path.join(self.paths.output, os.path.basename(os.path.normpath(out_dir)) + ".zip")
        with zipfile.ZipFile(zpath + ".tmp", "w", zipfile.ZIP_DEFLATED) as z:
            for base, _, files in os.walk(out_dir):
                for f in files:
                    full = os.path.join(base, f)
                    z.write(full, os.path.relpath(full, os.path.dirname(out_dir)))
        os.replace(zpath + ".tmp", zpath)
