const testPayload = {
  event: "order_created",
  order: {
    id: "TEST-VERIFY-002",
    customer_name: "Test Verificación Auto",
    customer_phone: "3001234567",
    delivery_address: "Calle 1 #2-3, Bogotá",
    total_amount: 35000,
    payment_method: "Efectivo",
    status: "PENDING",
    items: [
      { name: "Hamburguesa Clásica", qty: 2, price: 12500 },
      { name: "Papas Fritas", qty: 1, price: 10000 }
    ]
  }
};

async function testWebhook() {
  const url = "https://uevcotmnffftoelscjua.supabase.co/functions/v1/olaclick-webhook";
  console.log("Enviando test al webhook...");
  
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": "FritaOlaClickSecret2026!"
    },
    body: JSON.stringify(testPayload)
  });
  
  console.log("Status:", res.status);
  const data = await res.json();
  console.log("Response:", JSON.stringify(data, null, 2));
}

testWebhook().catch(err => console.error("Error:", err));
