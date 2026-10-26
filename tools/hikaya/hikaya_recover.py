#!/usr/bin/env python3
"""HIKAYA: recover an episode's script in the per-character format.

Two sources, never mixed and always labelled:

  * an original script kept in the project (Episode 01: the script the first
    session worked from, stored with its directions and verified cut points in
    production/ep01/episode_source.json):

        python3 hikaya_recover.py source production/ep01/episode_source.json \\
            --files files_ep01.json -o recovered/Episode_01.txt

  * the recordings themselves, when no script exists. Every passage is what
    the transcriber heard; directions are kept only when the voice engine read
    them aloud (directions that were not spoken cannot be recovered):

        python3 hikaya_recover.py audio --episode 2 --title "من قفصة إلى بيت الله" \\
            --speakers speakers_ep02.json --cache ~/HIKAYA/transcripts_large \\
            --model large-v3 [--check-cache ~/HIKAYA/transcripts --check-model large-v3-turbo] \\
            --directions-from ALL_EPISODES_01_22.txt -o recovered/Episode_02.txt

speakers_epNN.json lists the recordings in the order the characters should
appear, with each character's name and the reason for the attribution:
    [{"file": "/…/Ep2/Narrator2.wav", "label": "الراوي", "basis": "file name"}, …]

Output: the script (sections «[name — file]», bracketed directions, verbatim
text; «#» lines give the file and the time range of each passage) and, next
to it, a review table (Markdown + CSV) with both transcripts and their
agreement. The script format is the one hikaya_storyboard.py reads.
"""

import argparse
import csv
import difflib
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hikaya_common import DIRECTION_WORDS, sha256  # noqa: E402

RULE = "=" * 78
DIACRITICS = re.compile("[\\u0617-\\u061A\\u064B-\\u0652\\u0670\\u06D6-\\u06ED\\u0640]")


def norm_word(w):
    t = DIACRITICS.sub("", w)
    t = re.sub("[إأآٱ]", "ا", t).replace("ى", "ي").replace("ة", "ه")
    return re.sub(r"[^ء-ي0-9a-zA-Z]", "", t)


def header(episode, title, status_lines):
    return [RULE, f"الحلقة {episode:02d} — {title}", RULE] + status_lines + [""]


# --- Episode 01: the project's original script --------------------------------------------

def from_source(src_path, files):
    """Per-character script from episode_source.json. Passages that the first
    session split only to change the picture mid-passage (same speaker, same
    direction, consecutive in the recording) are joined back."""
    with open(src_path, encoding="utf-8") as fh:
        d = json.load(fh)
    order, sections = [], {}
    prev = None
    for s in d["segments"]:
        spk = s["speaker"]
        text = " ".join(ln["text"] for ln in s["lines"])
        if spk not in sections:
            sections[spk] = []
            order.append(spk)
        lines = sections[spk]
        joined = (prev is not None and prev["speaker"] == spk and prev.get("direction") == s.get("direction")
                  and prev.get("source") == s.get("source") and abs(prev["out"] - s["in"]) < 0.01)
        if joined and lines:
            lines[-1]["text"] += " " + text
            lines[-1]["out"] = s["out"]
            lines[-1]["ids"].append(s["id"])
        else:
            lines.append({"direction": s.get("direction", ""), "text": text, "source": s.get("source"),
                          "in": s["in"], "out": s["out"], "ids": [s["id"]]})
        prev = s
    out = header(d["number"], d["title"], [
        "حالة النص: النص الأصلي — مستعاد حرفيا من ملفات المشروع (production/ep01/episode_source.json)،",
        "وهو النص الذي بُنيت عليه الحلقة الأولى وطوبق مع التسجيلات في الجلسة الأولى. تعليمات الأداء أصلية.",
        "سطر «نهاية الحلقة الأولى.» موجود في النص لكنه غير مسجل في الملفات الصوتية.",
    ])
    for spk in order:
        name = d["speakers"][spk]["name"]
        lines = sections[spk]
        f = files.get(lines[0]["source"], lines[0]["source"])
        out.append(f"[{name} — {f}]")
        for ln in lines:
            out.append(f"# {f} · {ln['in']:.2f}–{ln['out']:.2f} ث · مقاطع: {', '.join(ln['ids'])}")
            if ln["direction"]:
                out.append(f"[{ln['direction']}]")
            out.append(ln["text"])
        out.append("")
    return "\n".join(out) + "\n"


# --- Episodes without a script: the recordings ------------------------------------------------

