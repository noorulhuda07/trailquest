import { useEffect, useState } from "react";

const D = () => new Date().toISOString().slice(0, 10);
const DEF = { name: "Explorer", xp: 0, streak: 0, last: null, done: 0, days: {}, water: {}, mode: "system", theme: "forest", units: "km", quest: null, liked: {} };
const THEMES = { forest: "#1F6B45", ocean: "#1E6F9F", sunset: "#C0522A", lavender: "#6B5BB5" };
const BADGES = [["🌿", "Nature Explorer", "Complete 1 quest", (s) => s.done >= 1], ["🔥", "Streak Master", "7 day streak", (s) => s.streak >= 7],
  ["👟", "Fitness Rookie", "Log 10k steps", (s) => total(s) >= 10000], ["🏔️", "Quest Pro", "Complete 25 quests", (s) => s.done >= 25]];
const total = (s) => Object.values(s.days).reduce((a, b) => a + b, 0);
const lvl = (xp) => [1 + Math.floor(xp / 1000), (xp % 1000) / 1000];

function Hero({ children }) {
  return (<div className="hero"><svg viewBox="0 0 400 120" preserveAspectRatio="none"><polygon fill="var(--m1)" points="0,120 0,70 80,30 150,75 240,15 330,70 400,45 400,120" /><polygon fill="var(--m2)" points="0,120 0,95 90,60 170,100 260,55 340,95 400,80 400,120" /></svg><div className="t">{children}</div></div>);
}
function Ring({ pct, size = 170, children }) {
  const r = size / 2 - 10, c = 2 * Math.PI * r;
  return (<div className="ring" style={{ width: size, height: size }}><svg width={size} height={size}><circle cx={size / 2} cy={size / 2} r={r} className="rt" /><circle cx={size / 2} cy={size / 2} r={r} className="rf" strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, pct))} transform={`rotate(-90 ${size / 2} ${size / 2})`} /></svg><div className="rc">{children}</div></div>);
}
const Bar = ({ p }) => <div className="bar"><i style={{ width: `${Math.min(100, p * 100)}%` }} /></div>;

export default function App({ user, token, logout }) {
  const [s, setS] = useState(() => { try { return { ...DEF, name: user.name, ...JSON.parse(localStorage.getItem("tq2:" + user.id)) }; } catch { return DEF; } });
  const up = (p) => setS((x) => ({ ...x, ...p }));
  const [tab, setTab] = useState("home");
  const [sub, setSub] = useState(null); // today | journal | settings

  useEffect(() => localStorage.setItem("tq2:" + user.id, JSON.stringify(s)), [s]);
  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => { document.documentElement.dataset.mode = s.mode === "dark" || (s.mode === "system" && mq.matches) ? "dark" : "light"; document.documentElement.dataset.theme = s.theme; };
    apply(); mq.addEventListener("change", apply); return () => mq.removeEventListener("change", apply);
  }, [s.mode, s.theme]);

  const steps = s.days[D()] || 0, water = s.water[D()] || 0;
  const [lv, lp] = lvl(s.xp);
  const go = (t) => { setTab(t); setSub(null); };
  const km = (v) => (s.units === "km" ? `${v.toFixed(1)} km` : `${(v * 0.621).toFixed(1)} mi`);

  const view = sub === "settings" ? <Settings s={s} up={up} back={() => setSub(null)} user={user} logout={logout} />
    : sub === "today" ? <Today s={s} up={up} steps={steps} water={water} km={km} back={() => setSub(null)} />
    : sub === "journal" ? <Journal s={s} steps={steps} water={water} back={() => setSub(null)} />
    : tab === "home" ? <Home s={s} lv={lv} lp={lp} steps={steps} water={water} go={go} open={setSub} />
    : tab === "map" ? <MapTab s={s} go={go} />
    : tab === "quest" ? <QuestTab s={s} up={up} steps={steps} token={token} logout={logout} />
    : tab === "snaps" ? <Snaps s={s} up={up} />
    : <Me s={s} lv={lv} lp={lp} open={setSub} />;

  return (<div className="app">{view}
    <nav className="nav" aria-label="Main">{[["home", "Home", "🏠"], ["map", "Map", "🗺️"], ["quest", "Quest", "🧭"], ["snaps", "Snaps", "📸"], ["me", "Me", "👤"]].map(([k, l, i]) =>
      <button key={k} className={tab === k && !sub ? "on" : ""} onClick={() => go(k)} aria-current={tab === k}><span>{i}</span>{l}</button>)}</nav></div>);
}

