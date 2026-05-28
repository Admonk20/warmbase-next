// Server-only helpers for wrapping outbound email with tracking pixel,
// click-tracking redirects, and a one-click unsubscribe footer.
import { randomBytes, createHash } from "crypto";

export function newMessageId() {
  return randomBytes(16).toString("hex");
}

export function newUnsubToken(userId: string, email: string) {
  const raw = `${userId}:${email}:${Date.now()}:${randomBytes(8).toString("hex")}`;
  return createHash("sha256").update(raw).digest("hex").slice(0, 40);
}

/** Replace every absolute http(s) URL with a tracked redirect. */
function wrapLinks(body: string, baseUrl: string, mid: string) {
  return body.replace(/https?:\/\/[^\s<>"')]+/g, (url) => {
    if (url.includes("/api/public/track/") || url.includes("/api/public/unsubscribe") || url.includes("/api/public/t/")) {
      return url;
    }
    const u = encodeURIComponent(url);
    return `${baseUrl}/api/public/track/click?m=${mid}&u=${u}`;
  });
}

export function wrapBody({
  body,
  isHtml,
  baseUrl,
  messageId,
  unsubToken,
}: {
  body: string;
  isHtml: boolean;
  baseUrl: string;
  messageId: string;
  unsubToken: string;
}) {
  const unsubUrl = `${baseUrl}/api/public/unsubscribe?t=${unsubToken}`;
  const pixelUrl = `${baseUrl}/api/public/track/open.gif?m=${messageId}`;

  if (isHtml) {
    const wrapped = wrapLinks(body, baseUrl, messageId);
    const footer = `<div style="margin-top:24px;font-size:11px;color:#888;font-family:Arial,sans-serif">If this isn't relevant, <a href="${unsubUrl}" style="color:#888;text-decoration:underline">unsubscribe</a>.</div>`;
    const pixel = `<img src="${pixelUrl}" width="1" height="1" alt="" style="display:none" />`;
    return `${wrapped}${footer}${pixel}`;
  }

  // Plain text — append visible unsub line; no pixel (text emails can't track opens).
  const wrapped = wrapLinks(body, baseUrl, messageId);
  return `${wrapped}\n\n—\nUnsubscribe: ${unsubUrl}`;
}

export function htmlFromText(text: string) {
  const esc = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.55;color:#111">${esc
    .split(/\n\n+/)
    .map((p) => `<p style="margin:0 0 12px">${p.replace(/\n/g, "<br/>")}</p>`)
    .join("")}</div>`;
}

export function getAppBaseUrl(): string {
  return (
    process.env.APP_BASE_URL ||
    process.env.VITE_APP_URL ||
    "https://project--8e39473a-9102-4288-9c39-e295cfde40b7.lovable.app"
  );
}
