import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSellerSessionStore } from '../store/useSellerSessionStore';
import { useInventoryStore } from '../store/useInventoryStore';
import { useVehicleStore } from '../store/useVehicleStore';
import { useAuthStore } from '../store/useAuthStore';

export const SellerSetupView = () => {
  const startShift = useSellerSessionStore((state) => state.startShift);
  const sellerViewEnabled = useVehicleStore((s: any) => s.sellerViewEnabled ?? true);
  const enabledPointTypes = useVehicleStore((s: any) => s.enabledPointTypes ?? { Triciclo: true, Carrito: true, Local: false });
  
  const [pointType, setPointType] = useState('variable');
  const [pointId, setPointId] = useState('');
  const [shift, setShift] = useState('AM');
  const [responsibleName, setResponsibleName] = useState('');

  const allPointTypes = [
    { id: 'variable', label: 'Triciclo', vehicleType: 'Triciclo' },
    { id: 'local',    label: 'Carrito',  vehicleType: 'Carrito'  },
    { id: 'local2',   label: 'Local',    vehicleType: 'Local'    },
  ];

  // Solo mostrar los tipos que el admin habilitó
  const pointTypes = allPointTypes.filter(pt => enabledPointTypes[pt.vehicleType] !== false);

  const vehicles = useVehicleStore((state: any) => state.vehicles);
  const { user } = useAuthStore();
  const userBranchId = (user as any)?.branchId ?? null;
  const selectedTypeObj = pointTypes.find(pt => pt.id === pointType) ?? pointTypes[0];
  const allPointIds = vehicles
    .filter((v: any) =>
      v.active &&
      v.type === selectedTypeObj?.vehicleType &&
      // Admin ve todos; vendedor ve solo los de su sede (o sin sede)
      (userBranchId === null || !v.branchId || v.branchId === userBranchId)
    )
    .map((v: any) => v.abbreviation || v.name);

  const navigate = useNavigate();

  const handleStartShift = () => {
    if (!pointId || !responsibleName) {
      alert("Faltan datos");
      return;
    }
    const openedAt = new Date().toISOString();
    startShift({ pointId, shift, pointType, responsibleName, openedAt });

    // Crear el posShift aquí — el store ya está 100% hidratado en este punto.
    // Nunca en un useEffect del Dashboard (race condition con rehidratación de Zustand).
    const { posShifts, addPosShift } = useInventoryStore.getState();
    const alreadyExists = (posShifts || []).some(
      (s: any) => s.type === 'VENDEDOR' && s.pointId === pointId && s.openedAt === openedAt && !s.closedAt
    );
    if (!alreadyExists) {
      addPosShift({ openedAt, pointId, shift, responsibleName, type: 'VENDEDOR', closedAt: null });
    }

    navigate('/vendedor');
  };

  // Vista deshabilitada por el Admin
  if (!sellerViewEnabled) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#FFD56B]">
        <div className="bg-white rounded-[40px] p-10 shadow-sm text-center max-w-sm w-full">
          <span className="text-6xl block mb-4">🔒</span>
          <h1 className="text-2xl font-black text-gray-800 mb-2">Vista Desactivada</h1>
          <p className="text-gray-400 font-bold text-sm">
            El administrador ha desactivado temporalmente el acceso a la vista de Vendedor.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-4 bg-[#FFD56B] font-sans w-full page-enter">
      {/* Volver al login */}
      <button
        onClick={() => navigate('/login')}
        className="absolute top-5 left-5 flex items-center gap-2 bg-white/80 hover:bg-white text-gray-700 font-bold text-sm px-4 py-2 rounded-full shadow-sm transition-all active:scale-95"
      >
        ← Volver
      </button>

      <div className="text-center mb-5 sm:mb-8">
        <h1 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight">¡Hola! 👋</h1>
        <p className="text-amber-900/60 font-black mt-1 sm:mt-2 text-xs sm:text-sm tracking-widest uppercase">CONFIGURA TU TURNO</p>
      </div>

      <div className="bg-white rounded-[36px] sm:rounded-[40px] p-6 sm:p-10 shadow-sm border border-white w-full max-w-lg">
        
        {/* Tipo de Punto */}
        <div className="mb-5 sm:mb-8">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-3 sm:mb-4">Tipo de Punto</label>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            {pointTypes.map(pt => (
              <button
                key={pt.id}
                onClick={() => setPointType(pt.id)}
                className={`flex-1 py-3 sm:py-4 rounded-2xl text-sm font-black transition-all ${
                  pointType === pt.id 
                    ? 'bg-[#FFB700] text-white shadow-md active:scale-95' 
                    : 'bg-gray-50 border-2 border-gray-100 text-gray-400 hover:bg-gray-100'
                }`}
              >
                {pt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Selección de ID */}
        <div className="mb-5 sm:mb-8">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-3 sm:mb-4">Código (ID)</label>
          <div className="grid grid-cols-5 gap-2 sm:gap-3">
            {allPointIds.map((id: string) => (
              <button
                key={id}
                onClick={() => setPointId(id)}
                className={`py-3 sm:py-4 rounded-2xl font-black transition-all ${
                  pointId === id 
                    ? 'bg-[#FF4040] text-white shadow-md active:scale-95' 
                    : 'bg-gray-50 border-2 border-gray-100 text-gray-400 hover:bg-gray-100'
                }`}
              >
                {id}
              </button>
            ))}
          </div>
        </div>

        {/* Turno */}
        <div className="mb-5 sm:mb-8">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-3 sm:mb-4">Turno</label>
          <div className="flex gap-2 sm:gap-3">
            {['AM', 'MD', 'PM'].map(t => (
              <button
                key={t}
                onClick={() => setShift(t)}
                className={`flex-1 py-3 sm:py-4 rounded-2xl text-base sm:text-lg font-black transition-all ${
                  shift === t 
                    ? 'bg-[#FFB700] text-white shadow-md active:scale-95' 
                    : 'bg-gray-50 border-2 border-gray-100 text-gray-400 hover:bg-gray-100'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Responsable */}
        <div className="mb-7 sm:mb-10 relative pt-4">
           <div className="absolute top-0 left-6 bg-gray-900 text-white font-black text-[10px] sm:text-xs px-4 py-1 sm:py-1.5 rounded-t-lg tracking-widest">
              RESPONSABLE
           </div>
          <input 
            type="text" 
            placeholder="Tu nombre completo"
            value={responsibleName}
            onChange={(e) => setResponsibleName(e.target.value)}
            className="w-full bg-white border-2 border-gray-100 rounded-[24px] sm:rounded-[28px] py-4 px-5 sm:py-5 sm:px-6 font-black text-lg sm:text-xl text-gray-800 outline-none focus:border-[#FFB700] shadow-sm transition-colors"
          />
        </div>

        {/* Botón Iniciar */}
        <button 
          onClick={handleStartShift}
          className="w-full bg-[#FF4040] text-white font-black text-lg sm:text-xl py-4 sm:py-6 rounded-[28px] sm:rounded-[32px] shadow-[0_15px_30px_-10px_rgba(255,64,64,0.5)] transition-all active:scale-95"
        >
          INICIAR TURNO
        </button>
      </div>
    </div>
  );
};
