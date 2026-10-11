import { useEffect, useState } from "react";
import App from "./App.jsx";

const GID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export async function api(path, body, token) {
  const r = await fetch("/api/" + path, { method: body ? "POST" : "GET", headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(typeof d.detail === "string" ? d.detail : "Check the details you entered: password needs 8+ characters."), { status: r.status });
  return d;
}

export default function Root() {
  const [tok, setTok] = useState(() => localStorage.getItem("tq_token"));
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(!tok);
  useEffect(() => {
    if (!tok) return;
    api("auth/me", null, tok).then(setUser).catch(() => { localStorage.removeItem("tq_token"); setTok(null); }).finally(() => setReady(true));
  }, [tok]);
  const login = (t, u) => { localStorage.setItem("tq_token", t); setUser(u); setTok(t); setReady(true); };
  const logout = () => { localStorage.removeItem("tq_token"); setTok(null); setUser(null); };
  if (!ready) return <div className="app pad"><p className="mute" style={{ paddingTop: 40 }}>Loading…</p></div>;
  if (!tok || !user) return <Auth onAuth={login} />;
  return <App key={user.id} user={user} token={tok} logout={logout} />;
}

function Auth({ onAuth }) {
  const [mode, setMode] = useState("signin"); // signin | signup | code
  const [step, setStep] = useState("form");   // form | verify
  const [f, setF] = useState({ name: "", email: "", phone: "", password: "", identifier: "", sendTo: "email" });
  const [code, setCode] = useState(""), [ident, setIdent] = useState(""), [dev, setDev] = useState("");
  const [err, setErr] = useState(""), [busy, setBusy] = useState(false), [wait, setWait] = useState(0);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  useEffect(() => { if (wait <= 0) return; const t = setTimeout(() => setWait(wait - 1), 1000); return () => clearTimeout(t); }, [wait]);
  const run = async (fn) => { setBusy(true); setErr(""); try { await fn(); } catch (x) { setErr(x.message === "Failed to fetch" ? "Can't reach the server. Start the backend on port 8000." : x.message); } setBusy(false); };
  const toVerify = (id, r) => { setIdent(id); setDev(r.dev_code || ""); setCode(""); setStep("verify"); setWait(30); };

  useEffect(() => {
    if (!GID || step !== "form") return;
    const init = () => {
      window.google.accounts.id.initialize({ client_id: GID, callback: (r) => run(async () => { const d = await api("auth/google", { credential: r.credential }); onAuth(d.token, d.user); }) });
      window.google.accounts.id.renderButton(document.getElementById("gbtn"), { theme: "outline", size: "large", width: 340, text: "continue_with" });
    };
    if (window.google?.accounts) init();
    else { const s = document.createElement("script"); s.src = "https://accounts.google.com/gsi/client"; s.async = true; s.onload = init; document.head.appendChild(s); }
  }, [step, mode]);

  const submit = (e) => { e.preventDefault(); run(async () => {
    if (mode === "signup") { const r = await api("auth/signup", { name: f.name, email: f.email, phone: f.phone || null, password: f.password, send_to: f.phone ? f.sendTo : "email" }); toVerify(r.identifier, r); }
    else if (mode === "code") { const r = await api("auth/otp/request", { identifier: f.identifier }); toVerify(r.identifier, r); }
    else {
      try { const r = await api("auth/login", { identifier: f.identifier, password: f.password }); onAuth(r.token, r.user); }
      catch (x) { if (x.status === 403) { const r = await api("auth/otp/request", { identifier: f.identifier }); toVerify(r.identifier, r); } else throw x; }
    }
  }); };
  const verify = (e) => { e.preventDefault(); run(async () => { const r = await api("auth/otp/verify", { identifier: ident, code }); onAuth(r.token, r.user); }); };
  const resend = () => run(async () => { const r = await api("auth/otp/request", { identifier: ident }); setDev(r.dev_code || ""); setWait(30); });

  return (<div className="app"><div className="hero" style={{ height: 150 }}><div className="t"><b>TrailQuest</b><p className="mute">Plan it here, then put the phone away.</p></div></div>
    <div className="pad">
      {step === "verify" ? (<form onSubmit={verify} className="card">
        <b style={{ fontSize: "1.2rem" }}>Enter your code</b><p className="mute">We sent a 6-digit code to {ident}. It expires in 5 minutes.</p>
        {dev && <p className="nature">Dev mode: your code is <b>{dev}</b></p>}
        <label htmlFor="otp">Code</label><input id="otp" className="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="\d{6}" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} autoFocus />
        {err && <p className="err" role="alert">{err}</p>}
        <button disabled={busy || code.length !== 6}>{busy ? "Checking…" : "Verify and continue"}</button>
        <button type="button" className="alt" disabled={wait > 0 || busy} onClick={resend}>{wait > 0 ? `Send a new code in ${wait}s` : "Send a new code"}</button>
        <button type="button" className="link" onClick={() => { setStep("form"); setErr(""); }}>Change details</button></form>)
      : (<form onSubmit={submit} className="card">
        <div className="seg" role="group" aria-label="Account">{[["signin", "Sign in"], ["signup", "Create account"]].map(([k, l]) => <button type="button" key={k} className={mode === k || (k === "signin" && mode === "code") ? "on" : ""} onClick={() => { setMode(k); setErr(""); }}>{l}</button>)}</div>
        {mode === "signup" ? (<>
          <label htmlFor="n">Name</label><input id="n" value={f.name} onChange={set("name")} maxLength={40} required autoComplete="name" />
          <label htmlFor="e">Email</label><input id="e" type="email" value={f.email} onChange={set("email")} required autoComplete="email" />
          <label htmlFor="p">Phone (optional)</label><input id="p" type="tel" placeholder="+919876543210" value={f.phone} onChange={set("phone")} autoComplete="tel" />
          <label htmlFor="pw">Password</label><input id="pw" type="password" minLength={8} value={f.password} onChange={set("password")} required autoComplete="new-password" />
          {f.phone && <><label htmlFor="st">Send my code to</label><select id="st" value={f.sendTo} onChange={set("sendTo")}><option value="email">Email</option><option value="phone">Phone (SMS)</option></select></>}
        </>) : (<>
          <label htmlFor="id">Email or phone</label><input id="id" value={f.identifier} onChange={set("identifier")} required autoComplete="username" placeholder="you@example.com or +919876543210" />
          {mode === "signin" && <><label htmlFor="pw2">Password</label><input id="pw2" type="password" value={f.password} onChange={set("password")} required autoComplete="current-password" /></>}
        </>)}
        {err && <p className="err" role="alert">{err}</p>}
        <button disabled={busy}>{busy ? "Please wait…" : mode === "signup" ? "Create account" : mode === "code" ? "Send me a code" : "Sign in"}</button>
        {mode !== "signup" && <button type="button" className="link" onClick={() => { setMode(mode === "code" ? "signin" : "code"); setErr(""); }}>{mode === "code" ? "Use my password instead" : "Email me a one-time code instead"}</button>}
        <button type="button" className="alt" disabled={busy} onClick={() => run(async () => { const r = await api("auth/demo", {}); onAuth(r.token, r.user); })}>Try the demo (no sign-up)</button>
        {GID ? <div id="gbtn" style={{ marginTop: 14, display: "flex", justifyContent: "center" }} /> : <p className="mute" style={{ marginTop: 14 }}>Google sign-in appears once VITE_GOOGLE_CLIENT_ID is set.</p>}
      </form>)}
    </div></div>);
}
