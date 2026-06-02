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
    const opts = {
      hostname: u.hostname,
      path: u.pathname + u.search,
      method,
      headers: {
        ...headers,
      },
    };
    if (payload) {
      opts.headers['Content-Type'] = 'application/json';
      opts.headers['Content-Length'] = Buffer.byteLength(payload);
    }
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

function csvEscape(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows, cols) {
  const head = cols.join(',');
  const body = rows.map(r => cols.map(c => csvEscape(r[c])).join(',')).join('\n');
  return head + '\n' + body;
}

async function main() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    console.error('.env not found');
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

  const userId = process.argv[2];
  if (!userId) {
    console.error('Usage: node scripts/test_export_flow.mjs <userId>');
    process.exit(1);
  }

  try {
    const lead = { user_id: userId, contact: 'Export Test', company: 'Export Co', title: 'CTO', email: `export-${Date.now()}@example.com`, notes: 'export test' };
    const insert = await requestJson('POST', `${url}/rest/v1/leads`, [lead], { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, Prefer: 'return=representation' });
    if (!insert.status || insert.status >= 400) {
      console.error('Insert failed', insert.body);
      process.exit(2);
    }
    const inserted = Array.isArray(insert.body) ? insert.body[0] : insert.body;
    console.log('inserted lead', inserted.id);

    const fetchRes = await requestJson('GET', `${url}/rest/v1/leads?user_id=eq.${userId}`, null, { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` });
    if (!fetchRes.status || fetchRes.status >= 400) {
      console.error('Fetch leads failed', fetchRes.body);
      process.exit(3);
    }
    const rows = Array.isArray(fetchRes.body) ? fetchRes.body : [];
    const cols = ["contact","company","title","email","phone","niche","status","temperature","value","source","linkedin_url","last_emailed_at","created_at"];
    const csv = toCsv(rows, cols);
    console.log('csv preview:\n', csv.slice(0, 800));

    // cleanup inserted lead
    const del = await requestJson('DELETE', `${url}/rest/v1/leads?id=eq.${inserted.id}`, null, { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` });
    console.log('deleted inserted lead ->', del.status);
  } catch (err) {
    console.error('Error', err.message || err);
    process.exit(4);
  }
}

main();
