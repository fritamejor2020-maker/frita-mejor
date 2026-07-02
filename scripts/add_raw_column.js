// Temporary: Add a raw_payload column to capture actual OlaClick payloads
async function addRawPayloadColumn() {
  const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVldmNvdG1uZmZmdG9lbHNjanVhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTY1OTc2MywiZXhwIjoyMDkxMjM1NzYzfQ.p25GdMYJXKxa725L5y95Jslp_lrBdA2927v16KEExyQ';
  
  // Use the SQL endpoint to add a raw_payload JSONB column
  const res = await fetch('https://uevcotmnffftoelscjua.supabase.co/rest/v1/rpc/execute_sql', {
    method: 'POST',
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: "ALTER TABLE olaclick_orders ADD COLUMN IF NOT EXISTS raw_payload JSONB;"
    })
  });
  
  console.log("Add column status:", res.status);
  const text = await res.text();
  console.log("Response:", text);
}

addRawPayloadColumn();
