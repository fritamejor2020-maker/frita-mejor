import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';

/**
 * Guarda de ruta.
 * Comprueba que el usuario esté autenticado.
 * Si se proporciona `allowedRoles`, verifica que el rol esté en la lista.
 * Si se proporciona `allowedModules`, verifica que el usuario tenga al menos
 * uno de esos módulos en su `access[]` (permite acceso granular por módulo).
 */
export function ProtectedRoute({ allowedRoles, allowedModules }) {
  const user = useAuthStore((s) => s.user);
  const _hasHydrated = useAuthStore((s) => s._hasHydrated);
  const isHydrated = _hasHydrated || (useAuthStore.persist?.hasHydrated ? useAuthStore.persist.hasHydrated() : true);

  // 🛡️ Prevenir expulsión a /login durante el ciclo de lectura de localStorage
  if (!isHydrated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#FFF8E7] gap-3">
        <div className="w-10 h-10 border-4 border-amber-400 border-t-amber-600 rounded-full animate-spin"></div>
        <span className="text-xs font-black text-amber-900 tracking-wider uppercase">Verificando sesión...</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Verificar por rol (compatibilidad con guardas existentes)
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  // Verificar por módulo/access si se especifica (más granular)
  if (allowedModules) {
    const userAccess = user.access || [];
    const hasAccess = user.role === 'ADMIN' || allowedModules.some((mod) => userAccess.includes(mod));
    if (!hasAccess) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return <Outlet />;
}
