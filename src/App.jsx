import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/useAuthStore';
import { Toaster } from 'react-hot-toast';
import { useRealtimeSync, isApplyingRealtimeState } from './lib/useRealtimeSync';
import { useInventoryStore } from './store/useInventoryStore';
import { useLogisticsStore } from './store/useLogisticsStore';
import { useVehicleStore } from './store/useVehicleStore';
import { useBranchStore } from './store/useBranchStore';
import { useSupplierStore } from './store/useSupplierStore';
import { useTaskStore } from './store/useTaskStore';
import { useIncomeConfigStore } from './store/useIncomeConfigStore';
import { useGoalStore } from './store/useGoalStore';
import { useAttendanceStore } from './store/useAttendanceStore';
import { flushQueue } from './lib/syncManager';
import { initCrossTabSync, registerStore, broadcastState, isApplyingRemoteState } from './lib/crossTabSync';
import { trackError, installGlobalErrorHandlers } from './lib/errorTracker';
import SyncStatusIndicator from './components/ui/SyncStatusIndicator';
import VersionBadge from './components/ui/VersionBadge';
import { useOrientation } from './hooks/useOrientation';
import { initLogisticsRealtime } from './lib/logisticsBroadcast';

import { LoginView }      from './modules/auth/LoginView';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { QuickTaskDrawer } from './components/ui/QuickTaskDrawer';

// ── Code-Splitting: Carga diferida de vistas pesadas para ahorrar memoria en tablets ──
const ProductionView = React.lazy(() => import('./modules/production/ProductionView').then(m => ({ default: m.ProductionView })));
const WarehouseView  = React.lazy(() => import('./modules/warehouse/WarehouseView').then(m => ({ default: m.WarehouseView })));
const AdminView      = React.lazy(() => import('./modules/admin/AdminView').then(m => ({ default: m.AdminView })));
const PosView        = React.lazy(() => import('./modules/pos/PosView').then(m => ({ default: m.PosView })));
const FritadoView    = React.lazy(() => import('./modules/fritado/FritadoView').then(m => ({ default: m.FritadoView })));
const TransfersView  = React.lazy(() => import('./modules/transfers/TransfersView').then(m => ({ default: m.TransfersView })));
const TasksView      = React.lazy(() => import('./modules/tasks/TasksView').then(m => ({ default: m.TasksView })));
const PublicDamageReportView = React.lazy(() => import('./modules/tasks/PublicDamageReportView').then(m => ({ default: m.PublicDamageReportView })));

const SellerSetupView     = React.lazy(() => import('./views/SellerSetupView').then(m => ({ default: m.SellerSetupView })));
const DejadorSetupView    = React.lazy(() => import('./views/DejadorSetupView').then(m => ({ default: m.DejadorSetupView })));
const VendedorDashboard   = React.lazy(() => import('./views/VendedorDashboard').then(m => ({ default: m.VendedorDashboard })));
const DejadorDashboard    = React.lazy(() => import('./views/DejadorDashboard').then(m => ({ default: m.DejadorDashboard })));
const MapTrackingView     = React.lazy(() => import('./views/MapTrackingView').then(m => ({ default: m.MapTrackingView })));
const FinanceDashboard    = React.lazy(() => import('./modules/pos/FinanceDashboard').then(m => ({ default: m.FinanceDashboard })));
const ModuleSelectorView  = React.lazy(() => import('./views/ModuleSelectorView').then(m => ({ default: m.ModuleSelectorView })));
const CierresView         = React.lazy(() => import('./modules/cierres/CierresView').then(m => ({ default: m.CierresView })));
const DashboardView       = React.lazy(() => import('./modules/dashboard/DashboardView').then(m => ({ default: m.DashboardView })));
const ManagerDashboard    = React.lazy(() => import('./views/ManagerDashboard').then(m => ({ default: m.ManagerDashboard })));
const ClientePedirView   = React.lazy(() => import('./views/ClientePedirView').then(m => ({ default: m.ClientePedirView })));
const AttendanceView     = React.lazy(() => import('./modules/attendance/AttendanceView').then(m => ({ default: m.AttendanceView })));

const LoadingFallback = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-[#FFF8E7] gap-3">
    <div className="w-10 h-10 border-4 border-amber-400 border-t-amber-600 rounded-full animate-spin"></div>
    <span className="text-xs font-black text-amber-900 tracking-wider uppercase">Cargando...</span>
  </div>
);

