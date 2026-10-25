#!/usr/bin/env python3
"""Build an episode's app assets from its editable production timeline.

Usage:
    python3 tools/build_episode.py production/ep01/episode_source.json

Reads the original character recordings, cuts each scripted passage at its
verified source timestamps, lays them out on one voice track, renders the
music and ambience stems (ducked under the dialogue), encodes all three stems
to AAC and writes the episode JSON the Flutter app consumes, plus a Markdown
timeline report for review.
"""

import json
import os
import re
import subprocess
import sys
import tempfile

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sound_library as lib  # noqa: E402

SR = lib.SR
VOICE_TARGET_DB = -20.0   # RMS of active speech
MUSIC_DUCK_DB = -12.0
SFX_DUCK_DB = -7.0
MUSIC_BUS_DB = -9.0
SFX_BUS_DB = -6.0


def load_wav(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, np.float32).astype(np.float64)


def speech_rms_db(x):
    frame = int(0.03 * SR)
    n = len(x) // frame
    rms = np.sqrt((x[: n * frame].reshape(n, frame) ** 2).mean(axis=1) + 1e-12)
    db = 20 * np.log10(rms)
    active = db[db > -45]
    return 20 * np.log10(np.sqrt(np.mean((10 ** (active / 20)) ** 2))) if len(active) else -60.0


def fade(x, ms=15):
    m = min(int(ms / 1000 * SR), len(x) // 2)
    x = x.copy()
    x[:m] *= np.linspace(0, 1, m)
    x[-m:] *= np.linspace(1, 0, m)
    return x


def resolve(anchor, times, total):
    m = re.fullmatch(r"\s*([0-9]+(?:\.[0-9]+)?|end|[A-Za-z0-9_]+\.(?:start|end))\s*([+-]\s*[0-9.]+)?\s*", anchor)
    if not m:
        raise ValueError(f"bad anchor {anchor!r}")
    base, off = m.group(1), m.group(2)
    if base == "end":
        v = total
    elif re.fullmatch(r"[0-9.]+", base):
        v = float(base)
    else:
        sid, edge = base.split(".")
        v = times[sid][0 if edge == "start" else 1]
    if off:
        v += float(off.replace(" ", ""))
    return max(0.0, min(total, v))


def duck_gain(voice, duck_db, attack=0.12, release=0.7):
    hop = int(0.01 * SR)
    n = len(voice) // hop + 1
    pad = np.zeros(n * hop)
    pad[: len(voice)] = voice
    rms = np.sqrt((pad.reshape(n, hop) ** 2).mean(axis=1) + 1e-12)
    active = (20 * np.log10(rms)) > -42
    # hold the duck across short pauses between words
    hold = int(0.35 / 0.01)
    idx = np.where(active)[0]
    mask = np.zeros(n)
    for i in idx:
        mask[max(0, i - 8): i + hold] = 1.0
    target = 10 ** (duck_db / 20)
    g = np.ones(n)
    cur = 1.0
    a = np.exp(-0.01 / attack)
    r = np.exp(-0.01 / release)
    for i in range(n):
        tgt = target if mask[i] else 1.0
        coef = a if tgt < cur else r
        cur = tgt + (cur - tgt) * coef
        g[i] = cur
    return np.repeat(g, hop)[: len(voice)]


def apply_window(x, fade_in, fade_out):
    n = len(x)
    e = np.ones(n)
    fi = min(int(fade_in * SR), n)
    fo = min(int(fade_out * SR), n)
    if fi:
        e[:fi] = np.sin(np.linspace(0, np.pi / 2, fi)) ** 2
    if fo:
        e[n - fo:] *= np.cos(np.linspace(0, np.pi / 2, fo)) ** 2
    return x * e[:, None]


def encode(wav_array, path, channels, bitrate):
    with tempfile.NamedTemporaryFile(suffix=".f32", delete=False) as tmp:
        tmp.write(np.ascontiguousarray(wav_array, dtype=np.float32).tobytes())
        name = tmp.name
    try:
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", str(channels), "-i", name,
                        "-c:a", "aac", "-b:a", bitrate, "-movflags", "+faststart", path], check=True)
    finally:
        os.unlink(name)


