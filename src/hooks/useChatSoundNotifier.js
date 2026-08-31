import { useEffect, useRef } from 'react';
import { useChatStore, getMessageDate, getMessageJornada, getCurrentDate, getCurrentJornada } from '../store/useChatStore';

/**
 * Hook Global de Notificaciones de Audio y Llamadas de Chat
 * ─────────────────────────────────────────────────────────────
 * Se monta a nivel raíz en los Dashboards (fuera de tabs) para:
 *  1. Desbloquear AudioContext automáticamente al primer toque/clic
 *  2. Reproducir bip de radio al recibir mensajes nuevos
 *  3. Reproducir el timbre de llamada entrante SOLO en el celular receptor
 *  4. Reproducir tono suave de salida en el celular llamador
 */

let _audioCtx = null;

export function getAudioCtx() {
  if (typeof window === 'undefined') return null;
  try {
    if (!_audioCtx || _audioCtx.state === 'closed') {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      _audioCtx = new AC();
    }
    if (_audioCtx && _audioCtx.state === 'suspended') {
      _audioCtx.resume().catch(() => {});
    }
    return _audioCtx;
  } catch (e) {
    console.warn('[Audio] Failed to get AudioContext:', e);
    return null;
  }
}

// Desbloqueo global automático en el primer toque o clic del usuario
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    try {
      const ctx = getAudioCtx();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
    } catch (_) {}
  };
  window.addEventListener('click', unlockAudio, { passive: true, once: true });
  window.addEventListener('touchstart', unlockAudio, { passive: true, once: true });
  window.addEventListener('pointerdown', unlockAudio, { passive: true, once: true });
}

export function resumeAudioContext() {
  getAudioCtx();
}

/**
 * Tono característico de walkie-talkie / intercomunicador (doble bip fuerte)
 */
export function playRadioChime() {
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Bip 1: 880Hz
    const osc1 = ctx.createOscillator();
    const g1 = ctx.createGain();
    osc1.type = 'square';
    osc1.frequency.value = 880;
    g1.gain.setValueAtTime(0.7, now);
    g1.gain.exponentialRampToValueAtTime(0.01, now + 0.14);
    osc1.connect(g1).connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.14);

    // Bip 2: 1320Hz
    const osc2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    osc2.type = 'square';
    osc2.frequency.value = 1320;
    g2.gain.setValueAtTime(0.8, now + 0.18);
    g2.gain.exponentialRampToValueAtTime(0.01, now + 0.38);
    osc2.connect(g2).connect(ctx.destination);
    osc2.start(now + 0.18);
    osc2.stop(now + 0.38);
  } catch (e) {
    console.warn('Audio chime error:', e);
  }
}

/**
 * Tono suave de salida para quien HACE la llamada (esperando respuesta)
 */
export function playOutgoingTone() {
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 440;
    g.gain.setValueAtTime(0.15, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.connect(g).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.3);
  } catch (_) {}
}

function startRepeatingRadioChime() {
  playRadioChime();
  const intervalId = setInterval(() => {
    playRadioChime();
  }, 1200);

  return function stop() {
    clearInterval(intervalId);
  };
}

function startRepeatingOutgoingTone() {
  playOutgoingTone();
  const intervalId = setInterval(() => {
    playOutgoingTone();
  }, 2500);

  return function stop() {
    clearInterval(intervalId);
  };
}

/**
 * Hook global de sonidos — reacciona directamente al store Zustand
 */
