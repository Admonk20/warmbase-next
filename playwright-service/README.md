# Playwright Service

This small service exposes a POST `/screenshot` endpoint that returns a PNG screenshot of a provided URL.

Key files
- `playwright-server.js` — the Express service (used in Dockerfile.playwright)
- `playwright-service/package.json` — minimal dependencies for the service
- `Dockerfile.playwright` — Dockerfile to build the service image

Quick local run

1. Install dependencies and browsers:

```bash
cd playwright-service
npm install --production
npx playwright install --with-deps
node playwright-server.js
```

2. Test the endpoint (example):

```bash
curl -X POST http://localhost:3001/screenshot \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}' --output screenshot.png
```

Docker (mirror Railway)

Build and run from repo root:

```bash
docker build -t warmbase-playwright -f Dockerfile.playwright .
docker run --rm -p 3001:3001 -e PLAYWRIGHT_API_KEY="your_key" warmbase-playwright
```

Environment variables
- `PLAYWRIGHT_API_KEY` — optional; if set, requests must include this key via `x-api-key` header or `Authorization: Bearer <key>`.
- `MAX_CONCURRENT_PAGES` — default `2` — maximum concurrent pages to allow.
- `RATE_LIMIT_MAX` — requests per window (default `10`).
- `RATE_LIMIT_WINDOW_MS` — window size in ms (default `60000`).

Railway / Deployment notes
- Use `Dockerfile.playwright` as the build file in Railway's GitHub deploy flow.
- Set `PLAYWRIGHT_API_KEY` and appropriate memory (>=1GB recommended).
- Use the `/healthz` healthcheck endpoint.

Security & scaling
- The service includes basic rate-limiting and optional API key protection.
- For production scale, put requests into a queue (Redis + BullMQ) and run a pool of workers.
