import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, MANAGER_PERMISSIONS } from '../store/useAuthStore';
import { useBranchStore } from '../store/useBranchStore';
import { useInventoryStore } from '../store/useInventoryStore';
import { useDashboardFilters } from '../hooks/useDashboardFilters';
import { DashboardView } from '../modules/dashboard/DashboardView';
import { MapTrackingView } from './MapTrackingView';
import { AdminFinancesTab } from '../components/admin/AdminFinancesTab';
import { BarChart3, Map, DollarSign, Settings, LogOut } from 'lucide-react';
import { AdminPricesTab } from '../components/admin/AdminPricesTab';
import { AdminUsersTab } from '../components/admin/AdminUsersTab';
import { AdminContratasTab } from '../components/admin/AdminContratasTab';
import { GlobalSettingsPanel } from '../components/admin/GlobalSettingsPanel';
import { InventoryPanel } from '../modules/admin/AdminView';

// ─────────────────────────────────────────────────────────────────────────────
// ManagerDashboard — Módulo dedicado para Gerentes de Sede
// ─────────────────────────────────────────────────────────────────────────────
// El gerente solo ve datos de su(s) sede(s) asignada(s).
// El Admin controla sus permisos desde PermissionsPanel.
// ─────────────────────────────────────────────────────────────────────────────

