export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const SERVICE_URL = process.env.PLAYWRIGHT_SERVICE_URL;
  const API_KEY = process.env.PLAYWRIGHT_API_KEY;
  if (!SERVICE_URL) return res.status(500).json({ error: 'Playwright service not configured' });

  try {
    const upstream = await fetch(`${SERVICE_URL.replace(/\/$/, '')}/screenshot`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
      },
      body: JSON.stringify(req.body),
    });

    if (!upstream.ok) {
      const txt = await upstream.text().catch(() => null);
      return res.status(upstream.status).send(txt || 'upstream error');
    }

    const arrayBuffer = await upstream.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/octet-stream');
    return res.send(buffer);
  } catch (err) {
    console.error('proxy error', err);
    return res.status(502).json({ error: 'bad gateway' });
  }
}
