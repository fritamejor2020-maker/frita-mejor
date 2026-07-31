import { X, UserCheck, Key, Shield, DollarSign, Download, Upload, CheckCircle2, FileSpreadsheet, AlertTriangle, Users, Trash2 } from 'lucide-react';
import { useAttendanceStore, EmployeeContract } from '../../store/useAttendanceStore';
import { useBranchStore } from '../../store/useBranchStore';
import * as XLSX from 'xlsx';

interface AdminEmployeeBiometricsModalProps {
  onClose: () => void;
  initialSelectedEmployeeNo?: string;
}

const TEMPLATE_COLUMNS = [
  'ID Biométrico (Número)',
  'Nombre Completo',
  'Sede (branchId)',
  'Tipo Turno (FIXED / VARIABLE)',
  'Turno Predeterminado (id)',
  'Meta Horas Semanales',
  'Tarifa Hora Base ($)',
  'Tarifa Hora Extra ($)',
  'PIN / Clave Acceso',
];

const TEMPLATE_EXAMPLE_ROWS = [
  ['1001', 'Carlos Andrés Mendoza', 'BRANCH-001', 'VARIABLE', 'SHIFT-MANANA', 44, 6500, 9750, '123456'],
  ['1002', 'María José López',     'BRANCH-001', 'FIXED',    'SHIFT-NOCHE',  44, 6500, 9750, '654321'],
  ['1003', 'Juan David Ríos',      'BRANCH-002', 'VARIABLE', 'SHIFT-MANANA', 48, 7000, 10500, '111222'],
];

