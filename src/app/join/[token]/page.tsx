"use client";
import { use, useState } from "react";
import { api } from "@/lib/api-client";
import { Layers, ArrowRight } from "lucide-react";
export default function Join({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <main className="join-page">
      <div className="join-card">
        <span className="brand-icon">
          <Layers />
        </span>
        <h1>Good things are shared.</h1>
        <p>
          You’ve been invited to a FairShare group. Join to see its expenses and
          share your part.
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button
          className="primary wide"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const result = await api<{ id: string }>("/join", "POST", {
                token,
              });
              window.location.href = "/groups/" + result.id;
            } catch (e) {
              const message = e instanceof Error ? e.message : "";
              if (message.includes("sign in"))
                window.location.href =
                  "/login?next=" + encodeURIComponent("/join/" + token);
              else {
                setError(message);
                setBusy(false);
              }
            }
          }}
        >
          {" "}
          {busy ? "Joining…" : "Accept invitation"}
          <ArrowRight size={18} />
        </button>
        <a href="/">Back to FairShare</a>
      </div>
    </main>
  );
}
