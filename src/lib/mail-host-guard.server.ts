const BLOCKED_HOSTS = new Set(["localhost", "metadata.google.internal"]);
const SMTP_PORTS = new Set([465, 587, 2525]);
const IMAP_PORTS = new Set([993]);

function isPrivateIpv4(host: string): boolean {
  const parts = host.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) {
    return false;
  }
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19))
  );
}

function isBlockedIpv6(host: string): boolean {
  const h = host.toLowerCase();
  return h === "::1" || h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80:");
}

function cleanHost(raw: string): string {
  const host = raw.trim().replace(/^\[/, "").replace(/\]$/, "").toLowerCase();
  if (!host || host.includes("/") || host.includes("@") || host.includes("\\")) {
    throw new Error("Invalid mail host");
  }
  if (BLOCKED_HOSTS.has(host) || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("Mail host is not allowed");
  }
  return host;
}

async function resolveAddresses(host: string): Promise<string[]> {
  const answers: string[] = [];
  for (const [type, recordType] of [
    ["A", 1],
    ["AAAA", 28],
  ] as const) {
    const res = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${type}`,
      { headers: { Accept: "application/dns-json" }, signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) continue;
    const json = (await res.json()) as { Answer?: Array<{ data?: string; type?: number }> };
    answers.push(
      ...(json.Answer ?? [])
        .filter((a) => a.type === recordType)
        .map((a) => a.data ?? "")
        .filter(Boolean),
    );
  }
  return answers;
}

export async function assertSafeMailEndpoint(
  rawHost: string,
  port: number,
  protocol: "smtp" | "imap",
): Promise<string> {
  const host = cleanHost(rawHost);
  const allowedPorts = protocol === "smtp" ? SMTP_PORTS : IMAP_PORTS;
  if (!allowedPorts.has(port)) {
    throw new Error(`${protocol.toUpperCase()} port is not allowed`);
  }

  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    if (isPrivateIpv4(host)) throw new Error("Mail host is not allowed");
    return host;
  }
  if (host.includes(":")) {
    if (isBlockedIpv6(host)) throw new Error("Mail host is not allowed");
    return host;
  }

  const addresses = await resolveAddresses(host);
  if (!addresses.length) throw new Error("Mail host could not be resolved");
  for (const address of addresses) {
    if (isPrivateIpv4(address) || isBlockedIpv6(address)) {
      throw new Error("Mail host resolves to a private address");
    }
  }
  return host;
}
