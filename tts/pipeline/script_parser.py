"""Parse the plain-text episode script format into structured lines.

Format (one file per episode, UTF-8):

    @episode 07
    @title لقاء في عرض البحر
    @source_status verified | pending_book_verification

    === SCENE ep07_s01 | على سطح الباخرة
    @image none                      # or an existing asset path; never invented
    NARRATOR [بصوت هادئ]: النص المنطوق...
    AL_TIJANI [بتردد وحيرة] {type=fictional}: ...
    NARRATOR {type=quote source="ص 23"}: ...

Everything in [brackets] is a performance direction and everything in
{braces} is metadata; neither is ever sent as speakable text. `type` is
narration (default for NARRATOR), fictional (default for characters: a
dramatised re-enactment) or quote (verbatim from the book, needs `source`).
Lines starting with # are comments.
"""

import re
from dataclasses import dataclass, field

LINE_RE = re.compile(
    r"^(?P<speaker>[A-Z][A-Z0-9_]*)\s*"
    r"(?:\[(?P<emotion>[^\]]*)\])?\s*"
    r"(?:\{(?P<meta>[^}]*)\})?\s*:\s*(?P<text>.+)$"
)
META_RE = re.compile(r'(\w+)=("([^"]*)"|\S+)')
TYPES = {"narration", "fictional", "quote"}


class ScriptError(ValueError):
    pass


@dataclass
class Line:
    index: int
    scene_id: str
    speaker_id: str
    text: str
    emotion: str = ""
    type: str = "fictional"
    source: str = ""
    line_no: int = 0


@dataclass
class Scene:
    scene_id: str
    title: str
    image: str | None = None
    lines: list = field(default_factory=list)


@dataclass
class EpisodeScript:
    episode: str
    title: str
    source_status: str
    scenes: list

    @property
    def lines(self):
        return [l for s in self.scenes for l in s.lines]


def _meta(raw):
    out = {}
    for m in META_RE.finditer(raw or ""):
        out[m.group(1)] = m.group(3) if m.group(3) is not None else m.group(2)
    return out


def clean_spoken(text):
    """Remove any stray directions/metadata so only speakable Arabic remains."""
    text = re.sub(r"\[[^\]]*\]", "", text)
    text = re.sub(r"\{[^}]*\}", "", text)
    return re.sub(r"\s+", " ", text).strip()


def parse_script(source, known_speakers, historical=frozenset()):
    """Parse script text. `known_speakers` is the set of registry character
    IDs; `historical` lists IDs that may only speak verified quotations."""
    header = {}
    scenes = []
    idx = 0
    for no, raw in enumerate(source.splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("=== SCENE"):
            m = re.match(r"=== SCENE\s+(\S+)\s*(?:\|\s*(.*))?$", line)
            if not m:
                raise ScriptError(f"line {no}: bad scene header")
            scenes.append(Scene(m.group(1), (m.group(2) or "").strip()))
            continue
        if line.startswith("@"):
            key, _, val = line[1:].partition(" ")
            val = val.strip()
            if key == "image":
                if not scenes:
                    raise ScriptError(f"line {no}: @image outside a scene")
                scenes[-1].image = None if val in ("", "none") else val
            else:
                header[key] = val
            continue
        m = LINE_RE.match(line)
        if not m:
            raise ScriptError(f"line {no}: cannot parse: {line[:60]}")
        if not scenes:
            raise ScriptError(f"line {no}: dialogue before the first scene")
        spk = m.group("speaker")
        if spk not in known_speakers:
            raise ScriptError(f"line {no}: unknown speaker {spk}; add it to voice_registry.json")
        meta = _meta(m.group("meta"))
        kind = meta.get("type", "narration" if spk == "NARRATOR" else "fictional")
        if kind not in TYPES:
            raise ScriptError(f"line {no}: type must be one of {sorted(TYPES)}")
        if kind == "quote" and not meta.get("source"):
            raise ScriptError(f"line {no}: a quote needs source=\"...\" (book page/section)")
        if spk in historical and kind != "quote":
            raise ScriptError(f"line {no}: {spk} is a historical figure and may only speak verified quotes")
        text = clean_spoken(m.group("text"))
        if not text:
            raise ScriptError(f"line {no}: no speakable text")
        idx += 1
        scenes[-1].lines.append(Line(idx, scenes[-1].scene_id, spk, text, (m.group("emotion") or "").strip(),
                                     kind, meta.get("source", ""), no))
    for k in ("episode", "title"):
        if k not in header:
            raise ScriptError(f"missing @{k}")
    if not any(s.lines for s in scenes):
        raise ScriptError("script has no lines")
    return EpisodeScript(header["episode"].zfill(2), header["title"],
                         header.get("source_status", "pending_book_verification"), scenes)


SPLIT_RE = re.compile(r"(?<=[\.\!\؟\?…])\s+|(?<=[،؛,;])\s+")


def split_chunks(text, max_chars):
    """Split long text at sentence (then clause) boundaries, never mid-word."""
    if len(text) <= max_chars:
        return [text]
    parts = [p for p in re.split(r"(?<=[\.\!\؟\?…])\s+", text) if p]
    chunks, cur = [], ""
    for p in parts:
        pieces = [p] if len(p) <= max_chars else [q for q in re.split(r"(?<=[،؛,;])\s+", p) if q]
        for q in pieces:
            while len(q) > max_chars:  # no punctuation at all: break on the last space
                cut = q.rfind(" ", 0, max_chars)
                cut = cut if cut > 0 else max_chars
                if cur:
                    chunks.append(cur)
                    cur = ""
                chunks.append(q[:cut].strip())
                q = q[cut:].strip()
            if cur and len(cur) + 1 + len(q) > max_chars:
                chunks.append(cur)
                cur = q
            else:
                cur = f"{cur} {q}".strip()
    if cur:
        chunks.append(cur)
    return chunks


def render_chronological(ep, registry):
    out = [f"# ثم اهتديت — الحلقة {ep.episode}: {ep.title}", "",
           f"حالة المصدر: {ep.source_status}", ""]
    for s in ep.scenes:
        out += [f"## {s.scene_id} — {s.title}", f"_الصورة: {s.image or 'لا توجد صورة مطابقة بعد'}_", ""]
        for l in s.lines:
            name = registry.name_ar(l.speaker_id)
            tag = {"fictional": " ⟨تمثيل درامي متخيَّل⟩", "quote": f" ⟨اقتباس مباشر: {l.source}⟩"}.get(l.type, "")
            emo = f" [{l.emotion}]" if l.emotion else ""
            out.append(f"**{name}**{emo}{tag}: {l.text}")
            out.append("")
    return "\n".join(out)


def render_by_character(ep, registry):
    out = [f"# الحلقة {ep.episode}: {ep.title} — النصوص مجمّعة حسب الشخصية", ""]
    order = []
    for l in ep.lines:
        if l.speaker_id not in order:
            order.append(l.speaker_id)
    for spk in order:
        out += [f"## {registry.name_ar(spk)} ({spk}) — الصوت: {registry.voice_choice(spk)}", ""]
        for l in ep.lines:
            if l.speaker_id == spk:
                emo = f"[{l.emotion}] " if l.emotion else ""
                out.append(f"{l.index:03d}. {emo}{l.text}")
        out.append("")
    return "\n".join(out)
