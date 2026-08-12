const url = 'https://viefdnbijxsasfdjpusb.supabase.co/functions/v1/networth-cron';
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

async function main() {
  console.log("Triggering networth-cron...");
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${anonKey}`
    },
    body: JSON.stringify({ time: new Date().toISOString() })
  });

  const text = await res.text();
  console.log("Response Status:", res.status);
  console.log("Response Body:", text);
}

main();
