"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Message, { GradeCard, TypingDots } from "@/components/Message";
import type { ChatMode, GradeResult } from "@/lib/types";

interface SessionRow {
  id: string;
  title: string;
  mode: string;
  chapterId: string | null;
  messageCount: number;
}

interface UIMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

const MODES: { key: ChatMode; label: string; icon: string; hint: string }[] = [
  { key: "sokratisk", label: "Sokratisk", icon: "🧠", hint: "En ledtråd i taget – du tänker själv" },
  { key: "tentagen", label: "Tentagen", icon: "📝", hint: "Frågor med A–E och facit" },
  { key: "koncept", label: "Koncept", icon: "📖", hint: "Mekanistisk förklaring" },
  { key: "kliniskt", label: "Kliniskt fall", icon: "🏥", hint: "Du är jourhavande läkare" },
];

const STARTERS: Record<ChatMode, string[]> = {
  sokratisk: ["Förhör mig på kardiologi", "Jag vill förstå syra-bas", "Låt mig förklara njurarna"],
  tentagen: ["Ge mig 5 frågor om endokrinologi", "Tentafrågor på hematologi", "Blandade frågor från T5"],
  koncept: ["Skillnaden mellan STEMI och NSTEMI", "Varför blir man acidotisk vid diabetes?", "Hur fungerar loop-diuretika?"],
  kliniskt: ["Man 58 år med bröstsmärta", "Kvinna 24 år med buksmärta", "Barn 3 år med feber och utslag"],
};

