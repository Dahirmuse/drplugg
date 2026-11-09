/** Tunn DeepSeek-klient (OpenAI-kompatibel). Nyckeln läses bara server-side. */

export interface ApiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const BASE_URL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";
const URL_CHAT = `${BASE_URL.replace(/\/$/, "")}/v1/chat/completions`;

export function hasApiKey(): boolean {
  return Boolean(process.env.DEEPSEEK_API_KEY);
}

export class DeepSeekError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

function headers(): Record<string, string> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new DeepSeekError("DEEPSEEK_API_KEY saknas på servern.", 503);
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
  };
}

export async function streamCompletion(
  messages: ApiMessage[],
  opts: { temperature?: number; maxTokens?: number } = {},
): Promise<Response> {
  const res = await fetch(URL_CHAT, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      model: MODEL,
      messages,
      stream: true,
      temperature: opts.temperature ?? 0.6,
      max_tokens: opts.maxTokens ?? 900,
    }),
  });

  if (!res.ok || !res.body) {
    let detail = "";
    try {
      detail = (await res.text()).slice(0, 300);
    } catch {
      /* ignorera */
    }
    throw new DeepSeekError(
      `AI-tjänsten svarade ${res.status}. ${detail ? `(${detail})` : ""}`.trim(),
      res.status === 401 ? 401 : 502,
    );
  }

  return res;
}

export async function completeJson<T>(
  messages: ApiMessage[],
  opts: { temperature?: number; maxTokens?: number } = {},
): Promise<T> {
  const res = await fetch(URL_CHAT, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      model: MODEL,
      messages,
      stream: false,
      temperature: opts.temperature ?? 0.2,
      max_tokens: opts.maxTokens ?? 900,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    throw new DeepSeekError(`AI-tjänsten svarade ${res.status}.`, res.status === 401 ? 401 : 502);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const raw = data.choices?.[0]?.message?.content ?? "";
  const jsonStart = raw.indexOf("{");
  const jsonEnd = raw.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new DeepSeekError("AI-svaret innehöll ingen JSON.", 502);
  }
  try {
    return JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) as T;
  } catch {
    throw new DeepSeekError("Kunde inte tolka AI-svaret som JSON.", 502);
  }
}
