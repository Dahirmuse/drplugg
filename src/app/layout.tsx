import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Inter, Lora } from "next/font/google";
import { publicOrigin } from "@/lib/origin";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const lora = Lora({ subsets: ["latin"], variable: "--font-lora", display: "swap" });

// metadataBase styr alla absoluta URL:er Next genererar (og:url, og:image,
// canonical). Utan den används den interna adressen (localhost:3311) – därför
// sätts den från PUBLIC_URL, och hoppas över helt när den inte finns.
const ORIGIN = publicOrigin();

export const metadata: Metadata = {
  title: "DrPlugg — aktiv inlärning för läkarprogrammet",
  description:
    "Sokratisk AI-coach, aktiv återkallning, FSRS-repetition och Ninja Nerd-videor för läkarprogrammet (KI).",
  ...(ORIGIN ? { metadataBase: new URL(ORIGIN) } : {}),
};

const THEME_SCRIPT = `(function(){try{
  var m=document.cookie.match(/(?:^|; )drplugg_theme=(dark|light)/);
  var t=m?m[1]:localStorage.getItem('drplugg_theme');
  if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}
  document.documentElement.classList.toggle('dark', t==='dark');
}catch(e){}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = (await cookies()).get("drplugg_theme")?.value;
  const isDark = theme === "dark";

  return (
    <html
      lang="sv"
      className={`${inter.variable} ${lora.variable} ${isDark ? "dark" : ""}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-white text-plum-dark antialiased">{children}</body>
    </html>
  );
}