export default function ChatClient({
  initialSessionId,
  initialMessages,
  initialMode,
  initialChapterId,
  initialGrade,
  chapters,
  apiKeyMissing,
}: {
  initialSessionId: string | null;
  initialMessages: UIMessage[];
  initialMode: ChatMode;
  initialChapterId: string | null;
  initialGrade: GradeResult | null;
  chapters: { id: string; title: string; course: string }[];
  apiKeyMissing: boolean;
}) {
  const router = useRouter();

  const [sessionId, setSessionId] = useState<string | null>(initialSessionId);
  const [messages, setMessages] = useState<UIMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<ChatMode>(initialMode);
  const [chapterId, setChapterId] = useState<string | null>(initialChapterId);
  const [streaming, setStreaming] = useState(false);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [grade, setGrade] = useState<GradeResult | null>(initialGrade);
  const [grading, setGrading] = useState(false);
  const [savedCard, setSavedCard] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const lastUserRef = useRef("");

  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/sessions");
      const data = await res.json();
      setSessions(data.sessions ?? []);
    } catch {
      /* ignorera */
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = useCallback(
    async (textRaw: string) => {
      const text = textRaw.trim();
      if (!text || streaming) return;

      lastUserRef.current = text;
      setInput("");
      setError(null);
      setGrade(null);
      setSavedCard(false);

      const aiId = crypto.randomUUID();
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "user", content: text },
        { id: aiId, role: "assistant", content: "", streaming: true },
      ]);
      setStreaming(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, message: text, mode, chapterId }),
        });

        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => ({}));
          setError(data.error || "Något gick fel. Försök igen.");
          setMessages((prev) => prev.filter((m) => m.id !== aiId));
          return;
        }

        const headerSession = res.headers.get("X-Session-Id");
        if (headerSession && headerSession !== sessionId) {
          setSessionId(headerSession);
          // Bara adressfältet uppdateras – en riktig navigering skulle montera om
          // chatten och kasta det svar som precis streamas in.
          window.history.replaceState(null, "", `/chatt/${headerSession}`);
          loadSessions();
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let full = "";

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const raw = line.slice(6).trim();
            if (raw === "[DONE]") continue;
            try {
              const json = JSON.parse(raw);
              const delta = json.choices?.[0]?.delta?.content;
              if (delta) {
                full += delta;
                setMessages((prev) =>
                  prev.map((m) => (m.id === aiId ? { ...m, content: full } : m)),
                );
              }
            } catch {
              /* delvis rad */
            }
          }
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiId
              ? { ...m, streaming: false, content: full || "Inget svar mottogs. Försök igen." }
              : m,
          ),
        );
        loadSessions();
      } catch {
        setError("Nätverksfel. Kontrollera anslutningen.");
        setMessages((prev) => prev.filter((m) => m.id !== aiId));
      } finally {
        setStreaming(false);
      }
    },
    [chapterId, loadSessions, mode, router, sessionId, streaming],
  );

  async function runGrade() {
    if (!sessionId || grading) return;
    setGrading(true);
    setError(null);
    try {
      const res = await fetch("/api/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Kunde inte bedöma.");
        return;
      }
      setGrade(data.grade);
    } catch {
      setError("Nätverksfel vid bedömning.");
    } finally {
      setGrading(false);
    }
  }

  async function saveToRepeat() {
    if (!grade) return;
    try {
      const res = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chapterId,
          front: chapterId
            ? `${chapters.find((c) => c.id === chapterId)?.title ?? "Kapitel"} – förklara med egna ord`
            : lastUserRef.current.slice(0, 120),
          back: grade.reference_answer || grade.verdict,
          rating: grade.rating,
          origin: "ai",
        }),
      });
      if (res.ok) setSavedCard(true);
    } catch {
      setError("Kunde inte spara kortet.");
    }
  }

  async function removeSession(id: string) {
    await fetch(`/api/chat/sessions?id=${id}`, { method: "DELETE" });
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (id === sessionId) {
      setSessionId(null);
      setMessages([]);
      setGrade(null);
      router.replace("/chatt");
    }
  }

  const activeMode = MODES.find((m) => m.key === mode)!;
  const activeChapter = chapters.find((c) => c.id === chapterId);

  const startNew = () => {
    setSessionId(null);
    setMessages([]);
    setGrade(null);
    setError(null);
    setSavedCard(false);
    router.replace("/chatt");
  };

  return (
    <div className="claude-shell flex h-full w-full">
      {/* ── Sidopanel ─────────────────────────────────────── */}
      <aside className="claude-sidebar hidden w-64 flex-shrink-0 flex-col border-r lg:flex">
        <div className="p-3">
          <button
            onClick={startNew}
            className="claude-chip flex w-full items-center justify-center gap-2 px-3 py-2 text-sm font-medium"
          >
            <span className="text-base leading-none">+</span> Ny chatt
          </button>
        </div>

        <div className="px-3 pb-3">
          <label
            className="text-2xs font-semibold uppercase tracking-[0.08em]"
            style={{ color: "var(--claude-muted)" }}
          >
            Kapitel
          </label>
          <select
            value={chapterId ?? ""}
            onChange={(e) => setChapterId(e.target.value || null)}
            className="claude-chip mt-1 w-full px-2.5 py-2 text-xs outline-none"
          >
            <option value="">Allmän medicin</option>
            {chapters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.course} · {c.title}
              </option>
            ))}
          </select>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          <p
            className="px-2 py-1 text-2xs font-semibold uppercase tracking-[0.08em]"
            style={{ color: "var(--claude-muted)" }}
          >
            Tidigare samtal
          </p>
          {sessions.length === 0 && (
            <p className="px-2 py-1 text-xs" style={{ color: "var(--claude-muted)" }}>
              Inga samtal ännu.
            </p>
          )}
          {sessions.map((s) => {
            const isActive = s.id === sessionId;
            return (
              <div
                key={s.id}
                className="group flex items-center gap-1 rounded-lg px-2 py-1.5"
                style={isActive ? { background: "var(--claude-user-bubble)" } : undefined}
              >
                <a
                  href={`/chatt/${s.id}`}
                  className="min-w-0 flex-1 truncate text-xs"
                  style={{ color: "var(--claude-ink)" }}
                  title={s.title}
                >
                  {s.title}
                </a>
                <button
                  onClick={() => removeSession(s.id)}
                  className="hidden flex-shrink-0 text-2xs transition-opacity group-hover:block"
                  style={{ color: "var(--claude-muted)" }}
                  aria-label="Ta bort samtal"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>

        <p className="px-3 pb-3 text-[11px] leading-relaxed" style={{ color: "var(--claude-muted)" }}>
          Karolina är DrPluggs AI-coach för läkarprogrammet.
        </p>
      </aside>

      {/* ── Chatt ─────────────────────────────────────────── */}
      <div className="claude-thread flex min-w-0 flex-1 flex-col">
        <div
          className="flex flex-shrink-0 items-center justify-between gap-2 border-b px-4 py-2"
          style={{ borderColor: "var(--claude-border)" }}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="claude-avatar flex h-8 w-8 items-center justify-center rounded-full text-xs">
              K
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight" style={{ color: "var(--claude-ink)" }}>
                Karolina
              </p>
              <p className="truncate text-2xs" style={{ color: "var(--claude-muted)" }}>
                {activeChapter
                  ? `${activeChapter.course} · ${activeChapter.title}`
                  : `${activeMode.icon} ${activeMode.label} · ${activeMode.hint}`}
              </p>
            </div>
          </div>

          <div className="flex flex-shrink-0 items-center gap-1.5">
            {!apiKeyMissing && sessionId && messages.length > 1 && (
              <button
                onClick={runGrade}
                disabled={grading}
                className="claude-pill px-2.5 py-1.5 text-xs"
                title="Låt examinatorn bedöma din förklaring"
              >
                {grading ? "Bedömer…" : "🎓 Betygsätt"}
              </button>
            )}
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as ChatMode)}
              className="claude-pill px-2.5 py-1.5 text-xs outline-none"
            >
              {MODES.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.icon} {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {apiKeyMissing && (
          <div
            className="px-4 py-2 text-xs"
            style={{ borderBottom: "1px solid var(--claude-border)", color: "var(--claude-accent)" }}
          >
            DeepSeek-nyckeln saknas i <code>.env.local</code> – chatten fungerar inte förrän den
            lagts till.
          </div>
        )}

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
          <div className="mx-auto max-w-3xl space-y-6">
            {messages.length === 0 && (
              <div className="pt-10 text-center sm:pt-16">
                <div className="claude-avatar mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl text-lg">
                  K
                </div>
                <h2
                  className="font-display text-3xl font-semibold tracking-tight"
                  style={{ color: "var(--claude-ink)" }}
                >
                  Hej, jag är Karolina.
                </h2>
                <p
                  className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed"
                  style={{ color: "var(--claude-muted)" }}
                >
                  {activeMode.hint}. Jag grundar svaren i ditt kapitel och i uppladdat material –
                  och i sokratiskt läge får du tänka själv först.
                </p>

                <div className="mx-auto mt-7 grid max-w-xl gap-2 sm:grid-cols-2">
                  {STARTERS[mode].map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="claude-chip px-4 py-3 text-left text-[13px] leading-snug"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => (
              <Message
                key={m.id}
                role={m.role}
                content={m.content}
                streaming={m.streaming}
                onAnswer={(text) => send(text)}
              />
            ))}

            {grade && (
              <div className="space-y-2 pl-10">
                <GradeCard grade={grade} />
                <button
                  onClick={saveToRepeat}
                  disabled={savedCard}
                  className="claude-send w-full px-4 py-2.5 text-xs font-semibold"
                >
                  {savedCard ? "✓ Kortet ligger i repetitionen" : "🔁 Lägg bedömningen i repetitionen"}
                </button>
              </div>
            )}

            {error && (
              <p
                className="rounded-xl px-3 py-2 text-xs"
                style={{ border: "1px solid var(--claude-border)", color: "var(--claude-accent)" }}
              >
                {error}
              </p>
            )}
          </div>
        </div>

        <div className="flex-shrink-0 px-4 pb-4 pt-1">
          <div className="mx-auto max-w-3xl">
            <div className="claude-composer px-3 pb-2 pt-2.5">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                rows={1}
                placeholder={`Skriv till Karolina…`}
                className="max-h-40 min-h-[24px] w-full resize-none bg-transparent px-1 py-1 text-[15px] leading-relaxed outline-none"
                style={{ color: "var(--claude-ink)" }}
              />
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="truncate pl-1 text-[11px]" style={{ color: "var(--claude-muted)" }}>
                  {activeChapter
                    ? `${activeChapter.course} · ${activeChapter.title}`
                    : "Allmän medicin · Enter skickar, Shift+Enter ny rad"}
                </span>
                <button
                  onClick={() => send(input)}
                  disabled={streaming || !input.trim()}
                  aria-label="Skicka"
                  className="claude-send flex h-8 w-8 flex-shrink-0 items-center justify-center text-sm font-bold"
                >
                  {streaming ? "…" : "↑"}
                </button>
              </div>
            </div>
            <p
              className="mt-2 text-center text-[11px] leading-relaxed"
              style={{ color: "var(--claude-muted)" }}
            >
              Karolina är en AI-coach och kan göra fel – kontrollera medicinska fakta.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
