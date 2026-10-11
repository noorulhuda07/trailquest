"""Accounts: email/phone + password, one-time codes (OTP), Google sign-in, JWT sessions."""
import hashlib, hmac, os, re, secrets, smtplib, sqlite3, time
from email.message import EmailMessage
import httpx, jwt
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/auth")
SECRET = os.getenv("JWT_SECRET") or secrets.token_hex(32)  # set JWT_SECRET so sessions survive restarts
DEV = os.getenv("DEV_MODE", "false").lower() == "true"     # DEV: codes print to console and return in the response
EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
PHONE = re.compile(r"^\+[1-9]\d{7,14}$")
OTP_TTL, OTP_TRIES, RESEND_GAP = 300, 5, 30
_fails: dict[str, list[float]] = {}


WEAK_SECRETS = {"", "change-me", "dev-only-change-me", "secret", "test"}


def check_config(dev: bool, secret: str | None):
    """Refuse to start in production with a missing or guessable signing secret."""
    if not dev and (not secret or secret in WEAK_SECRETS or len(secret) < 32):
        raise RuntimeError("Set JWT_SECRET to a random value of 32+ characters when DEV_MODE=false.")


def ip(r: Request) -> str:
    return r.client.host if r.client else "?"


def db():
    c = sqlite3.connect(os.getenv("TQ_DB", "trailquest.db"))
    c.row_factory = sqlite3.Row
    c.executescript("""CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, name TEXT, email TEXT UNIQUE, phone TEXT UNIQUE,
      pw TEXT, verified INTEGER DEFAULT 0, google_sub TEXT UNIQUE);
      CREATE TABLE IF NOT EXISTS otps(ident TEXT PRIMARY KEY, code TEXT, exp REAL, tries INTEGER DEFAULT 0, sent REAL);""")
    return c


def norm(x: str) -> str:
    x = x.strip()
    if EMAIL.match(x):
        return x.lower()
    p = re.sub(r"[\s\-()]", "", x)
    if PHONE.match(p):
        return p
    raise HTTPException(422, "Enter a valid email, or a phone number with country code like +919876543210.")


