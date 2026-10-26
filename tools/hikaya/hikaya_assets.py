#!/usr/bin/env python3
"""HIKAYA step 1–4: inspect, safely extract and inventory Audio.zip and IMG.zip.

    python3 hikaya_assets.py                       # uses ~/Downloads/Audio.zip and ~/Downloads/IMG.zip
    python3 hikaya_assets.py --audio PATH --images PATH --out ~/HIKAYA/assets

Never modifies the ZIP files and never overwrites an existing file. Writes:
  <out>/audio/ and <out>/images/         extracted originals (unchanged)
  <out>/scripts_clean/                   copies of the scripts with TTS directions removed
  <out>/originals.json                   every file: ZIP entry, path, size, SHA-256
  <out>/inventory.json, INVENTORY.md     counts, episodes, durations, images, duplicates, gaps
"""

import argparse
import collections
import datetime
import os
import re
import sys
import zipfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hikaya_common import (AUDIO_EXT, IMAGE_EXT, SCRIPT_EXT, clean_directions, guess_episodes, guess_scene,  # noqa: E402
                           probe_audio, probe_image, safe_extract, sha256, write_json)

EXPECTED_EPISODES = list(range(1, 23))
BATCHES = {1: list(range(10, 15)), 2: list(range(15, 20)), 3: list(range(20, 23))}  # «Batch 1» folder → Ep 10–14
VOICES = {"riko": "NARRATOR", "enzo": "AL_TIJANI", "ludo": "PROFESSOR_MUNIM", "lumi": "MOTHER", "bodi": "FATHER",
          "sola": "WIFE"}
SPEAKER_NAMES = {
    "الراوي": "NARRATOR", "راوي": "NARRATOR", "narrator": "NARRATOR",
    "التيجاني": "AL_TIJANI", "محمد التيجاني": "AL_TIJANI", "tijani": "AL_TIJANI",
    "منعم": "PROFESSOR_MUNIM", "الأستاذ منعم": "PROFESSOR_MUNIM", "munim": "PROFESSOR_MUNIM",
    "الأم": "MOTHER", "الام": "MOTHER", "mother": "MOTHER",
    "الأب": "FATHER", "الاب": "FATHER", "father": "FATHER",
    "الزوجة": "WIFE", "wife": "WIFE",
}
LINE_RE = re.compile(r"^\s*(?:\*\*)?([^:\[\]\n]{1,40}?)(?:\*\*)?\s*(?:\[[^\]]*\])?\s*[:：]\s*(.+)$")
# Scripts written per character: a header «[الراوي — Riko]» followed by that character's lines.
SECTION_RE = re.compile(r"^\s*\[([^\[\]\n]{1,60}?)\s+[—–-]\s+([^\[\]\n]{1,40})\]\s*$")
DIRECTION_ONLY_RE = re.compile(r"^\s*\[[^\]]*\]\s*$")
PLACEHOLDER_RE = re.compile(r"غير متوفر|UNAVAILABLE|DO NOT SYNTHESIZE")


