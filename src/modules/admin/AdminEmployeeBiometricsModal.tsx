import React, { useState } from 'react';
import { X, UserCheck, Key, Shield, DollarSign, Download, Upload, CheckCircle2 } from 'lucide-react';
import { useAttendanceStore, EmployeeContract } from '../../store/useAttendanceStore';
import { useBranchStore } from '../../store/useBranchStore';

interface AdminEmployeeBiometricsModalProps {
  onClose: () => void;
}

export function AdminEmployeeBiometricsModal({ onClose }: AdminEmployeeBiometricsModalProps) {
  const { employeeContracts, shiftTemplates, terminals, upsertEmployeeContract, deleteEmployeeContract, pushUserToTerminal, fetchTerminalUsers } = useAttendanceStore();
  const { branches = [] } = useBranchStore();

  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null);
  const [employeeNo, setEmployeeNo] = useState('1000');
  const [fullName, setFullName] = useState('');
  const [branchId, setBranchId] = useState(branches[0]?.id || 'BRANCH-001');
  const [shiftType, setShiftType] = useState<'FIXED' | 'VARIABLE'>('VARIABLE');
  const [defaultShiftId, setDefaultShiftId] = useState(shiftTemplates[0]?.id || 'SHIFT-MANANA');
  const [weeklyTargetHours, setWeeklyTargetHours] = useState(44);
  const [baseHourlyRate, setBaseHourlyRate] = useState(6500);
  const [overtimeHourlyRate, setOvertimeHourlyRate] = useState(9750);
  const [pinPassword, setPinPassword] = useState('123456');

  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSelectContract = (c: EmployeeContract) => {
    setSelectedEmpId(c.employeeId);
    setEmployeeNo(c.employeeNo);
    setFullName(c.fullName);
    setBranchId(c.branchId);
    setShiftType(c.shiftType);
    setDefaultShiftId(c.defaultShiftId || shiftTemplates[0]?.id || 'SHIFT-MANANA');
    setWeeklyTargetHours(c.weeklyTargetHours);
    setBaseHourlyRate(c.baseHourlyRate);
    setOvertimeHourlyRate(c.overtimeHourlyRate);
    setPinPassword(c.pinPassword || '123456');
  };

  const handleNew = () => {
    setSelectedEmpId(null);
    setEmployeeNo(String(Date.now()).slice(-4));
    setFullName('');
    setBranchId(branches[0]?.id || 'BRANCH-001');
    setShiftType('VARIABLE');
    setDefaultShiftId(shiftTemplates[0]?.id || 'SHIFT-MANANA');
    setWeeklyTargetHours(44);
    setBaseHourlyRate(6500);
    setOvertimeHourlyRate(9750);
    setPinPassword('123456');
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !employeeNo) return;

    const newContract: EmployeeContract = {
      employeeId: selectedEmpId || `EMP-${employeeNo}`,
      employeeNo,
      fullName,
      branchId,
      shiftType,
      defaultShiftId,
      weeklyTargetHours: Number(weeklyTargetHours),
      baseHourlyRate: Number(baseHourlyRate),
      overtimeHourlyRate: Number(overtimeHourlyRate),
      pinPassword,
      avatarColor: selectedEmpId
        ? employeeContracts.find((c) => c.employeeId === selectedEmpId)?.avatarColor
        : ['#3B82F6', '#10B981', '#F59E0B', '#6366F1', '#EC4899'][Math.floor(Math.random() * 5)],
    };

    upsertEmployeeContract(newContract);
    setStatusMsg(`Perfil de ${fullName} guardado en el sistema.`);
    setTimeout(() => setStatusMsg(null), 3000);
  };

  const handlePushToBiometric = async () => {
    if (!employeeNo || !fullName) return;
    const term = terminals[0];
    if (!term) {
      setStatusMsg('No hay biométricos registrados.');
      return;
    }

    setIsProcessing(true);
    setStatusMsg(`Enviando a ${fullName} (#${employeeNo}) al biométrico ${term.name}...`);

    const contract: EmployeeContract = {
      employeeId: selectedEmpId || `EMP-${employeeNo}`,
      employeeNo,
      fullName,
      branchId,
      shiftType,
      defaultShiftId,
      weeklyTargetHours,
      baseHourlyRate,
      overtimeHourlyRate,
      pinPassword,
    };

    const res = await pushUserToTerminal(term.id, contract);
    setStatusMsg(res.message);
    setIsProcessing(false);
    setTimeout(() => setStatusMsg(null), 4000);
  };

  const handleImportFromBiometric = async () => {
    const term = terminals[0];
    if (!term) return;

    setIsProcessing(true);
    setStatusMsg('Consultando lista de personas en el biométrico...');
    const res = await fetchTerminalUsers(term.id);
    setStatusMsg(res.message);
    setIsProcessing(false);
    setTimeout(() => setStatusMsg(null), 4000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-4xl w-full p-6 shadow-2xl border border-gray-100 max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-100 shrink-0">
          <div>
            <h3 className="font-black text-lg text-gray-900 flex items-center gap-2">
              <UserCheck className="text-amber-500" size={20} />
              Gestión de Personal & Enrolamiento Biométrico
            </h3>
            <p className="text-xs font-bold text-gray-400">
              Asigna números de empleado, claves PIN, turnos fijos/variables y tarifas por hora.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 cursor-pointer">
            <X size={20} />
          </button>
        </div>

        {statusMsg && (
          <div className="my-3 bg-emerald-900 text-emerald-100 p-3 rounded-xl text-xs font-black flex items-center justify-between shadow-xs shrink-0">
            <span>{statusMsg}</span>
            <button onClick={() => setStatusMsg(null)}>✕</button>
          </div>
        )}

        {/* Layout Dividido */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 my-4 flex-1 min-h-0 overflow-hidden">
          {/* Lista de Empleados Registrados */}
          <div className="bg-gray-50 rounded-2xl p-3 border border-gray-200 flex flex-col min-h-0">
            <div className="flex items-center justify-between pb-2 border-b border-gray-200 mb-2">
              <span className="text-xs font-black text-gray-700 uppercase">Trabajadores ({employeeContracts.length})</span>
              <button
                onClick={handleNew}
                className="text-[10px] font-black bg-amber-400 text-gray-950 px-2.5 py-1 rounded-lg hover:bg-amber-500 cursor-pointer"
              >
                + Nuevo
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {employeeContracts.map((c) => (
                <div
                  key={c.employeeId}
                  onClick={() => handleSelectContract(c)}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-between ${
                    selectedEmpId === c.employeeId
                      ? 'bg-amber-100 border-amber-400 text-amber-950 shadow-xs'
                      : 'bg-white border-gray-200 text-gray-800 hover:bg-gray-100'
                  }`}
                >
                  <div className="truncate">
                    <span className="block font-black truncate">{c.fullName}</span>
                    <span className="text-[10px] text-gray-400">#{c.employeeNo} • {c.shiftType}</span>
                  </div>
                  <span className="text-[10px] font-black bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 shrink-0">
                    {c.weeklyTargetHours}h
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={handleImportFromBiometric}
              disabled={isProcessing}
              className="mt-3 w-full py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-black rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Download size={14} />
              Importar del Biométrico
            </button>
          </div>

          {/* Formulario de Contrato & Parámetros */}
          <form onSubmit={handleSave} className="md:col-span-2 overflow-y-auto space-y-4 pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-black text-gray-700 mb-1">ID Biométrico (Número)</label>
                <input
                  type="text"
                  required
                  value={employeeNo}
                  onChange={(e) => setEmployeeNo(e.target.value)}
                  placeholder="ej. 1000"
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-gray-700 mb-1">Nombre Completo</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="ej. Carlos Andrés Mendoza"
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-black text-gray-700 mb-1">Tipo de Turno</label>
                <select
                  value={shiftType}
                  onChange={(e) => setShiftType(e.target.value as any)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 outline-none focus:border-amber-500"
                >
                  <option value="VARIABLE">🔄 Variable (Detección Automática)</option>
                  <option value="FIXED">📌 Fijo / Predeterminado</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-black text-gray-700 mb-1">Turno Predeterminado</label>
                <select
                  value={defaultShiftId}
                  onChange={(e) => setDefaultShiftId(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 outline-none focus:border-amber-500"
                >
                  {shiftTemplates.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name} ({st.startTime} - {st.endTime})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-black text-gray-700 mb-1">Meta Horas Semanales</label>
                <input
                  type="number"
                  required
                  value={weeklyTargetHours}
                  onChange={(e) => setWeeklyTargetHours(Number(e.target.value))}
                  placeholder="44"
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-gray-700 mb-1">Tarifa Hora Base ($)</label>
                <input
                  type="number"
                  required
                  value={baseHourlyRate}
                  onChange={(e) => setBaseHourlyRate(Number(e.target.value))}
                  placeholder="6500"
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-gray-700 mb-1">Tarifa Hora Extra ($)</label>
                <input
                  type="number"
                  required
                  value={overtimeHourlyRate}
                  onChange={(e) => setOvertimeHourlyRate(Number(e.target.value))}
                  placeholder="9750"
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-black text-gray-700 mb-1 flex items-center gap-1">
                <Key size={13} className="text-amber-500" />
                Clave / PIN Acceso Biométrico
              </label>
              <input
                type="text"
                value={pinPassword}
                onChange={(e) => setPinPassword(e.target.value)}
                placeholder="123456"
                className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 outline-none focus:border-amber-500"
              />
              <span className="text-[10px] font-bold text-gray-400 mt-0.5 block">
                Clave numérica para marcar en la pantalla del biométrico sin huella.
              </span>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={handlePushToBiometric}
                disabled={isProcessing || !fullName}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                <Upload size={14} />
                Enviar a Biométrico (ISAPI)
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl cursor-pointer"
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-black bg-amber-400 hover:bg-amber-500 text-gray-950 rounded-xl shadow-xs cursor-pointer"
                >
                  Guardar Perfil
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
