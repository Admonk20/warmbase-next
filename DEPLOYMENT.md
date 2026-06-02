# Deploying Playwright service and connecting to Vercel

This document shows step-by-step instructions to deploy the Playwright container and connect your Vercel project to use it via the serverless proxy.

Prerequisites
- You have this repository connected to GitHub and pushed to `main`.
- You have a Railway (or Render/Cloud Run) account and a Vercel account.

1) GitHub Actions (automated build & push)
- I added a workflow at `.github/workflows/build-and-push-playwright.yml` that builds the Docker image from `Dockerfile.playwright` and pushes to GitHub Container Registry (GHCR). It also can trigger a Railway deploy when secrets are present.

2) Add GitHub secrets (optional, for automatic Railway deploy)
- In your GitHub repo Settings → Secrets → Actions, add:
  - `RAILWAY_API_KEY` — your Railway API key
  - `RAILWAY_PROJECT_ID` — Railway project id
  - `RAILWAY_SERVICE_ID` — Railway service id

3) Deploying to Railway manually (UI)
- In Railway dashboard: New Project → Deploy from GitHub → select this repo → choose branch `main`.
- Add a Docker service (point to `Dockerfile.playwright`) or let Railway detect the Dockerfile.
- In the service settings add the environment variables:
  - `PLAYWRIGHT_API_KEY` (generate locally: `openssl rand -hex 32`)
  - `MAX_CONCURRENT_PAGES` = `2`
  - `RATE_LIMIT_MAX` = `10`
  - `RATE_LIMIT_WINDOW_MS` = `60000`
- Set health check path: `/healthz` and memory to at least `1GB`.

4) Deploying with GitHub Actions (automatic)
- Push to `main`. The workflow will build and push the image to GHCR.
- If you added the Railway secrets (`RAILWAY_API_KEY`, `RAILWAY_PROJECT_ID`, `RAILWAY_SERVICE_ID`), the workflow will attempt `railway up --project ... --service ... --detach`.

5) Connect Vercel
- In your Vercel project settings → Environment Variables, add:
  - `PLAYWRIGHT_SERVICE_URL` = e.g. `https://<railway-service-url>`
  - `PLAYWRIGHT_API_KEY` = same key as Railway's `PLAYWRIGHT_API_KEY`
- Deploy your Vercel project; the `api/playwright-proxy.js` serverless function will forward requests to the Playwright service.

6) Test end-to-end
- Check Railway health endpoint:
  ```bash
  curl -sS https://<railway-service-url>/healthz
  ```
- From Vercel (or locally) test the serverless proxy:
  ```bash
  curl -X POST https://<your-vercel-app>/api/playwright-proxy \
    -H "Content-Type: application/json" \
    -d '{"url":"https://example.com"}' --output example.png
  ```

Troubleshooting
- If browsers fail to launch in Railway, ensure the Docker image includes Playwright browsers (the base image `mcr.microsoft.com/playwright:focal` does). Logs should show if `playwright` asks to `npx playwright install`.
- If the GH Action fails to deploy to Railway, verify secrets and the project/service IDs are correct.

Security notes
- Never store `PLAYWRIGHT_API_KEY` in client code. Store it as server-side environment variables only (Railway and Vercel envs).