import { Link } from 'react-router-dom';

const UnauthorizedView = () => {
  const signOut = useAuthStore((s) => s.signOut);
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: 'var(--color-bg)' }}>
      <span className="text-6xl">🚫</span>
      <h1 className="text-3xl font-black text-chunky-dark">Acceso Denegado</h1>
      <p className="text-gray-400 font-bold mb-4">No tienes permisos para ver esta sección.</p>
      <button 
        onClick={() => {
          signOut();
          window.location.href = '/login';
        }}
        className="bg-chunky-main hover:bg-chunky-secondary text-white font-black py-3 px-8 rounded-full shadow-md transition-all active:scale-95"
      >
        VOLVER AL INICIO
      </button>
    </div>
  );
};

function RoleRedirect() {
  const user = useAuthStore((s) => s.user);

  if (!user) return <Navigate to="/login" replace />;

  const access = user.access || [];

  // Si tiene MÁS de un módulo → pantalla de selección
  if (access.length > 1) {
    return <Navigate to="/selector" replace />;
  }

  // Un solo módulo → ir directo
  if (access.length === 1) {
    const key = access[0];

    if (key === 'vendedor') {
      try {
        const raw = localStorage.getItem('frita-seller-session');
        if (raw) {
          const parsed = JSON.parse(raw)?.state;
          const sessionUserId = parsed?.userId;
          const sessionResp = String(parsed?.responsibleName || '').trim().toLowerCase();
          const currentName = String(user?.name || '').trim().toLowerCase();
          const currentId = String(user?.id || user?.username || '').trim().toLowerCase();
          const isSameUser = (sessionUserId && sessionUserId === currentId) || (sessionResp && (sessionResp === currentName || sessionResp.includes(currentName) || currentName.includes(sessionResp)));

          if (parsed?.isSetupComplete && isSameUser) {
            return <Navigate to="/vendedor" replace />;
          }
        }
      } catch (_) {}
      return <Navigate to="/vendedor-setup" replace />;
    }

    if (key === 'vendedor-setup') {
      return <Navigate to="/vendedor-setup" replace />;
    }

    if (key === 'dejador') {
      try {
        const raw = localStorage.getItem('frita-dejador-session');
        if (raw && JSON.parse(raw)?.state?.isSetupComplete)
          return <Navigate to="/dejador" replace />;
      } catch (_) {}
      return <Navigate to="/dejador-setup" replace />;
    }

    const singleRoutes = {
      produccion: '/produccion', bodega: '/bodega', fritado: '/fritado',
      pos: '/pos', finanzas: '/finanzas',
      'finanzas-ingresos': '/finanzas', 'finanzas-gastos': '/finanzas', 'finanzas-nomina': '/finanzas',
      admin: '/admin', tracking: '/tracking', cierres: '/cierres',
      traslados: '/traslados', dashboard: '/dashboard', gerente: '/gerente',
    };
    return <Navigate to={singleRoutes[key] ?? '/selector'} replace />;
  }

  // Sin módulos → selector (mostrará mensaje de sin acceso)
  return <Navigate to="/selector" replace />;
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    const errorMsg = String(error?.message || error || '');
    const isChunkError = 
      errorMsg.includes('Importing a module script failed') ||
      errorMsg.includes('Failed to fetch dynamically imported module') ||
      errorMsg.includes('error loading dynamically imported module');

    if (isChunkError && typeof window !== 'undefined') {
      const lastReload = sessionStorage.getItem('chunk_reload_ts');
      const now = Date.now();
      if (!lastReload || (now - Number(lastReload)) > 10000) {
        sessionStorage.setItem('chunk_reload_ts', String(now));
        window.location.reload();
        return { hasError: false, error: null };
      }
    }

    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
    trackError('crash', error, { componentStack: errorInfo?.componentStack });
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '40px 20px',
          fontFamily: 'sans-serif',
          textAlign: 'center',
          background: '#fff8f8',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px'
        }}>
          <span style={{ fontSize: '3rem' }}>⚠️</span>
          <h2 style={{ color: '#c0392b', fontWeight: 900, margin: 0 }}>¡Error de aplicación no controlado!</h2>
          <pre style={{
            color: '#c0392b',
            fontSize: '0.75rem',
            background: '#fff0f0',
            border: '1px solid #fcc',
            borderRadius: '8px',
            padding: '12px 16px',
            maxWidth: '600px',
            textAlign: 'left',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all'
          }}>{this.state.error?.toString()}</pre>
          <button
            onClick={async () => {
              try {
                if ('serviceWorker' in navigator) {
                  const registrations = await navigator.serviceWorker.getRegistrations();
                  for (let registration of registrations) {
                    await registration.unregister();
                  }
                }
                if ('caches' in window) {
                  const keys = await caches.keys();
                  for (let key of keys) {
                    await caches.delete(key);
                  }
                }
              } catch (e) {
                console.error('Error clearing cache:', e);
              }
              this.setState({ hasError: false, error: null });
              window.location.href = window.location.href.split('#')[0] + '?v=' + Date.now();
            }}
            style={{
              background: '#e74c3c',
              color: 'white',
              border: 'none',
              borderRadius: '999px',
              padding: '12px 28px',
              fontWeight: 900,
              fontSize: '0.9rem',
              cursor: 'pointer',
              marginTop: '8px'
            }}
          >
            🔄 Recargar aplicación (Limpiar Caché)
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Reactive wrapper so MapTrackingView always gets live posShifts (BUG-08 fix)
function TrackingWrapper() {
  const posShifts = useInventoryStore((s) => s.posShifts) || [];
  return <MapTrackingView activeShifts={posShifts} />;
}