function Home({ s, lv, lp, steps, water, go, open }) {
  const h = new Date().getHours();
  return (<div>
    <Hero><p>{h < 12 ? "Good morning," : h < 18 ? "Good afternoon," : "Good evening,"}</p><b>{s.name} 🌿</b><p className="mute">Small steps. Big adventures.</p></Hero>
    <div className="pad lift"><div className="card"><div className="stats"><div><b>🔥 {s.streak}</b><span className="mute">Day streak</span></div><div><b>⭐ {s.xp.toLocaleString()}</b><span className="mute">XP</span></div><div><b>Level {lv}</b><span className="mute">{Math.round(lp * 1000)} / 1,000</span></div></div></div>
      <h3>Today's quest</h3>
      <div className="card">{s.quest ? <><b>{s.quest.title}</b><p className="mute">{s.quest.steps.reduce((a, b) => a + b.minutes, 0)} min · {s.quest.intensity} intensity</p></> : <p className="mute">No quest yet. Build one that fits your energy and time.</p>}
        <button onClick={() => go("quest")}>{s.quest ? "Continue" : "Create a quest"}</button></div>
      <h3>Today's progress</h3>
      <div className="row"><div className="card" onClick={() => open("today")} role="button" tabIndex={0}><b style={{ fontSize: "1.4rem" }}>{steps.toLocaleString()}</b><p className="mute">steps</p></div>
        <div className="card" onClick={() => open("journal")} role="button" tabIndex={0}><b style={{ fontSize: "1.4rem" }}>{water}/8</b><p className="mute">glasses</p></div></div></div></div>);
}

function Today({ s, up, steps, water, km, back }) {
  const dist = steps * 0.0007, week = [...Array(7)].map((_, i) => { const d = new Date(Date.now() - (6 - i) * 864e5); return [d.toLocaleDateString("en", { weekday: "short" }), s.days[d.toISOString().slice(0, 10)] || 0]; });
  const mx = Math.max(8000, ...week.map((w) => w[1]));
  return (<div><h2><button className="ghost" onClick={back} aria-label="Back">←</button> Today</h2><div className="pad">
    <Ring pct={steps / 8000}><b>{steps.toLocaleString()}</b><span className="mute">of 8,000 steps</span></Ring>
    <div className="card stats"><div><b>{km(dist)}</b><span className="mute">distance</span></div><div><b>{Math.round(steps * 0.04)}</b><span className="mute">kcal</span></div><div><b>{Math.round(steps / 110)}</b><span className="mute">active min</span></div></div>
    <div className="card"><b>Weekly progress</b><div className="bars">{week.map(([d, v]) => <i key={d} style={{ height: `${(v / mx) * 100}%` }} title={`${d}: ${v}`} />)}</div><div className="stats mute">{week.map(([d]) => <span key={d}>{d}</span>)}</div></div>
    <div className="card"><b>Water intake · {water}/8 glasses</b><Bar p={water / 8} /><div className="row"><button className="alt" onClick={() => up({ water: { ...s.water, [D()]: Math.max(0, water - 1) } })}>− 1</button><button onClick={() => up({ water: { ...s.water, [D()]: Math.min(20, water + 1) } })}>+ 1 glass</button></div></div></div></div>);
}

