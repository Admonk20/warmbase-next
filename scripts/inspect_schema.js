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

  // We can query the OpenAPI / PostgREST schema to get column details
  const res = await requestJson('GET', `${url}/rest/v1/`, null, { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` });
  console.log('status', res.status);
  if (res.status === 200) {
    const paths = res.body.paths;
    const definitions = res.body.definitions;
    if (definitions) {
      console.log('automation_runs definition:');
      console.log(JSON.stringify(definitions.automation_runs, null, 2));
      console.log('automation_config definition:');
      console.log(JSON.stringify(definitions.automation_config, null, 2));
    } else {
      console.log('No definitions found, keys:', Object.keys(res.body));
    }
  } else {
    console.error('Failed to get schema', res.body);
  }
}

main();
