// Server-only LLM helpers. Defaults to Lovable AI Gateway (no key required).
// If user has an OpenAI key in user_api_keys, callers may pass it explicitly to use OpenAI directly.

import { decryptSecret } from "./crypto.server";

const LOVABLE_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

async function tryDecrypt(value: string | null | undefined): Promise<string | null> {
  if (!value) return null;
  // Encrypted payloads start with "v1:" (see crypto.server.ts). Anything else
  // is legacy plaintext — return as-is so existing keys keep working until rotated.
  if (!value.startsWith("v1:")) return value;
  try {
    return await decryptSecret(value);
  } catch {
    return null;
  }
}

type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

export async function chatCompletion({
  messages,
  openaiKey,
  kimiKey,
  model,
  json,
  temperature = 0.7,
}: {
  messages: ChatMsg[];
  openaiKey?: string | null;
  kimiKey?: string | null;
  model?: string;
  json?: boolean;
  temperature?: number;
}): Promise<string> {
  // Priority: Kimi (Moonshot) > OpenAI > Lovable AI Gateway
  const useKimi = !!kimiKey;
  const useOpenAI = !useKimi && !!openaiKey;

  let url: string;
  let apiKey: string;
  let chosenModel: string;

  if (useKimi) {
    url = "https://api.moonshot.ai/v1/chat/completions";
    apiKey = kimiKey!;
    chosenModel = model ?? "kimi-k2.5";
    if (chosenModel === "kimi-k2.6" || chosenModel === "kimi-k2.5") temperature = 1;
  } else if (useOpenAI) {
    url = "https://api.openai.com/v1/chat/completions";
    apiKey = openaiKey!;
    chosenModel = model ?? "gpt-4o-mini";
  } else {
    url = LOVABLE_GATEWAY_URL;
    apiKey = process.env.LOVABLE_API_KEY!;
    chosenModel = model ?? "google/gemini-2.5-flash";
  }

  const body: Record<string, unknown> = {
    model: chosenModel,
    messages,
    temperature,
  };
  if (json) body.response_format = { type: "json_object" };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 429) throw new Error("AI rate limit hit, please retry shortly.");
    if (res.status === 402) throw new Error("AI credits exhausted. Add funds in Settings → Workspace.");
    throw new Error(`AI call failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return data.choices?.[0]?.message?.content ?? "";
}

export async function getUserKimiKey(
  supabase: { from: (t: string) => any },
  userId: string,
): Promise<string | null> {
  return getUserKey(supabase, userId, "kimi");
}

export async function getUserOpenAIKey(
  supabase: { from: (t: string) => any },
  userId: string,
): Promise<string | null> {
  return getUserKey(supabase, userId, "openai");
}

export async function getUserKey(
  supabase: { from: (t: string) => any },
  userId: string,
  provider: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("user_api_keys")
    .select("value_enc")
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle();
  return tryDecrypt(data?.value_enc);
}
