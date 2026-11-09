import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { queryMany } from "@/lib/db";
import DocsManager from "@/components/DocsManager";

export const dynamic = "force-dynamic";

export default async function KallorPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const chapters = await queryMany<{ id: string; title: string; course: string }>(
    `SELECT ch.id, ch.title, c.code AS course
       FROM chapters ch JOIN courses c ON c.id = ch.course_id
      ORDER BY c.sort_order, ch.sort_order`,
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-display text-2xl font-bold tracking-tight text-plum-dark">Källor</h1>
      <p className="mt-1 max-w-2xl text-sm leading-relaxed text-grey">
        Ladda upp dina egna sammanfattningar, föreläsningsanteckningar eller kompendier.
        Karolina grundar då svaren i ditt material och säger till när något inte står där.
      </p>

      <div className="mt-5">
        <DocsManager chapters={chapters} />
      </div>

      <div className="mt-5 rounded-2xl border border-[--grey-light] bg-[--orange-light] p-4 text-xs leading-relaxed text-plum-dark">
        <strong>Så används materialet:</strong> texten delas upp i avsnitt per rubrik. När du
        chattar söker coachen bland dina avsnitt (och i det valda kapitlets lärandemål) och
        refererar till rubriken. Det är alltså inte en vektordatabas – men det räcker gott för att
        hålla svaren förankrade i kursmaterialet.{" "}
        <Link href="/chatt" className="font-semibold text-plum underline">
          Testa i chatten →
        </Link>
      </div>
    </div>
  );
}
