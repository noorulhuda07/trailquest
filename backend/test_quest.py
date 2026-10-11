import pytest
from pydantic import ValidationError
from models import QuestRequest
from orchestrator import fallback_quest
from validator import validate


def test_normal():
    q = fallback_quest(QuestRequest())
    assert sum(s.minutes for s in q.steps) == 45 and len(q.nature_challenges) == 3


def test_negative_duration():
    with pytest.raises(ValidationError):
        QuestRequest(duration_min=-5)


def test_malformed_ai_output():
    with pytest.raises(Exception):
        validate({"title": "x"}, QuestRequest())


def test_unsafe_ai_output():
    raw = fallback_quest(QuestRequest()).model_dump()
    raw["steps"][1]["detail"] = "Sprint until exhaustion"
    with pytest.raises(ValueError):
        validate(raw, QuestRequest())


def test_indoor_has_no_nature():
    assert fallback_quest(QuestRequest(environment="indoor")).nature_challenges == []