def main(src_path):
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    src = json.load(open(src_path, encoding="utf-8"))
    out_dir = os.path.join(root, src["outputDir"])
    audio_dir = os.path.join(out_dir, "audio")
    os.makedirs(audio_dir, exist_ok=True)

    # --- voice track ---------------------------------------------------------
    cache, gains = {}, {}
    for seg in src["segments"]:
        f = seg["source"]
        if f not in cache:
            x = load_wav(os.path.join(root, src["sourceAudioDir"], f))
            cache[f] = x
            gains[f] = 10 ** ((VOICE_TARGET_DB - speech_rms_db(x)) / 20)

    clips, times = [], {}
    t = src.get("leadIn", 3.0)
    for seg in src["segments"]:
        t += seg.get("gap", 0.0)
        x = cache[seg["source"]]
        clip = fade(x[int(seg["in"] * SR): int(seg["out"] * SR)]) * gains[seg["source"]]
        wet = seg.get("reverb", 0.0)
        if wet:
            clip = lib.reverb(clip, 1.6, wet, seed=7, predelay=0.03)[:, 0]
        clips.append((t, clip))
        times[seg["id"]] = (t, t + len(clip) / SR)
        t += len(clip) / SR
    total = t + src.get("tail", 5.0)
    n = int(total * SR)
    voice = np.zeros(n)
    for start, clip in clips:
        s = int(start * SR)
        voice[s: s + len(clip)] += clip
    peak = np.max(np.abs(voice))
    if peak > 0.89:
        voice *= 0.89 / peak

    # --- music and sfx stems -------------------------------------------------
    def render(entries, table, key, bus_db, duck_db):
        bus = np.zeros((n, 2))
        resolved = []
        for i, e in enumerate(entries):
            a, b = resolve(e["from"], times, total), resolve(e["to"], times, total)
            if b - a < 0.2:
                continue
            x = table[e[key]](b - a + 0.05, seed=100 + 17 * i) if e[key] in table else None
            x = x[: int((b - a) * SR)]
            x = apply_window(x, e.get("fadeIn", 1.0), e.get("fadeOut", 1.0)) * e.get("level", 1.0)
            s = int(a * SR)
            bus[s: s + len(x)] += x
            resolved.append({**e, "start": a, "end": b})
        bus *= 10 ** (bus_db / 20)
        bus *= duck_gain(voice, duck_db)[:, None]
        pk = np.max(np.abs(bus))
        if pk > 0.95:
            bus *= 0.95 / pk
        return bus, resolved

    music, music_cues = render(src.get("music", []), lib.MUSIC, "cue", MUSIC_BUS_DB, MUSIC_DUCK_DB)
    sfx, sfx_cues = render(src.get("sfx", []), lib.SFX, "fx", SFX_BUS_DB, SFX_DUCK_DB)

    encode(voice, os.path.join(audio_dir, "voice.m4a"), 1, "96k")
    encode(music, os.path.join(audio_dir, "music.m4a"), 2, "128k")
    encode(sfx, os.path.join(audio_dir, "sfx.m4a"), 2, "112k")
    preview = os.path.join(os.path.dirname(os.path.abspath(src_path)), "preview_full_mix.m4a")
    mix = np.stack([voice, voice], axis=1) + music * 0.7 + sfx * 0.8
    mix *= 0.95 / max(0.95, np.max(np.abs(mix)))
    encode(mix, preview, 2, "160k")

    # --- scenes ----------------------------------------------------------------
    segs_by_scene = {}
    for seg in src["segments"]:
        segs_by_scene.setdefault(seg["scene"], []).append(seg)
    scene_starts = {}
    prev_end = 0.0
    for sc in src["scenes"]:
        first = segs_by_scene[sc["number"]][0]
        st = 0.0 if sc["number"] == 1 else prev_end + min(0.4, first.get("gap", 0) / 2)
        scene_starts[sc["number"]] = st
        prev_end = times[segs_by_scene[sc["number"]][-1]["id"]][1]

    def cues_in(lst, a, b, key):
        return sorted({c["label"] for c in lst if c["start"] < b - 0.3 and c["end"] > a + 0.3})

    ms = lambda v: int(round(v * 1000))
    scenes_out = []
    for i, sc in enumerate(src["scenes"]):
        a = scene_starts[sc["number"]]
        b = scene_starts[src["scenes"][i + 1]["number"]] if i + 1 < len(src["scenes"]) else total
        scenes_out.append({
            "number": sc["number"], "title": sc["title"], "layout": sc.get("layout", "plate"),
            "image": f'{src["assetPrefix"]}/{sc["image"]}', "startMs": ms(a), "endMs": ms(b),
            "music": cues_in(music_cues, a, b, "cue"), "sfx": cues_in(sfx_cues, a, b, "fx"),
        })

    segments_out = []
    for seg in src["segments"]:
        a, b = times[seg["id"]]
        sp = src["speakers"][seg["speaker"]]
        segments_out.append({
            "id": seg["id"], "scene": seg["scene"], "speakerId": seg["speaker"], "speakerName": sp["name"],
            "direction": seg.get("direction", ""), "text": " ".join(l["text"] for l in seg["lines"]),
            "trailingText": seg.get("trailingText"),
            "startMs": ms(a), "endMs": ms(b), "audioSource": seg["source"],
            "sourceStartMs": ms(seg["in"]), "sourceEndMs": ms(seg["out"]),
            "timing": "verified",
            "lines": [{"text": l["text"], "startMs": ms(a + l["in"] - seg["in"]), "endMs": ms(a + l["out"] - seg["in"])}
                      for l in seg["lines"]],
            "music": cues_in(music_cues, a, b, "cue"), "sfx": cues_in(sfx_cues, a, b, "fx"),
        })

    episode = {
        "schema": "hikaya.episode.v1",
        "bookId": src["bookId"], "id": src["id"], "number": src["number"], "title": src["title"],
        "bookTitle": src["bookTitle"], "bookSubtitle": src["bookSubtitle"], "author": src["author"],
        "genre": src["genre"], "location": src["location"], "note": src["note"],
        "durationMs": ms(total),
        "audio": {"mode": "track", **{k: f'{src["assetPrefix"]}/audio/{k}.m4a' for k in ("voice", "music", "sfx")}},
        "speakers": src["speakers"],
        "scenes": scenes_out,
        "segments": segments_out,
        "musicCues": [{"cue": c["cue"], "label": c["label"], "startMs": ms(c["start"]), "endMs": ms(c["end"])} for c in music_cues],
        "sfxCues": [{"fx": c["fx"], "label": c["label"], "startMs": ms(c["start"]), "endMs": ms(c["end"])} for c in sfx_cues],
    }
    with open(os.path.join(out_dir, "episode.json"), "w", encoding="utf-8") as fh:
        json.dump(episode, fh, ensure_ascii=False, indent=1)

    # --- verification ----------------------------------------------------------
    def rms_db(x):
        return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)

    checks = []
    for seg in src["segments"]:
        a, b = times[seg["id"]]
        s, e = int(a * SR), int(b * SR)
        checks.append((seg["id"], rms_db(voice[s:e]), rms_db(music[s:e]), rms_db(sfx[s:e])))
    takbir = times.get("child2")

    fmt = lambda v: f"{int(v // 60)}:{v % 60:05.2f}"
    rep = [f"# Timeline report — {src['bookTitle']} · {src['title']}", "",
           f"Total duration: {fmt(total)} ({ms(total)} ms). Generated by `tools/build_episode.py`.", "",
           "| # | Scene | Segment | Speaker | Episode time | Source file | Source in–out | Voice dB | Music dB | SFX dB |",
           "|---|---|---|---|---|---|---|---|---|---|"]
    for seg, c in zip(src["segments"], checks):
        a, b = times[seg["id"]]
        rep.append(f"| {seg['scene']} | {src['scenes'][seg['scene'] - 1]['title']} | {seg['id']} | "
                   f"{src['speakers'][seg['speaker']]['name']} | {fmt(a)}–{fmt(b)} | {seg['source']} | "
                   f"{seg['in']:.2f}–{seg['out']:.2f} | {c[1]:.1f} | {c[2]:.1f} | {c[3]:.1f} |")
    rep += ["", "## Music cues", ""] + [f"- {c['label']} (`{c['cue']}`): {fmt(c['start'])}–{fmt(c['end'])}" for c in music_cues]
    rep += ["", "## Sound effects", ""] + [f"- {c['label']} (`{c['fx']}`): {fmt(c['start'])}–{fmt(c['end'])}" for c in sfx_cues]
    if takbir:
        s, e = int((takbir[0] - 1.0) * SR), int((takbir[1] + 1.0) * SR)
        rep += ["", f"Music level around «الله أكبر» ({fmt(takbir[0])}): {rms_db(music[s:e]):.1f} dBFS "
                    f"(silence = below -90); ambience {rms_db(sfx[s:e]):.1f} dBFS."]
    rep += ["", "Speech-to-music margin per segment = Voice dB − Music dB (target ≥ 15 dB)."]
    with open(os.path.join(os.path.dirname(os.path.abspath(src_path)), "timeline_report.md"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(rep) + "\n")

    print(f"duration {fmt(total)}")
    for c in checks:
        print(f"{c[0]:8s} voice {c[1]:6.1f}  music {c[2]:6.1f}  sfx {c[3]:6.1f}  margin {c[1] - c[2]:5.1f}")


if __name__ == "__main__":
    main(sys.argv[1])
