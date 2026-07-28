import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send, Mic, Square, Camera, Image as ImageIcon, Phone, PhoneOff,
  PhoneCall, Volume2, Play, Pause, CheckCheck, User, Clock, AlertCircle, X
} from 'lucide-react';
import { useChatStore } from '../../store/useChatStore';
import { resumeAudioContext } from '../../hooks/useChatSoundNotifier';

/**
 * Módulo de Chat / Radio Intercomunicador Integrado
 * Rediseñado con la línea gráfica cálida, limpia y moderna de Frita Mejor.
 *
 * Mantiene la llamada activa y estable en tiempo real, registrando la duración
 * y permitiendo notas de voz rápidas de radio y mensajes en vivo.
 */

export const IntercomChatModule = ({
  currentUserId,
  currentUserName,
  currentUserRole,
  targetUserId = 'ALL',
  targetUserName = 'Dejador / Logística',
  branchId = 'BRANCH-001',
  shiftId = 'shift-active',
  compactMode = false,
}) => {
  const messages = useChatStore(state => state.messages);
  const sendMessage = useChatStore(state => state.sendMessage);
  const markAsRead = useChatStore(state => state.markAsRead);
  const getConversation = useChatStore(state => state.getConversation);
  const activeCall = useChatStore(state => state.activeCall);
  const startCall = useChatStore(state => state.startCall);
  const updateCallStatus = useChatStore(state => state.updateCallStatus);

  const [textInput, setTextInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [playingAudioId, setPlayingAudioId] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [isCompressingPhoto, setIsCompressingPhoto] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const audioRef = useRef(null);
  const messagesEndRef = useRef(null);
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const callTimerRef = useRef(null);

  // ─── Timer continuo de llamada en curso (estable sin desconexión) ─────────
  useEffect(() => {
    if (activeCall && activeCall.status === 'connected') {
      setCallDuration(0);
      callTimerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
        callTimerRef.current = null;
      }
      setCallDuration(0);
    }

    return () => {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
        callTimerRef.current = null;
      }
    };
  }, [activeCall?.status, activeCall?.id]);

  // Despertar AudioContext con el primer toque del usuario
  const handleUserGesture = useCallback(() => {
    resumeAudioContext();
  }, []);

  const conversation = getConversation(currentUserId, targetUserId, shiftId);

  // Auto-scroll al último mensaje y marcar leídos al tener el componente abierto
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    markAsRead(targetUserId, currentUserId);
  }, [conversation.length, targetUserId, currentUserId, messages]);

  // Manejador de Notas de Voz (MediaRecorder)
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Audio = reader.result;
          sendMessage({
            shiftId,
            branchId,
            senderId: currentUserId,
            senderName: currentUserName,
            senderRole: currentUserRole,
            receiverId: targetUserId,
            receiverName: targetUserName,
            type: 'audio',
            mediaUrl: base64Audio,
            durationSeconds: recordingTime,
          });
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.warn('Microphone access denied or not supported:', err);
      alert('Por favor autoriza el permiso de micrófono en tu navegador para enviar notas de voz.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(recordingTimerRef.current);
    }
  };

  // Enviar mensaje de texto
  const handleSendText = (e) => {
    e?.preventDefault();
    if (!textInput.trim() && !photoPreview) return;

    sendMessage({
      shiftId,
      branchId,
      senderId: currentUserId,
      senderName: currentUserName,
      senderRole: currentUserRole,
      receiverId: targetUserId,
      receiverName: targetUserName,
      type: photoPreview ? 'photo' : 'text',
      text: textInput.trim(),
      mediaUrl: photoPreview || null,
    });

    setTextInput('');
    setPhotoPreview(null);
  };

  // Compresión de foto a max 800px / JPEG 0.6 (~50KB)
  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressingPhoto(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.6);
        setPhotoPreview(compressedBase64);
        setIsCompressingPhoto(false);
      };
      img.src = ev.target?.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Reproducción de notas de voz
  const togglePlayAudio = (id, mediaUrl) => {
    if (playingAudioId === id) {
      audioRef.current?.pause();
      setPlayingAudioId(null);
    } else {
      if (audioRef.current) audioRef.current.pause();
      audioRef.current = new Audio(mediaUrl);
      audioRef.current.onended = () => setPlayingAudioId(null);
      audioRef.current.play().catch(() => {});
      setPlayingAudioId(id);
    }
  };

  // Formatear duración de llamada
  const formatCallTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // Soy emisor de la llamada
  const isCaller = activeCall?.callerId === currentUserId;

  return (
    <div
      className={`flex flex-col h-full bg-white rounded-[32px] border-2 border-amber-100 overflow-hidden shadow-xl ${compactMode ? 'max-h-[500px]' : ''}`}
      onTouchStart={handleUserGesture}
      onClick={handleUserGesture}
    >

      {/* Header Estilo Frita Mejor */}
      <div className="p-4 bg-gradient-to-r from-amber-500/10 to-amber-400/5 border-b border-amber-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#FFB700] to-amber-500 text-gray-950 flex items-center justify-center font-black shadow-sm">
            💬
          </div>
          <div>
            <h3 className="font-black text-base text-gray-900 flex items-center gap-2 leading-tight">
              {targetUserName}
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            </h3>
            <p className="text-[11px] font-bold text-gray-400">Radio e Intercomunicador de Turno</p>
          </div>
        </div>

        {/* Botón de Llamada de Voz */}
        <button
          onClick={() => {
            resumeAudioContext();
            startCall({
              callerId: currentUserId,
              callerName: currentUserName,
              callerRole: currentUserRole,
              receiverId: targetUserId,
              receiverName: targetUserName,
            });
          }}
          disabled={!!activeCall}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full font-black text-xs shadow-sm active:scale-95 transition-all ${
            activeCall
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-emerald-500 hover:bg-emerald-600 text-white'
          }`}
        >
          <Phone size={14} /> <span>Llamar</span>
        </button>
      </div>

      {/* Banner de Llamada Activa */}
      {activeCall && (
        <div className={`p-3.5 flex items-center justify-between shadow-md ${
          activeCall.status === 'ringing'
            ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-gray-950 animate-pulse'
            : 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white'
        }`}>
          <div className="flex items-center gap-2.5">
            <PhoneCall size={18} className={activeCall.status === 'ringing' ? 'animate-bounce' : ''} />
            <div>
              <p className="font-black text-xs">
                {isCaller
                  ? activeCall.status === 'ringing'
                    ? `📞 Llamando a ${activeCall.receiverName}...`
                    : `📞 En llamada con ${activeCall.receiverName}`
                  : activeCall.status === 'ringing'
                    ? `📞 Llamada entrante de ${activeCall.callerName}`
                    : `📞 En llamada con ${activeCall.callerName}`
                }
              </p>
              <p className="text-[10px] font-bold opacity-80 uppercase tracking-wider">
                {activeCall.status === 'ringing'
                  ? 'Timbrando...'
                  : `En curso — ${formatCallTime(callDuration)}`
                }
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {/* Botón Contestar: visible para cualquiera que NO sea el emisor mientras esté timbrando */}
            {!isCaller && activeCall.status === 'ringing' && (
              <button
                onClick={() => {
                  resumeAudioContext();
                  updateCallStatus('connected');
                }}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-xl font-black text-xs shadow-sm active:scale-95 transition-all"
              >
                ✅ Contestar
              </button>
            )}
            {/* Botón Colgar (ambos) */}
            <button
              onClick={() => updateCallStatus('ended')}
              className="bg-red-600 hover:bg-red-500 text-white px-4 py-1.5 rounded-xl font-black text-xs shadow-sm flex items-center gap-1 active:scale-95 transition-all"
            >
              <PhoneOff size={13} /> Colgar
            </button>
          </div>
        </div>
      )}

      {/* Cuerpo del Chat */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#FAF8F5]">
        {conversation.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 my-auto">
            <div className="w-16 h-16 rounded-3xl bg-amber-100/70 border border-amber-200/60 flex items-center justify-center text-3xl mb-3 shadow-sm">
              📻
            </div>
            <h4 className="font-black text-base text-gray-800">Canal de Radio Listo</h4>
            <p className="text-xs font-bold text-gray-400 mt-1 max-w-xs leading-relaxed">
              Envía una nota de voz o mensaje de texto para coordinar el surtido o cualquier novedad del turno.
            </p>
          </div>
        ) : (
          conversation.map(msg => {
            const isMe = msg.senderId === currentUserId;
            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div className="text-[10px] font-bold text-gray-400 mb-0.5 px-1">
                  {msg.senderName} ({msg.senderRole})
                </div>

                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 shadow-sm ${
                  isMe
                    ? 'bg-[#FFB700] text-gray-950 font-bold rounded-tr-none'
                    : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none font-medium'
                }`}>

                  {/* Mensaje de Texto */}
                  {msg.type === 'text' && (
                    <p className="text-xs leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                  )}

                  {/* Foto */}
                  {msg.type === 'photo' && (
                    <div className="space-y-1.5">
                      <img src={msg.mediaUrl} alt="Adjunto" className="rounded-xl max-h-48 object-cover border border-black/10" />
                      {msg.text && <p className="text-xs">{msg.text}</p>}
                    </div>
                  )}

                  {/* Nota de Voz */}
                  {msg.type === 'audio' && (
                    <div className="flex items-center gap-3 py-1">
                      <button
                        onClick={() => togglePlayAudio(msg.id, msg.mediaUrl)}
                        className={`w-9 h-9 rounded-full flex items-center justify-center transition-transform active:scale-90 shadow-sm ${
                          isMe ? 'bg-gray-950 text-[#FFB700]' : 'bg-[#FFB700] text-gray-950'
                        }`}
                      >
                        {playingAudioId === msg.id ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
                      </button>
                      <div>
                        <div className="flex items-center gap-1">
                          <Volume2 size={13} />
                          <span className="text-xs font-black">Nota de voz</span>
                        </div>
                        <span className="text-[10px] opacity-75">{msg.durationSeconds || 0}s</span>
                      </div>
                    </div>
                  )}

                  {/* Log de llamada */}
                  {msg.type === 'call_log' && (
                    <div className="flex items-center gap-1.5 text-xs py-0.5">
                      <PhoneCall size={14} />
                      <span>{msg.text}</span>
                    </div>
                  )}

                  {/* Timestamp + Check */}
                  <div className={`flex items-center justify-end gap-1 mt-1 text-[9px] ${isMe ? 'text-gray-900/60 font-bold' : 'text-gray-400'}`}>
                    <span>{new Date(msg.createdAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span>
                    {isMe && <CheckCheck size={12} className={msg.read ? 'text-blue-900' : 'opacity-60'} />}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Preview de foto cargada */}
      {photoPreview && (
        <div className="p-3 bg-amber-50 border-t border-amber-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={photoPreview} alt="Preview" className="w-12 h-12 rounded-xl object-cover border border-amber-200" />
            <span className="text-xs font-bold text-gray-700">Foto seleccionada</span>
          </div>
          <button onClick={() => setPhotoPreview(null)} className="text-red-500 hover:text-red-700 text-xs font-black px-2 py-1">
            ✕ Quitar
          </button>
        </div>
      )}

      {/* Grabación en Curso */}
      {isRecording && (
        <div className="p-3 bg-red-50 border-t border-red-200 flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500 animate-ping"></span>
            <span className="text-xs font-black text-red-700">Graba nota de voz: {recordingTime}s</span>
          </div>
          <button
            onClick={stopRecording}
            className="flex items-center gap-1 bg-red-600 hover:bg-red-500 text-white text-xs font-black px-3.5 py-1.5 rounded-xl shadow-sm"
          >
            <Square size={13} /> Soltar y Enviar
          </button>
        </div>
      )}

      {/* Footer de Entrada */}
      <form onSubmit={handleSendText} className="p-3 bg-white border-t border-gray-100 flex items-center gap-2">
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoSelect} />
        <input ref={galleryInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />

        {/* Cámara */}
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          disabled={isCompressingPhoto}
          className="p-2.5 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors active:scale-95 disabled:opacity-40"
          title="📸 Tomar Foto Cámara"
        >
          <Camera size={18} />
        </button>

        {/* Galería */}
        <button
          type="button"
          onClick={() => galleryInputRef.current?.click()}
          disabled={isCompressingPhoto}
          className="p-2.5 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors active:scale-95 disabled:opacity-40"
          title="📁 Subir de Galería"
        >
          <ImageIcon size={18} />
        </button>

        {/* Campo de Texto */}
        <input
          type="text"
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          placeholder="Escribe un mensaje o nota de voz..."
          className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl py-2.5 px-4 text-xs font-bold text-gray-900 placeholder:text-gray-400 outline-none focus:border-amber-400 transition-colors"
        />

        {/* Botón Enviar o Micrófono */}
        {textInput.trim() || photoPreview ? (
          <button
            type="submit"
            className="p-2.5 bg-[#FFB700] hover:bg-yellow-400 text-gray-950 font-black rounded-2xl shadow-sm active:scale-95 transition-all"
          >
            <Send size={18} />
          </button>
        ) : (
          <button
            type="button"
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
            className={`p-2.5 rounded-2xl font-black transition-all active:scale-95 ${
              isRecording ? 'bg-red-600 text-white shadow-sm' : 'bg-[#FFB700] hover:bg-yellow-400 text-gray-950 shadow-sm'
            }`}
            title="Mantén presionado para hablar"
          >
            <Mic size={18} />
          </button>
        )}
      </form>

    </div>
  );
};
