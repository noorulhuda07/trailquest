# trailquest
AI fitness quests powered by open-weight Gemma. Plan it, put the phone away, touch grass.

# TrailQuest MVP

## Backend
    cd backend && python -m venv .venv && source .venv/bin/activate
    pip install -r requirements.txt && cp .env.example .env
    ollama pull gemma3          # optional; without it the rule-based fallback is used
    uvicorn main:app --reload   # http://localhost:8000
    pytest

## Frontend
    cd frontend && npm install && npm run dev   # http://localhost:5173

## Accounts and OTP
Copy `backend/.env.example` to `backend/.env`. With `DEV_MODE=true`, codes print in the server console and show on screen.
For real delivery set SMTP_* (email) and TWILIO_* (SMS). For Google sign-in, create a Web OAuth client ID, add
http://localhost:5173 as an authorised JavaScript origin, then set GOOGLE_CLIENT_ID (backend/.env) and VITE_GOOGLE_CLIENT_ID (frontend/.env).

## One-command run (Docker)
    docker compose up --build        # then open http://localhost:8080
Starts the web app, the API, Ollama, and pulls Gemma (`GEMMA_MODEL=gemma3` by default; try `gemma3:1b` for a smaller download).
Click **Try the demo** to skip sign-up. Each quest shows a badge: Gemma (self-hosted) or the backup rules engine, always code-validated.
Before real use set `DEV_MODE=false`, `DEMO_MODE=false` and a long `JWT_SECRET`.
