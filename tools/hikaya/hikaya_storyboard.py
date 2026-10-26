#!/usr/bin/env python3
"""HIKAYA: build an episode's play-order script from a per-character TTS script.

TTS scripts are often written per character: all of the narrator's lines, then
all of al-Tijani's, and so on. That is the order the voices were recorded in,
not the order the episode is heard in. This tool keeps the text exactly as
written and only arranges it:

    python3 hikaya_storyboard.py list  Episode_10.txt
        numbered lines: N1, N1.2 (sentence 2 of narrator paragraph 1), T3, M2, X1 …

    python3 hikaya_storyboard.py build Episode_10.txt --spec order/ep10.json \\
        --images-dir ep10/images -o scripts/ep10.txt [--speakers speakers.json]

A reference is a whole line (N2), a sentence (N2.3), sentences (N2.1-2), or,
when an illustration needs a shorter piece of narration, clauses of a sentence
split at «،» «؛» «:» (N2.3/1, N2.3/2-3).

order/epNN.json lists the scenes in play order, each with its illustration
number and the lines it holds:

    {"episode": 10, "status": "proposed",
     "scenes": [{"image": 1, "title": "بغداد", "lines": ["N1.1-2"]},
                {"image": 2, "title": "مقام الشيخ عبد القادر", "lines": ["N1.3", "T1", "M1"]}]}

`build` refuses a spec that drops or repeats a line, or that changes the order
of one character's lines. The output is a hikaya_align.py script; every line
carries {src=…}, its place in the recording order, so alignment does not depend
on the play order. Text is copied verbatim; directions stay metadata.
"""

import argparse
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hikaya_common import write_json  # noqa: E402

SECTION_RE = re.compile(r"^\s*\[([^\[\]\n]{1,60}?)\s+[—–-]\s+([^\[\]\n]{1,40})\]\s*$")
DIRECTION_RE = re.compile(r"^\s*\[([^\]]*)\]\s*$")
EPISODE_RE = re.compile(r"الحلقة\s+0*(\d+)\s*[—–-]\s*(.+?)\s*$")
SENTENCE_END = re.compile(r"(?<=[.!؟?…])\s+")
CLAUSE_END = re.compile(r"(?<=[،؛:])\s+")

# Speaker ids for «ثم اهتديت»; any other label gets an id from its position.
SPEAKER_IDS = {
    "الراوي": ("NARRATOR", "N"),
    "التيجاني الصغير": ("AL_TIJANI_CHILD", "TC"),
    "التيجاني الشاب": ("AL_TIJANI", "T"),
    "الأب": ("FATHER", "FA"),
    "الأم": ("MOTHER", "MO"),
    "المعلم": ("TEACHER", "TQ"),
    "المصلي الأول": ("WORSHIPPER_1", "WA"),
    "المصلي الثاني": ("WORSHIPPER_2", "WB"),
    "الزوجة": ("WIFE", "WI"),
    "رفيق الرحلة": ("TRAVEL_COMPANION", "RC"),
    "أحد أهل المدينة": ("TOWNSMAN", "TW"),
    "أحد الطلاب": ("STUDENT", "ST"),
    "موفد الشيخ": ("SHEIKH_ENVOY", "SE"),
    "الشيخ إسماعيل الهديفي": ("SHEIKH_ISMAIL", "SI"),
    "أحد أتباع الطريقة": ("SUFI_FOLLOWER", "SF"),
    "أحمد المصري": ("AHMAD_EGYPTIAN", "AE"),
    "الشيخ عبد الباسط": ("SHEIKH_ABDULBASIT", "AB"),
    "عالم أزهري": ("AZHAR_SCHOLAR", "AZ"),
    "مسؤول مقام الإمام الحسين": ("HUSAYN_SHRINE_KEEPER", "HK"),
    "أحد الأقارب": ("RELATIVE", "RL"),
    "طالب": ("TUNISIAN_STUDENT", "TS"),
    "التيجاني": ("AL_TIJANI", "T"),
    "التيجاني الكبير": ("AL_TIJANI_ADULT", "TA"),
    "الأستاذ منعم": ("PROFESSOR_MUNIM", "M"),
    "والد منعم": ("MUNIM_FATHER", "MF"),
    "والدة منعم": ("MUNIM_MOTHER", "MM"),
    "باحث عراقي في المقام": ("SHRINE_RESEARCHER", "R"),
    "طالب حوزة": ("HAWZA_STUDENT", "HS"),
    "زائر في النجف": ("NAJAF_VISITOR", "V"),
    "السيد أبو شبر": ("ABU_SHUBAR", "AS"),
    "السيد محمد باقر الصدر": ("BAQIR_AL_SADR", "BS"),
    "البشير": ("AL_BASHIR", "B"),
    "قارئ الوثائق": ("DOCUMENT_READER", "DR"),
    "قارئ النصوص": ("TEXT_READER", "TR"),
    "محاور تونسي": ("TUNISIAN_INTERLOCUTOR", "TI"),
    "صديق تونسي": ("TUNISIAN_FRIEND", "TF"),
    "أحد أهل تونس": ("TUNISIAN_ELDER", "TE"),
}


