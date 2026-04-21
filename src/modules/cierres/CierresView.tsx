import React from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { AdminFinancesTab } from '../../components/admin/AdminFinancesTab';
import { useNavigate } from 'react-router-dom';

export const CierresView = () => {
  const { user, signOut } = useAuthStore();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--color-bg, #FFF9F0)' }}>
      {/* HEADER igual al de otros modulos */}
      <div className="w-full bg-white rounded-b-[40px] shadow-sm relative z-10">
        <div className="max-w-7xl mx-auto pt-6 sm:pt-8 pb-5 sm:pb-6 px-5 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-teal-600 uppercase tracking-widest">Módulo</p>
              <h1 className="text-2xl sm:text-3xl font-black text-gray-900 mt-0.5 leading-tight">Auditor de Cierres</h1>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => navigate('/selector')}
                className="flex items-center gap-2 bg-gray-50 text-gray-600 font-black text-xs sm:text-sm px-4 py-2.5 rounded-full border border-gray-200 hover:bg-gray-100 hover:text-gray-800 transition-all active:scale-95 shrink-0"
              >
                Módulos
              </button>
              <button
                onClick={() => { signOut(); navigate('/login', { replace: true }); }}
                className="flex items-center gap-2 bg-red-50 text-red-500 font-black text-xs sm:text-sm px-4 py-2.5 rounded-full border border-red-200 hover:bg-red-500 hover:text-white transition-all active:scale-95 shrink-0"
              >
                Salir
              </button>
            </div>
          </div>
          <p className="text-sm font-bold text-gray-400 mt-3">Revisión de cierres y finanzas de vendedores</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto w-full flex flex-col h-full overflow-auto">
        <AdminFinancesTab allowDelete={false} />
      </div>
    </div>
  );
};
