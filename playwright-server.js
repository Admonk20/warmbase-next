import express from 'express';
import { chromium } from 'playwright';

const app = express();
app.use(express.json());

app.post('/screenshot', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'missing url' });

  let browser;
  try {
    browser = await chromium.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'networkidle' });
    const buffer = await page.screenshot({ fullPage: true });
    res.set('Content-Type', 'image/png');
    res.send(buffer);
  } catch (err) {
    console.error('playwright error', err);
    res.status(500).json({ error: String(err) });
  } finally {
    if (browser) await browser.close();
  }
});

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`Playwright service listening on ${port}`));
