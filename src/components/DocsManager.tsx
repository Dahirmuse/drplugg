"use client";

import { useEffect, useState } from "react";

interface Doc {
  id: string;
  name: string;
  kind: string | null;
  chars: number;
  addedAt: string;
  chunks: number;
}

export default function DocsManager({
  chapters,
}: {
  chapters: { id: string; title: string; course: string }[];
}) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [chapterId, setChapterId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [pasted, setPasted] = useState("");
  const [showPaste, setShowPaste] = useState(false);

  async function load() {
    const res = await fetch("/api/docs");
    const data = await res.json();
    setDocs(data.docs ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function upload(form: FormData) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/docs", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ kind: "err", text: data.error || "Uppladdningen misslyckades." });
        return;
      }
      setMessage({
        kind: "ok",
        text: `✓ ${data.chars.toLocaleString("sv-SE")} tecken uppdelade i ${data.chunks} avsnitt.`,
      });
      setPasted("");
      setShowPaste(false);
      await load();
    } catch {
      setMessage({ kind: "err", text: "Nätverksfel vid uppladdning." });
    } finally {
      setBusy(false);
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    if (chapterId) form.append("chapterId", chapterId);
    await upload(form);
    e.target.value = "";
  }

  async function handlePaste() {
    if (pasted.trim().length < 40) {
      setMessage({ kind: "err", text: "Klistra in minst 40 tecken." });
      return;
    }
    const form = new FormData();
    form.append("text", pasted);
    form.append("name", `Inklistrat material ${new Date().toLocaleDateString("sv-SE")}`);
    if (chapterId) form.append("chapterId", chapterId);
    await upload(form);
  }

  async function remove(id: string) {
    await fetch(`/api/docs?id=${id}`, { method: "DELETE" });
    setDocs((prev) => prev.filter((d) => d.id !== id));
  }

  return (
    <div className="space-y-5">
      <div className="dp-card p-5">
        <h2 className="text-sm font-bold text-plum-dark">Ladda upp källmaterial</h2>
        <p className="mt-1 text-xs leading-relaxed text-grey">
          PDF, TXT eller MD. AI:n grundar då sina svar i <em>ditt</em> material och hänvisar till
          avsnitten. Större filer tar en stund att bearbeta.
        </p>

        <div className="mt-3">
          <label className="text-2xs font-bold uppercase tracking-wider text-grey">
            Koppla till kapitel (valfritt)
          </label>
          <select
            value={chapterId}
            onChange={(e) => setChapterId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-[--grey-light] bg-white px-3 py-2 text-sm outline-none focus:border-plum"
          >
            <option value="">Allt material (ingen koppling)</option>
            {chapters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.course} · {c.title}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <label className="dp-btn dp-btn-primary cursor-pointer">
            {busy ? "Bearbetar…" : "📄 Välj fil"}
            <input
              type="file"
              accept=".pdf,.txt,.md"
              onChange={handleFile}
              disabled={busy}
              className="hidden"
            />
          </label>
          <button onClick={() => setShowPaste(!showPaste)} className="dp-btn dp-btn-ghost">
            ✍️ Klistra in text
          </button>
        </div>

        {showPaste && (
          <div className="mt-3 animate-fade-in-up">
            <textarea
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              rows={8}
              placeholder="Klistra in föreläsningsanteckningar eller en sammanfattning…"
              className="w-full rounded-xl border border-[--grey-light] p-3 text-sm outline-none focus:border-plum"
            />
            <button onClick={handlePaste} disabled={busy} className="dp-btn dp-btn-primary mt-2">
              Spara material
            </button>
          </div>
        )}

        {message && (
          <p
            className={`mt-3 rounded-xl px-3 py-2 text-xs ${
              message.kind === "ok"
                ? "bg-[--green-light] text-[--green-dark]"
                : "bg-red-50 text-[--red]"
            }`}
          >
            {message.text}
          </p>
        )}
      </div>

      <div className="dp-card p-5">
        <h2 className="text-sm font-bold text-plum-dark">Ditt material ({docs.length})</h2>
        {docs.length === 0 ? (
          <p className="mt-2 text-xs text-grey">Inget uppladdat ännu.</p>
        ) : (
          <ul className="mt-3 divide-y divide-[--grey-light]">
            {docs.map((d) => (
              <li key={d.id} className="flex items-center gap-3 py-2.5">
                <span className="text-lg">📄</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-plum-dark">{d.name}</span>
                  <span className="text-2xs text-grey">
                    {d.kind ?? "text"} · {d.chars.toLocaleString("sv-SE")} tecken · {d.chunks} avsnitt
                  </span>
                </span>
                <button
                  onClick={() => remove(d.id)}
                  className="text-2xs text-grey transition-colors hover:text-[--red]"
                >
                  Ta bort
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