def direction_vocabulary(paths):
    """First words of the delivery directions found in the episodes that do have
    scripts («بنبرة», «بهدوء», «باهتمام» …), normalised."""
    vocab = set()
    for p in paths:
        with open(p, encoding="utf-8") as fh:
            for line in fh:
                m = re.match(r"^\s*\[([^\]—–]{1,60})\]\s*$", line)
                if m:
                    first = m.group(1).split()[0]
                    if first.startswith("ب"):
                        vocab.add(norm_word(first))
    vocab.update(norm_word(w) for w in DIRECTION_WORDS if w.startswith("ب"))
    return vocab


# common words opening with «ب» that never start a delivery direction
NOT_DIRECTION = {"بدايه", "بعد", "بين", "بل", "بها", "به", "بيت", "بني", "بلد", "بكل", "بذلك", "بهذه", "بهذا",
                 "بسبب", "بالله", "بعض", "بقي", "بقيت", "بلغ", "بدا", "بدات", "بدا", "بينما"}

# phrases the transcriber invents in the silence at the end of a recording
HALLUCINATIONS = [["اشتركوا", "في", "القناه"], ["شكرا", "للمشاهده"], ["ترجمه", "نانسي", "قنقر"], ["شكرا"]]


def drop_hallucinations(words, duration):
    """Remove a known invented phrase when it closes the recording (within its
    last 1.5 s). Returns (words, removed text)."""
    toks = [norm_word(w["w"]) for w in words]
    for h in HALLUCINATIONS:
        n = len(h)
        if len(toks) >= n and toks[-n:] == h and words[-n]["s"] >= duration - 1.5:
            return words[:-n], " ".join(w["w"] for w in words[-n:])
    return words, ""


def looks_like_direction(words, vocab):
    """A short phrase opening with a manner word used in the scripts' directions."""
    toks = [norm_word(w) for w in words if norm_word(w)]
    if not toks or len(toks) > 12 or not toks[0].startswith("ب") or toks[0] in NOT_DIRECTION:
        return False
    if toks[0] in vocab:
        return True
    best = max((difflib.SequenceMatcher(None, toks[0], v).ratio() for v in vocab), default=0)
    return best >= 0.8 and len(toks[0]) >= 4


def load_words(cache_dir, model, path):
    from hikaya_transcribe import cache_path
    cp = cache_path(cache_dir, sha256(path), model)
    if not os.path.exists(cp):
        return None
    with open(cp, encoding="utf-8") as fh:
        t = json.load(fh)
    return [w for s in t["segments"] for w in s["words"] if w["w"].strip()]


def pauses(path, min_frames=12):
    """Pauses of the recording as the ear hears them: quieter than the voice's
    median level by 8 dB or more, so a breath between two phrases counts as a
    pause (the voice engine breathes at most phrase ends)."""
    import numpy as np
    from hikaya_align import frame_db, load_audio, silences, speech_threshold
    db = frame_db(load_audio(path))
    thr = min(speech_threshold(db) + 12, float(np.percentile(db, 50)) - 8)
    return silences(db, thr, min_frames=min_frames)


def pause_between(sil, a, b):
    """Longest measured pause overlapping the gap between two words."""
    best = 0.0
    for s, e in sil:
        ov = min(e, b) - max(s, a)
        if ov > 0:
            best = max(best, e - s)
    return best


def phrases(words, sil):
    """Split the word stream at measured pauses of at least 0.3 s."""
    out, cur = [], []
    for i, w in enumerate(words):
        if cur:
            gap = pause_between(sil, words[i - 1]["e"] - 0.25, w["e"] - 0.05)
            if gap >= 0.3:
                out.append(cur)
                cur = []
        cur.append(w)
    if cur:
        out.append(cur)
    return out


def split_leading_direction(ph, vocab):
    """«بتردد خفيف، نحن نرى…» heard as one phrase: separate the direction."""
    for k in range(min(5, len(ph) - 1), 0, -1):
        if looks_like_direction([w["w"] for w in ph[:k]], vocab) and ph[k - 1]["w"].endswith(("،", ",")):
            return [ph[:k], ph[k:]]
    return [ph]


HEADS = {"بنبره", "بصوت", "بنبر", "بلهجه"}


