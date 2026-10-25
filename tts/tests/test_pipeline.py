import json
import os
import shutil

import pytest

from tts.pipeline import audio
from tts.pipeline.backends import FakeBackend, load_api_key
from tts.pipeline.cost import estimate
from tts.pipeline.produce import Paths, Producer, load_config, load_episode
from tts.pipeline.registry import Registry
from tts.pipeline.script_parser import ScriptError, parse_script, split_chunks
from tts.pipeline.validate import similarity, word_diff

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

SCRIPT = """@episode 7
@title اختبار
=== SCENE ep07_s01 | مشهد أول
@image none
NARRATOR [بصوت هادئ]: كان البحر هادئاً في تلك الليلة.
AL_TIJANI [بتردد وحيرة] {type=fictional}: هل يمكن أن أسألك سؤالاً؟
PROFESSOR_MUNIM [بهدوء وثقة]: تفضل يا أخي.
=== SCENE ep07_s02 | مشهد ثان
NARRATOR {type=quote source="ص 1"}: نص مقتبس من الكتاب.
"""


@pytest.fixture()
def env(tmp_path):
    root = tmp_path / "repo"
    shutil.copytree(os.path.join(REPO, "tts", "config"), root / "tts" / "config")
    (root / "tts" / "scripts").mkdir(parents=True)
    (root / "storybook").mkdir()
    paths = Paths(str(root))
    cfg = load_config(paths)
    cfg["validation"]["whisper_model_dir"] = ""
    reg = Registry(str(root / "tts" / "config" / "voice_registry.json"))
    script = root / "tts" / "scripts" / "episode_07.txt"
    script.write_text(SCRIPT, encoding="utf-8")
    return paths, cfg, reg, str(script)


def test_parser_separates_directions_from_speech(env):
    paths, cfg, reg, script = env
    ep = load_episode(paths, reg, script)
    assert ep.episode == "07" and len(ep.scenes) == 2 and len(ep.lines) == 4
    first, tijani = ep.lines[0], ep.lines[1]
    assert first.emotion == "بصوت هادئ" and "[" not in first.text and first.type == "narration"
    assert tijani.type == "fictional" and tijani.emotion == "بتردد وحيرة"
    assert ep.lines[3].type == "quote" and ep.lines[3].source == "ص 1"
    assert ep.scenes[0].image is None


@pytest.mark.parametrize("bad, why", [
    ("UNKNOWN: نص", "unknown speaker"),
    ('NARRATOR {type=quote}: نص', "needs source"),
    ("NARRATOR [بهدوء]:   ", "cannot parse"),
])
def test_parser_rejects_bad_lines(env, bad, why):
    _, _, reg, _ = env
    with pytest.raises(ScriptError, match=why):
        parse_script(f"@episode 7\n@title t\n=== SCENE s1\n{bad}\n", reg.ids())


def test_historical_figures_only_speak_quotes(env):
    _, _, reg, _ = env
    src = "@episode 7\n@title t\n=== SCENE s1\nSCHOLAR: كلام متخيل\n"
    with pytest.raises(ScriptError, match="historical"):
        parse_script(src, reg.ids(), frozenset({"SCHOLAR"}))
    ok = parse_script(src.replace("SCHOLAR:", 'SCHOLAR {type=quote source="ص 9"}:'), reg.ids(), frozenset({"SCHOLAR"}))
    assert ok.lines[0].type == "quote"


def test_chunks_respect_limit_and_never_cut_words():
    text = "هذه جملة أولى طويلة نسبياً. " * 20 + "وهذه كلمات بلا ترقيم " * 30
    chunks = split_chunks(text.strip(), 120)
    assert all(len(c) <= 120 for c in chunks)
    assert " ".join(chunks).split() == text.split()


def test_unverified_voice_blocks_real_backend(env):
    paths, cfg, reg, script = env
    ep = load_episode(paths, reg, script)

    class NotFake(FakeBackend):
        name = "gemini"

    with pytest.raises(RuntimeError, match="not verified"):
        Producer(paths, cfg, reg, NotFake()).produce(ep, os.path.join(paths.output, "x"))


