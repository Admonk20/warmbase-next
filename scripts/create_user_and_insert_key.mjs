import fs from 'fs';
import path from 'path';
import https from 'https';
import crypto from 'crypto';
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
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  let url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  if (!serviceKey || !url) {
    console.error('Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_URL in .env');
    process.exit(1);
  }
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  url = url.replace(/\/$/, '');

  const email = `test+bot-${Date.now()}@example.com`;
  const password = 'TestPass123!';
  try {
    const create = await postJson(`${url}/auth/v1/admin/users`, { email, password }, {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    });
    if (!create.status || create.status >= 400) {
      console.error('Failed to create test user:', JSON.stringify(create.body, null, 2));
      process.exit(2);
    }
    const userId = create.body.id;
    console.log('Created test user id:', userId);

    function encryptPlaintext(plaintext) {
      const seed = serviceKey;
      const key = crypto.createHash('sha256').update('coldbase:smtp:' + seed).digest();
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
      const tag = cipher.getAuthTag();
      const ctWithTag = Buffer.concat([ct, tag]);
      const ivB64 = iv.toString('base64');
      const ctB64 = ctWithTag.toString('base64');
      return `v1:${ivB64}:${ctB64}`;
    }

    const enc = encryptPlaintext('secret-test-value-' + Date.now());

    const insert = await postJson(`${url}/rest/v1/user_api_keys`, [
      { user_id: userId, provider: 'openai', value_enc: enc, label: 'test-insert' },
    ], {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Prefer: 'return=representation',
    });
    if (!insert.status || insert.status >= 400) {
      console.error('Insert failed:', JSON.stringify(insert.body, null, 2));
      process.exit(3);
    }
    console.log('Inserted user_api_keys row:');
    console.log(JSON.stringify(insert.body, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message || err);
    process.exit(4);
  }
}

main();
