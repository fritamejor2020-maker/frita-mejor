import { useEffect, useRef } from 'react';
import { useChatStore } from '../store/useChatStore';
import { supabase } from '../lib/supabase';

/**
 * Hook Global de Notificaciones de Audio y Llamadas de Chat
 * ─────────────────────────────────────────────────────────────
 * Se monta a nivel raíz en los Dashboards (fuera de tabs) para:
 *  1. Desbloquear AudioContext automáticamente al primer toque/clic
 *  2. Reproducir bip de radio al recibir mensajes nuevos (en canal 'public_chat_channel')
 *  3. Reproducir ringtone continuo durante llamadas entrantes
 *  4. Funcionar SIEMPRE, sin importar la pestaña activa
 */

let _audioCtx = null;

function getAudioCtx() {
  if (typeof window === 'undefined') return null;
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

// Desbloqueo global automático en cualquier toque o clic
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    const ctx = getAudioCtx();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  };
  window.addEventListener('click', unlockAudio, { passive: true });
  window.addEventListener('touchstart', unlockAudio, { passive: true });
  window.addEventListener('pointerdown', unlockAudio, { passive: true });
}

export function resumeAudioContext() {
  getAudioCtx();
}

/**
 * Tono característico de walkie-talkie / intercomunicador (doble bip)
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
    g1.gain.setValueAtTime(0.6, now);
    g1.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
    osc1.connect(g1).connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.12);

    // Bip 2: 1320Hz
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

/**
 * Ringtone continuo de llamada entrante
 */
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
 * Hook global de sonidos — escuchar en el MISMO canal que useChatStore ('public_chat_channel')
 */
export function useChatSoundNotifier(currentUserId) {
  const ringtoneStopRef = useRef(null);
  const lastMessageIdRef = useRef(null);
  const activeCall = useChatStore(state => state.activeCall);

  // Escuchar mensajes entrantes en el canal central broadcast 'public_chat_channel'
  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel('public_chat_channel_sound_notifier')
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

  // Ringtone de llamada entrante
  useEffect(() => {
    const isIncomingCall =
      activeCall &&
      activeCall.status === 'ringing' &&
      (activeCall.receiverId === currentUserId ||
       activeCall.receiverId === 'ALL' ||
       (currentUserId === 'DEJADOR' && activeCall.receiverId === 'DEJADOR'));

    if (isIncomingCall) {
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
  }, [activeCall?.status, activeCall?.id, activeCall?.receiverId, currentUserId]);
}
