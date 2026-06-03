import { chatCompletion, getUserOpenAIKey, getUserKimiKey, getUserClaudeKey, getUserKey } from "./ai.server";

export async function getAiProviderKeys(supabase: any, userId: string) {
  const [openaiKey, kimiKey, claudeKey] = await Promise.all([
    getUserOpenAIKey(supabase, userId),
    getUserKimiKey(supabase, userId),
    getUserClaudeKey(supabase, userId),
  ]);
  return { openaiKey, kimiKey, claudeKey };
}

export async function getUserProviderKey(supabase: any, userId: string, provider: "openai" | "kimi" | "claude" | "resend") {
  return getUserKey(supabase, userId, provider);
}

export async function chatWithUserKeys(params: {
  supabase: any;
  userId: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  json?: boolean;
  temperature?: number;
}) {
  const { openaiKey, kimiKey, claudeKey } = await getAiProviderKeys(params.supabase, params.userId);
  return chatCompletion({
    messages: params.messages,
    openaiKey,
    kimiKey,
    claudeKey,
    json: params.json,
    temperature: params.temperature,
  });
}
