import { createClient } from '@supabase/supabase-js';

const OLACLICK_TOKEN = "olk_live_XP5SLjB...Uc88"; // or olk_live_RBFel5KDYFolrmabF6p5DOgp1FgAOB9j
const TOKEN_TO_USE = "olk_live_RBFel5KDYFolrmabF6p5DOgp1FgAOB9j";
const supabaseUrl = 'https://uevcotmnffftoelscjua.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVldmNvdG1uZmZmdG9lbHNjanVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTk3NjMsImV4cCI6MjA5MTIzNTc2M30.c8q811qfvwOvenGk4mwt1HVTBsD7cPYiTM-2orqz3pM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function syncAllPending() {
  console.log("Consultando TODOS los pedidos PENDING desde OlaClick API...\n");
  
  // Query pending orders from 2026-05-01 to 2026-07-05
  const url = `https://public-api.olaclick.app/v1/orders?filter[start_date]=2026-05-01&filter[end_date]=2026-07-05&filter[status]=PENDING&page[size]=100`;
  
  const olaRes = await fetch(url, {
    headers: { "Authorization": `Bearer ${TOKEN_TO_USE}` }
  });

  console.log("OlaClick API Status:", olaRes.status);
  const olaData = await olaRes.json();
  
  const ordersList = olaData.data || [];
  console.log(`Encontrados ${ordersList.length} pedidos PENDING en OlaClick!\n`);

  for (const simpleOrder of ordersList) {
    try {
      // Fetch full order detail to get combos/items
      const detailRes = await fetch(`https://public-api.olaclick.app/v1/orders/${simpleOrder.id}`, {
        headers: { "Authorization": `Bearer ${TOKEN_TO_USE}` }
      });
      
      const { data: order } = await detailRes.json();
      if (!order) continue;

      const normalizedItems = (order.combos || []).map(combo => {
        const name = combo.product_name || combo.name || 'Producto';
        const qty = combo.quantity || combo.qty || 1;
        const price = combo.combo_price || combo.variant_price || combo.price || 0;
        const note = combo.comment || combo.note || '';

        return {
          productId: combo.product_id || combo.id || '',
          product_id: combo.product_id || combo.id || '',
          name: name,
          product_name: name,
          qty: qty,
          quantity: qty,
          price: price,
          combo_price: price,
          variant_price: combo.variant_price || price,
          note: note,
          comment: note,
          product_category_name: combo.product_category_name || '',
          sku: combo.sku || null,
          modifiers: combo.modifiers || []
        };
      });

      const orderData = {
        id: order.id,
        public_id: order.public_id || '',
        customer_name: order.client?.name || 'Cliente OlaClick',
        customer_phone: order.client?.phone || '',
        delivery_address: [order.address?.area, order.address?.city].filter(Boolean).join(', ') || '',
        items: normalizedItems,
        total_amount: order.total || 0,
        delivery_price: order.delivery_price || 0,
        service_type: order.service_type || 'DELIVERY',
        payment_method: order.service_type || 'No especificado',
        store_id: '',
        status: 'PENDING',
        updated_at: new Date().toISOString()
      };

      const { data: upsertData, error: upsertErr } = await supabase
        .from('olaclick_orders')
        .upsert(orderData, { onConflict: 'id' })
        .select();

      if (upsertErr) {
        console.error(`  ❌ Error insertando ${order.public_id}:`, upsertErr.message);
      } else {
        console.log(`  ✅ Insertado/Sincronizado: ${order.public_id} (${order.client?.name}) - $${order.total}`);
      }
    } catch (e) {
      console.error("  ❌ Error:", e.message);
    }
  }

  console.log("\n✅ Sincronización completa de pendientes!");
}

syncAllPending();
