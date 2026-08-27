import { supabase } from './supabase';
import { useLogisticsStore } from '../store/useLogisticsStore';

const CHANNEL_NAME = 'customer-orders-realtime-channel';

let orderChannel: any = null;

export function initCustomerOrdersRealtime() {
  if (orderChannel) return orderChannel;

  orderChannel = supabase.channel(CHANNEL_NAME, {
    config: { broadcast: { self: true } }
  });

  orderChannel
    .on('broadcast', { event: 'orders-updated' }, ({ payload }: { payload: any[] }) => {
      if (Array.isArray(payload)) {
        useLogisticsStore.setState({ customerDeliveryRequests: payload });
        try {
          localStorage.setItem('fm_customer_delivery_requests', JSON.stringify(payload));
        } catch (e) {}
      }
    })
    .subscribe();

  return orderChannel;
}

export function broadcastCustomerOrders(updatedOrders: any[]) {
  if (!Array.isArray(updatedOrders)) return;

  // 1. Estado local e instantáneo en 0ms
  useLogisticsStore.setState({ customerDeliveryRequests: updatedOrders });
  try {
    localStorage.setItem('fm_customer_delivery_requests', JSON.stringify(updatedOrders));
  } catch (e) {}

  // 2. Transmitir por WebSocket Realtime en <30ms a todos los clientes y vendedores
  if (!orderChannel) {
    initCustomerOrdersRealtime();
  }

  if (orderChannel) {
    orderChannel.send({
      type: 'broadcast',
      event: 'orders-updated',
      payload: updatedOrders
    }).catch(() => {});
  }
}
