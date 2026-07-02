const OLACLICK_TOKEN = "olk_live_RBFel5KDYFolrmabF6p5DOgp1FgAOB9j";

async function testStatusUpdateAPI() {
  const orderId = "a229ab42-77ec-4dfa-a28b-e1f26e611a60";
  console.log(`Testing status update API on OlaClick for order ${orderId}...\n`);

  // Try PATCH /v1/orders/{id}
  const patchRes = await fetch(`https://public-api.olaclick.app/v1/orders/${orderId}`, {
    method: "PATCH",
    headers: {
      "Authorization": `Bearer ${OLACLICK_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      status: "PREPARING"
    })
  });

  console.log("PATCH /v1/orders/{id} status:", patchRes.status);
  const patchText = await patchRes.text();
  console.log("PATCH response:", patchText);

  // Try POST /v1/orders/{id}/status if PATCH fails
  if (patchRes.status !== 200) {
    const postRes = await fetch(`https://public-api.olaclick.app/v1/orders/${orderId}/status`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OLACLICK_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        status: "PREPARING"
      })
    });
    console.log("POST /v1/orders/{id}/status status:", postRes.status);
    const postText = await postRes.text();
    console.log("POST response:", postText);
  }
}

testStatusUpdateAPI().catch(err => console.error("Error:", err));
