import { fileURLToPath } from "node:url";
import fs from "node:fs/promises";
import path from "node:path";
// @ts-expect-error: runtime import of the compiled server bundle
import server from "../dist/server/server.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const distClientDir = path.join(projectRoot, "dist", "client");

const mimeTypes: Record<string, string> = {
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".html": "text/html; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".map": "application/json",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
};

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return mimeTypes[ext] ?? "application/octet-stream";
}

async function serveStaticAsset(pathname: string): Promise<Response | null> {
  const normalizedPath = pathname.replace(/^\/+/, "");
  const resolvedPath = path.resolve(distClientDir, normalizedPath);
  if (!resolvedPath.startsWith(distClientDir)) {
    return null;
  }

  try {
    const file = await fs.readFile(resolvedPath);
    return new Response(file, {
      headers: {
        "content-type": getMimeType(resolvedPath),
      },
    });
  } catch {
    return null;
  }
}

export default {
  async fetch(request: Request) {
    const url = new URL(request.url);
    const pathname = decodeURIComponent(url.pathname);

    const isAssetRequest = pathname.startsWith("/assets/") || pathname === "/favicon.ico" || path.extname(pathname) !== "";
    if (isAssetRequest) {
      const assetResponse = await serveStaticAsset(pathname);
      if (assetResponse) {
        return assetResponse;
      }
    }

    return server.fetch(request);
  },
};
