import React, { useState, useEffect, useRef } from 'react';
import { PhoneCall, PhoneOff } from 'lucide-react';
import { useChatStore } from '../../store/useChatStore';
import { resumeAudioContext } from '../../hooks/useChatSoundNotifier';
import { useWebRTCCall } from '../../hooks/useWebRTCCall';

interface ActiveCallBannerProps {
  currentUserId: string;
}

/**
 * Banner Flotante Global de Llamada Activa con Audio WebRTC HD
 * ─────────────────────────────────────────────────────────────
 * Contiene el elemento <audio> nativo del DOM y gestiona la conexión de voz
 * en tiempo real para garantizar reproducibilidad en móviles iOS/Android.
 */
export const ActiveCallBanner: React.FC<ActiveCallBannerProps> = ({ currentUserId }) => {
  const activeCall = useChatStore((state) => state.activeCall);
  const updateCallStatus = useChatStore((state) => state.updateCallStatus);
  const [callDuration, setCallDuration] = useState(0);

  const domAudioRef = useRef<HTMLAudioElement | null>(null);

  // 🎙️ Conexión de Voz en Vivo WebRTC con Relevo TURN
  useWebRTCCall(currentUserId, domAudioRef);

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

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 w-[92%] sm:w-11/12 max-w-lg z-[9999] animate-bounce-short">
      {/* Elemento de Audio Nativo en el DOM (reproduce la voz entrante) */}
      <audio ref={domAudioRef} autoPlay playsInline controls={false} className="hidden" />

      <div
        className={`p-3.5 sm:p-4 rounded-3xl shadow-2xl flex items-center justify-between border-2 border-white backdrop-blur-md transition-all ${
          activeCall.status === 'ringing'
            ? 'bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 text-gray-950 animate-pulse'
            : 'bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-700 text-white'
        }`}
      >
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
            <p className="text-[10px] font-bold opacity-90 tracking-wide uppercase mt-0.5">
              {activeCall.status === 'ringing'
                ? '📻 Timbrando Radio...'
                : `🎙️ Voz en Vivo Active (${formatCallTime(callDuration)})`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Botón Contestar para el receptor */}
          {isIncoming && (
            <button
              onClick={handleAnswerCall}
              className="bg-emerald-700 hover:bg-emerald-600 text-white px-4 py-2 rounded-2xl font-black text-xs shadow-md active:scale-95 transition-all"
            >
              ✅ Contestar
            </button>
          )}

          {/* Botón Colgar */}
          <button
            onClick={() => updateCallStatus('ended')}
            className="bg-red-600 hover:bg-red-500 text-white px-3.5 py-2 rounded-2xl font-black text-xs shadow-md active:scale-95 transition-all flex items-center gap-1"
          >
            <PhoneOff size={13} />
            <span>Colgar</span>
          </button>
        </div>
      </div>
    </div>
  );
};