function Journal({ s, steps, water, back }) {
  const items = [["Complete a quest", s.last === D(), 50], ["2,000 steps", steps >= 2000, 100], ["Hydrate (8 glasses)", water >= 8, 50]];
  return (<div><h2><button className="ghost" onClick={back} aria-label="Back">←</button> My Trail Journal</h2><div className="pad"><div className="card">
    {items.map(([t, d, x]) => <div className="chk" key={t}><span className={"c " + (d ? "on" : "")}>{d ? "✓" : ""}</span><div><b>{t}</b><p className="mute">+{x} XP</p></div></div>)}</div>
    <div className="card"><p className="mute">Current streak</p><b style={{ fontSize: "1.8rem" }}>🔥 {s.streak} days</b><p className="mute">Any movement counts, even an easy recovery walk.</p></div></div></div>);
}

function MapTab({ s, go }) {
  const pts = [[70, 330], [200, 270], [110, 190], [250, 120]], names = ["Meadow", "Forest", "Lake", "Mountain Trail"];
  return (<div><h2>Quest Map</h2><div className="pad"><div className="card"><svg viewBox="0 0 340 380" width="100%" role="img" aria-label="Quest map"><rect width="340" height="380" rx="14" fill="var(--sky)" /><path d="M70 330 C 200 320 230 280 200 270 S 90 230 110 190 S 300 170 250 120" fill="none" stroke="var(--m2)" strokeWidth="5" strokeDasharray="2 10" strokeLinecap="round" />
    {pts.map(([x, y], i) => <g key={i} opacity={i <= s.done ? 1 : .35}><circle cx={x} cy={y} r="18" fill={i === s.done ? "var(--sun)" : "var(--accent)"} /><text x={x} y={y + 5} textAnchor="middle" fontSize="15">{i < s.done ? "✓" : i === s.done ? "🚶" : "🔒"}</text><text x={x} y={y + 36} textAnchor="middle" fontSize="12" fill="var(--ink)">{names[i]}</text></g>)}</svg></div>
    <div className="card"><p className="mute">Next region</p><b>{s.done >= 3 ? "All regions unlocked" : names[Math.min(3, s.done + 1)]}</b><p className="mute">{s.done >= 3 ? "Keep exploring." : `Complete ${3 - s.done} more quests`}</p><button onClick={() => go("quest")}>Start a quest</button></div></div></div>);
}

