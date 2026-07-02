import { createClient } from '@supabase/supabase-js';

const OLACLICK_TOKEN = "olk_live_RBFel5KDYFolrmabF6p5DOgp1FgAOB9j";
const supabaseUrl = 'https://uevcotmnffftoelscjua.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3OiOiJzdXBhYmFzZSIsInJlZiI6InVldmNvdG1uZmZmdG9lbHNjanVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTk3NjMsImV4cCI6MjA5MTIzNTc2M30.c8q811qfvwOvenGk4mwt1HVTBsD7cPYiTM-2orqz3pM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function reprocessOrders() {
  const { data: dbOrders, error } = await supabase.from('olaclick_orders').select('id');
  if (error) {
    console.error("Error fetching from DB:", error);
    return;
  }

  console.log(`Found ${dbOrders.length} orders in DB to reprocess with dual keys\n`);

  for (const dbOrder of dbOrders) {
    try {
      const olaRes = await fetch(`https://public-api.olaclick.app/v1/orders/${dbOrder.id}`, {
        headers: { "Authorization": `Bearer ${OLACLICK_TOKEN}` }
      });
      
      if (olaRes.status !== 200) {
        console.log(`  ❌ ${dbOrder.id}: OlaClick API returned ${olaRes.status}`);
        continue;
      }
      
      const { data: order } = await olaRes.json();
      
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

      let localStatus = 'PENDING';
      const olaStatus = (order.status || '').toUpperCase();
      if (olaStatus === 'CANCELLED' || olaStatus === 'REJECTED') localStatus = 'REJECTED';
      else if (olaStatus === 'PREPARING' || olaStatus === 'CONFIRMED' || olaStatus === 'COMPLETED') localStatus = 'ACCEPTED';

      const updateData = {
        customer_name: order.client?.name || 'Cliente OlaClick',
        customer_phone: order.client?.phone || '',
        delivery_address: [order.address?.area, order.address?.city].filter(Boolean).join(', ') || '',
        items: normalizedItems,
        total_amount: order.total || 0,
        payment_method: order.service_type || 'No especificado',
        status: localStatus,
        public_id: order.public_id || '',
        delivery_price: order.delivery_price || 0,
        service_type: order.service_type || 'DELIVERY',
        updated_at: new Date().toISOString()
      };

      const { error: updErr } = await supabase
        .from('olaclick_orders')
        .update(updateData)
        .eq('id', dbOrder.id);

      if (updErr) {
        console.error(`  ❌ Error updating ${dbOrder.id}:`, updErr.message);
      } else {
        console.log(`  ✅ ${order.public_id} (${order.client?.name}) - ${normalizedItems.length} items updated`);
      }
    } catch (err) {
      console.error(`  ❌ ${dbOrder.id}: ${err.message}`);
    }
  }

  console.log('\n✅ Dual-key Reprocessing complete!');
}

reprocessOrders();
