const OLACLICK_TOKEN = "olk_live_RBFel5KDYFolrmabF6p5DOgp1FgAOB9j";

async function testAllEndpoints() {
  const orderId = "a229ab42-77ec-4dfa-a28b-e1f26e611a60";
  
  const endpoints = [
    { method: "PUT", url: `https://public-api.olaclick.app/v1/orders/${orderId}`, body: { status: "PREPARING" } },
    { method: "PUT", url: `https://public-api.olaclick.app/v1/orders/${orderId}`, body: { status: "ACCEPTED" } },
    { method: "PATCH", url: `https://public-api.olaclick.app/v1/orders/${orderId}`, body: { status: "PREPARING" } },
    { method: "POST", url: `https://public-api.olaclick.app/v1/orders/${orderId}/accept`, body: {} },
    { method: "POST", url: `https://public-api.olaclick.app/v1/orders/${orderId}/preparing`, body: {} },
    { method: "PUT", url: `https://public-api.olaclick.app/v1/orders/${orderId}/status`, body: { status: "PREPARING" } },
    { method: "PATCH", url: `https://public-api.olaclick.app/v1/orders/${orderId}/status`, body: { status: "PREPARING" } },
  ];

  for (const ep of endpoints) {
    try {
      const res = await fetch(ep.url, {
        method: ep.method,
        headers: {
          "Authorization": `Bearer ${OLACLICK_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(ep.body)
      });
      const text = await res.text();
      console.log(`${ep.method} ${ep.url} => Status: ${res.status}`);
      console.log(`Response: ${text.substring(0, 150)}\n`);
    } catch (e) {
      console.error(`Error on ${ep.method} ${ep.url}:`, e.message);
    }
  }
}

testAllEndpoints();
