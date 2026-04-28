import React, { useState, useRef } from 'react';
import { useFinanceStore } from '../../../store/useFinanceStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { useVehicleStore } from '../../../store/useVehicleStore';
import { useIncomeConfigStore } from '../../../store/useIncomeConfigStore';
import { useInventoryStore } from '../../../store/useInventoryStore';
import { Button } from '../../../components/ui/Button';
import { MoneyInput } from '../../../components/ui/MoneyInput';
import { formatMoney } from '../../../utils/formatUtils';

export function IncomesModal({ onClose }) {
  const { addIncome, addMultipleIncomes, getTodayDescarguesFor } = useFinanceStore();
  const incomeHierarchy = useIncomeConfigStore(state => state.hierarchy);
  const isDescarguesEnabled = useIncomeConfigStore(state => state.isDescarguesEnabled);
  const { user } = useAuthStore();
  const [step, setStep] = useState(1);

  const [selectedUbicacion, setSelectedUbicacion] = useState('');
  const [selectedJornada, setSelectedJornada]     = useState('');
  const [selectedTipo, setSelectedTipo]           = useState(''); // franja horaria
  // Descargues
  const [selectedSubtipo, setSelectedSubtipo]     = useState(''); // 'Descargue N' o 'Cierre Final'
  const [descarguesPrevios, setDescarguesPrevios] = useState([]);

  // Single form state (non-Local locations)
  const [vendedor, setVendedor] = useState('');
  const [efectivo, setEfectivo] = useState('');
  const [salidas, setSalidas] = useState('');
  const [transferencias, setTransferencias] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [zLoadedData, setZLoadedData] = useState(null);

  // ── Unified Local + Contratas state ─────────────────────────────────────────
  const [efectivoReal, setEfectivoReal] = useState('');           // total physical cash counted
  const [contraEfectivoZ, setContraEfectivoZ] = useState('');     // contrata cash from Z (editable)
  const [salidasLocal, setSalidasLocal] = useState('');
  const [transferenciasLocal, setTransferenciasLocal] = useState('');
  const [transferenciasContratas, setTransferenciasContratas] = useState('');

  // Foto del sobre — con rotación y confirmación
  const [photoBase64, setPhotoBase64] = useState(null);
  const [photoRotation, setPhotoRotation] = useState(0);   // grados: 0, 90, 180, 270
  const [photoConfirmed, setPhotoConfirmed] = useState(false);
  const photoInputRef = useRef(null);

  const handlePhotoCapture = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPhotoBase64(ev.target.result);
      setPhotoRotation(0);
      setPhotoConfirmed(false);
    };
    reader.readAsDataURL(file);
  };

  const rotatePhoto = (dir) => {
    setPhotoRotation(r => (r + dir + 360) % 360);
    setPhotoConfirmed(false); // Requiere re-confirmar tras rotar
  };

  // ── Aplica la rotación físicamente en un Canvas y devuelve base64 rotado ────
  const getBakedPhoto = (base64, degrees) => new Promise((resolve) => {
    if (!base64 || degrees === 0) { resolve(base64); return; }
    const img = new Image();
    img.onload = () => {
      const rad  = (degrees * Math.PI) / 180;
      const swap = degrees === 90 || degrees === 270;
      const w    = swap ? img.height : img.width;
      const h    = swap ? img.width  : img.height;
      const canvas = document.createElement('canvas');
      canvas.width  = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.translate(w / 2, h / 2);
      ctx.rotate(rad);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      resolve(canvas.toDataURL('image/jpeg', 0.92));
    };
    img.onerror = () => resolve(base64);
    img.src = base64;
  });

  // Grid flow (Triciclos)
  const [gridData, setGridData] = useState({});
  const getActiveTricycleAbbreviations = useVehicleStore(state => state.getActiveTricycleAbbreviations);
  const activeTricycles = getActiveTricycleAbbreviations();

  const initGridData = () => {
    const newGrid = {};
    activeTricycles.forEach(t => {
      newGrid[t] = { vendedor: '', efectivo: '', transferencias: '', salidas: '' };
    });
    setGridData(newGrid);
  };

  const updateGridRow = (tipo, field, value) => {
    setGridData(prev => ({ ...prev, [tipo]: { ...prev[tipo], [field]: value } }));
  };

  // ── Calculations Single (non-Local) ────────────────────────────────────────
  const numEfectivo      = parseFloat(efectivo)      || 0;
  const numTransferencias = parseFloat(transferencias) || 0;
  const numSalidas       = parseFloat(salidas)       || 0;
  const totalSingle = numEfectivo + numTransferencias + numSalidas;

  // ── Calculations Unified Local + Contratas ─────────────────────────────────
  const numEfectivoReal = parseFloat(efectivoReal) || 0;
  const numContraEfectivoZ = parseFloat(contraEfectivoZ) || 0;
  const numSalidasLocal = parseFloat(salidasLocal) || 0;
  const numTransferenciasLocal = parseFloat(transferenciasLocal) || 0;
  const numTransferenciasContratas = parseFloat(transferenciasContratas) || 0;

  const efectivoLocalCalc = Math.max(0, numEfectivoReal - numContraEfectivoZ);
  const efectivoContratasCalc = Math.min(numEfectivoReal, numContraEfectivoZ);
  const salidasContratasAuto = Math.max(0, numContraEfectivoZ - numEfectivoReal);

  const totalLocalCalc = efectivoLocalCalc + numSalidasLocal + numTransferenciasLocal;
  const totalContratasCalc = efectivoContratasCalc + salidasContratasAuto + numTransferenciasContratas;
  const totalGeneralCalc = totalLocalCalc + totalContratasCalc;


  // Calculations Grid
  const getGridRowTotal = (row) =>
    (parseFloat(row.efectivo) || 0) +
    (parseFloat(row.transferencias) || 0) +
    (parseFloat(row.salidas) || 0);

  const gridTotals = Object.values(gridData).reduce((acc, row) => {
    acc.efectivo      += (parseFloat(row.efectivo)      || 0);
    acc.transferencias += (parseFloat(row.transferencias) || 0);
    acc.salidas       += (parseFloat(row.salidas)       || 0);
    acc.total         += getGridRowTotal(row);
    return acc;
  }, { efectivo: 0, transferencias: 0, salidas: 0, total: 0 });

  const isGridFormValid =
    (gridTotals.efectivo > 0 || gridTotals.transferencias > 0 || gridTotals.salidas > 0) &&
    !!photoBase64 &&
    photoConfirmed;

  // ── Descargues ─────────────────────────────────────────────────────────────
  const hasDescargues    = !!(selectedUbicacion && selectedJornada && selectedTipo &&
    isDescarguesEnabled(selectedUbicacion, selectedJornada, selectedTipo));
  const isDescargueMode  = selectedSubtipo.startsWith('Descargue');
  const isCierreMode     = selectedSubtipo === 'Cierre Final';

  // Número siguiente de descargue — cuenta tanto por esDescargue como por subtipo (más robusto)
  const nextDescargueNum = descarguesPrevios.filter(
    d => d.esDescargue === true || (d.subtipo && String(d.subtipo).startsWith('Descargue'))
  ).length + 1;

  // Validaciones adaptadas al subtipo
  const isLocalFormValid = isDescargueMode
    ? numEfectivoReal > 0 && !!photoBase64 && photoConfirmed
    : (numEfectivoReal > 0 || numTransferenciasLocal > 0 || numTransferenciasContratas > 0) && !!photoBase64 && photoConfirmed;

  const isSingleFormValid = selectedUbicacion === 'Local'
    ? isLocalFormValid
    : isDescargueMode
      ? numEfectivo > 0 && !!photoBase64 && photoConfirmed
      : (numEfectivo > 0 || numTransferencias > 0 || numSalidas > 0) && !!photoBase64 && photoConfirmed;

  const handleNextStep = (type, value) => {
    if (type === 'ubicacion') {
      setSelectedUbicacion(value);
      setSelectedJornada('');
      setSelectedTipo('');
      setSelectedSubtipo('');
      setGridData({});
      if (value === 'Venta') {
        setSelectedJornada('Extra');
        setSelectedTipo('Extra');
        setStep(4);
      } else {
        setStep(2);
      }
    } else if (type === 'jornada') {
      setSelectedJornada(value);
      setSelectedTipo('');
      setSelectedSubtipo('');
      if (selectedUbicacion === 'Triciclo') {
        initGridData();
        setStep(3);
      } else {
        setStep(3);
      }
    } else if (type === 'tipo') {
      // Franja horaria seleccionada
      setSelectedTipo(value);
      setSelectedSubtipo('');
      if (selectedUbicacion !== 'Triciclo' && isDescarguesEnabled(selectedUbicacion, selectedJornada, value)) {
        // Cargar ya los descargues del día para calcular el número correcto
        const previos = getTodayDescarguesFor(selectedUbicacion, selectedJornada, value);
        setDescarguesPrevios(previos);
        setStep(35); // step intermedio
      } else {
        setStep(4);
      }
    } else if (type === 'subtipo') {
      setSelectedSubtipo(value);
      // Re-cargar descargues previos (por si se registró otro mientras tanto)
      const previos = getTodayDescarguesFor(selectedUbicacion, selectedJornada, selectedTipo);
      setDescarguesPrevios(previos);
      setStep(4);
    }
  };

  const handleSubmit = async () => {
    const bakedPhoto = await getBakedPhoto(photoBase64, photoRotation);
    const esDescargue  = selectedSubtipo.startsWith('Descargue');
    const esCierre     = selectedSubtipo === 'Cierre Final';

    if (selectedUbicacion === 'Triciclo') {
      const incomesArray = Object.entries(gridData).map(([tipo, rowData]) => {
        const ef = parseFloat(rowData.efectivo)      || 0;
        const tr = parseFloat(rowData.transferencias) || 0;
        const sa = parseFloat(rowData.salidas)       || 0;
        if (ef === 0 && tr === 0 && sa === 0) return null;
        return {
          ubicacion: selectedUbicacion, jornada: selectedJornada, tipo,
          vendedor: rowData.vendedor,
          creado_por: user?.name || 'Desconocido',
          efectivo: ef, salidas: sa, transferencias: tr,
          total: ef + tr + sa,
          observaciones: observaciones.trim() || null,
          fecha: new Date().toISOString(),
          photoBase64: bakedPhoto || null,
          photoRotation: 0,
        };
      }).filter(Boolean);
      if (incomesArray.length > 0) addMultipleIncomes(incomesArray);
    } else if (selectedUbicacion === 'Local') {
      // ── Unified Local + Contratas: guardar 2 registros ──────────────────────
      const base = {
        ubicacion: 'Local',
        jornada: selectedJornada,
        tipo: hasDescargues ? selectedTipo : selectedTipo,
        esDescargue: esDescargue || undefined,
        esCierre: esCierre || undefined,
        vendedor,
        creado_por: user?.name || 'Desconocido',
        observaciones: observaciones.trim() || null,
        fecha: new Date().toISOString(),
        photoBase64: bakedPhoto || null,
        photoRotation: 0,
      };
      const arr = [];
      const subPrefix = hasDescargues ? `${selectedSubtipo} - ` : '';
      // LOCAL record
      if (efectivoLocalCalc > 0 || numSalidasLocal > 0 || numTransferenciasLocal > 0) {
        arr.push({
          ...base,
          subtipo: `${subPrefix}Local`,
          efectivo: efectivoLocalCalc,
          salidas: esDescargue ? 0 : numSalidasLocal,
          transferencias: esDescargue ? 0 : numTransferenciasLocal,
          total: esDescargue ? efectivoLocalCalc : totalLocalCalc,
        });
      }
      // CONTRATAS record
      if (efectivoContratasCalc > 0 || salidasContratasAuto > 0 || numTransferenciasContratas > 0) {
        arr.push({
          ...base,
          subtipo: `${subPrefix}Contratas`,
          efectivo: efectivoContratasCalc,
          salidas: esDescargue ? 0 : salidasContratasAuto,
          transferencias: esDescargue ? 0 : numTransferenciasContratas,
          total: esDescargue
            ? efectivoContratasCalc
            : totalContratasCalc,
        });
      }
      if (arr.length > 0) addMultipleIncomes(arr);
    } else {
      // ── Non-Local single record (Contratas standalone, etc.) ────────────────
      addIncome({
        ubicacion: selectedUbicacion,
        jornada: selectedJornada,
        tipo: hasDescargues ? selectedTipo : selectedTipo,
        subtipo: hasDescargues ? selectedSubtipo : null,
        esDescargue: esDescargue || undefined,
        esCierre: esCierre || undefined,
        vendedor,
        creado_por: user?.name || 'Desconocido',
        efectivo: numEfectivo,
        salidas: esDescargue ? 0 : numSalidas,
        transferencias: esDescargue ? 0 : numTransferencias,
        total: esDescargue ? numEfectivo : totalSingle,
        observaciones: observaciones.trim() || null,
        fecha: new Date().toISOString(),
        photoBase64: bakedPhoto || null,
        photoRotation: 0,
      });
    }
    onClose();
  };

  // ── Componente de foto (reutilizable en step 3 y 4) ───────────────────────
  const PhotoSection = () => (
    <div className="space-y-3">
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handlePhotoCapture}
      />

      {photoBase64 ? (
        <div className="space-y-3">
          {/* Imagen con rotación CSS */}
          <div className="relative flex items-center justify-center bg-black/30 rounded-2xl overflow-hidden"
               style={{ minHeight: 160 }}>
            <img
              src={photoBase64}
              alt="Foto sobre"
              style={{
                transform: `rotate(${photoRotation}deg)`,
                transition: 'transform 0.25s ease',
                maxHeight: 220,
                maxWidth: '100%',
                objectFit: 'contain',
                borderRadius: 12,
              }}
            />
          </div>

          {/* Controles de rotación */}
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => rotatePhoto(-90)}
              className="flex items-center gap-1.5 bg-[#2a2d38] hover:bg-[#343846] text-white text-sm font-bold px-4 py-2 rounded-xl border border-gray-700 hover:border-green-500 transition-all active:scale-95"
            >
              ↺ Rotar izquierda
            </button>
            <button
              type="button"
              onClick={() => rotatePhoto(90)}
              className="flex items-center gap-1.5 bg-[#2a2d38] hover:bg-[#343846] text-white text-sm font-bold px-4 py-2 rounded-xl border border-gray-700 hover:border-green-500 transition-all active:scale-95"
            >
              Rotar derecha ↻
            </button>
          </div>

          {/* Checkbox de confirmación */}
          <label className={`flex items-center gap-3 p-3 rounded-2xl border-2 cursor-pointer transition-all select-none ${
            photoConfirmed
              ? 'bg-green-950/40 border-green-600'
              : 'bg-[#16171d] border-gray-700 hover:border-green-700'
          }`}>
            <input
              type="checkbox"
              checked={photoConfirmed}
              onChange={e => setPhotoConfirmed(e.target.checked)}
              className="w-5 h-5 accent-green-500 cursor-pointer flex-shrink-0"
            />
            <span className={`text-sm font-bold ${photoConfirmed ? 'text-green-400' : 'text-gray-300'}`}>
              ¿Está derecha la foto?
            </span>
            {photoConfirmed && <span className="text-green-400 text-lg ml-auto">✓</span>}
          </label>

          {/* Botones cambiar/quitar */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              className="flex-1 bg-[#2a2d38] hover:bg-[#343846] text-gray-300 text-xs font-bold py-2 rounded-xl border border-gray-700 hover:border-gray-500 transition-all"
            >
              📷 Cambiar foto
            </button>
            <button
              type="button"
              onClick={() => { setPhotoBase64(null); setPhotoConfirmed(false); setPhotoRotation(0); }}
              className="bg-red-950/50 hover:bg-red-900/50 text-red-400 text-xs font-bold py-2 px-3 rounded-xl border border-red-900/50 hover:border-red-700 transition-all"
            >
              ✕
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => photoInputRef.current?.click()}
          className="w-full border-2 border-dashed border-green-800/60 rounded-2xl py-5 flex flex-col items-center justify-center gap-2 hover:border-green-500 hover:bg-green-950/20 transition-all group"
        >
          <span className="text-3xl group-hover:scale-110 transition-transform">📷</span>
          <span className="text-sm font-bold text-gray-500 group-hover:text-green-400">Tomar foto del sobre</span>
        </button>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className={`bg-[#1e1f26] border border-gray-700/50 rounded-[32px] w-full ${selectedUbicacion === 'Triciclo' && step === 3 ? 'max-w-4xl' : 'max-w-lg'} overflow-hidden shadow-2xl flex flex-col max-h-[90vh] transition-all duration-300 animate-bounce-in`}>

        {/* Header */}
        <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-green-950/20">
          <h2 className="text-2xl font-black text-green-500 flex items-center gap-2">
            <span>💰</span> Registrar Ingreso
          </h2>
          <button className="text-gray-400 hover:text-white bg-[#16171d] p-2 rounded-full hover:bg-gray-800 transition-colors" onClick={onClose}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Dynamic Body */}
        <div className="p-6 overflow-y-auto">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-sm font-bold text-gray-400 mb-6 bg-[#16171d] p-3 rounded-2xl border border-gray-800">
            <button onClick={() => setStep(1)} className={`hover:text-white ${step === 1 ? 'text-green-500' : ''}`}>Ubicación</button>
            {selectedUbicacion && <>
              <span>›</span>
              <button onClick={() => selectedUbicacion !== 'Venta' && setStep(2)} className={`hover:text-white ${step === 2 ? 'text-green-500' : ''}`}>{selectedUbicacion}</button>
            </>}
            {selectedJornada && selectedUbicacion !== 'Venta' && <>
              <span>›</span>
              <button onClick={() => setStep(3)} className={`hover:text-white ${step === 3 ? 'text-green-500' : ''}`}>{selectedJornada}</button>
            </>}
            {selectedTipo && selectedUbicacion !== 'Venta' && <>
              <span>›</span>
              <span className="text-gray-300">{selectedTipo}</span>
            </>}
          </div>

          {/* Step 1: Ubicación */}
          {step === 1 && (
            <div className="grid grid-cols-2 gap-4">
              {Object.keys(incomeHierarchy).filter(ub => ub !== 'Contratas').map(ub => (
                <Button key={ub} className="py-6 rounded-[20px] text-lg font-black bg-[#2a2d38] hover:bg-[#343846] text-white border-2 border-transparent hover:border-green-500 shadow-chunky hover:scale-[1.02] active:scale-95 transition-all" onClick={() => handleNextStep('ubicacion', ub)}>
                  {ub}
                </Button>
              ))}
            </div>
          )}

          {/* Step 2: Jornada */}
          {step === 2 && incomeHierarchy[selectedUbicacion] && (
            <div className="grid grid-cols-2 gap-4">
              {Object.keys(incomeHierarchy[selectedUbicacion]).map(jo => (
                <Button key={jo} className="py-6 rounded-[20px] text-lg font-black bg-[#2a2d38] hover:bg-[#343846] text-white border-2 border-transparent hover:border-green-500 shadow-chunky hover:scale-[1.02] active:scale-95 transition-all" onClick={() => handleNextStep('jornada', jo)}>
                  Jornada {jo}
                </Button>
              ))}
            </div>
          )}

          {/* Step 3: Tipo (non-Triciclo) */}
          {step === 3 && selectedUbicacion !== 'Triciclo' && incomeHierarchy[selectedUbicacion]?.[selectedJornada] && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {incomeHierarchy[selectedUbicacion][selectedJornada].map(ti => (
                <Button key={ti} className="py-4 rounded-2xl text-base font-bold bg-[#2a2d38] hover:bg-[#343846] text-white border border-gray-700 hover:border-green-500 hover:scale-[1.02] active:scale-95 transition-all" onClick={() => handleNextStep('tipo', ti)}>
                  {ti}
                </Button>
              ))}
            </div>
          )}

          {/* Step 3: Grid (Triciclo) */}
          {step === 3 && selectedUbicacion === 'Triciclo' && (
            <div className="overflow-x-auto pb-4">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-800 text-xs text-gray-400 uppercase tracking-widest text-center">
                    <th className="p-3 font-black text-left">Tipo</th>
                    <th className="p-3 font-black text-left w-1/4">Vendedor</th>
                    <th className="p-3 font-black">Efectivo ($)</th>
                    <th className="p-3 font-black">Transfer ($)</th>
                    <th className="p-3 font-black">Salidas ($)</th>
                    <th className="p-3 font-black text-right">Total ($)</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(gridData).map(tipo => {
                    const row = gridData[tipo];
                    const rowTotal = getGridRowTotal(row);
                    return (
                      <tr key={tipo} className="border-b border-gray-800/50 hover:bg-[#2a2d38]/30 transition-colors">
                        <td className="p-3 font-black text-white text-lg">{tipo}</td>
                        <td className="p-2">
                          <input type="text" placeholder="Nombre..." className="w-full bg-[#0c0d11] border border-gray-800 rounded-lg py-3 px-3 font-bold text-white focus:border-green-500 outline-none" value={row.vendedor} onChange={(e) => updateGridRow(tipo, 'vendedor', e.target.value)} />
                        </td>
                        <td className="p-2">
                          <MoneyInput value={row.efectivo} onChange={(v) => updateGridRow(tipo, 'efectivo', v)} placeholder="0" className="w-full bg-[#0c0d11] border border-gray-800 rounded-lg py-3 px-3 text-center font-bold text-white focus:border-green-500 outline-none" />
                        </td>
                        <td className="p-2">
                          <MoneyInput value={row.transferencias} onChange={(v) => updateGridRow(tipo, 'transferencias', v)} placeholder="0" className="w-full bg-[#0c0d11] border border-gray-800 rounded-lg py-3 px-3 text-center font-bold text-white focus:border-green-500 outline-none" />
                        </td>
                        <td className="p-2">
                          <MoneyInput value={row.salidas} onChange={(v) => updateGridRow(tipo, 'salidas', v)} placeholder="0" className="w-full bg-[#0c0d11] border border-gray-800 rounded-lg py-3 px-3 text-center text-green-300 font-bold focus:border-green-500 outline-none" />
                        </td>
                        <td className="p-3 font-black text-right text-green-400 text-xl">{formatMoney(rowTotal)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-[#16171d] border-t-2 border-green-900/50">
                    <td colSpan="2" className="p-4 font-black text-gray-300 uppercase text-sm">Totales</td>
                    <td className="p-4 font-black text-center text-white">{formatMoney(gridTotals.efectivo)}</td>
                    <td className="p-4 font-black text-center text-white">{formatMoney(gridTotals.transferencias)}</td>
                    <td className="p-4 font-black text-center text-green-400">{formatMoney(gridTotals.salidas)}</td>
                    <td className="p-4 font-black text-right text-green-400 text-2xl">{formatMoney(gridTotals.total)}</td>
                  </tr>
                </tfoot>
              </table>

              {/* Observaciones (Triciclo) */}
              <div className="mt-4">
                <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Observaciones <span className="text-gray-600 normal-case font-normal">— Opcional</span></label>
                <textarea
                  value={observaciones}
                  onChange={e => setObservaciones(e.target.value)}
                  placeholder="Ej: Faltó plata en T2, vendedor reportó novedad..."
                  rows={2}
                  className="w-full bg-[#0c0d11] border border-gray-800 focus:border-gray-600 rounded-xl py-3 px-4 text-sm font-bold text-white outline-none resize-none placeholder:text-gray-700"
                />
              </div>

              {/* Foto en modo Triciclo */}
              <div className="mt-4">
                <PhotoSection />
              </div>
            </div>
          )}

          {/* ── Step 35: Descargue o Cierre Final ── */}
          {step === 35 && (
            <div className="space-y-4">
              <div className="bg-amber-950/30 border border-amber-800/50 rounded-2xl p-4">
                <p className="text-amber-400 font-black text-sm mb-1">📦 Descargues activos para esta franja</p>
                <p className="text-gray-400 text-xs">
                  Hay {descarguesPrevios.length} descargue(s) registrado(s) hoy en esta franja.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {/* Botón Descargue N */}
                <Button
                  className="py-6 rounded-[20px] text-xl font-black bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 border-2 border-amber-700 hover:border-amber-500 shadow-chunky hover:scale-[1.02] active:scale-95 transition-all flex flex-col items-center gap-1"
                  onClick={() => handleNextStep('subtipo', `Descargue ${nextDescargueNum}`)}
                >
                  <span>💵 Descargue {nextDescargueNum}</span>
                  <span className="text-xs font-bold text-amber-600">Solo efectivo — sin salidas ni transferencias</span>
                </Button>
                {/* Botón Cierre Final */}
                <Button
                  className="py-6 rounded-[20px] text-xl font-black bg-green-600/20 hover:bg-green-600/30 text-green-400 border-2 border-green-700 hover:border-green-500 shadow-chunky hover:scale-[1.02] active:scale-95 transition-all flex flex-col items-center gap-1"
                  onClick={() => handleNextStep('subtipo', 'Cierre Final')}
                >
                  <span>🔒 Cierre Final</span>
                  <span className="text-xs font-bold text-green-600">Incluye transferencias y salidas</span>
                </Button>
              </div>
            </div>
          )}

          {step === 4 && selectedUbicacion !== 'Triciclo' && (
            <div className="space-y-4">

              {/* ── Auto-fill desde Cierre Z (solo para Local) ── */}
              {selectedUbicacion === 'Local' && !zLoadedData && (() => {
                const { posShifts = [], posSales = [], posExpenses = [], customers = [], customerTypes = [] } = useInventoryStore.getState();
                const lastClosed = [...posShifts].filter(s => s.closedAt).sort((a, b) => new Date(b.closedAt) - new Date(a.closedAt))[0];
                if (!lastClosed) return null;
                const shiftSales = posSales.filter(s => s.shiftId === lastClosed.id && s.status === 'PAID');
                if (shiftSales.length === 0) return null;

                // Contrata breakdown
                const contrataCustomers = customers.filter(c => c.typeId);
                const contrataIds = new Set(contrataCustomers.map(c => c.id));

                const contrataSales = shiftSales.filter(s => s.customerId && contrataIds.has(s.customerId));
                const localSalesOnly = shiftSales.filter(s => !s.customerId || !contrataIds.has(s.customerId));

                const totalCashAll = shiftSales.filter(s => s.paymentMethod === 'EFECTIVO').reduce((a, s) => a + s.total, 0);
                const contrataCash = contrataSales.filter(s => s.paymentMethod === 'EFECTIVO' && s.contrataPaymentMethod !== 'credit').reduce((a, s) => a + s.total, 0);
                const localCash = totalCashAll - contrataCash;

                const nequi = shiftSales.filter(s => s.paymentMethod === 'NEQUI').reduce((a, s) => a + s.total, 0);
                const banc  = shiftSales.filter(s => s.paymentMethod === 'BANCOLOMBIA').reduce((a, s) => a + s.total, 0);
                const totalTransfers = nequi + banc;
                const contrataTransfers = contrataSales.filter(s => (s.paymentMethod === 'NEQUI' || s.paymentMethod === 'BANCOLOMBIA') && s.contrataPaymentMethod !== 'credit').reduce((a, s) => a + s.total, 0);
                const localTransfers = totalTransfers - contrataTransfers;

                const totalPosExpenses = posExpenses.filter(e => e.shiftId === lastClosed.id).reduce((a, e) => a + e.amount, 0);

                const contrataByClient = contrataCustomers.map(c => {
                  const cs = contrataSales.filter(s => s.customerId === c.id);
                  if (cs.length === 0) return null;
                  const cash = cs.filter(s => s.paymentMethod === 'EFECTIVO' && s.contrataPaymentMethod !== 'credit').reduce((a, s) => a + s.total, 0);
                  const transfer = cs.filter(s => s.paymentMethod !== 'EFECTIVO' && s.contrataPaymentMethod !== 'credit').reduce((a, s) => a + s.total, 0);
                  const credit = cs.filter(s => s.contrataPaymentMethod === 'credit').reduce((a, s) => a + (s.creditAmount || s.total), 0);
                  return { name: c.name, cash, transfer, credit, total: cash + transfer + credit };
                }).filter(Boolean);

                const closedAt = new Date(lastClosed.closedAt);
                const timeStr = closedAt.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

                const handleLoadZ = () => {
                  // Unified Local+Contratas fields
                  setEfectivoReal('');  // user must count and enter
                  setContraEfectivoZ(String(contrataCash));
                  setSalidasLocal(String(totalPosExpenses));
                  setTransferenciasLocal(String(localTransfers));
                  setTransferenciasContratas(String(contrataTransfers));
                  // Legacy fields (for banner display)
                  setEfectivo(String(localCash));
                  setTransferencias(String(totalTransfers));
                  setSalidas(String(totalPosExpenses));
                  setVendedor(lastClosed.userName || '');
                  setZLoadedData({ localCash, totalTransfers, localTransfers, contrataTransfers, totalPosExpenses, nequi, banc, contrataCash, contrataByClient, shiftId: lastClosed.id, time: timeStr });
                };

                return (
                  <button
                    onClick={handleLoadZ}
                    className="w-full bg-blue-950/40 border-2 border-dashed border-blue-500/50 rounded-2xl p-4 hover:bg-blue-950/60 hover:border-blue-400 transition-all group active:scale-[0.98]"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-3xl group-hover:scale-110 transition-transform">⚡</span>
                      <div className="text-left">
                        <p className="font-black text-blue-400 text-sm">Cargar desde Cierre Z</p>
                        <p className="text-[11px] text-gray-500 font-bold">Último cierre: {timeStr} — Cajero: {lastClosed.userName || 'N/A'}</p>
                      </div>
                    </div>
                  </button>
                );
              })()}

              {/* Banner con datos cargados del Z */}
              {zLoadedData && (
                <div className="bg-blue-950/30 border border-blue-700/50 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-blue-400 font-black text-sm flex items-center gap-2">⚡ Datos cargados del Cierre Z ({zLoadedData.time})</p>
                    <button onClick={() => { setZLoadedData(null); setEfectivo(''); setTransferencias(''); setSalidas(''); setVendedor(''); setEfectivoReal(''); setContraEfectivoZ(''); setSalidasLocal(''); setTransferenciasLocal(''); setTransferenciasContratas(''); }}
                      className="text-xs text-gray-500 hover:text-red-400 font-bold">✕ Limpiar</button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between bg-[#0c0d11] rounded-lg px-3 py-2">
                      <span className="text-gray-400 font-bold">Efectivo Local</span>
                      <span className="text-green-400 font-black">{formatMoney(zLoadedData.localCash)}</span>
                    </div>
                    <div className="flex justify-between bg-[#0c0d11] rounded-lg px-3 py-2">
                      <span className="text-gray-400 font-bold">Transferencias</span>
                      <span className="text-blue-400 font-black">{formatMoney(zLoadedData.totalTransfers)}</span>
                    </div>
                    <div className="flex justify-between bg-[#0c0d11] rounded-lg px-3 py-2">
                      <span className="text-gray-400 font-bold">Salidas (Gastos)</span>
                      <span className="text-red-400 font-black">{formatMoney(zLoadedData.totalPosExpenses)}</span>
                    </div>
                    <div className="flex justify-between bg-[#0c0d11] rounded-lg px-3 py-2">
                      <span className="text-gray-400 font-bold">Efect. Contratas</span>
                      <span className="text-yellow-400 font-black">{formatMoney(zLoadedData.contrataCash)}</span>
                    </div>
                  </div>
                  {zLoadedData.contrataByClient.length > 0 && (
                    <div className="bg-yellow-950/30 border border-yellow-800/30 rounded-xl p-3 mt-1">
                      <p className="text-xs font-black text-yellow-400 uppercase tracking-wider mb-1.5">Desglose Contratas</p>
                      {zLoadedData.contrataByClient.map((c, i) => (
                        <div key={i} className="flex justify-between text-xs py-0.5 border-b border-gray-800/30 last:border-0">
                          <span className="text-yellow-300 font-bold">{c.name}</span>
                          <span className="text-gray-400 font-bold">
                            {c.cash > 0 ? `Ef:${formatMoney(c.cash)}` : ''}
                            {c.transfer > 0 ? ` Tr:${formatMoney(c.transfer)}` : ''}
                            {c.credit > 0 ? ` Cr:${formatMoney(c.credit)}` : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-[10px] text-gray-600 font-bold text-center">Los campos fueron pre-llenados. Puedes ajustarlos antes de guardar.</p>
                </div>
              )}
              {hasDescargues && selectedSubtipo && (
                <div className={`rounded-2xl px-4 py-2.5 border flex items-center gap-2 ${
                  isDescargueMode ? 'bg-amber-950/30 border-amber-700/50' : 'bg-green-950/30 border-green-700/50'
                }`}>
                  <span className="text-lg">{isDescargueMode ? '💵' : '🔒'}</span>
                  <div>
                    <p className={`font-black text-sm ${isDescargueMode ? 'text-amber-400' : 'text-green-400'}`}>{selectedSubtipo}</p>
                    <p className="text-[10px] text-gray-500 font-bold">
                      {isDescargueMode ? 'Retiro parcial de caja — solo efectivo' : 'Cierre completo del turno'}
                    </p>
                  </div>
                </div>
              )}

              {/* Panel de descargues previos (solo en Cierre Final) */}
              {isCierreMode && (
                <div className="bg-[#16171d] rounded-2xl border border-amber-900/30 p-3 space-y-2">
                  <p className="text-xs font-black text-amber-400 uppercase tracking-wider">📦 Descargues previos hoy</p>
                  {descarguesPrevios.length === 0 ? (
                    <p className="text-xs font-bold text-gray-500 text-center py-1">Sin descargues registrados en esta franja hoy</p>
                  ) : (
                    <>
                      {descarguesPrevios.map((d, i) => (
                        <div key={d.id || i} className="flex justify-between items-center text-sm border-b border-gray-800/50 pb-1 last:border-0">
                          <span className="font-bold text-amber-300">{d.subtipo || `Descargue ${i + 1}`}</span>
                          <span className="font-black text-green-400">{formatMoney(d.efectivo || 0)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between items-center pt-1">
                        <span className="text-xs font-black text-gray-400 uppercase">Total descargado</span>
                        <span className="font-black text-amber-400">
                          {formatMoney(descarguesPrevios.reduce((s, d) => s + (d.efectivo || 0), 0))}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Vendedor */}
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Vendedor / Responsable</label>
                <input type="text" className="w-full bg-[#0c0d11] border-2 border-gray-700 focus:border-green-500 rounded-xl py-3 px-4 text-lg font-bold text-white outline-none" placeholder="Nombre completo" value={vendedor} onChange={e => setVendedor(e.target.value)} />
              </div>

              {/* ── Formulario unificado Local + Contratas ── */}
              {selectedUbicacion === 'Local' ? (
                <>
                  {/* Efectivo Real Contado */}
                  <div>
                    <label className="text-xs font-bold text-yellow-400 uppercase block mb-1">💰 Efectivo Real Contado (Total Caja)</label>
                    <MoneyInput value={efectivoReal} onChange={setEfectivoReal} placeholder="Ingresa el total físico" className="w-full bg-[#0c0d11] border-2 border-yellow-700 focus:border-yellow-500 rounded-xl py-3 px-4 text-xl font-black text-white outline-none" />
                  </div>
                  {/* Efectivo Contratas del Z */}
                  <div>
                    <label className="text-xs font-bold text-orange-400 uppercase block mb-1">🤝 Efectivo Contratas (del Cierre Z)</label>
                    <MoneyInput value={contraEfectivoZ} onChange={setContraEfectivoZ} placeholder="0" className="w-full bg-[#0c0d11] border-2 border-orange-700 focus:border-orange-500 rounded-xl py-3 px-4 text-xl font-black text-white outline-none" />
                  </div>

                  {/* ── Sección LOCAL ── */}
                  <div className="bg-[#0f1018] rounded-2xl border border-blue-900/50 p-4 space-y-3">
                    <p className="text-sm font-black text-blue-400 uppercase tracking-wider">🏪 Local</p>
                    <div className="flex justify-between items-center bg-[#16171d] rounded-xl px-4 py-2">
                      <span className="text-xs font-bold text-gray-400">Efectivo Local</span>
                      <span className="text-lg font-black text-green-400">{formatMoney(efectivoLocalCalc)}</span>
                    </div>
                    {(!hasDescargues || isCierreMode) && (
                      <>
                        <div>
                          <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Salidas Local ($)</label>
                          <MoneyInput value={salidasLocal} onChange={setSalidasLocal} placeholder="0" className="w-full bg-[#0c0d11] border border-gray-800 focus:border-blue-500 rounded-xl py-2 px-4 text-lg font-bold text-white outline-none" />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Transferencias Local ($)</label>
                          <MoneyInput value={transferenciasLocal} onChange={setTransferenciasLocal} placeholder="0" className="w-full bg-[#0c0d11] border border-gray-800 focus:border-blue-500 rounded-xl py-2 px-4 text-lg font-bold text-white outline-none" />
                        </div>
                      </>
                    )}
                    <div className="flex justify-between items-center border-t border-blue-900/30 pt-2">
                      <span className="text-xs font-black text-blue-300 uppercase">Total Local</span>
                      <span className="text-xl font-black text-blue-400">{formatMoney(totalLocalCalc)}</span>
                    </div>
                  </div>

                  {/* ── Sección CONTRATAS ── */}
                  <div className="bg-[#0f1018] rounded-2xl border border-orange-900/50 p-4 space-y-3">
                    <p className="text-sm font-black text-orange-400 uppercase tracking-wider">🤝 Contratas</p>
                    <div className="flex justify-between items-center bg-[#16171d] rounded-xl px-4 py-2">
                      <span className="text-xs font-bold text-gray-400">Efectivo Contratas</span>
                      <span className="text-lg font-black text-orange-400">{formatMoney(efectivoContratasCalc)}</span>
                    </div>
                    {salidasContratasAuto > 0 && (
                      <div className="flex justify-between items-center bg-red-950/30 rounded-xl px-4 py-2 border border-red-900/30">
                        <span className="text-xs font-bold text-red-400">Salidas (faltante)</span>
                        <span className="text-lg font-black text-red-400">{formatMoney(salidasContratasAuto)}</span>
                      </div>
                    )}
                    {(!hasDescargues || isCierreMode) && (
                      <div>
                        <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Transferencias Contratas ($)</label>
                        <MoneyInput value={transferenciasContratas} onChange={setTransferenciasContratas} placeholder="0" className="w-full bg-[#0c0d11] border border-gray-800 focus:border-orange-500 rounded-xl py-2 px-4 text-lg font-bold text-white outline-none" />
                      </div>
                    )}
                    <div className="flex justify-between items-center border-t border-orange-900/30 pt-2">
                      <span className="text-xs font-black text-orange-300 uppercase">Total Contratas</span>
                      <span className="text-xl font-black text-orange-400">{formatMoney(totalContratasCalc)}</span>
                    </div>
                  </div>

                  {/* ── Total General ── */}
                  <div className="bg-[#16171d] p-4 rounded-2xl border-2 border-green-700/50 space-y-2 shadow-inner">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-black text-green-300 uppercase">Total General</span>
                      <span className="text-3xl font-black text-green-400">{formatMoney(totalGeneralCalc)}</span>
                    </div>
                    {isCierreMode && descarguesPrevios.length > 0 && (
                      <>
                        <div className="border-t border-gray-800 pt-2 space-y-1">
                          {descarguesPrevios.map((d, i) => (
                            <div key={d.id || i} className="flex justify-between items-center text-sm">
                              <span className="text-amber-400 font-bold">💵 {d.subtipo || `Descargue ${i + 1}`}</span>
                              <span className="font-black text-amber-300">{formatMoney(d.efectivo || 0)}</span>
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-between items-center border-t-2 border-green-600/50 pt-2">
                          <span className="text-sm font-black text-green-200 uppercase">Total del Cierre</span>
                          <span className="text-3xl font-black text-green-400">
                            {formatMoney(totalGeneralCalc + descarguesPrevios.reduce((s, d) => s + (d.efectivo || 0), 0))}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </>
              ) : (
                /* ── Formulario para ubicaciones no-Local (Venta, etc.) ── */
                <>
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Efectivo ($)</label>
                    <MoneyInput value={efectivo} onChange={setEfectivo} placeholder="0" className="w-full bg-[#0c0d11] border-2 border-gray-700 focus:border-green-500 rounded-xl py-3 px-4 text-xl font-black text-white outline-none" />
                  </div>
                  {(!hasDescargues || isCierreMode) && (
                    <>
                      <div>
                        <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Transferencias ($)</label>
                        <MoneyInput value={transferencias} onChange={setTransferencias} placeholder="0" className="w-full bg-[#0c0d11] border-2 border-gray-700 focus:border-green-500 rounded-xl py-3 px-4 text-xl font-black text-white outline-none" />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Salidas ($) <span className="text-gray-600 normal-case font-normal">— Opcional</span></label>
                        <MoneyInput value={salidas} onChange={setSalidas} placeholder="0" className="w-full bg-[#0c0d11] border border-gray-800 focus:border-green-500 rounded-xl py-2 px-4 text-lg font-bold text-white outline-none" />
                      </div>
                    </>
                  )}
                  <div className="bg-[#16171d] p-4 rounded-2xl border border-green-900/50 space-y-2 shadow-inner">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-bold text-gray-400 uppercase">Total Ingreso</span>
                      <span className="text-3xl font-black text-green-400">{formatMoney(totalSingle)}</span>
                    </div>
                  </div>
                </>
              )}

              {/* Foto del sobre */}
              <PhotoSection />

              {/* Observaciones */}
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Observaciones <span className="text-gray-600 normal-case font-normal">— Opcional</span></label>
                <textarea
                  value={observaciones}
                  onChange={e => setObservaciones(e.target.value)}
                  placeholder="Ej: Pago parcial, cliente debe saldo, novedad en ruta..."
                  rows={2}
                  className="w-full bg-[#0c0d11] border border-gray-800 focus:border-gray-600 rounded-xl py-3 px-4 text-sm font-bold text-white outline-none resize-none placeholder:text-gray-700"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 bg-[#16171d] border-t border-gray-800">
          {((step === 4 && selectedUbicacion !== 'Triciclo') || (step === 3 && selectedUbicacion === 'Triciclo')) && (
            <div className="space-y-2">
              {/* Hint si foto no confirmada */}
              {photoBase64 && !photoConfirmed && (
                <p className="text-center text-amber-400 text-xs font-bold">
                  ⚠️ Confirma que la foto esté derecha antes de guardar
                </p>
              )}
              {!photoBase64 && (
                <p className="text-center text-gray-500 text-xs font-bold">
                  📷 Toma la foto del sobre para poder guardar
                </p>
              )}
              <Button
                className="w-full rounded-[20px] py-4 font-black text-lg bg-green-600 hover:bg-green-500 text-white shadow-[0_4px_14px_0_rgba(22,163,74,0.39)] disabled:opacity-40 disabled:grayscale disabled:cursor-not-allowed transition-all"
                disabled={selectedUbicacion === 'Triciclo' ? !isGridFormValid : !isSingleFormValid}
                onClick={handleSubmit}
              >
                {photoBase64 && photoConfirmed ? '📷 ' : ''}Guardar {selectedUbicacion === 'Triciclo' ? 'Múltiples Ingresos' : 'Ingreso'}
              </Button>
            </div>
          )}
          {((step < 4 && selectedUbicacion !== 'Triciclo') || (step < 3 && selectedUbicacion === 'Triciclo')) && (
            <p className="text-center text-gray-500 text-xs font-bold uppercase tracking-wider">Por favor, completa la selección</p>
          )}
        </div>

      </div>
    </div>
  );
}
