import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Email finder fallback chain — pattern guessing + DNS MX validation.
// Does not require Hunter/Apollo. Uses CloudFlare DoH for MX.

const PATTERNS = [
  (f: string, l: string) => `${f}.${l}`,
  (f: string, l: string) => `${f[0]}${l}`,
  (f: string, l: string) => `${f}${l[0]}`,
  (f: string, l: string) => `${f}`,
  (f: string) => `${f}`,
  (f: string, l: string) => `${f}_${l}`,
  (f: string, l: string) => `${f[0]}.${l}`,
  (f: string, l: string) => `${l}.${f}`,
  (f: string, l: string) => `${f}-${l}`,
];

async function hasMx(domain: string): Promise<boolean> {
  try {
    const r = await fetch(`https://cloudflare-dns.com/dns-query?name=${domain}&type=MX`, {
      headers: { Accept: "application/dns-json" },
    });
    const j = (await r.json()) as { Answer?: any[] };
    return !!j.Answer?.length;
  } catch { return false; }
}

export const findEmailCandidates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    fullName: z.string().min(2).max(120),
    domain: z.string().min(3).max(255),
  }).parse)
  .handler(async ({ data }) => {
    const parts = data.fullName.trim().toLowerCase().replace(/[^a-z\s-]/g, "").split(/\s+/);
    const first = parts[0];
    const last = parts.length > 1 ? parts[parts.length - 1] : "";
    const domain = data.domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase();

    const mxOk = await hasMx(domain);
    if (!mxOk) return { mxOk: false, candidates: [] };

    const uniq = new Set<string>();
    for (const p of PATTERNS) {
      const local = p(first, last || first).replace(/\.{2,}/g, ".").replace(/^\.|\.$/g, "");
      if (local) uniq.add(`${local}@${domain}`);
    }
    return { mxOk: true, candidates: Array.from(uniq).slice(0, 10) };
  });
