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
let _unlockInstalled = false;
let _htmlAudioUnlocked = false;

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
    return null;
  }
}

export function resumeAudioContext() {
  try {
    if (_audioCtx && _audioCtx.state === 'suspended') {
      _audioCtx.resume().catch(() => {});
    }
  } catch (_) {}
}

// Desbloqueo persistente del audio en móvil/tablet: el SO suspende el AudioContext
// cuando la pantalla está inactiva o la app en segundo plano, y sin un gesto reciente
// resume() no completa -> los bips de chat "a veces no suenan". Se re-desbloquea en
// CADA gesto (no {once:true}) y al volver a primer plano.
export function installAudioUnlock() {
  if (_unlockInstalled || typeof window === 'undefined') return;
  _unlockInstalled = true;

  const unlock = () => {
    try {
      const ctx = getAudioCtx();
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
      if (!_htmlAudioUnlocked) {
        // Un play/pause silencioso desbloquea HTMLAudio en iOS/Android
        const a = new Audio('/sounds/mixkit_notify.wav');
        a.volume = 0;
        a.play().then(() => { a.pause(); a.currentTime = 0; _htmlAudioUnlocked = true; }).catch(() => {});
      }
    } catch (_) {}
  };

  ['pointerdown', 'touchstart', 'keydown', 'click'].forEach((ev) => {
    window.addEventListener(ev, unlock, { capture: true, passive: true });
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') resumeAudioContext();
  });
}

// Reproductor de sonido de mensaje resiliente: HTMLAudio (más confiable tras un
// gesto y sobrevive mejor al backgrounding) y, si falla, oscilador WebAudio.
let _msgAudioEl = null;
export function playMessageSound() {
  // 1. HTMLAudio
  try {
    if (!_msgAudioEl) {
      _msgAudioEl = new Audio('/sounds/mixkit_notify.wav');
      _msgAudioEl.volume = 0.9;
    }
    _msgAudioEl.currentTime = 0;
    const p = _msgAudioEl.play();
    if (p && typeof p.then === 'function') {
      p.catch(() => playRadioChime());
    }
    return;
  } catch (_) {}
  // 2. Fallback WebAudio
  playRadioChime();
}

/**
 * Tono característico de walkie-talkie / intercomunicador (doble bip fuerte)
 */
export function playRadioChime() {
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    // Si sigue suspendido, esperar a que resuma y reintentar una vez.
    if (ctx.state === 'suspended') {
      ctx.resume().then(() => {
        if (ctx.state === 'running') _emitRadioChime(ctx);
      }).catch(() => {});
      return;
    }
    _emitRadioChime(ctx);
  } catch (e) {
    console.warn('Audio chime error:', e);
  }
}

function _emitRadioChime(ctx) {
  try {
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
  const lastSeenMsgIdRef = useRef(null);
  const initializedRef = useRef(false);

  const activeCall = useChatStore(state => state.activeCall);
  const messages = useChatStore(state => state.messages);

  // Desbloqueo de audio en cada gesto (móvil suspende el AudioContext al inactivar)
  useEffect(() => { installAudioUnlock(); }, []);

  // 🔔 Sonido automático al recibir mensajes nuevos en el Zustand store.
  // Se rastrea por ID del mensaje más nuevo, NO por longitud del array: al llegar
  // al tope de 50, un mensaje nuevo reemplaza a uno viejo y length no cambia ->
  // antes NO sonaba.
  useEffect(() => {
    if (!currentUserId || !messages) return;

    const latestMsg = messages[0];
    const latestId = latestMsg?.id || latestMsg?.createdAt || null;

    // Primera pasada tras montar: registrar el estado actual sin sonar
    if (!initializedRef.current) {
      initializedRef.current = true;
      lastSeenMsgIdRef.current = latestId;
      return;
    }

    if (latestId && latestId !== lastSeenMsgIdRef.current) {
      lastSeenMsgIdRef.current = latestId;
      if (latestMsg) {
        // Ignorar mensajes de días anteriores (no de jornadas: uno recién enviado
        // justo al cambiar de jornada debe sonar igual).
        const msgDate = latestMsg.date || getMessageDate(latestMsg.createdAt);
        if (msgDate && msgDate !== getCurrentDate()) {
          return;
        }

        // Solo sonar si el mensaje es reciente (< 5 min — cubre latencia de realtime
        // y sondeos, y tolera desfase de reloj entre dispositivos).
        const msgAgeMs = Date.now() - new Date(latestMsg.createdAt || 0).getTime();
        if (msgAgeMs > 5 * 60 * 1000) {
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
              playMessageSound();
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
                playMessageSound();
              }
            }
          }
        }
      }
    }
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
