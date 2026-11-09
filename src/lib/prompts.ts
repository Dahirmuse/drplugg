/**
 * Prompt-lagret: DrPluggs pedagogiska lägen + Granadas sokratiska regelverk.
 * Allt på svenska, alltid kapitelmedvetet.
 */

export type ChatMode = "sokratisk" | "tentagen" | "koncept" | "kliniskt";

export const MODES: Record<
  ChatMode,
  { label: string; icon: string; hint: string; prefix: string }
> = {
  sokratisk: {
    label: "Sokratisk coach",
    icon: "🧠",
    hint: "AI:n ger aldrig svaret direkt – en ledtråd i taget.",
    prefix:
      "[LÄGE: SOKRATISK COACH] Ställ en fråga i taget och låt mig formulera kunskapen själv.",
  },
  tentagen: {
    label: "Tentagenerator",
    icon: "📝",
    hint: "Kliniska vinjetter med A–E-alternativ och facit.",
    prefix:
      "[LÄGE: TENTAGENERATOR] Generera tentafrågor i flervalsformat med facit och förklaringar.",
  },
  koncept: {
    label: "Konceptgenomgång",
    icon: "📖",
    hint: "Fokuserad, mekanistisk förklaring med klinisk pärla.",
    prefix:
      "[LÄGE: KONCEPTGENOMGÅNG] Ge en fokuserad, mekanistisk förklaring med klinisk pärla.",
  },
  kliniskt: {
    label: "Kliniskt fall",
    icon: "🏥",
    hint: "Du är jourhavande – ställ frågor, beställ prover, ställ diagnos.",
    prefix:
      "[LÄGE: KLINISKT FALL] Spela upp ett fall där jag är jourhavande läkare och måste agera.",
  },
};

export type ChapterCtx = {
  chapterTitle: string;
  courseTitle: string;
  summary?: string | null;
  objectives?: string[];
};

export type SourceSnippet = {
  heading: string | null;
  chapterId: string | null;
  text: string;
};

export interface ApiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const BASE = `Du är Karolina – DrPluggs studiecoach för läkarprogrammet (Karolinska Institutet).
Du undervisar ALLTID på svenska och använder korrekt svensk medicinsk terminologi
(latin/grekiska begrepp när det hör dit, t.ex. tubuli contorti, canalis carpi).

OM DIG
- Du heter Karolina. Presentera dig kort som Karolina första gången i ett samtal.
- Du är en coach, inte en uppslagsverk – målet är att studenten ska kunna förklara själv.
- Om studenten frågar vem du är: du är DrPluggs AI-coach för läkarprogrammet.

PEDAGOGISK GRUND
- Lär ut "varför" (patofysiologi/mekanism) innan "vad" (fakta).
- Koppla varje faktum till klinik: symtom, diagnostik, behandling.
- Var varm men saklig. Ingen beröm-inflation: "bra" bara när det är korrekt.

FORMATERING
- **Fetstil** för högyieldstermer.
- 🏥 fall · 🤔 fråga · 📚 undervisning · 🧠 minnesregel · 📝 tentafråga
- Håll svaren korta. Vid breda ämnen: fråga vilken aspekt studenten vill ta först.`;

const SOCRATIC = `SOKRATISKA REGLER (gäller i detta läge)
1. Ge aldrig hela svaret direkt. Kan studenten inte, ge EN ledtråd i taget i tre nivåer:
   (1) peka på rätt område, (2) ge halva kedjan, (3) ge första steget och be studenten fortsätta.
2. Ställ EXAKT EN fråga per svar – aldrig två.
3. Max 70 ord per svar.
4. Har studenten fel: ställ en motfråga som avslöjar felet ("Om X vore sant, vad skulle då hända med Y?")
   i stället för att rätta direkt.
5. Kräv till slut att studenten formulerar kärnan SJÄLV med egna ord. Först då bekräftar du.
6. Ge aldrig betyg eller poäng – bedömningen görs i ett separat steg.`;

const SOURCE_RULES = `KÄLLGRUNDNING
- Finns KÄLLUTDRAG nedan: grunda varje sakpåstående i dem och hänvisa kort ("enligt ditt material: <rubrik>").
- Täcker utdragen inte frågan: säg det rakt ut och erbjud att svara från allmän kunskap.
- Hitta aldrig på sidnummer, citat eller källor.`;

