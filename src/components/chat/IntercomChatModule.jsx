import React, { useState, useRef, useEffect } from 'react';
import {
  Send, Mic, Square, Camera, Image as ImageIcon, Phone, PhoneOff,
  PhoneCall, Volume2, Play, Pause, CheckCheck, User, Clock, AlertCircle
} from 'lucide-react';
import { useChatStore } from '../../store/useChatStore';

/**
 * Módulo de Chat / Radio Intercomunicador Integrado
 * (Soporta Texto, Notas de Voz, Fotos y Llamadas de Voz)
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
  const {
    messages,
    sendMessage,
    markAsRead,
    getConversation,
    activeCall,
    startCall,
    updateCallStatus
  } = useChatStore();

  const [textInput, setTextInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [playingAudioId, setPlayingAudioId] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const audioRef = useRef(null);
  const messagesEndRef = useRef(null);
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  const conversation = getConversation(currentUserId, targetUserId);

  // Auto-scroll al último mensaje
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    markAsRead(targetUserId, currentUserId);
  }, [conversation.length, targetUserId, currentUserId]);

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

        // Detener streams
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

  // Manejar selección de foto
  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Reproducción de notas de voz
  const togglePlayAudio = (id, mediaUrl) => {
    if (playingAudioId === id) {
      audioRef.current?.pause();
      setPlayingAudioId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      audioRef.current = new Audio(mediaUrl);
      audioRef.current.onended = () => setPlayingAudioId(null);
      audioRef.current.play().catch(() => {});
      setPlayingAudioId(id);
    }
  };

  return (
    <div className={`flex flex-col h-full bg-[#16171d] text-white rounded-3xl overflow-hidden shadow-2xl border border-gray-800 ${compactMode ? 'max-h-[500px]' : ''}`}>

      {/* Header */}
      <div className="p-4 bg-[#1e1f26] border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-black text-lg">
            💬
          </div>
          <div>
            <h3 className="font-black text-sm text-gray-100 flex items-center gap-2">
              {targetUserName}
              <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></span>
            </h3>
            <p className="text-[11px] font-bold text-gray-400">Canal Directo de Radio Intercom</p>
          </div>
        </div>

        {/* Botón de Llamada de Voz */}
        <button
          onClick={() => startCall({
            callerId: currentUserId,
            callerName: currentUserName,
            callerRole: currentUserRole,
            receiverId: targetUserId,
            receiverName: targetUserName,
          })}
          className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold text-xs shadow-lg active:scale-95 transition-all"
        >
          <Phone size={14} /> <span>Llamar</span>
        </button>
      </div>

      {/* Modal / Banner de Llamada de Voz Activa o Entrante */}
      {activeCall && (
        <div className="bg-gradient-to-r from-amber-600 to-amber-700 p-4 flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-3">
            <PhoneCall size={20} className="text-white animate-bounce" />
            <div>
              <p className="font-black text-xs text-white">
                {activeCall.callerId === currentUserId
                  ? `Llamando a ${activeCall.receiverName}...`
                  : `Llamada entrante de ${activeCall.callerName}`}
              </p>
              <p className="text-[10px] text-amber-100 font-bold uppercase tracking-wider">
                {activeCall.status === 'ringing' ? 'Timbres...' : 'En llamada de voz'}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {activeCall.receiverId === currentUserId && activeCall.status === 'ringing' && (
              <button
                onClick={() => updateCallStatus('connected')}
                className="bg-green-500 hover:bg-green-400 text-white px-3 py-1.5 rounded-xl font-black text-xs shadow-md"
              >
                Contestar
              </button>
            )}
            <button
              onClick={() => updateCallStatus('ended')}
              className="bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded-xl font-black text-xs shadow-md"
            >
              Colgar
            </button>
          </div>
        </div>
      )}

      {/* Lista de Mensajes */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#121318]/50">
        {conversation.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-gray-500 p-6">
            <span className="text-4xl block mb-2">📻</span>
            <p className="font-bold text-sm text-gray-300">Canal de Radio Limpio</p>
            <p className="text-xs text-gray-500 mt-1">Envía una nota de voz o mensaje para coordinar la entrega o novedades.</p>
          </div>
        ) : (
          conversation.map(msg => {
            const isMe = msg.senderId === currentUserId;
            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div className="text-[10px] font-bold text-gray-400 mb-1 px-1">
                  {msg.senderName} ({msg.senderRole})
                </div>

                <div className={`max-w-[82%] rounded-2xl p-3 shadow-md ${
                  isMe
                    ? 'bg-amber-500 text-gray-950 font-bold rounded-tr-none'
                    : 'bg-[#242632] text-gray-100 rounded-tl-none border border-gray-700/50'
                }`}>

                  {/* Mensaje de Texto */}
                  {msg.type === 'text' && (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                  )}

                  {/* Foto enviada */}
                  {msg.type === 'photo' && (
                    <div className="space-y-2">
                      <img src={msg.mediaUrl} alt="Adjunto" className="rounded-xl max-h-48 object-cover border border-black/20" />
                      {msg.text && <p className="text-sm">{msg.text}</p>}
                    </div>
                  )}

                  {/* Nota de voz */}
                  {msg.type === 'audio' && (
                    <div className="flex items-center gap-3 py-1">
                      <button
                        onClick={() => togglePlayAudio(msg.id, msg.mediaUrl)}
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-transform active:scale-90 ${
                          isMe ? 'bg-gray-950 text-amber-400' : 'bg-amber-500 text-gray-950'
                        }`}
                      >
                        {playingAudioId === msg.id ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
                      </button>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <Volume2 size={14} />
                          <span className="text-xs font-black">Nota de voz</span>
                        </div>
                        <span className="text-[10px] opacity-80">{msg.durationSeconds || 0}s</span>
                      </div>
                    </div>
                  )}

                  {/* Log de llamada */}
                  {msg.type === 'call_log' && (
                    <div className="flex items-center gap-2 text-xs py-1">
                      <PhoneCall size={16} />
                      <span>{msg.text}</span>
                    </div>
                  )}

                  {/* Footer del mensaje */}
                  <div className={`flex items-center justify-end gap-1 mt-1 text-[9px] ${isMe ? 'text-gray-900/70' : 'text-gray-400'}`}>
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
        <div className="p-3 bg-[#1e1f26] border-t border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={photoPreview} alt="Preview" className="w-12 h-12 rounded-xl object-cover" />
            <span className="text-xs font-bold text-gray-300">Foto lista para enviar</span>
          </div>
          <button onClick={() => setPhotoPreview(null)} className="text-red-400 hover:text-red-300 text-xs font-bold px-2 py-1">
            ✕ Quitar
          </button>
        </div>
      )}

      {/* Barra de Grabación activa */}
      {isRecording && (
        <div className="p-3 bg-red-950/80 border-t border-red-800 flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-red-500 animate-ping"></span>
            <span className="text-xs font-black text-red-200">Graba nota de voz: {recordingTime}s</span>
          </div>
          <button
            onClick={stopRecording}
            className="flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-black px-4 py-2 rounded-xl"
          >
            <Square size={14} /> Soltar y Enviar
          </button>
        </div>
      )}

      {/* Barra Inferior de Entrada */}
      <form onSubmit={handleSendText} className="p-3 bg-[#1e1f26] border-t border-gray-800 flex items-center gap-2">
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoSelect} />
        <input ref={galleryInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />

        {/* Fotos */}
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          className="p-2.5 rounded-2xl bg-[#2a2d38] text-gray-400 hover:text-amber-400 transition-colors"
          title="Tomar Foto"
        >
          <Camera size={18} />
        </button>

        {/* Input Texto */}
        <input
          type="text"
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          placeholder="Escribe un mensaje o envía nota de voz..."
          className="flex-1 bg-[#121318] border border-gray-700/60 rounded-2xl py-2.5 px-4 text-xs font-bold text-white outline-none focus:border-amber-500"
        />

        {/* Enviar Texto / Grabar Audio */}
        {textInput.trim() || photoPreview ? (
          <button
            type="submit"
            className="p-2.5 bg-amber-500 hover:bg-amber-400 text-gray-950 font-black rounded-2xl shadow-lg active:scale-95 transition-all"
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
              isRecording ? 'bg-red-600 text-white' : 'bg-[#2a2d38] text-amber-400 hover:bg-amber-500 hover:text-gray-950'
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
