import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { push } from '../lib/syncManager';
import { markLocalWrite } from '../lib/useRealtimeSync';
import { useAuthStore } from './useAuthStore';
import { supabase } from '../lib/supabase';

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
  markLocalWrite('chatMessages', effectiveBranch);
  push('chatMessages', messages, effectiveBranch).catch(err =>
    console.warn('[Sync] chatMessages:', err.message)
  );
}

export const useChatStore = create(
  persist(
    (set, get) => ({
      messages: [],
      activeCall: null, // { callerId, callerName, callerRole, receiverId, status: 'ringing'|'connected'|'ended', startedAt }

      /**
       * Envía un nuevo mensaje o nota de voz
       */
      sendMessage: ({ shiftId, branchId, senderId, senderName, senderRole, receiverId, receiverName, type, text, mediaUrl, durationSeconds }) => {
        const user = useAuthStore.getState().user;
        const effectiveBranch = branchId || user?.branchId || 'BRANCH-001';
        
        const newMessage = {
          id: `MSG-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          shiftId: shiftId || 'shift-active',
          branchId: effectiveBranch,
          senderId: senderId || user?.id || 'unknown',
          senderName: senderName || user?.name || 'Usuario',
          senderRole: senderRole || user?.role || 'OPERARIO',
          receiverId: receiverId || 'ALL',
          receiverName: receiverName || 'Todos',
          type: type || 'text', // 'text' | 'audio' | 'photo' | 'call_log'
          text: text?.trim() || '',
          mediaUrl: mediaUrl || null,
          durationSeconds: durationSeconds || 0,
          read: false,
          createdAt: new Date().toISOString(),
        };

        const updated = [newMessage, ...get().messages];
        set({ messages: updated });
        syncChatMessages(updated, effectiveBranch);

        // Notificar por Broadcast de Supabase en tiempo real
        try {
          supabase.channel('public_chat_channel').send({
            type: 'broadcast',
            event: 'new_chat_message',
            payload: newMessage,
          }).catch(() => {});
        } catch (_) {}

        return newMessage;
      },

      /**
       * Marca mensajes entre dos participantes como leídos
       */
      markAsRead: (senderId, receiverId) => {
        let changed = false;
        const updated = get().messages.map(m => {
          if (m.senderId === senderId && (m.receiverId === receiverId || m.receiverId === 'ALL') && !m.read) {
            changed = true;
            return { ...m, read: true };
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
       * Retorna la cantidad de mensajes no leídos para un usuario
       */
      getUnreadCount: (myUserId, fromUserId = null) => {
        return get().messages.filter(m => {
          if (m.read) return false;
          if (m.senderId === myUserId) return false;
          if (fromUserId && m.senderId !== fromUserId) return false;
          return m.receiverId === myUserId || m.receiverId === 'ALL';
        }).length;
      },

      /**
       * Retorna los mensajes de una conversación entre dos usuarios (o para una sede/turno)
       */
      getConversation: (userAId, userBId) => {
        return get().messages.filter(m => {
          if (!userBId || userBId === 'ALL') {
            return m.receiverId === 'ALL' || m.senderId === userAId || m.receiverId === userAId;
          }
          return (m.senderId === userAId && m.receiverId === userBId) ||
                 (m.senderId === userBId && m.receiverId === userAId) ||
                 m.receiverId === 'ALL';
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

        try {
          supabase.channel('public_chat_channel').send({
            type: 'broadcast',
            event: 'voice_call_signal',
            payload: callData,
          }).catch(() => {});
        } catch (_) {}
      },

      /**
       * Responde o finaliza una llamada
       */
      updateCallStatus: (status) => {
        const currentCall = get().activeCall;
        if (!currentCall) return;

        const updatedCall = { ...currentCall, status };

        if (status === 'ended') {
          // Registrar log de llamada
          get().sendMessage({
            shiftId: 'shift-active',
            branchId: 'BRANCH-001',
            senderId: currentCall.callerId,
            senderName: currentCall.callerName,
            senderRole: currentCall.callerRole,
            receiverId: currentCall.receiverId,
            receiverName: currentCall.receiverName,
            type: 'call_log',
            text: `📞 Llamada de voz (${status === 'connected' ? 'Finalizada' : 'Cancelada'})`,
            durationSeconds: Math.floor((Date.now() - new Date(currentCall.startedAt).getTime()) / 1000),
          });
          set({ activeCall: null });
        } else {
          set({ activeCall: updatedCall });
        }

        try {
          supabase.channel('public_chat_channel').send({
            type: 'broadcast',
            event: 'voice_call_signal',
            payload: updatedCall,
          }).catch(() => {});
        } catch (_) {}
      },
    }),
    {
      name: 'frita_chat_store_v1',
    }
  )
);
