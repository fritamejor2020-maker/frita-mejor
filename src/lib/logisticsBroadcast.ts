import { supabase } from './supabase';
import { useLogisticsStore } from '../store/useLogisticsStore';

const CHANNEL_NAME = 'dejador-vendedor-logistics-channel';

let logisticsChannel: any = null;

type ListKey = 'pendingRequests' | 'completedRequests' | 'rejectedRequests' | 'loadHistory';

interface LogisticsDelta {
  upserts?: Partial<Record<ListKey, any[]>>;
  removedIds?: Partial<Record<'pendingRequests' | 'completedRequests' | 'rejectedRequests', string[]>>;
}

function mergeList(local: any[] | undefined, upserts?: any[], removedIds?: string[]): any[] {
  const map = new Map<string, any>();
  (local || []).forEach((i) => { if (i?.id) map.set(i.id, i); });
  (removedIds || []).forEach((id) => map.delete(id));
  (upserts || []).forEach((i) => { if (i?.id) map.set(i.id, i); });
  return Array.from(map.values());
}

export function initLogisticsRealtime() {
  if (logisticsChannel) return logisticsChannel;

  logisticsChannel = supabase.channel(CHANNEL_NAME, {
    config: { broadcast: { self: false } }
  });

  logisticsChannel
    .on('broadcast', { event: 'logistics-delta' }, ({ payload }: { payload: LogisticsDelta }) => {
      if (!payload || typeof payload !== 'object') return;
      const st = useLogisticsStore.getState();
      const up = payload.upserts || {};
      const rm = payload.removedIds || {};

      // Ids que pasaron a completed/rejected -> quitarlos de pending aunque el emisor no los liste
      const promotedFromPending = [
        ...(rm.pendingRequests || []),
        ...((up.completedRequests || []).map((r) => r?.id)),
        ...((up.rejectedRequests || []).map((r) => r?.id)),
      ].filter(Boolean) as string[];

      const updates: any = {};
      if (up.pendingRequests || promotedFromPending.length) {
        updates.pendingRequests = mergeList(st.pendingRequests, up.pendingRequests, promotedFromPending);
      }
      if (up.completedRequests || rm.completedRequests) {
        updates.completedRequests = mergeList(st.completedRequests, up.completedRequests, rm.completedRequests);
      }
      if (up.rejectedRequests || rm.rejectedRequests) {
        updates.rejectedRequests = mergeList(st.rejectedRequests, up.rejectedRequests, rm.rejectedRequests);
      }
      if (up.loadHistory) {
        updates.loadHistory = mergeList(st.loadHistory, up.loadHistory);
      }

      if (Object.keys(updates).length > 0) {
        useLogisticsStore.setState(updates);
      }
    })
    .subscribe();

  return logisticsChannel;
}

/**
 * Envía SOLO el delta (ítems agregados/cambiados + ids removidos). El receptor
 * fusiona con su estado local, así un broadcast nunca destruye la vista más
 * amplia de otro dispositivo (p. ej. el Dejador que ve todas las sedes).
 */
export function broadcastLogisticsDelta(delta: LogisticsDelta) {
  if (!logisticsChannel) initLogisticsRealtime();
  if (logisticsChannel) {
    logisticsChannel.send({
      type: 'broadcast',
      event: 'logistics-delta',
      payload: delta,
    }).catch(() => {});
  }
}