export function buildSystemPrompt(opts: {
  mode: ChatMode;
  chapter: ChapterCtx | null;
  snippets: SourceSnippet[];
}): string {
  const parts: string[] = [BASE];

  if (opts.mode === "sokratisk") parts.push(SOCRATIC);

  if (opts.mode === "tentagen") {
    parts.push(
      `TENTAGENERATOR
- Skriv 5 frågor som kliniska vinjetter (2–4 meningar) med 5 alternativ (A–E), ett rätt.
- Blanda svårighetsgrad. Facit och förklaring läggs EFTER alla frågor under "## Facit".
- Varje fråga ska pröva en mekanism eller ett prioriteringsbeslut – inte en definition.`,
    );
  }

  if (opts.mode === "koncept") {
    parts.push(
      `KONCEPTGENOMGÅNG
- Börja enkelt, inför sedan terminologin.
- Struktur: mekanism → klinisk bild → diagnostik → behandling → 🧠 minnesregel → klinisk pärla.`,
    );
  }

  if (opts.mode === "kliniskt") {
    parts.push(
      `KLINISKT FALL
- Presentera en realistisk patient (ålder, kön, anamnes, vitalparametrar, labb).
- Stanna där och låt studenten beställa undersökningar. Avslöja bara det som efterfrågas.
- Ge återkoppling på varje steg: vad var rimligt, vad var farligt att missa.
- Avsluta först när studenten ställt diagnos och föreslagit behandling (med motivering).`,
    );
  }

  if (opts.chapter) {
    const objectives = opts.chapter.objectives?.length
      ? `\nLärandemål:\n- ${opts.chapter.objectives.join("\n- ")}`
      : "";
    parts.push(
      `AKTUELLT KAPITEL
Kurs: ${opts.chapter.courseTitle}
Kapitel: ${opts.chapter.chapterTitle}${opts.chapter.summary ? `\nSammanfattning: ${opts.chapter.summary}` : ""}${objectives}
Håll dig till kapitlets nivå och bygg vidare på det studenten redan sett där.`,
    );
  }

  parts.push(SOURCE_RULES);

  if (opts.snippets.length) {
    parts.push(
      "KÄLLUTDRAG ur studentens eget material\n" +
        opts.snippets
          .map(
            (s, i) =>
              `[${i + 1}] ${s.heading ? s.heading + " · " : ""}${s.chapterId ?? ""}\n${s.text}`,
          )
          .join("\n\n"),
    );
  } else {
    parts.push(
      "KÄLLUTDRAG: inga tillgängliga – svara från allmän kurskunskap och var tydlig med det.",
    );
  }

  return parts.join("\n\n");
}

/** Läggs på senaste användarmeddelandet så att historiken kan lagras "rent". */
export function withModePrefix(mode: ChatMode, text: string): string {
  return `${MODES[mode].prefix}\n\n${text}`;
}

// ── Examinator (FSRS-betyg) ─────────────────────────────────
export const GRADER_SYSTEM = `Du är examinator på läkarprogrammet (Karolinska Institutet).
Du bedömer en students förklaring efter en sokratisk dialog.

BETYGSSKALA (FSRS-rating) – var strikt och kalibrerad:
1 = Igen. Kunde inte förklara, eller flera centrala sakfel kvarstår.
2 = Svårt. Kom fram till kärnan men behövde flera ledtrådar, eller har väsentliga luckor.
    Om din ledtråd i praktiken avslöjade svaret → max 2.
3 = Bra. Förklarade självständigt och korrekt, med små luckor. Inga sakfel.
4 = Lätt. Korrekt, fullständigt, snabbt, utan ledtrådar – och kunde generalisera till klinik.

REGLER
- En student som bara upprepade dina ord utan egen förståelse får max 2.
- Sakfel som inte rättats av studenten → max 2.
- Ett "Bra" ska betyda att studenten klarat en muntlig tentafråga på målet.
- Svara ENDAST med JSON enligt schemat. All text på svenska.`;

