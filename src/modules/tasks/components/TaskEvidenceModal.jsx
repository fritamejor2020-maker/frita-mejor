import React, { useState, useRef } from 'react';
import { 
  Camera, Upload, X, RotateCw, CheckCircle2, 
  Thermometer, Droplets, FileText, AlertTriangle 
} from 'lucide-react';
import toast from 'react-hot-toast';

export function TaskEvidenceModal({ task, onClose, onComplete }) {
  const [photoDataUrl, setPhotoDataUrl] = useState('');
  const [photoRotation, setPhotoRotation] = useState(0);
  const [note, setNote] = useState('');
  const [fryerTemp, setFryerTemp] = useState('');
  const [freezerTemp, setFreezerTemp] = useState('');
  const [oilCondition, setOilCondition] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const cameraInputRef = useRef(null);
  const fileInputRef = useRef(null);

  if (!task) return null;

  // Procesar y rotar imagen
  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
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

        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
        setPhotoDataUrl(compressedDataUrl);
        setPhotoRotation(0);
        setIsProcessing(false);
      };
      img.src = event.target?.result;
    };
    reader.readAsDataURL(file);
  };

  const getRotatedDataUrl = async (dataUrl, degrees) => {
    if (!dataUrl || degrees === 0) return dataUrl;
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const rad = (degrees * Math.PI) / 180;
        const swap = degrees === 90 || degrees === 270;
        const w = swap ? img.height : img.width;
        const h = swap ? img.width : img.height;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.translate(w / 2, h / 2);
        ctx.rotate(rad);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = dataUrl;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (task.requirePhoto && !photoDataUrl) {
      toast.error('📷 Esta tarea requiere foto obligatoria antes de completar');
      return;
    }

    setIsProcessing(true);
    let finalPhoto = photoDataUrl;
    if (photoDataUrl && photoRotation !== 0) {
      finalPhoto = await getRotatedDataUrl(photoDataUrl, photoRotation);
    }

    onComplete(task.id, {
      photoUrl: finalPhoto || null,
      note: note.trim() || null,
      fryerTemp: fryerTemp.trim() || null,
      freezerTemp: freezerTemp.trim() || null,
      oilCondition: oilCondition || null,
    });

    toast.success('✅ Tarea completada con evidencia');
    setIsProcessing(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[999] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-fadeIn">
      <div className="bg-[#181920] border-2 border-amber-500/80 rounded-3xl max-w-lg w-full p-6 shadow-2xl text-gray-200 relative overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4 pb-3 border-b border-gray-800">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                Evidencia de Tarea
              </span>
              {task.requirePhoto && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded bg-red-950 text-red-300 border border-red-500/50 flex items-center gap-1">
                  <Camera size={11} /> Foto Obligatoria
                </span>
              )}
            </div>
            <h3 className="text-lg font-black text-white leading-tight">
              {task.title}
            </h3>
            {task.description && (
              <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                {task.description}
              </p>
            )}
          </div>

          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white p-1 rounded-xl hover:bg-gray-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-4 pr-1">
          
          {/* ── Captura de Foto ── */}
          <div>
            <label className="text-xs font-bold text-gray-300 block mb-2 flex items-center gap-1.5">
              <Camera size={14} className="text-amber-400" />
              <span>Evidencia Fotográfica {task.requirePhoto ? '(Requerida)' : '(Opcional)'}</span>
            </label>

            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              ref={cameraInputRef}
              onChange={handleFile}
            />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFile}
            />

            {photoDataUrl ? (
              <div className="relative rounded-2xl overflow-hidden border border-gray-700 bg-black/50">
                <img
                  src={photoDataUrl}
                  alt="Evidencia"
                  style={{ transform: `rotate(${photoRotation}deg)`, transition: 'transform 0.2s ease' }}
                  className="w-full h-52 object-contain bg-black"
                />
                
                {/* Controles sobre la foto */}
                <div className="absolute top-2 left-2 flex gap-1.5 bg-black/60 backdrop-blur-sm p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setPhotoRotation(r => (r + 90) % 360)}
                    className="text-white hover:text-amber-400 p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                    title="Rotar Foto"
                  >
                    <RotateCw size={15} />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => { setPhotoDataUrl(''); setPhotoRotation(0); }}
                  className="absolute top-2 right-2 bg-red-600/80 hover:bg-red-600 text-white p-1.5 rounded-xl transition-colors"
                  title="Eliminar Foto"
                >
                  <X size={15} />
                </button>

                <div className="absolute bottom-0 inset-x-0 bg-emerald-950/80 border-t border-emerald-500/30 px-3 py-1 text-[11px] text-emerald-300 font-bold flex items-center justify-between">
                  <span>✓ Foto lista para subir</span>
                  {photoRotation !== 0 && <span>Rotación: {photoRotation}°</span>}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="bg-[#21232e] hover:bg-[#2a2d3b] border border-dashed border-gray-700 hover:border-amber-500 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 text-center transition-all cursor-pointer group"
                >
                  <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Camera size={20} />
                  </div>
                  <span className="text-xs font-bold text-gray-200">Tomar con Cámara</span>
                  <span className="text-[10px] text-gray-500">Abre cámara trasera</span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-[#21232e] hover:bg-[#2a2d3b] border border-dashed border-gray-700 hover:border-blue-500 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 text-center transition-all cursor-pointer group"
                >
                  <div className="w-10 h-10 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Upload size={20} />
                  </div>
                  <span className="text-xs font-bold text-gray-200">Subir Archivo</span>
                  <span className="text-[10px] text-gray-500">Galería de imágenes</span>
                </button>
              </div>
            )}
          </div>

          {/* ── Mediciones BPM (Opcionales / Cocina) ── */}
          <div className="bg-[#14151b] border border-gray-800 rounded-2xl p-3.5 space-y-3">
            <span className="text-[11px] font-black uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
              <Thermometer size={13} className="text-amber-400" />
              <span>Mediciones BPM y Calidad (Opcional)</span>
            </span>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] font-bold text-gray-400 block mb-1">
                  Temp. Freidora (°C)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    placeholder="Ej: 175"
                    value={fryerTemp}
                    onChange={(e) => setFryerTemp(e.target.value)}
                    className="w-full bg-[#1b1c24] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-400"
                  />
                  <span className="absolute right-3 top-2 text-xs text-gray-500 font-bold">°C</span>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-400 block mb-1">
                  Temp. Nevera / Congelador
                </label>
                <div className="relative">
                  <input
                    type="number"
                    placeholder="Ej: 4 ó -18"
                    value={freezerTemp}
                    onChange={(e) => setFreezerTemp(e.target.value)}
                    className="w-full bg-[#1b1c24] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-400"
                  />
                  <span className="absolute right-3 top-2 text-xs text-gray-500 font-bold">°C</span>
                </div>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-gray-400 block mb-1 flex items-center gap-1">
                <Droplets size={12} className="text-amber-400" />
                <span>Estado del Aceite</span>
              </label>
              <select
                value={oilCondition}
                onChange={(e) => setOilCondition(e.target.value)}
                className="w-full bg-[#1b1c24] border border-gray-700 rounded-xl px-3 py-2 text-xs text-gray-200 font-bold focus:outline-none focus:border-amber-400"
              >
                <option value="">Seleccionar estado del aceite...</option>
                <option value="OPTIMO">✨ Óptimo / Aceite Limpio y Claro</option>
                <option value="NORMAL">👍 Uso Normal / Operativo</option>
                <option value="REQUIERE_FILTRADO">⚠️ Requiere Filtrado en este turno</option>
                <option value="CAMBIO_URGENTE">🚨 Requiere Cambio Urgente (Oscuro / Humo)</option>
              </select>
            </div>
          </div>

          {/* ── Observaciones o Notas ── */}
          <div>
            <label className="text-xs font-bold text-gray-300 block mb-1.5 flex items-center gap-1.5">
              <FileText size={14} className="text-gray-400" />
              <span>Notas u Observaciones del Operario</span>
            </label>
            <textarea
              rows={2}
              placeholder="Detalles sobre cómo se realizó la tarea o novedades encontradas..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full bg-[#14151b] border border-gray-700 rounded-2xl p-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-400 resize-none"
            />
          </div>

          {/* Botones de acción */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-gray-800">
            <button
              type="button"
              onClick={onClose}
              className="bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isProcessing}
              className="bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-gray-950 font-black text-xs px-5 py-2.5 rounded-xl transition-all shadow-lg flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 size={16} />
              <span>{isProcessing ? 'Guardando...' : 'Completar Tarea'}</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
