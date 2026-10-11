# TrailQuest 🌿

**Fitness. Quest. Adventure.**
An open-weight AI (Gemma, running locally through Ollama) plans a short outdoor quest. Code validates it. Then the app asks you to **put the phone away** and go outside.

![CI](https://github.com/noorulhuda07/trailquest/actions/workflows/ci.yml/badge.svg)
![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)

Built for the **Hacktoberfest Open-Source AI Challenge, Week 1: Touch Grass**.

> **Demo video:** [Watch TrailQuest in 50 seconds](docs/trailquest-launch.mp4)

<!-- Add screenshots to docs/ and uncomment:
| Quest | Phone Away | Dashboard |
|---|---|---|
| ![Quest](docs/quest.png) | ![Phone away](docs/phone-away.png) | ![Today](docs/today.png) |
-->

---

## What it does

1. You tell TrailQuest your **energy, mood, time, goal** and whether you'll be **indoors or outdoors**.
2. Gemma suggests a quest: warm-up, main walk with intervals, **nature challenges** (like "spot something with three colors"), and a cooldown.
3. Code checks the quest before you ever see it.
4. You press **Start**. The screen becomes a plain timer: *Phone away. Go enjoy it.*
5. You come back, log your steps, and earn **XP and a Touch Grass streak**. Any finished quest counts, even an easy recovery walk.

The goal is for the screen to be the shortest part of the experience.

## Features

- **AI quest generator** using Gemma through Ollama, with structured JSON output
- **"AI suggests, code validates"**: every quest is checked, and a rules engine takes over if Gemma fails
- **Source badge** on every quest: *Gemma (self-hosted, code-validated)* or *Backup rules engine*. The server sets it, so the model can't claim credit
- **Phone Away mode** and **nature challenges**
- **Streaks, XP and levels**, plus badges
- **Today** screen (steps ring, distance, calories, weekly chart, water tracker), **Trail Journal**, **Quest Map**, **Snaps** and **Me** profile
- **Accounts**: email or phone sign-up with a one-time code (OTP), password sign-in, sign-in with a code, Google sign-in, and a one-click **demo mode**
- **Light, dark and auto modes**, four color themes, and km or miles
- One-command **Docker Compose** setup

## Architecture

```
React (Vite)  →  FastAPI  →  Gemma (Ollama)  →  Validator  →  Quest
                    │                               │
                    │                  fails or unavailable
                    ▼                               ▼
               SQLite (accounts)          Rules-based fallback  →  Quest
```

**What the validator checks:** valid JSON with all fields; intensity matches the chosen energy; step minutes add up to the requested time; no unsafe wording; indoor quests have no nature challenges.

**Prompt safety:** energy, mood and target are fixed options, and the workout type comes from a fixed list. No free text reaches the model.

## Quick start (Docker)

You need Docker Desktop.

```bash
docker compose up --build
```

Open **http://localhost:8080** and click **Try the demo (no sign-up)**.

The first run downloads Gemma (about 3 GB). Until it finishes, quests use the backup engine. Watch progress with `docker compose logs -f model-pull`. For a smaller model, set `GEMMA_MODEL=gemma3:1b`.

## Run without Docker

Requirements: **Python 3.10+** (3.12 recommended), **Node.js 22** (20.19+ works), and optionally **[Ollama](https://ollama.com)** for real Gemma quests.

**1. Backend**

```bash
cd backend
python -m venv .venv
# Windows:      .\.venv\Scripts\Activate.ps1
# Mac / Linux:  source .venv/bin/activate
python -m pip install -r requirements.txt
cp .env.example .env            # Windows: copy .env.example .env
python -m uvicorn main:app --reload --port 8000
```

Check http://localhost:8000/api/health returns `{"ok":true}`.

**2. Gemma (optional)**

```bash
ollama pull gemma3
ollama run gemma3 "hi"          # warms the model up, then type /bye
```

**3. Frontend**

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**.

## Configuration

Copy `backend/.env.example` to `backend/.env`.

| Variable | Purpose |
|---|---|
| `OLLAMA_URL`, `GEMMA_MODEL` | Where Gemma runs and which model to use |
| `JWT_SECRET` | Signing secret for sessions. **Required (32+ chars) when `DEV_MODE=false`** |
| `DEV_MODE` | `true` shows OTP codes on screen and in the server console. **Turn off in production** |
| `DEMO_MODE` | `true` enables the "Try the demo" button |
| `GOOGLE_CLIENT_ID` | Google sign-in (also set `VITE_GOOGLE_CLIENT_ID` in `frontend/.env`) |
| `SMTP_*` | Email delivery for OTP codes |
| `TWILIO_*` | SMS delivery for OTP codes |
| `ALLOWED_ORIGIN` | Frontend origin allowed by CORS |

## API

| Endpoint | Auth | Purpose |
|---|---|---|
| `GET /api/health` | no | Health check |
| `POST /api/auth/signup` | no | Create account and send a code |
| `POST /api/auth/otp/request` | no | Send a one-time code |
| `POST /api/auth/otp/verify` | no | Verify code and get a token |
| `POST /api/auth/login` | no | Email or phone plus password |
| `POST /api/auth/google` | no | Google sign-in |
| `POST /api/auth/demo` | no | Guest session (when `DEMO_MODE=true`) |
| `GET /api/auth/me` | yes | Current user |
| `POST /api/quest` | yes | Generate a quest |

Try it in PowerShell:

```powershell
$t = (Invoke-RestMethod -Method Post http://localhost:8000/api/auth/demo).token
Invoke-RestMethod -Method Post http://localhost:8000/api/quest -Headers @{Authorization="Bearer $t"} -ContentType "application/json" -Body '{"energy":"medium","mood":"okay","duration_min":45,"environment":"outdoor"}'
```

The response includes `source` (`gemma` or `fallback`) and `model`.

## Tests

```bash
cd backend && python -m pytest -q      # backend (42 tests at time of writing)
cd frontend && npm test                # frontend (5 tests at time of writing)
```

The backend tests cover forged, expired and unsigned tokens, SQL injection strings, oversized input, prompt-injection text, OTP reuse, expiry and lockout, rate limits, Google token checks, security headers, CORS, and unsafe or malformed model output. GitHub Actions runs the tests plus Bandit, `pip-audit`, `npm audit` and a secret scan on every push.

## Project structure

```
backend/     FastAPI app: auth.py, orchestrator.py, validator.py, models.py, tests
frontend/    React + Vite app and nginx config
docker-compose.yml
.github/workflows/ci.yml
```

## Why open-weight AI?

- **Your mood and schedule stay with you.** Quest requests are processed by a model running on your own machine.
- **Swap models with one setting** (`GEMMA_MODEL`), from a small model on a laptop to a larger one.
- **No per-quest cost.** Running it costs electricity, not API fees.
- **You control the guardrails.** You choose the output format and what happens when the model misbehaves.

**Trade-offs:** the first download is large, and small local models are slower and less reliable than big hosted ones. That is why the validator and fallback exist.

## Known limitations

- Snaps shows sample posts, with no friends or social backend yet.
- Steps are entered by hand. Real step tracking needs a phone app (Apple Health or Health Connect).
- Progress (XP, streak, journal) is stored in the browser per account, not on the server.
- Rate limits are in memory and reset when the server restarts.
- The login token is kept in `localStorage`. A secure cookie would be safer for production.
- Demo accounts are not cleaned up automatically.
- Weather and location are planned but not built.

## Roadmap

- Weather and location tools, so a rainy day gives an indoor quest
- Friends, group quests, challenges and a leaderboard
- Server-side progress storage (PostgreSQL)
- Real step tracking and offline mode as a phone app

## License

[MIT](LICENSE). Built by **noorulhuda07**.
