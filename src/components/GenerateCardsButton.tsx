"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function GenerateCardsButton({
  chapterId,
  label = "Generera fler kort",
}: {
  chapterId: string;
  label?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/cards/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapterId, count: 10 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Kunde inte generera kort.");
        return;
      }
      setMessage(data.message ?? null);
      router.refresh();
    } catch {
      setError("Nätverksfel när korten skulle genereras.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-3">
      <button onClick={run} disabled={busy} className="dp-btn dp-btn-ghost w-full text-xs">
        {busy ? "Karolina skriver nya kort…" : `✨ ${label}`}
      </button>
      {message && <p className="mt-2 text-2xs text-[--green-dark]">✓ {message}</p>}
      {error && <p className="mt-2 text-2xs text-[--red]">{error}</p>}
    </div>
  );
}
