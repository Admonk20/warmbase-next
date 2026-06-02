export type PlaywrightSearchResult = {
  url: string;
  title?: string;
  snippet?: string;
  markdown?: string;
};

const PLAYWRIGHT_SERVICE_URL = process.env.PLAYWRIGHT_SERVICE_URL?.replace(/\/+$/, "");

function getPlaywrightServiceUrl() {
  if (!PLAYWRIGHT_SERVICE_URL) {
    throw new Error(
      "Playwright service is not configured. Set PLAYWRIGHT_SERVICE_URL to the running Playwright service.",
    );
  }
  return PLAYWRIGHT_SERVICE_URL;
}

async function requestPlaywright<T>(path: string, body: unknown): Promise<T> {
  const url = `${getPlaywrightServiceUrl()}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Playwright service error ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

export async function playwrightSearch(query: string, limit: number): Promise<PlaywrightSearchResult[]> {
  const payload = { query, limit };
  const result = await requestPlaywright<{ results: PlaywrightSearchResult[] }>("/search", payload);
  return (result.results ?? []).slice(0, limit);
}

export async function playwrightScrape(url: string): Promise<{ markdown?: string; title?: string }> {
  const payload = { url };
  const result = await requestPlaywright<{ title?: string; text?: string; html?: string }>("/scrape", payload);
  return {
    title: result.title,
    markdown: result.text ?? result.html,
  };
}
