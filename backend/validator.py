"""AI suggests. Code validates."""
from models import Quest, QuestRequest

UNSAFE = ("sprint until", "no water", "ignore pain", "fast for", "all-out", "until exhaustion", "trespass", "swim alone")
NATURE_OK = ("Find 3 different leaf shapes", "Name 4 sounds around you", "Spot something with three colors",
             "Take one photo of something you usually ignore", "Find a natural object with an unusual shape")


def validate(raw: dict, req: QuestRequest) -> Quest:
    quest = Quest.model_validate(raw)  # raises on malformed/missing fields
    text = " ".join([quest.title] + [s.title + " " + s.detail for s in quest.steps]).lower()
    if any(w in text for w in UNSAFE):
        raise ValueError("unsafe recommendation")
    if quest.intensity != req.energy and not (req.mood in ("tired", "stressed") and quest.intensity == "low"):
        raise ValueError("intensity does not match energy")
    total = sum(s.minutes for s in quest.steps)
    if abs(total - req.duration_min) > max(5, req.duration_min * 0.15):
        raise ValueError("durations do not add up")
    if req.environment == "indoor":
        quest.nature_challenges = []
    return quest
