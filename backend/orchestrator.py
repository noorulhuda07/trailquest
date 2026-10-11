import json, os, random
import httpx
from models import Quest, QuestRequest, Step
from validator import validate, NATURE_OK

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434/api/generate")
MODEL = os.getenv("GEMMA_MODEL", "gemma3:4b")


def build_prompt(req: QuestRequest) -> str:
    # User fields are validated enums/ints, so they cannot carry injected instructions.
    return f"""You design safe, friendly fitness quests. Reply with JSON only, no prose.
Schema: {{"title": str, "intensity": "low|medium|high", "steps": [{{"phase": "warm-up|main|nature|cooldown",
"title": str, "minutes": int, "detail": str}}], "nature_challenges": [str]}}
Rules: step minutes must sum to {req.duration_min}. intensity must be "{req.energy}" (use "low" if mood is tired/stressed).
Include a warm-up and a cooldown. Never suggest anything dangerous.
Request: {req.model_dump_json()}"""


def fallback_quest(req: QuestRequest) -> Quest:
    d = req.duration_min
    warm, cool = max(3, d // 9), max(3, d // 9)
    main = d - warm - cool
    low = req.energy == "low" or req.mood in ("tired", "stressed")
    intensity = "low" if low else req.energy
    steps = [Step(phase="warm-up", title="Easy start", minutes=warm, detail="Walk or move at a relaxed pace.")]
    if req.environment == "outdoor":
        nat = random.sample(NATURE_OK, 3)  # nosec B311 - picks a fun challenge, not a secret
        steps.append(Step(phase="main", title="Brisk walk" if not low else "Steady stroll", minutes=main // 2 + main % 2,
                          detail="Keep a pace where you can still talk."))
        if not low:
            steps.append(Step(phase="main", title="Faster intervals", minutes=main // 2,
                              detail="5 rounds: 1 min faster, then 1 min easy."))
        else:
            steps.append(Step(phase="nature", title="Slow explore", minutes=main // 2, detail="Wander and look around."))
        title = "Park Explorer Quest"
    else:
        nat = []
        steps.append(Step(phase="main", title="Home circuit", minutes=main, detail="March in place, squats, wall push-ups. Rest when needed."))
        title = "Living Room Quest"
    steps.append(Step(phase="cooldown", title="Slow down", minutes=cool, detail="Walk slowly and stretch calves."))
    return Quest(title=title, intensity=intensity, steps=steps, nature_challenges=nat, source="fallback")


async def generate_quest(req: QuestRequest) -> Quest:
    try:
        async with httpx.AsyncClient(timeout=120) as c:
            r = await c.post(OLLAMA_URL, json={"model": MODEL, "prompt": build_prompt(req), "format": "json", "stream": False})
            r.raise_for_status()
            quest = validate(json.loads(r.json()["response"]), req)
            quest.source, quest.model = "gemma", MODEL
            return quest
    except Exception:  # Gemma down, bad JSON, failed validation -> safe rule-based quest
        return fallback_quest(req)
