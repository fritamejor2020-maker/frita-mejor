#!/usr/bin/env node
// ============================================================
// Re-process existing OlaClick orders:
// 1. Fetch orders from OlaClick API (2026-07-01 to 2026-07-02)
// 2. For each order, fetch detail via GET /v1/orders/{id}
// 3. Update the corresponding row in olaclick_orders with correct data
// ============================================================

const OLACLICK_TOKEN = 'olk_live_RBFel5KDYFolrmabF6p5DOgp1FgAOB9j';
const SUPABASE_URL = 'https://uevcotmnffftoelscjua.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVldmNvdG1uZmZmdG9lbHNjanVhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTY1OTc2MywiZXhwIjoyMDkxMjM1NzYzfQ.p25GdMYJXKxa725L5y95Jslp_lrBdA2927v16KEExyQ';
const OLACLICK_API = 'https://api.olaclick.com';

async function fetchWithRetry(url, options, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }
      return await res.json();
    } catch (err) {
      console.error(`  Attempt ${i + 1} failed for ${url}: ${err.message}`);
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

function mapStatus(olaStatus) {
  const s = (olaStatus || '').toUpperCase();
  if (s === 'CANCELLED' || s === 'REJECTED') return 'REJECTED';
  if (s === 'PREPARING' || s === 'COMPLETED' || s === 'CONFIRMED' || s === 'ACCEPTED') return 'ACCEPTED';
  return 'PENDING';
}

function normalizeOrder(order) {
  const customerName = order.client?.name || 'Cliente OlaClick';
  const customerPhone = order.client?.phone || '';
  const addressArea = order.address?.area || '';
  const addressCity = order.address?.city || '';
  const deliveryAddress = [addressArea, addressCity].filter(Boolean).join(', ') || '';
  const totalAmount = Math.round(Number(order.total || 0));
  const deliveryPrice = Math.round(Number(order.delivery_price || 0));
  const serviceType = order.service_type || 'DELIVERY';
  const paymentMethod = order.service_type || 'No especificado';

  const combos = order.combos || [];
  const normalizedItems = combos.map(item => ({
    productId: String(item.product_id || item.id || ''),
    name: String(item.product_name || 'Producto'),
    price: Math.round(Number(item.combo_price || item.variant_price || 0)),
    qty: Math.max(1, Number(item.quantity || 1)),
    note: String(item.comment || ''),
    sku: item.sku || null,
    category: item.product_category_name || '',
    modifiers: item.modifiers || [],
    variantName: item.variant_name || null,
  }));

  return {
    id: order.id,
    public_id: order.public_id || '',
    customer_name: customerName,
    customer_phone: customerPhone,
    delivery_address: deliveryAddress,
    items: normalizedItems,
    total_amount: totalAmount,
    delivery_price: deliveryPrice,
    service_type: serviceType,
    payment_method: paymentMethod,
    status: mapStatus(order.status),
    raw_payload: { event_type: 'REPROCESSED', data: order },
    updated_at: new Date().toISOString(),
  };
}

async function supabaseUpsert(orderData) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/olaclick_orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Prefer': 'resolution=merge-duplicates',
    },
    body: JSON.stringify(orderData),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase upsert failed: ${res.status} ${text}`);
  }
  return true;
}

async function main() {
  console.log('=== Re-processing OlaClick orders ===\n');

  // Step 1: Fetch orders list from OlaClick
  console.log('Fetching orders from OlaClick API (2026-07-01 to 2026-07-02)...');
  
  let allOrders = [];
  let page = 1;
  const perPage = 50;

  while (true) {
    const url = `${OLACLICK_API}/v1/orders?start_date=2026-07-01&end_date=2026-07-02&page=${page}&per_page=${perPage}`;
    console.log(`  Fetching page ${page}: ${url}`);
    
    try {
      const result = await fetchWithRetry(url, {
        headers: {
          'Authorization': `Bearer ${OLACLICK_TOKEN}`,
          'Accept': 'application/json',
        },
      });

      const orders = result.data || result.orders || result || [];
      if (!Array.isArray(orders) || orders.length === 0) {
        console.log(`  No more orders on page ${page}.`);
        break;
      }

      allOrders = allOrders.concat(orders);
      console.log(`  Got ${orders.length} orders on page ${page}. Total so far: ${allOrders.length}`);

      // If we got fewer than perPage, we've reached the last page
      if (orders.length < perPage) break;
      page++;
    } catch (err) {
      console.error(`  Error fetching page ${page}: ${err.message}`);
      break;
    }
  }

  console.log(`\nTotal orders found: ${allOrders.length}\n`);

  if (allOrders.length === 0) {
    // Fallback: try fetching existing orders from Supabase and re-fetch them individually
    console.log('No orders from list endpoint. Trying to fetch existing order IDs from Supabase...');
    
    const sbRes = await fetch(`${SUPABASE_URL}/rest/v1/olaclick_orders?select=id`, {
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      },
    });

    if (sbRes.ok) {
      const existing = await sbRes.json();
      console.log(`Found ${existing.length} existing orders in Supabase.`);
      
      for (const row of existing) {
        allOrders.push({ id: row.id });
      }
    }
  }

  // Step 2 & 3: For each order, fetch detail and update
  let successCount = 0;
  let errorCount = 0;

  for (const orderSummary of allOrders) {
    const oid = orderSummary.id;
    console.log(`Processing order ${oid}...`);

    try {
      // Fetch full order detail
      const detail = await fetchWithRetry(`${OLACLICK_API}/v1/orders/${oid}`, {
        headers: {
          'Authorization': `Bearer ${OLACLICK_TOKEN}`,
          'Accept': 'application/json',
        },
      });

      // The detail response might wrap in { data: ... }
      const orderDetail = detail.data || detail;
      console.log(`  Order ${oid}: public_id=${orderDetail.public_id}, status=${orderDetail.status}, total=${orderDetail.total}`);

      // Normalize and upsert
      const normalized = normalizeOrder(orderDetail);
      await supabaseUpsert(normalized);
      console.log(`  ✓ Order ${oid} updated successfully.`);
      successCount++;
    } catch (err) {
      console.error(`  ✗ Error processing order ${oid}: ${err.message}`);
      errorCount++;
    }

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`\n=== Done ===`);
  console.log(`Success: ${successCount}, Errors: ${errorCount}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
