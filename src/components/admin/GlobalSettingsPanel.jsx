import React, { useState } from 'react';
import { useBranchStore, BRANCH_TYPES } from '../../store/useBranchStore';
import { useAuthStore } from '../../store/useAuthStore';

// Tipos de traslado configurables por sede
const TRANSFER_TYPES = [
  { key: 'fritos',   label: 'Fritos',   icon: '🍟' },
  { key: 'crudos',   label: 'Crudos',   icon: '🥩' },
  { key: 'insumos',  label: 'Insumos',  icon: '🧂' },
  { key: 'productos',label: 'Productos',icon: '📦' },
];

// Solo visible para el Administrador Principal (role === 'ADMIN')
// =============================================================================

function BranchCard({ branch, onEdit, onToggle }) {
  const typeInfo = BRANCH_TYPES[branch.type] || { label: branch.type, icon: '🏢' };
  return (
    <div className={`border-2 rounded-2xl p-5 transition-all ${branch.active !== false ? 'border-gray-100 bg-white' : 'border-dashed border-gray-200 bg-gray-50 opacity-60'}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-2xl shadow-sm flex-shrink-0">
            {typeInfo.icon}
          </div>
          <div>
            <h3 className="font-black text-gray-900 text-base leading-tight">{branch.name}</h3>
            <span className="text-xs font-bold text-gray-400">{typeInfo.label}</span>
            {branch.settings?.address && (
              <p className="text-xs text-gray-400 font-medium mt-0.5 flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                {branch.settings.address}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-[10px] font-black px-2.5 py-1 rounded-full ${branch.active !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {branch.active !== false ? 'ACTIVA' : 'INACTIVA'}
          </span>
        </div>
      </div>

      {/* Transfer types */}
      <div className="mt-4">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Traslados habilitados</p>
        <div className="flex flex-wrap gap-1.5">
          {TRANSFER_TYPES.map(t => {
            const allowed = branch.settings?.allowedTransferTypes ?? ['fritos','crudos','insumos','productos'];
            const enabled = allowed.includes(t.key);
            return (
              <span
                key={t.key}
                className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-full ${
                  enabled ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-400 line-through'
                }`}
              >
                {t.icon} {t.label}
              </span>
            );
          })}
        </div>
      </div>

      {/* Settings summary */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
        {branch.settings?.businessName && (
          <div className="bg-gray-50 rounded-xl px-3 py-2">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Razón Social</p>
            <p className="text-xs font-black text-gray-700 truncate">{branch.settings.businessName}</p>
          </div>
        )}
        {branch.settings?.phone && (
          <div className="bg-gray-50 rounded-xl px-3 py-2">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Teléfono</p>
            <p className="text-xs font-black text-gray-700">{branch.settings.phone}</p>
          </div>
        )}
        {branch.settings?.printerName && (
          <div className="bg-gray-50 rounded-xl px-3 py-2">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Impresora</p>
            <p className="text-xs font-black text-gray-700">{branch.settings.printerName}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-4 flex gap-2">
        <button
          onClick={() => onEdit(branch)}
          className="flex-1 border border-gray-200 text-gray-600 font-bold text-xs py-2 rounded-xl hover:border-amber-400 hover:text-amber-600 transition-colors"
        >
          ✏️ Editar
        </button>
        {branch.id !== 'BRANCH-001' && (
          <button
            onClick={() => onToggle(branch)}
            className={`flex-1 font-bold text-xs py-2 rounded-xl transition-colors ${branch.active !== false
              ? 'border border-orange-100 text-orange-500 hover:bg-orange-50'
              : 'border border-green-100 text-green-600 hover:bg-green-50'
            }`}
          >
            {branch.active !== false ? '⏸ Desactivar' : '▶ Reactivar'}
          </button>
        )}
      </div>
    </div>
  );
}

function BranchModal({ branch, onSave, onClose }) {
  const isNew = !branch.id;
  const [form, setForm] = useState({
    name: branch.name || '',
    type: branch.type || 'pos',
    settings: {
      businessName: branch.settings?.businessName || '',
      nit: branch.settings?.nit || '',
      phone: branch.settings?.phone || '',
      address: branch.settings?.address || '',
      printerName: branch.settings?.printerName || 'POS-58',
      allowedTransferTypes: branch.settings?.allowedTransferTypes ?? ['fritos', 'crudos', 'insumos', 'productos'],
    },
  });

  const ch  = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const chS = (k, v) => setForm(f => ({ ...f, settings: { ...f.settings, [k]: v } }));

  const toggleTransferType = (key) => {
    const current = form.settings.allowedTransferTypes;
    const next = current.includes(key)
      ? current.filter(k => k !== key)
      : [...current, key];
    chS('allowedTransferTypes', next);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-[28px] p-7 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <h2 className="text-2xl font-black text-gray-900 mb-1">{isNew ? '🏪 Nueva Sede' : '✏️ Editar Sede'}</h2>
        <p className="text-sm text-gray-400 font-medium mb-6">Configura los datos de esta sucursal.</p>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Nombre de la Sede *</label>
            <input
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 font-bold text-gray-900 outline-none focus:border-amber-400"
              value={form.name}
              onChange={e => ch('name', e.target.value)}
              placeholder="Ej: Sede Norte, Local Centro"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Tipo de Sede</label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(BRANCH_TYPES).map(([key, val]) => (
                <button
                  key={key}
                  onClick={() => ch('type', key)}
                  className={`py-2 px-3 rounded-xl border-2 font-bold text-xs transition-all ${form.type === key ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-gray-100 text-gray-500 hover:border-gray-200'}`}
                >
                  {val.icon} {val.label}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Datos del Ticket / Factura</p>
            <div className="space-y-3">
              <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold text-gray-800 outline-none focus:border-amber-400" placeholder="Razón social (en el ticket)" value={form.settings.businessName} onChange={e => chS('businessName', e.target.value)} />
              <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold text-gray-800 outline-none focus:border-amber-400" placeholder="NIT o identificación" value={form.settings.nit} onChange={e => chS('nit', e.target.value)} />
              <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold text-gray-800 outline-none focus:border-amber-400" placeholder="Teléfono" value={form.settings.phone} onChange={e => chS('phone', e.target.value)} />
              <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold text-gray-800 outline-none focus:border-amber-400" placeholder="Dirección" value={form.settings.address} onChange={e => chS('address', e.target.value)} />
              <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold text-gray-800 outline-none focus:border-amber-400" placeholder="Nombre impresora (ej: POS-58)" value={form.settings.printerName} onChange={e => chS('printerName', e.target.value)} />
            </div>
          </div>

          {/* Toggles de traslados */}
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Tipos de Traslado Permitidos</p>
            <p className="text-[11px] text-gray-400 font-medium mb-3">Activa los tipos de mercancía que esta sede puede enviar o recibir.</p>
            <div className="grid grid-cols-2 gap-2">
              {TRANSFER_TYPES.map(t => {
                const enabled = form.settings.allowedTransferTypes.includes(t.key);
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => toggleTransferType(t.key)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 font-bold text-sm transition-all ${
                      enabled
                        ? 'border-orange-400 bg-orange-50 text-orange-700'
                        : 'border-gray-100 text-gray-400 hover:border-gray-200'
                    }`}
                  >
                    <span className="text-lg">{t.icon}</span>
                    <span>{t.label}</span>
                    <span className={`ml-auto text-xs font-black px-1.5 py-0.5 rounded-full ${
                      enabled ? 'bg-orange-200 text-orange-800' : 'bg-gray-100 text-gray-400'
                    }`}>
                      {enabled ? 'ON' : 'OFF'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 border-2 border-gray-200 text-gray-500 font-bold py-3 rounded-full hover:bg-gray-50 transition-colors">Cancelar</button>
          <button
            onClick={() => { if (form.name.trim()) { onSave(form); onClose(); } }}
            className="flex-1 bg-gradient-to-r from-amber-400 to-orange-500 text-white font-black py-3 rounded-full shadow-md hover:opacity-90 transition-opacity"
          >
            {isNew ? 'Crear Sede' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function GlobalSettingsPanel() {
  const { branches, addBranch, updateBranch, updateBranchSettings, deactivateBranch, reactivateBranch } = useBranchStore();
  const user = useAuthStore(s => s.user);

  const [showModal,    setShowModal]    = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);
  const [confirmBranch, setConfirmBranch] = useState(null); // sede a desactivar

  // Solo ADMIN puede ver esto
  if (user?.role !== 'ADMIN') {
    return (
      <div className="text-center py-20">
        <span className="text-5xl block mb-4">🔒</span>
        <p className="font-black text-gray-400 text-lg">Acceso restringido</p>
        <p className="text-sm text-gray-300 font-medium mt-1">Solo el Administrador Principal puede gestionar las sedes.</p>
      </div>
    );
  }

  const handleSave = (form) => {
    if (editingBranch?.id) {
      updateBranch(editingBranch.id, { name: form.name, type: form.type });
      updateBranchSettings(editingBranch.id, form.settings);
    } else {
      addBranch(form);
    }
    setEditingBranch(null);
  };

  const handleToggle = (branch) => {
    if (branch.active !== false) {
      setConfirmBranch(branch); // abrir modal de confirmación
    } else {
      reactivateBranch(branch.id);
    }
  };

  const activeBranches = branches.filter(b => b.active !== false);
  const inactiveBranches = branches.filter(b => b.active === false);

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-black text-gray-900">🏢 Gestión de Sedes</h2>
          <p className="text-sm text-gray-400 font-medium mt-0.5">
            {activeBranches.length} sede{activeBranches.length !== 1 ? 's' : ''} activa{activeBranches.length !== 1 ? 's' : ''}
            {inactiveBranches.length > 0 && ` · ${inactiveBranches.length} inactiva${inactiveBranches.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          onClick={() => { setEditingBranch({}); setShowModal(true); }}
          className="bg-gradient-to-r from-amber-400 to-orange-500 text-white font-black text-sm py-2.5 px-6 rounded-full shadow-md hover:opacity-90 transition-opacity flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nueva Sede
        </button>
      </div>

      {/* Sedes activas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {activeBranches.map(branch => (
          <BranchCard
            key={branch.id}
            branch={branch}
            onEdit={(b) => { setEditingBranch(b); setShowModal(true); }}
            onToggle={handleToggle}
          />
        ))}
      </div>

      {/* Sedes inactivas */}
      {inactiveBranches.length > 0 && (
        <div className="mt-6">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Sedes Inactivas</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {inactiveBranches.map(branch => (
              <BranchCard
                key={branch.id}
                branch={branch}
                onEdit={(b) => { setEditingBranch(b); setShowModal(true); }}
                onToggle={handleToggle}
              />
            ))}
          </div>
        </div>
      )}

      {/* Info card */}
      <div className="mt-6 bg-amber-50 border border-amber-100 rounded-2xl p-4 flex gap-3">
        <span className="text-2xl flex-shrink-0">💡</span>
        <div>
          <p className="font-black text-amber-800 text-sm">¿Cómo funciona el multisede?</p>
          <p className="text-xs text-amber-600 font-medium mt-1">
            Cada sede tiene su propio inventario, ventas y turnos aislados. Los usuarios se asignan a una sede específica desde <strong>Usuarios del Sistema</strong>. 
            El Admin ve todo consolidado. Los Gerentes solo ven las sedes que tú les autorices.
          </p>
        </div>
      </div>

      {/* Modal de edición */}
      {showModal && editingBranch !== null && (
        <BranchModal
          branch={editingBranch}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditingBranch(null); }}
        />
      )}

      {/* Modal de confirmación de desactivación */}
      {confirmBranch && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] p-7 w-full max-w-sm shadow-2xl text-center">
            <div className="w-16 h-16 rounded-2xl bg-orange-100 flex items-center justify-center text-3xl mx-auto mb-4">⏸</div>
            <h2 className="text-xl font-black text-gray-900 mb-2">¿Desactivar sede?</h2>
            <p className="text-sm text-gray-500 font-medium mb-1">
              <span className="font-black text-gray-800">"{confirmBranch.name}"</span>
            </p>
            <p className="text-xs text-gray-400 font-medium mb-6">
              Los usuarios asignados a esta sede no podrán operar hasta que la reactives.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmBranch(null)}
                className="flex-1 border-2 border-gray-200 text-gray-500 font-bold py-3 rounded-full hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => { deactivateBranch(confirmBranch.id); setConfirmBranch(null); }}
                className="flex-1 bg-orange-500 text-white font-black py-3 rounded-full hover:bg-orange-600 transition-colors"
              >
                Sí, desactivar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