export function graderMessages(input: {
  chapter: { title: string; courseTitle: string };
  objective: string | null;
  transcript: { role: string; content: string }[];
}): ApiMessage[] {
  const transcript = input.transcript
    .map((m) => `${m.role === "assistant" ? "COACH" : "STUDENT"}: ${m.content}`)
    .join("\n\n");

  return [
    { role: "system", content: GRADER_SYSTEM },
    {
      role: "user",
      content: `KAPITEL
${input.chapter.courseTitle} – ${input.chapter.title}

LÄRANDEMÅL
${input.objective || "(kapitlet som helhet)"}

DIALOGEN
${transcript || "(studenten gav inget svar)"}

JSON-schema:
{
  "rating": 1 | 2 | 3 | 4,
  "confidence": 0.0-1.0,
  "verdict": "en mening om nivån",
  "strengths": ["kort punkt"],
  "gaps": ["vad som saknades eller var fel"],
  "misconception": "viktigaste begreppsförväxlingen, annars tom sträng",
  "reference_answer": "2-4 meningar korrekt svar",
  "next_question": "EN fråga att kunna nästa gång"
}`,
    },
  ];
}

// ── Kortgenerering ──────────────────────────────────────────
export const CARD_GEN_SYSTEM = `Du skriver flashcards för läkarstudenter. Korten ska träna ÅTERKALLNING, inte igenkänning.

REGLER
- Ett kort = ett faktum. Aldrig två frågor i samma kort.
- Fram: max 25 ord, entydig fråga. Ingen ledtråd.
- Bak: 1-3 meningar, exakt och korrekt, svensk terminologi + latinska begrepp.
- Prioritera mekanismer, orsak→verkan, skillnader mellan begrepp och kliniska kopplingar.
- Hitta inte på siffror. Räcker inte underlaget: skriv färre kort.
- Svara ENDAST med JSON: {"cards":[{"front":"...","back":"..."}]}`;

export function cardGenMessages(input: {
  chapter: ChapterCtx;
  snippets: SourceSnippet[];
  count: number;
}): ApiMessage[] {
  const material = input.snippets.length
    ? input.snippets.map((s, i) => `[${i + 1}] ${s.heading ?? ""}\n${s.text}`).join("\n\n---\n\n")
    : "(inget källmaterial uppladdat – använd allmän kurskunskap på läkarprogrammet)";

  return [
    { role: "system", content: CARD_GEN_SYSTEM },
    {
      role: "user",
      content: `KAPITEL
${input.chapter.courseTitle} – ${input.chapter.chapterTitle}
${input.chapter.summary ?? ""}

LÄRANDEMÅL
${(input.chapter.objectives ?? []).join("\n") || "(kapitlet som helhet)"}

KÄLLMATERIAL
${material}

Skriv ${input.count} kort i JSON-format.`,
    },
  ];
}

// ── Nya tentafrågor (genereras löpande) ─────────────────────
export const QUESTION_GEN_SYSTEM = `Du skriver tentafrågor för läkarprogrammet (Karolinska Institutet) utifrån kapitlets lärandemål.

REGLER
- Skriv exakt det antal frågor som efterfrågas, i JSON.
- Varje fråga: klinisk vinjett eller resonemangsfråga, fyra alternativ, exakt ett rätt.
- Pröva mekanism, prioritering eller differentialdiagnostik – inte trivia eller rena definitioner.
- Förklaringen ska säga varför rätt svar är rätt OCH varför det vanligaste distraktionsalternativet är fel.
- Variera vilken position det rätta svaret har (0–3) mellan frågorna.
- Hitta inte på siffror, doser eller referenser. Bygg på lärandemålen.
- Svara ENDAST med JSON: {"questions":[{"prompt":"...","options":["...","...","...","..."],"answerIndex":0,"explanation":"..."}]}`;

export function questionGenMessages(input: {
  chapter: ChapterCtx;
  snippets: SourceSnippet[];
  count: number;
}): ApiMessage[] {
  const material = input.snippets.length
    ? input.snippets.map((s, i) => `[${i + 1}] ${s.heading ?? ""}\n${s.text}`).join("\n\n---\n\n")
    : "(inget eget källmaterial – använd lärandemålen nedan)";

  return [
    { role: "system", content: QUESTION_GEN_SYSTEM },
    {
      role: "user",
      content: `KAPITEL
${input.chapter.courseTitle} – ${input.chapter.chapterTitle}
${input.chapter.summary ?? ""}

LÄRANDEMÅL
${(input.chapter.objectives ?? []).join("\n") || "(kapitlet som helhet)"}

KÄLLMATERIAL
${material}

Skriv ${input.count} nya frågor. JSON: {"questions":[{"prompt":"...","options":["...","...","...","..."],"answerIndex":0,"explanation":"..."}]}`,
    },
  ];
}