export const ManagerDashboard = () => {
  const navigate = useNavigate();
  const { user, signOut, activeBranchId, setActiveBranchId } = useAuthStore() as any;
  const allBranches = useBranchStore((s: any) => s.branches);
  const posShifts = useInventoryStore((s: any) => s.posShifts) || [];

  const isAdmin = user?.role === 'ADMIN';

  // Sedes permitidas para este gerente
  const allowedBranches: string[] = (user as any)?.allowedBranches || [];
  const userBranchId: string | null = (user as any)?.branchId || null;
  
  // Las sedes que puede ver: Admin ve todas; gerente ve las permitidas o la asignada
  const effectiveBranches = isAdmin
    ? allBranches.filter((b: any) => b.active !== false).map((b: any) => b.id)
    : (allowedBranches.length > 0
        ? allowedBranches
        : userBranchId ? [userBranchId] : []);

  const branchOptions = allBranches.filter((b: any) =>
    b.active !== false && effectiveBranches.includes(b.id)
  );

  // Sede seleccionada actualmente
  const [selectedBranch, setSelectedBranch] = useState<string>(
    isAdmin && activeBranchId ? activeBranchId : (effectiveBranches[0] || '')
  );

  // Sincronizar el branch de visualización y el de Zustand cuando cambia la selección
  const setBranchId = useDashboardFilters((s) => s.setBranchId);
  useEffect(() => {
    if (selectedBranch) {
      setBranchId(selectedBranch);
      if (isAdmin) {
        setActiveBranchId(selectedBranch);
      }
    }
  }, [selectedBranch, setBranchId, isAdmin, setActiveBranchId]);

  // Si el activeBranchId cambia externamente, actualizar el select interno del dashboard
  useEffect(() => {
    if (isAdmin && activeBranchId && activeBranchId !== selectedBranch) {
      setSelectedBranch(activeBranchId);
    }
  }, [activeBranchId, isAdmin]);

  // Permisos del gerente (configurados por el Admin)
  const permissions: string[] = (user as any)?.permissions || [];
  const hasPermission = (id: string) => permissions.includes(id);

  // Tabs
  const [activeTab, setActiveTab] = useState<'dashboard' | 'map' | 'finance' | 'config'>('dashboard');
  const [activePanel, setActivePanel] = useState<string | null>(null);

  // Reset active sub-panel when tab changes
  useEffect(() => {
    setActivePanel(null);
  }, [activeTab]);

  const selectedBranchName = branchOptions.find((b: any) => b.id === selectedBranch)?.name || 'Mi Sede';

  const tabs = [
    { id: 'dashboard' as const, label: 'Dashboard', icon: <BarChart3 size={20} /> },
    { id: 'map' as const,       label: 'Mapa',      icon: <Map size={20} /> },
    { id: 'finance' as const,   label: 'Finanzas',   icon: <DollarSign size={20} /> },
    { id: 'config' as const,    label: 'Config',     icon: <Settings size={20} /> },
  ];

  // Si no tiene sedes asignadas
  if (effectiveBranches.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: 'var(--color-bg, #FFF9F0)' }}>
        <span className="text-6xl">🔒</span>
        <h1 className="text-2xl font-black text-gray-800">Sin sedes asignadas</h1>
        <p className="text-gray-400 font-bold text-sm text-center max-w-xs">
          El administrador no te ha asignado ninguna sede. Contacta al admin para obtener acceso.
        </p>
        <button
          onClick={() => { signOut(); navigate('/login', { replace: true }); }}
          className="mt-4 px-6 py-3 bg-gray-800 text-white font-black rounded-full active:scale-95"
        >
          Volver al login
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--color-bg, #FFF9F0)' }}>

      {/* ── HEADER ───────────────────────────────────────────────── */}
      <div className="w-full bg-white rounded-b-[40px] shadow-sm relative z-10">
        <div className="max-w-7xl mx-auto pt-5 sm:pt-7 pb-4 sm:pb-5 px-4 sm:px-6">

          {/* Top row */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-violet-500 uppercase tracking-widest">👔 Gerente</p>
              <h1 className="text-xl sm:text-3xl font-black text-gray-900 mt-0.5 leading-tight">
                {(user as any)?.name}
              </h1>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {/* Selector de sede (si tiene múltiples) */}
              {branchOptions.length > 1 && (
                <select
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  className="bg-violet-50 border border-violet-200 rounded-full px-4 py-2 text-sm font-bold text-violet-700 outline-none cursor-pointer"
                >
                  {branchOptions.map((b: any) => (
                    <option key={b.id} value={b.id}>{b.name || b.id}</option>
                  ))}
                </select>
              )}
              <button
                onClick={() => navigate('/selector')}
                className="flex items-center gap-1.5 bg-gray-50 text-gray-600 font-bold text-xs px-3 py-2 rounded-full border border-gray-200 hover:bg-gray-100 transition-all active:scale-95"
              >
                Módulos
              </button>
              <button
                onClick={() => { signOut(); navigate('/login', { replace: true }); }}
                className="flex items-center gap-1.5 bg-red-50 text-red-500 font-bold text-xs px-3 py-2 rounded-full border border-red-200 hover:bg-red-500 hover:text-white transition-all active:scale-95"
              >
                <LogOut size={14} />
              </button>
            </div>
          </div>

          {/* Branch badge */}
          <div className="flex items-center gap-2 mt-2">
            <span className="bg-violet-500 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">
              🏢 {selectedBranchName}
            </span>
          </div>

          {/* Tab navigation */}
          <div className="flex gap-1 mt-4 bg-gray-100/80 rounded-2xl p-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-black transition-all ${
                  activeTab === tab.id
                    ? 'bg-violet-500 text-white shadow-sm'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-white/50'
                }`}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── CONTENT ─────────────────────────────────────────────── */}
      <div className="flex-1">

        {/* TAB: Dashboard */}
        {activeTab === 'dashboard' && (
          <DashboardView />
        )}

        {/* TAB: Mapa GPS */}
        {activeTab === 'map' && (
          <div className="flex-1 h-[calc(100vh-200px)]">
            <MapTrackingView activeShifts={posShifts} branchId={selectedBranch} />
          </div>
        )}

        {/* TAB: Finanzas (Cierres) */}
        {activeTab === 'finance' && (
          <div className="max-w-[1600px] mx-auto w-full p-4 md:p-6">
            <AdminFinancesTab allowDelete={false} />
          </div>
        )}

        {/* TAB: Configuración */}
        {activeTab === 'config' && (
          <div className="max-w-7xl mx-auto px-4 py-6">
            {activePanel ? (
              <div className="w-full">
                <button
                  onClick={() => setActivePanel(null)}
                  className="flex items-center gap-1.5 bg-violet-50 border border-violet-100 text-violet-600 font-bold text-xs px-4 py-2.5 rounded-full hover:bg-violet-500 hover:text-white transition-all active:scale-95 mb-6 animate-[scaleIn_0.15s_ease-out]"
                >
                  ← Volver a Configuración de Sede
                </button>
                <div className="animate-[scaleIn_0.2s_ease-out]">
                  {activePanel === 'prices' && <AdminPricesTab />}
                  {activePanel === 'users' && <AdminUsersTab />}
                  {activePanel === 'contratas' && <AdminContratasTab />}
                  {activePanel === 'settings' && <GlobalSettingsPanel />}
                  {activePanel === 'inventory' && <InventoryPanel branchId={selectedBranch} />}
                  {activePanel === 'close_shifts' && <ManagerShiftsPanel branchId={selectedBranch} />}
                </div>
              </div>
            ) : (
              <div className="max-w-2xl mx-auto space-y-4">
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                  <h2 className="text-lg font-black text-gray-900 mb-1">⚙️ Configuración de Sede</h2>
                  <p className="text-xs font-bold text-gray-400 mb-5">
                    Funciones habilitadas por el Administrador (Haz clic en una función activa para usarla)
                  </p>

                  {/* Listar permisos disponibles */}
                  <div className="space-y-3">
                    {MANAGER_PERMISSIONS.map((perm) => {
                      const enabled = hasPermission(perm.id);
                      return (
                        <div
                          key={perm.id}
                          className={`flex items-center justify-between px-4 py-3.5 rounded-2xl border-2 transition-all ${
                            enabled
                              ? 'border-violet-200 bg-violet-50 cursor-pointer hover:border-violet-300 hover:scale-[1.01] active:scale-[0.99]'
                              : 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                          }`}
                          onClick={() => {
                            if (!enabled) return;
                            if (perm.id === 'edit_prices') setActivePanel('prices');
                            if (perm.id === 'manage_users') setActivePanel('users');
                            if (perm.id === 'view_all_finance') setActiveTab('finance');
                            if (perm.id === 'close_shifts') setActivePanel('close_shifts');
                            if (perm.id === 'edit_inventory') setActivePanel('inventory');
                            if (perm.id === 'manage_customers') setActivePanel('contratas');
                            if (perm.id === 'edit_settings') setActivePanel('settings');
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm ${
                              enabled ? 'bg-violet-500 text-white' : 'bg-gray-200 text-gray-400'
                            }`}>
                              {perm.id === 'edit_prices' && '💲'}
                              {perm.id === 'manage_users' && '👥'}
                              {perm.id === 'view_all_finance' && '📊'}
                              {perm.id === 'close_shifts' && '🔒'}
                              {perm.id === 'edit_inventory' && '📦'}
                              {perm.id === 'manage_customers' && '🤝'}
                              {perm.id === 'edit_settings' && '⚙️'}
                            </div>
                            <span className={`text-sm font-bold ${enabled ? 'text-violet-800' : 'text-gray-400'}`}>
                              {perm.label}
                            </span>
                          </div>
                          <span className={`text-xs font-black px-2.5 py-1 rounded-full ${
                            enabled
                              ? 'bg-green-100 text-green-600'
                              : 'bg-gray-100 text-gray-400'
                          }`}>
                            {enabled ? '✓ Activo' : 'Bloqueado'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Info */}
                <div className="bg-violet-50 border border-violet-100 rounded-2xl p-4 flex gap-3">
                  <span className="text-2xl flex-shrink-0">💡</span>
                  <div>
                    <p className="font-black text-violet-800 text-sm">¿Necesitas más acceso?</p>
                    <p className="text-xs text-violet-600 font-medium mt-1">
                      Contacta al Administrador Principal para que habilite las funciones que necesitas.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};



