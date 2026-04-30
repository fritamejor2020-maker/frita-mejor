import React, { useState, useEffect } from 'react';
import { useAuthStore, ROLE_ACCESS } from '../../store/useAuthStore';
import { useBranchStore } from '../../store/useBranchStore';
import { User, Edit2, Trash2, Check, X, UserMinus, UserCheck, Shield, RefreshCw } from 'lucide-react';
import { push } from '../../lib/syncManager';

// ── Todos los módulos disponibles en la app ───────────────────────────────────
const ALL_MODULES = [
  { key: 'produccion',        label: 'Producción',     icon: '🏭', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { key: 'bodega',            label: 'Bodega',          icon: '📦', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { key: 'fritado',           label: 'Fritado',         icon: '🍳', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  { key: 'pos',               label: 'Caja POS',        icon: '🛒', color: 'bg-green-100 text-green-700 border-green-200' },
  { key: 'finanzas-ingresos', label: 'Ingresos',        icon: '💵', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { key: 'finanzas-gastos',   label: 'Gastos',          icon: '💸', color: 'bg-red-100 text-red-700 border-red-200' },
  { key: 'finanzas-nomina',   label: 'Nómina',          icon: '👥', color: 'bg-violet-100 text-violet-700 border-violet-200' },
  { key: 'vendedor-setup',    label: 'Conf. Vendedor',  icon: '⚙️', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { key: 'vendedor',          label: 'Vendedor',        icon: '🛵', color: 'bg-rose-100 text-rose-700 border-rose-200' },
  { key: 'dejador',           label: 'Dejador',         icon: '🚚', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { key: 'admin',             label: 'Admin',           icon: '🔧', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { key: 'tracking',          label: 'Rutas/Mapa',      icon: '🗺️', color: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
  { key: 'cierres',           label: 'Auditor Cierres', icon: '🧐', color: 'bg-teal-100 text-teal-700 border-teal-200' },
];

const ALL_ROLES = ['ADMIN', 'MANAGER', 'OPERARIO', 'FRITADOR', 'BODEGUERO', 'CAJERO', 'VENDEDOR', 'DEJADOR', 'FINANZAS'];

const ROLE_COLORS: Record<string, string> = {
  ADMIN:     'bg-purple-500 text-white',
  MANAGER:   'bg-violet-500 text-white',
  VENDEDOR:  'bg-red-500 text-white',
  DEJADOR:   'bg-orange-500 text-white',
  OPERARIO:  'bg-blue-500 text-white',
  FRITADOR:  'bg-yellow-500 text-white',
  BODEGUERO: 'bg-amber-500 text-white',
  CAJERO:    'bg-green-500 text-white',
  FINANZAS:  'bg-emerald-500 text-white',
};

const EMPTY_FORM = { name: '', role: 'CAJERO', password: '', access: ROLE_ACCESS['CAJERO'] || [], branchId: 'BRANCH-001' };

// ── Toggle de un módulo en la lista de access ─────────────────────────────────
function toggleModule(access: string[], key: string): string[] {
  return access.includes(key) ? access.filter((k) => k !== key) : [...access, key];
}

// ── Chips de módulos (clickeables en edición, solo lectura en vista) ──────────
function ModuleChips({
  access,
  editable = false,
  onChange,
}: {
  access: string[];
  editable?: boolean;
  onChange?: (next: string[]) => void;
}) {
  const visible = ALL_MODULES.filter((m) => editable || access.includes(m.key));
  if (visible.length === 0) return <span className="text-xs text-gray-400 font-bold">Sin módulos</span>;

  return (
    <div className="flex flex-wrap gap-1.5">
      {(editable ? ALL_MODULES : visible).map((m) => {
        const active = access.includes(m.key);
        return (
          <button
            key={m.key}
            type="button"
            disabled={!editable}
            onClick={() => editable && onChange && onChange(toggleModule(access, m.key))}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-bold transition-all
              ${editable ? 'cursor-pointer hover:scale-105 active:scale-95' : 'cursor-default'}
              ${active
                ? m.color + ' shadow-sm'
                : 'bg-gray-50 text-gray-300 border-gray-100'
              }`}
          >
            <span>{m.icon}</span>
            <span>{m.label}</span>
            {editable && active && <span className="text-[10px] ml-0.5">✓</span>}
          </button>
        );
      })}
    </div>
  );
}

// ── Formulario de usuario (agregar / editar) ──────────────────────────────────
function UserForm({
  form,
  setForm,
  onSave,
  onCancel,
  isEdit = false,
}: {
  form: any;
  setForm: (f: any) => void;
  onSave: () => void;
  onCancel: () => void;
  isEdit?: boolean;
}) {
  const [showPass, setShowPass] = useState(false);
  const branches = useBranchStore(s => s.branches).filter((b: any) => b.active !== false);

  // Roles que son GLOBALES (sin sede fija)
  const isGlobalRole = ['ADMIN', 'DEJADOR'].includes(form.role);

  return (
    <div className="bg-white rounded-2xl border-2 border-frita-red p-5 flex flex-col gap-4 animate-fade-in shadow-sm">
      {/* Fila 1: nombre, contraseña, rol */}
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[140px]">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Nombre</label>
          <input
            className="w-full border-2 border-gray-100 focus:border-frita-red rounded-xl px-3 py-2.5 font-bold outline-none text-gray-800 transition-colors"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ej. Juan Pérez"
          />
        </div>
        <div className="flex-1 min-w-[140px]">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">
            {isEdit ? 'Nueva contraseña (opcional)' : 'Contraseña / PIN'}
          </label>
          <div className="relative">
            <input
              type={showPass ? 'text' : 'password'}
              autoComplete="new-password"
              className="w-full border-2 border-gray-100 focus:border-frita-red rounded-xl px-3 py-2.5 font-bold outline-none text-gray-800 transition-colors pr-10"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder={isEdit ? 'Sin cambios' : 'Ej. 1234'}
            />
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPass ? '🙈' : '👁️'}
            </button>
          </div>
        </div>
        <div className="flex-1 min-w-[130px]">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Rol principal</label>
          <select
            className="w-full border-2 border-gray-100 focus:border-frita-red rounded-xl px-3 py-2.5 font-bold outline-none text-gray-800 transition-colors"
            value={form.role}
            onChange={(e) => {
              const role = e.target.value;
              const isGlobal = ['ADMIN', 'DEJADOR'].includes(role);
              setForm({ ...form, role, access: ROLE_ACCESS[role] || [], branchId: isGlobal ? null : (form.branchId || 'BRANCH-001') });
            }}
          >
            {ALL_ROLES.map((r) => (
              <option key={r} value={r}>{r.charAt(0) + r.slice(1).toLowerCase()}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Fila 2: Sede asignada */}
      <div>
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">
          🏢 Sede asignada
          {isGlobalRole && <span className="normal-case text-blue-400 ml-2">— Acceso Global (no requiere sede)</span>}
        </label>
        {isGlobalRole ? (
          <div className="px-4 py-2.5 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 font-bold text-sm">
            🌐 Este rol tiene acceso a todas las sedes automáticamente
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {branches.map((b: any) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setForm({ ...form, branchId: b.id })}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-left font-bold text-sm transition-all ${
                  form.branchId === b.id
                    ? 'border-frita-red bg-red-50 text-frita-red'
                    : 'border-gray-100 text-gray-500 hover:border-gray-200'
                }`}
              >
                <span className="text-base">{b.type === 'pos' ? '🏪' : b.type === 'fabricacion' ? '🏭' : '📦'}</span>
                <span className="truncate">{b.name}</span>
                {form.branchId === b.id && <span className="ml-auto text-frita-red">✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Fila 2: módulos (chips clickeables) */}
      <div>
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">
          Módulos con acceso <span className="normal-case text-gray-300">(toca para activar/desactivar)</span>
        </label>
        <ModuleChips
          access={form.access || []}
          editable
          onChange={(next) => setForm({ ...form, access: next })}
        />
      </div>

      {/* Botones */}
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-xl bg-gray-100 text-gray-500 font-bold hover:bg-gray-200 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={onSave}
          className="px-5 py-2 rounded-xl bg-green-500 text-white font-black hover:bg-green-600 transition-colors flex items-center gap-2 shadow-sm"
        >
          <Check size={16} strokeWidth={3} />
          Guardar
        </button>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export const AdminUsersTab = () => {
  const { users, addUser, updateUser, deleteUser, toggleUserActive } = useAuthStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd]     = useState(false);
  const [form, setForm]           = useState<any>(EMPTY_FORM);
  const [syncing, setSyncing]     = useState(false);
  const [syncMsg, setSyncMsg]     = useState<string | null>(null);
  const [deletingUser, setDeletingUser] = useState<{ id: string; name: string } | null>(null);

  // Al abrir la pestaña, empujar la lista actual de usuarios a Supabase
  // Esto garantiza que usuarios creados antes del fix de sync lleguen a todos los dispositivos
  useEffect(() => {
    push('users', useAuthStore.getState().users).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleForceSyncUsers = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      await push('users', useAuthStore.getState().users);
      setSyncMsg('✅ Usuarios sincronizados — el celular recibirá la lista al recargar.');
    } catch {
      setSyncMsg('❌ Error al sincronizar. Verifica la conexión.');
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMsg(null), 5000);
    }
  };

  const handleSaveAdd = () => {
    if (!form.name || !form.password) { alert('Nombre y contraseña son obligatorios'); return; }
    const isGlobalRole = ['ADMIN', 'DEJADOR'].includes(form.role);
    const res = addUser({ ...form, branchId: isGlobalRole ? null : (form.branchId || 'BRANCH-001'), permissions: [] });
    if (!res.ok) { alert(res.error); return; }
    setShowAdd(false);
    setForm(EMPTY_FORM);
  };

  const handleSaveEdit = (id: string) => {
    if (!form.name) { alert('El nombre es obligatorio'); return; }
    const isGlobalRole = ['ADMIN', 'DEJADOR'].includes(form.role);
    const updates: any = {
      name: form.name,
      role: form.role,
      access: form.access,
      branchId: isGlobalRole ? null : (form.branchId || 'BRANCH-001'),
    };
    if (form.password) updates.password = form.password;
    const res = updateUser(id, updates);
    if (res?.ok === false && res?.error) { alert(res.error); return; }
    setEditingId(null);
  };

  return (
    <div className="p-4 flex-1 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-5">
        <div>
          <h2 className="text-2xl font-black text-gray-800">Usuarios del Sistema</h2>
          <p className="text-sm text-gray-400 font-bold mt-0.5">Gestiona accesos y módulos por usuario</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleForceSyncUsers}
            disabled={syncing}
            title="Forzar sincronización de usuarios a todos los dispositivos"
            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl border transition-all ${
              syncing
                ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                : 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100 active:scale-95'
            }`}
          >
            <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
            Sincronizar
          </button>
          <button
            className="bg-frita-red hover:bg-red-500 text-white font-black py-2 px-4 rounded-xl shadow-sm transition-all active:scale-95"
            onClick={() => { setShowAdd(true); setForm(EMPTY_FORM); setEditingId(null); }}
          >
            + Agregar Usuario
          </button>
        </div>
      </div>
      {syncMsg && (
        <div className="mb-4 text-sm font-bold text-center bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-blue-700">
          {syncMsg}
        </div>
      )}

      {/* Formulario de agregar */}
      {showAdd && (
        <div className="mb-4">
          <UserForm
            form={form}
            setForm={setForm}
            onSave={handleSaveAdd}
            onCancel={() => setShowAdd(false)}
          />
        </div>
      )}

      {/* Lista de usuarios */}
      <div className="flex flex-col gap-3">
        {users.map((u: any) => (
          <div key={u.id}>
            {editingId === u.id ? (
              <UserForm
                form={form}
                setForm={setForm}
                onSave={() => handleSaveEdit(u.id)}
                onCancel={() => setEditingId(null)}
                isEdit
              />
            ) : (
              <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm transition-all ${!u.active ? 'opacity-55' : ''}`}>
                <div className="flex items-center gap-3 p-4">
                  {/* Avatar */}
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${ROLE_COLORS[u.role] || 'bg-gray-400 text-white'}`}>
                    {u.role === 'ADMIN' ? <Shield size={20} /> : <User size={20} />}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-black text-base ${!u.active ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                        {u.name}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${ROLE_COLORS[u.role] || 'bg-gray-400 text-white'}`}>
                        {u.role}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${u.active ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                        {u.active ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                    {/* Módulos y sede */}
                    <div className="mt-2 flex flex-col gap-1.5">
                      {u.branchId ? (
                        <span className="text-[10px] font-bold text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full w-fit">
                          🏢 {useBranchStore.getState().getBranchById(u.branchId)?.name || u.branchId}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-blue-400 bg-blue-50 px-2 py-0.5 rounded-full w-fit">🌐 Global</span>
                      )}
                      <ModuleChips access={u.access || []} />
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      className="p-2 rounded-xl bg-gray-50 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                      title="Editar"
                      onClick={() => {
                        setEditingId(u.id);
                        setForm({ name: u.name, role: u.role, password: '', access: u.access ?? [], branchId: u.branchId ?? 'BRANCH-001' });
                        setShowAdd(false);
                      }}
                    >
                      <Edit2 size={16} strokeWidth={2.5} />
                    </button>
                    <button
                      className={`p-2 rounded-xl transition-colors ${u.active ? 'bg-gray-50 text-gray-400 hover:text-orange-500 hover:bg-orange-50' : 'bg-green-50 text-green-500 hover:bg-green-100'}`}
                      title={u.active ? 'Desactivar' : 'Activar'}
                      onClick={() => toggleUserActive(u.id)}
                    >
                      {u.active ? <UserMinus size={16} strokeWidth={2.5} /> : <UserCheck size={16} strokeWidth={2.5} />}
                    </button>
                    <button
                      className="p-2 rounded-xl bg-red-50 text-red-400 hover:text-red-600 hover:bg-red-100 transition-colors"
                      title="Eliminar"
                      onClick={() => setDeletingUser({ id: u.id, name: u.name })}
                    >
                      <Trash2 size={16} strokeWidth={2.5} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Modal confirmar eliminar usuario */}
      {deletingUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-6">
          <div className="bg-white rounded-3xl shadow-2xl p-6 max-w-xs w-full text-center">
            <div className="text-4xl mb-3">🗑️</div>
            <h2 className="text-xl font-black text-gray-900 mb-1">¿Eliminar usuario?</h2>
            <p className="text-sm text-gray-500 mb-6">«{deletingUser.name}» se eliminará del sistema.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeletingUser(null)} className="flex-1 py-3 rounded-2xl bg-gray-100 text-gray-700 font-bold text-sm active:scale-95">Cancelar</button>
              <button onClick={() => { deleteUser(deletingUser.id); setDeletingUser(null); }} className="flex-1 py-3 rounded-2xl bg-red-500 text-white font-black text-sm active:scale-95">Sí, eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
