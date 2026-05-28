// Server-only AI providers & orchestration.
import { decryptSecret } from "./crypto.server";
import Anthropic from "@anthropic-ai/sdk";

export type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

async function tryDecrypt(value: string | null | undefined): Promise<string | null> {
  if (!value) return null;
  if (!value.startsWith("v1:")) return value;
  try {
    return await decryptSecret(value);
  } catch {
    return null;
  }
}

export async function chatCompletion({
  messages,
  openaiKey,
  kimiKey,
  claudeKey,
  model,
  json,
  temperature = 0.7,
}: {
  messages: ChatMsg[];
  openaiKey?: string | null;
  kimiKey?: string | null;
  claudeKey?: string | null;
  model?: string;
  json?: boolean;
  temperature?: number;
}): Promise<string> {
  // Use environment keys if per-user keys are missing
  const activeKimiKey = kimiKey || process.env.KIMI_API_KEY;
  const activeClaudeKey = claudeKey || process.env.ANTHROPIC_API_KEY;
  const activeOpenaiKey = openaiKey || process.env.OPENAI_API_KEY;

<<<<<<< HEAD
  // Priority: Kimi > Claude > OpenAI
  if (activeKimiKey) {
    return chatKimi(messages, activeKimiKey, model, json, temperature);
  }
  if (activeClaudeKey) {
    return chatClaude(messages, activeClaudeKey, model, json, temperature);
  }
  if (activeOpenaiKey) {
    return chatOpenAI(messages, activeOpenaiKey, model, json, temperature);
=======
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
>>>>>>> 0d5cac3ed1521cd54d2a6f296a120925cff2bc3e
  }

  throw new Error("No AI provider key configured. Please add a key in Settings.");
}

async function chatKimi(messages: ChatMsg[], apiKey: string, model?: string, json?: boolean, temperature?: number): Promise<string> {
  const url = "https://api.moonshot.ai/v1/chat/completions";
  const chosenModel = model ?? "moonshot-v1-8k";
  
  const body: any = {
    model: chosenModel,
    messages,
    temperature: chosenModel.includes("k2") ? 1 : (temperature ?? 0.7),
  };
  if (json) body.response_format = { type: "json_object" };

  const res = await aiFetch(url, apiKey, body);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function chatClaude(messages: ChatMsg[], apiKey: string, model?: string, json?: boolean, temperature?: number): Promise<string> {
  const anthropic = new Anthropic({ apiKey });
  const systemMsg = messages.find(m => m.role === "system")?.content;
  const userMessages = messages.filter(m => m.role !== "system").map(m => ({
    role: m.role as "user" | "assistant",
    content: m.content
  }));

  const response = await anthropic.messages.create({
    model: model ?? "claude-3-5-sonnet-20240620",
    max_tokens: 4096,
    system: systemMsg,
    messages: userMessages,
    temperature: temperature ?? 0.7,
  });

  const content = response.content[0];
  if (content.type === "text") return content.text;
  return "";
}

async function chatOpenAI(messages: ChatMsg[], apiKey: string, model?: string, json?: boolean, temperature?: number): Promise<string> {
  const url = "https://api.openai.com/v1/chat/completions";
  const chosenModel = model ?? "gpt-4o-mini";
  
  const body: any = {
    model: chosenModel,
    messages,
    temperature: temperature ?? 0.7,
  };
  if (json) body.response_format = { type: "json_object" };

  const res = await aiFetch(url, apiKey, body);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function aiFetch(url: string, apiKey: string, body: any) {
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
    if (res.status === 429) throw new Error("AI rate limit hit.");
    throw new Error(`AI Provider Error (${res.status}): ${text.slice(0, 250)}`);
  }
  return res;
}

export async function getUserKimiKey(supabase: any, userId: string): Promise<string | null> {
  return getUserKey(supabase, userId, "kimi");
}

export async function getUserOpenAIKey(supabase: any, userId: string): Promise<string | null> {
  return getUserKey(supabase, userId, "openai");
}

export async function getUserClaudeKey(supabase: any, userId: string): Promise<string | null> {
  return getUserKey(supabase, userId, "claude");
}

export async function getUserKey(supabase: { from: (t: string) => any }, userId: string, provider: string): Promise<string | null> {
  const { data } = await supabase
    .from("user_api_keys")
    .select("value_enc")
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle();
  return tryDecrypt(data?.value_enc);
}