def test_end_to_end_timeline_cache_and_resume(env):
    paths, cfg, reg, script = env
    ep = load_episode(paths, reg, script)
    out = os.path.join(paths.output, "episode_07")

    crashing = FakeBackend()
    original = crashing.synthesize
    def crash_after_two(*a, **k):
        if crashing.calls >= 2:
            raise KeyboardInterrupt("simulated interruption")
        return original(*a, **k)
    crashing.synthesize = crash_after_two
    with pytest.raises(KeyboardInterrupt):
        Producer(paths, cfg, reg, crashing).produce(ep, out)
    assert crashing.calls == 2

    resumed = FakeBackend()
    data, reviews = Producer(paths, cfg, reg, resumed).produce(ep, out)
    assert resumed.calls == 2  # only the two missing chunks were requested

    again = FakeBackend()
    Producer(paths, cfg, reg, again).produce(ep, out)
    assert again.calls == 0  # everything served from the cache

    lines = data["lines"]
    assert [l["speaker_id"] for l in lines] == ["NARRATOR", "AL_TIJANI", "PROFESSOR_MUNIM", "NARRATOR"]
    for a, b in zip(lines, lines[1:]):
        assert a["end_ms"] <= b["start_ms"]
    for l in lines:
        for k in ("speaker_id", "voice_choice", "text", "emotion", "audio_file", "start_ms", "end_ms", "image_scene_id"):
            assert k in l
        assert l["audio_file"].startswith("assets/audio/episode_07/") and l["audio_file"].endswith(".mp3")
    assert lines[1]["voice_choice"] == "Enzo" and lines[2]["voice_choice"] == "Ludo"
    assert data["missing_images"] == ["ep07_s01", "ep07_s02"]
    assert all(s["image"] is None for s in data["scenes"])  # no invented image paths

    full, sr = audio.read_wav(os.path.join(out, "episode_07_full.wav"))
    assert abs(audio.duration_ms(full, sr) - data["duration_ms"]) <= 1
    assert os.path.exists(os.path.join(out, "episode_07_full.mp3"))
    assert os.path.exists(os.path.join(paths.output, "episode_07.zip"))
    by_char = open(os.path.join(out, "script_by_character.md"), encoding="utf-8").read()
    assert "Ludo" in by_char and "[بتردد وحيرة]" in by_char


def test_fake_audio_is_never_exported_to_the_app(env):
    paths, cfg, reg, script = env
    ep = load_episode(paths, reg, script)
    with pytest.raises(RuntimeError, match="fake"):
        Producer(paths, cfg, reg, FakeBackend()).produce(ep, os.path.join(paths.output, "e"), export_app=True)


def test_transient_failures_are_retried():
    from tts.pipeline.backends import GeminiBackend

    be = GeminiBackend.__new__(GeminiBackend)
    be.max_retries = 3
    be.log = lambda **kw: None

    class L:
        def wait(self):
            pass
    be.limiter = L()

    class Errors:
        class APIError(Exception):
            def __init__(self, code):
                self.code, self.status, self.message = code, "x", "x"
    be.errors = Errors
    calls = []
    def flaky():
        calls.append(1)
        if len(calls) < 3:
            raise Errors.APIError(429)
        return "ok"
    import tts.pipeline.backends as b
    sleep = b.time.sleep
    b.time.sleep = lambda s: None
    try:
        assert be._call(flaky, "t") == "ok" and len(calls) == 3
        with pytest.raises(Errors.APIError):
            be._call(lambda: (_ for _ in ()).throw(Errors.APIError(400)), "t")
    finally:
        b.time.sleep = sleep


def test_api_key_from_dotenv(tmp_path, monkeypatch):
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    assert load_api_key(str(tmp_path)) is None
    (tmp_path / ".env").write_text('GEMINI_API_KEY="abc123"\n')
    assert load_api_key(str(tmp_path)) == "abc123"


def test_arabic_similarity_ignores_diacritics_and_spelling_variants():
    assert similarity("هنيئاً لوالده", "هنيئا لوالده") == 1.0
    assert similarity("كان الطفل قد حفظ", "كان الطفل") < 0.8
    missing, extra = word_diff("لا تخف يا بني", "لا تخف يا ولدي")
    assert missing == ["بني"] and extra == ["ولدي"]


def test_cost_estimate_scales_with_audio(env):
    _, cfg, _, _ = env
    e = estimate(cfg, "gemini-3.1-flash-tts-preview", ["07", "08"])
    assert e["usd"] > 0 and e["total_audio_minutes"] == pytest.approx(16)
    assert e["audio_tokens"] == pytest.approx(16 * 60 * 25, rel=0.01)


def test_repository_preview_script_parses():
    paths = Paths(REPO)
    reg = Registry(os.path.join(REPO, "tts", "config", "voice_registry.json"))
    ep = load_episode(paths, reg, os.path.join(REPO, "tts", "scripts", "episode_07_preview.txt"))
    assert {l.speaker_id for l in ep.lines} == {"AL_TIJANI", "PROFESSOR_MUNIM"}
    assert all(l.type == "fictional" for l in ep.lines)
    json.dumps([l.__dict__ for l in ep.lines], ensure_ascii=False)
