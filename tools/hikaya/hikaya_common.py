"""Shared helpers for the HIKAYA Mac tools (Python 3.9+, standard library only).

Optional extras: ffprobe/ffmpeg (brew install ffmpeg) for audio durations and
conversion; Pillow (pip install pillow) for image dimensions and damage checks.
"""

import hashlib
import json
import os
import re
import shutil
import subprocess
import zipfile

AUDIO_EXT = {".wav", ".mp3", ".m4a", ".aac", ".ogg", ".opus", ".flac", ".aiff", ".aif"}
IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".tif", ".tiff"}
SCRIPT_EXT = {".txt", ".md", ".json", ".srt", ".vtt", ".docx", ".csv", ".rtf"}
IGNORED = ("__MACOSX/", ".DS_Store", "Thumbs.db")

# --- performance directions -----------------------------------------------------
# A bracket is treated as a TTS delivery instruction only when it looks like one:
# it starts with a manner preposition (بـ) or names voice/tone/emotion, and is short.
DIRECTION_WORDS = (
    "نبرة", "بصوت", "صوت", "همس", "بهمس", "بتأثر", "تأثر", "بحزن", "حزن", "بخشوع", "خشوع", "بحنان", "حنان",
    "بابتسامة", "ابتسامة", "مشوق", "بهدوء", "هدوء", "بثقة", "بدهشة", "بتردد", "بحماس", "بفرح", "بغضب",
    "بجدية", "بتأمل", "بلطف", "ضحك", "بكاء", "تنهد", "توقف", "صمت", "بحيرة", "بانفعال", "بقلق", "بخوف",
    "موسيقى", "مؤثر", "أصوات", "whisper", "softly", "pause",
)
BRACKET_RE = re.compile(r"\[([^\]\n]{1,80})\]")


def is_direction(inner):
    t = inner.strip()
    if not t or len(t) > 60:
        return False
    first = t.split()[0]
    if first.startswith("ب") and len(t.split()) <= 6:
        return True
    return any(w in t for w in DIRECTION_WORDS)


def clean_directions(text):
    """Return (clean_text, removed, kept). Brackets that do not look like
    delivery instructions (quotations, editorial insertions) are kept."""
    removed, kept = [], []

    def repl(m):
        if is_direction(m.group(1)):
            removed.append(m.group(1).strip())
            return ""
        kept.append(m.group(1).strip())
        return m.group(0)

    out = BRACKET_RE.sub(repl, text)
    out = re.sub(r"[ \t]{2,}", " ", out)
    out = re.sub(r" +([،.؟!:])", r"\1", out)
    return out.strip(), removed, kept


# --- files ---------------------------------------------------------------------

def sha256(path, chunk=1 << 20):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        while True:
            b = fh.read(chunk)
            if not b:
                return h.hexdigest()
            h.update(b)


def unsafe_entry(name):
    n = name.replace("\\", "/")
    if n.startswith("/") or re.match(r"^[A-Za-z]:", n):
        return "absolute path"
    if any(part == ".." for part in n.split("/")):
        return "path traversal"
    if "\x00" in n:
        return "invalid character"
    return None


def is_symlink(info):
    return (info.external_attr >> 16) & 0o170000 == 0o120000


def unique_path(path):
    """Never overwrite: add ' (2)', ' (3)'... before the extension."""
    if not os.path.exists(path):
        return path
    base, ext = os.path.splitext(path)
    i = 2
    while os.path.exists(f"{base} ({i}){ext}"):
        i += 1
    return f"{base} ({i}){ext}"


def entry_name(info):
    """The entry's name as the producer typed it. Names stored without the UTF-8
    flag were decoded as cp437 by zipfile; recover them when they are UTF-8."""
    name = info.filename
    if not info.flag_bits & 0x800:
        try:
            return name.encode("cp437").decode("utf-8")
        except (UnicodeEncodeError, UnicodeDecodeError):
            pass
    return name


