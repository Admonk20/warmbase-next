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

function postJson(urlStr, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const payload = JSON.stringify(body);
    const opts = {
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...headers,
      },
    };
    const req = https.request(opts, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try {
          const json = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, body: json });
        } catch (e) {
          resolve({ status: res.statusCode, body });
        }
      });
    });
    req.on('error', (err) => reject(err));
    req.write(payload);
    req.end();
  });
}

async function main() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    console.error('.env not found at', envPath);
    process.exit(1);
  }
  const env = parseEnv(envPath);
  const allowSmoke = env.ALLOW_SMOKE_SCRIPTS || process.env.ALLOW_SMOKE_SCRIPTS;
  if (!allowSmoke || !/^(1|true)$/i.test(String(allowSmoke))) {
    console.error('Smoke test scripts disabled. Set ALLOW_SMOKE_SCRIPTS=1 in .env to enable.');
    process.exit(1);
  }
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  let url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  if (!serviceKey || !url) {
    console.error('Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_URL in .env');
    process.exit(1);
  }
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  url = url.replace(/\/$/, '');

  const email = `smoketest+${Date.now()}@example.com`;
  const password = 'TestPass123!';
  try {
    const create = await postJson(`${url}/auth/v1/admin/users`, { email, password, user_metadata: { full_name: 'Smoke Test' } }, {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    });
    if (!create.status || create.status >= 400) {
      console.error('Failed to create test user:', JSON.stringify(create.body, null, 2));
      process.exit(2);
    }
    console.log(JSON.stringify({ email, password, id: create.body.id }));
  } catch (err) {
    console.error('Error creating user:', err.message || err);
    process.exit(3);
  }
}

main();
