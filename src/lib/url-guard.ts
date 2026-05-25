// Server-side SSRF guards.

const PRIVATE_IPV4 = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^0\./,
  /^100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\./, // CGNAT
];

const BLOCKED_HOSTS = new Set(["localhost", "metadata.google.internal"]);

export function isPublicHost(host: string): boolean {
  const h = host.toLowerCase().trim();
  if (!h || BLOCKED_HOSTS.has(h)) return false;
  if (h.endsWith(".internal") || h.endsWith(".local")) return false;
  if (h.includes(":")) return false; // IPv6 — block to be safe
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) {
    for (const re of PRIVATE_IPV4) if (re.test(h)) return false;
  }
  return true;
}

export function assertSafeDomain(domain: string): string {
  const cleaned = domain.replace(/^https?:\/\//i, "").split("/")[0].split("?")[0].trim().toLowerCase();
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(cleaned)) {
    throw new Error("Invalid domain");
  }
  if (!isPublicHost(cleaned)) throw new Error("Blocked domain");
  return cleaned;
}

export function assertSafeUrl(raw: string, allowedHostSuffixes?: string[]): URL {
  let u: URL;
  try { u = new URL(raw); } catch { throw new Error("Invalid URL"); }
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("Invalid URL scheme");
  if (!isPublicHost(u.hostname)) throw new Error("Blocked host");
  if (allowedHostSuffixes && !allowedHostSuffixes.some((s) => u.hostname === s || u.hostname.endsWith("." + s))) {
    throw new Error("Host not allowed");
  }
  return u;
}
