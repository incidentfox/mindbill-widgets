"use client";
import { useState, type FormEvent } from "react";
import { jsonRequest } from "../api-client";

export function Login({ onSignedIn }: { onSignedIn(): void }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function login(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      await jsonRequest("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      setPassword(""); onSignedIn();
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }
  return <section className="login-panel">
    <p className="eyebrow">SANDBOX CONNECTION</p><h1>Open your workspace</h1>
    <p>Enter the administrator password configured in your starter’s environment file.</p>
    {error && <p role="alert" className="error-message">{error}</p>}
    <form onSubmit={login}><label htmlFor="password">Starter password</label>
      <input id="password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required />
      <button className="primary-button" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
    </form>
  </section>;
}
