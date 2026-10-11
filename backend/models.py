from typing import Literal
from pydantic import BaseModel, Field

Target = Literal["steps", "calories", "distance", "time"]
Energy = Literal["low", "medium", "high"]
Mood = Literal["tired", "okay", "great", "stressed"]
Env = Literal["indoor", "outdoor"]


class QuestRequest(BaseModel):
    target_type: Target = "steps"
    target_value: int = Field(8000, ge=1, le=100000)
    energy: Energy = "medium"
    mood: Mood = "okay"
    duration_min: int = Field(45, ge=10, le=180)
    environment: Env = "outdoor"
    workout_type: Literal["walk", "run", "jog", "hike", "cycle", "yoga", "strength", "stretch"] = "walk"  # fixed list: no free text reaches the prompt


class Step(BaseModel):
    phase: Literal["warm-up", "main", "nature", "cooldown"]
    title: str = Field(max_length=80)
    minutes: int = Field(ge=0, le=120)
    detail: str = Field(max_length=200)


class Quest(BaseModel):
    title: str = Field(max_length=80)
    intensity: Energy
    steps: list[Step] = Field(min_length=3, max_length=8)
    nature_challenges: list[str] = Field(default_factory=list, max_length=5)
    source: Literal["gemma", "fallback"] = "fallback"
    model: str = ""  # set by the server, never trusted from the AI
