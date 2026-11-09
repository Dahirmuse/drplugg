"use client";

import { useEffect, useState } from "react";

interface AdminUser {
  id: string;
  email: string;
  role: "student" | "admin";
  verified: boolean;
  displayName: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  cards: number;
  reviews: number;
  games: number;
  points: number;
}

interface MailStatus {
  configured: boolean;
  host: string | null;
  from: string | null;
  lastMailAt: string | null;
}

interface Totals {
  key: string;
  value: number;
}

const LABELS: Record<string, string> = {
  courses: "Kurser",
  chapters: "Kapitel",
  recall: "Återkallningsfrågor",
  cards: "Kapitelkort",
  documents: "Dokument",
};

export default function AdminPanel({ adminEmail }: { adminEmail: string }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [totals, setTotals] = useState<Totals[]>([]);
  const [mail, setMail] = useState<MailStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [oneTime, setOneTime] = useState<{ email: string; password: string } | null>(null);

  async function load() {
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Kunde inte hämta användare.");
      return;
    }
    setUsers(data.users ?? []);
    setTotals(data.totals ?? []);
    setMail(data.mail ?? null);
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleRole(user: AdminUser) {
    setBusyId(user.id);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          role: user.role === "admin" ? "student" : "admin",
        }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Kunde inte ändra rollen.");
      else await load();
    } finally {
      setBusyId(null);
    }
  }

  async function deleteUser(user: AdminUser) {
    setBusyId(user.id);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/users?id=${encodeURIComponent(user.id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Kunde inte ta bort användaren.");
      } else {
        setUsers((prev) => prev.filter((u) => u.id !== user.id));
        setNotice(`Användaren ${user.email} är borttagen.`);
      }
    } catch {
      setError("Nätverksfel när användaren skulle tas bort.");
    } finally {
      setBusyId(null);
      setConfirmId(null);
    }
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmail.trim()) return;
    setCreating(true);
    setError(null);
    setNotice(null);
    setOneTime(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Kunde inte skapa kontot.");
        return;
      }
      setNotice(`Kontot ${data.email} är skapat.`);
      if (data.password) setOneTime({ email: data.email, password: data.password });
      setNewEmail("");
      await load();
    } catch {
      setError("Nätverksfel när kontot skulle skapas.");
    } finally {
      setCreating(false);
    }
  }

  async function resetPassword(user: AdminUser) {
    setBusyId(user.id);
    setError(null);
    setNotice(null);
    setOneTime(null);
    try {
      const res = await fetch("/api/admin/users/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Kunde inte återställa lösenordet.");
        return;
      }
      setOneTime({ email: data.email, password: data.password });
      setNotice(`Nytt lösenord skapat för ${data.email}.`);
    } catch {
      setError("Nätverksfel vid återställning.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="font-display text-2xl font-bold tracking-tight text-plum-dark">Admin</h1>
        <p className="mt-1 text-sm text-grey">
          Inloggad som <strong className="text-plum-dark">{adminEmail}</strong> · roll: admin
        </p>
      </div>

      {error && (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-[--red]">
          {error}
        </p>
      )}
      {notice && (
        <p className="mb-4 rounded-xl bg-[--green-light] px-3 py-2 text-xs text-[--green-dark]">
          ✓ {notice}
        </p>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {totals.map((t) => (
          <div key={t.key} className="dp-card p-3 text-center">
            <p className="text-lg font-bold tabular-nums text-plum-dark">{t.value}</p>
            <p className="text-[9px] uppercase tracking-wider text-grey">{LABELS[t.key] ?? t.key}</p>
          </div>
        ))}
      </div>

      <div className="mb-5 dp-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-plum-dark">E-post (SMTP) – registrering</h2>
            <p className="mt-0.5 text-xs text-grey">
              {mail?.configured
                ? `Aktiv: ${mail.host} · avsändare ${mail.from}`
                : "Inte konfigurerat – verifieringskoder visas i demoläge på registreringsskärmen."}
            </p>
          </div>
          <span
            className={`dp-chip ${
              mail?.configured ? "bg-[--green-light] text-[--green-dark]" : "bg-[--orange-light] text-[--orange]"
            }`}
          >
            {mail?.configured ? "SMTP aktiv" : "Demoläge"}
          </span>
        </div>
        {!mail?.configured && (
          <p className="mt-2 rounded-xl bg-[--grey-light] px-3 py-2 text-2xs leading-relaxed text-plum-dark">
            Fyll i <code>config/smtp.json</code> (samma fält som Host, Port, EnableSSL, UserName,
            Password, FromAddress, FromName) och starta om servern – då skickas riktiga mejl.
          </p>
        )}
      </div>

      <div className="mb-5 dp-card p-4">
        <h2 className="text-sm font-bold text-plum-dark">Skapa konto</h2>
        <p className="mt-0.5 text-xs text-grey">
          Registreringen är stängd för allmänheten – konton skapas här. Lösenordet visas bara en gång.
        </p>
        <form onSubmit={createUser} className="mt-3 flex flex-wrap gap-2">
          <input
            type="email"
            required
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="fornamn.efternamn@stud.ki.se"
            className="min-w-[240px] flex-1 rounded-xl border border-[--grey-light] bg-white px-3 py-2 text-sm outline-none focus:border-plum"
          />
          <button type="submit" disabled={creating} className="dp-btn dp-btn-primary text-xs">
            {creating ? "Skapar…" : "Skapa konto"}
          </button>
        </form>

        {oneTime && (
          <div className="mt-3 rounded-xl border border-[--yellow] bg-[#FFF8EA] p-3">
            <p className="text-xs font-bold text-plum-dark">
              Engångslösen för {oneTime.email} – visas bara här
            </p>
            <p className="mt-1 select-all font-mono text-sm tracking-wide text-plum-dark">
              {oneTime.password}
            </p>
            <p className="mt-1 text-[11px] text-grey">
              Ge det till användaren nu. Det lagras bara som hash och kan inte visas igen.
            </p>
          </div>
        )}
      </div>

      <div className="dp-card overflow-hidden">
        <div className="border-b border-[--grey-light] px-4 py-3">
          <h2 className="text-sm font-bold text-plum-dark">Användare ({users.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[--grey-light] text-2xs uppercase tracking-wider text-grey">
              <tr>
                <th className="px-4 py-2 font-bold">E-post</th>
                <th className="px-4 py-2 font-bold">Roll</th>
                <th className="px-4 py-2 font-bold">Kort</th>
                <th className="px-4 py-2 font-bold">Reps</th>
                <th className="px-4 py-2 font-bold">Spel</th>
                <th className="px-4 py-2 font-bold">Poäng</th>
                <th className="px-4 py-2 font-bold">Senast inloggad</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[--grey-light]">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-[--grey-light]/50">
                  <td className="px-4 py-2 font-medium text-plum-dark">{u.email}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        u.role === "admin"
                          ? "bg-plum text-white"
                          : "bg-[--grey-light] text-grey"
                      }`}
                    >
                      {u.role}
                    </span>
                    {!u.verified && (
                      <span className="ml-1 rounded-full bg-[--orange-light] px-2 py-0.5 text-[10px] font-bold uppercase text-[--orange]">
                        ej verifierad
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 tabular-nums text-grey">{u.cards}</td>
                  <td className="px-4 py-2 tabular-nums text-grey">{u.reviews}</td>
                  <td className="px-4 py-2 tabular-nums text-grey">{u.games}</td>
                  <td className="px-4 py-2 tabular-nums text-grey">{u.points}</td>
                  <td className="px-4 py-2 text-grey">
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString("sv-SE") : "–"}
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    {confirmId === u.id ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="text-[10px] font-semibold text-[--red]">Säker?</span>
                        <button
                          onClick={() => deleteUser(u)}
                          disabled={busyId === u.id}
                          className="rounded-lg bg-[--red] px-2 py-1 text-[10px] font-semibold text-white disabled:opacity-50"
                        >
                          {busyId === u.id ? "Tar bort…" : "Ja, ta bort"}
                        </button>
                        <button
                          onClick={() => setConfirmId(null)}
                          className="rounded-lg border border-[--grey-light] px-2 py-1 text-[10px] font-semibold text-grey"
                        >
                          Avbryt
                        </button>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <button
                          onClick={() => toggleRole(u)}
                          disabled={busyId === u.id || u.email === adminEmail}
                          className="rounded-lg border border-[--grey-light] px-2 py-1 text-[10px] font-semibold text-grey transition-colors hover:border-plum hover:text-plum disabled:opacity-40"
                        >
                          {u.role === "admin" ? "Gör till student" : "Gör till admin"}
                        </button>
                        <button
                          onClick={() => resetPassword(u)}
                          disabled={busyId === u.id}
                          title="Sätt ett nytt engångslösenord"
                          className="rounded-lg border border-[--grey-light] px-2 py-1 text-[10px] font-semibold text-grey transition-colors hover:border-plum hover:text-plum disabled:opacity-40"
                        >
                          Lösenord
                        </button>
                        <button
                          onClick={() => {
                            setConfirmId(u.id);
                            setError(null);
                            setNotice(null);
                          }}
                          disabled={u.email === adminEmail}
                          title={u.email === adminEmail ? "Du kan inte ta bort ditt eget konto" : "Ta bort användaren"}
                          className="rounded-lg border border-[--grey-light] px-2 py-1 text-[10px] font-semibold text-[--red] transition-colors hover:border-[--red] hover:bg-red-50 disabled:opacity-40"
                        >
                          Ta bort
                        </button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-[--grey-light] bg-[--orange-light] p-4 text-xs leading-relaxed text-plum-dark">
        <strong>Så lägger du till funktioner senare:</strong> nya kapitel = en ny JSON-fil i{" "}
        <code>src/content/courses/</code> + <code>npm run db:seed</code>. Nya spel = en komponent i{" "}
        <code>src/components/games/</code> som hämtar frågor från{" "}
        <code>/api/games/questions</code> och postar till <code>/api/games/score</code>.
      </div>
    </div>
  );
}