def read_text(path):
    ext = os.path.splitext(path)[1].lower()
    if ext == ".docx":
        with zipfile.ZipFile(path) as z:
            xml = z.read("word/document.xml").decode("utf-8", "ignore")
        xml = re.sub(r"</w:p>", "\n", xml)
        return re.sub(r"<[^>]+>", "", xml)
    with open(path, "rb") as fh:
        raw = fh.read()
    for enc in ("utf-8-sig", "utf-16", "cp1256"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", "ignore")


def speaker_of(label):
    l = label.strip().strip("*").strip()
    low = l.lower()
    for key, cid in SPEAKER_NAMES.items():
        if key in low:
            return cid
    for v, cid in VOICES.items():
        if v in low:
            return cid
    m = re.match(r"(speaker_\d+)", low)
    return m.group(1).upper() if m else None


def analyse_script(path):
    text = read_text(path)
    speakers = collections.Counter()
    unknown = collections.Counter()
    sections = []
    lines = 0
    current = None
    prev_blank = True
    for line in text.splitlines():
        sec = SECTION_RE.match(line) if prev_blank else None
        prev_blank = not line.strip() or bool(re.match(r"^\s*[=\-]{5,}\s*$", line))
        if sec:
            current = speaker_of(sec.group(1)) or speaker_of(sec.group(2)) or sec.group(1).strip()
            sections.append({"label": sec.group(1).strip(), "voice": sec.group(2).strip(), "speaker": current, "lines": 0})
            continue
        if current and line.strip() and not DIRECTION_ONLY_RE.match(line) and not re.match(r"^\s*[=\-]{5,}", line):
            speakers[current] += 1
            sections[-1]["lines"] += 1
            lines += 1
            continue
        m = LINE_RE.match(line)
        if not m:
            continue
        cid = speaker_of(m.group(1))
        if cid:
            speakers[cid] += 1
            lines += 1
        elif len(m.group(1).split()) <= 3:
            unknown[m.group(1).strip()] += 1
    clean, removed, kept = clean_directions(text)
    return {
        "chars": len(text),
        "dialogue_lines": lines,
        "placeholder": lines == 0 and bool(PLACEHOLDER_RE.search(text)),
        "speakers": dict(speakers),
        "sections": sections,
        "unrecognised_labels": dict(unknown.most_common(15)),
        "directions_removed": len(removed),
        "direction_examples": sorted(set(removed))[:15],
        "brackets_kept_for_review": sorted(set(kept))[:15],
    }, clean


def kind_of(path):
    ext = os.path.splitext(path)[1].lower()
    if ext == ".zip":
        return "archive"
    return "audio" if ext in AUDIO_EXT else "image" if ext in IMAGE_EXT else "script" if ext in SCRIPT_EXT else "other"


def inspect_zip(path):
    info = {"path": path, "exists": os.path.exists(path)}
    if not info["exists"]:
        return info
    info["size_bytes"] = os.path.getsize(path)
    info["sha256"] = sha256(path)
    try:
        with zipfile.ZipFile(path) as z:
            bad = z.testzip()
            entries = [i for i in z.infolist() if not i.is_dir()]
            info.update(valid=bad is None, first_bad_entry=bad, entries=len(entries),
                        uncompressed_bytes=sum(i.file_size for i in entries))
    except zipfile.BadZipFile as e:
        info.update(valid=False, error=str(e))
    return info


def main():
    home = os.path.expanduser("~")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--audio", default=os.path.join(home, "Downloads", "Audio.zip"))
    ap.add_argument("--images", default=os.path.join(home, "Downloads", "IMG.zip"))
    ap.add_argument("--out", default=os.path.join(home, "HIKAYA", "assets"))
    args = ap.parse_args()

    zips = {"audio": inspect_zip(args.audio), "images": inspect_zip(args.images)}
    missing = [k for k, z in zips.items() if not z["exists"]]
    if missing:
        for k in missing:
            print(f"✗ {k} archive not found: {zips[k]['path']}  — pass its location with --{k} PATH")
        sys.exit(2)
    for k, z in zips.items():
        if not z.get("valid"):
            print(f"✗ {k} archive is damaged: {z.get('error') or z.get('first_bad_entry')}")
            sys.exit(3)

    os.makedirs(args.out, exist_ok=True)
    records, rejected = [], []
    for k, z in zips.items():
        files, rej = safe_extract(z["path"], os.path.join(args.out, k))
        rejected += [{**r, "archive": k} for r in rej]
        for f in files:
            records.append({"archive": k, **f, "size": os.path.getsize(f["path"]), "sha256": sha256(f["path"]),
                            "kind": kind_of(f["path"]), "episodes": guess_episodes(f["entry"], BATCHES)})

    by_hash = collections.defaultdict(list)
    for r in records:
        by_hash[r["sha256"]].append(r["entry"])
    duplicates = [v for v in by_hash.values() if len(v) > 1]
    name_clashes = [r["entry"] for r in records if r["renamed"]]

    audio, images, scripts = [], [], []
    clean_dir = os.path.join(args.out, "scripts_clean")
    for r in records:
        if r["kind"] == "audio":
            audio.append({**r, **probe_audio(r["path"])})
        elif r["kind"] == "image":
            images.append({**r, "scene": guess_scene(r["entry"]), **probe_image(r["path"])})
        elif r["kind"] == "script":
            try:
                analysis, clean = analyse_script(r["path"])
            except Exception as e:  # noqa: BLE001 - reported
                analysis, clean = {"error": str(e)}, None
            if clean is not None and analysis.get("directions_removed"):
                rel = os.path.relpath(r["path"], os.path.join(args.out, r["archive"]))
                target = os.path.join(clean_dir, os.path.splitext(rel)[0] + ".clean.txt")
                os.makedirs(os.path.dirname(target), exist_ok=True)
                with open(target, "w", encoding="utf-8") as fh:
                    fh.write(clean)
                analysis["clean_copy"] = target
            scripts.append({**r, **analysis})

    covered = collections.defaultdict(lambda: {"audio": 0, "scripts": 0, "images": 0, "batch_files": 0})
    for group, key in ((audio, "audio"), (scripts, "scripts"), (images, "images")):
        for r in group:
            if key == "scripts" and not r.get("dialogue_lines"):
                continue  # a placeholder page («script unavailable») is not a script
            for e in r["episodes"]:
                covered[e][key] += 1
                if len(r["episodes"]) > 1:
                    covered[e]["batch_files"] += 1
    per_episode = {e: covered[e] for e in EXPECTED_EPISODES}
    gaps = {k: [e for e in EXPECTED_EPISODES if per_episode[e][k] == 0] for k in ("audio", "scripts", "images")}
    placeholders = sorted({e for r in scripts if r.get("placeholder") for e in r["episodes"]})
    unassigned = {k: [r["entry"] for r in g if not r["episodes"]] for k, g in
                  (("audio", audio), ("scripts", scripts), ("images", images))}
    voices_seen = collections.Counter()
    for r in audio:
        low = r["entry"].lower()
        for v in VOICES:
            if v in low:
                voices_seen[v] += 1

    inventory = {
        "generated": datetime.datetime.now().isoformat(timespec="seconds"),
        "archives": zips,
        "counts": {"audio": len(audio), "scripts": len(scripts), "images": len(images),
                   "archives_inside": sum(1 for r in records if r["kind"] == "archive"),
                   "other": sum(1 for r in records if r["kind"] == "other")},
        "audio_total_minutes": round(sum(a.get("duration_s", 0) or 0 for a in audio) / 60, 1),
        "episodes": per_episode,
        "missing": gaps,
        "script_placeholders": placeholders,
        "unassigned_to_episode": unassigned,
        "voice_names_in_filenames": dict(voices_seen),
        "duplicates_same_content": duplicates,
        "renamed_to_avoid_overwrite": name_clashes,
        "rejected_entries": rejected,
        "audio": [{k: a.get(k) for k in ("entry", "episodes", "duration_s", "codec", "sample_rate", "channels", "size")}
                  for a in audio],
        "images": [{k: i.get(k) for k in ("entry", "episodes", "scene", "width", "height", "aspect", "format", "damaged")}
                   for i in images],
        "scripts": [{k: s.get(k) for k in ("entry", "episodes", "dialogue_lines", "speakers", "unrecognised_labels",
                                            "directions_removed", "direction_examples", "brackets_kept_for_review",
                                            "placeholder", "sections", "clean_copy", "error")} for s in scripts],
    }
    write_json(os.path.join(args.out, "inventory.json"), inventory)
    write_json(os.path.join(args.out, "originals.json"),
               [{k: r[k] for k in ("archive", "entry", "path", "size", "sha256")} for r in records])

    md = ["# HIKAYA asset inventory", "", f"Generated {inventory['generated']}", "",
          "| Archive | Size | Entries | Valid | SHA-256 |", "|---|---|---|---|---|"]
    for k, z in zips.items():
        md.append(f"| {k} | {z['size_bytes'] / 1e6:.1f} MB | {z['entries']} | {'yes' if z['valid'] else 'NO'} | "
                  f"`{z['sha256'][:16]}…` |")
    c = inventory["counts"]
    md += ["", f"**Audio files:** {c['audio']} ({inventory['audio_total_minutes']} min) · **Scripts:** {c['scripts']} · "
               f"**Images:** {c['images']} · ZIPs inside the ZIPs (extracted): {c['archives_inside']} · other: {c['other']}", "",
           "| Episode | Audio | Batch files | Scripts | Images |", "|---|---|---|---|---|"]
    for e, v in per_episode.items():
        md.append(f"| {e:02d} | {v['audio']} | {v['batch_files']} | {v['scripts']} | {v['images']} |")
    md += ["", "## Missing", ""] + [f"- {k}: episodes {', '.join(map(str, v)) or 'none'}" for k, v in gaps.items()]
    if placeholders:
        md.append(f"- script files that only say the script is unavailable: episodes {', '.join(map(str, placeholders))}")
    md += ["", "## Recordings per episode", "", "| Episode(s) | File | Duration | Format |", "|---|---|---|---|"]
    for a in sorted(audio, key=lambda a: (a["episodes"][:1] or [99], a["entry"])):
        eps = a["episodes"]
        label = "—" if not eps else f"{eps[0]:02d}" if len(eps) == 1 else f"{eps[0]:02d}–{eps[-1]:02d}"
        dur = a.get("duration_s") or 0
        md.append(f"| {label} | {a['entry']} | {int(dur // 60)}:{dur % 60:04.1f} | "
                  f"{a.get('codec')} {a.get('sample_rate')} Hz × {a.get('channels')} |")
    md += ["", "## Files not matched to an episode (need a manual decision)", ""]
    for k, v in unassigned.items():
        md += [f"- {k}: {len(v)}"] + [f"  - {x}" for x in v[:40]]
    md += ["", f"## Duplicates (same content): {len(duplicates)}", ""] + [f"- {' = '.join(d)}" for d in duplicates[:40]]
    md += ["", f"## Rejected unsafe ZIP entries: {len(rejected)}", ""] + [f"- {r['entry']}: {r['reason']}" for r in rejected]
    md += ["", "## Scripts and TTS directions", ""]
    for s in scripts:
        md.append(f"- {s['entry']}: {s.get('dialogue_lines', 0)} lines, speakers {s.get('speakers', {})}, "
                  f"{s.get('directions_removed', 0)} directions removed")
        if s.get("brackets_kept_for_review"):
            md.append(f"  - brackets kept for review: {', '.join(s['brackets_kept_for_review'])}")
    damaged = [i["entry"] for i in images if i.get("damaged")]
    md += ["", f"## Damaged images: {len(damaged)}", ""] + [f"- {d}" for d in damaged]
    with open(os.path.join(args.out, "INVENTORY.md"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(md) + "\n")

    print("\n".join(md[:12 + len(per_episode) + 6]))
    print(f"\nFull report: {os.path.join(args.out, 'INVENTORY.md')}")


if __name__ == "__main__":
    main()