function App() {
  // Manejo de orientación dinámica (vertical/horizontal) para Opera y navegadores de Tablet
  useOrientation();

  // Suscripción a cambios remotos en tiempo real (Supabase)
  useRealtimeSync();

  useEffect(() => {
    // 0. Instalar handlers globales de errores (una sola vez)
    installGlobalErrorHandlers();

    // 0.1 Garantizar foco y cursor de inserción de texto (caret) en Electron al hacer clic en inputs
    const handleGlobalInputFocus = (e) => {
      const target = e.target;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        if (typeof window !== 'undefined' && window.focus) {
          window.focus();
        }
      }
    };
    document.addEventListener('click', handleGlobalInputFocus, true);

    initLogisticsRealtime();

    // 1. Estrategia Nube-Primero: al abrir la app o reconectarse, priorizar siempre los datos de Supabase si hay internet
    const syncAllRemoteStores = async () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        console.log('[CloudSync] Sin conexión a internet. Trabajando con caché local offline.');
        return;
      }
      try {
        const currentUser = useAuthStore.getState().user;
        const access = currentUser?.access || [];
        const isDejadorOrSellerOnly = access.length > 0 && access.every(a => a === 'dejador' || a === 'vendedor' || a === 'dejador-setup' || a === 'vendedor-setup');

        const storesToSync = [
          useAuthStore.getState().loadFromRemote(),
          useBranchStore.getState().loadFromRemote(),
          useVehicleStore.getState().loadFromRemote(),
          useInventoryStore.getState().loadFromRemote(),
          useLogisticsStore.getState().loadFromRemote(),
        ];

        // 🛡️ Optimización de memoria RAM: roles operativos en campo (Dejador / Vendedor) NUNCA necesitan
        // proveedores, tareas de caja, metas financieras, configuración de ingresos ni biometría masiva
        if (!isDejadorOrSellerOnly) {
          storesToSync.push(
            useSupplierStore.getState().loadFromRemote(),
            useTaskStore.getState().loadFromRemote(),
            useIncomeConfigStore.getState().loadFromRemote(),
            useGoalStore.getState().loadFromRemote(),
            useAttendanceStore.getState().loadFromRemote()
          );
        }

        await Promise.allSettled(storesToSync);
        flushQueue();
      } catch (err) {
        console.warn('[CloudSync] Error cargando datos de la nube:', err?.message);
      }
    };

    Promise.resolve().then(syncAllRemoteStores);

    // Auto-actualizar desde la nube cada vez que la app regresa a primer plano o recupera conexión a internet
    let lastSyncTime = 0;
    const handleSyncTrigger = () => {
      const now = Date.now();
      // Debounce/Throttle: al menos 30 segundos entre syncs automáticos de pantalla/conexión
      if (now - lastSyncTime < 30000) return;
      if (document.visibilityState === 'visible' && navigator.onLine) {
        lastSyncTime = now;
        syncAllRemoteStores();
      }
    };

    window.addEventListener('focus', handleSyncTrigger);
    window.addEventListener('online', handleSyncTrigger);
    document.addEventListener('visibilitychange', handleSyncTrigger);

    // 2. Inicializar sincronización entre pestañas (BroadcastChannel)
    initCrossTabSync();

    // Registrar stores que deben sincronizarse entre pestañas
    registerStore(
      'frita-mejor-logistics',
      (s) => useLogisticsStore.setState(s),
      () => useLogisticsStore.getState()
    );
    registerStore(
      'frita-mejor-inventory',
      (s) => useInventoryStore.setState(s),
      () => useInventoryStore.getState()
    );
    registerStore(
      'frita-mejor-vehicles',
      (s) => useVehicleStore.setState(s),
      () => useVehicleStore.getState()
    );
    registerStore(
      'frita-mejor-income-config',
      (s) => useIncomeConfigStore.setState(s),
      () => useIncomeConfigStore.getState()
    );
    registerStore(
      'frita-dashboard-goals',
      (s) => useGoalStore.setState(s),
      () => useGoalStore.getState()
    );

    // Suscribir: cuando un store cambia en ESTA pestaña → emitir a otras
    const unsubLogistics = useLogisticsStore.subscribe((state) => {
      if (isApplyingRemoteState() || isApplyingRealtimeState()) return;
      const { restockCart, pendingRequests, completedRequests, rejectedRequests, loadHistory } = state;
      broadcastState('frita-mejor-logistics', { restockCart, pendingRequests, completedRequests, rejectedRequests, loadHistory });
    });
    let prevInventorySubset = null;
    const unsubInventory = useInventoryStore.subscribe((state) => {
      if (isApplyingRemoteState() || isApplyingRealtimeState()) return;
      if (prevInventorySubset &&
          prevInventorySubset.products === state.products &&
          prevInventorySubset.posSettings === state.posSettings &&
          prevInventorySubset.posRegisters === state.posRegisters &&
          prevInventorySubset.loadTemplates === state.loadTemplates &&
          prevInventorySubset.posShifts === state.posShifts &&
          prevInventorySubset.posSales === state.posSales) {
        return;
      }
      prevInventorySubset = {
        products: state.products,
        posSettings: state.posSettings,
        posRegisters: state.posRegisters,
        loadTemplates: state.loadTemplates,
        posShifts: state.posShifts,
        posSales: state.posSales,
      };
      const { products, posSettings, posRegisters, loadTemplates, posShifts, posSales } = state;
      broadcastState('frita-mejor-inventory', { products, posSettings, posRegisters, loadTemplates, posShifts, posSales });
    });
    const unsubVehicles = useVehicleStore.subscribe((state) => {
      if (isApplyingRemoteState() || isApplyingRealtimeState()) return;
      const { vehicles, sellerViewEnabled, dejadorViewEnabled, enabledPointTypes } = state;
      broadcastState('frita-mejor-vehicles', { vehicles, sellerViewEnabled, dejadorViewEnabled, enabledPointTypes });
    });
    const unsubIncome = useIncomeConfigStore.subscribe((state) => {
      if (isApplyingRemoteState() || isApplyingRealtimeState()) return;
      const { hierarchy, descarguesEnabled } = state;
      broadcastState('frita-mejor-income-config', { hierarchy, descarguesEnabled });
    });
    const unsubGoals = useGoalStore.subscribe((state) => {
      if (isApplyingRemoteState() || isApplyingRealtimeState()) return;
      const { monthlyGoals } = state;
      broadcastState('frita-dashboard-goals', { monthlyGoals });
    });

    // 3. Auto-restaurar foco de teclado en la app Electron al interactuar con campos de texto
    const handleGlobalPointer = (e) => {
      const target = e.target;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        if (window.cajeroAPI && typeof window.cajeroAPI.restoreFocus === 'function') {
          window.cajeroAPI.restoreFocus();
        }
      }
    };
    document.addEventListener('pointerdown', handleGlobalPointer, true);

    return () => {
      unsubLogistics();
      unsubInventory();
      unsubVehicles();
      unsubIncome();
      unsubGoals();
      document.removeEventListener('pointerdown', handleGlobalPointer, true);
      window.removeEventListener('focus', handleSyncTrigger);
      window.removeEventListener('online', handleSyncTrigger);
      document.removeEventListener('visibilitychange', handleSyncTrigger);
    };
  }, []);

  return (
    <>
      <SyncStatusIndicator />
      <Toaster position="bottom-center" toastOptions={{ className: 'font-bold rounded-2xl shadow-chunky-lg text-sm', duration: 3000 }} />
      <BrowserRouter>
        <QuickTaskDrawer />
        <ErrorBoundary>
          <React.Suspense fallback={<LoadingFallback />}>
            <Routes>
              {/* ── Pública: rutas sin login ───────────────── */}
              <Route path="/login" element={<LoginView />} />
              <Route path="/pedir" element={<ClientePedirView />} />
              <Route path="/reportar-dano" element={<PublicDamageReportView />} />

              {/* ── Todo lo demás requiere estar autenticado ─────── */}
              <Route element={<ProtectedRoute />}>

                {/* Redirección raíz basada en rol */}
                <Route path="/" element={<RoleRedirect />} />

                {/* Selector de módulo — requiere login, sin restricción de módulo */}
                <Route path="/selector" element={<ModuleSelectorView />} />

                {/* Módulos por access[] del usuario */}
                <Route element={<ProtectedRoute allowedModules={['produccion']} />}>
                  <Route path="/produccion" element={<ProductionView />} />
                </Route>

                <Route element={<ProtectedRoute allowedModules={['fritado']} />}>
                  <Route path="/fritado" element={<FritadoView />} />
                </Route>

                <Route element={<ProtectedRoute allowedModules={['bodega']} />}>
                  <Route path="/bodega" element={<WarehouseView />} />
                </Route>

                <Route element={<ProtectedRoute allowedModules={['admin', 'dashboard']} />}>
                  <Route path="/admin" element={<AdminView />} />
                  <Route path="/dashboard" element={<DashboardView />} />
                </Route>

                <Route element={<ProtectedRoute allowedModules={['pos']} />}>
                  <Route path="/pos" element={<PosView />} />
                </Route>

                <Route element={<ProtectedRoute allowedModules={['finanzas-ingresos', 'finanzas-gastos', 'finanzas-nomina']} />}>
                  <Route path="/finanzas" element={<FinanceDashboard />} />
                </Route>

                <Route element={<ProtectedRoute allowedModules={['vendedor-setup', 'vendedor']} />}>
                  <Route path="/vendedor-setup" element={<SellerSetupView />} />
                  <Route path="/vendedor" element={<VendedorDashboard />} />
                </Route>

                <Route element={<ProtectedRoute allowedModules={['dejador']} />}>
                  <Route path="/dejador-setup" element={<DejadorSetupView />} />
                  <Route path="/dejador" element={<DejadorDashboard />} />
                </Route>

                <Route element={<ProtectedRoute allowedModules={['tracking', 'dejador', 'admin']} />}>
                  <Route path="/tracking" element={<TrackingWrapper />} />
                </Route>

                <Route element={<ProtectedRoute allowedModules={['cierres', 'admin']} />}>
                  <Route path="/cierres" element={<CierresView />} />
                </Route>

                <Route element={<ProtectedRoute allowedModules={['traslados', 'admin']} />}>
                  <Route path="/traslados" element={<TransfersView />} />
                </Route>

                <Route element={<ProtectedRoute allowedModules={['gerente']} />}>
                  <Route path="/gerente" element={<ManagerDashboard />} />
                </Route>

                <Route element={<ProtectedRoute allowedModules={['asistencia', 'admin', 'gerente']} />}>
                  <Route path="/asistencia" element={<AttendanceView />} />
                </Route>

                <Route element={<ProtectedRoute allowedModules={['tareas']} />}>
                  <Route path="/tareas" element={<TasksView />} />
                </Route>

                {/* Sin acceso al módulo */}
                <Route path="/unauthorized" element={<UnauthorizedView />} />

              </Route>
              {/* ──────────────────────────────────────────────── */}

              {/* Cualquier ruta desconocida → login */}
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </React.Suspense>
        </ErrorBoundary>
      </BrowserRouter>
    </>
  );
}

export default App;