def sentences(text):
    return [p.strip() for p in SENTENCE_END.split(text.strip()) if p.strip()]


def units(text):
    """The line as clauses: [(sentence number, clause number, text)]."""
    return [(i, j, c.strip()) for i, sent in enumerate(sentences(text), 1)
            for j, c in enumerate(CLAUSE_END.split(sent), 1) if c.strip()]


def parse_tts_script(path):
    """{episode, title, sections: [{label, voice, speaker, code, lines: [{ref, direction, text, sentences, src}]}]}"""
    ep = {"episode": None, "title": "", "sections": []}
    prev_blank, direction, extra = True, "", 0
    with open(path, encoding="utf-8-sig") as fh:
        rows = fh.read().splitlines()
    for raw in rows:
        line = raw.strip()
        sep = bool(re.match(r"^[=\-]{5,}$", line))
        m = EPISODE_RE.search(line)
        if m and ep["episode"] is None:
            ep["episode"], ep["title"] = int(m.group(1)), m.group(2).strip()
        elif SECTION_RE.match(line) and prev_blank:
            s = SECTION_RE.match(line)
            label = s.group(1).strip()
            if label in SPEAKER_IDS:
                speaker, code = SPEAKER_IDS[label]
            else:
                extra += 1
                speaker, code = f"SPEAKER_X{extra}", f"X{extra}"
            ep["sections"].append({"label": label, "voice": s.group(2).strip(), "speaker": speaker,
                                   "code": code, "lines": []})
            direction = ""
        elif DIRECTION_RE.match(line) and ep["sections"]:
            direction = DIRECTION_RE.match(line).group(1).strip()
        elif line.startswith("#"):
            pass  # a note (file, time range, review flag): not part of the text
        elif line and not sep and ep["sections"] and not m:
            sec = ep["sections"][-1]
            n = len(sec["lines"]) + 1
            si = len(ep["sections"])
            sec["lines"].append({"ref": f"{sec['code']}{n}", "direction": direction, "text": line,
                                 "sentences": sentences(line), "units": units(line),
                                 "src": f"{ep['episode']:02d}.{si:02d}.{n:02d}"})
            direction = ""
        prev_blank = not line or sep
    if ep["episode"] is None:
        raise SystemExit(f"{path}: no «الحلقة NN — title» heading found")
    codes = [s["code"] for s in ep["sections"]]
    if len(set(codes)) != len(codes):
        raise SystemExit(f"{path}: a character has two sections ({codes}); merge them in the script first")
    return ep


def index(ep):
    """ref → (section, line) for every line."""
    return {ln["ref"]: (sec, ln) for sec in ep["sections"] for ln in sec["lines"]}




def expand(ref, lines):
    """Resolve a reference to (line ref, [unit indices]): 'N2' whole line, 'N2.3' sentence 3,
    'N2.1-2' sentences 1–2, 'N2.3/1' clause 1 of sentence 3, 'N2.3/2-3' its clauses 2–3."""
    m = re.match(r"^([A-Z]+\d+)(?:\.(\d+)(?:-(\d+))?(?:/(\d+)(?:-(\d+))?)?)?$", ref)
    if not m or m.group(1) not in lines:
        raise SystemExit(f"unknown line reference {ref}")
    _, ln = lines[m.group(1)]
    us = ln["units"]
    if m.group(2) is None:
        return m.group(1), list(range(len(us)))
    a, b = int(m.group(2)), int(m.group(3) or m.group(2))
    if m.group(4) and m.group(3):
        raise SystemExit(f"{ref}: clauses can only be taken from one sentence")
    idx = [k for k, (si, cj, _) in enumerate(us) if a <= si <= b
           and (m.group(4) is None or int(m.group(4)) <= cj <= int(m.group(5) or m.group(4)))]
    if not idx:
        raise SystemExit(f"{ref}: no such sentence/clause in {m.group(1)}")
    return m.group(1), idx


