import asyncio, json
import orchestrator
from models import QuestRequest
from orchestrator import fallback_quest, generate_quest


def fake_client(payload):
    class R:
        def raise_for_status(self): pass
        def json(self): return {"response": json.dumps(payload)}
    class C:
        def __init__(self, *a, **k): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *a): pass
        async def post(self, *a, **k): return R()
    return C


def test_valid_gemma_output_is_badged_gemma(monkeypatch):
    good = fallback_quest(QuestRequest()).model_dump()
    good.update(source="fallback", model="")  # the AI cannot set its own badge
    monkeypatch.setattr(orchestrator.httpx, "AsyncClient", fake_client(good))
    q = asyncio.run(generate_quest(QuestRequest()))
    assert q.source == "gemma" and q.model == orchestrator.MODEL


def test_bad_gemma_output_falls_back(monkeypatch):
    monkeypatch.setattr(orchestrator.httpx, "AsyncClient", fake_client({"title": "x"}))
    assert asyncio.run(generate_quest(QuestRequest())).source == "fallback"


def test_gemma_down_falls_back(monkeypatch):
    class Boom:
        def __init__(self, *a, **k): raise ConnectionError("no ollama")
    monkeypatch.setattr(orchestrator.httpx, "AsyncClient", Boom)
    assert asyncio.run(generate_quest(QuestRequest())).source == "fallback"
