#!/usr/bin/env python3
"""HIKAYA: per-scene background music and sound effects for an episode.

    python3 hikaya_score.py --book-dir BOOK --episode ep10            # suggest + render
    python3 hikaya_score.py --book-dir BOOK --episode ep10 --suggest-only
    (edit BOOK/ep10/score.json, then run again without --suggest-only)

1. Suggests a mood for every scene from its title and text (mosque,
   prayer, sea voyage, night, doubt, study, joy, sorrow, revelation…) and
   writes BOOK/<ep>/score.json, which you can edit: music cue per scene
   (nostalgic, suspense, reverent, warm, reflective, ending, or none) and
   ambience list (night, footsteps, door, roomtone, murmur, crowd, rustle, sea,
   city, study).
2. Renders original music and ambience stems (procedural, no third-party
   recordings, so no licensing) on the episode's own timeline, crossfaded
   between scenes, ducked under every spoken line, and fully silent around
   prayer and «الله أكبر».
3. Writes BOOK/<ep>/audio/score_music.m4a and score_sfx.m4a and points the
   episode's audio.music / audio.sfx at them. The app plays them in sync and
   the listener can mute or lower them without touching the voices.

Works for both track-mode and clips-mode episodes. Needs numpy, scipy, ffmpeg.
"""

import argparse
import json
import os
import re
import subprocess
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
sys.path.insert(0, HERE)
import sound_library as lib  # noqa: E402
from build_episode import apply_window, duck_gain, encode  # noqa: E402
from hikaya_common import write_json  # noqa: E402

SR = lib.SR
MUSIC_BUS_DB, SFX_BUS_DB = -9.0, -7.0
MUSIC_DUCK_DB, SFX_DUCK_DB = -12.0, -7.0
XFADE = 1.6

# (pattern, music cue, ambience) — first match wins; order matters.
RULES = [
    # prayer actually happening → silence (a mere mention of prayer does not count)
    (r"الله أكبر|تكبير|ومضت الصلا|يصلي بالناس|أقيمت الصلا|الأذان|(?<!\w)(?:يصلّ?ون|ركع|سجد|ركعوا|سجدوا)(?!\w)", "none", ["roomtone"]),
    (r"مسجد|جامع|المصل[يّ]ن|ضريح|مرقد|الحرم|زيار[ةه]|مقام|الكاظم|الجيلاني|حوز[ةه]", "reverent", ["roomtone", "murmur"]),
    (r"بحر|باخر[ةه]|سفين[ةه]|ميناء|موج|إبحار|الإسكندرية", "reflective", ["sea"]),
    (r"اهتديت|الحقيق[ةه]|يقين|استبصار|طريق جديد", "warm", []),
    (r"شك|حير[ةه]|سؤال|أسئل[ةه]|تساؤل|قلق|اضطراب|جدال|نقاش", "suspense", []),
    (r"كتاب|كتب|مكتب[ةه]|يقرأ|قراء[ةه]|دراس[ةه]|مراجع|روايات|مصادر", "reflective", ["study"]),
    (r"فرح|سعاد[ةه]|تهنئ[ةه]|تهاني|هنيئا|بارك الله|ابتسم|بشرى|عرس|زواج", "warm", ["crowd"]),
    (r"حزن|بكاء|دموع|مصيب[ةه]|استشهاد|عاشوراء|فقد|وفا[ةه]", "reflective", []),
    (r"ليل|ليل[ةه]|قمر|نجوم|الظلام|المساء|رمضاني", "nostalgic", ["night"]),
    (r"مدين[ةه]|شارع|سوق|بغداد|القاهر[ةه]|كربلاء|سفر|المطار|القطار", "warm", ["city"]),
]
PRAYER = re.compile(r"الله أكبر|تكبير[ةه]? الإحرام")


