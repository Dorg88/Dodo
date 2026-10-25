"""Command line: python3 -m tts.pipeline <command> (run from the repository root).

  verify-voices            look up every cast voice in the live catalog and test it
  estimate                 approximate cost and workload for Episodes 07-22
  preview                  generate the short Episode 07 Enzo/Ludo test
  run --episodes 07-22 --i-approve-paid-batch [--export-app]
  dry-run --episode 07     whole pipeline with the offline fake backend (no API calls)
  status                   what is cached / finished
"""

import argparse
import glob
import json
import os
import sys

from .backends import FakeBackend, GeminiBackend, load_api_key
from .cost import estimate
from .produce import Logger, Paths, Producer, load_config, load_episode
from .registry import Registry
from .validate import Transcriber

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
EPISODES = [f"{n:02d}" for n in range(7, 23)]


def episode_range(spec):
    if "-" in spec:
        a, b = spec.split("-")
        return [f"{n:02d}" for n in range(int(a), int(b) + 1)]
    return [f"{int(x):02d}" for x in spec.split(",")]


def gemini(paths, cfg, model=None):
    key = load_api_key(ROOT)
    if not key:
        sys.exit("No API key: set GOOGLE_API_KEY or GEMINI_API_KEY, or put it in <repo>/.env (git-ignored).")
    log = Logger(os.path.join(paths.logs, "requests.jsonl"))
    return GeminiBackend(key, model or cfg["model"], cfg["requests_per_minute"], cfg["max_retries"], log)


def script_path(paths, ep):
    return os.path.join(paths.scripts, f"episode_{ep}.txt")


def cmd_verify(args, paths, cfg, reg):
    be = gemini(paths, cfg)
    report = ["# Voice verification", ""]
    models = be.list_tts_models()
    report += ["## TTS models available to this key", ""] + [f"- {m}" for m in models] + [""]
    if cfg["model"] not in models:
        usable = [m for m in cfg["fallback_models_to_probe"] if m in models]
        report.append(f"**Configured model {cfg['model']} is not available.** Candidates: {usable or 'none'}.")
        if not usable:
            reg.save()
            open(os.path.join(paths.output, "voice_verification.md"), "w", encoding="utf-8").write("\n".join(report))
            sys.exit("no TTS model available; see tts/output/voice_verification.md")
        be.model = usable[0]
        report.append(f"Using {be.model} for the voice test; set it as `model` in pipeline.json to keep it.")
    report += ["", "## Cast", "", "| Character | Choice | Catalog match | API voice id | Test synthesis | Status |",
               "|---|---|---|---|---|---|"]
    for cid in sorted(reg.characters, key=lambda c: (reg.characters[c]["group"], c)):
        choice = reg.voice_choice(cid)
        matches = be.search_voices(choice) if choice else []
        exact = [v for v in matches if choice.lower() in {(v.display_name or "").lower(), (v.id or "").lower()}]
        if not exact:
            near = ", ".join(sorted({v.display_name or v.id for v in matches})[:6]) or "none"
            reg.set_verification(cid, None, "not_found_in_catalog", f"no exact catalog match; similar: {near}")
            report.append(f"| {cid} | {choice} | none (similar: {near}) | — | not run | **unsupported** |")
            continue
        v = exact[0]
        try:
            res = be.synthesize("Say calmly: مرحباً، هذا اختبار قصير للصوت.", v.id, reg.language_code)
            ok = len(res.pcm) > res.sample_rate * 0.5
            note = f"{v.display_name} ({v.type}, accent={v.accent}, lang={v.language_code}); test {len(res.pcm)/res.sample_rate:.1f}s"
        except Exception as e:  # noqa: BLE001 - reported to the user
            ok, note = False, f"synthesis failed: {str(e)[:160]}"
        reg.set_verification(cid, v.id if ok else None, "verified" if ok else "synthesis_failed", note)
        report.append(f"| {cid} | {choice} | {v.display_name} | `{v.id}` | {'ok' if ok else 'failed'} | "
                      f"{'verified' if ok else '**failed**'} |")
    reg.save()
    path = os.path.join(paths.output, "voice_verification.md")
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(report) + "\n")
    print("\n".join(report))
    print(f"\nwritten {path}; voice_registry.json updated")


