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

  const userId = 'ddf8608a-db92-4830-9a3e-a4322ffb007a'; // our test user

  console.log('Testing insert...');
  const insertRes = await requestJson('POST', `${url}/rest/v1/automation_runs`, {
    user_id: userId,
    status: 'running',
    logs: ['Started autonomous loop at test time']
  }, {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation'
  });

  console.log('Insert status:', insertRes.status);
  console.log('Insert body:', JSON.stringify(insertRes.body, null, 2));

  if (insertRes.status === 201 && insertRes.body && insertRes.body[0]) {
    const runId = insertRes.body[0].id;
    console.log('Testing select...');
    const selectRes = await requestJson('GET', `${url}/rest/v1/automation_runs?id=eq.${runId}`, null, {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`
    });
    console.log('Select status:', selectRes.status);
    console.log('Select body:', JSON.stringify(selectRes.body, null, 2));

    const currentLogs = selectRes.body[0].logs;
    const newLogs = [...currentLogs, 'Step: Test step 2'];

    console.log('Testing update...');
    const updateRes = await requestJson('PATCH', `${url}/rest/v1/automation_runs?id=eq.${runId}`, {
      logs: newLogs
    }, {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    });
    console.log('Update status:', updateRes.status);
    console.log('Update body:', JSON.stringify(updateRes.body, null, 2));

    // Cleanup
    console.log('Cleaning up test row...');
    const deleteRes = await requestJson('DELETE', `${url}/rest/v1/automation_runs?id=eq.${runId}`, null, {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`
    });
    console.log('Delete status:', deleteRes.status);
  }
}

main();