def suggest(ep):
    scores = []
    n = len(ep["scenes"])
    for i, sc in enumerate(ep["scenes"]):
        title = sc.get("title", "")
        text = " ".join(s["text"] for s in ep["segments"] if s["scene"] == sc["number"])
        music, sfx, why = "reflective", [], "default"
        # the scene title describes the scene best; fall back to its text
        for source, label in ((title, "title"), (text, "text")):
            hit = None
            for pat, m, fx in RULES:
                hit = re.search(pat, source)
                if hit:
                    music, sfx, why = m, fx, f"{label}: {hit.group(0)}"
                    break
            if hit:
                break
        if i == n - 1 and music != "none":
            music, why = "ending", f"{why}; last scene"
        scores.append({"scene": sc["number"], "title": sc.get("title", ""), "music": music, "sfx": sfx,
                       "level": 0.85, "reason": why})
    return {"_comment": "Edit freely: music = nostalgic|suspense|reverent|warm|reflective|ending|none; "
                        "sfx = list of " + ", ".join(sorted(lib.SFX)) + "; level 0..1.",
            "scenes": scores}


def load_mono(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).astype(np.float64)


def voice_track(book_dir, ep):
    total = int(ep["durationMs"] / 1000 * SR) + SR
    v = np.zeros(total)
    a = ep["audio"]
    if a.get("mode") == "clips":
        cache = {}
        for s in ep["segments"]:
            c = s["clip"]
            if c["file"] not in cache:
                cache[c["file"]] = load_mono(os.path.join(book_dir, c["file"]))
            x = cache[c["file"]][int(c["startMs"] / 1000 * SR): int(c["endMs"] / 1000 * SR)]
            st = int(s["startMs"] / 1000 * SR)
            v[st: st + len(x)] += x[: max(0, total - st)]
    else:
        x = load_mono(os.path.join(book_dir, a["voice"]))
        v[: min(total, len(x))] = x[:total]
    return v


def render(book_dir, ep, score):
    voice = voice_track(book_dir, ep)
    n = len(voice)
    music = np.zeros((n, 2))
    sfx = np.zeros((n, 2))
    by_scene = {s["scene"]: s for s in score["scenes"]}
    cues = []
    for i, sc in enumerate(ep["scenes"]):
        plan = by_scene.get(sc["number"], {"music": "reflective", "sfx": [], "level": 0.85})
        a = max(0.0, sc["startMs"] / 1000 - (XFADE / 2 if i else 0))
        b = min(n / SR, sc["endMs"] / 1000 + XFADE / 2)
        if b - a < 0.5:
            continue
        lvl = float(plan.get("level", 0.85))
        seed = 1000 + 37 * sc["number"]
        if plan.get("music", "none") != "none":
            x = lib.MUSIC[plan["music"]](b - a + 0.05, seed=seed)[: int((b - a) * SR)]
            x = apply_window(x, XFADE if i else 2.5, XFADE if i < len(ep["scenes"]) - 1 else 4.0) * lvl
            music[int(a * SR): int(a * SR) + len(x)] += x
            cues.append({"scene": sc["number"], "cue": plan["music"], "startMs": int(a * 1000), "endMs": int(b * 1000)})
        for k, fx in enumerate(plan.get("sfx", [])):
            if fx not in lib.SFX:
                print(f"  scene {sc['number']}: unknown sfx '{fx}' skipped")
                continue
            x = lib.SFX[fx](b - a + 0.05, seed=seed + k)[: int((b - a) * SR)]
            x = apply_window(x, XFADE, XFADE) * lvl
            sfx[int(a * SR): int(a * SR) + len(x)] += x
    # silence (music and ambience) around the takbir and other prayer lines
    for s in ep["segments"]:
        if PRAYER.search(s["text"]):
            a = max(0, int((s["startMs"] / 1000 - 1.2) * SR))
            b = min(n, int((s["endMs"] / 1000 + 1.0) * SR))
            ramp = int(0.4 * SR)
            env = np.ones(n)
            env[a:b] = 0
            env[max(0, a - ramp):a] = np.linspace(1, 0, a - max(0, a - ramp))
            env[b:min(n, b + ramp)] = np.linspace(0, 1, min(n, b + ramp) - b)
            music *= env[:, None]
            sfx *= env[:, None]
    music *= 10 ** (MUSIC_BUS_DB / 20) * duck_gain(voice, MUSIC_DUCK_DB)[:, None]
    sfx *= 10 ** (SFX_BUS_DB / 20) * duck_gain(voice, SFX_DUCK_DB)[:, None]
    for bus in (music, sfx):
        pk = np.max(np.abs(bus)) or 1
        if pk > 0.95:
            bus *= 0.95 / pk
    enforce_margin(voice, music, ep["segments"])
    return voice, music, sfx, cues


