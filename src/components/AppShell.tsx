"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";

export interface ShellUser {
  email: string;
  role: "student" | "admin";
  displayName: string | null;
}

const NAV = [
  { href: "/hem", label: "Hem", icon: "🏠" },
  { href: "/kurs", label: "Kurs", icon: "📚" },
  { href: "/chatt", label: "Karolina", icon: "💬" },
  { href: "/repetition", label: "Repetition", icon: "🔁" },
  { href: "/spel", label: "Spel", icon: "🎮" },
  { href: "/framsteg", label: "Framsteg", icon: "📈" },
  { href: "/kallor", label: "Källor", icon: "📄" },
];

export default function AppShell({
  user,
  streak,
  dueNow,
  children,
}: {
  user: ShellUser;
  streak: number;
  dueNow: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  const isChat = pathname.startsWith("/chatt");
  const initials = (user.displayName || user.email).slice(0, 1).toUpperCase();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const navItems = user.role === "admin" ? [...NAV, { href: "/admin", label: "Admin", icon: "🛠️" }] : NAV;

  return (
    <div className={`${isChat ? "h-screen overflow-hidden" : "min-h-screen"} flex flex-col bg-white`}>
      <header className="sticky top-0 z-30 flex-shrink-0 border-b border-[--grey-light] bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/hem" className="flex items-center gap-2 font-bold tracking-tight text-plum-dark">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-plum-dark text-xs font-bold text-white">
              D
            </span>
            <span className="text-lg">DrPlugg</span>
            <span className="hidden rounded-full bg-plum-light px-1.5 py-0.5 text-2xs font-bold text-plum-dark sm:inline">
              1.0
            </span>
          </Link>

          <nav className="hidden items-center gap-0.5 md:flex">
            {navItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative rounded-xl px-2.5 py-1.5 text-[13px] font-medium transition-colors ${
                    active ? "bg-plum-light text-plum-dark" : "text-grey hover:bg-[--grey-light] hover:text-plum-dark"
                  }`}
                >
                  <span className="mr-1">{item.icon}</span>
                  {item.label}
                  {item.href === "/repetition" && dueNow > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[--orange] px-1 text-[9px] font-bold text-white">
                      {dueNow > 99 ? "99+" : dueNow}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <span
              title={`Streak: ${streak} dagar`}
              className="hidden items-center gap-1 rounded-full bg-[--orange-light] px-2.5 py-1 text-xs font-bold text-[--orange] sm:flex"
            >
              🔥 {streak}
            </span>
            <Link
              href="/framsteg"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-plum text-xs font-bold text-white"
              title={user.email}
            >
              {initials}
            </Link>
            <button
              onClick={logout}
              className="hidden rounded-xl border border-[--grey-light] px-2.5 py-1.5 text-xs font-medium text-grey transition-colors hover:border-plum hover:text-plum sm:block"
            >
              Logga ut
            </button>
            <button
              onClick={() => setOpen(!open)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[--grey-light] md:hidden"
              aria-label="Meny"
            >
              ☰
            </button>
          </div>
        </div>

        {open && (
          <nav className="animate-fade-in-up border-t border-[--grey-light] bg-white px-4 py-2 md:hidden">
            {navItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block rounded-xl px-3 py-2.5 text-sm font-medium ${
                    active ? "bg-plum-light text-plum-dark" : "text-grey"
                  }`}
                >
                  <span className="mr-2">{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
            <button
              onClick={logout}
              className="mt-1 block w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-[--red]"
            >
              🚪 Logga ut
            </button>
          </nav>
        )}
      </header>

      <main className={isChat ? "flex min-h-0 flex-1" : "flex-1"}>{children}</main>
    </div>
  );
}
