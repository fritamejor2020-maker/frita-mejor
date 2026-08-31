import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { push } from '../lib/syncManager';
import { markLocalWrite } from '../lib/useRealtimeSync';
import { useAuthStore } from './useAuthStore';
import { supabase } from '../lib/supabase';
import { safeJSONStorage } from '../utils/safeStorage';

/**
 * Store de Chat e Intercomunicador Radio (Vendedor <-> Dejador <-> Admin)
 * ──────────────────────────────────────────────────────────────────────────
 * Maneja:
 *  - Mensajes de Texto
 *  - Notas de Voz (Audios)
 *  - Fotografías de Comprobante / Ubicación
 *  - Registro y Señalización de Llamadas de Voz en tiempo real
 */

function syncChatMessages(messages, branchId) {
  const effectiveBranch = branchId || 'BRANCH-001';
  const capped = (messages || []).slice(0, 50);
  markLocalWrite('chatMessages', effectiveBranch);
  push('chatMessages', capped, effectiveBranch).catch(err =>
    console.warn('[Sync] chatMessages:', err.message)
  );
}

// Canal Global Supabase Realtime para recibir broadcasts instantáneos entre dispositivos
let realtimeChannel = null;

/** Returns the shared chat realtime channel (or null if not yet set up). */
export function getChatRealtimeChannel() {
  return realtimeChannel;
}

function handleCallSignalFromPayload(msg, set, get) {
  if (!msg || !msg.type) return;

  if (msg.type === 'call_signal_ringing') {
    try {
      const callData = typeof msg.text === 'string' && msg.text.startsWith('{') ? JSON.parse(msg.text) : null;
      if (callData && callData.startedAt) {
        const ageSec = Math.floor((Date.now() - new Date(callData.startedAt).getTime()) / 1000);
        if (ageSec < 60) {
          set({ activeCall: callData });
        }
      }
    } catch (_) {}
  } else if (msg.type === 'call_signal_connected') {
    try {
      const callData = typeof msg.text === 'string' && msg.text.startsWith('{') ? JSON.parse(msg.text) : null;
      if (callData) {
        set({ activeCall: { ...callData, status: 'connected' } });
      }
    } catch (_) {}
  } else if (msg.type === 'call_signal_ended') {
    set({ activeCall: null });
  }
}

function setupChatRealtime(set, get) {
  if (typeof window === 'undefined' || realtimeChannel) return;
  try {
    realtimeChannel = supabase.channel('public_chat_channel', {
      config: { broadcast: { self: true } },
    });
    
    realtimeChannel
      .on('broadcast', { event: 'new_chat_message' }, ({ payload }) => {
        if (!payload || !payload.id) return;
        const currentMsgs = get().messages || [];
        if (!currentMsgs.some(m => m.id === payload.id)) {
          set({ messages: [payload, ...currentMsgs].slice(0, 50) });
          handleCallSignalFromPayload(payload, set, get);
        }
      })
      .on('broadcast', { event: 'voice_call_signal' }, ({ payload }) => {
        if (payload) {
          if (payload.status === 'ended') {
            set({ activeCall: null });
          } else {
            set({ activeCall: payload });
          }
        }
      })
      .subscribe();
  } catch (err) {
    console.warn('[ChatStore] Realtime setup error:', err);
  }
}

// ─── Helpers de Jornada y Fecha para Aislamiento de Chat ──────────────────────
export function getMessageJornada(isoString) {
  if (!isoString) return 'AM';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return 'AM';
  const totalMinutes = d.getHours() * 60 + d.getMinutes();
  return totalMinutes < 750 ? 'AM' : 'PM'; // Corte 12:30 PM (750 min)
}

