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

async function main() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    console.error('.env not found');
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

  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
  };

  try {
    console.log('Deleting smoke rows from tables...');

    const deletes = [
      { desc: 'sequence_steps (body)', path: `${url}/rest/v1/sequence_steps?body=eq.${encodeURIComponent('Hello from smoke test')}` },
      { desc: 'sequences (name)', path: `${url}/rest/v1/sequences?name=eq.${encodeURIComponent('Smoke Sequence')}` },
      { desc: 'tasks (title)', path: `${url}/rest/v1/tasks?title=eq.${encodeURIComponent('Smoke task')}` },
      { desc: 'templates (name)', path: `${url}/rest/v1/templates?name=eq.${encodeURIComponent('Smoke Template')}` },
      { desc: 'campaigns (name)', path: `${url}/rest/v1/campaigns?name=eq.${encodeURIComponent('Smoke Campaign')}` },
      { desc: 'leads (notes)', path: `${url}/rest/v1/leads?notes=eq.${encodeURIComponent('smoke lead')}` },
      { desc: 'leads (email like lead+)', path: `${url}/rest/v1/leads?email=like.${encodeURIComponent('lead+%')}` },
      { desc: 'user_api_keys (label)', path: `${url}/rest/v1/user_api_keys?label=eq.${encodeURIComponent('test-insert')}` },
    ];

    for (const d of deletes) {
      const res = await requestJson('DELETE', d.path, null, { ...headers, Prefer: 'return=representation' });
      console.log(d.desc, '->', res.status);
      if (res.body && Object.keys(res.body).length) console.log('  returned:', JSON.stringify(res.body));
    }

    // Now find auth users with smoke/test emails and delete them
    console.log('Looking up auth users to remove smoke/test accounts...');
    const usersRes = await requestJson('GET', `${url}/auth/v1/admin/users`, null, headers);
    if (!usersRes.status || usersRes.status >= 400) {
      console.error('Failed to list users', usersRes.body);
    } else {
      const users = Array.isArray(usersRes.body) ? usersRes.body : [];
      const toDelete = users.filter(u => {
        if (!u.email) return false;
        return /^smoke-run-|^smoketest\+|^test\+bot-|smoketest@|smoke-run@/.test(u.email) || /smoketest\+|smoke-run-|test\+bot-/.test(u.email);
      });
      console.log('Found', toDelete.length, 'candidate users');
      for (const u of toDelete) {
        const del = await requestJson('DELETE', `${url}/auth/v1/admin/users/${u.id}`, null, headers);
        console.log('deleted user', u.email, '->', del.status);
      }
    }

    console.log('Cleanup complete. Note: verify DB to confirm deletions.');
  } catch (err) {
    console.error('Error during cleanup:', err.message || err);
    process.exit(2);
  }
}

main();