def hpw(p: str, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(16)
    return salt.hex() + ":" + hashlib.scrypt(p.encode(), salt=salt, n=2**14, r=8, p=1).hex()


def check_pw(p: str, stored: str) -> bool:
    salt, _ = stored.split(":")
    return hmac.compare_digest(hpw(p, bytes.fromhex(salt)), stored)


def user_json(u): return {"id": u["id"], "name": u["name"], "email": u["email"], "phone": u["phone"]}
def session(u): return {"token": jwt.encode({"sub": str(u["id"]), "exp": time.time() + 7 * 86400}, SECRET, "HS256"), "user": user_json(u)}


def throttle(key: str, n=8, window=60):
    now = time.time()
    _fails[key] = [t for t in _fails.get(key, []) if now - t < window]
    if len(_fails[key]) >= n:
        raise HTTPException(429, "Too many attempts. Wait a minute and try again.")
    _fails[key].append(now)


def deliver(ident: str, code: str):
    msg = f"Your TrailQuest code is {code}. It expires in 5 minutes."
    if "@" in ident and os.getenv("SMTP_HOST"):
        m = EmailMessage(); m["Subject"], m["From"], m["To"] = "Your TrailQuest code", os.getenv("SMTP_FROM", os.getenv("SMTP_USER", "")), ident
        m.set_content(msg)
        with smtplib.SMTP(os.environ["SMTP_HOST"], int(os.getenv("SMTP_PORT", "587"))) as s:
            s.starttls(); s.login(os.environ["SMTP_USER"], os.environ["SMTP_PASS"]); s.send_message(m)
    elif "@" not in ident and os.getenv("TWILIO_SID"):
        r = httpx.post(f"https://api.twilio.com/2010-04-01/Accounts/{os.environ['TWILIO_SID']}/Messages.json",
                       data={"To": ident, "From": os.environ["TWILIO_FROM"], "Body": msg}, auth=(os.environ["TWILIO_SID"], os.environ["TWILIO_TOKEN"]), timeout=10)
        r.raise_for_status()
    elif DEV:
        print(f"[DEV OTP] {ident}: {code}")
    else:
        raise HTTPException(503, "Code delivery isn't set up on this server.")


def send_otp(ident: str) -> dict:
    now, code = time.time(), f"{secrets.randbelow(10**6):06d}"
    with db() as c:
        row = c.execute("SELECT sent FROM otps WHERE ident=?", (ident,)).fetchone()
        if row and now - row["sent"] < RESEND_GAP:
            raise HTTPException(429, f"Wait {RESEND_GAP} seconds before asking for another code.")
        c.execute("REPLACE INTO otps VALUES(?,?,?,0,?)", (ident, hashlib.sha256((SECRET + ident + code).encode()).hexdigest(), now + OTP_TTL, now))
    deliver(ident, code)
    return {"sent": True, "identifier": ident, **({"dev_code": code} if DEV else {})}


def check_otp(ident: str, code: str):
    with db() as c:
        row = c.execute("SELECT * FROM otps WHERE ident=?", (ident,)).fetchone()
        if not row or row["exp"] < time.time():
            raise HTTPException(400, "Code expired. Request a new one.")
        if row["tries"] >= OTP_TRIES:
            raise HTTPException(429, "Too many wrong codes. Request a new one.")
        c.execute("UPDATE otps SET tries=tries+1 WHERE ident=?", (ident,))
        c.commit()  # persist the attempt before raising, or wrong guesses would never be counted
        if not hmac.compare_digest(row["code"], hashlib.sha256((SECRET + ident + code.strip()).encode()).hexdigest()):
            raise HTTPException(400, "That code is wrong. Check it and try again.")
        c.execute("DELETE FROM otps WHERE ident=?", (ident,))


def find(c, ident: str):
    q = "SELECT * FROM users WHERE email=?" if "@" in ident else "SELECT * FROM users WHERE phone=?"
    return c.execute(q, (ident,)).fetchone()


def current_user(authorization: str = Header(default="")):
    try:
        uid = int(jwt.decode(authorization.removeprefix("Bearer "), SECRET, algorithms=["HS256"], options={"require": ["exp", "sub"]})["sub"])
    except Exception:
        raise HTTPException(401, "Sign in to continue.")
    with db() as c:
        u = c.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()
    if not u:
        raise HTTPException(401, "Sign in to continue.")
    return u


class Signup(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    email: str
    phone: str | None = None
    password: str = Field(min_length=8, max_length=128)
    send_to: str = "email"


class Login(BaseModel):
    identifier: str
    password: str = Field(max_length=128)


class OtpReq(BaseModel):
    identifier: str


class OtpVerify(OtpReq):
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


class Google(BaseModel):
    credential: str


@router.post("/signup")
def signup(b: Signup, request: Request):
    throttle("send:" + ip(request), 10, 600)  # caps SMS/email pumping per IP
    email, phone = norm(b.email), (norm(b.phone) if b.phone else None)
    if "@" not in email or (phone and "@" in phone):
        raise HTTPException(422, "Use an email in the email field and a phone number in the phone field.")
    with db() as c:
        c.execute("DELETE FROM users WHERE verified=0 AND (email=? OR phone=?)", (email, phone))
        try:
            c.execute("INSERT INTO users(name,email,phone,pw) VALUES(?,?,?,?)", (b.name.strip(), email, phone, hpw(b.password)))
        except sqlite3.IntegrityError:
            raise HTTPException(409, "An account with this email or phone already exists. Sign in instead.")
    return send_otp(phone if (b.send_to == "phone" and phone) else email)


@router.post("/otp/request")
def otp_request(b: OtpReq, request: Request):
    throttle("send:" + ip(request), 10, 600)
    ident = norm(b.identifier)
    throttle("otp:" + ident, 5, 600)
    with db() as c:
        exists = find(c, ident)
    return send_otp(ident) if exists else {"sent": True, "identifier": ident}  # same reply either way: no account lookup leak


@router.post("/otp/verify")
def otp_verify(b: OtpVerify):
    ident = norm(b.identifier)
    check_otp(ident, b.code)
    with db() as c:
        u = find(c, ident)
        if not u:
            raise HTTPException(400, "That code is wrong. Check it and try again.")
        c.execute("UPDATE users SET verified=1 WHERE id=?", (u["id"],))
        u = c.execute("SELECT * FROM users WHERE id=?", (u["id"],)).fetchone()
    return session(u)


@router.post("/login")
def login(b: Login):
    ident = norm(b.identifier)
    throttle("login:" + ident)
    with db() as c:
        u = find(c, ident)
    if not u or not u["pw"] or not check_pw(b.password, u["pw"]):
        raise HTTPException(401, "Wrong email, phone or password.")
    if not u["verified"]:
        raise HTTPException(403, "Verify your account with a code first.")
    return session(u)


@router.post("/google")
def google(b: Google):
    cid = os.getenv("GOOGLE_CLIENT_ID")
    if not cid:
        raise HTTPException(503, "Google sign-in isn't set up on this server.")
    try:
        info = httpx.get("https://oauth2.googleapis.com/tokeninfo", params={"id_token": b.credential}, timeout=10).json()
    except Exception:
        raise HTTPException(401, "Couldn't check your Google sign-in. Try again.")
    if info.get("aud") != cid or info.get("email_verified") not in ("true", True) or not info.get("email"):
        raise HTTPException(401, "Google sign-in failed.")
    with db() as c:
        u = c.execute("SELECT * FROM users WHERE google_sub=? OR email=?", (info["sub"], info["email"].lower())).fetchone()
        if u:
            c.execute("UPDATE users SET google_sub=?, verified=1 WHERE id=?", (info["sub"], u["id"]))
        else:
            c.execute("INSERT INTO users(name,email,verified,google_sub) VALUES(?,?,1,?)", (info.get("name", "Explorer")[:40], info["email"].lower(), info["sub"]))
        u = c.execute("SELECT * FROM users WHERE google_sub=?", (info["sub"],)).fetchone()
    return session(u)


@router.post("/demo")
def demo():
    """One-click guest session for judges and demos. Off unless DEMO_MODE=true."""
    if os.getenv("DEMO_MODE", "false").lower() != "true":
        raise HTTPException(403, "Demo mode is turned off on this server.")
    throttle("demo", 30, 60)
    with db() as c:
        c.execute("INSERT INTO users(name,email,verified) VALUES(?,?,1)", ("Demo Explorer", f"demo-{secrets.token_hex(6)}@demo.local"))
        u = c.execute("SELECT * FROM users WHERE id=last_insert_rowid()").fetchone()
    return session(u)  # no password set, so it can only be used through this token


@router.get("/me")
def me(u=Depends(current_user)):
    return user_json(u)
