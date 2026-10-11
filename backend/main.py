import os, time
from collections import defaultdict
from dotenv import load_dotenv
load_dotenv()
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import auth
from auth import check_config, current_user, router as auth_router
from models import Quest, QuestRequest
from orchestrator import generate_quest

check_config(auth.DEV, os.getenv("JWT_SECRET"))
app = FastAPI(title="TrailQuest API")
app.add_middleware(CORSMiddleware, allow_origins=[os.getenv("ALLOWED_ORIGIN", "http://localhost:5173")],
                   allow_methods=["POST", "GET"], allow_headers=["Content-Type", "Authorization"])
app.include_router(auth_router)


@app.middleware("http")
async def security_headers(request, call_next):
    r = await call_next(request)
    r.headers.update({"X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "no-referrer"})
    if request.url.path.startswith("/api/auth"):
        r.headers["Cache-Control"] = "no-store"
    return r


hits: dict[int, list[float]] = defaultdict(list)


def rate_limit(uid: int, limit=10, window=60):
    now = time.time()
    hits[uid] = [t for t in hits[uid] if now - t < window]
    if len(hits[uid]) >= limit:
        raise HTTPException(429, "Too many quests. Wait a minute and try again.")
    hits[uid].append(now)


@app.get("/api/health")
def health():
    return {"ok": True}


@app.post("/api/quest", response_model=Quest)  # signed-in users only
async def create_quest(req: QuestRequest, user=Depends(current_user)):
    rate_limit(user["id"])
    return await generate_quest(req)
