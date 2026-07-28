import React, { useState, useEffect } from 'react';
import { PhoneCall, PhoneOff } from 'lucide-react';
import { useChatStore } from '../../store/useChatStore';
import { resumeAudioContext } from '../../hooks/useChatSoundNotifier';

interface ActiveCallBannerProps {
  currentUserId: string;
}

/**
 * Banner Flotante Global de Llamada Activa
 * ─────────────────────────────────────────────────────────────
 * Se muestra en la parte superior de TODAS las pestañas del dashboard
 * cuando hay una llamada timbrando o en curso, permitiendo contestar
 * o colgar al instante desde cualquier lugar de la aplicación.
 */
export const ActiveCallBanner: React.FC<ActiveCallBannerProps> = ({ currentUserId }) => {
  const activeCall = useChatStore((state) => state.activeCall);
  const updateCallStatus = useChatStore((state) => state.updateCallStatus);
  const [callDuration, setCallDuration] = useState(0);

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

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 w-[92%] sm:w-11/12 max-w-lg z-[9999] animate-bounce-short">
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
                : `🎙️ Intercom Activo (${formatCallTime(callDuration)})`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Botón Contestar para el receptor */}
          {isIncoming && (
            <button
              onClick={() => {
                resumeAudioContext();
                updateCallStatus('connected');
              }}
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
