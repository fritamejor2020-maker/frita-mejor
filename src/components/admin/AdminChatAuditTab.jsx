import React, { useState } from 'react';
import { useChatStore } from '../../store/useChatStore';
import { formatMoney } from '../../utils/formatUtils';
import {
  MessageSquare, Mic, Camera, PhoneCall, Volume2, Play, Pause,
  Calendar, User, Filter, Search, ShieldCheck
} from 'lucide-react';

/**
 * Tab de Auditoría y Supervisión de Chats para la Administración
 */
export const AdminChatAuditTab = () => {
  const { messages } = useChatStore();
  const [selectedBranch, setSelectedBranch] = useState('ALL');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [playingAudioId, setPlayingAudioId] = useState(null);
  const [viewingPhotoUrl, setViewingPhotoUrl] = useState(null);
  const audioRef = React.useRef(null);

  // Filtrado de mensajes
  const filteredMessages = messages.filter(m => {
    if (selectedBranch !== 'ALL' && m.branchId !== selectedBranch) return false;
    if (selectedRoleFilter !== 'ALL' && m.senderRole !== selectedRoleFilter) return false;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchText = (m.text || '').toLowerCase().includes(query);
      const matchSender = (m.senderName || '').toLowerCase().includes(query);
      const matchReceiver = (m.receiverName || '').toLowerCase().includes(query);
      if (!matchText && !matchSender && !matchReceiver) return false;
    }
    return true;
  });

  // Métricas KPI
  const totalAudios = filteredMessages.filter(m => m.type === 'audio').length;
  const totalPhotos = filteredMessages.filter(m => m.type === 'photo').length;
  const totalCalls  = filteredMessages.filter(m => m.type === 'call_log').length;

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

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="bg-gradient-to-r from-violet-900 to-indigo-900 rounded-3xl p-6 text-white shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider">
              👑 Auditoría Admin
            </span>
            <span className="bg-green-500/30 text-green-300 text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span> Monitoreo en Vivo
            </span>
          </div>
          <h2 className="text-2xl font-black mt-2">💬 Centro de Auditoría de Chats & Radio</h2>
          <p className="text-xs text-violet-200 mt-1 font-medium">
            Supervisa todas las notas de voz, mensajes de texto, fotografías y llamadas entre Vendedores y Dejadores.
          </p>
        </div>
      </div>

      {/* Tarjetas KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center font-black">
            <MessageSquare size={20} />
          </div>
          <div>
            <span className="text-xs font-bold text-gray-400 block">Mensajes Totales</span>
            <span className="text-xl font-black text-gray-900">{filteredMessages.length}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center font-black">
            <Mic size={20} />
          </div>
          <div>
            <span className="text-xs font-bold text-gray-400 block">Notas de Voz</span>
            <span className="text-xl font-black text-gray-900">{totalAudios}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-black">
            <Camera size={20} />
          </div>
          <div>
            <span className="text-xs font-bold text-gray-400 block">Fotos Enviadas</span>
            <span className="text-xl font-black text-gray-900">{totalPhotos}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-100 text-green-600 flex items-center justify-center font-black">
            <PhoneCall size={20} />
          </div>
          <div>
            <span className="text-xs font-bold text-gray-400 block">Llamadas Reg.</span>
            <span className="text-xl font-black text-gray-900">{totalCalls}</span>
          </div>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200/60 flex flex-wrap gap-3 items-center justify-between">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <Search size={16} className="text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre, vendedor, dejador o texto..."
            className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-800 outline-none focus:border-violet-500"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={selectedRoleFilter}
            onChange={(e) => setSelectedRoleFilter(e.target.value)}
            className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-700 outline-none"
          >
            <option value="ALL">👥 Todos los Roles</option>
            <option value="VENDEDOR">🛵 Solo Vendedores</option>
            <option value="DEJADOR">🚚 Solo Dejadores</option>
          </select>
        </div>
      </div>

      {/* Lista de Conversaciones y Transcripción */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-4 sm:p-6 space-y-3">
        <h3 className="font-black text-sm text-gray-800 flex items-center gap-2 mb-4">
          <ShieldCheck size={16} className="text-violet-600" /> Registro de Transmisiones de Radio / Chat
        </h3>

        {filteredMessages.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <span className="text-4xl block mb-2">📻</span>
            <p className="font-bold text-sm">Sin registros de comunicación para los filtros seleccionados</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
            {filteredMessages.map(msg => (
              <div key={msg.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xs text-white shrink-0 ${
                    msg.senderRole === 'VENDEDOR' ? 'bg-amber-500' : msg.senderRole === 'DEJADOR' ? 'bg-violet-600' : 'bg-blue-600'
                  }`}>
                    {msg.senderRole === 'VENDEDOR' ? '🛵' : '🚚'}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-gray-900 text-sm">{msg.senderName}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">
                        {msg.senderRole}
                      </span>
                      <span className="text-gray-400 font-bold text-[10px]">➔ para {msg.receiverName}</span>
                    </div>

                    {/* Mensaje de texto */}
                    {msg.type === 'text' && (
                      <p className="text-xs font-bold text-gray-700 mt-1">{msg.text}</p>
                    )}

                    {/* Nota de Voz */}
                    {msg.type === 'audio' && (
                      <div className="flex items-center gap-3 mt-1.5 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl max-w-xs">
                        <button
                          onClick={() => togglePlayAudio(msg.id, msg.mediaUrl)}
                          className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center active:scale-90"
                        >
                          {playingAudioId === msg.id ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
                        </button>
                        <div>
                          <p className="text-xs font-black text-amber-900 flex items-center gap-1">
                            <Mic size={12} /> Nota de Voz ({msg.durationSeconds || 0}s)
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Foto enviada */}
                    {msg.type === 'photo' && (
                      <div className="mt-1.5">
                        <img
                          src={msg.mediaUrl}
                          alt="Comprobante"
                          onClick={() => setViewingPhotoUrl(msg.mediaUrl)}
                          className="w-24 h-24 object-cover rounded-xl border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity"
                        />
                        {msg.text && <p className="text-xs font-bold text-gray-700 mt-1">{msg.text}</p>}
                      </div>
                    )}

                    {/* Registro de Llamada */}
                    {msg.type === 'call_log' && (
                      <div className="flex items-center gap-1.5 text-xs font-bold text-green-700 mt-1 bg-green-50 px-3 py-1 rounded-xl w-max">
                        <PhoneCall size={14} />
                        <span>{msg.text} ({msg.durationSeconds || 0}s)</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-[10px] font-bold text-gray-400 self-end sm:self-center shrink-0">
                  {new Date(msg.createdAt).toLocaleString('es-CO')}
                </div>

              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal visor de foto */}
      {viewingPhotoUrl && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setViewingPhotoUrl(null)}>
          <div className="relative max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <img src={viewingPhotoUrl} alt="Foto" className="w-full rounded-2xl shadow-2xl" />
            <button
              onClick={() => setViewingPhotoUrl(null)}
              className="absolute top-3 right-3 bg-white text-gray-800 w-8 h-8 rounded-full font-black text-sm flex items-center justify-center shadow-lg"
            >
              ✕
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
