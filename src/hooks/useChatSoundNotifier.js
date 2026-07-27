import { useEffect, useRef } from 'react';
import { useChatStore } from '../store/useChatStore';
import { supabase } from '../lib/supabase';

/**
 * Hook Global de Notificaciones de Chat
 * ─────────────────────────────────────────────────────────────
 * Se monta UNA VEZ en el dashboard (fuera de tabs) para:
 *  1. Reproducir sonido de radio al recibir mensajes nuevos
 *  2. Reproducir ringtone continuo en llamadas entrantes
 *  3. Funcionar SIEMPRE, sin importar en qué pestaña esté el usuario
 *
 * IMPORTANTE: Este hook NO modifica el estado de mensajes ni llamadas.
 * Eso lo hace el store (useChatStore) vía su propio canal de broadcast.
 * Este hook SOLO se encarga del audio.
 */

// ─── Singleton AudioContext ─────────────────────────────────
let _audioCtx = null;
function getAudioCtx() {
  if (!_audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    _audioCtx = new AC();
  }
  if (_audioCtx.state === 'suspended') {
    _audioCtx.resume().catch(() => {});
  }
  return _audioCtx;
}

// Exponer para que IntercomChatModule pueda reanudar con gesto de usuario
export function resumeAudioContext() {
  getAudioCtx();
}

// ─── Sonido de Notificación Radio (doble bip fuerte) ────────
export function playRadioChime() {
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const g1 = ctx.createGain();
    osc1.type = 'square';
    osc1.frequency.value = 880;
    g1.gain.setValueAtTime(0.6, now);
    g1.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
    osc1.connect(g1).connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.12);

    const osc2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    osc2.type = 'square';
    osc2.frequency.value = 1320;
    g2.gain.setValueAtTime(0.7, now + 0.20);
    g2.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
    osc2.connect(g2).connect(ctx.destination);
    osc2.start(now + 0.20);
    osc2.stop(now + 0.35);
  } catch (e) {
    console.warn('Audio chime error:', e);
  }
}

// ─── Ringtone continuo para llamadas ────────────────────────
function startRingtone() {
  try {
    const ctx = getAudioCtx();
    if (!ctx) return () => {};

    let stopped = false;
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.5;
    masterGain.connect(ctx.destination);

    function playRingBurst() {
      if (stopped) return;
      const now = ctx.currentTime;

      const o1 = ctx.createOscillator();
      const g1 = ctx.createGain();
      o1.type = 'sine';
      o1.frequency.value = 440;
      g1.gain.setValueAtTime(0.5, now);
      g1.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
      o1.connect(g1).connect(masterGain);
      o1.start(now);
      o1.stop(now + 0.4);

      const o2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      o2.type = 'sine';
      o2.frequency.value = 560;
      g2.gain.setValueAtTime(0.5, now + 0.5);
      g2.gain.exponentialRampToValueAtTime(0.01, now + 0.9);
      o2.connect(g2).connect(masterGain);
      o2.start(now + 0.5);
      o2.stop(now + 0.9);
    }

    playRingBurst();
    const intervalId = setInterval(playRingBurst, 2500);

    return function stop() {
      stopped = true;
      clearInterval(intervalId);
      try { masterGain.disconnect(); } catch (_) {}
    };
  } catch (e) {
    console.warn('Ringtone error:', e);
    return () => {};
  }
}

/**
 * Hook principal — montar en el dashboard a nivel raíz
 * @param {string} currentUserId - ID del usuario actual (ej: 'DEJADOR', 'T1')
 */
export function useChatSoundNotifier(currentUserId) {
  const ringtoneStopRef = useRef(null);
  const lastMessageIdRef = useRef(null);
  const activeCall = useChatStore(state => state.activeCall);

  // ─── Listener de Broadcast para sonido de mensajes nuevos ──
  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel('chat_sound_notifier_' + currentUserId)
      .on('broadcast', { event: 'new_chat_message' }, ({ payload }) => {
        if (
          payload &&
          payload.id &&
          payload.senderId !== currentUserId &&
          payload.id !== lastMessageIdRef.current
        ) {
          lastMessageIdRef.current = payload.id;
          playRadioChime();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  // ─── Ringtone automático para llamadas entrantes ───────────
  useEffect(() => {
    if (
      activeCall &&
      activeCall.status === 'ringing' &&
      activeCall.receiverId === currentUserId
    ) {
      if (!ringtoneStopRef.current) {
        ringtoneStopRef.current = startRingtone();
      }
    } else {
      if (ringtoneStopRef.current) {
        ringtoneStopRef.current();
        ringtoneStopRef.current = null;
      }
    }

    return () => {
      if (ringtoneStopRef.current) {
        ringtoneStopRef.current();
        ringtoneStopRef.current = null;
      }
    };
  }, [activeCall?.status, activeCall?.id, currentUserId]);
}
