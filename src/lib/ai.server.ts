// Server-only LLM helpers. Defaults to Lovable AI Gateway (no key required).
// If user has an OpenAI key in user_api_keys, callers may pass it explicitly to use OpenAI directly.

const LOVABLE_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

export async function chatCompletion({
  messages,
  openaiKey,
  model,
  json,
  temperature = 0.7,
}: {
  messages: ChatMsg[];
  openaiKey?: string | null;
  model?: string;
  json?: boolean;
  temperature?: number;
}): Promise<string> {
  const useOpenAI = !!openaiKey;
  const url = useOpenAI
    ? "https://api.openai.com/v1/chat/completions"
    : LOVABLE_GATEWAY_URL;
  const apiKey = useOpenAI ? openaiKey! : process.env.LOVABLE_API_KEY!;
  const chosenModel =
    model ?? (useOpenAI ? "gpt-4o-mini" : "google/gemini-2.5-flash");

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

export async function getUserOpenAIKey(
  supabase: { from: (t: string) => any },
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("user_api_keys")
    .select("value_enc")
    .eq("user_id", userId)
    .eq("provider", "openai")
    .maybeSingle();
  return data?.value_enc ?? null;
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
  return data?.value_enc ?? null;
}
