"""Voice registry: the fixed character -> voice mapping."""

import json
import os

# Arabic performance directions mapped to an English delivery description the
# TTS model follows reliably. Unknown directions are passed through in Arabic.
EMOTIONS_EN = {
    "بصوت متأثر": "moved, emotional, restrained",
    "بتردد وحيرة": "hesitant and perplexed",
    "بتردد": "hesitant",
    "بحيرة": "perplexed, searching",
    "بهدوء وثقة": "calm and confident",
    "بهدوء": "calm",
    "بدهشة": "surprised, astonished",
    "بنبرة حزينة": "sad",
    "بحماس": "enthusiastic",
    "بحنان": "tender, loving",
    "بلطف": "gentle, kind",
    "بتأمل": "reflective, thoughtful",
    "بفضول": "curious",
    "بصوت هادئ": "quiet and calm",
    "بصوت دافئ": "warm",
    "بجدية": "serious",
    "بابتسامة": "smiling, friendly",
    "بانفعال مكتوم": "suppressed emotion",
    "بصوت عميق": "deep and resonant",
    "بلطف وهدوء": "gentle and calm",
    "بابتسامة خفيفة": "with a slight smile",
    "بتواضع": "modest, humble",
}


class Registry:
    def __init__(self, path):
        self.path = path
        with open(path, encoding="utf-8") as fh:
            self.data = json.load(fh)
        self.characters = {}
        for group in ("main_cast", "secondary_cast"):
            for cid, c in self.data.get(group, {}).items():
                if not cid.startswith("_"):
                    self.characters[cid] = {**c, "group": group}

    @property
    def language_code(self):
        return self.data.get("language_code", "ar")

    def ids(self):
        return set(self.characters)

    def name_ar(self, cid):
        return self.characters[cid]["name_ar"]

    def voice_choice(self, cid):
        c = self.characters[cid]
        return c.get("user_choice") or c.get("proposed_voice") or ""

    def api_voice(self, cid):
        c = self.characters[cid]
        return c.get("api_voice") if c.get("status") == "verified" else None

    def unverified(self, cids):
        return sorted(c for c in cids if not self.api_voice(c))

    def set_verification(self, cid, api_voice, status, note=""):
        group = self.characters[cid]["group"]
        entry = self.data[group][cid]
        entry["api_voice"] = api_voice
        entry["status"] = status
        entry["verification_note"] = note
        self.characters[cid].update(entry)

    def save(self):
        tmp = self.path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as fh:
            json.dump(self.data, fh, ensure_ascii=False, indent=2)
            fh.write("\n")
        os.replace(tmp, self.path)

    def prompt_fields(self, cid, emotion):
        c = self.characters[cid]
        return {
            "voice_brief": c.get("voice_brief", ""),
            "accent_instruction": c.get("accent_instruction", ""),
            "emotion_ar": emotion or "طبيعي",
            "emotion_en": EMOTIONS_EN.get(emotion, "natural") if emotion else "natural",
        }
