import React, { useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { Button } from '../../components/ui/Button';
import { IncomesModal } from './components/IncomesModal';
import { ExpensesModal } from './components/ExpensesModal';

export function FinanceDashboard() {
  const { user, signOut } = useAuthStore();
  const [showIncomesModal, setShowIncomesModal] = useState(false);
  const [showExpensesModal, setShowExpensesModal] = useState(false);

  // Users 7 and 8 are explicitly named 'Ingresos' and 'Gastos'
  const isIngresosUser = user?.name === 'Ingresos';
  const isGastosUser = user?.name === 'Gastos';

  return (
    <div className="min-h-screen bg-[#121318] flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="bg-[#1e1f26] border-b border-gray-800 p-4 shrink-0 shadow-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-chunky-main to-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-chunky-main/20">
            <span className="text-2xl">💰</span>
          </div>
          <div>
            <h1 className="text-xl font-black text-white">Módulo Financiero</h1>
            <p className="text-xs font-bold text-gray-400">Usuario Activo: {user?.name}</p>
          </div>
        </div>
        <Button 
          variant="outline" 
          className="rounded-xl border-gray-700 text-gray-400 hover:text-white hover:bg-red-500/20 hover:border-red-500/50 transition-colors flex items-center gap-2"
          onClick={signOut}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
          <span className="hidden sm:inline">Cerrar Sesión</span>
        </Button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 gap-8">
        <div className="text-center max-w-md w-full mb-8">
          <h2 className="text-3xl font-black text-white mb-2">Bienvenido, {user?.name}</h2>
          <p className="text-gray-400 font-bold">Selecciona la operación que deseas registrar en el sistema.</p>
        </div>

        <div className="flex flex-wrap justify-center gap-6 w-full max-w-2xl">
          
          {/* Ingresos Button */}
          {(isIngresosUser || user?.role === 'ADMIN') && (
            <button 
              className="w-full sm:w-[300px] bg-green-500/10 hover:bg-green-500/20 border-2 border-green-500/30 hover:border-green-500 rounded-[32px] p-8 flex flex-col items-center justify-center gap-4 transition-all hover:scale-105 active:scale-95 group"
              onClick={() => setShowIncomesModal(true)}
            >
              <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center group-hover:bg-green-500/40 transition-colors">
                <span className="text-4xl text-green-400">💵</span>
              </div>
              <div className="text-center">
                <h3 className="text-2xl font-black text-green-400">Registrar Ingresos</h3>
                <p className="text-sm font-bold text-green-700 mt-1">Efectivo y Transferencias</p>
              </div>
            </button>
          )}

          {/* Gastos Button */}
          {(isGastosUser || user?.role === 'ADMIN') && (
            <button 
              className="w-full sm:w-[300px] bg-red-500/10 hover:bg-red-500/20 border-2 border-red-500/30 hover:border-red-500 rounded-[32px] p-8 flex flex-col items-center justify-center gap-4 transition-all hover:scale-105 active:scale-95 group"
              onClick={() => setShowExpensesModal(true)}
            >
              <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center group-hover:bg-red-500/40 transition-colors">
                <span className="text-4xl text-red-400">💸</span>
              </div>
              <div className="text-center">
                <h3 className="text-2xl font-black text-red-400">Registrar Gastos</h3>
                <p className="text-sm font-bold text-red-800 mt-1">Facturas y Proveedores</p>
              </div>
            </button>
          )}

        </div>
      </main>

      {/* Modals */}
      {showIncomesModal && <IncomesModal onClose={() => setShowIncomesModal(false)} />}
      {showExpensesModal && <ExpensesModal onClose={() => setShowExpensesModal(false)} />}

    </div>
  );
}
