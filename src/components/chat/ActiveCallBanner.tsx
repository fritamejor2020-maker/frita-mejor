import React, { useState, useEffect, useRef } from 'react';
import { PhoneCall, PhoneOff, Mic, Volume2 } from 'lucide-react';
import { useChatStore } from '../../store/useChatStore';
import { resumeAudioContext, playRadioChime } from '../../hooks/useChatSoundNotifier';
import { useWebRTCCall } from '../../hooks/useWebRTCCall';
import { supabase } from '../../lib/supabase';

interface ActiveCallBannerProps {
  currentUserId: string;
}

/**
 * Banner Flotante Global de Llamada Activa con Radio Intercom (WebRTC + PTT Instantáneo)
 * ─────────────────────────────────────────────────────────────────────────────
 * Muestra el estado de la llamada en tiempo real sobre cualquier pestaña.
 * Incluye botón de Hablar por Radio (Push-to-Talk) garantizado a prueba de fallos
 * que transmite voz instantánea por el altavoz de ambos celulares.
 */
export const ActiveCallBanner: React.FC<ActiveCallBannerProps> = ({ currentUserId }) => {
  const activeCall = useChatStore((state) => state.activeCall);
  const updateCallStatus = useChatStore((state) => state.updateCallStatus);
  const [callDuration, setCallDuration] = useState(0);

  const [isTalkingPtt, setIsTalkingPtt] = useState(false);
  const [isListeningPtt, setIsListeningPtt] = useState(false);

  const domAudioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // 🎙️ Conexión de Voz WebRTC con Relevo TURN
  useWebRTCCall(currentUserId, domAudioRef);

  // Escuchar ráfagas de voz instantáneas por el canal de radio Supabase
  useEffect(() => {
    if (!currentUserId || typeof window === 'undefined') return;

    const channel = supabase.channel('public_chat_channel');

    channel
      .on('broadcast', { event: 'radio_instant_voice' }, ({ payload }) => {
        if (!payload || !payload.mediaUrl || payload.senderId === currentUserId) return;
        if (payload.callId && activeCall && payload.callId !== activeCall.id) return;

        setIsListeningPtt(true);
        try {
          const audio = new Audio(payload.mediaUrl);
          audio.onended = () => setIsListeningPtt(false);
          audio.onerror = () => setIsListeningPtt(false);
          audio.play().catch(() => setIsListeningPtt(false));
        } catch (_) {
          setIsListeningPtt(false);
        }
      })
      .subscribe();
  }, [currentUserId, activeCall?.id]);

  // Timer de llamada en curso
  useEffect(() => {
    let timer: any = null;
    if (activeCall && activeCall.status === 'connected') {
      setCallDuration(0);
      timer = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [activeCall?.status, activeCall?.id]);

  if (!activeCall) return null;

  const isCaller = activeCall.callerId === currentUserId;
  const isIncoming = !isCaller && activeCall.status === 'ringing';

  const formatCallTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const handleAnswerCall = () => {
    resumeAudioContext();
    if (domAudioRef.current) {
      domAudioRef.current.play().catch(() => {});
    }
    updateCallStatus('connected');
  };

  // 🎙️ Iniciar grabación PTT (Radio Instantánea)
  const startPttVoice = async () => {
    resumeAudioContext();
    setIsTalkingPtt(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Audio = reader.result;
          const channel = supabase.channel('public_chat_channel');
          channel.send({
            type: 'broadcast',
            event: 'radio_instant_voice',
            payload: {
              mediaUrl: base64Audio,
              senderId: currentUserId,
              callId: activeCall.id,
            },
          }).catch(() => {});
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorderRef.current.start();
    } catch (err) {
      setIsTalkingPtt(false);
      console.warn('[PTT] Mic access error:', err);
    }
  };

  // ⏹️ Detener grabación PTT
  const stopPttVoice = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (_) {}
    }
    setIsTalkingPtt(false);
  };

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 w-[94%] sm:w-11/12 max-w-lg z-[9999]">
      <audio ref={domAudioRef} autoPlay playsInline controls={false} className="hidden" />

      <div
        className={`p-3.5 sm:p-4 rounded-3xl shadow-2xl flex flex-col gap-2.5 border-2 border-white backdrop-blur-md transition-all ${
          activeCall.status === 'ringing'
            ? 'bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 text-gray-950 animate-pulse'
            : 'bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-700 text-white'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center text-xl shrink-0">
              <PhoneCall size={20} className={activeCall.status === 'ringing' ? 'animate-bounce' : ''} />
            </div>
            <div>
              <p className="font-black text-xs sm:text-sm leading-tight">
                {isCaller
                  ? activeCall.status === 'ringing'
                    ? `Llamando a ${activeCall.receiverName}...`
                    : `En llamada con ${activeCall.receiverName}`
                  : activeCall.status === 'ringing'
                    ? `Llamada de ${activeCall.callerName}`
                    : `En llamada con ${activeCall.callerName}`}
              </p>
              <p className="text-[10px] font-bold opacity-90 tracking-wide uppercase mt-0.5 flex items-center gap-1.5">
                {activeCall.status === 'ringing' ? (
                  '🔔 Timbrando...'
                ) : isListeningPtt ? (
                  <span className="text-yellow-300 font-black animate-pulse flex items-center gap-1">
                    <Volume2 size={12} /> Escuchando voz...
                  </span>
                ) : (
                  `📞 Llamada en Curso (${formatCallTime(callDuration)})`
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Botón Contestar para el receptor */}
            {isIncoming && (
              <button
                onClick={handleAnswerCall}
                className="bg-emerald-700 hover:bg-emerald-600 text-white px-4 py-2 rounded-2xl font-black text-xs shadow-md active:scale-95 transition-all cursor-pointer"
              >
                ✅ Contestar
              </button>
            )}

            {/* Botón Colgar */}
            <button
              onClick={() => updateCallStatus('ended')}
              className="bg-red-600 hover:bg-red-500 text-white px-3.5 py-2 rounded-2xl font-black text-xs shadow-md active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
            >
              <PhoneOff size={13} />
              <span>Colgar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