MARGIN_DB = 16.0   # music stays at least this far under every line (the rule is 15 dB)


def enforce_margin(voice, music, segments):
    """Quiet lines (a whisper, a soft reading) can sit too close to the music even
    after ducking: lower the music under each such line, with short ramps."""
    n = len(voice)
    env = np.ones(n)
    ramp = int(0.3 * SR)
    for s in segments:
        a, b = int(s["startMs"] / 1000 * SR), min(n, int(s["endMs"] / 1000 * SR))
        if b <= a:
            continue
        margin = db(voice[a:b]) - db(music[a:b])
        if margin >= MARGIN_DB:
            continue
        g = 10 ** ((margin - MARGIN_DB) / 20)
        lo, hi = max(0, a - ramp), min(n, b + ramp)
        seg = np.full(hi - lo, g)
        seg[: a - lo] = np.linspace(1, g, a - lo)
        seg[b - lo:] = np.linspace(g, 1, hi - b)
        env[lo:hi] = np.minimum(env[lo:hi], seg)
    music *= env[:, None]


def db(x):
    return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--book-dir", required=True)
    ap.add_argument("--episode", required=True, help="episode folder name, e.g. ep10")
    ap.add_argument("--suggest-only", action="store_true")
    args = ap.parse_args()

    ep_dir = os.path.join(args.book_dir, args.episode)
    ep_path = os.path.join(ep_dir, "episode.json")
    with open(ep_path, encoding="utf-8") as fh:
        ep = json.load(fh)
    score_path = os.path.join(ep_dir, "score.json")
    if os.path.exists(score_path):
        with open(score_path, encoding="utf-8") as fh:
            score = json.load(fh)
        print(f"using {score_path}")
    else:
        score = suggest(ep)
        write_json(score_path, score)
        print(f"suggested moods → {score_path}")
    for s in score["scenes"]:
        print(f"  scene {s['scene']:>2}: music={s['music']:<10} sfx={','.join(s['sfx']) or '-':<16} ({s.get('reason', '')}) {s.get('title', '')}")
    if args.suggest_only:
        return

    voice, music, sfx, cues = render(args.book_dir, ep, score)
    audio_dir = os.path.join(ep_dir, "audio")
    os.makedirs(audio_dir, exist_ok=True)
    encode(music, os.path.join(audio_dir, "score_music.m4a"), 2, "128k")
    encode(sfx, os.path.join(audio_dir, "score_sfx.m4a"), 2, "112k")
    ep["audio"]["music"] = f"{args.episode}/audio/score_music.m4a"
    ep["audio"]["sfx"] = f"{args.episode}/audio/score_sfx.m4a"
    ep["audio"]["musicLoop"] = False
    ep["musicCues"] = cues
    write_json(ep_path, ep)

    print("\nspeech-to-music margin per segment (target ≥ 15 dB):")
    worst = 99.0
    for s in ep["segments"]:
        a, b = int(s["startMs"] / 1000 * SR), int(s["endMs"] / 1000 * SR)
        margin = db(voice[a:b]) - db(music[a:b])
        worst = min(worst, margin)
        silent = " (music silent)" if db(music[a:b]) < -80 else ""
        print(f"  {s['id']:<16} {margin:6.1f} dB{silent}")
    print(f"minimum margin {worst:.1f} dB · stems written to {audio_dir} · episode.json updated")


if __name__ == "__main__":
    main()