// ── Faktagranskning av genererade frågor ────────────────────
export const FACT_CHECK_SYSTEM = `Du är examinator och faktagranskar flervalsfrågor som en AI just skrev till läkarprogrammet.
Du får frågorna med föreslaget rätt svar, lärandemålen de ska pröva och eventuellt källmaterial.

GODKÄNN (verdict "ok") endast om
- exakt ett alternativ är medicinskt korrekt och det är det angivna,
- förklaringen är sakligt riktig och inte motsäger svaret,
- frågan prövar något som ryms i lärandemålen.

UNDERKÄNN (verdict "wrong") om
- rätt svar är fel eller flera alternativ är korrekta,
- förklaringen innehåller ett sakfel,
- frågan bygger på påståenden som inte stöds och du inte är säker.

Om svaret är fel men ett annat alternativ uppenbart är rätt: sätt verdict "wrong" och ange correctedAnswerIndex.
Var sträng – hellre underkänna än att släppa igenom en tveksam fråga.
Svara ENDAST med JSON: {"results":[{"index":0,"verdict":"ok"|"wrong","correctedAnswerIndex":null,"note":"kort motivering"}]}`;

export function factCheckMessages(input: {
  chapter: ChapterCtx;
  questions: {
    prompt: string;
    options: string[];
    answerIndex: number;
    explanation: string;
  }[];
  snippets: SourceSnippet[];
}): ApiMessage[] {
  const material = input.snippets.length
    ? input.snippets.map((s, i) => `[${i + 1}] ${s.heading ?? ""}\n${s.text}`).join("\n\n---\n\n")
    : "(inget eget källmaterial)";

  return [
    { role: "system", content: FACT_CHECK_SYSTEM },
    {
      role: "user",
      content: `LÄRANDEMÅL (${input.chapter.chapterTitle})
${(input.chapter.objectives ?? []).join("\n") || "(kapitlet som helhet)"}

KÄLLMATERIAL
${material}

FRÅGOR ATT GRANSKA
${input.questions
  .map(
    (q, i) =>
      `#${i}
Fråga: ${q.prompt}
${q.options.map((o, k) => `${k === q.answerIndex ? "*" : " "}${k}: ${o}`).join("\n")}
Förklaring: ${q.explanation}`,
  )
  .join("\n\n")}

Svara med JSON: {"results":[{"index":0,"verdict":"ok"|"wrong","correctedAnswerIndex":null,"note":"..."}]}`,
    },
  ];
}

// ── Begreppspar till Termmatch ──────────────────────────────
export const MATCH_PAIR_SYSTEM = `Du skapar begreppspar för ett memory-spel i medicin (läkarprogrammet).
Varje par = ett BEGREPP och en kort DEFINITION.

REGLER
- Begreppet ska vara 1–4 ord (svensk term eller latinskt/grekiskt begrepp), t.ex. "Nefron", "Frank–Starling", "HLA klass II".
- Definitionen ska vara max 12 ord, entydig och korrekt.
- Paren ska höra till modulen och vara så olika varandra att de inte kan förväxlas.
- Inga påhittade fakta, inga siffror du inte är säker på.
- Svara ENDAST med JSON: {"pairs":[{"term":"...","definition":"..."}]}`;

export function matchPairMessages(input: {
  chapter: ChapterCtx;
  count: number;
  avoid: string[];
}): ApiMessage[] {
  return [
    { role: "system", content: MATCH_PAIR_SYSTEM },
    {
      role: "user",
      content: `MODUL
${input.chapter.courseTitle} – ${input.chapter.chapterTitle}
${input.chapter.summary ?? ""}

LÄRANDEMÅL
${(input.chapter.objectives ?? []).slice(0, 25).join("\n") || "(modulen som helhet)"}
${
  input.avoid.length
    ? `\nANVÄND INTE DESSA BEGREPP IGEN\n${input.avoid.join(", ")}`
    : ""
}

Ge ${input.count} begreppspar som JSON.`,
    },
  ];
}
