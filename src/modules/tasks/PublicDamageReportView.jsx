import React, { useState } from 'react';
import { useTaskStore } from '../../store/useTaskStore';
import { 
  AlertTriangle, Camera, Video, Send, CheckCircle2, QrCode, 
  Wrench, ShieldAlert, Phone, User, Building2, FileText, ArrowLeft
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

export function PublicDamageReportView() {
  const navigate = useNavigate();
  const { addDamageReport } = useTaskStore();

  const [equipmentName, setEquipmentName] = useState('');
  const [description, setDescription] = useState('');
  const [branchId, setBranchId] = useState('Principal');
  const [reportedBy, setReportedBy] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [mediaType, setMediaType] = useState('photo'); // 'photo' | 'video'
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);

  const currentUrl = window.location.href;
  const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=' + encodeURIComponent(currentUrl);

  const EQUIPMENT_PRESETS = [
    '🔥 Freidora Principal',
    '❄️ Congelador / Congelador Fritos',
    '🍳 Plancha de Cocina',
    '🖥️ Pantalla POS / Caja Registradora',
    '🖨️ Impresora de Comandas',
    '💡 Iluminación / Electricidad',
    '🚰 Tubería / Grifo / Aseo',
    '⚙️ Otro Equipo'
  ];

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVid = file.type.startsWith('video/');
    setMediaType(isVid ? 'video' : 'photo');
    setMediaFile(file);

    const reader = new FileReader();
    reader.onload = (evt) => {
      setMediaPreview(evt.target?.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!equipmentName.trim()) {
      toast.error('Selecciona o escribe el equipo afectado');
      return;
    }
    if (!description.trim()) {
      toast.error('Explica brevemente la falla o daño');
      return;
    }

    addDamageReport({
      equipmentName: equipmentName.trim(),
      description: description.trim(),
      branchId,
      reportedBy: reportedBy.trim() || 'Colaborador / Anónimo',
      contactPhone: contactPhone.trim(),
      mediaUrl: mediaPreview || null,
      mediaType,
    });

    setIsSubmitted(true);
    toast.success('🚨 Reporte enviado al administrador');
  };

  return (
    <div className="min-h-screen bg-[#0d0e12] text-gray-200 flex flex-col font-sans justify-between p-4 sm:p-6">
      
      {/* Top Bar Header */}
      <header className="max-w-xl mx-auto w-full flex items-center justify-between py-2 border-b border-gray-800">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={16} />
          <span>Inicio</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xl">🛠️</span>
          <span className="font-black text-sm text-white">Frita Mejor • Mantenimiento</span>
        </div>

        <button
          onClick={() => setShowQRModal(true)}
          className="text-amber-400 hover:text-amber-300 p-1 transition-colors flex items-center gap-1 text-xs font-bold"
          title="Ver Código QR de este formulario"
        >
          <QrCode size={18} />
          <span className="hidden sm:inline">QR</span>
        </button>
      </header>

      {/* Main Container */}
      <main className="max-w-xl mx-auto w-full flex-1 flex flex-col justify-center my-6">
        {isSubmitted ? (
          <div className="bg-[#181920] border-2 border-emerald-500 rounded-3xl p-8 text-center space-y-6 shadow-2xl animate-fade-in">
            <div className="w-20 h-20 bg-emerald-500/20 text-emerald-400 border-2 border-emerald-500 rounded-full flex items-center justify-center mx-auto text-4xl">
              <CheckCircle2 size={48} />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-black text-white">¡Reporte Enviado Exitosamente!</h2>
              <p className="text-xs text-gray-300 max-w-sm mx-auto leading-relaxed">
                El administrador y el equipo técnico han recibido el aviso de la falla en <span className="font-bold text-amber-400">{equipmentName}</span>. Se asignará prioridad alta para su reparación.
              </p>
            </div>

            <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => {
                  setIsSubmitted(false);
                  setEquipmentName('');
                  setDescription('');
                  setMediaPreview(null);
                  setMediaFile(null);
                }}
                className="bg-amber-500 hover:bg-amber-600 text-gray-950 font-black text-xs px-6 py-3 rounded-2xl transition-all shadow-lg active:scale-95"
              >
                + Enviar Otro Reporte
              </button>
              <button
                onClick={() => navigate('/tareas')}
                className="bg-gray-800 hover:bg-gray-700 text-gray-200 font-bold text-xs px-6 py-3 rounded-2xl transition-all active:scale-95"
              >
                Ver Panel de Tareas
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-[#16171d] border border-gray-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
            
            {/* Header del Formulario */}
            <div className="space-y-2 border-b border-gray-800 pb-5">
              <div className="inline-flex items-center gap-2 bg-red-500/20 border border-red-500/40 text-red-400 text-xs font-black px-3 py-1 rounded-full">
                <AlertTriangle size={14} />
                <span>Aviso Rápido de Daño o Falla</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Reportar Equipo Dañado o Reparación
              </h1>
              <p className="text-xs text-gray-400">
                Escanea este formulario desde tu móvil para notificar averías y adjuntar foto o video evidencia.
              </p>
            </div>

            {/* 1. Selección de Equipo */}
            <div className="space-y-2">
              <label className="text-xs font-black text-gray-300 flex items-center gap-2">
                <Wrench size={14} className="text-amber-400" />
                ¿Qué equipo o área presenta la falla? *
              </label>

              <div className="grid grid-cols-2 gap-2">
                {EQUIPMENT_PRESETS.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setEquipmentName(item)}
                    className={
                      equipmentName === item
                        ? 'p-2.5 rounded-xl border text-left text-xs font-bold transition-all bg-amber-500 text-gray-950 border-amber-400 shadow-md'
                        : 'p-2.5 rounded-xl border border-gray-800 text-left text-xs font-medium transition-all bg-[#1e1f26] text-gray-300 hover:border-gray-700 hover:text-white'
                    }
                  >
                    {item}
                  </button>
                ))}
              </div>

              <input
                type="text"
                placeholder="O escribe el nombre específico del equipo..."
                value={equipmentName}
                onChange={(e) => setEquipmentName(e.target.value)}
                className="w-full bg-[#121318] border border-gray-700 rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* 2. Sede */}
            <div className="space-y-2">
              <label className="text-xs font-black text-gray-300 flex items-center gap-2">
                <Building2 size={14} className="text-amber-400" />
                Sede / Ubicación *
              </label>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="w-full bg-[#121318] border border-gray-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500 font-bold"
              >
                <option value="Principal">Sede Principal</option>
                <option value="Sede Norte">Sede Norte</option>
                <option value="Sede Sur">Sede Sur</option>
                <option value="GLOBAL">Todas / General</option>
              </select>
            </div>

            {/* 3. Explicación del Daño */}
            <div className="space-y-2">
              <label className="text-xs font-black text-gray-300 flex items-center gap-2">
                <FileText size={14} className="text-amber-400" />
                Descripción del Daño / Síntomas *
              </label>
              <textarea
                rows={3}
                placeholder="Ej: La freidora 2 no calienta y huele a quemado. Empezó a fallar a las 10 AM."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-[#121318] border border-gray-700 rounded-xl p-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 resize-none"
              />
            </div>

            {/* 4. Evidencia Media (Foto o Video) */}
            <div className="space-y-2">
              <label className="text-xs font-black text-gray-300 flex items-center gap-2">
                <Camera size={14} className="text-amber-400" />
                Adjuntar Foto o Video Evidencia (Opcional)
              </label>

              {mediaPreview ? (
                <div className="relative rounded-2xl overflow-hidden border border-gray-700 bg-black">
                  {mediaType === 'video' ? (
                    <video src={mediaPreview} controls className="w-full h-48 object-cover" />
                  ) : (
                    <img src={mediaPreview} alt="Evidencia" className="w-full h-48 object-cover" />
                  )}
                  <button
                    type="button"
                    onClick={() => { setMediaPreview(null); setMediaFile(null); }}
                    className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white font-black text-xs px-3 py-1 rounded-full shadow-lg"
                  >
                    Cambiar
                  </button>
                </div>
              ) : (
                <label className="cursor-pointer border-2 border-dashed border-gray-700 hover:border-amber-500 bg-[#121318] hover:bg-[#181922] rounded-2xl p-6 text-center block transition-all group">
                  <div className="flex justify-center gap-3 mb-2 text-gray-400 group-hover:text-amber-400">
                    <Camera size={24} />
                    <Video size={24} />
                  </div>
                  <p className="text-xs font-bold text-gray-300">
                    Toca aquí para tomar Foto o grabar Video
                  </p>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    Soporta imágenes de cámara o galería
                  </p>
                  <input
                    type="file"
                    accept="image/*,video/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </label>
              )}
            </div>

            {/* 5. Datos de contacto opcionales */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-gray-800">
              <div>
                <label className="text-[11px] font-bold text-gray-400 flex items-center gap-1.5 mb-1">
                  <User size={12} /> Tu Nombre (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej: Carlos (Cajero)"
                  value={reportedBy}
                  onChange={(e) => setReportedBy(e.target.value)}
                  className="w-full bg-[#121318] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-400 flex items-center gap-1.5 mb-1">
                  <Phone size={12} /> WhatsApp / Teléfono (Opcional)
                </label>
                <input
                  type="tel"
                  placeholder="Ej: 300 123 4567"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="w-full bg-[#121318] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-black text-sm py-3.5 rounded-2xl shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <Send size={18} />
              <span>ENVIAR REPORTE DE DAÑO</span>
            </button>

          </form>
        )}
      </main>

      {/* Footer Branding */}
      <footer className="max-w-xl mx-auto w-full text-center text-[11px] text-gray-500">
        Frita Mejor • Sistema de Control & Mantenimiento 🛠️
      </footer>

      {/* MODAL MOSTRAR QR PARA IMPRIMIR O PEGAR EN LA COCINA */}
      {showQRModal && (
        <div className="fixed inset-0 z-[100] bg-black bg-opacity-80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#181920] border border-gray-800 rounded-3xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl">
            <h3 className="text-base font-black text-white flex items-center justify-center gap-2">
              <QrCode className="text-amber-400" size={20} />
              Código QR de Reportes
            </h3>

            <p className="text-xs text-gray-300">
              Imprime o pega este código QR cerca de las freidoras y equipos. Cualquier colaborador podrá escanearlo y reportar averías al instante.
            </p>

            <div className="bg-white p-4 rounded-2xl inline-block shadow-lg mx-auto">
              <img src={qrUrl} alt="Código QR Reportes" className="w-52 h-52 object-contain mx-auto" />
            </div>

            <p className="text-[11px] text-amber-400 font-mono break-all bg-gray-900 p-2 rounded-xl border border-gray-800">
              {currentUrl}
            </p>

            <button
              onClick={() => setShowQRModal(false)}
              className="w-full bg-gray-800 hover:bg-gray-700 text-gray-200 font-bold text-xs py-2.5 rounded-xl transition-all"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
