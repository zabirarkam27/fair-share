"use client";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { ArrowUpRight, ArrowRight, Check, Layers } from "lucide-react";
export default function Login() {
  const [signup, setSignup] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(e.currentTarget);
    try {
      const result = signup
        ? await authClient.signUp.email({
            name: String(data.get("name")),
            email: String(data.get("email")),
            password: String(data.get("password")),
          })
        : await authClient.signIn.email({
            email: String(data.get("email")),
            password: String(data.get("password")),
          });
      if (result.error)
        throw new Error(result.error.message ?? "Could not sign in.");
      const next = new URLSearchParams(window.location.search).get("next");
      window.location.href =
        next?.startsWith("/") && !next.startsWith("//") ? next : "/";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
      setBusy(false);
    }
  }
  return (
    <main className="login">
      <section className="login-story">
        <a className="brand" href="/">
          <span className="brand-icon">
            <Layers size={24} />
          </span>
          fairshare<span className="brand-dot">.</span>
        </a>
        <div>
          <span className="eyebrow light">GOOD COMPANY. CLEAR BALANCES.</span>
          <h1>
            Share the moment.
            <br />
            <em>Split the rest.</em>
          </h1>
          <p>
            From your everyday groceries to that long-awaited trip. Keep money
            simple, and friendships easy.
          </p>
          <div className="login-proof">
            <span>
              <Check size={16} /> Every poisha accounted for
            </span>
            <span>
              <Check size={16} /> A history everyone can follow
            </span>
          </div>
        </div>
        <span className="story-footer">
          A little clearer, together. <ArrowUpRight size={18} />
        </span>
      </section>
      <section className="login-form">
        <div className="auth-card">
          <span className="eyebrow">WELCOME TO FAIRSHARE</span>
          <h2>
            {signup ? "Your next shared chapter." : "Good to have you back."}
          </h2>
          <p className="muted">
            {signup
              ? "Create an account and start sharing fairly."
              : "Sign in to pick up where you left off."}
          </p>
          <form onSubmit={submit}>
            {signup && (
              <label>
                Your name
                <input
                  name="name"
                  required
                  maxLength={80}
                  autoComplete="name"
                  placeholder="e.g. Rafi Ahmed"
                />
              </label>
            )}
            <label>
              Email address
              <input
                type="email"
                name="email"
                required
                maxLength={254}
                autoComplete="email"
                placeholder="you@example.com"
              />
            </label>
            <label>
              Password
              <input
                type="password"
                name="password"
                required
                minLength={10}
                maxLength={128}
                autoComplete={signup ? "new-password" : "current-password"}
                placeholder="At least 10 characters"
              />
            </label>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button className="primary wide" disabled={busy}>
              {busy ? "Just a moment…" : signup ? "Create account" : "Sign in"}
              <ArrowRight size={18} />
            </button>
          </form>
          <p className="auth-switch">
            {signup ? "Already sharing?" : "New around here?"}{" "}
            <button
              className="text-button"
              onClick={() => {
                setSignup(!signup);
                setError("");
              }}
            >
              {signup ? "Sign in" : "Create an account"}
            </button>
          </p>
          <div className="demo-note">
            <strong>Explore the seeded demo</strong>
            <span>rafi@fairshare.demo · FairShareDemo!2026</span>
            <button
              className="text-button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const result = await authClient.signIn.email({
                  email: "rafi@fairshare.demo",
                  password: "FairShareDemo!2026",
                });
                if (result.error) {
                  setError(
                    result.error.message ?? "Run the database seed first.",
                  );
                  setBusy(false);
                } else window.location.href = "/";
              }}
            >
              Use demo account <ArrowUpRight size={14} />
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
