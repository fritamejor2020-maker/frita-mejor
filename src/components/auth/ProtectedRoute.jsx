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
  const { user } = useAuthStore();

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
    const hasAccess = allowedModules.some((mod) => userAccess.includes(mod));
    if (!hasAccess) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return <Outlet />;
}
