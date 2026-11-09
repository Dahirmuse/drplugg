"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";

const HIGHLIGHTS = [
  { icon: "🧠", title: "Sokratisk AI-coach", text: "AI:n ger aldrig svaret direkt – du tänker själv." },
  { icon: "🔁", title: "FSRS-repetition", text: "Korten kommer tillbaka precis innan du glömmer dem." },
  { icon: "▶️", title: "Ninja Nerd-videor", text: "Varje kapitel matchas mot riktiga Ninja Nerd-lektioner." },
  { icon: "🎮", title: "Spel & dagens utmaning", text: "Blixtquiz, termmatch och diagnosduellen." },
];

type Step = "login" | "register" | "verify" | "forgot" | "reset";

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const nextPath = params.get("next") || "/hem";

  const [step, setStep] = useState<Step>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [delivered, setDelivered] = useState<boolean | null>(null);
  const [smtpConfigured, setSmtpConfigured] = useState<boolean | null>(null);
  const [registrationOpen, setRegistrationOpen] = useState(true);

  useEffect(() => {
    fetch("/api/auth/config")
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.registrationOpen === "boolean") setRegistrationOpen(d.registrationOpen);
      })
      .catch(() => {});
  }, []);
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  function go(target: Step) {
    setStep(target);
    setError(null);
    setInfo(null);
    if (target !== "verify") setDemoCode(null);
  }

  async function finishLogin() {
    router.push(nextPath);
    router.refresh();
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 403 && data.needsVerification) {
        setStep("verify");
        setInfo("Kontot väntar på verifiering. Ange koden från mejlet – eller begär en ny.");
        await requestCode();
        return;
      }
      if (!res.ok) {
        setError(data.error || "Något gick fel.");
        return;
      }
      await finishLogin();
    } catch {
      setError("Nätverksfel. Försök igen.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Något gick fel.");
        return;
      }

      // Admin-kontot verifieras automatiskt – logga in direkt.
      if (!data.verificationRequired) {
        const login = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        if (login.ok) {
          await finishLogin();
          return;
        }
        setStep("login");
        setInfo("Kontot är aktiverat – logga in.");
        return;
      }

      setStep("verify");
      setDelivered(Boolean(data.delivered));
      setSmtpConfigured(Boolean(data.smtpConfigured));
      setDemoCode(data.demoCode ?? null);
      setInfo(data.message ?? "Vi har skickat en verifieringskod till din e-post.");
    } catch {
      setError("Nätverksfel. Försök igen.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Kunde inte verifiera koden.");
        return;
      }
      await finishLogin();
    } catch {
      setError("Nätverksfel. Försök igen.");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Kunde inte skicka koden.");
        return;
      }
      setDelivered(Boolean(data.delivered));
      setSmtpConfigured(Boolean(data.smtpConfigured));
      setDemoCode(data.demoCode ?? null);
      setStep("reset");
      setInfo(data.message ?? "Kolla din e-post för koden.");
    } catch {
      setError("Nätverksfel. Försök igen.");
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirm) {
      setError("Lösenorden matchar inte.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, password: newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Kunde inte återställa lösenordet.");
        return;
      }
      await finishLogin();
    } catch {
      setError("Nätverksfel. Försök igen.");
    } finally {
      setLoading(false);
    }
  }

  async function requestCode() {    setError(null);
    try {
      const res = await fetch("/api/auth/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Kunde inte skicka ny kod.");
        return;
      }
      setDelivered(Boolean(data.delivered));
      setSmtpConfigured(Boolean(data.smtpConfigured));
      setDemoCode(data.demoCode ?? null);
      setInfo(data.message ?? "En ny kod har skickats.");
    } catch {
      setError("Nätverksfel. Försök igen.");
    }
  }

  const title =
    step === "verify"
      ? "Verifiera din e-post"
      : step === "register"
        ? "Skapa konto"
        : step === "forgot"
          ? "Glömt lösenordet?"
          : step === "reset"
            ? "Nytt lösenord"
            : "Logga in";

  const subtitle =
    step === "verify"
      ? `Vi skickade en 6-siffrig kod till ${email}.`
      : step === "register"
        ? "Vi skickar en verifieringskod till din e-post innan kontot aktiveras."
        : step === "forgot"
          ? "Ange din e-post – vi skickar en kod för att återställa lösenordet."
          : step === "reset"
            ? `Ange koden som skickades till ${email} och välj ett nytt lösenord.`
            : "Fortsätt där du slutade.";

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Vänster: varumärke */}
      <div className="hidden lg:flex flex-col justify-between bg-plum-dark text-white p-12 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            background:
              "radial-gradient(circle at 20% 10%, #FF876F 0%, transparent 45%), radial-gradient(circle at 80% 80%, #4DB5BC 0%, transparent 45%)",
          }}
        />
        <div className="relative">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-xl font-bold">
              D
            </span>
            <div>
              <p className="text-xl font-bold tracking-tight">DrPlugg</p>
              <p className="text-xs text-white/60">1.0 · läkarprogrammet</p>
            </div>
          </div>

          <h1 className="mt-16 text-4xl font-display font-bold leading-tight max-w-md">
            Plugga så att det fastnar.
          </h1>
          <p className="mt-4 text-white/70 max-w-md leading-relaxed">
            Sokratisk AI-chatt, aktiv återkallning, FSRS-repetition och Ninja Nerd-videor –
            samlade i ett enda flöde från Basvetenskap 1 till Klinisk medicin 7.
          </p>

          <div className="mt-10 grid grid-cols-2 gap-3 max-w-md">
            {HIGHLIGHTS.map((h) => (
              <div key={h.title} className="rounded-2xl bg-white/5 border border-white/10 p-3.5">
                <p className="text-lg">{h.icon}</p>
                <p className="mt-1 text-sm font-semibold">{h.title}</p>
                <p className="text-2xs text-white/60 leading-snug mt-0.5">{h.text}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-2xs text-white/40">
          Byggt för läkarprogrammet vid Karolinska Institutet · lärande genom aktiv återkallning
        </p>
      </div>

      {/* Höger: form */}
      <div className="flex items-center justify-center p-6 bg-[#FBF7F9] relative">
        <div className="absolute right-5 top-5">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-sm animate-fade-in-up">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <span className="w-10 h-10 rounded-xl bg-plum-dark text-white flex items-center justify-center font-bold">
              D
            </span>
            <span className="text-lg font-bold text-plum-dark">DrPlugg</span>
          </div>

          <h2 className="text-2xl font-display font-bold text-plum-dark">{title}</h2>
          <p className="text-sm text-grey mt-1 mb-6">{subtitle}</p>

          {step === "forgot" || step === "reset" ? (
            step === "forgot" ? (
              <form onSubmit={handleForgot} className="space-y-4">
                <div>
                  <label
                    htmlFor="forgot-email"
                    className="block text-2xs font-bold text-grey uppercase tracking-wider mb-1.5"
                  >
                    E-post
                  </label>
                  <input
                    id="forgot-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="fornamn.efternamn@stud.ki.se"
                    className="w-full rounded-xl border border-[--grey-light] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-plum transition-colors"
                  />
                </div>
                {error && (
                  <p className="text-sm text-[--red] bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                    {error}
                  </p>
                )}
                <button type="submit" disabled={loading} className="dp-btn dp-btn-primary w-full py-3 text-sm">
                  {loading ? "Skickar…" : "Skicka kod"}
                </button>
                <button
                  type="button"
                  onClick={() => go("login")}
                  className="w-full text-center text-xs text-grey hover:text-plum"
                >
                  Tillbaka till inloggning
                </button>
              </form>
            ) : (
              <form onSubmit={handleReset} className="space-y-4">
                <div>
                  <label
                    htmlFor="reset-code"
                    className="block text-2xs font-bold text-grey uppercase tracking-wider mb-1.5"
                  >
                    Kod från mejlet
                  </label>
                  <input
                    id="reset-code"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="123456"
                    className="w-full rounded-xl border border-[--grey-light] bg-white px-3.5 py-3 text-center text-2xl font-bold tracking-[0.4em] text-plum-dark outline-none focus:border-plum transition-colors"
                  />
                </div>
                <div>
                  <label
                    htmlFor="new-password"
                    className="block text-2xs font-bold text-grey uppercase tracking-wider mb-1.5"
                  >
                    Nytt lösenord
                  </label>
                  <input
                    id="new-password"
                    type="password"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minst 6 tecken"
                    className="w-full rounded-xl border border-[--grey-light] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-plum transition-colors"
                  />
                </div>
                <div>
                  <label
                    htmlFor="confirm-password"
                    className="block text-2xs font-bold text-grey uppercase tracking-wider mb-1.5"
                  >
                    Upprepa lösenordet
                  </label>
                  <input
                    id="confirm-password"
                    type="password"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="w-full rounded-xl border border-[--grey-light] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-plum transition-colors"
                  />
                </div>

                {demoCode && (
                  <div className="rounded-xl border border-[--yellow] bg-[#FFF8EA] px-3 py-2.5 text-xs text-[#8a5a00]">
                    <p className="font-bold">Demoläge – SMTP är inte konfigurerat</p>
                    <p className="mt-1">
                      Din kod är{" "}
                      <strong className="tracking-widest text-plum-dark">{demoCode}</strong>
                    </p>
                  </div>
                )}

                {error && (
                  <p className="text-sm text-[--red] bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                    {error}
                  </p>
                )}
                {info && !error && (
                  <p className="text-sm text-[--green-dark] bg-[--green-light] border border-[--green] rounded-xl px-3 py-2">
                    {info}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading || code.length < 6}
                  className="dp-btn dp-btn-primary w-full py-3 text-sm"
                >
                  {loading ? "Sparar…" : "Spara nytt lösenord"}
                </button>
                <button
                  type="button"
                  onClick={() => go("login")}
                  className="w-full text-center text-xs text-grey hover:text-plum"
                >
                  Tillbaka till inloggning
                </button>
              </form>
            )
          ) : step === "verify" ? (
            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <label
                  htmlFor="code"
                  className="block text-2xs font-bold text-grey uppercase tracking-wider mb-1.5"
                >
                  Verifieringskod
                </label>
                <input
                  id="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                  className="w-full rounded-xl border border-[--grey-light] bg-white px-3.5 py-3 text-center text-2xl font-bold tracking-[0.4em] text-plum-dark outline-none focus:border-plum transition-colors"
                />
              </div>

              {demoCode && (
                <div className="rounded-xl border border-[--yellow] bg-[#FFF8EA] px-3 py-2.5 text-xs text-[#8a5a00]">
                  <p className="font-bold">Demoläge – SMTP är inte konfigurerat</p>
                  <p className="mt-1">
                    Mejlet skickades inte. Din kod är{" "}
                    <strong className="tracking-widest text-plum-dark">{demoCode}</strong>
                  </p>
                  <p className="mt-1 text-[11px] opacity-80">
                    Lägg in dina uppgifter i <code>config/smtp.json</code> för riktiga mejl.
                  </p>
                </div>
              )}

              {error && (
                <p className="text-sm text-[--red] bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                  {error}
                </p>
              )}
              {info && !error && (
                <p className="text-sm text-[--green-dark] bg-[--green-light] border border-[--green] rounded-xl px-3 py-2">
                  {info}
                </p>
              )}

              <button type="submit" disabled={loading || code.length < 6} className="dp-btn dp-btn-primary w-full py-3 text-sm">
                {loading ? "Verifierar…" : "Verifiera och logga in"}
              </button>

              <div className="flex items-center justify-between text-xs text-grey">
                <button type="button" onClick={requestCode} className="hover:text-plum">
                  Skicka ny kod
                </button>
                <button type="button" onClick={() => go("login")} className="hover:text-plum">
                  Tillbaka till inloggning
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={step === "register" ? handleRegister : handleLogin} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-2xs font-bold text-grey uppercase tracking-wider mb-1.5"
                >
                  E-post
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="fornamn.efternamn@stud.ki.se"
                  className="w-full rounded-xl border border-[--grey-light] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-plum transition-colors"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-2xs font-bold text-grey uppercase tracking-wider mb-1.5"
                >
                  Lösenord
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete={step === "register" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minst 6 tecken"
                  className="w-full rounded-xl border border-[--grey-light] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-plum transition-colors"
                />
              </div>

              {error && (
                <p className="text-sm text-[--red] bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                  {error}
                </p>
              )}
              {info && !error && (
                <p className="text-sm text-[--green-dark] bg-[--green-light] border border-[--green] rounded-xl px-3 py-2">
                  {info}
                </p>
              )}

              <button type="submit" disabled={loading} className="dp-btn dp-btn-primary w-full py-3 text-sm">
                {loading ? "Arbetar…" : step === "register" ? "Skapa konto" : "Logga in"}
              </button>
            </form>
          )}

          {step !== "verify" && registrationOpen && (
            <button
              onClick={() => go(step === "register" ? "login" : "register")}
              className="mt-5 w-full text-center text-sm text-grey hover:text-plum transition-colors"
            >
              {step === "register" ? "Har du redan konto? Logga in" : "Ny här? Skapa konto"}
            </button>
          )}

          {step === "login" && (
            <button
              onClick={() => go("forgot")}
              className="mt-2 w-full text-center text-xs text-grey hover:text-plum transition-colors"
            >
              Glömt lösenordet?
            </button>
          )}

          {step === "register" && (
            <p className="mt-4 text-center text-2xs leading-relaxed text-grey">
              Registreringen kräver en verifieringskod via e-post.
              {smtpConfigured === false && " SMTP är inte konfigurerat ännu – koden visas då direkt i appen."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
