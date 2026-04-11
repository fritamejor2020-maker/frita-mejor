import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDejadorSessionStore } from '../store/useDejadorSessionStore';

export const DejadorSetupView = () => {
  const startShift = useDejadorSessionStore((state) => state.startShift);
  const navigate = useNavigate();

  const [shift, setShift] = useState('AM');
  const [anotadorName, setAnotadorName] = useState('');
  const [dejadorName, setDejadorName] = useState('');

  const handleStartShift = () => {
    if (!anotadorName.trim() || !dejadorName.trim()) {
      alert('Ingresa el nombre del Anotador y del Dejador para continuar');
      return;
    }
    startShift({
      shift,
      anotadorName: anotadorName.trim(),
      dejadorName: dejadorName.trim(),
    });
    navigate('/dejador');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[#FFD56B] font-sans w-full page-enter">
      {/* Volver al login */}
      <button
        onClick={() => navigate('/login')}
        className="absolute top-5 left-5 flex items-center gap-2 bg-white/80 hover:bg-white text-gray-700 font-bold text-sm px-4 py-2 rounded-full shadow-sm transition-all active:scale-95"
      >
        ← Volver
      </button>

      <div className="text-center mb-5 sm:mb-8">
        <h1 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight">¡Hola! 🚚</h1>
        <p className="text-amber-900/60 font-black mt-1 sm:mt-2 text-xs sm:text-sm tracking-widest uppercase">Configura tu Jornada</p>
      </div>

      <div className="bg-white rounded-[36px] sm:rounded-[40px] p-6 sm:p-10 shadow-sm border border-white w-full max-w-lg">

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

        {/* Anotador */}
        <div className="mb-4 relative pt-4">
          <div className="absolute top-0 left-6 bg-[#FFB700] text-white font-black text-[10px] sm:text-xs px-4 py-1 sm:py-1.5 rounded-t-lg tracking-widest">
            📋 ANOTADOR
          </div>
          <input
            type="text"
            placeholder="Quien recibe y anota pedidos"
            value={anotadorName}
            onChange={(e) => setAnotadorName(e.target.value)}
            className="w-full bg-white border-2 border-gray-100 rounded-[24px] sm:rounded-[28px] py-4 px-5 sm:py-5 sm:px-6 font-black text-lg sm:text-xl text-gray-800 outline-none focus:border-[#FFB700] shadow-sm transition-colors"
          />
        </div>

        {/* Dejador / Transportador */}
        <div className="mb-7 sm:mb-10 relative pt-4">
          <div className="absolute top-0 left-6 bg-gray-900 text-white font-black text-[10px] sm:text-xs px-4 py-1 sm:py-1.5 rounded-t-lg tracking-widest">
            🛵 DEJADOR
          </div>
          <input
            type="text"
            placeholder="Quien transporta y entrega"
            value={dejadorName}
            onChange={(e) => setDejadorName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleStartShift()}
            className="w-full bg-white border-2 border-gray-100 rounded-[24px] sm:rounded-[28px] py-4 px-5 sm:py-5 sm:px-6 font-black text-lg sm:text-xl text-gray-800 outline-none focus:border-[#FFB700] shadow-sm transition-colors"
          />
        </div>

        {/* Botón Iniciar */}
        <button
          onClick={handleStartShift}
          className="w-full bg-[#FF4040] text-white font-black text-lg sm:text-xl py-4 sm:py-6 rounded-[28px] sm:rounded-[32px] shadow-[0_15px_30px_-10px_rgba(255,64,64,0.5)] transition-all active:scale-95"
        >
          INICIAR JORNADA
        </button>
      </div>
    </div>
  );
};
