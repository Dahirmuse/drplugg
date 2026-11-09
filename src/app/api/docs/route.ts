import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addChunks, addDoc, deleteDoc, listDocs } from "@/lib/repo";
import { chunkText } from "@/lib/retrieval";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Inte inloggad." }, { status: 401 });
  return NextResponse.json({ docs: await listDocs(user.id) });
}

async function extractPdf(buffer: ArrayBuffer): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join("\n\n") : text;
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Inte inloggad." }, { status: 401 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });

  const file = form.get("file");
  const pastedText = (form.get("text") as string | null) ?? "";
  const chapterId = (form.get("chapterId") as string | null) || null;
  const name = (form.get("name") as string | null) ?? (file instanceof File ? file.name : "Inklistrat material");

  let text = pastedText;
  let kind = "text";

  if (file instanceof File) {
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".pdf")) {
      try {
        text = await extractPdf(await file.arrayBuffer());
        kind = "pdf";
      } catch {
        return NextResponse.json(
          { error: "Kunde inte läsa PDF:en. Testa att kopiera texten i stället." },
          { status: 400 },
        );
      }
    } else if (lower.endsWith(".txt") || lower.endsWith(".md")) {
      text = await file.text();
      kind = lower.endsWith(".md") ? "markdown" : "text";
    } else {
      return NextResponse.json(
        { error: "Filtypen stöds inte. Använd PDF, TXT eller MD." },
        { status: 400 },
      );
    }
  }

  text = text.trim();
  if (text.length < 40) {
    return NextResponse.json({ error: "Materialet är för kort (minst 40 tecken)." }, { status: 400 });
  }
  if (text.length > 600_000) {
    return NextResponse.json({ error: "Filen är för stor (max ~600 000 tecken)." }, { status: 400 });
  }

  const chunks = chunkText(text, name);
  const docId = await addDoc(user.id, name.slice(0, 120), kind, text.length);
  await addChunks(docId, chapterId, chunks);

  return NextResponse.json({ ok: true, id: docId, chunks: chunks.length, chars: text.length });
}

export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Inte inloggad." }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id krävs." }, { status: 400 });

  await deleteDoc(user.id, id);
  return NextResponse.json({ ok: true });
}
