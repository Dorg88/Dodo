"""Cost and workload estimates (approximate; prices come from pipeline.json)."""


def estimate(cfg, model, episodes, chars_by_episode=None):
    p = cfg["pricing_estimate"]
    rate = cfg["speech_rate_chars_per_second"]
    rows = []
    for ep in episodes:
        chars = (chars_by_episode or {}).get(ep)
        if chars:
            seconds = chars / rate + 1.5 * max(1, chars // 120)  # speech + pauses
            basis = "script"
        else:
            seconds = p["assumed_minutes_per_episode"] * 60
            chars = int(seconds * rate * 0.9)
            basis = "assumed length"
        rows.append({"episode": ep, "chars": chars, "audio_seconds": seconds, "basis": basis})
    total_seconds = sum(r["audio_seconds"] for r in rows)
    total_chars = sum(r["chars"] for r in rows)
    out_rate = p["usd_per_million_audio_output_tokens"].get(model)
    in_rate = p["usd_per_million_text_input_tokens"].get(model)
    audio_tokens = total_seconds * p["audio_tokens_per_second"]
    # prompt text includes the voice/accent/emotion instructions (~260 chars per line)
    lines = max(1, total_chars // 90)
    input_tokens = (total_chars + 260 * lines) / 2.5
    cost = None
    if out_rate is not None and in_rate is not None:
        cost = (audio_tokens * out_rate + input_tokens * in_rate) / 1e6
    return {
        "rows": rows,
        "model": model,
        "total_audio_minutes": total_seconds / 60,
        "requests": lines,
        "audio_tokens": int(audio_tokens),
        "input_tokens": int(input_tokens),
        "usd": cost,
        "usd_with_overhead": None if cost is None else cost * (1 + p["regeneration_overhead"]),
        "hours_at_rate_limit": lines / cfg["requests_per_minute"] / 60,
    }