function QuestTab({ s, up, steps, token, logout }) {
  const [v, setV] = useState(s.quest ? "detail" : "setup");
  const [f, setF] = useState({ target_type: "steps", target_value: 8000, energy: "medium", mood: "okay", duration_min: 45, environment: "outdoor", workout_type: "walk" });
  const [err, setErr] = useState(""), [busy, setBusy] = useState(false), [left, setLeft] = useState(0), [got, setGot] = useState({ steps: 0, min: 0 });
  const q = s.quest, tot = q ? q.steps.reduce((a, b) => a + b.minutes, 0) * 60 : 0;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "number" ? Number(e.target.value) : e.target.value });
  const opt = (k, o) => <select id={k} value={f[k]} onChange={set(k)}>{o.map((x) => <option key={x}>{x}</option>)}</select>;
  useEffect(() => { if (v !== "away") return; const t = setInterval(() => setLeft((x) => Math.max(0, x - 1)), 1000); return () => clearInterval(t); }, [v]);

  async function gen(e) {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      const r = await fetch("/api/quest", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify(f) });
      if (r.status === 401) { logout(); return; }
      if (!r.ok) throw new Error(r.status === 429 ? "Too many quests. Wait a minute." : "Duration must be 10–180 minutes and the goal above 0.");
      up({ quest: await r.json() }); setV("detail");
    } catch (x) { setErr(x.message === "Failed to fetch" ? "Can't reach the server. Start the backend on port 8000." : x.message); }
    setBusy(false);
  }
  function finish() {
    const ok = got.min >= 1, y = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    up({ xp: s.xp + (ok ? 50 + Math.floor(got.steps / 100) : 0), done: s.done + (ok ? 1 : 0), streak: !ok ? s.streak : s.last === D() ? s.streak : s.last === y ? s.streak + 1 : 1, last: ok ? D() : s.last, days: { ...s.days, [D()]: steps + got.steps } });
    setV("done");
  }

  if (v === "away") { const m = String(Math.floor(left / 60)).padStart(2, "0"), c = String(left % 60).padStart(2, "0");
    return <div className="away"><p>Phone away. Go enjoy it.</p><div className="time">{m}:{c}</div><button onClick={() => { setGot({ steps: 0, min: Math.round((tot - left) / 60) }); setV("log"); }}>I'm back</button></div>; }

  return (<div><h2>Quest</h2><div className="pad">
    {v === "setup" && <form onSubmit={gen}><div className="row"><div><label htmlFor="target_type">Target</label>{opt("target_type", ["steps", "calories", "distance", "time"])}</div><div><label htmlFor="tv">Goal</label><input id="tv" type="number" value={f.target_value} onChange={set("target_value")} /></div></div>
      <div className="row"><div><label htmlFor="energy">Energy</label>{opt("energy", ["low", "medium", "high"])}</div><div><label htmlFor="mood">Mood</label>{opt("mood", ["tired", "okay", "great", "stressed"])}</div></div>
      <div className="row"><div><label htmlFor="du">Minutes</label><input id="du" type="number" value={f.duration_min} onChange={set("duration_min")} /></div><div><label htmlFor="environment">Where</label>{opt("environment", ["outdoor", "indoor"])}</div></div>
      {err && <p className="err" role="alert">{err}</p>}<button disabled={busy}>{busy ? "Building your quest…" : "Generate quest"}</button></form>}
    {v === "detail" && q && <><div className="card"><b style={{ fontSize: "1.3rem" }}>{q.title}</b><p className="mute">{tot / 60} min · {q.intensity} · +50 XP</p>
      {q.source && <p className={"pill" + (q.source === "gemma" ? "" : " fb")}>{q.source === "gemma" ? `🧠 Gemma (${q.model}) · open-weight, self-hosted · ✓ code-validated` : "🛟 Backup rules engine (Gemma unavailable) · ✓ code-validated"}</p>}
      {q.steps.map((x, i) => <div className="phase" key={i}><b>{x.title}</b> · {x.minutes} min<br /><span className="mute">{x.detail}</span></div>)}
      {q.nature_challenges.length > 0 && <div className="nature"><b>Nature challenges</b><ul>{q.nature_challenges.map((c) => <li key={c}>{c}</li>)}</ul></div>}</div>
      <button onClick={() => { setLeft(tot); setV("away"); }}>Start quest</button><button className="alt" onClick={() => setV("setup")}>New quest</button></>}
    {v === "log" && <div className="card"><b>How did it go?</b><label htmlFor="st">Steps (from your watch or phone)</label><input id="st" type="number" min="0" value={got.steps} onChange={(e) => setGot({ ...got, steps: Number(e.target.value) })} /><button onClick={finish}>Complete quest</button></div>}
    {v === "done" && <div className="card"><b style={{ fontSize: "1.3rem" }}>Quest complete</b><p className="mute">🔥 {s.streak}-day streak · ⭐ {s.xp} XP. Any movement keeps your streak.</p><button onClick={() => setV("setup")}>New quest</button></div>}
  </div></div>);
}

