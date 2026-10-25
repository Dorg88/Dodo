#!/usr/bin/env python3
"""HIKAYA book packager: check a book folder and build the ZIP the app imports.

    python3 hikaya_pack.py init  MyBook --id my_book --title "عنوان الكتاب" --author "المؤلف"
    python3 hikaya_pack.py check MyBook
    python3 hikaya_pack.py build MyBook [-o my_book.zip]

The folder holds book.json, a cover, and one folder per episode with its
episode.json, images and audio (see docs/BOOK_FORMAT.md). `build` runs the same
checks as the app's importer, then writes a ZIP containing only book.json, the
files the book actually references, and checksums.json. Media is stored
uncompressed (it is already compressed) so the phone imports it quickly.
Standard library only.
"""

import argparse
import datetime
import json
import os
import re
import sys
import zipfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hikaya_common import IMAGE_EXT, probe_image, sha256, unsafe_entry  # noqa: E402

ID_RE = re.compile(r"^[a-z0-9][a-z0-9_\-]{0,63}$")
STORED = {".mp3", ".m4a", ".aac", ".ogg", ".opus", ".jpg", ".jpeg", ".png", ".webp", ".mp4"}


def load(path):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def check(folder):
    """Return (errors, warnings, files, summary) — mirrors the app's validator."""
    errors, warnings, files = [], [], {"book.json"}
    summary = {"episodes": 0, "playable": 0, "segments": 0, "unverified": 0, "minutes": 0.0}
    bp = os.path.join(folder, "book.json")
    if not os.path.exists(bp):
        return ["book.json is missing"], warnings, files, summary
    try:
        book = load(bp)
    except json.JSONDecodeError as e:
        return [f"book.json is not valid JSON: {e}"], warnings, files, summary
    if not ID_RE.match(book.get("id", "")):
        errors.append(f'book id "{book.get("id")}" must be lowercase latin letters, digits, _ or -')
    if not str(book.get("title", "")).strip():
        errors.append("book title is missing")
    if book.get("cover"):
        files.add(book["cover"])
        if not os.path.exists(os.path.join(folder, book["cover"])):
            warnings.append(f"cover {book['cover']} is missing")
    numbers = set()
    for e in book.get("episodes", []):
        summary["episodes"] += 1
        n = e.get("number")
        if n in numbers:
            errors.append(f"episode number {n} is used twice")
        numbers.add(n)
        man = e.get("manifest")
        if not man:
            continue
        mp = os.path.join(folder, man)
        if not os.path.exists(mp):
            errors.append(f"episode {n}: {man} is missing")
            continue
        files.add(man)
        try:
            ep = load(mp)
        except json.JSONDecodeError as ex:
            errors.append(f"episode {n}: invalid JSON ({ex})")
            continue
        audio = ep.get("audio", {})
        refs = {v for k, v in audio.items() if k in ("voice", "music", "sfx") and v}
        segs = ep.get("segments", [])
        if not segs:
            errors.append(f"episode {n}: no segments")
            continue
        if audio.get("mode") == "clips":
            for s in segs:
                if not s.get("clip"):
                    errors.append(f"episode {n}: segment {s.get('id')} has no clip (clips mode)")
                else:
                    refs.add(s["clip"]["file"])
        elif not audio.get("voice"):
            errors.append(f"episode {n}: track mode needs audio.voice")
        for sc in ep.get("scenes", []):
            if sc.get("image"):
                refs.add(sc["image"])
        ok = True
        for r in sorted(refs):
            if unsafe_entry(r):
                errors.append(f"episode {n}: unsafe path {r}")
                ok = False
                continue
            files.add(r)
            if not os.path.exists(os.path.join(folder, r)):
                if os.path.splitext(r)[1].lower() in IMAGE_EXT:
                    warnings.append(f"episode {n}: image {r} is missing")
                else:
                    errors.append(f"episode {n}: audio {r} is missing")
                    ok = False
        prev = -1
        for s in segs:
            if s["startMs"] < prev:
                errors.append(f"episode {n}: segment {s['id']} starts before the previous one ends")
            prev = s["endMs"]
            if "[" in s.get("text", ""):
                warnings.append(f"episode {n}: segment {s['id']} text still contains [brackets]")
        unver = sum(1 for s in segs if s.get("timing", "verified") != "verified")
        if unver:
            warnings.append(f"episode {n}: {unver} segment(s) with unverified timing")
        summary["segments"] += len(segs)
        summary["unverified"] += unver
        summary["minutes"] += ep.get("durationMs", segs[-1]["endMs"]) / 60000
        if ok:
            summary["playable"] += 1
    if summary["playable"] == 0:
        errors.append("the book has no playable episodes")
    for f in sorted(files):
        p = os.path.join(folder, f)
        if os.path.splitext(f)[1].lower() in IMAGE_EXT and os.path.exists(p):
            info = probe_image(p)
            if info.get("damaged"):
                errors.append(f"image {f} is damaged: {info['damaged']}")
            elif info.get("width", 0) > 4096:
                warnings.append(f"image {f} is {info['width']}px wide; 1600–2400px is plenty for phones")
    return errors, warnings, files, summary