export function useChatSoundNotifier(currentUserId) {
  const ringtoneStopRef = useRef(null);
  const prevMsgCountRef = useRef(0);

  const activeCall = useChatStore(state => state.activeCall);
  const messages = useChatStore(state => state.messages);

  // 🔔 Sonido automático al recibir mensajes nuevos en el Zustand store
  useEffect(() => {
    if (!currentUserId || !messages) return;

    if (prevMsgCountRef.current > 0 && messages.length > prevMsgCountRef.current) {
      const latestMsg = messages[0];
      if (latestMsg) {
        // 🛡️ REGLA ESTRICTA: Ignorar mensajes de jornadas o días anteriores
        const msgDate = latestMsg.date || getMessageDate(latestMsg.createdAt);
        const msgJornada = latestMsg.jornada || getMessageJornada(latestMsg.createdAt);
        if (msgDate !== getCurrentDate() || msgJornada !== getCurrentJornada()) {
          prevMsgCountRef.current = messages.length;
          return;
        }

        // Solo sonar si el mensaje fue enviado en tiempo real (< 2 minutos)
        const msgAgeMs = Date.now() - new Date(latestMsg.createdAt || 0).getTime();
        if (msgAgeMs > 2 * 60 * 1000) {
          prevMsgCountRef.current = messages.length;
          return;
        }

        const myId = String(currentUserId || '').toLowerCase();
        const cleanMyId = myId.replace(/[^a-z0-9]/g, '');

        const senderId = String(latestMsg.senderId || '').toLowerCase();
        const cleanSenderId = senderId.replace(/[^a-z0-9]/g, '');

        const senderRole = String(latestMsg.senderRole || '').toLowerCase();
        const receiverId = String(latestMsg.receiverId || '').toLowerCase();
        const cleanReceiverId = receiverId.replace(/[^a-z0-9]/g, '');

        const pointId = String(latestMsg.pointId || '').toLowerCase();
        const cleanPointId = pointId.replace(/[^a-z0-9]/g, '');

        const isDejadorUser = cleanMyId === 'dejador' || cleanMyId.includes('dejador') || cleanMyId.includes('logistica');
        const isSenderDejador = senderRole === 'dejador' || senderRole === 'logistica' || cleanSenderId === 'dejador' || cleanSenderId.includes('dejador');

        const isSenderMe = cleanSenderId === cleanMyId || (isDejadorUser && isSenderDejador);

        // Si el mensaje fue enviado por el propio usuario actual, no reproducir sonido
        if (!isSenderMe) {
          if (isDejadorUser) {
            // 📩 REGLA DEJADORES:
            // Debe sonar siempre que un VENDEDOR le escriba a los dejadores
            if (!isSenderDejador) {
              playRadioChime();
            }
          } else {
            // 📩 REGLA VENDEDORES:
            // SOLO debe sonar si el DEJADOR le escribe a ESTE Vendedor específico (o a todos)
            if (isSenderDejador) {
              const isTargetedToMe =
                receiverId === 'all' ||
                (cleanMyId && cleanReceiverId && cleanReceiverId === cleanMyId) ||
                (cleanMyId && cleanPointId && cleanPointId === cleanMyId) ||
                (cleanMyId && cleanReceiverId && cleanMyId.includes(cleanReceiverId)) ||
                (cleanReceiverId && cleanMyId && cleanReceiverId.includes(cleanMyId));

              if (isTargetedToMe) {
                playRadioChime();
              }
            }
          }
        }
      }
    }
    prevMsgCountRef.current = messages.length;
  }, [messages, currentUserId]);

  // 📞 Timbres diferenciados para Receptor (Llamada Entrante) vs Llamador (Salida)
  useEffect(() => {
    if (!activeCall || activeCall.status !== 'ringing') {
      if (ringtoneStopRef.current) {
        ringtoneStopRef.current();
        ringtoneStopRef.current = null;
      }
      return;
    }

    const myId = String(currentUserId || '').toLowerCase().trim();
    const cleanMyId = myId.replace(/[^a-z0-9]/g, '');

    const callerId = String(activeCall.callerId || '').toLowerCase().trim();
    const cleanCallerId = callerId.replace(/[^a-z0-9]/g, '');

    const receiverId = String(activeCall.receiverId || '').toLowerCase().trim();
    const cleanReceiverId = receiverId.replace(/[^a-z0-9]/g, '');

    const isDejadorUser = cleanMyId === 'dejador' || cleanMyId.includes('dejador') || cleanMyId.includes('logistica');
    const isCallerDejador = cleanCallerId === 'dejador' || cleanCallerId.includes('dejador') || cleanCallerId.includes('logistica');
    const isReceiverDejador = cleanReceiverId === 'dejador' || cleanReceiverId.includes('dejador') || cleanReceiverId.includes('logistica');

    const isCaller = cleanMyId === cleanCallerId || (isDejadorUser && isCallerDejador);
    const isReceiver = receiverId === 'all' || cleanMyId === cleanReceiverId || (isDejadorUser && isReceiverDejador);

    if (isReceiver && !isCaller) {
      // 🔔 RECEPTOR: Timbre de llamada entrante fuerte y continuo
      if (!ringtoneStopRef.current) {
        ringtoneStopRef.current = startRepeatingRadioChime();
      }
    } else if (isCaller) {
      // 📞 LLAMADOR: Tono suave de salida (esperando respuesta)
      if (!ringtoneStopRef.current) {
        ringtoneStopRef.current = startRepeatingOutgoingTone();
      }
    }

    return () => {
      if (ringtoneStopRef.current) {
        ringtoneStopRef.current();
        ringtoneStopRef.current = null;
      }
    };
  }, [activeCall?.status, activeCall?.id, activeCall?.callerId, activeCall?.receiverId, currentUserId]);
}
