import express from 'express';
// use global fetch and process.env for local testing

const app = express();
app.use(express.json());

app.post('/playwright-proxy', async (req, res) => {
  const SERVICE_URL = process.env.PLAYWRIGHT_SERVICE_URL || 'http://localhost:3001';
  const API_KEY = process.env.PLAYWRIGHT_API_KEY;
  try {
    const upstream = await fetch(`${SERVICE_URL.replace(/\/$/, '')}/screenshot`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
      },
      body: JSON.stringify(req.body),
    });
    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.set('Content-Type', upstream.headers.get('content-type') || 'application/octet-stream');
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

const port = process.env.LOCAL_PROXY_PORT || 4001;
app.listen(port, () => console.log(`Local proxy listening on ${port}`));
