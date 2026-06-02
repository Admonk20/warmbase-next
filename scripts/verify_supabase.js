import fs from 'fs';
import path from 'path';
import https from 'https';
import { URL } from 'url';

function parseEnv(file) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  const out = {};
  for (const line of lines) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

async function main() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    console.error('.env not found at', envPath);
    process.exit(1);
  }

  const env = parseEnv(envPath);
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  let url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  if (!serviceKey || !url) {
    console.error('Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_URL in .env');
    process.exit(1);
  }
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

  const restUrl = `${url.replace(/\/$/, '')}/rest/v1/profiles?select=id&limit=1`;

  try {
    // Use https.request directly for more explicit error reporting
    const u = new URL(restUrl);
    const options = {
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'GET',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        if (res.statusCode >= 400) {
          console.error('Supabase check failed:', res.statusCode, res.statusMessage);
          try { console.error(JSON.parse(body)); } catch(e) { console.error(body); }
          process.exit(2);
        }
        try {
          const json = JSON.parse(body);
          console.log('Supabase admin access OK. Sample result:');
          console.log(JSON.stringify(json, null, 2));
          process.exit(0);
        } catch (e) {
          console.error('Invalid JSON response', body);
          process.exit(2);
        }
      });
    });
    req.on('error', (err) => {
      console.error('Error contacting Supabase:', err.message || err);
      process.exit(3);
    });
    req.end();
  } catch (err) {
    console.error('Error contacting Supabase:', err.message || err);
    process.exit(3);
  }
}

main();

main();
