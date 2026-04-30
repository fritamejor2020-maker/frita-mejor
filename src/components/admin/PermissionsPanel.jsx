import React, { useState } from 'react';
import { useAuthStore, MANAGER_PERMISSIONS } from '../../store/useAuthStore';
import { useBranchStore } from '../../store/useBranchStore';

// =============================================================================
// PermissionsPanel — Gestión de Permisos para Gerentes
// Solo visible para el Administrador Principal (role === 'ADMIN')
// =============================================================================

function PermissionSwitch({ permission, enabled, onChange }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${
        enabled
          ? 'border-amber-300 bg-amber-50'
          : 'border-gray-100 bg-gray-50 opacity-70'
      }`}
    >
      <span className={`text-sm font-bold ${enabled ? 'text-amber-800' : 'text-gray-500'}`}>
        {permission.label}
      </span>
      <div className={`w-10 h-5 rounded-full transition-all relative ${enabled ? 'bg-amber-400' : 'bg-gray-200'}`}>
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${enabled ? 'left-5.5 translate-x-0.5' : 'left-0.5'}`} style={{ left: enabled ? '22px' : '2px' }} />
      </div>
    </button>
  );
}

function ManagerCard({ manager, branches, onEdit }) {
  const assignedBranches = branches.filter(b => (manager.allowedBranches || []).includes(b.id));
  const permCount = (manager.permissions || []).length;

  return (
    <div className="border-2 border-gray-100 rounded-2xl p-5 bg-white hover:border-amber-200 transition-all">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-black text-lg shadow-sm">
            {(manager.name || 'G')[0].toUpperCase()}
          </div>
          <div>
            <h3 className="font-black text-gray-900">{manager.name}</h3>
            <p className="text-xs font-bold text-gray-400">
              {manager.role === 'MANAGER' ? '⭐ Gerente General' : manager.role}
            </p>
          </div>
        </div>
        <button
          onClick={() => onEdit(manager)}
          className="text-xs font-bold border border-violet-200 text-violet-600 px-3 py-1.5 rounded-full hover:bg-violet-50 transition-colors"
        >
          Configurar
        </button>
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-2">
        {assignedBranches.length === 0 ? (
          <span className="text-xs font-bold bg-red-50 text-red-400 px-2.5 py-1 rounded-full">Sin sedes asignadas</span>
        ) : (
          assignedBranches.map(b => (
            <span key={b.id} className="text-xs font-bold bg-violet-50 text-violet-600 px-2.5 py-1 rounded-full">
              {b.name}
            </span>
          ))
        )}
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${permCount > 0 ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
          {permCount} permiso{permCount !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
}

function ManagerEditModal({ manager, branches, onSave, onClose }) {
  const [allowedBranches, setAllowedBranches] = useState(manager.allowedBranches || []);
  const [permissions, setPermissions] = useState(manager.permissions || []);

  const toggleBranch = (id) => {
    setAllowedBranches(prev =>
      prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]
    );
  };

  const togglePermission = (id, enabled) => {
    setPermissions(prev =>
      enabled ? [...prev, id] : prev.filter(p => p !== id)
    );
  };

  const handleSave = () => {
    onSave(manager.id, { allowedBranches, permissions });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div
        className="bg-white rounded-[28px] p-7 w-full max-w-md shadow-2xl my-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-black text-xl shadow-sm">
            {(manager.name || 'G')[0].toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl font-black text-gray-900">{manager.name}</h2>
            <p className="text-xs text-gray-400 font-medium">Gerente General · Configura su acceso</p>
          </div>
        </div>

        {/* Sedes */}
        <div className="mb-5">
          <p className="text-xs font-black text-gray-700 uppercase tracking-wider mb-3">🏢 Sedes que puede ver</p>
          <div className="space-y-2">
            {branches.map(branch => (
              <button
                key={branch.id}
                onClick={() => toggleBranch(branch.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left ${
                  allowedBranches.includes(branch.id)
                    ? 'border-violet-300 bg-violet-50'
                    : 'border-gray-100 bg-gray-50 opacity-70'
                }`}
              >
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                  allowedBranches.includes(branch.id) ? 'bg-violet-500 border-violet-500' : 'border-gray-300'
                }`}>
                  {allowedBranches.includes(branch.id) && (
                    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                  )}
                </div>
                <span className={`font-bold text-sm ${allowedBranches.includes(branch.id) ? 'text-violet-800' : 'text-gray-500'}`}>
                  {branch.name}
                </span>
                <span className="text-xs text-gray-400 ml-auto">{branch.type}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Permisos */}
        <div className="mb-6">
          <p className="text-xs font-black text-gray-700 uppercase tracking-wider mb-3">🔑 Qué puede hacer</p>
          <div className="space-y-2">
            {MANAGER_PERMISSIONS.map(perm => (
              <PermissionSwitch
                key={perm.id}
                permission={perm}
                enabled={permissions.includes(perm.id)}
                onChange={(val) => togglePermission(perm.id, val)}
              />
            ))}
          </div>
          <p className="text-[11px] text-gray-400 font-medium mt-2">
            💡 Lo que no esté activado aparecerá bloqueado para este gerente.
          </p>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 border-2 border-gray-200 text-gray-500 font-bold py-3 rounded-full hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
          <button onClick={handleSave} className="flex-1 bg-gradient-to-r from-violet-500 to-purple-600 text-white font-black py-3 rounded-full shadow-md hover:opacity-90 transition-opacity">
            Guardar Permisos
          </button>
        </div>
      </div>
    </div>
  );
}

export function PermissionsPanel() {
  const users = useAuthStore(s => s.users);
  const updateUser = useAuthStore(s => s.updateUser);
  const currentUserRole = useAuthStore(s => s.user?.role);
  const allBranches = useBranchStore(s => s.branches);
  const branches = allBranches.filter(b => b.active !== false);

  const [editingManager, setEditingManager] = useState(null);

  // Solo ADMIN puede ver esto
  if (currentUserRole !== 'ADMIN') {
    return (
      <div className="text-center py-20">
        <span className="text-5xl block mb-4">🔒</span>
        <p className="font-black text-gray-400 text-lg">Acceso restringido</p>
        <p className="text-sm text-gray-300 font-medium mt-1">Solo el Administrador Principal puede gestionar permisos.</p>
      </div>
    );
  }

  const managers = users.filter(u => u.role === 'MANAGER' && u.active);

  const handleSave = (managerId, updates) => {
    updateUser(managerId, updates);
  };

  if (managers.length === 0) {
    return (
      <div>
        <div className="mb-6">
          <h2 className="text-2xl font-black text-gray-900">🔑 Permisos de Gerentes</h2>
          <p className="text-sm text-gray-400 font-medium mt-0.5">
            Controla qué puede ver y hacer cada Gerente General.
          </p>
        </div>
        <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl">
          <span className="text-5xl block mb-4">👔</span>
          <p className="font-black text-gray-400 text-lg">No hay gerentes configurados</p>
          <p className="text-sm text-gray-300 font-medium mt-1">
            Ve a <strong>Usuarios del Sistema</strong> y crea un usuario con el rol <strong>MANAGER</strong>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-2xl font-black text-gray-900">🔑 Permisos de Gerentes</h2>
          <p className="text-sm text-gray-400 font-medium mt-0.5">
            {managers.length} gerente{managers.length !== 1 ? 's' : ''} · Configura su acceso a sedes y funciones
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {managers.map(manager => (
          <ManagerCard
            key={manager.id}
            manager={manager}
            branches={branches}
            onEdit={(m) => setEditingManager(m)}
          />
        ))}
      </div>

      {/* Info */}
      <div className="mt-6 bg-violet-50 border border-violet-100 rounded-2xl p-4 flex gap-3">
        <span className="text-2xl flex-shrink-0">ℹ️</span>
        <div>
          <p className="font-black text-violet-800 text-sm">Sobre los permisos</p>
          <p className="text-xs text-violet-600 font-medium mt-1">
            El <strong>Admin Principal (Tú)</strong> siempre tiene acceso completo a todo, sin importar esta configuración.
            Los Gerentes solo pueden acceder a los módulos que les actives y solo a las sedes que les asignes.
          </p>
        </div>
      </div>

      {editingManager && (
        <ManagerEditModal
          manager={editingManager}
          branches={branches}
          onSave={handleSave}
          onClose={() => setEditingManager(null)}
        />
      )}
    </div>
  );
}
