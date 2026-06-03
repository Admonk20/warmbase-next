import express from 'express';
import { chromium } from 'playwright';

const app = express();
app.use(express.json({ limit: '100kb' }));

const PORT = process.env.PORT || 3001;
const API_KEY = process.env.PLAYWRIGHT_API_KEY || null;
const MAX_CONCURRENT_PAGES = parseInt(process.env.MAX_CONCURRENT_PAGES || '2', 10);

let browserInstance = null;
let browserLaunching = false;
let activePages = 0;

async function ensureBrowser() {
  if (browserInstance) return browserInstance;
  if (browserLaunching) {
    // wait for browser to launch
    while (browserLaunching && !browserInstance) {
      await new Promise((r) => setTimeout(r, 50));
    }
    return browserInstance;
  }

  browserLaunching = true;
  try {
    browserInstance = await chromium.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    return browserInstance;
  } finally {
    browserLaunching = false;
  }
}

app.get('/healthz', (_req, res) => res.json({ status: 'ok' }));

// Simple in-memory rate limiter (per-IP)
function createLimiter({ windowMs = 60000, max = 10 } = {}) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [key, arr] of hits.entries()) {
      const filtered = arr.filter((ts) => ts > now - windowMs);
      if (filtered.length === 0) hits.delete(key); else hits.set(key, filtered);
    }
  }, windowMs).unref();

  return (req, res, next) => {
    try {
      const ip = (req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown').toString();
      const now = Date.now();
      const arr = hits.get(ip) || [];
      const filtered = arr.filter((ts) => ts > now - windowMs);
      filtered.push(now);
      hits.set(ip, filtered);
      if (filtered.length > max) {
        res.setHeader('Retry-After', Math.ceil(windowMs / 1000));
        return res.status(429).json({ error: 'rate limit exceeded' });
      }
    } catch (e) {
      // ignore and allow
    }
    next();
  };
}

const limiter = createLimiter({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60000),
  max: Number(process.env.RATE_LIMIT_MAX || 10),
});

app.post('/scrape', limiter, async (req, res) => {
  if (API_KEY) {
    const key = (req.headers['x-api-key'] || req.headers['authorization'])?.toString();
    const token = key?.startsWith('Bearer ') ? key.slice(7) : key;
    if (!token || token !== API_KEY) return res.status(401).json({ error: 'unauthorized' });
  }

  const { url, width = 1280, height = 800 } = req.body || {};
  if (!url) return res.status(400).json({ error: 'missing url' });

  if (activePages >= MAX_CONCURRENT_PAGES) {
    return res.status(503).json({ error: 'too many requests' });
  }

  activePages++;
  let context = null;
  let page = null;
  try {
    const browser = await ensureBrowser();
    context = await browser.newContext({ viewport: { width: Number(width), height: Number(height) } });
    page = await context.newPage();
    await page.goto(url, { waitUntil: 'networkidle' });
    const title = await page.title();
    const text = await page.evaluate(() => document.documentElement.innerText || '');
    return res.json({ title, text });
  } catch (err) {
    console.error('scrape error', err);
    return res.status(500).json({ error: String(err) });
  } finally {
    try {
      if (page) await page.close();
      if (context) await context.close();
    } catch (e) {
      console.error('cleanup error', e);
    }
    activePages = Math.max(0, activePages - 1);
  }
});

app.post('/search', limiter, async (req, res) => {
  if (API_KEY) {
    const key = (req.headers['x-api-key'] || req.headers['authorization'])?.toString();
    const token = key?.startsWith('Bearer ') ? key.slice(7) : key;
    if (!token || token !== API_KEY) return res.status(401).json({ error: 'unauthorized' });
  }

  const { query, limit = 10 } = req.body || {};
  if (!query) return res.status(400).json({ error: 'missing query' });

  if (activePages >= MAX_CONCURRENT_PAGES) {
    return res.status(503).json({ error: 'too many requests' });
  }

  activePages++;
  let context = null;
  let page = null;
  try {
    const browser = await ensureBrowser();
    context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    page = await context.newPage();
    const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
    await page.goto(url, { waitUntil: 'networkidle' });
    const results = await page.evaluate((max) => {
      const items = Array.from(document.querySelectorAll('li.b_algo'));
      return items.slice(0, max).map((item) => {
        const anchor = item.querySelector('h2 a');
        const snippet = item.querySelector('p')?.textContent?.trim() || undefined;
        return {
          url: anchor?.href || '',
          title: anchor?.textContent?.trim() || undefined,
          snippet,
        };
      });
    }, Number(limit));
    return res.json({ results });
  } catch (err) {
    console.error('search error', err);
    return res.status(500).json({ error: String(err) });
  } finally {
    try {
      if (page) await page.close();
      if (context) await context.close();
    } catch (e) {
      console.error('cleanup error', e);
    }
    activePages = Math.max(0, activePages - 1);
  }
});

app.post('/screenshot', limiter, async (req, res) => {
  if (API_KEY) {
    const key = (req.headers['x-api-key'] || req.headers['authorization'])?.toString();
    const token = key?.startsWith('Bearer ') ? key.slice(7) : key;
    if (!token || token !== API_KEY) return res.status(401).json({ error: 'unauthorized' });
  }

  const { url, fullPage = true, width = 1280, height = 800 } = req.body || {};
  if (!url) return res.status(400).json({ error: 'missing url' });

  if (activePages >= MAX_CONCURRENT_PAGES) {
    return res.status(503).json({ error: 'too many requests' });
  }

  activePages++;
  let context = null;
  let page = null;
  try {
    const browser = await ensureBrowser();
    context = await browser.newContext({ viewport: { width: Number(width), height: Number(height) } });
    page = await context.newPage();
    await page.goto(url, { waitUntil: 'networkidle' });
    const buffer = await page.screenshot({ fullPage: Boolean(fullPage) });
    res.set('Content-Type', 'image/png');
    return res.send(buffer);
  } catch (err) {
    console.error('screenshot error', err);
    return res.status(500).json({ error: String(err) });
  } finally {
    try {
      if (page) await page.close();
      if (context) await context.close();
    } catch (e) {
      console.error('cleanup error', e);
    }
    activePages = Math.max(0, activePages - 1);
  }
});

const server = app.listen(PORT, () => console.log(`Playwright service listening on ${PORT}`));

async function shutdown() {
  console.log('Playwright service shutting down...');
  server.close(async () => {
    try {
      if (browserInstance) await browserInstance.close();
    } catch (err) {
      console.error('Error closing browser', err);
    } finally {
      process.exit(0);
    }
  });

  // Force exit after 10s
  setTimeout(() => {
    console.warn('Forcing shutdown');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
