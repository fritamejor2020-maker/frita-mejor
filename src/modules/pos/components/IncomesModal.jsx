import React, { useState } from 'react';
import { useFinanceStore } from '../../../store/useFinanceStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { useVehicleStore } from '../../../store/useVehicleStore';
import { useIncomeConfigStore } from '../../../store/useIncomeConfigStore';
import { Button } from '../../../components/ui/Button';
import { formatMoney } from '../../../utils/formatUtils';

export function IncomesModal({ onClose }) {
  const { addIncome, addMultipleIncomes } = useFinanceStore();
  const incomeHierarchy = useIncomeConfigStore(state => state.hierarchy);
  const { user } = useAuthStore();
  const [step, setStep] = useState(1);
  
  const [selectedUbicacion, setSelectedUbicacion] = useState('');
  const [selectedJornada, setSelectedJornada] = useState('');
  const [selectedTipo, setSelectedTipo] = useState('');

  // State for original flow (single form)
  const [vendedor, setVendedor] = useState('');
  const [efectivo, setEfectivo] = useState('');
  const [salidas, setSalidas] = useState('');
  const [transferencias, setTransferencias] = useState('');

  // State for new grid flow (Tricycles)
  // Store rows as an object keyed by 'tipo' (e.g., T1, T2)
  const [gridData, setGridData] = useState({});
  const getActiveTricycleAbbreviations = useVehicleStore(state => state.getActiveTricycleAbbreviations);
  const activeTricycles = getActiveTricycleAbbreviations();

  // Initialize grid when moving to step 3 for Tricicles
  const initGridData = (jornada) => {
    const tipos = activeTricycles;
    const newGrid = {};
    tipos.forEach(t => {
      newGrid[t] = { vendedor: '', efectivo: '', transferencias: '', salidas: '' };
    });
    setGridData(newGrid);
  };

  const updateGridRow = (tipo, field, value) => {
    setGridData(prev => ({
      ...prev,
      [tipo]: { ...prev[tipo], [field]: value }
    }));
  };

  // Calculations Single Form
  const numEfectivo = parseFloat(efectivo) || 0;
  const numTransferencias = parseFloat(transferencias) || 0;
  const numSalidas = parseFloat(salidas) || 0;
  const totalSingle = numEfectivo + numTransferencias;
  const isSingleFormValid = numEfectivo > 0 || numTransferencias > 0;

  // Calculations Grid Form
  const getGridRowTotal = (row) => (parseFloat(row.efectivo) || 0) + (parseFloat(row.transferencias) || 0);
  
  const gridTotals = Object.values(gridData).reduce((acc, row) => {
    acc.efectivo += (parseFloat(row.efectivo) || 0);
    acc.transferencias += (parseFloat(row.transferencias) || 0);
    acc.salidas += (parseFloat(row.salidas) || 0);
    acc.total += getGridRowTotal(row);
    return acc;
  }, { efectivo: 0, transferencias: 0, salidas: 0, total: 0 });

  const isGridFormValid = gridTotals.efectivo > 0 || gridTotals.transferencias > 0;

  const handleNextStep = (type, value) => {
    if (type === 'ubicacion') {
      setSelectedUbicacion(value);
      setSelectedJornada('');
      setSelectedTipo('');
      setGridData({}); // Reset grid
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
      if (selectedUbicacion === 'Triciclo') {
        initGridData(value);
        setStep(3); // For tricicles, step 3 is the grid
      } else {
        setStep(3); // Normal flow goes to select 'tipo'
      }
    } else if (type === 'tipo') {
      setSelectedTipo(value);
      setStep(4);
    }
  };

  const handleSubmit = () => {
    if (selectedUbicacion === 'Triciclo') {
      // Grid submission
      const incomesArray = Object.entries(gridData).map(([tipo, rowData]) => {
        const ef = parseFloat(rowData.efectivo) || 0;
        const tr = parseFloat(rowData.transferencias) || 0;
        const sa = parseFloat(rowData.salidas) || 0;
        
        if (ef === 0 && tr === 0 && sa === 0) return null; // Skip empty rows

        return {
          ubicacion: selectedUbicacion,
          jornada: selectedJornada,
          tipo: tipo,
          vendedor: rowData.vendedor,
          creado_por: user?.name || 'Desconocido',
          efectivo: ef,
          salidas: sa,
          transferencias: tr,
          total: ef + tr,
          fecha: new Date().toISOString() // Could pick date from UI if needed
        };
      }).filter(Boolean); // Remove nulls

      if (incomesArray.length > 0) {
        addMultipleIncomes(incomesArray);
      }
    } else {
      // Single submission
      addIncome({
        ubicacion: selectedUbicacion,
        jornada: selectedJornada,
        tipo: selectedTipo,
        vendedor: vendedor,
        creado_por: user?.name || 'Desconocido',
        efectivo: numEfectivo,
        salidas: numSalidas,
        transferencias: numTransferencias,
        total: totalSingle,
        fecha: new Date().toISOString()
      });
    }
    onClose();
  };

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
               {Object.keys(incomeHierarchy).map(ub => (
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

           {/* Step 3: Tipo (Only for non-Tricycles) */}
           {step === 3 && selectedUbicacion !== 'Triciclo' && incomeHierarchy[selectedUbicacion]?.[selectedJornada] && (
             <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
               {incomeHierarchy[selectedUbicacion][selectedJornada].map(ti => (
                 <Button key={ti} className="py-4 rounded-2xl text-base font-bold bg-[#2a2d38] hover:bg-[#343846] text-white border border-gray-700 hover:border-green-500 hover:scale-[1.02] active:scale-95 transition-all" onClick={() => handleNextStep('tipo', ti)}>
                   {ti}
                 </Button>
               ))}
             </div>
           )}

           {/* Step 3: Grid Form (Only for Tricycles) */}
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
                             <input type="number" min="0" placeholder="0" className="w-full bg-[#0c0d11] border border-gray-800 rounded-lg py-3 px-3 text-center font-bold text-white focus:border-green-500 outline-none" value={row.efectivo} onChange={(e) => updateGridRow(tipo, 'efectivo', e.target.value)} />
                           </td>
                           <td className="p-2">
                             <input type="number" min="0" placeholder="0" className="w-full bg-[#0c0d11] border border-gray-800 rounded-lg py-3 px-3 text-center font-bold text-white focus:border-green-500 outline-none" value={row.transferencias} onChange={(e) => updateGridRow(tipo, 'transferencias', e.target.value)} />
                           </td>
                           <td className="p-2">
                             <input type="number" min="0" placeholder="0" className="w-full bg-[#0c0d11] border border-gray-800 rounded-lg py-3 px-3 text-center text-red-300 font-bold focus:border-red-500 outline-none" value={row.salidas} onChange={(e) => updateGridRow(tipo, 'salidas', e.target.value)} />
                           </td>
                           <td className="p-3 font-black text-right text-green-400 text-xl">
                             {formatMoney(rowTotal)}
                           </td>
                         </tr>
                       );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[#16171d] border-t-2 border-green-900/50">
                      <td colSpan="2" className="p-4 font-black text-gray-300 uppercase text-sm">Totales</td>
                      <td className="p-4 font-black text-center text-white">{formatMoney(gridTotals.efectivo)}</td>
                      <td className="p-4 font-black text-center text-white">{formatMoney(gridTotals.transferencias)}</td>
                      <td className="p-4 font-black text-center text-red-400">{formatMoney(gridTotals.salidas)}</td>
                      <td className="p-4 font-black text-right text-green-400 text-2xl">{formatMoney(gridTotals.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
           )}

           {/* Step 4: Formulario de Valores (Non-Tricycles) */}
           {step === 4 && selectedUbicacion !== 'Triciclo' && (
             <div className="space-y-4">
               <div>
                  <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Vendedor / Responsable</label>
                  <input type="text" className="w-full bg-[#0c0d11] border-2 border-gray-700 focus:border-green-500 rounded-xl py-3 px-4 text-lg font-bold text-white outline-none" placeholder="Nombre completo" value={vendedor} onChange={e => setVendedor(e.target.value)} />
               </div>
               <div>
                  <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Efectivo ($)</label>
                  <input type="number" className="w-full bg-[#0c0d11] border-2 border-gray-700 focus:border-green-500 rounded-xl py-3 px-4 text-xl font-black text-white outline-none" placeholder="0" value={efectivo} onChange={e => setEfectivo(e.target.value)} />
               </div>
               <div>
                  <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Transferencias ($)</label>
                  <input type="number" className="w-full bg-[#0c0d11] border-2 border-gray-700 focus:border-green-500 rounded-xl py-3 px-4 text-xl font-black text-white outline-none" placeholder="0" value={transferencias} onChange={e => setTransferencias(e.target.value)} />
               </div>
               <div>
                  <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Salidas ($) - Opcional</label>
                  <input type="number" className="w-full bg-[#0c0d11] border border-gray-800 focus:border-gray-500 rounded-xl py-2 px-4 text-lg font-bold text-white outline-none" placeholder="0" value={salidas} onChange={e => setSalidas(e.target.value)} />
               </div>

               <div className="bg-[#16171d] p-4 rounded-2xl border border-green-900/50 mt-4 flex justify-between items-center shadow-inner">
                  <span className="text-sm font-bold text-gray-400 uppercase">Total Ingreso</span>
                  <span className="text-3xl font-black text-green-400">{formatMoney(totalSingle)}</span>
               </div>
             </div>
           )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 bg-[#16171d] border-t border-gray-800">
           {((step === 4 && selectedUbicacion !== 'Triciclo') || (step === 3 && selectedUbicacion === 'Triciclo')) && (
             <Button 
               className="w-full rounded-[20px] py-4 font-black text-lg bg-green-600 hover:bg-green-500 text-white shadow-[0_4px_14px_0_rgba(22,163,74,0.39)] disabled:opacity-50 disabled:grayscale transition-all" 
               disabled={selectedUbicacion === 'Triciclo' ? !isGridFormValid : !isSingleFormValid} 
               onClick={handleSubmit}
             >
               Guardar {selectedUbicacion === 'Triciclo' ? 'Múltiples Ingresos' : 'Ingreso'}
             </Button>
           )}
           {((step < 4 && selectedUbicacion !== 'Triciclo') || (step < 3 && selectedUbicacion === 'Triciclo')) && (
             <p className="text-center text-gray-500 text-xs font-bold uppercase tracking-wider">Por favor, completa la selección</p>
           )}
        </div>

      </div>
    </div>
  );
}