def complete_direction(phs, sil, vocab):
    """«بنبرة» | «هادئة تحمل شيئا من الفضول حتى اسمه…»: the voice paused after the
    first word of the direction only. Move the rest of the direction (up to the
    first short pause within six words) from the next phrase into it."""
    out = []
    i = 0
    while i < len(phs):
        ph = phs[i]
        toks = [norm_word(w["w"]) for w in ph if norm_word(w["w"])]
        nxt = phs[i + 1] if i + 1 < len(phs) else None
        if nxt and toks and toks[-1] in HEADS and looks_like_direction([w["w"] for w in ph], vocab):
            if len(nxt) <= 6 and i + 2 < len(phs):
                out.append(ph + nxt)          # «وصفية رزينة» said on its own, then a pause
                i += 2
                continue
            cut = next((k for k in range(1, min(7, len(nxt))) if
                        pause_between(sil, nxt[k - 1]["e"] - 0.1, nxt[k]["s"] + 0.15) >= 0.12), None)
            if cut:
                out += [ph + nxt[:cut], nxt[cut:]]
                i += 2
                continue
        out.append(ph)
        i += 1
    return out


def recover_file(path, words, sil, vocab, fine_sil=None, spans=()):
    """[(kind, text, start, end)] with kind 'direction' or 'line'; consecutive
    spoken phrases between two directions form one line. `spans` are time ranges
    confirmed by hand as spoken directions (words a pause does not separate)."""
    def forced(w):
        return any(a - 0.02 <= w["s"] < b for a, b in spans)

    items = []
    for ph in complete_direction(phrases(words, sil), fine_sil or sil, vocab):
        runs = []
        for w in ph:
            if runs and forced(w) == forced(runs[-1][-1]):
                runs[-1].append(w)
            else:
                runs.append([w])
        parts = []
        for run in runs:
            parts += [(run, True)] if forced(run[0]) else [(p, False) for p in split_leading_direction(run, vocab)]
        for part, by_hand in parts:
            kind = "direction" if by_hand or looks_like_direction([w["w"] for w in part], vocab) else "line"
            if items and items[-1][0] == kind:
                items[-1][1].extend(part)
            else:
                items.append([kind, list(part)])
    return items


def apply_direction_text(items, phrases_):
    """Hand-confirmed direction words left in a passage («[بصوت متأثر] تغمره مشاعر
    الشوق كنت أحلم…»): matched as a word sequence, moved into the direction before
    the passage, or taken out as a direction of their own inside it."""
    for phrase in phrases_:
        want = [norm_word(w) for w in phrase.split() if norm_word(w)]
        n = len(want)
        for i, (kind, ws) in enumerate(items):
            if kind != "line":
                continue
            toks = [norm_word(w["w"]) for w in ws]
            at = next((k for k in range(len(toks) - n + 1) if toks[k:k + n] == want), None)
            if at is None:
                continue
            before, mid, after = ws[:at], ws[at:at + n], ws[at + n:]
            new = ([["line", before]] if before else []) + [["direction", mid]] + ([["line", after]] if after else [])
            items[i:i + 1] = new
            break
    merged = []
    for kind, ws in items:            # a direction next to a direction is one direction
        if merged and merged[-1][0] == kind == "direction":
            merged[-1][1].extend(ws)
        else:
            merged.append([kind, ws])
    return [(k, " ".join(w["w"] for w in ws).strip().rstrip("،,. ") if k == "direction" else
             " ".join(w["w"] for w in ws).strip(), ws[0]["s"], ws[-1]["e"]) for k, ws in merged]


def agreement(a, b):
    ta = [norm_word(w) for w in a.split() if norm_word(w)]
    tb = [norm_word(w) for w in b.split() if norm_word(w)]
    return difflib.SequenceMatcher(None, ta, tb, autojunk=False).ratio() if ta or tb else 1.0


def text_between(words, s, e):
    return " ".join(w["w"] for w in words if w["s"] >= s - 0.05 and w["e"] <= e + 0.05).strip()


