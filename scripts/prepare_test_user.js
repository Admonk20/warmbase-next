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

function requestJson(method, urlStr, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const payload = body ? JSON.stringify(body) : null;
    const opts = { hostname: u.hostname, path: u.pathname + u.search, method, headers };
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
    if (payload) req.write(payload);
    req.end();
  });
}

async function main() {
  const envPath = path.resolve(process.cwd(), '.env');
  const env = parseEnv(envPath);
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  let url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  url = url.replace(/\/$/, '');

  const userId = 'ddf8608a-db92-4830-9a3e-a4322ffb007a';

  console.log('Updating config to enable automation for test user...');
  const res = await requestJson('PATCH', `${url}/rest/v1/automation_config?user_id=eq.${userId}`, {
    enabled: true,
    services_offered: 'Custom AI chatbots and web app automation.',
    icp: {
      titles: ['Founder', 'CEO'],
      industries: ['SaaS', 'Agency'],
      geos: ['United States'],
      keywords: ['AI'],
      service: 'Custom AI chatbots and web app automation.',
      limit: 5
    }
  }, {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json'
  });

  console.log('Update config status:', res.status);
}

main();
