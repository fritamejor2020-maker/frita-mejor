import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/useAuthStore';
import { Toaster } from 'react-hot-toast';

import { LoginView }      from './modules/auth/LoginView';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { ProductionView } from './modules/production/ProductionView';
import { WarehouseView }  from './modules/warehouse/WarehouseView';
import { AdminView }      from './modules/admin/AdminView';
import { PosView }        from './modules/pos/PosView';
import { FritadoView }    from './modules/fritado/FritadoView';

import { SellerSetupView }   from './views/SellerSetupView';
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
  const routes = { 
    ADMIN: '/admin', 
    BODEGUERO: '/bodega', 
    OPERARIO: '/produccion', 
    FRITADOR: '/fritado',
    CAJERO: '/pos',
    VENDEDOR: '/vendedor-setup',
    vendedor: '/vendedor-setup',
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
  return (
    <ErrorBoundary>
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
