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

  const email = `smoke-run-${Date.now()}@example.com`;
  const password = 'TestPass123!';

  try {
    const createUser = await requestJson('POST', `${url}/auth/v1/admin/users`, { email, password, user_metadata: { full_name: 'Smoke Runner' } }, {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    });
    if (!createUser.status || createUser.status >= 400) {
      console.error('create user failed', JSON.stringify(createUser.body, null, 2));
      process.exit(2);
    }
    const userId = createUser.body.id;
    console.log('created_user', { email, userId });

    // Insert lead
    const leadRes = await requestJson('POST', `${url}/rest/v1/leads`, [{ user_id: userId, contact: 'ACME Inc', company: 'ACME Inc', title: 'CTO', email: `lead+${Date.now()}@example.com`, notes: 'smoke lead' }], {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Prefer: 'return=representation',
    });
    if (!leadRes.status || leadRes.status >= 400) {
      console.error('lead insert failed', leadRes.body);
      process.exit(3);
    }
    const lead = Array.isArray(leadRes.body) ? leadRes.body[0] : leadRes.body;
    console.log('inserted_lead', lead.id || lead);

    // Insert template
    const tplRes = await requestJson('POST', `${url}/rest/v1/templates`, [{ user_id: userId, name: 'Smoke Template', subject: 'Hello {{name}}', body: 'This is a test template' }], {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Prefer: 'return=representation',
    });
    if (!tplRes.status || tplRes.status >= 400) {
      console.error('template insert failed', tplRes.body);
      process.exit(4);
    }
    const template = Array.isArray(tplRes.body) ? tplRes.body[0] : tplRes.body;
    console.log('inserted_template', template.id || template);

    // Insert campaign
    const campRes = await requestJson('POST', `${url}/rest/v1/campaigns`, [{ user_id: userId, name: 'Smoke Campaign', description: 'Smoke test campaign' }], {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Prefer: 'return=representation',
    });
    if (!campRes.status || campRes.status >= 400) {
      console.error('campaign insert failed', campRes.body);
      process.exit(5);
    }
    const campaign = Array.isArray(campRes.body) ? campRes.body[0] : campRes.body;
    console.log('inserted_campaign', campaign.id || campaign);

    // Insert sequence
    const seqRes = await requestJson('POST', `${url}/rest/v1/sequences`, [{ user_id: userId, name: 'Smoke Sequence', description: 'smoke seq' }], {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Prefer: 'return=representation',
    });
    if (!seqRes.status || seqRes.status >= 400) {
      console.error('sequence insert failed', seqRes.body);
      process.exit(6);
    }
    const sequence = Array.isArray(seqRes.body) ? seqRes.body[0] : seqRes.body;
    console.log('inserted_sequence', sequence.id || sequence);

    // Insert sequence step
    const stepRes = await requestJson('POST', `${url}/rest/v1/sequence_steps`, [{ sequence_id: sequence.id, user_id: userId, step_order: 1, delay_days: 0, subject: 'First step', body: 'Hello from smoke test' }], {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Prefer: 'return=representation',
    });
    if (!stepRes.status || stepRes.status >= 400) {
      console.error('sequence step insert failed', stepRes.body);
      process.exit(7);
    }
    const step = Array.isArray(stepRes.body) ? stepRes.body[0] : stepRes.body;
    console.log('inserted_sequence_step', step.id || step);

    // Insert task linked to lead
    const taskRes = await requestJson('POST', `${url}/rest/v1/tasks`, [{ user_id: userId, lead_id: lead.id || lead, title: 'Smoke task', notes: 'Do something', priority: 1 }], {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Prefer: 'return=representation',
    });
    if (!taskRes.status || taskRes.status >= 400) {
      console.error('task insert failed', taskRes.body);
      process.exit(8);
    }
    const task = Array.isArray(taskRes.body) ? taskRes.body[0] : taskRes.body;
    console.log('inserted_task', task.id || task);

    console.log('smoke inserts complete');
    console.log(JSON.stringify({ userId, lead: lead.id || lead, template: template.id || template, campaign: campaign.id || campaign, sequence: sequence.id || sequence, step: step.id || step, task: task.id || task }));
  } catch (err) {
    console.error('error', err.message || err);
    process.exit(99);
  }
}

main();
