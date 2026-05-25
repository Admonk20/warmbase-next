// Personalization variables + spintax rendering.
// Variables: {{first_name}} {{last_name}} {{company}} {{title}} {{niche}}
// Spintax: {a|b|c}  →  pick one (deterministic per messageId for A/B parity if needed).

export type LeadLike = {
  contact?: string | null;
  company?: string | null;
  title?: string | null;
  niche?: string | null;
  email?: string | null;
};

function pickFirst(name?: string | null) {
  if (!name) return "there";
  const parts = name.trim().split(/\s+/);
  return parts[0] || "there";
}
function pickLast(name?: string | null) {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

export function renderVars(template: string, lead: LeadLike, extra: Record<string, string> = {}) {
  const vars: Record<string, string> = {
    first_name: pickFirst(lead.contact),
    last_name: pickLast(lead.contact),
    contact: lead.contact ?? "there",
    company: lead.company ?? "",
    title: lead.title ?? "",
    niche: lead.niche ?? "",
    email: lead.email ?? "",
    ...extra,
  };
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => vars[k] ?? "");
}

// Spintax: nested {a|b|c}. Deterministic seed allows reproducibility.
export function renderSpintax(template: string, seed?: string): string {
  let hash = 0;
  if (seed) {
    for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  } else {
    hash = Math.floor(Math.random() * 0xffffffff);
  }
  const rng = () => {
    hash = (hash * 1103515245 + 12345) >>> 0;
    return hash / 0x100000000;
  };

  function expand(s: string): string {
    let out = s;
    // innermost first
    for (let i = 0; i < 20; i++) {
      const m = out.match(/\{([^{}]+)\}/);
      if (!m) break;
      const opts = m[1].split("|");
      if (opts.length < 2) { out = out.replace(m[0], m[1]); continue; }
      out = out.replace(m[0], opts[Math.floor(rng() * opts.length)]);
    }
    return out;
  }
  return expand(template);
}

export function renderAll(template: string, lead: LeadLike, seed?: string, extra?: Record<string, string>) {
  return renderSpintax(renderVars(template, lead, extra), seed);
}