def _same_file(path, info, z):
    """True when path already holds exactly this entry (a re-run of the extraction)."""
    if os.path.getsize(path) != info.file_size:
        return False
    h = hashlib.sha256()
    with z.open(info) as src:
        for b in iter(lambda: src.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest() == sha256(path)


def safe_extract(zip_path, dest, max_total=8 * 1024 ** 3, nested=2, _prefix=""):
    """Extract a ZIP into dest without overwriting anything. ZIPs inside the ZIP
    are extracted too (up to `nested` levels) into a folder named after them,
    next to the inner ZIP, which is kept unchanged. Re-running is safe: an
    identical file already in place is reused, a different one gets a new name.
    Returns (files, rejected): files = [{entry, path, renamed, container}],
    rejected = [{entry, reason}]."""
    files, rejected = [], []
    with zipfile.ZipFile(zip_path) as z:
        total = sum(i.file_size for i in z.infolist())
        if total > max_total:
            raise ValueError(f"archive expands to {total} bytes, over the {max_total} limit")
        for info in z.infolist():
            name = entry_name(info)
            label = _prefix + name
            if info.is_dir() or any(p in name for p in IGNORED):
                continue
            reason = unsafe_entry(name) or ("symbolic link" if is_symlink(info) else None)
            if reason:
                rejected.append({"entry": label, "reason": reason})
                continue
            root = os.path.abspath(dest)
            target = os.path.abspath(os.path.join(root, name))
            if os.path.commonpath([root, target]) != root:
                rejected.append({"entry": label, "reason": "escapes destination"})
                continue
            os.makedirs(os.path.dirname(target), exist_ok=True)
            if os.path.exists(target) and _same_file(target, info, z):
                final = target
            else:
                final = unique_path(target)
                with z.open(info) as src, open(final, "wb") as out:
                    shutil.copyfileobj(src, out)
            files.append({"entry": label, "path": final, "renamed": final != target, "container": _prefix or None})
            if nested and final.lower().endswith(".zip") and zipfile.is_zipfile(final):
                try:
                    inner, rej = safe_extract(final, os.path.splitext(final)[0], max_total, nested - 1, label + "/")
                except (zipfile.BadZipFile, ValueError) as e:
                    rejected.append({"entry": label, "reason": f"inner archive: {e}"})
                    continue
                files += inner
                rejected += rej
    return files, rejected


# --- media probes ----------------------------------------------------------------

def have(tool):
    return shutil.which(tool) is not None


def probe_audio(path):
    """{duration_s, codec, sample_rate, channels} via ffprobe, or {} if unavailable."""
    if not have("ffprobe"):
        return {}
    try:
        out = subprocess.run(["ffprobe", "-v", "error", "-show_entries",
                              "format=duration:stream=codec_name,sample_rate,channels", "-of", "json", path],
                             capture_output=True, text=True, timeout=60)
        d = json.loads(out.stdout or "{}")
        st = (d.get("streams") or [{}])[0]
        return {"duration_s": round(float(d.get("format", {}).get("duration", 0) or 0), 3),
                "codec": st.get("codec_name"), "sample_rate": int(st.get("sample_rate", 0) or 0),
                "channels": st.get("channels")}
    except (subprocess.SubprocessError, ValueError, json.JSONDecodeError) as e:
        return {"error": str(e)}


def probe_image(path):
    try:
        from PIL import Image
    except ImportError:
        return {}
    try:
        with Image.open(path) as im:
            w, h = im.size
            fmt = im.format
        with Image.open(path) as im:
            im.verify()
        return {"width": w, "height": h, "format": fmt, "aspect": round(w / h, 3) if h else None}
    except Exception as e:  # noqa: BLE001 - reported as damaged
        return {"damaged": str(e)[:200]}


# --- naming heuristics -------------------------------------------------------------

AR_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")
EP_PATTERNS = [
    re.compile(r"(?:(?<![A-Za-z])ep(?:isode)?|(?<![A-Za-z])e(?=\d)|حلقة|الحلقة)[\s_\-]*0*(\d{1,3})", re.I),
    re.compile(r"^0*(\d{1,2})(?:\.\w+)?$"),  # a folder or file named just "07"
]
RANGE_RE = re.compile(r"(?:ep|episodes?|حلقات|الحلقات|batch)?[\s_\-]*0*(\d{1,2})\s*(?:-|–|to|إلى|الى)\s*0*(\d{1,2})", re.I)
BATCH_RE = re.compile(r"(?:batch|دفعة|الدفعة)[\s_\-]*0*(\d)", re.I)


def guess_episodes(path, batches=None):
    """Episode numbers a file name/path refers to: a range for batch files.
    The most specific part of the path wins: «part4_ep13-16/ep13/ep13_scene01.jpg»
    is episode 13, not 13–16. `batches` maps a batch number to its episodes,
    for files inside a folder such as «Batch 1»."""
    s = path.translate(AR_DIGITS).replace("\\", "/")
    for part in reversed([p for p in s.split("/") if p]):
        stem = re.sub(r"\.(zip|wav|mp3|m4a|txt|json|docx|jpe?g|png|webp)$", "", part, flags=re.I)
        m = RANGE_RE.search(stem)
        if m:
            a, b = int(m.group(1)), int(m.group(2))
            if 1 <= a < b <= 99:
                return list(range(a, b + 1))
        for pat in EP_PATTERNS:
            m = pat.search(stem)
            if m and 1 <= int(m.group(1)) <= 99:
                return [int(m.group(1))]
        m = BATCH_RE.search(stem)
        if m and batches and int(m.group(1)) in batches:
            return list(batches[int(m.group(1))])
    return []


SCENE_RE = re.compile(r"(?:scene|مشهد|sc|img|image|صورة)[\s_\-]*0*(\d{1,3})", re.I)


def guess_scene(path):
    """Scene/illustration number from a file name (scene_03.png → 3), else the last number in the name."""
    name = os.path.splitext(os.path.basename(path))[0].translate(AR_DIGITS)
    m = SCENE_RE.search(name)
    if m:
        return int(m.group(1))
    nums = re.findall(r"\d+", name)
    return int(nums[-1]) if nums else None


def write_json(path, data):
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=1)
    os.replace(tmp, path)