function Snaps({ s, up }) {
  const [f, setF] = useState("All");
  const feed = [["Ayesha", "finished a 5K run", "+300 XP", "Challenges", 18], ["Rahul", "completed Morning Trail", "+200 XP", "Friends", 24], ["Aisha", "stayed hydrated", "+50 XP", "Friends", 12]].filter((x) => f === "All" || x[3] === f);
  return (<div><h2>Snaps</h2><div className="tabs">{["All", "Friends", "Challenges"].map((t) => <button key={t} className={f === t ? "on" : ""} onClick={() => setF(t)}>{t}</button>)}</div><div className="pad">
    {feed.map(([n, a, x, , l]) => <div className="snap" key={n}><div className="img" style={{ background: "linear-gradient(160deg,var(--sky),var(--m1) 60%,var(--m2))" }} /><div className="b"><b>{n}</b> {a} <span className="mute">{x}</span><br />
      <button className="ghost" onClick={() => up({ liked: { ...s.liked, [n]: !s.liked[n] } })} aria-pressed={!!s.liked[n]}>{s.liked[n] ? "❤️" : "🤍"} {l + (s.liked[n] ? 1 : 0)}</button></div></div>)}
    {!feed.length && <p className="mute">Nothing here yet.</p>}</div></div>);
}

function Me({ s, lv, lp, open }) {
  return (<div><Hero><button className="ghost" style={{ float: "right", fontSize: "1.4rem" }} onClick={() => open("settings")} aria-label="Settings">⚙️</button></Hero>
    <div className="pad lift" style={{ textAlign: "center" }}><div style={{ fontSize: "3.5rem" }}>🥾</div><h3 style={{ margin: 0 }}>{s.name}</h3><p className="mute">Trail Seeker · Level {lv}</p><Bar p={lp} />
      <div className="card stats" style={{ marginTop: 12 }}><div><b>🔥 {s.streak}</b><span className="mute">Day streak</span></div><div><b>🚩 {s.done}</b><span className="mute">Quests</span></div></div>
      <h3 style={{ textAlign: "left" }}>Badges</h3><div className="badges">{BADGES.map(([e, n, d, ok]) => <div key={n} className={"card badge " + (ok(s) ? "" : "lock")}><div className="e">{e}</div><b>{n}</b><p className="mute">{d}</p></div>)}</div>
      <button className="alt" onClick={() => open("journal")}>Open trail journal</button></div></div>);
}

function Settings({ s, up, back, user, logout }) {
  return (<div><h2><button className="ghost" onClick={back} aria-label="Back">←</button> Settings</h2><div className="pad">
    <div className="card"><b>Mode</b><div className="seg" role="group" aria-label="Mode" style={{ marginTop: 10 }}>{[["light", "☀️ Light"], ["dark", "🌙 Dark"], ["system", "Auto"]].map(([k, l]) => <button key={k} className={s.mode === k ? "on" : ""} onClick={() => up({ mode: k })}>{l}</button>)}</div></div>
    <div className="card"><b>Theme</b><div className="sw" style={{ marginTop: 10 }}>{Object.entries(THEMES).map(([k, c]) => <button key={k} className={s.theme === k ? "on" : ""} style={{ background: c }} onClick={() => up({ theme: k })} aria-label={k} aria-pressed={s.theme === k} />)}</div><p className="mute" style={{ marginTop: 8 }}>{s.theme[0].toUpperCase() + s.theme.slice(1)}</p></div>
    <div className="card"><label htmlFor="nm" style={{ marginTop: 0 }}>Display name</label><input id="nm" value={s.name} maxLength={20} onChange={(e) => up({ name: e.target.value })} />
      <label htmlFor="un">Units</label><select id="un" value={s.units} onChange={(e) => up({ units: e.target.value })}><option value="km">Kilometres</option><option value="mi">Miles</option></select></div>
    <div className="card"><b>Account</b><p className="mute">{user.email || user.phone}</p><button className="alt" onClick={logout}>Log out</button></div>
    <button className="alt" onClick={() => { if (confirm("Erase all progress?")) { localStorage.removeItem("tq2:" + user.id); location.reload(); } }}>Reset progress</button></div></div>);
}
