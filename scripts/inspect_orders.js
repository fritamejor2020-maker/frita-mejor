// Inspect real OlaClick orders in the database
async function inspectOrders() {
  const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVldmNvdG1uZmZmdG9lbHNjanVhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTY1OTc2MywiZXhwIjoyMDkxMjM1NzYzfQ.p25GdMYJXKxa725L5y95Jslp_lrBdA2927v16KEExyQ';
  
  const res = await fetch('https://uevcotmnffftoelscjua.supabase.co/rest/v1/olaclick_orders?order=created_at.desc&limit=5', {
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`
    }
  });
  
  const data = await res.json();
  console.log("=== PEDIDOS REALES EN DB ===");
  console.log(JSON.stringify(data, null, 2));
}

inspectOrders();
