import React, { useState } from 'react';
import { X, Clock, AlertTriangle, CheckCircle, Trash2, Save } from 'lucide-react';
import { DailyShiftBlock, EmployeeWeeklyPayroll } from '../hooks/useAttendanceData';
import { useAttendanceStore } from '../../../store/useAttendanceStore';

interface ShiftDetailModalProps {
  employee: EmployeeWeeklyPayroll;
  dateStr: string;
  block?: DailyShiftBlock;
  onClose: () => void;
}

export function ShiftDetailModal({ employee, dateStr, block, onClose }: ShiftDetailModalProps) {
  const { shiftTemplates, upsertShiftOverride, deleteShiftOverride, shiftOverrides } = useAttendanceStore();

  const existingOverride = shiftOverrides.find(
    (o) => (o.employeeId === employee.employeeId || o.employeeId === employee.employeeNo) && o.date === dateStr
  );

  const [selectedShiftId, setSelectedShiftId] = useState<string>(block?.shiftId || shiftTemplates[0]?.id || '');
  const [firstInTime, setFirstInTime] = useState<string>(block?.firstIn?.slice(0, 5) || '06:00');
  const [lastOutTime, setLastOutTime] = useState<string>(block?.lastOut?.slice(0, 5) || '14:00');
  const [notes, setNotes] = useState<string>(existingOverride?.notes || '');

  const handleSave = () => {
    upsertShiftOverride({
      id: existingOverride?.id || `OVR-${Date.now()}`,
      employeeId: employee.employeeId,
      date: dateStr,
      shiftId: selectedShiftId,
      customFirstIn: firstInTime ? `${firstInTime}:00` : undefined,
      customLastOut: lastOutTime ? `${lastOutTime}:00` : undefined,
      notes,
      updatedAt: new Date().toISOString(),
    });
    onClose();
  };

  const handleDelete = () => {
    if (existingOverride) {
      deleteShiftOverride(existingOverride.id);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center font-black text-sm text-white shadow-sm"
              style={{ backgroundColor: employee.avatarColor }}
            >
              {employee.initials}
            </div>
            <div>
              <h3 className="font-black text-base text-gray-900 leading-tight">{employee.fullName}</h3>
              <p className="text-xs font-bold text-gray-400">Jornada del {dateStr}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 cursor-pointer">
            <X size={20} />
          </button>
        </div>

        {/* Detalle y Penalizaciones actuales */}
        {block && (
          <div className="my-4 bg-gray-50 rounded-2xl p-4 border border-gray-200/80 space-y-2">
            <div className="flex justify-between items-center text-xs font-bold">
              <span className="text-gray-500">Formato de Bloque:</span>
              <span className="font-black text-gray-900 bg-white px-2 py-1 rounded-lg border border-gray-200">
                {block.displayPillText}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-bold pt-2 border-t border-gray-200">
              <div>
                <span className="text-gray-400 block text-[10px]">MINUTOS BRUTOS</span>
                <span className="text-gray-800 font-black">{block.grossMinutes} min</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px]">HORAS NETAS APROBADAS</span>
                <span className="text-emerald-600 font-black">{block.formattedTotal} h</span>
              </div>
            </div>

            {/* Desglose de Descuentos */}
            {(block.isTardy || block.isMissingMarks) && (
              <div className="pt-2 border-t border-amber-200 text-xs text-amber-900 space-y-1">
                {block.isTardy && (
                  <div className="flex items-center gap-1.5 text-amber-800 font-bold">
                    <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                    <span>Tardanza (&gt; 5 min): Descuento -30 min (-0.5h)</span>
                  </div>
                )}
                {block.isMissingMarks && (
                  <div className="flex items-center gap-1.5 text-red-700 font-bold">
                    <AlertTriangle size={14} className="text-red-500 shrink-0" />
                    <span>Marca Faltante (Sin entrada/salida): Descuento -30 min (-0.5h)</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Formularios de Edición Manual */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-black text-gray-700 mb-1.5">Plantilla de Turno Asignado</label>
            <select
              value={selectedShiftId}
              onChange={(e) => setSelectedShiftId(e.target.value)}
              className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 outline-none focus:border-amber-500"
            >
              {shiftTemplates.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name} ({st.startTime} - {st.endTime})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black text-gray-700 mb-1">Hora Entrada (HH:mm)</label>
              <input
                type="time"
                value={firstInTime}
                onChange={(e) => setFirstInTime(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-black text-gray-700 mb-1">Hora Salida (HH:mm)</label>
              <input
                type="time"
                value={lastOutTime}
                onChange={(e) => setLastOutTime(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-black text-gray-700 mb-1">Observaciones / Justificación</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej. Permiso médico justificado, cambio de turno..."
              className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-medium text-gray-900 outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Acciones */}
        <div className="flex items-center justify-between gap-3 pt-5 mt-4 border-t border-gray-100">
          {existingOverride ? (
            <button
              onClick={handleDelete}
              className="px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Trash2 size={15} />
              Quitar Ajuste
            </button>
          ) : <div></div>}

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 text-xs font-black bg-amber-400 hover:bg-amber-500 text-gray-950 rounded-xl flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
            >
              <Save size={15} />
              Guardar Turno
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
