import React, { useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { User, Edit2, Trash2, Check, X, UserMinus, UserCheck } from 'lucide-react';

export const AdminUsersTab = () => {
  const { users, addUser, updateUser, deleteUser, toggleUserActive } = useAuthStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', role: 'VENDEDOR', password: '', active: true });

  const teamUsers = users.filter((u: any) => ['VENDEDOR', 'DEJADOR', 'OPERARIO', 'FRITADOR'].includes(u.role));

  const handleSaveAdd = () => {
    if (!form.name || !form.password) { alert('Nombre y contraseña obligatorios'); return; }
    const res = addUser(form);
    if (!res.ok) { alert(res.error); return; }
    setShowAdd(false);
  };

  const handleSaveEdit = (id: string) => {
    if (!form.name) return;
    const res = updateUser(id, { name: form.name, role: form.role, ...(form.password ? { password: form.password } : {}) });
    if (!res?.ok && res?.error) { alert(res.error); return; }
    setEditingId(null);
  };

  const getRoleColor = (role: string) => {
    switch(role) {
      case 'VENDEDOR': return 'bg-frita-red text-white';
      case 'DEJADOR': return 'bg-frita-orange text-white';
      case 'OPERARIO': return 'bg-blue-500 text-white';
      case 'FRITADOR': return 'bg-yellow-500 text-white';
      default: return 'bg-gray-400 text-white';
    }
  };

  return (
    <div className="p-4 flex-1">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-black text-gray-800">Equipo Operativo</h2>
        <button className="bg-frita-red hover:bg-red-500 text-white font-black py-2 px-4 rounded-xl shadow-sm transition-transform active:scale-95" onClick={() => { setShowAdd(true); setForm({ name: '', role: 'VENDEDOR', password: '', active: true }); setEditingId(null); }}>
          + Agregar Personal
        </button>
      </div>

      {showAdd && (
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mb-4 flex gap-2 flex-wrap items-end animate-fade-in">
           <div className="flex-1 min-w-[150px]">
             <label className="text-xs font-bold text-gray-400 mb-1 block">Nombre Completo</label>
             <input className="w-full border-2 border-gray-100 rounded-xl px-3 py-2 font-bold outline-none focus:border-frita-red text-gray-800" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Ej. Juan Pérez" />
           </div>
           <div className="flex-1 min-w-[120px]">
             <label className="text-xs font-bold text-gray-400 mb-1 block">Rol</label>
             <select className="w-full border-2 border-gray-100 rounded-xl px-3 py-2 font-bold outline-none focus:border-frita-red text-gray-800" value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
               <option value="VENDEDOR">Vendedor</option>
               <option value="DEJADOR">Dejador</option>
               <option value="OPERARIO">Operario</option>
               <option value="FRITADOR">Fritador</option>
             </select>
           </div>
           <div className="flex-1 min-w-[120px]">
             <label className="text-xs font-bold text-gray-400 mb-1 block">PIN / Clave de Acceso</label>
             <input type="text" className="w-full border-2 border-gray-100 rounded-xl px-3 py-2 font-bold outline-none focus:border-frita-red text-gray-800" value={form.password} onChange={e => setForm({...form, password: e.target.value})} placeholder="Ej. 1234" />
           </div>
           <div className="flex gap-2">
             <button className="bg-green-500 text-white p-2.5 rounded-xl shadow-sm hover:scale-105 transition-all" onClick={handleSaveAdd}><Check size={20} strokeWidth={3} /></button>
             <button className="bg-gray-100 text-gray-400 p-2.5 rounded-xl hover:bg-gray-200 transition-colors" onClick={() => setShowAdd(false)}><X size={20} strokeWidth={3} /></button>
           </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {teamUsers.map((u: any) => (
          <div key={u.id}>
            {editingId === u.id ? (
              <div className="bg-white p-4 rounded-2xl shadow-sm border-2 border-frita-red flex gap-2 flex-wrap items-end animate-fade-in">
                <div className="flex-1 min-w-[150px]">
                  <label className="text-xs font-bold text-gray-400 mb-1 block">Nombre Completo</label>
                  <input className="w-full border-2 border-gray-100 rounded-xl px-3 py-2 font-bold outline-none focus:border-frita-red text-gray-800" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                </div>
                <div className="flex-1 min-w-[120px]">
                  <label className="text-xs font-bold text-gray-400 mb-1 block">Rol</label>
                  <select className="w-full border-2 border-gray-100 rounded-xl px-3 py-2 font-bold outline-none focus:border-frita-red text-gray-800" value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
                    <option value="VENDEDOR">Vendedor</option>
                    <option value="DEJADOR">Dejador</option>
                    <option value="OPERARIO">Operario</option>
                    <option value="FRITADOR">Fritador</option>
                  </select>
                </div>
                <div className="flex-1 min-w-[120px]">
                  <label className="text-xs font-bold text-gray-400 mb-1 block">Cambiar PIN (Opcional)</label>
                  <input type="text" className="w-full border-2 border-gray-100 rounded-xl px-3 py-2 font-bold outline-none focus:border-frita-red text-gray-800" value={form.password} onChange={e => setForm({...form, password: e.target.value})} placeholder="Dejar vacío si no cruza" />
                </div>
                <div className="flex gap-2">
                  <button className="bg-green-500 text-white p-2.5 rounded-xl shadow-sm hover:scale-105 transition-all" onClick={() => handleSaveEdit(u.id)}><Check size={20} strokeWidth={3} /></button>
                  <button className="bg-gray-100 text-gray-400 p-2.5 rounded-xl hover:bg-gray-200 transition-colors" onClick={() => setEditingId(null)}><X size={20} strokeWidth={3} /></button>
                </div>
              </div>
            ) : (
              <div className={`bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between transition-colors ${!u.active ? 'opacity-60 bg-gray-50' : ''}`}>
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${getRoleColor(u.role)} shadow-sm`}>
                    <User size={24} />
                  </div>
                  <div>
                    <span className={`font-black block text-lg ${!u.active ? 'line-through text-gray-400' : 'text-gray-800'}`}>{u.name}</span>
                    <div className="flex gap-2 mt-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${getRoleColor(u.role)}`}>{u.role}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${u.active ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>{u.active ? 'Activo' : 'Inactivo'}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="bg-gray-50 text-gray-400 hover:text-gray-700 hover:bg-gray-100 p-2 rounded-xl transition-colors" onClick={() => { setEditingId(u.id); setForm({ name: u.name, role: u.role, password: '', active: u.active }); setShowAdd(false); }}>
                    <Edit2 size={18} strokeWidth={2.5} />
                  </button>
                  <button className={`bg-gray-50 hover:bg-gray-100 p-2 rounded-xl transition-colors flex items-center justify-center ${u.active ? 'text-gray-400 hover:text-orange-500' : 'text-green-500 bg-green-50'}`} onClick={() => toggleUserActive(u.id)} title={u.active ? 'Desactivar' : 'Activar'}>
                    {u.active ? <UserMinus size={18} strokeWidth={2.5} /> : <UserCheck size={18} strokeWidth={2.5} />}
                  </button>
                  <button className="bg-red-50 text-red-400 hover:text-red-600 hover:bg-red-100 p-2 rounded-xl transition-colors" onClick={() => { if(confirm('¿Eliminar personal?')) deleteUser(u.id); }}>
                    <Trash2 size={18} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {teamUsers.length === 0 && <p className="text-gray-400 font-bold text-center py-6">No hay personal operativo registrado.</p>}
      </div>
    </div>
  );
};
