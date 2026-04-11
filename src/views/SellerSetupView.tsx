import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSellerSessionStore } from '../store/useSellerSessionStore';
import { useVehicleStore } from '../store/useVehicleStore';

export const SellerSetupView = () => {
  const startShift = useSellerSessionStore((state) => state.startShift);
  
  const [pointType, setPointType] = useState('variable');
  const [pointId, setPointId] = useState('');
  const [shift, setShift] = useState('AM');
  const [responsibleName, setResponsibleName] = useState('');

  const pointTypes = [
    { id: 'variable', label: 'Triciclo', vehicleType: 'Triciclo' },
    { id: 'local',    label: 'Carrito',  vehicleType: 'Carrito'  }
  ];

  const vehicles = useVehicleStore((state) => state.vehicles);
  const selectedTypeObj = pointTypes.find(pt => pt.id === pointType);
  const allPointIds = vehicles
    .filter((v: any) => v.active && v.type === selectedTypeObj?.vehicleType)
    .map((v: any) => v.abbreviation || v.name);

  const navigate = useNavigate();

  const handleStartShift = () => {
    if (!pointId || !responsibleName) {
      alert("Faltan datos");
      return;
    }
    startShift({ pointId, shift, pointType, responsibleName });
    navigate('/vendedor'); // Auto-navigate to dashboard
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[#FFD56B] font-sans w-full page-enter">
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
