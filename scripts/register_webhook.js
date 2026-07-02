// Register webhook on OlaClick API
// Docs: https://developers.olaclick.app/docs/webhooks

const OLACLICK_TOKEN = "olk_live_RBFel5KDYFolrmabF6p5DOgp1FgAOB9j";
const WEBHOOK_URL = "https://uevcotmnffftoelscjua.supabase.co/functions/v1/olaclick-webhook";

async function registerWebhook() {
  console.log("Registrando webhook en OlaClick API...");
  
  const res = await fetch("https://public-api.olaclick.app/v1/webhooks", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OLACLICK_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      webhook_url: WEBHOOK_URL,
      merchant_id: "frita-mejor",
      webhook_headers: {
        "x-api-key": "FritaOlaClickSecret2026!"
      },
      is_active: true,
      ack_http_codes: [200, 201, 202]
    })
  });
  
  console.log("Status:", res.status);
  const text = await res.text();
  console.log("Response:", text);
}

registerWebhook().catch(err => console.error("Error:", err));
