const OLACLICK_TOKEN = "olk_live_RBFel5KDYFolrmabF6p5DOgp1FgAOB9j";

async function fetchOrderDetail() {
  // Get a single order with full details
  const orderId = "a228a5eb-03b4-4b9e-a745-fff3c97de7fc";
  
  const res = await fetch(`https://public-api.olaclick.app/v1/orders/${orderId}`, {
    headers: { "Authorization": `Bearer ${OLACLICK_TOKEN}` }
  });
  
  console.log("Status:", res.status);
  const data = await res.json();
  console.log("=== DETALLE COMPLETO DE UN PEDIDO ===");
  console.log(JSON.stringify(data, null, 2));
}

fetchOrderDetail().catch(err => console.error("Error:", err));