def cmd_diagnose(args, paths, cfg, reg):
    """Find which model / language / id form a catalog voice accepts (a few 1-sentence test calls)."""
    be = gemini(paths, cfg)
    be.max_retries = 1
    out = ["# Voice diagnosis", ""]
    names = args.names.split(",")
    for name in names:
        matches = [v for v in be.search_voices(name) if name.lower() in
                   {(v.display_name or "").lower(), (v.id or "").lower()}]
        if not matches:
            out += [f"## {name}: not found", ""]
            continue
        v = matches[0]
        info = v.model_dump(exclude_none=True, exclude={"sample_audio"}) if hasattr(v, "model_dump") else dict(v)
        out += [f"## {name}", "", "```", json.dumps(info, ensure_ascii=False, default=str, indent=1), "```", ""]
        models = list(dict.fromkeys([m for m in [info.get("model"), cfg["model"], *cfg["fallback_models_to_probe"]] if m]))
        ids = list(dict.fromkeys([v.id, f"voices/{v.id}"]))
        out += ["| model | language_code | voice id | result |", "|---|---|---|---|"]
        for model in models:
            for lang in ("ar", None):
                for vid in ids:
                    try:
                        res = be.synthesize("Say calmly: مرحباً، هذا اختبار قصير للصوت.", vid, lang, model)
                        r = f"ok ({len(res.pcm)/res.sample_rate:.1f}s)"
                    except Exception as e:  # noqa: BLE001 - reported
                        r = "fail: " + str(getattr(e, "message", e))[:120].replace("|", "/")
                    out.append(f"| {model} | {lang} | `{vid}` | {r} |")
                    print(out[-1], flush=True)
        out.append("")
    path = os.path.join(paths.output, "voice_diagnosis.md")
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(out) + "\n")
    print("\n".join(out))


