import React, { useState, useRef } from 'react';
import { useInventoryStore } from '../../../store/useInventoryStore';
import { useFinanceStore } from '../../../store/useFinanceStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { Button } from '../../../components/ui/Button';
import { formatMoney, compressImage } from '../../../utils/formatUtils';
import { X, Plus, Trash2, Camera, CheckCircle, Clock } from 'lucide-react';
import { toast } from 'react-hot-toast';

export function PosDescarguesModal({ activeShift, onClose }) {
  const { user } = useAuthStore();
  const { posDescargues, addPosDescargue, deletePosDescargue } = useInventoryStore();
  const { addIncome } = useFinanceStore();

  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [photoBase64, setPhotoBase64] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const photoInputRef = useRef(null);

  if (!activeShift) return null;

  // Descargues específicos de este turno
  const shiftDescargues = (posDescargues || [])
    .filter(d => d.shiftId === activeShift.id)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  const totalDescargado = shiftDescargues.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  const nextDescargueNumber = shiftDescargues.length + 1;

  const handlePhotoCapture = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file, 800, 0.65);
      setPhotoBase64(compressed || null);
    } catch (_) {
      const reader = new FileReader();
      reader.onload = (ev) => { setPhotoBase64(ev.target.result); };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e) => {
    e?.preventDefault();
    const numAmount = parseFloat(amount) || 0;
    if (numAmount <= 0) {
      toast.error('Ingresa un monto válido para el descargue');
      return;
    }

    setIsSubmitting(true);
    try {
      const descNumber = nextDescargueNumber;
      const newDesc = addPosDescargue({
        shiftId: activeShift.id,
        number: descNumber,
        amount: numAmount,
        note: note.trim() || null,
        photoBase64: photoBase64 || null,
        cashierId: user?.id,
        cashierName: user?.name || activeShift.userName || 'Cajero',
        registerName: activeShift.registerName || 'Caja Principal',
        branchId: activeShift.branchId || 'BRANCH-001',
      });

      try {
        const hour = new Date().getHours();
        const jornada = activeShift.jornada || (hour < 12 ? 'AM' : 'PM');
        addIncome({
          ubicacion: 'Local',
          jornada,
          tipo: jornada === 'AM' ? '6-10 am' : '2-4 pm',
          subtipo: `Descargue ${descNumber} - Local`,
          esDescargue: true,
          vendedor: user?.name || activeShift.userName || 'Cajero',
          creado_por: user?.name || 'Cajero POS',
          efectivo: numAmount,
          salidas: 0,
          transferencias: 0,
          total: numAmount,
          observaciones: note.trim() ? `[Descargue POS #${descNumber}] ${note.trim()}` : `Descargue POS #${descNumber}`,
          fecha: new Date().toISOString(),
          photoBase64: photoBase64 || null,
          posShiftId: activeShift.id,
          posDescargueId: newDesc.id,
        });
      } catch (finErr) {
        console.warn('[PosDescargues] Error reflejando en finanzas:', finErr);
      }

      toast.success(`✔ Descargue #${descNumber} registrado por ${formatMoney(numAmount)}`);
      setAmount('');
      setNote('');
      setPhotoBase64(null);
    } catch (err) {
      toast.error('Error guardando descargue: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (id, number) => {
    if (window.confirm(`¿Estás seguro de anular el Descargue #${number}?`)) {
      deletePosDescargue(id);
      toast.success(`Descargue #${number} eliminado`);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-[#1e1f26] border border-gray-700/60 rounded-[28px] sm:rounded-[32px] w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-gray-800 flex items-center justify-between bg-[#16171d]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 text-xl">
              📦
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
                Descargues de Efectivo
              </h2>
              <p className="text-[11px] text-gray-400 font-bold">
                Retiros parciales de seguridad para aliviar la gaveta
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-5">
          
          {/* Resumen del Turno */}
          <div className="bg-[#16171d] border border-gray-800 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider block">Turno en Curso</span>
              <span className="text-xs font-bold text-gray-300">
                Turno #{activeShift.id.slice(-6)} · {activeShift.userName || 'Cajero'}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-black text-amber-500 uppercase tracking-wider block">Total Descargado</span>
              <span className="text-base sm:text-lg font-black text-amber-400">
                {formatMoney(totalDescargado)}
              </span>
            </div>
          </div>

          {/* Formulario */}
          <form onSubmit={handleSave} className="bg-[#16171d] border border-amber-500/30 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-800 pb-2">
              <span className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <Plus size={14} /> Registrar Descargue #{nextDescargueNumber}
              </span>
              <span className="text-[10px] font-bold text-gray-400">Sobre a caja fuerte</span>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-300 block mb-1.5">
                Monto en Efectivo a Retirar de Gaveta
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-black text-amber-500">$</span>
                <input
                  autoFocus
                  type="number"
                  placeholder="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-[#0c0d11] border-2 border-gray-700 focus:border-amber-500 rounded-2xl py-3 pl-10 pr-4 text-2xl font-black text-white outline-none transition-colors"
                />
              </div>

              {/* Botones rápidos */}
              <div className="grid grid-cols-4 gap-1.5 mt-2">
                {[50000, 100000, 150000, 200000].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setAmount(String(val))}
                    className="py-1 px-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-[10px] font-black text-gray-300 border border-gray-700 active:scale-95 transition-all"
                  >
                    {formatMoney(val).replace(',00', '')}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-300 block mb-1">
                Nota u Observación (Opcional)
              </label>
              <input
                type="text"
                placeholder="Ej: Entregado a administración en sobre #1"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full bg-[#0c0d11] border border-gray-700 focus:border-amber-500 rounded-xl py-2 px-3 text-xs font-bold text-gray-200 outline-none transition-colors"
              />
            </div>

            {/* Foto opcional */}
            <div>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handlePhotoCapture}
              />
              {!photoBase64 ? (
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="w-full py-2 px-3 rounded-xl bg-gray-800/80 hover:bg-gray-800 border border-dashed border-gray-700 text-xs font-bold text-gray-400 hover:text-white flex items-center justify-center gap-2 transition-colors"
                >
                  <Camera size={14} /> Adjuntar Foto del Sobre (Opcional)
                </button>
              ) : (
                <div className="flex items-center justify-between bg-green-950/30 border border-green-500/40 rounded-xl p-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-green-400">
                    <CheckCircle size={14} /> Foto del sobre adjunta
                  </div>
                  <button
                    type="button"
                    onClick={() => setPhotoBase64(null)}
                    className="text-[11px] text-red-400 hover:text-red-300 font-bold px-2 py-0.5"
                  >
                    Quitar
                  </button>
                </div>
              )}
            </div>

            <Button
              type="submit"
              disabled={isSubmitting || !(parseFloat(amount) > 0)}
              className="w-full rounded-xl py-3 font-black text-sm bg-amber-500 text-gray-950 hover:bg-amber-400 active:scale-95 transition-all shadow-md"
            >
              Guardar Descargue #{nextDescargueNumber} ({formatMoney(parseFloat(amount) || 0)})
            </Button>
          </form>

          {/* Historial */}
          <div className="space-y-2">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <Clock size={14} /> Historial del Turno ({shiftDescargues.length})
            </h3>

            {shiftDescargues.length === 0 ? (
              <div className="bg-[#16171d] border border-gray-800 rounded-2xl p-6 text-center text-xs text-gray-500 font-bold">
                Aún no has realizado descargues en este turno.
              </div>
            ) : (
              <div className="space-y-2">
                {shiftDescargues.map((d, index) => (
                  <div
                    key={d.id || index}
                    className="bg-[#16171d] border border-gray-800 hover:border-gray-700 rounded-2xl p-3 flex items-center justify-between transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-black text-xs">
                        #{d.number || index + 1}
                      </div>
                      <div>
                        <div className="text-xs font-black text-white">
                          Descargue #{d.number || index + 1}
                        </div>
                        <div className="text-[10px] text-gray-400 font-bold">
                          {new Date(d.createdAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                          {d.note && ` · ${d.note}`}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-sm font-black text-amber-400">
                        {formatMoney(d.amount)}
                      </span>
                      <button
                        onClick={() => handleDelete(d.id, d.number || index + 1)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-950/40 border border-red-500/30 text-red-400 hover:bg-red-900/50 hover:text-white transition-colors"
                        title="Anular descargue"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800 bg-[#16171d] flex justify-end">
          <Button
            onClick={onClose}
            className="rounded-xl px-5 py-2 font-bold text-xs bg-gray-800 hover:bg-gray-700 text-gray-200"
          >
            Cerrar
          </Button>
        </div>

      </div>
    </div>
  );
}