def cmd_init(a):
    os.makedirs(a.folder, exist_ok=True)
    bp = os.path.join(a.folder, "book.json")
    if os.path.exists(bp):
        sys.exit(f"{bp} already exists — not overwriting")
    book = {"schema": "hikaya.book.v1", "id": a.id, "title": a.title, "subtitle": "", "author": a.author,
            "description": "", "language": "ar", "version": 1, "cover": "cover.jpg", "episodes": []}
    with open(bp, "w", encoding="utf-8") as fh:
        json.dump(book, fh, ensure_ascii=False, indent=1)
    print(f"created {bp}. Add cover.jpg and episode folders, then run: hikaya_pack.py check {a.folder}")


def report(errors, warnings, summary):
    print(f"episodes: {summary['episodes']} ({summary['playable']} playable) · segments: {summary['segments']} · "
          f"{summary['minutes']:.1f} min · unverified timing: {summary['unverified']}")
    for e in errors:
        print(f"  ✗ {e}")
    for w in warnings[:60]:
        print(f"  • {w}")
    if len(warnings) > 60:
        print(f"  … {len(warnings) - 60} more warnings")


def cmd_check(a):
    errors, warnings, _, summary = check(a.folder)
    report(errors, warnings, summary)
    print("OK — ready to build" if not errors else "NOT READY")
    sys.exit(1 if errors else 0)


def cmd_build(a):
    errors, warnings, files, summary = check(a.folder)
    report(errors, warnings, summary)
    if errors:
        sys.exit("fix the errors above before building")
    book = load(os.path.join(a.folder, "book.json"))
    out = a.output or f"{book['id']}-v{book.get('version', 1)}.zip"
    present = sorted(f for f in files if os.path.exists(os.path.join(a.folder, f)))
    checksums = {f: sha256(os.path.join(a.folder, f)) for f in present}
    manifest = {"book": book["id"], "version": book.get("version", 1),
                "built": datetime.datetime.now().isoformat(timespec="seconds"), "files": checksums}
    tmp = out + ".tmp"
    with zipfile.ZipFile(tmp, "w") as z:
        for f in present:
            method = zipfile.ZIP_STORED if os.path.splitext(f)[1].lower() in STORED else zipfile.ZIP_DEFLATED
            z.write(os.path.join(a.folder, f), f, compress_type=method)
        z.writestr("checksums.json", json.dumps(manifest, ensure_ascii=False, indent=1), compress_type=zipfile.ZIP_DEFLATED)
    os.replace(tmp, out)
    print(f"built {out}: {len(present)} files, {os.path.getsize(out) / 1e6:.1f} MB")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    i = sub.add_parser("init")
    i.add_argument("folder")
    i.add_argument("--id", required=True)
    i.add_argument("--title", required=True)
    i.add_argument("--author", default="")
    c = sub.add_parser("check")
    c.add_argument("folder")
    b = sub.add_parser("build")
    b.add_argument("folder")
    b.add_argument("-o", "--output")
    a = ap.parse_args()
    {"init": cmd_init, "check": cmd_check, "build": cmd_build}[a.cmd](a)


if __name__ == "__main__":
    main()
