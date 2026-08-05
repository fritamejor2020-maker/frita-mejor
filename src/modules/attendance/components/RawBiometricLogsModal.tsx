import React, { useState, useMemo } from 'react';
import { X, Search, Database, Download, Fingerprint, Key, Calendar, Trash2, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { useAttendanceStore, RawAttendanceLog } from '../../../store/useAttendanceStore';
import * as XLSX from 'xlsx';

interface RawBiometricLogsModalProps {
  onClose: () => void;
}

export function RawBiometricLogsModal({ onClose }: RawBiometricLogsModalProps) {
  const { attendanceLogs, employeeContracts, deletedLogIds } = useAttendanceStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState('');

  // Mapeo rápido ID -> Contrato
  const contractMap = useMemo(() => {
    const map: Record<string, string> = {};
    employeeContracts.forEach((c) => {
      map[c.employeeNo] = c.fullName;
      map[c.employeeId] = c.fullName;
    });
    return map;
  }, [employeeContracts]);

  // Filtrado de eventos
  const filteredLogs = useMemo(() => {
    return attendanceLogs.filter((log) => {
      const empName = contractMap[log.employeeNo] || contractMap[log.employeeId] || '';
      const matchesSearch =
        !searchTerm ||
        log.employeeNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        empName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.id.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesDate = !selectedDate || log.timestamp.startsWith(selectedDate);

      return matchesSearch && matchesDate;
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [attendanceLogs, contractMap, searchTerm, selectedDate]);

  // Estadísticas rápidas
  const stats = useMemo(() => {
    let fpCount = 0;
    let pwdCount = 0;
    let otherCount = 0;

    attendanceLogs.forEach((l) => {
      const method = (l.verifyMethod || '').toLowerCase();
      if (method.includes('huella') || method.includes('finger')) fpCount++;
      else if (method.includes('contraseña') || method.includes('password') || method.includes('pin')) pwdCount++;
      else otherCount++;
    });

    return {
      total: attendanceLogs.length,
      fpCount,
      pwdCount,
      otherCount,
      deletedCount: deletedLogIds.length,
    };
  }, [attendanceLogs, deletedLogIds]);

  // Exportar a Excel
  const handleExportExcel = () => {
    const dataToExport = filteredLogs.map((log, idx) => ({
      '#': idx + 1,
      'ID Evento / Serial': log.id,
      'N° Empleado (ID Biométrico)': log.employeeNo,
      'Nombre Empleado': contractMap[log.employeeNo] || 'Sin Nombre Asignado',
      'Fecha y Hora': log.timestamp.replace('T', ' ').slice(0, 19),
      'Método de Verificación': log.verifyMethod || 'Huella dactilar',
      'Estado': deletedLogIds.includes(log.id) ? 'Eliminado de Vista' : 'Activo',
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Registros ISAPI');
    XLSX.writeFile(wb, `Registros_Biometricos_Raw_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden border border-gray-200 flex flex-col max-h-[90vh]">
        {/* Encabezado Modal */}
        <div className="px-6 py-4 bg-gradient-to-r from-gray-900 via-gray-800 to-amber-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/20 border border-amber-400/30 rounded-2xl">
              <Database className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
                Eventos Crudos del Biométrico (API ISAPI)
                <span className="bg-amber-400/20 text-amber-300 text-xs px-2 py-0.5 rounded-full font-extrabold border border-amber-400/30">
                  {attendanceLogs.length} Registros
                </span>
              </h2>
              <p className="text-xs text-gray-300 font-medium">
                Inspección directa de huellas y contraseñas leídas del reloj sin filtros de turno.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-all cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tarjetas de Estadísticas */}
        <div className="bg-gray-50 border-b border-gray-200 px-6 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-2xs flex items-center gap-3">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Database size={18} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase">Total Eventos</p>
              <p className="text-base font-black text-gray-900">{stats.total}</p>
            </div>
          </div>

          <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-2xs flex items-center gap-3">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Fingerprint size={18} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase">Por Huella 👆</p>
              <p className="text-base font-black text-gray-900">{stats.fpCount}</p>
            </div>
          </div>

          <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-2xs flex items-center gap-3">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <Key size={18} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase">Por Teclado 🔑</p>
              <p className="text-base font-black text-gray-900">{stats.pwdCount}</p>
            </div>
          </div>

          <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-2xs flex items-center gap-3">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Trash2 size={18} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase">Eliminados Manual</p>
              <p className="text-base font-black text-gray-900">{stats.deletedCount}</p>
            </div>
          </div>
        </div>

        {/* Barra de Filtros */}
        <div className="p-4 bg-white border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-[280px]">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por ID (#14), nombre (Kevin) o serial..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden font-bold"
              />
            </div>

            <div className="relative w-44">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden font-bold"
              />
            </div>

            {(searchTerm || selectedDate) && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedDate('');
                }}
                className="text-xs font-bold text-amber-600 hover:text-amber-700 underline cursor-pointer"
              >
                Limpiar Filtros
              </button>
            )}
          </div>

          <button
            onClick={handleExportExcel}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs transition-all flex items-center gap-2 cursor-pointer shadow-xs"
          >
            <Download size={14} />
            Exportar Excel (.xlsx)
          </button>
        </div>

        {/* Tabla de Eventos Crudos */}
        <div className="flex-1 overflow-auto p-4 bg-gray-50/50">
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-100 border-b border-gray-200 text-gray-600 uppercase text-[10px] font-black tracking-wider sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2.5">#</th>
                  <th className="px-3 py-2.5">Empleado</th>
                  <th className="px-3 py-2.5">ID Biométrico</th>
                  <th className="px-3 py-2.5">Tipo Marcación</th>
                  <th className="px-3 py-2.5">Fecha y Hora Exacta</th>
                  <th className="px-3 py-2.5">Método Verificación</th>
                  <th className="px-3 py-2.5">ID Evento / Serial</th>
                  <th className="px-3 py-2.5 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {filteredLogs.map((log, idx) => {
                  const empName = contractMap[log.employeeNo] || contractMap[log.employeeId] || 'Sin Nombre';
                  const isDeleted = deletedLogIds.includes(log.id);
                  const isExit = log.attendanceStatus === 'checkOut' || log.type === 'EXIT';

                  return (
                    <tr key={log.id} className={`hover:bg-amber-50/40 transition-colors ${isDeleted ? 'bg-red-50/50 opacity-60' : ''}`}>
                      <td className="px-3 py-2 font-mono text-[11px] text-gray-400">{idx + 1}</td>
                      <td className="px-3 py-2 font-black text-gray-900">{empName}</td>
                      <td className="px-3 py-2 font-mono font-bold text-gray-600">#{log.employeeNo}</td>
                      <td className="px-3 py-2">
                        {isExit ? (
                          <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 border border-blue-200 px-2 py-0.5 rounded-lg text-[10px] font-extrabold">
                            🚪 checkOut (Salida)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-lg text-[10px] font-extrabold">
                            🟢 checkIn (Entrada)
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono font-bold text-emerald-700">
                        {log.timestamp.replace('T', ' ').slice(0, 19)}
                      </td>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 px-2 py-0.5 rounded-lg text-[10px] font-bold">
                          {log.verifyMethod?.includes('Huella') || log.verifyMethod?.includes('finger') ? (
                            <>👆 {log.verifyMethod || 'Huella dactilar'}</>
                          ) : (
                            <>🔑 {log.verifyMethod || 'Teclado / PIN'}</>
                          )}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-[10px] text-gray-400">{log.id}</td>
                      <td className="px-3 py-2 text-center">
                        {isDeleted ? (
                          <span className="text-[9px] font-black text-red-700 bg-red-100 px-2 py-0.5 rounded-md">
                            Eliminado Manual
                          </span>
                        ) : (
                          <span className="text-[9px] font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md flex items-center justify-center gap-1">
                            <CheckCircle2 size={10} /> Activo
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-400 font-bold text-xs">
                      No se encontraron registros crudos con los filtros seleccionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pie de Modal */}
        <div className="px-6 py-3 bg-gray-100 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500 font-bold">
          <span>Mostrando {filteredLogs.length} de {attendanceLogs.length} eventos extraídos del hardware</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-gray-900 hover:bg-black text-white rounded-xl font-extrabold transition-all cursor-pointer"
          >
            Cerrar Visualizador
          </button>
        </div>
      </div>
    </div>
  );
}