export function getMessageDate(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getCurrentJornada() {
  const now = new Date();
  return (now.getHours() * 60 + now.getMinutes()) < 750 ? 'AM' : 'PM';
}

export function getCurrentDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export const useChatStore = create(
  persist(
    (set, get) => {
      // Iniciar escucha en tiempo real inmediatamente
      setTimeout(() => setupChatRealtime(set, get), 100);

      return {
        messages: [],
        activeCall: null,

        /**
         * Envía un nuevo mensaje o nota de voz asociado a la fecha y jornada activa
         */
        sendMessage: ({ shiftId, branchId, senderId, senderName, senderRole, receiverId, receiverName, pointId, type, text, mediaUrl, durationSeconds, date, jornada }) => {
          const user = useAuthStore.getState().user;
          const effectiveBranch = branchId || user?.branchId || 'BRANCH-001';
          const now = new Date();
          const effectiveDate = date || getCurrentDate();
          const effectiveJornada = jornada || getCurrentJornada();

          const newMessage = {
            id: `MSG-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            shiftId: shiftId || 'shift-active',
            date: effectiveDate,
            jornada: effectiveJornada,
            branchId: effectiveBranch,
            senderId: senderId || user?.id || 'unknown',
            senderName: senderName || user?.name || 'Usuario',
            senderRole: senderRole || user?.role || 'OPERARIO',
            receiverId: receiverId || 'ALL',
            receiverName: receiverName || 'Todos',
            pointId: pointId || senderId || null,
            type: type || 'text',
            text: text?.trim() || '',
            mediaUrl: mediaUrl || null,
            durationSeconds: durationSeconds || 0,
            read: false,
            createdAt: now.toISOString(),
          };

          const updated = [newMessage, ...(get().messages || [])].slice(0, 50);
          set({ messages: updated });
          syncChatMessages(updated, effectiveBranch);

          // Transmitir por Supabase Broadcast en milisegundos a todos los conectados
          try {
            if (realtimeChannel) {
              realtimeChannel.send({
                type: 'broadcast',
                event: 'new_chat_message',
                payload: newMessage,
              }).catch(() => {});
            }
          } catch (_) {}

          return newMessage;
        },

        /**
         * Marca mensajes como leídos para un usuario al abrir un chat
         */
        markAsRead: (myUserId, targetUserId = null, targetDate = null, targetJornada = null) => {
          const myId = String(myUserId || '').toLowerCase();
          const cleanMyId = myId.replace(/[^a-z0-9]/g, '');
          const target = targetUserId ? String(targetUserId).toLowerCase() : null;
          const isDejador = myId === 'dejador' || cleanMyId === 'dejador';
          const todayDate = targetDate || getCurrentDate();
          const currentJornada = targetJornada || getCurrentJornada();
          let changed = false;

          const updated = (get().messages || []).map(m => {
            const readByList = Array.isArray(m.readBy) ? m.readBy : [];
            // Si ya fue marcado como leído por este usuario, no procesar de nuevo
            if (cleanMyId && (readByList.includes(cleanMyId) || readByList.includes(myId))) return m;

            // 🛡️ Solo marcar leídos los de la jornada activa
            const msgDate = m.date || getMessageDate(m.createdAt);
            const msgJornada = m.jornada || getMessageJornada(m.createdAt);
            if (msgDate !== todayDate || msgJornada !== currentJornada) {
              return m;
            }

            const sender = String(m.senderId || '').toLowerCase();
            const point = String(m.pointId || '').toLowerCase();
            const receiver = String(m.receiverId || '').toLowerCase();
            const cleanSender = sender.replace(/[^a-z0-9]/g, '');
            const cleanPoint = point.replace(/[^a-z0-9]/g, '');
            const cleanReceiver = receiver.replace(/[^a-z0-9]/g, '');

            // Ignorar mensajes propios
            if (sender === myId || point === myId || (cleanMyId && (cleanSender === cleanMyId || cleanPoint === cleanMyId))) return m;

            // Verificar si el mensaje era para mí o mi rol
            const isForMe =
              receiver === 'all' ||
              receiver === myId ||
              (cleanMyId && cleanReceiver === cleanMyId) ||
              (cleanMyId && cleanReceiver.includes(cleanMyId)) ||
              (cleanReceiver && cleanMyId.includes(cleanReceiver)) ||
              (isDejador && (receiver === 'dejador' || receiver === 'logistica'));

            if (!isForMe) return m;

            // Si se está viendo un canal/vehículo específico (ej: 't1', 't2')
            if (target && target !== 'all') {
              const cleanTarget = target.replace(/[^a-z0-9]/g, '');

              const matchesTarget = cleanSender === cleanTarget || 
                                    cleanPoint === cleanTarget || 
                                    cleanReceiver === cleanTarget ||
                                    (cleanTarget && cleanSender.includes(cleanTarget)) ||
                                    (cleanTarget && cleanPoint.includes(cleanTarget)) ||
                                    receiver === 'all';

              if (matchesTarget) {
                changed = true;
                const newReadBy = [...new Set([...readByList, cleanMyId, myId])];
                return { ...m, read: true, readBy: newReadBy };
              }
            } else {
              changed = true;
              const newReadBy = [...new Set([...readByList, cleanMyId, myId])];
              return { ...m, read: true, readBy: newReadBy };
            }

            return m;
          });

          if (changed) {
            set({ messages: updated });
            const user = useAuthStore.getState().user;
            syncChatMessages(updated, user?.branchId || 'BRANCH-001');
          }
        },

        /**
         * Retorna la cantidad de mensajes no leídos estrictamente para la jornada activa
         */
        getUnreadCount: (myUserId, fromUserId = null, activeShiftId = null, targetDate = null, targetJornada = null) => {
          const msgs = get().messages || [];
          const myId = String(myUserId || '').toLowerCase();
          const cleanMyId = myId.replace(/[^a-z0-9]/g, '');
          const isDejador = myId === 'dejador' || cleanMyId === 'dejador';
          const todayDate = targetDate || getCurrentDate();
          const currentJornada = targetJornada || getCurrentJornada();

          return msgs.filter(m => {
            const readByList = Array.isArray(m.readBy) ? m.readBy : [];
            if (cleanMyId && readByList.includes(cleanMyId)) return false;

            // 🛡️ REGLA ESTRICTA: Ignorar mensajes de días o jornadas anteriores
            const msgDate = m.date || getMessageDate(m.createdAt);
            if (msgDate !== todayDate) return false;

            const msgJornada = m.jornada || getMessageJornada(m.createdAt);
            if (msgJornada !== currentJornada) return false;

            // Si hay un shiftId activo estricto
            if (activeShiftId && activeShiftId !== 'shift-active' && m.shiftId && m.shiftId !== 'shift-active') {
              if (m.shiftId !== activeShiftId) return false;
            }

            const sender = String(m.senderId || '').toLowerCase();
            const point = String(m.pointId || '').toLowerCase();
            const receiver = String(m.receiverId || '').toLowerCase();
            const cleanSender = sender.replace(/[^a-z0-9]/g, '');
            const cleanPoint = point.replace(/[^a-z0-9]/g, '');
            const cleanReceiver = receiver.replace(/[^a-z0-9]/g, '');

            // Descartar mensajes propios
            if (sender === myId || point === myId || (cleanMyId && cleanSender === cleanMyId) || (cleanMyId && cleanPoint === cleanMyId)) return false;

            // Verificar si el destinatario es para mí o mi rol
            const isForMe =
              receiver === 'all' ||
              receiver === myId ||
              (cleanMyId && cleanReceiver === cleanMyId) ||
              (cleanMyId && cleanReceiver.includes(cleanMyId)) ||
              (cleanReceiver && cleanMyId.includes(cleanReceiver)) ||
              (isDejador && (receiver === 'dejador' || receiver === 'logistica'));

            if (!isForMe) return false;

            // Si se filtra por Canal General ('ALL')
            if (fromUserId === 'ALL') {
              return receiver === 'all';
            }

            // Si se filtra por un vehículo específico (ej: 'T1', 'T2')
            if (fromUserId) {
              const target = String(fromUserId).toLowerCase();
              const cleanTarget = target.replace(/[^a-z0-9]/g, '');

              const matchesVehicle = cleanSender === cleanTarget || 
                                     cleanPoint === cleanTarget || 
                                     cleanReceiver === cleanTarget ||
                                     (cleanTarget && cleanSender.includes(cleanTarget)) ||
                                     (cleanTarget && cleanPoint.includes(cleanTarget));

              return matchesVehicle;
            }

            return true;
          }).length;
        },

        /**
         * Retorna los mensajes de una conversación exclusivamente para la jornada y turno activo
         */
        getConversation: (userAId, userBId, activeShiftId = null, targetDate = null, targetJornada = null) => {
          const currentMessages = get().messages || [];
          const todayDate = targetDate || getCurrentDate();
          const currentJornada = targetJornada || getCurrentJornada();

          return currentMessages.filter(m => {
            // Descartar señales internas de señalización de la vista del chat
            if (m.type === 'call_signal_ringing' || m.type === 'call_signal_connected') {
              return false;
            }

            // 🛡️ REGLA ESTRICTA: El mensaje DEBE ser de la FECHA ACTIVA
            const msgDate = m.date || getMessageDate(m.createdAt);
            if (msgDate !== todayDate) {
              return false;
            }

            // 🛡️ REGLA ESTRICTA: El mensaje DEBE ser de la JORNADA ACTIVA (AM vs PM)
            const msgJornada = m.jornada || getMessageJornada(m.createdAt);
            if (msgJornada !== currentJornada) {
              return false;
            }

            // Filtro de turno: si hay un turno activo específico, priorizar mensajes del turno
            if (activeShiftId && activeShiftId !== 'shift-active' && m.shiftId && m.shiftId !== 'shift-active') {
              if (m.shiftId !== activeShiftId) return false;
            }

            // Si la conversación seleccionada es 'ALL' (Canal General)
            if (!userBId || userBId === 'ALL') {
              return true; // Muestra todo el canal de radio de la jornada activa
            }

            // Para canal individual (ej: T1, T2, etc.)
            const targetId = String(userBId).toLowerCase();
            const sender = String(m.senderId || '').toLowerCase();
            const receiver = String(m.receiverId || '').toLowerCase();
            const point = String(m.pointId || '').toLowerCase();
            const senderNameStr = String(m.senderName || '').toLowerCase();

            const isDirectMatch =
              (sender === String(userAId).toLowerCase() && (receiver === targetId || receiver === 'dejador')) ||
              (sender === targetId && (receiver === String(userAId).toLowerCase() || receiver === 'dejador')) ||
              point === targetId ||
              receiver === targetId ||
              sender === targetId ||
              senderNameStr.includes(targetId);

            const isBroadcast = m.receiverId === 'ALL';

            return isDirectMatch || isBroadcast;
          }).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        },

        /**
         * Inicia una llamada de voz
         */
        startCall: ({ callerId, callerName, callerRole, receiverId, receiverName }) => {
          const callData = {
            id: `CALL-${Date.now()}`,
            callerId,
            callerName,
            callerRole,
            receiverId,
            receiverName,
            status: 'ringing',
            startedAt: new Date().toISOString(),
          };
          set({ activeCall: callData });

          // 1. Broadcast instantáneo de alta velocidad
          try {
            if (realtimeChannel) {
              realtimeChannel.send({
                type: 'broadcast',
                event: 'voice_call_signal',
                payload: callData,
              }).catch(() => {});
            }
          } catch (_) {}

          // 2. Señalización en base de datos para garantizar timbre aunque la red parpadee
          get().sendMessage({
            shiftId: 'shift-active',
            senderId: callerId,
            senderName: callerName,
            senderRole: callerRole,
            receiverId,
            receiverName,
            type: 'call_signal_ringing',
            text: JSON.stringify(callData),
          });
        },

        /**
         * Responde o finaliza una llamada
         */
        updateCallStatus: (status) => {
          const currentCall = get().activeCall;
          if (!currentCall) return;

          const updatedCall = { ...currentCall, status };

          if (status === 'ended') {
            const wasConnected = currentCall.status === 'connected';
            const durationSec = Math.max(0, Math.floor((Date.now() - new Date(currentCall.startedAt).getTime()) / 1000));
            const logText = wasConnected
              ? `📞 Llamada de voz finalizada (${Math.floor(durationSec / 60)}:${(durationSec % 60).toString().padStart(2, '0')})`
              : '📞 Llamada de voz cancelada';

            // 1. Broadcast la señal de "ended"
            try {
              if (realtimeChannel) {
                realtimeChannel.send({
                  type: 'broadcast',
                  event: 'voice_call_signal',
                  payload: updatedCall,
                }).catch(() => {});
              }
            } catch (_) {}

            // 2. Señal persistente "ended" (sirve como log de llamada en el chat)
            get().sendMessage({
              shiftId: 'shift-active',
              branchId: currentCall.branchId || 'BRANCH-001',
              senderId: currentCall.callerId,
              senderName: currentCall.callerName,
              senderRole: currentCall.callerRole,
              receiverId: currentCall.receiverId,
              receiverName: currentCall.receiverName,
              pointId: currentCall.callerId,
              type: 'call_log',
              text: logText,
              durationSeconds: durationSec,
            });

            // 3. Limpiar estado local
            set({ activeCall: null });
          } else {
            set({ activeCall: updatedCall });

            // 1. Broadcast estado "connected"
            try {
              if (realtimeChannel) {
                realtimeChannel.send({
                  type: 'broadcast',
                  event: 'voice_call_signal',
                  payload: updatedCall,
                }).catch(() => {});
              }
            } catch (_) {}

            // 2. Señal persistente "connected"
            get().sendMessage({
              shiftId: 'shift-active',
              branchId: currentCall.branchId || 'BRANCH-001',
              senderId: currentCall.callerId,
              senderName: currentCall.callerName,
              senderRole: currentCall.callerRole,
              receiverId: currentCall.receiverId,
              receiverName: currentCall.receiverName,
              pointId: currentCall.callerId,
              type: 'call_signal_connected',
              text: JSON.stringify(updatedCall),
            });
          }
        },
      };
    },
    {
      name: 'frita_chat_store_v1',
      storage: safeJSONStorage,
      partialize: (state) => ({
        ...state,
        // Limitar a 30 mensajes y remover datos base64 pesados al guardar en localStorage
        messages: (state.messages || []).slice(0, 30).map(m => {
          if (m.mediaUrl && m.mediaUrl.length > 500) {
            return { ...m, mediaUrl: null };
          }
          return m;
        }),
      }),
    }
  )
);
