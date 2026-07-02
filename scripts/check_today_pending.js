const OLACLICK_TOKEN = "olk_live_RBFel5KDYFolrmabF6p5DOgp1FgAOB9j";

async function checkTodayPending() {
  const today = new Date().toISOString().split('T')[0];
  console.log(`Checking OlaClick API orders for today (${today})...\n`);

  const url = `https://public-api.olaclick.app/v1/orders?filter[start_date]=${today}&filter[end_date]=${today}&filter[status]=PENDING`;
  const res = await fetch(url, {
    headers: { "Authorization": `Bearer ${OLACLICK_TOKEN}` }
  });

  console.log("Status:", res.status);
  const data = await res.json();
  console.log("=== LIVE PENDING ORDERS TODAY FROM OLACLICK ===");
  console.log(JSON.stringify(data, null, 2));
}

checkTodayPending();
