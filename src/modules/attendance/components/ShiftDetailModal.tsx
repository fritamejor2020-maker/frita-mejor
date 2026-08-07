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
  const { shiftTemplates, upsertShiftOverride, deleteShiftOverride, deleteAttendanceLogsForDate, deleteSingleAttendanceLog, shiftOverrides } = useAttendanceStore();

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

  const handleDeleteBlockLogs = () => {
    const logsToDelete = block?.rawLogs || [];
    const logCount = logsToDelete.length;

    if (logCount > 0) {
      if (confirm(`¿Estás seguro de eliminar únicamente las ${logCount} marcaciones (números de serie) asignadas a este bloque de ${employee.fullName}? (No volverán a cargarse al sincronizar)`)) {
        logsToDelete.forEach((log) => {
          deleteSingleAttendanceLog(log.id, log.serialNo);
        });
        if (existingOverride) {
          deleteShiftOverride(existingOverride.id);
        }
        onClose();
      }
    } else {
      if (confirm(`¿Estás seguro de eliminar el turno y marcaciones de ${employee.fullName} para el día ${dateStr}?`)) {
        if (existingOverride) {
          deleteShiftOverride(existingOverride.id);
        }
        deleteAttendanceLogsForDate(employee.employeeNo, dateStr);
        deleteAttendanceLogsForDate(employee.employeeId, dateStr);
        onClose();
      }
    }
  };

  const handleDeleteSingleLog = (logId: string, serialNo?: number) => {
    if (confirm('¿Deseas eliminar únicamente esta marcación? (No volverá a aparecer al sincronizar)')) {
      deleteSingleAttendanceLog(logId, serialNo);
      onClose();
    }
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

        {/* Detalle y Marcaciones Individuales */}
        {block && (
          <div className="my-4 bg-gray-50 rounded-2xl p-4 border border-gray-200/80 space-y-3">
            <div className="flex justify-between items-center text-xs font-bold">
              <span className="text-gray-500">Horas netas:</span>
              <span className="font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200">
                {block.formattedTotal} h ({block.grossMinutes} min brutos)
              </span>
            </div>

            {/* Marcaciones individuales asociadas a este bloque */}
            {block.rawLogs && block.rawLogs.length > 0 && (
              <div className="pt-2 border-t border-gray-200 space-y-1.5">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">
                  Marcaciones del bloque ({block.rawLogs.length})
                </span>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {block.rawLogs.map((log) => {
                    const timeOnly = log.timestamp ? (log.timestamp.includes('T') ? log.timestamp.slice(11, 19) : log.timestamp.split(' ')[1] || log.timestamp) : '??:??';
                    const isEntry = log.type === 'ENTRY' || (log.type as string).toUpperCase() === 'CHECKIN';
                    return (
                      <div
                        key={log.id}
                        className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-gray-200 text-xs shadow-2xs"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${isEntry ? 'bg-emerald-500' : 'bg-amber-500'}`}
                          />
                          <span className="font-black text-gray-900">{timeOnly}</span>
                          <span className="text-[10px] font-bold text-gray-500">
                            ({isEntry ? 'Entrada' : 'Salida'} • {log.verifyMethod || 'Biométrico'})
                          </span>
                        </div>
                        <button
                          onClick={() => handleDeleteSingleLog(log.id, log.serialNo)}
                          className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Eliminar únicamente esta marcación"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

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
          <button
            onClick={handleDeleteBlockLogs}
            className="px-3 py-2 text-xs font-black text-red-600 hover:bg-red-50 hover:text-red-700 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer border border-red-200 shadow-2xs"
            title="Borrar únicamente los registros con el número de serie asignado a este bloque"
          >
            <Trash2 size={15} />
            Borrar Marcaciones del Bloque
          </button>

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
