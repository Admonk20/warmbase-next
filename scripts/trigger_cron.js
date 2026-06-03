import http from 'http';

function trigger() {
  console.log("Triggering local autonomous cron endpoint...");
  const options = {
    hostname: 'localhost',
    port: 5173,
    path: '/api/public/cron/autonomous',
    method: 'GET',
    headers: {
      'x-cron-key': 'local_test_secret_123'
    }
  };

  const req = http.request(options, (res) => {
    let body = '';
    console.log("Status:", res.statusCode);
    res.on('data', (c) => body += c);
    res.on('end', () => {
      console.log("Body:", body);
    });
  });

  req.on('error', (err) => {
    console.error("Error:", err.message);
  });

  req.end();
}

trigger();