def build(ep, spec, images_dir, image_name):
    lines = index(ep)
    used = {}          # line ref → unit indices used, in order of use
    order = {}         # speaker → last (line position, unit) used
    out = [f"@episode {ep['episode']}", f"@title {spec.get('title') or ep['title']}",
           f"# Play order {spec.get('status', 'proposed')}: built by hikaya_storyboard.py from the per-character",
           "# TTS script. Text is verbatim; {src=…} is the line's place in the recording order.", ""]
    for k, sc in enumerate(spec["scenes"], 1):
        img = sc.get("image")
        out.append(f"=== SCENE s{k:02d} | {sc.get('title', '')}".rstrip(" |"))
        out.append(f"@image {images_dir}/{image_name.format(n=img)}" if img else "@image none")
        if sc.get("layout"):
            out.append(f"@layout {sc['layout']}")
        groups = []    # consecutive pieces of the same line inside one scene become one script line
        for ref in sc["lines"]:
            lref, us = expand(ref, lines)
            sec, ln = lines[lref]
            pos = (sec["lines"].index(ln), us[0])
            last = order.get(sec["speaker"])
            if last is not None and pos <= last:
                raise SystemExit(f"scene {k}: {ref} comes before a line of {sec['label']} that was already used")
            order[sec["speaker"]] = (pos[0], us[-1])
            prev = used.setdefault(lref, [])
            if (prev and us[0] != prev[-1] + 1) or (not prev and us[0] != 0):
                raise SystemExit(f"scene {k}: {ref} skips or repeats part of {lref}")
            prev += us
            if groups and groups[-1][0] == lref and groups[-1][1][-1] + 1 == us[0]:
                groups[-1][1].extend(us)
            else:
                groups.append((lref, list(us)))
        for lref, us in groups:
            sec, ln = lines[lref]
            text = " ".join(ln["units"][i][2] for i in us)
            direction = ln["direction"] if us[0] == 0 and ln["direction"] else ""
            src = ln["src"] + (f".{us[0] + 1:02d}" if len(us) < len(ln["units"]) else "")
            out.append(f"{sec['speaker']} [{direction}] {{src={src}}}: {text}" if direction
                       else f"{sec['speaker']} {{src={src}}}: {text}")
        out.append("")
    missing = []
    for lref, (sec, ln) in lines.items():
        got = used.get(lref, [])
        if got != list(range(len(ln["units"]))):
            missing.append(lref if not got else f"{lref} (only part of it)")
    if missing:
        raise SystemExit(f"episode {ep['episode']}: lines not placed in any scene: {', '.join(missing)}")
    return "\n".join(out) + "\n"


def cmd_list(a):
    ep = parse_tts_script(a.script)
    print(f"episode {ep['episode']:02d} — {ep['title']}")
    for sec in ep["sections"]:
        print(f"\n[{sec['code']}] {sec['label']} — {sec['voice']}  → {sec['speaker']}")
        for ln in sec["lines"]:
            if len(ln["sentences"]) > 1:
                print(f"  {ln['ref']}  ({len(ln['sentences'])} sentences)")
            for i, s in enumerate(ln["sentences"], 1):
                cl = [u[2] for u in ln["units"] if u[0] == i]
                head = f"    {ln['ref']}.{i}" if len(ln["sentences"]) > 1 else f"  {ln['ref']}"
                print(f"{head}  {s}" if len(cl) == 1 else f"{head}  " + "  ‖".join(f"/{j} {c}" for j, c in enumerate(cl, 1)))


def cmd_build(a):
    ep = parse_tts_script(a.script)
    with open(a.spec, encoding="utf-8") as fh:
        spec = json.load(fh)
    if spec.get("episode") not in (None, ep["episode"]):
        raise SystemExit(f"spec is for episode {spec['episode']}, script is episode {ep['episode']}")
    text = build(ep, spec, a.images_dir.rstrip("/"), a.image_name)
    os.makedirs(os.path.dirname(os.path.abspath(a.output)), exist_ok=True)
    with open(a.output, "w", encoding="utf-8") as fh:
        fh.write(text)
    if a.speakers:
        names = {}
        if os.path.exists(a.speakers):
            with open(a.speakers, encoding="utf-8") as fh:
                names = json.load(fh)
        for sec in ep["sections"]:
            names.setdefault(sec["speaker"], sec["label"])
        write_json(a.speakers, names)
    n = sum(len(s["lines"]) for s in ep["sections"])
    print(f"episode {ep['episode']:02d}: {len(spec['scenes'])} scenes, {n} lines → {a.output}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    li = sub.add_parser("list")
    li.add_argument("script")
    b = sub.add_parser("build")
    b.add_argument("script")
    b.add_argument("--spec", required=True)
    b.add_argument("--images-dir", required=True, help="image folder relative to the book root, e.g. ep10/images")
    b.add_argument("--image-name", default="scene_{n:02d}.jpg")
    b.add_argument("-o", "--output", required=True)
    b.add_argument("--speakers", help="speakers.json to add display names to")
    a = ap.parse_args()
    {"list": cmd_list, "build": cmd_build}[a.cmd](a)


if __name__ == "__main__":
    main()
