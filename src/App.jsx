import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/useAuthStore';
import { Toaster } from 'react-hot-toast';
import { useRealtimeSync, isApplyingRealtimeState } from './lib/useRealtimeSync';
import { useInventoryStore } from './store/useInventoryStore';
import { useLogisticsStore } from './store/useLogisticsStore';
import { flushQueue } from './lib/syncManager';
import { initCrossTabSync, registerStore, broadcastState, isApplyingRemoteState } from './lib/crossTabSync';
import SyncStatusIndicator from './components/ui/SyncStatusIndicator';

import { LoginView }      from './modules/auth/LoginView';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { ProductionView } from './modules/production/ProductionView';
import { WarehouseView }  from './modules/warehouse/WarehouseView';
import { AdminView }      from './modules/admin/AdminView';
import { PosView }        from './modules/pos/PosView';
import { FritadoView }    from './modules/fritado/FritadoView';

import { SellerSetupView }     from './views/SellerSetupView';
import { DejadorSetupView }    from './views/DejadorSetupView';
import { VendedorDashboard }   from './views/VendedorDashboard';
import { DejadorDashboard }    from './views/DejadorDashboard';
import { MapTrackingView }     from './views/MapTrackingView';
import { FinanceDashboard }    from './modules/pos/FinanceDashboard';
import { ModuleSelectorView }  from './views/ModuleSelectorView';
import { CierresView }         from './modules/cierres/CierresView';

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
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;

  const access = user.access || [];

  // Si tiene MÁS de un módulo → pantalla de selección
  if (access.length > 1) {
    return <Navigate to="/selector" replace />;
  }

  // Un solo módulo → ir directo
  if (access.length === 1) {
    const key = access[0];

    if (key === 'vendedor-setup' || key === 'vendedor') {
      try {
        const raw = localStorage.getItem('frita-seller-session');
        if (raw && JSON.parse(raw)?.state?.isSetupComplete)
          return <Navigate to="/vendedor" replace />;
      } catch (_) {}
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
      'finanzas-ingresos': '/finanzas', 'finanzas-gastos': '/finanzas',
      admin: '/admin', tracking: '/tracking', cierres: '/cierres',
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
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
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
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
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
            🔄 Recargar aplicación
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  // Suscripción a cambios remotos en tiempo real (Supabase)
  useRealtimeSync();

  useEffect(() => {
    // 1. Cargar estado remoto DESPUÉS de que Zustand persist hidrate
    // El persist de Zustand carga síncronamente desde localStorage,
    // pero lo hace en el mismo tick. Usamos un microtask (Promise.resolve)
    // para asegurarnos de que ya está cargado antes de llamar loadFromRemote.
    Promise.resolve().then(() => {
      useInventoryStore.getState().loadFromRemote();
      flushQueue();
    });

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

    // Suscribir: cuando logistics cambia en ESTA pestaña → emitir solo datos a otras
    // No re-emitir si el cambio viene de crossTabSync (eco) ni de Supabase Realtime
    // (cada pestaña recibe Supabase directamente — no necesita retransmisión)
    const unsubLogistics = useLogisticsStore.subscribe((state) => {
      if (isApplyingRemoteState() || isApplyingRealtimeState()) return;
      const { restockCart, pendingRequests, completedRequests, rejectedRequests, loadHistory } = state;
      broadcastState('frita-mejor-logistics', { restockCart, pendingRequests, completedRequests, rejectedRequests, loadHistory });
    });
    const unsubInventory = useInventoryStore.subscribe((state) => {
      if (isApplyingRemoteState() || isApplyingRealtimeState()) return;
      const { products, posSettings, loadTemplates, posShifts, posSales } = state;
      broadcastState('frita-mejor-inventory', { products, posSettings, loadTemplates, posShifts, posSales });
    });

    return () => {
      unsubLogistics();
      unsubInventory();
    };
  }, []);

  return (
    <>
      <SyncStatusIndicator />
      <Toaster position="bottom-center" toastOptions={{ className: 'font-bold rounded-2xl shadow-chunky-lg text-sm', duration: 3000 }} />
      <BrowserRouter>
        <ErrorBoundary>
          <Routes>
            {/* ── Pública: única ruta sin login ───────────────── */}
            <Route path="/login" element={<LoginView />} />

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

              <Route element={<ProtectedRoute allowedModules={['admin']} />}>
                <Route path="/admin" element={<AdminView />} />
              </Route>

              <Route element={<ProtectedRoute allowedModules={['pos']} />}>
                <Route path="/pos" element={<PosView />} />
              </Route>

              <Route element={<ProtectedRoute allowedModules={['finanzas-ingresos', 'finanzas-gastos']} />}>
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
                <Route path="/tracking" element={<MapTrackingView />} />
              </Route>

              <Route element={<ProtectedRoute allowedModules={['cierres', 'admin']} />}>
                <Route path="/cierres" element={<CierresView />} />
              </Route>

              {/* Sin acceso al módulo */}
              <Route path="/unauthorized" element={<UnauthorizedView />} />

            </Route>
            {/* ──────────────────────────────────────────────── */}

            {/* Cualquier ruta desconocida → login */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </ErrorBoundary>
      </BrowserRouter>
    </>
  );
}

export default App;