def cmd_list_voices(args, paths, cfg, reg):
    be = gemini(paths, cfg)
    rows, seen = [], set()
    for q in args.search.split(","):
        for v in be.search_voices(q):
            if v.id in seen:
                continue
            seen.add(v.id)
            rows.append(f"| `{v.id}` | {v.display_name} | {v.type} | {v.language_code} | {v.accent} | {v.gender} | "
                        f"{v.pitch} | {(v.persona or '')[:40]} | {(v.description or '')[:80]} |")
    out = [f"# Catalog voices matching: {args.search}", "",
           "| id | name | type | lang | accent | gender | pitch | persona | description |",
           "|---|---|---|---|---|---|---|---|---|"] + rows
    with open(os.path.join(paths.output, "voice_catalog.md"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(out) + "\n")
    print(f"{len(rows)} voices")


def cmd_estimate(args, paths, cfg, reg):
    chars = {}
    for ep in EPISODES:
        p = script_path(paths, ep)
        if os.path.exists(p):
            chars[ep] = sum(len(l.text) for l in load_episode(paths, reg, p).lines)
    model = args.model or cfg["model"]
    e = estimate(cfg, model, EPISODES, chars)
    lines = [f"# Cost estimate — Episodes 07–22 with {model}", "",
             "| Episode | Basis | Characters | Audio (min) |", "|---|---|---|---|"]
    lines += [f"| {r['episode']} | {r['basis']} | {r['chars']} | {r['audio_seconds']/60:.1f} |" for r in e["rows"]]
    lines += ["", f"- Total audio: **{e['total_audio_minutes']:.0f} min**, about {e['requests']} TTS requests",
              f"- Tokens: ~{e['audio_tokens']:,} audio output, ~{e['input_tokens']:,} text input"]
    if e["usd"] is not None:
        lines.append(f"- Cost: **≈ ${e['usd']:.2f}**, or ≈ ${e['usd_with_overhead']:.2f} allowing "
                     f"{cfg['pricing_estimate']['regeneration_overhead']:.0%} regeneration")
    else:
        lines.append("- No price configured for this model in pipeline.json")
    lines.append(f"- Time at {cfg['requests_per_minute']} requests/min: ≈ {e['hours_at_rate_limit']:.1f} h")
    print("\n".join(lines))
    with open(os.path.join(paths.output, "cost_estimate.md"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines) + "\n")


def producer(paths, cfg, reg, backend):
    model_dir = os.environ.get("TTS_WHISPER_MODEL_DIR") or cfg["validation"].get("whisper_model_dir")
    return Producer(paths, cfg, reg, backend, Transcriber(model_dir))


def cmd_preview(args, paths, cfg, reg):
    be = FakeBackend() if args.fake else gemini(paths, cfg)
    ep = load_episode(paths, reg, os.path.join(paths.scripts, "episode_07_preview.txt"))
    name = args.out or ("preview" + ("_fake" if args.fake else ""))
    for pair in filter(None, (args.voice_override or "").split(",")):
        # Comparison only: changes this run in memory, never voice_registry.json.
        cid, voice = pair.split("=")
        reg.set_verification(cid, voice, "verified", "temporary comparison override")
        reg.characters[cid]["user_choice"] = f"{voice} (comparison)"
    out = os.path.join(paths.output, name)
    data, reviews = producer(paths, cfg, reg, be).produce(ep, out)
    print(f"preview: {out}/episode_{ep.episode}_full.wav ({data['duration_ms']/1000:.1f}s), flagged: {len(reviews)}")


def cmd_run(args, paths, cfg, reg):
    if not args.i_approve_paid_batch:
        sys.exit("The full batch is paid. Re-run with --i-approve-paid-batch after approving the preview and estimate.")
    if not glob.glob(os.path.join(paths.output, "preview", "episode_*_full.wav")):
        sys.exit("Generate and approve the preview first (python3 -m tts.pipeline preview).")
    be = gemini(paths, cfg)
    prod = producer(paths, cfg, reg, be)
    for ep_id in episode_range(args.episodes):
        p = script_path(paths, ep_id)
        if not os.path.exists(p):
            print(f"episode {ep_id}: no script at {p}, skipped")
            continue
        ep = load_episode(paths, reg, p)
        data, reviews = prod.produce(ep, os.path.join(paths.output, f"episode_{ep_id}"), export_app=args.export_app)
        print(f"episode {ep_id}: {data['duration_ms']/1000:.0f}s, {len(data['lines'])} lines, flagged {len(reviews)}")


def cmd_dry_run(args, paths, cfg, reg):
    ep = load_episode(paths, reg, args.script or script_path(paths, args.episode))
    out = os.path.join(paths.output, f"dryrun_episode_{ep.episode}")
    data, reviews = producer(paths, cfg, reg, FakeBackend()).produce(ep, out)
    print(f"dry run OK: {len(data['lines'])} lines, {data['duration_ms']/1000:.1f}s, output in {out}")


def cmd_status(args, paths, cfg, reg):
    for cid, c in sorted(reg.characters.items()):
        print(f"{cid:18s} {reg.voice_choice(cid):10s} api_voice={c.get('api_voice')!s:22s} {c.get('status')}")
    print(f"cached chunks: {len(glob.glob(os.path.join(paths.cache, '*.wav')))}")
    for ep in EPISODES:
        s = os.path.exists(script_path(paths, ep))
        done = os.path.exists(os.path.join(paths.output, f"episode_{ep}", f"episode_{ep}.json"))
        print(f"episode {ep}: script {'yes' if s else 'no '}  produced {'yes' if done else 'no'}")


def main(argv=None):
    ap = argparse.ArgumentParser(prog="python3 -m tts.pipeline", description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("verify-voices")
    e = sub.add_parser("estimate")
    e.add_argument("--model")
    pv = sub.add_parser("preview")
    pv.add_argument("--fake", action="store_true", help="offline test of the preview path, no API")
    pv.add_argument("--out", help="output folder name under tts/output")
    pv.add_argument("--voice-override", help="CHAR=voice_id,... for a comparison run (registry untouched)")
    r = sub.add_parser("run")
    r.add_argument("--episodes", default="07-22")
    r.add_argument("--i-approve-paid-batch", action="store_true")
    r.add_argument("--export-app", action="store_true")
    d = sub.add_parser("dry-run")
    d.add_argument("--episode", default="07")
    d.add_argument("--script")
    sub.add_parser("status")
    dg = sub.add_parser("diagnose-voice")
    dg.add_argument("--names", default="Enzo")
    lv = sub.add_parser("list-voices")
    lv.add_argument("--search", default="Arabic,Tunisian,Iraqi,Riko,Enzo,Lumi,Bodi,Sola,Ludo")
    args = ap.parse_args(argv)

    paths = Paths(ROOT)
    cfg = load_config(paths)
    reg = Registry(os.path.join(paths.config, "voice_registry.json"))
    {"verify-voices": cmd_verify, "estimate": cmd_estimate, "preview": cmd_preview, "run": cmd_run,
     "dry-run": cmd_dry_run, "status": cmd_status,
     "diagnose-voice": cmd_diagnose, "list-voices": cmd_list_voices}[args.cmd](args, paths, cfg, reg)


if __name__ == "__main__":
    main()
