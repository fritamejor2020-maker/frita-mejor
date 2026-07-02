async function deleteOrders() {
  const url = 'https://uevcotmnffftoelscjua.supabase.co/rest/v1/olaclick_orders?or=(id.eq.OLA-TEST-999,id.eq.TEST-VERIFY-002)';
  const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVldmNvdG1uZmZmdG9lbHNjanVhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTY1OTc2MywiZXhwIjoyMDkxMjM1NzYzfQ.p25GdMYJXKxa725L5y95Jslp_lrBdA2927v16KEExyQ';
  
  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Prefer': 'return=representation'
    }
  });
  
  console.log('Status:', res.status);
  const text = await res.text();
  console.log('Resultado:', text);
}

deleteOrders();
