"use client";

// Settings (v0.0.59): profile, password and price-alert e-mails are saved to the backend.
import React from "react";
import { Bell, Check, KeyRound, Loader2, Sparkles, User2, AlertCircle } from "lucide-react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";

const card = "rounded-[1.5rem] md:rounded-[2rem] border border-brand-border bg-brand-card/25 p-5 sm:p-6 md:p-8";
const input = "mt-2 w-full rounded-xl border border-brand-border bg-brand-bg/70 px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-brand-cyan/50 focus:outline-none";
const label = "text-[10px] font-black uppercase tracking-[0.2em] text-gray-500";
const button = "inline-flex items-center gap-2 rounded-xl bg-brand-cyan px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.18em] text-brand-bg transition hover:scale-[1.02] disabled:opacity-40";

function Notice({ state }) {
  if (!state?.text) return null;
  const ok = state.type === "ok";
  return (
    <p className={`mt-3 flex items-center gap-2 text-xs font-semibold ${ok ? "text-emerald-300" : "text-rose-300"}`}>
      {ok ? <Check className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />} {state.text}
    </p>
  );
}

async function call(path, method, body) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) throw new Error(data.message || data.error || `Error ${res.status}`);
  return data;
}

export default function SettingsPage() {
  const [user, setUser] = React.useState(null);
  const [profile, setProfile] = React.useState({ name: "", email: "" });
  const [pw, setPw] = React.useState({ current: "", next: "", repeat: "" });
  const [notify, setNotify] = React.useState(false);
  const [stats, setStats] = React.useState(null);
  const [busy, setBusy] = React.useState("");
  const [msg, setMsg] = React.useState({});

  const say = (key, type, text) => setMsg((m) => ({ ...m, [key]: { type, text } }));

  React.useEffect(() => {
    const stored = sessionStorage.getItem("user");
    if (!stored) return;
    const u = JSON.parse(stored);
    setUser(u);
    setProfile({ name: u.name || "", email: u.email || "" });
    setNotify(Boolean(u.notifications_active));
    call(`/api/users/${u.id}`, "GET")
      .then((d) => {
        if (d.user) setProfile({ name: d.user.name, email: d.user.email });
        setNotify(Boolean(d.notifications_active));
        setStats(d.stats || null);
      })
      .catch(() => {});
  }, []);

  const storeUser = (patch) => {
    const u = { ...user, ...patch };
    setUser(u);
    sessionStorage.setItem("user", JSON.stringify(u));
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    setBusy("profile");
    try {
      const d = await call(`/api/users/${user.id}`, "PATCH", profile);
      storeUser({ name: d.user.name, email: d.user.email });
      say("profile", "ok", "Profile saved.");
    } catch (err) {
      say("profile", "err", err.message);
    } finally {
      setBusy("");
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    if (pw.next !== pw.repeat) return say("password", "err", "The new passwords do not match.");
    setBusy("password");
    try {
      await call(`/api/users/${user.id}/password`, "POST", { current: pw.current, next: pw.next });
      setPw({ current: "", next: "", repeat: "" });
      say("password", "ok", "Password changed.");
    } catch (err) {
      say("password", "err", err.message);
    } finally {
      setBusy("");
    }
  };

  const toggleNotify = async () => {
    const next = !notify;
    setNotify(next);
    try {
      await call(`/api/users/${user.id}/notifications`, "PATCH", { active: next });
      storeUser({ notifications_active: next ? 1 : 0 });
      say("notify", "ok", next ? "Price-drop e-mails are on." : "Price-drop e-mails are off.");
    } catch (err) {
      setNotify(!next);
      say("notify", "err", err.message);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#060b13] p-10 text-center text-sm text-gray-400">
        Log in to change your settings.
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#060b13] px-4 py-6 sm:px-6 sm:py-10 md:px-10">
      <div className="pointer-events-none absolute -left-28 top-0 h-96 w-96 rounded-full bg-brand-cyan/10 blur-[120px]" />
      <div className="mx-auto max-w-5xl space-y-6">
        <section className={card}>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-cyan">Settings</p>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">Your account</h1>
          {stats && (
            <p className="mt-3 text-sm text-gray-400">
              <Sparkles className="mr-1 inline h-4 w-4 text-brand-cyan" />
              {stats.products} tracked products · {stats.alerts} with a target price
            </p>
          )}
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <form onSubmit={saveProfile} className={card}>
            <h2 className="mb-5 flex items-center gap-2 text-lg font-black text-white">
              <User2 className="h-5 w-5 text-brand-cyan" /> Profile
            </h2>
            <label className="block">
              <span className={label}>Full name</span>
              <input className={input} value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} required />
            </label>
            <label className="mt-4 block">
              <span className={label}>E-mail (also used for price alerts)</span>
              <input className={input} type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} required />
            </label>
            <div className="mt-5">
              <button className={button} disabled={busy === "profile"}>
                {busy === "profile" && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save
              </button>
            </div>
            <Notice state={msg.profile} />
          </form>

          <form onSubmit={savePassword} className={card}>
            <h2 className="mb-5 flex items-center gap-2 text-lg font-black text-white">
              <KeyRound className="h-5 w-5 text-brand-cyan" /> Change password
            </h2>
            <label className="block">
              <span className={label}>Current password</span>
              <input className={input} type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required />
            </label>
            <label className="mt-4 block">
              <span className={label}>New password (min. 8 characters)</span>
              <input className={input} type="password" autoComplete="new-password" minLength={8} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} required />
            </label>
            <label className="mt-4 block">
              <span className={label}>Repeat new password</span>
              <input className={input} type="password" autoComplete="new-password" minLength={8} value={pw.repeat} onChange={(e) => setPw({ ...pw, repeat: e.target.value })} required />
            </label>
            <div className="mt-5">
              <button className={button} disabled={busy === "password"}>
                {busy === "password" && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Change password
              </button>
            </div>
            <Notice state={msg.password} />
          </form>
        </section>

        <section className={card}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Bell className="mt-0.5 h-5 w-5 text-brand-cyan" />
              <div>
                <p className="text-sm font-semibold text-white">Price-drop e-mails</p>
                <p className="text-xs text-gray-500">
                  E-mail me when a tracked product drops below its target price. Requires the alert e-mail settings in the container.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={toggleNotify}
              className={`relative h-7 w-12 shrink-0 rounded-full transition ${notify ? "bg-brand-cyan" : "bg-gray-700"}`}
              aria-label="Toggle price-drop e-mails"
              aria-pressed={notify}
            >
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${notify ? "left-6" : "left-1"}`} />
            </button>
          </div>
          <Notice state={msg.notify} />
        </section>
      </div>
    </div>
  );
}