def from_audio(a):
    vocab = direction_vocabulary(a.directions_from)
    with open(a.speakers, encoding="utf-8") as fh:
        speakers = json.load(fh)
    out = header(a.episode, a.title, [
        "حالة النص: نص مستعاد من التسجيلات الصوتية — ليس النص الأصلي.",
        "النص الأصلي لهذه الحلقة غير موجود في الملفات المسلّمة. كل مقطع أدناه هو ما سُمع في التسجيل",
        f"(تفريغ آلي محلي بنموذج {a.model}) ويحتاج إلى مراجعة بالسماع. التعليمات بين الأقواس هي التي",
        "نطقها محرك الصوت فعلا فظهرت في التسجيل؛ التعليمات غير المنطوقة لا يمكن استرجاعها.",
        "ترتيب الأقسام هنا حسب الشخصيات، وليس ترتيب التشغيل.",
    ])
    review = []
    for sp in speakers:
        path = os.path.expanduser(sp["file"])
        words = load_words(a.cache, a.model, path)
        if words is None:
            raise SystemExit(f"no {a.model} transcript for {path} in {a.cache} — run hikaya_transcribe.py first")
        alt = load_words(a.check_cache, a.check_model, path) if a.check_cache else None
        # a batch recording holds several episodes: keep this episode's part only
        lo, hi = float(sp.get("from", 0)), float(sp.get("to", 1e9))
        words = [w for w in words if lo <= w["s"] < hi]
        if alt:
            alt = [w for w in alt if lo <= w["s"] < hi]
        sil = pauses(path)
        fine = pauses(path, min_frames=5)
        duration = max((e for _, e in sil), default=words[-1]["e"] if words else 0)
        words, invented = drop_hallucinations(words, max(duration, words[-1]["e"] if words else 0))
        fname = os.path.basename(path)
        rel = sp.get("display_file") or fname
        out.append(f"[{sp['label']} — {rel}]")
        if sp.get("basis"):
            out.append(f"# نسبة الملف إلى الشخصية: {sp['basis']}")
        if "from" in sp or "to" in sp:
            out.append(f"# جزء هذه الحلقة من الملف: {lo:.1f}–{min(hi, 9999):.1f} ث — {sp.get('part_basis', '')}")
        n = 0
        spans = [tuple(x["span"]) for x in sp.get("direction_spans", [])]
        for x in sp.get("direction_spans", []):
            out.append(f"# تصحيح يدوي: الكلمات في {x['span'][0]:.2f}–{x['span'][1]:.2f} ث جزء من تعليمة منطوقة — {x['reason']}")
        if invented:
            out.append(f"# حُذف من آخر التفريغ: «{invented}» — عبارة يختلقها المفرِّغ في صمت آخر التسجيل، ولم تُنطق")
        for x in sp.get("direction_text", []):
            out.append(f"# تصحيح يدوي: «{x}» جزء من تعليمة منطوقة، لا من الحوار")
        items = apply_direction_text(recover_file(path, words, sil, vocab, fine, spans), sp.get("direction_text", []))
        for kind, text, s, e in items:
            if kind == "direction":
                out.append(f"[{text}]")
                continue
            n += 1
            other = text_between(alt, s, e) if alt else ""
            agree = agreement(text, other) if alt else None
            flag = "" if agree is None or agree >= 0.85 else " · ⚠ يختلف التفريغان — راجع بالسماع"
            out.append(f"# {rel} · {s:.2f}–{e:.2f} ث{flag}")
            out.append(text)
            review.append({"speaker": sp["label"], "file": rel, "line": n, "start": round(s, 2), "end": round(e, 2),
                           "text": text, "check_text": other, "agreement": None if agree is None else round(agree, 2)})
        out.append("")
    return "\n".join(out) + "\n", review


def write_review(review, path):
    with open(path + ".csv", "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=list(review[0].keys()))
        w.writeheader()
        w.writerows(review)
    md = ["| الشخصية | الملف | الزمن | النص المستعاد | تفريغ المقارنة | التطابق |", "|---|---|---|---|---|---|"]
    for r in review:
        mark = "" if r["agreement"] is None or r["agreement"] >= 0.85 else " ⚠"
        md.append(f"| {r['speaker']} | {r['file']} | {r['start']:.2f}–{r['end']:.2f} | {r['text']} | "
                  f"{r['check_text']} | {r['agreement']}{mark} |")
    with open(path + ".md", "w", encoding="utf-8") as fh:
        fh.write("\n".join(md) + "\n")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("source")
    s.add_argument("source_json")
    s.add_argument("--files", help="JSON mapping the source's file names to the delivered file names")
    s.add_argument("-o", "--output", required=True)
    au = sub.add_parser("audio")
    au.add_argument("--episode", type=int, required=True)
    au.add_argument("--title", required=True)
    au.add_argument("--speakers", required=True)
    au.add_argument("--cache", required=True)
    au.add_argument("--model", default="large-v3")
    au.add_argument("--check-cache")
    au.add_argument("--check-model", default="large-v3-turbo")
    au.add_argument("--directions-from", nargs="+", required=True)
    au.add_argument("-o", "--output", required=True)
    a = ap.parse_args()
    os.makedirs(os.path.dirname(os.path.abspath(a.output)), exist_ok=True)
    if a.cmd == "source":
        files = {}
        if a.files:
            with open(a.files, encoding="utf-8") as fh:
                files = json.load(fh)
        text = from_source(a.source_json, files)
    else:
        text, review = from_audio(a)
        write_review(review, os.path.splitext(a.output)[0] + "_review")
    with open(a.output, "w", encoding="utf-8") as fh:
        fh.write(text)
    print(f"→ {a.output}")


if __name__ == "__main__":
    main()
