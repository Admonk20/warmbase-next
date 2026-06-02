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

async function checkOpenAI(key) {
  return new Promise((resolve) => {
    const opts = new URL('https://api.openai.com/v1/models');
    const req = https.request({ hostname: opts.hostname, path: opts.pathname, method: 'GET', headers: { Authorization: `Bearer ${key}` } }, (res) => {
      resolve({ status: res.statusCode });
    });
    req.on('error', () => resolve({ status: 0 }));
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

  const needed = [
    'SMTP_HOST','SMTP_PORT','SMTP_USER','SMTP_PASS',
    'IMAP_HOST','IMAP_PORT','IMAP_USER','IMAP_PASS',
    'OPENAI_API_KEY'
  ];

  const present = {};
  for (const k of needed) present[k] = !!env[k];

  console.log('Provider E2E check (will only run tests when credentials exist)');
  for (const k of Object.keys(present)) console.log(`${k}: ${present[k] ? 'present' : 'MISSING'}`);

  if (!present.OPENAI_API_KEY && !present.SMTP_HOST && !present.IMAP_HOST) {
    console.log('\nNo provider credentials found in .env. To run E2E tests, add credentials to .env:');
    console.log(' - SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS');
    console.log(' - IMAP_HOST, IMAP_PORT, IMAP_USER, IMAP_PASS');
    console.log(' - OPENAI_API_KEY');
    process.exit(0);
  }

  if (present.OPENAI_API_KEY) {
    console.log('\nTesting OpenAI auth...');
    const res = await checkOpenAI(env.OPENAI_API_KEY);
    console.log('OpenAI API status:', res.status);
  }

  // SMTP/IMAP checks would go here; currently only reporting presence.
  if (present.SMTP_HOST) console.log('SMTP credentials present — you can run a send test with your provider.');
  if (present.IMAP_HOST) console.log('IMAP credentials present — you can run mailbox checks with IMAP client.');

  console.log('\nProvider E2E checks finished (partial). Provide credentials to run full tests.');
}

main();
