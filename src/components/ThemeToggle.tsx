"use client";

import { useEffect, useState } from "react";

const COOKIE = "drplugg_theme";

function readTheme(): "dark" | "light" {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export default function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<"dark" | "light">("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTheme(readTheme());
    setMounted(true);
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem(COOKIE, next);
      document.cookie = `${COOKIE}=${next};path=/;max-age=31536000;samesite=lax`;
    } catch {
      /* ignorera */
    }
  }

  const dark = theme === "dark";

  return (
    <button
      onClick={toggle}
      aria-label={dark ? "Byt till ljust läge" : "Byt till mörkt läge"}
      title={dark ? "Ljust läge" : "Mörkt läge"}
      className={`flex h-8 w-8 items-center justify-center rounded-lg border border-[--grey-light] text-sm transition-colors hover:border-plum hover:text-plum ${className}`}
    >
      <span aria-hidden="true">{mounted ? (dark ? "☀️" : "🌙") : "🌙"}</span>
    </button>
  );
}
