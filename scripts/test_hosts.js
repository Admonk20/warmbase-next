import https from 'https';

const hosts = [
  'db.oxhfbzzyvqmjeuhaozvk.supabase.co',
  'oxhfbzzyvqmjeuhaozvk.supabase.co'
];

async function checkHost(host) {
  return new Promise((resolve) => {
    console.log(`Checking https://${host}/rest/v1/ ...`);
    const options = {
      hostname: host,
      path: '/rest/v1/',
      method: 'GET',
      timeout: 5000
    };
    const req = https.request(options, (res) => {
      console.log(`[${host}] Status:`, res.statusCode);
      resolve(res.statusCode);
    });
    req.on('error', (err) => {
      console.log(`[${host}] Error:`, err.message);
      resolve(null);
    });
    req.on('timeout', () => {
      console.log(`[${host}] Timeout`);
      req.destroy();
      resolve(null);
    });
    req.end();
  });
}

async function run() {
  for (const host of hosts) {
    await checkHost(host);
  }
}

run();
