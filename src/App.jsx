import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/useAuthStore';
import { Toaster } from 'react-hot-toast';
import { useRealtimeSync } from './lib/useRealtimeSync';
import { useInventoryStore } from './store/useInventoryStore';
import { useLogisticsStore } from './store/useLogisticsStore';
import { flushQueue } from './lib/syncManager';
import { initCrossTabSync, registerStore, broadcastState } from './lib/crossTabSync';
import SyncStatusIndicator from './components/ui/SyncStatusIndicator';

import { LoginView }      from './modules/auth/LoginView';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { ProductionView } from './modules/production/ProductionView';
import { WarehouseView }  from './modules/warehouse/WarehouseView';
import { AdminView }      from './modules/admin/AdminView';
import { PosView }        from './modules/pos/PosView';
import { FritadoView }    from './modules/fritado/FritadoView';

import { SellerSetupView }   from './views/SellerSetupView';
import { DejadorSetupView }  from './views/DejadorSetupView';
import { VendedorDashboard } from './views/VendedorDashboard';
import { DejadorDashboard }  from './views/DejadorDashboard';
import { MapTrackingView }   from './views/MapTrackingView';
import { FinanceDashboard }  from './modules/pos/FinanceDashboard';

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

  // If vendor, check if there's already an active session before sending to setup
  if (user.role === 'VENDEDOR' || user.role === 'vendedor') {
    try {
      const raw = localStorage.getItem('frita-seller-session');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.state?.isSetupComplete) {
          return <Navigate to="/vendedor" replace />;
        }
      }
    } catch (_) {}
    return <Navigate to="/vendedor-setup" replace />;
  }

  // If dejador, check if there's already an active session
  if (user.role === 'DEJADOR' || user.role === 'dejador') {
    try {
      const raw = localStorage.getItem('frita-dejador-session');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.state?.isSetupComplete) {
          return <Navigate to="/dejador" replace />;
        }
      }
    } catch (_) {}
    return <Navigate to="/dejador-setup" replace />;
  }

  const routes = { 
    ADMIN: '/admin', 
    BODEGUERO: '/bodega', 
    OPERARIO: '/produccion', 
    FRITADOR: '/fritado',
    CAJERO: '/pos',
    DEJADOR: '/dejador',
    dejador: '/dejador',
    FINANZAS: '/finanzas'
  };
  return <Navigate to={routes[user.role] ?? '/produccion'} replace />;
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
        <div style={{ padding: '20px', color: 'red', fontFamily: 'monospace' }}>
          <h2>Unhandled App Error!</h2>
          <pre>{this.state.error?.toString()}</pre>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{this.state.error?.stack}</pre>
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
    // 1. Cargar estado remoto y vaciar cola Supabase
    useInventoryStore.getState().loadFromRemote();
    flushQueue();

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

    // Suscribir: cuando logistics cambia en ESTA pestaña → emitir a otras
    const unsubLogistics = useLogisticsStore.subscribe((state) => {
      broadcastState('frita-mejor-logistics', state);
    });
    const unsubInventory = useInventoryStore.subscribe((state) => {
      broadcastState('frita-mejor-inventory', state);
    });

    return () => {
      unsubLogistics();
      unsubInventory();
    };
  }, []);

  return (
    <ErrorBoundary>
      <SyncStatusIndicator />
      <Toaster position="bottom-center" toastOptions={{ className: 'font-bold rounded-2xl shadow-chunky-lg text-sm', duration: 3000 }} />
      <BrowserRouter>
        <Routes>
        {/* Pública */}
        <Route path="/login" element={<LoginView />} />

        {/* Redirección raíz basada en rol */}
        <Route path="/" element={<RoleRedirect />} />

        {/* Rutas protegidas */}
        <Route element={<ProtectedRoute allowedRoles={['OPERARIO', 'ADMIN']} />}>
          <Route path="/produccion" element={<ProductionView />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['FRITADOR', 'ADMIN']} />}>
          <Route path="/fritado" element={<FritadoView />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['BODEGUERO', 'ADMIN']} />}>
          <Route path="/bodega" element={<WarehouseView />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
          <Route path="/admin" element={<AdminView />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['CAJERO', 'ADMIN']} />}>
          <Route path="/pos" element={<PosView />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['FINANZAS', 'ADMIN']} />}>
          <Route path="/finanzas" element={<FinanceDashboard />} />
        </Route>

        {/* --- NUEVAS RUTAS DE MÓDULO OPERATIVO --- */}
        <Route element={<ProtectedRoute allowedRoles={['VENDEDOR', 'vendedor', 'ADMIN']} />}>
          <Route path="/vendedor-setup" element={<SellerSetupView />} />
          <Route path="/vendedor" element={<VendedorDashboard />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['DEJADOR', 'dejador', 'ADMIN']} />}>
          <Route path="/dejador-setup" element={<DejadorSetupView />} />
          <Route path="/dejador" element={<DejadorDashboard />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
          <Route path="/tracking" element={<MapTrackingView />} />
        </Route>
        {/* ---------------------------------------- */}

        <Route path="/unauthorized" element={<UnauthorizedView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