function ManagerShiftsPanel({ branchId }: { branchId: string }) {
  const { posShifts = [], updatePosShift } = useInventoryStore() as any;
  const activeShifts = posShifts.filter((s: any) => !s.closedAt && s.branchId === branchId);

  const handleForceClose = (id: string, cashierName: string) => {
    if (!confirm(`¿Estás seguro de que deseas forzar el cierre del turno de ${cashierName}?`)) return;
    updatePosShift(id, { closedAt: new Date().toISOString() });
  };

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 max-w-xl mx-auto animate-[scaleIn_0.2s_ease-out]">
      <h3 className="text-lg font-black text-gray-900 mb-2">🔒 Turnos Abiertos de Caja</h3>
      <p className="text-xs text-gray-400 font-bold mb-4">Fuerza el cierre de turnos abiertos de otros cajeros en esta sede.</p>

      <div className="space-y-3">
        {activeShifts.map((s: any) => (
          <div key={s.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
            <div>
              <h4 className="font-black text-gray-800 text-sm">{s.userName || 'Cajero'}</h4>
              <p className="text-xs text-gray-400 font-bold mt-0.5">Caja: {s.registerName || s.registerId}</p>
              <p className="text-[10px] text-violet-500 font-black mt-1 uppercase tracking-wider">Inició: {new Date(s.openedAt).toLocaleString()}</p>
            </div>
            <button
              onClick={() => handleForceClose(s.id, s.userName)}
              className="text-xs bg-red-50 text-red-500 border border-red-100 rounded-full px-4 py-2 hover:bg-red-500 hover:text-white transition-colors font-black"
            >
              🔴 Forzar Cierre
            </button>
          </div>
        ))}
        {activeShifts.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-xs font-bold">No hay turnos abiertos en esta sede</div>
        )}
      </div>
    </div>
  );
}
