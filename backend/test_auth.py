import os, tempfile
os.environ.update(TQ_DB=os.path.join(tempfile.mkdtemp(), "t.db"), DEV_MODE="true", JWT_SECRET="test-only-secret-with-at-least-32-characters")
from fastapi.testclient import TestClient
import auth
from main import app

c = TestClient(app)
P = {"name": "Noor", "email": "Noor@Example.com", "phone": "+919876543210", "password": "hunter2hunter2", "send_to": "phone"}


def test_full_flow():
    r = c.post("/api/auth/signup", json=P).json()
    assert r["identifier"] == "+919876543210"
    assert c.post("/api/auth/login", json={"identifier": "noor@example.com", "password": P["password"]}).status_code == 403
    assert c.post("/api/auth/otp/verify", json={"identifier": r["identifier"], "code": "000000" if r["dev_code"] != "000000" else "111111"}).status_code == 400
    s = c.post("/api/auth/otp/verify", json={"identifier": r["identifier"], "code": r["dev_code"]}).json()
    h = {"Authorization": "Bearer " + s["token"]}
    assert c.get("/api/auth/me", headers=h).json()["email"] == "noor@example.com"
    assert c.post("/api/auth/login", json={"identifier": "+91 98765 43210", "password": P["password"]}).status_code == 200
    assert c.post("/api/auth/login", json={"identifier": "noor@example.com", "password": "wrongwrong"}).status_code == 401
    assert c.post("/api/quest", json={}, headers=h).status_code == 200


def test_quest_needs_login():
    assert c.post("/api/quest", json={}).status_code == 401


def test_duplicate_and_bad_input():
    assert c.post("/api/auth/signup", json={**P, "email": "noor@example.com", "phone": "+911234567890"}).status_code in (200, 409)
    assert c.post("/api/auth/signup", json={**P, "email": "bad"}).status_code == 422
    assert c.post("/api/auth/signup", json={**P, "password": "short"}).status_code == 422


def test_otp_locks_after_five_wrong_codes():
    ident = c.post("/api/auth/signup", json={**P, "email": "lock@example.com", "phone": None, "send_to": "email"}).json()["identifier"]
    for _ in range(5):
        c.post("/api/auth/otp/verify", json={"identifier": ident, "code": "999999"})
    assert c.post("/api/auth/otp/verify", json={"identifier": ident, "code": "999999"}).status_code == 429


def test_demo_mode(monkeypatch):
    monkeypatch.setenv("DEMO_MODE", "true")
    s = c.post("/api/auth/demo").json()
    assert c.post("/api/quest", json={}, headers={"Authorization": "Bearer " + s["token"]}).status_code == 200
    monkeypatch.setenv("DEMO_MODE", "false")
    assert c.post("/api/auth/demo").status_code == 403