export function AdminEmployeeBiometricsModal({ onClose, initialSelectedEmployeeNo }: AdminEmployeeBiometricsModalProps) {
  const { employeeContracts, shiftTemplates, terminals, upsertEmployeeContract, deleteEmployeeContract, pushUserToTerminal, deleteUserFromTerminal, fetchTerminalUsers } = useAttendanceStore();
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

  // Preseleccionar si viene por prop
  React.useEffect(() => {
    if (initialSelectedEmployeeNo) {
      const match = employeeContracts.find((c) => c.employeeNo === initialSelectedEmployeeNo || c.employeeId === initialSelectedEmployeeNo);
      if (match) {
        handleSelectContract(match);
      }
    }
  }, [initialSelectedEmployeeNo]);

  const handleDeleteSelectedContract = async () => {
    if (!selectedEmpId || !fullName) return;
    if (!confirm(`¿Estás seguro de eliminar a "${fullName}" (#${employeeNo}) del biométrico y del sistema?`)) return;

    setIsProcessing(true);
    const term = terminals[0];
    if (term) {
      await deleteUserFromTerminal(term.id, employeeNo);
    }

    deleteEmployeeContract(selectedEmpId);
    showStatus(`🗑️ Empleado "${fullName}" (#${employeeNo}) eliminado del biométrico y del sistema.`);
    setIsProcessing(false);
    handleNew();
  };

  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<'success' | 'error' | 'info'>('success');
  const [isProcessing, setIsProcessing] = useState(false);

  // ── Importación masiva ─────────────────────────────────────────────────────
  const [importPreview, setImportPreview] = useState<EmployeeContract[] | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [pushToDevice, setPushToDevice] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showStatus = (msg: string, type: 'success' | 'error' | 'info' = 'success', duration = 4000) => {
    setStatusMsg(msg);
    setStatusType(type);
    if (duration > 0) setTimeout(() => setStatusMsg(null), duration);
  };

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
    setImportPreview(null);
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
    setImportPreview(null);
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
    showStatus(`✅ Perfil de ${fullName} guardado en el sistema.`);
  };

  const handlePushToBiometric = async () => {
    if (!employeeNo || !fullName) return;
    const term = terminals[0];
    if (!term) {
      showStatus('❌ No hay biométricos registrados.', 'error');
      return;
    }

    setIsProcessing(true);
    showStatus(`⏳ Enviando a ${fullName} (#${employeeNo}) al biométrico ${term.name}...`, 'info', 0);

    const contract: EmployeeContract = {
      employeeId: selectedEmpId || `EMP-${employeeNo}`,
      employeeNo, fullName, branchId, shiftType, defaultShiftId,
      weeklyTargetHours, baseHourlyRate, overtimeHourlyRate, pinPassword,
    };

    const res = await pushUserToTerminal(term.id, contract);
    showStatus(res.message, res.ok ? 'success' : 'error');
    setIsProcessing(false);
  };

  const handleImportFromBiometric = async () => {
    const term = terminals[0];
    if (!term) return;

    setIsProcessing(true);
    showStatus('⏳ Consultando lista de personas en el biométrico...', 'info', 0);
    const res = await fetchTerminalUsers(term.id);
    showStatus(res.message, res.ok ? 'success' : 'error');
    setIsProcessing(false);
  };

  // ── Descargar Plantilla Excel ────────────────────────────────────────────────
  const handleDownloadTemplate = () => {
    const wb = XLSX.utils.book_new();

    // Hoja principal con cabeceras + ejemplos
    const data = [TEMPLATE_COLUMNS, ...TEMPLATE_EXAMPLE_ROWS];
    const ws = XLSX.utils.aoa_to_sheet(data);

    // Anchos de columna legibles
    ws['!cols'] = [
      { wch: 22 }, { wch: 30 }, { wch: 18 }, { wch: 26 }, { wch: 26 },
      { wch: 22 }, { wch: 20 }, { wch: 20 }, { wch: 20 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Empleados');

    // Hoja de ayuda con las sedes y turnos disponibles
    const helpRows: any[][] = [
      ['=== SEDES DISPONIBLES ===', ''],
      ['branchId', 'Nombre'],
      ...branches.map((b: any) => [b.id, b.name || b.id]),
      ['', ''],
      ['=== TURNOS DISPONIBLES ===', '', ''],
      ['shiftId', 'Nombre', 'Horario'],
      ...shiftTemplates.map((s) => [s.id, s.name, `${s.startTime} - ${s.endTime}`]),
    ];
    const wsHelp = XLSX.utils.aoa_to_sheet(helpRows);
    wsHelp['!cols'] = [{ wch: 22 }, { wch: 30 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsHelp, 'Referencia');

    XLSX.writeFile(wb, 'plantilla_empleados_biometrico.xlsx');
    showStatus('📥 Plantilla descargada. Llénala y súbela con el botón "Importar Excel".', 'info');
  };

  // ── Importar desde Excel ─────────────────────────────────────────────────────
  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ''; // reset input

    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

      if (rows.length < 2) {
        showStatus('❌ El archivo está vacío o no tiene filas de datos.', 'error');
        return;
      }

      // Skip header row
      const dataRows = rows.slice(1).filter((r) => r.length > 0 && r[0] !== undefined && String(r[0]).trim() !== '');

      const errors: string[] = [];
      const contracts: EmployeeContract[] = [];
      const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#6366F1', '#EC4899', '#14B8A6', '#F97316', '#8B5CF6'];

      dataRows.forEach((row, idx) => {
        const rowNum = idx + 2; // 1-indexed + header
        const empNo = String(row[0] ?? '').trim();
        const name = String(row[1] ?? '').trim();
        const branch = String(row[2] ?? branches[0]?.id ?? 'BRANCH-001').trim();
        const sType = String(row[3] ?? 'VARIABLE').trim().toUpperCase();
        const defShift = String(row[4] ?? shiftTemplates[0]?.id ?? '').trim();
        const targetH = Number(row[5]) || 44;
        const baseRate = Number(row[6]) || 6500;
        const otRate = Number(row[7]) || 9750;
        const pin = String(row[8] ?? '123456').trim();

        if (!empNo) { errors.push(`Fila ${rowNum}: ID Biométrico vacío`); return; }
        if (!name) { errors.push(`Fila ${rowNum}: Nombre vacío`); return; }
        if (sType !== 'FIXED' && sType !== 'VARIABLE') {
          errors.push(`Fila ${rowNum}: Tipo turno "${sType}" inválido (use FIXED o VARIABLE)`);
          return;
        }

        contracts.push({
          employeeId: `EMP-${empNo}`,
          employeeNo: empNo,
          fullName: name,
          branchId: branch,
          shiftType: sType as 'FIXED' | 'VARIABLE',
          defaultShiftId: defShift,
          weeklyTargetHours: targetH,
          baseHourlyRate: baseRate,
          overtimeHourlyRate: otRate,
          pinPassword: pin,
          avatarColor: COLORS[idx % COLORS.length],
        });
      });

      setImportErrors(errors);
      setImportPreview(contracts);

      if (contracts.length === 0) {
        showStatus(`❌ No se pudieron leer empleados del archivo. ${errors.length} error(es).`, 'error');
      } else {
        showStatus(`📋 Vista previa: ${contracts.length} empleado(s) listos para importar.${errors.length > 0 ? ` (${errors.length} fila(s) con errores)` : ''}`, 'info', 0);
      }
    } catch (err: any) {
      showStatus(`❌ Error leyendo el archivo: ${err.message}`, 'error');
    }
  };

  // ── Confirmar Importación Masiva ─────────────────────────────────────────────
  const handleConfirmImport = async () => {
    if (!importPreview || importPreview.length === 0) return;

    setIsProcessing(true);
    let savedCount = 0;
    let pushedCount = 0;
    let pushErrors = 0;

    for (const contract of importPreview) {
      upsertEmployeeContract(contract);
      savedCount++;

      if (pushToDevice && terminals.length > 0) {
        // Push each employee to the first terminal of their branch (or first terminal)
        const branchTerminal = terminals.find((t) => t.branchId === contract.branchId) || terminals[0];
        if (branchTerminal) {
          try {
            const res = await pushUserToTerminal(branchTerminal.id, contract);
            if (res.ok) pushedCount++;
            else pushErrors++;
          } catch {
            pushErrors++;
          }
        }
      }
    }

    let msg = `✅ ${savedCount} empleado(s) importados al sistema.`;
    if (pushToDevice) {
      msg += ` Enviados al biométrico: ${pushedCount} ok`;
      if (pushErrors > 0) msg += `, ${pushErrors} fallidos`;
      msg += '.';
    }

    showStatus(msg, pushErrors > 0 ? 'error' : 'success');
    setImportPreview(null);
    setImportErrors([]);
    setPushToDevice(false);
    setIsProcessing(false);
  };

  const handleCancelImport = () => {
    setImportPreview(null);
    setImportErrors([]);
    setPushToDevice(false);
    setStatusMsg(null);
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
          <div className={`my-3 p-3 rounded-xl text-xs font-black flex items-center justify-between shadow-xs shrink-0 ${
            statusType === 'error' ? 'bg-red-900 text-red-100' :
            statusType === 'info'  ? 'bg-blue-900 text-blue-100' :
            'bg-emerald-900 text-emerald-100'
          }`}>
            <span>{statusMsg}</span>
            <button onClick={() => setStatusMsg(null)}>✕</button>
          </div>
        )}

        {/* ── Vista de Importación Masiva ──────────────────────────────────────── */}
        {importPreview && importPreview.length > 0 ? (
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col my-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200 shrink-0">
              <span className="text-sm font-black text-gray-900 flex items-center gap-2">
                <FileSpreadsheet size={18} className="text-green-600" />
                Vista Previa — {importPreview.length} empleado(s)
              </span>
              <button onClick={handleCancelImport} className="text-xs font-bold text-gray-500 hover:text-red-500 cursor-pointer">
                ✕ Cancelar
              </button>
            </div>

            {importErrors.length > 0 && (
              <div className="mt-2 bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-xs max-h-20 overflow-y-auto">
                <span className="font-black text-amber-700 flex items-center gap-1 mb-1">
                  <AlertTriangle size={13} /> {importErrors.length} fila(s) con errores (omitidas):
                </span>
                {importErrors.map((err, i) => (
                  <div key={i} className="text-amber-600 font-bold">• {err}</div>
                ))}
              </div>
            )}

            <div className="flex-1 min-h-0 overflow-y-auto mt-3">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-50 z-10">
                  <tr className="text-left font-black text-gray-500 uppercase">
                    <th className="px-2 py-1.5">#ID</th>
                    <th className="px-2 py-1.5">Nombre</th>
                    <th className="px-2 py-1.5">Sede</th>
                    <th className="px-2 py-1.5">Turno</th>
                    <th className="px-2 py-1.5">Horas/Sem</th>
                    <th className="px-2 py-1.5">Base $</th>
                    <th className="px-2 py-1.5">Extra $</th>
                    <th className="px-2 py-1.5">PIN</th>
                  </tr>
                </thead>
                <tbody>
                  {importPreview.map((c, i) => (
                    <tr key={i} className="border-t border-gray-100 hover:bg-amber-50/50">
                      <td className="px-2 py-1.5 font-black">{c.employeeNo}</td>
                      <td className="px-2 py-1.5 font-bold">{c.fullName}</td>
                      <td className="px-2 py-1.5 text-gray-500">{c.branchId}</td>
                      <td className="px-2 py-1.5">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-black ${
                          c.shiftType === 'FIXED' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                        }`}>
                          {c.shiftType}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 font-bold text-center">{c.weeklyTargetHours}</td>
                      <td className="px-2 py-1.5 font-bold text-right">{c.baseHourlyRate.toLocaleString()}</td>
                      <td className="px-2 py-1.5 font-bold text-right">{c.overtimeHourlyRate.toLocaleString()}</td>
                      <td className="px-2 py-1.5 text-gray-500">{c.pinPassword}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Opciones de importación */}
            <div className="pt-4 border-t border-gray-100 mt-3 shrink-0">
              <label className="flex items-center gap-2 mb-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pushToDevice}
                  onChange={(e) => setPushToDevice(e.target.checked)}
                  className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                />
                <span className="text-xs font-black text-gray-700">
                  🔗 También crear en el dispositivo biométrico (ISAPI)
                </span>
                {terminals.length === 0 && (
                  <span className="text-[10px] font-bold text-red-500">(⚠️ Sin terminales configuradas)</span>
                )}
              </label>

              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={handleCancelImport}
                  className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmImport}
                  disabled={isProcessing}
                  className="px-5 py-2.5 text-xs font-black bg-green-600 hover:bg-green-500 text-white rounded-xl shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isProcessing ? (
                    <>⏳ Procesando...</>
                  ) : (
                    <><CheckCircle2 size={14} /> Confirmar Importación ({importPreview.length})</>
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* ── Layout Normal (Individual) ────────────────────────────────────── */
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

              {/* Botones de importar / exportar debajo de la lista */}
              <div className="mt-3 space-y-1.5">
                <button
                  onClick={handleDownloadTemplate}
                  className="w-full py-2 bg-green-100 hover:bg-green-200 text-green-800 text-xs font-black rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-green-200"
                >
                  <FileSpreadsheet size={14} />
                  📥 Descargar Plantilla Excel
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2 bg-blue-100 hover:bg-blue-200 text-blue-800 text-xs font-black rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-blue-200"
                >
                  <Upload size={14} />
                  📤 Importar desde Excel
                </button>

                <button
                  onClick={handleImportFromBiometric}
                  disabled={isProcessing}
                  className="w-full py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-black rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Download size={14} />
                  Importar del Biométrico
                </button>
              </div>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelected}
                className="hidden"
              />
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
                  <label className="block text-xs font-black text-gray-700 mb-1">Sede</label>
                  <select
                    value={branchId}
                    onChange={(e) => setBranchId(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 outline-none focus:border-amber-500"
                  >
                    {branches.map((b: any) => (
                      <option key={b.id} value={b.id}>{b.name || b.id}</option>
                    ))}
                    {branches.length === 0 && <option value="BRANCH-001">Sede Principal</option>}
                  </select>
                </div>

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
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePushToBiometric}
                    disabled={isProcessing || !fullName}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    <Upload size={14} />
                    Enviar a Biométrico (ISAPI)
                  </button>

                  {selectedEmpId && (
                    <button
                      type="button"
                      onClick={handleDeleteSelectedContract}
                      disabled={isProcessing}
                      className="px-3.5 py-2 bg-red-100 hover:bg-red-200 text-red-700 font-black text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer border border-red-200 disabled:opacity-50"
                      title="Eliminar de la app y desvincular del biométrico"
                    >
                      <Trash2 size={14} />
                      Eliminar
                    </button>
                  )}
                </div>

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
        )}
      </div>
    </div>
  );
}
