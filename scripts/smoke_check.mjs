const url = 'http://localhost:5173/settings';
try {
  const res = await fetch(url);
  console.log('status', res.status);
  const text = await res.text();
  console.log('body length', text.length);
  console.log(text.slice(0, 1200));
} catch (err) {
  console.error('fetch error', err.message || err);
  process.exit(1);
}
