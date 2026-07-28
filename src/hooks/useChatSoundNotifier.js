import { useEffect, useRef } from 'react';
import { useChatStore } from '../store/useChatStore';

/**
 * Hook Global de Notificaciones de Audio y Llamadas de Chat
 * ─────────────────────────────────────────────────────────────
 * Se monta a nivel raíz en los Dashboards (fuera de tabs) para:
 *  1. Desbloquear AudioContext automáticamente al primer toque/clic
 *  2. Reproducir bip de radio al recibir mensajes nuevos
 *  3. Reproducir el MISMO bip de radio repetidamente durante llamadas entrantes
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

// Desbloqueo global automático en cualquier toque o clic del usuario
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
 * Repite el MISMO sonido de radio (playRadioChime) continuamente durante una llamada entrante
 */
function startRepeatingRadioChime() {
  playRadioChime();
  const intervalId = setInterval(() => {
    playRadioChime();
  }, 1200);

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
      const latestMsg = messages[0]; // Mensajes ordenados más reciente primero
      if (latestMsg && latestMsg.senderId !== currentUserId) {
        playRadioChime();
      }
    }
    prevMsgCountRef.current = messages.length;
  }, [messages, currentUserId]);

  // 📞 Repetir el MISMO sonido de radio walkie-talkie durante llamadas entrantes hasta contestar
  useEffect(() => {
    const isIncomingCall =
      activeCall &&
      activeCall.status === 'ringing' &&
      activeCall.callerId !== currentUserId;

    if (isIncomingCall) {
      if (!ringtoneStopRef.current) {
        ringtoneStopRef.current = startRepeatingRadioChime();
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
  }, [activeCall?.status, activeCall?.id, activeCall?.callerId, currentUserId]);
}
