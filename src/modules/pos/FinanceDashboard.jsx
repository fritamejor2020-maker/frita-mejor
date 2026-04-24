import React, { useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { Button } from '../../components/ui/Button';
import { IncomesModal } from './components/IncomesModal';
import { ExpensesModal } from './components/ExpensesModal';
import { IncomesChatView } from './components/IncomesChatView';
import { ExpensesChatView } from './components/ExpensesChatView';
import { PayrollView } from './components/PayrollView';
import { useFinanceStore } from '../../store/useFinanceStore';
import { usePayrollStore } from '../../store/usePayrollStore';
import { formatMoney } from '../../utils/formatUtils';

export function FinanceDashboard() {
  const { user, signOut } = useAuthStore();
  const incomes  = useFinanceStore((s) => s.incomes);
  const expenses = useFinanceStore((s) => s.expenses);

  const [showIncomesModal,  setShowIncomesModal]  = useState(false);
  const [showExpensesModal, setShowExpensesModal] = useState(false);
  const [showIncomesChat,   setShowIncomesChat]   = useState(false);
  const [showExpensesChat,  setShowExpensesChat]  = useState(false);
  const [showPayroll,       setShowPayroll]       = useState(false);

  const payrollRecords = usePayrollStore((s) => s.payrollRecords);

  const isAdmin      = user?.role === 'ADMIN';
  const userAccess   = user?.access || [];
  const canIngresos  = isAdmin || userAccess.includes('finanzas-ingresos') || userAccess.includes('finanzas');
  const canGastos    = isAdmin || userAccess.includes('finanzas-gastos')   || userAccess.includes('finanzas');
  const canNomina    = isAdmin || userAccess.includes('finanzas-nomina');

  const totalIngresos = incomes.reduce((s, i) => s + (i.total || 0), 0);
  const totalGastos   = expenses.reduce((s, e) => s + (e.valor || 0), 0);
  const totalNomina   = payrollRecords.reduce((s, r) => s + r.filas.reduce((fs, f) => fs + (Number(f.nomina)||0) + (Number(f.extras)||0) + (Number(f.vacaciones)||0) + (Number(f.liquidacion)||0), 0), 0);

  return (
    <div className="min-h-screen bg-[#121318] flex flex-col font-sans">

      {/* Chats y vistas fullscreen */}
      {showIncomesChat  && <IncomesChatView  onClose={() => setShowIncomesChat(false)} />}
      {showExpensesChat && <ExpensesChatView onClose={() => setShowExpensesChat(false)} />}
      {showPayroll      && <PayrollView      onClose={() => setShowPayroll(false)} />}

      {/* Header */}
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

      {/* Main */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 gap-8">
        <div className="text-center max-w-md w-full mb-4">
          <h2 className="text-3xl font-black text-white mb-2">Bienvenido, {user?.name}</h2>
          <p className="text-gray-400 font-bold">Selecciona la operación que deseas realizar.</p>
        </div>

        <div className="flex flex-wrap justify-center gap-6 w-full max-w-2xl">

          {/* ── BLOQUE INGRESOS ── */}
          {canIngresos && (
            <div className="flex flex-col gap-3 w-full sm:w-[300px]">
              {/* Botón principal */}
              <button
                className="w-full bg-green-500/10 hover:bg-green-500/20 border-2 border-green-500/30 hover:border-green-500 rounded-[32px] p-8 flex flex-col items-center justify-center gap-4 transition-all hover:scale-[1.02] active:scale-95 group"
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

              {/* Botón historial chat */}
              <button
                onClick={() => setShowIncomesChat(true)}
                className="w-full flex items-center justify-between px-5 py-3 bg-[#1e1f26] hover:bg-[#25262e] border border-green-900/40 hover:border-green-700/60 rounded-2xl transition-all group"
              >
                <div className="flex items-center gap-2.5">
                  {/* ícono WhatsApp */}
                  <div className="w-8 h-8 rounded-full bg-[#25D366]/15 flex items-center justify-center group-hover:bg-[#25D366]/25 transition-colors">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-black text-gray-200 group-hover:text-white transition-colors">Ver historial</p>
                    <p className="text-xs font-bold text-green-600">{incomes.length} registros · {formatMoney(totalIngresos)}</p>
                  </div>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-gray-600 group-hover:text-green-400 transition-colors"><path d="M9 18l6-6-6-6"/></svg>
              </button>
            </div>
          )}

          {/* ── BLOQUE GASTOS ── */}
          {canGastos && (
            <div className="flex flex-col gap-3 w-full sm:w-[300px]">
              {/* Botón principal */}
              <button
                className="w-full bg-red-500/10 hover:bg-red-500/20 border-2 border-red-500/30 hover:border-red-500 rounded-[32px] p-8 flex flex-col items-center justify-center gap-4 transition-all hover:scale-[1.02] active:scale-95 group"
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

              {/* Botón historial chat */}
              <button
                onClick={() => setShowExpensesChat(true)}
                className="w-full flex items-center justify-between px-5 py-3 bg-[#1e1f26] hover:bg-[#25262e] border border-red-900/40 hover:border-red-700/60 rounded-2xl transition-all group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-[#25D366]/15 flex items-center justify-center group-hover:bg-[#25D366]/25 transition-colors">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-black text-gray-200 group-hover:text-white transition-colors">Ver historial</p>
                    <p className="text-xs font-bold text-red-600">{expenses.length} registros · {formatMoney(totalGastos)}</p>
                  </div>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-gray-600 group-hover:text-red-400 transition-colors"><path d="M9 18l6-6-6-6"/></svg>
              </button>
            </div>
          )}


          {/* ── BLOQUE NÓMINA ── */}
          {canNomina && (
            <div className="flex flex-col gap-3 w-full sm:w-[300px]">
              <button
                className="w-full bg-violet-500/10 hover:bg-violet-500/20 border-2 border-violet-500/30 hover:border-violet-500 rounded-[32px] p-8 flex flex-col items-center justify-center gap-4 transition-all hover:scale-[1.02] active:scale-95 group"
                onClick={() => setShowPayroll(true)}
              >
                <div className="w-20 h-20 bg-violet-500/20 rounded-full flex items-center justify-center group-hover:bg-violet-500/40 transition-colors">
                  <span className="text-4xl text-violet-400">👥</span>
                </div>
                <div className="text-center">
                  <h3 className="text-2xl font-black text-violet-400">Nómina</h3>
                  <p className="text-sm font-bold text-violet-800 mt-1">Pago a Personal</p>
                </div>
              </button>
              <button
                onClick={() => setShowPayroll(true)}
                className="w-full flex items-center justify-between px-5 py-3 bg-[#1e1f26] hover:bg-[#25262e] border border-violet-900/40 hover:border-violet-700/60 rounded-2xl transition-all group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-violet-500/15 flex items-center justify-center group-hover:bg-violet-500/25 transition-colors">
                    <span className="text-sm">📋</span>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-black text-gray-200 group-hover:text-white transition-colors">Ver historial</p>
                    <p className="text-xs font-bold text-violet-600">{payrollRecords.length} períodos · {formatMoney(totalNomina)}</p>
                  </div>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-gray-600 group-hover:text-violet-400 transition-colors"><path d="M9 18l6-6-6-6"/></svg>
              </button>
            </div>
          )}

        </div>
      </main>

      {/* Modales */}
      {showIncomesModal  && <IncomesModal  onClose={() => setShowIncomesModal(false)} />}
      {showExpensesModal && <ExpensesModal onClose={() => setShowExpensesModal(false)} />}
    </div>
  );
}
