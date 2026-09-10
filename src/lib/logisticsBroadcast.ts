import { supabase } from './supabase';
import { useLogisticsStore } from '../store/useLogisticsStore';

const CHANNEL_NAME = 'dejador-vendedor-logistics-channel';

let logisticsChannel: any = null;

export function initLogisticsRealtime() {
  if (logisticsChannel) return logisticsChannel;

  logisticsChannel = supabase.channel(CHANNEL_NAME, {
    config: { broadcast: { self: false } }
  });

  logisticsChannel
    .on('broadcast', { event: 'logistics-updated' }, ({ payload }: { payload: any }) => {
      if (payload && typeof payload === 'object') {
        const { pendingRequests, completedRequests, rejectedRequests, loadHistory } = payload;
        const updates: any = {};
        if (Array.isArray(pendingRequests)) updates.pendingRequests = pendingRequests;
        if (Array.isArray(completedRequests)) updates.completedRequests = completedRequests;
        if (Array.isArray(rejectedRequests)) updates.rejectedRequests = rejectedRequests;
        if (Array.isArray(loadHistory)) updates.loadHistory = loadHistory;

        if (Object.keys(updates).length > 0) {
          useLogisticsStore.setState(updates);
        }
      }
    })
    .subscribe();

  return logisticsChannel;
}

export function broadcastLogisticsUpdate(payload: {
  pendingRequests?: any[];
  completedRequests?: any[];
  rejectedRequests?: any[];
  loadHistory?: any[];
}) {
  if (!logisticsChannel) {
    initLogisticsRealtime();
  }

  if (logisticsChannel) {
    logisticsChannel.send({
      type: 'broadcast',
      event: 'logistics-updated',
      payload
    }).catch(() => {});
  }
}
