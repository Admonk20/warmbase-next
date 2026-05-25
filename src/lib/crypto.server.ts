// AES-GCM encryption helper for sensitive per-user credentials (SMTP/IMAP passwords).
// Key derives from SUPABASE_SERVICE_ROLE_KEY so we don't need a separate user secret.

const enc = new TextEncoder();
const dec = new TextDecoder();

async function getKey(): Promise<CryptoKey> {
  const seed = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!seed) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY for encryption");
  const hash = await crypto.subtle.digest("SHA-256", enc.encode("coldbase:smtp:" + seed));
  return crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

function toB64(buf: ArrayBuffer): string {
  let s = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.byteLength; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function encryptSecret(plaintext: string): Promise<string> {
  if (!plaintext) return "";
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plaintext));
  return `v1:${toB64(iv.buffer as ArrayBuffer)}:${toB64(ct)}`;
}

export async function decryptSecret(payload: string): Promise<string> {
  if (!payload) return "";
  const [v, ivB64, ctB64] = payload.split(":");
  if (v !== "v1") throw new Error("Unknown ciphertext version");
  const key = await getKey();
  const iv = fromB64(ivB64);
  const ct = fromB64(ctB64);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, ct as BufferSource);
  return dec.decode(pt);
}
