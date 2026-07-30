import React, { useState } from 'react';
import { BiometricTerminal, useAttendanceStore } from '../../store/useAttendanceStore';
import { useBranchStore } from '../../store/useBranchStore';
import { Cpu, Plus, Trash2, Edit2, RefreshCw, Key, CheckCircle, AlertCircle, Building, Users } from 'lucide-react';
import { AdminEmployeeBiometricsModal } from './AdminEmployeeBiometricsModal';

export function AdminTerminalsTab() {
  const { terminals, addTerminal, updateTerminal, deleteTerminal, syncTerminalEvents, fetchTerminalUsers } = useAttendanceStore();
  const { branches = [] } = useBranchStore();

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [branchId, setBranchId] = useState('');
  const [ipAddress, setIpAddress] = useState('192.168.3.220');
  const [port, setPort] = useState(80);
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('Control.1');
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [showBioModal, setShowBioModal] = useState(false);

  const handleOpenModal = (term?: BiometricTerminal) => {
    if (term) {
      setEditingId(term.id);
      setName(term.name);
      setBranchId(term.branchId);
      setIpAddress(term.ipAddress);
      setPort(term.port);
      setUsername(term.username);
      setPassword(term.password);
    } else {
      setEditingId(null);
      setName('');
      setBranchId(branches[0]?.id || 'BRANCH-001');
      setIpAddress('192.168.3.220');
      setPort(80);
      setUsername('admin');
      setPassword('Control.1');
    }
    setShowModal(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !ipAddress) return;

    if (editingId) {
      updateTerminal(editingId, {
        name,
        branchId: branchId || branches[0]?.id || 'BRANCH-001',
        ipAddress,
        port: Number(port),
        username,
        password,
      });
    } else {
      addTerminal({
        name,
        branchId: branchId || branches[0]?.id || 'BRANCH-001',
        ipAddress,
        port: Number(port),
        username,
        password,
        status: 'UNCHECKED',
      });
    }
    setShowModal(false);
  };

  const handleTestConnection = async (term: BiometricTerminal) => {
    setIsTesting(true);
    setSyncStatusMsg(`Probando conexión con ${term.name} en ${term.ipAddress}...`);
    const res = await syncTerminalEvents(term.id);
    setSyncStatusMsg(res.message);
    setIsTesting(false);
    setTimeout(() => setSyncStatusMsg(null), 4000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-gray-100 shadow-xs">
        <div>
          <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
            <Cpu className="text-amber-500" size={18} />
            Terminales Biométricos Hikvision (ISAPI)
          </h3>
          <p className="text-xs font-bold text-gray-400 mt-0.5">
            Configura la IP y credenciales de acceso de cada biométrico instalado por sede.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBioModal(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer transition-all"
          >
            <Users size={16} />
            Enrolar Personal & Claves
          </button>
          <button
            onClick={() => handleOpenModal()}
            className="bg-amber-400 hover:bg-amber-500 text-gray-950 font-black text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer transition-all"
          >
            <Plus size={16} />
            Agregar Biométrico
          </button>
        </div>
      </div>

      {syncStatusMsg && (
        <div className="bg-emerald-900 text-emerald-100 p-3 rounded-xl text-xs font-black flex items-center justify-between shadow-xs">
          <span>{syncStatusMsg}</span>
          <button onClick={() => setSyncStatusMsg(null)}>✕</button>
        </div>
      )}

      {/* Lista de Terminales */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {terminals.map((term) => {
          const branchObj = branches.find((b: any) => b.id === term.branchId);

          return (
            <div key={term.id} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-3 relative group">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center font-black">
                    <Cpu size={20} />
                  </div>
                  <div>
                    <h4 className="font-black text-sm text-gray-900">{term.name}</h4>
                    <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1">
                      <Building size={11} /> {branchObj?.name || 'Sede Principal'}
                    </span>
                  </div>
                </div>

                <span
                  className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                    term.status === 'ONLINE' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {term.status === 'ONLINE' ? '🟢 Conectado' : '⚪ Pendiente / Local'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-bold bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                <div>
                  <span className="text-gray-400 block text-[9px]">IP / PUERTO</span>
                  <span className="text-gray-800">{term.ipAddress}:{term.port}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[9px]">USUARIO ISAPI</span>
                  <span className="text-gray-800">{term.username}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <button
                  onClick={() => handleTestConnection(term)}
                  disabled={isTesting}
                  className="text-xs font-black text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw size={14} className={isTesting ? 'animate-spin' : ''} />
                  Probar Conexión ISAPI
                </button>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenModal(term)}
                    className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => deleteTerminal(term.id)}
                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Agregar / Editar Terminal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleSave} className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-black text-base text-gray-900 border-b border-gray-100 pb-3">
              {editingId ? 'Editar Terminal Biométrico' : 'Registrar Nuevo Biométrico Hikvision'}
            </h3>

            <div>
              <label className="block text-xs font-black text-gray-700 mb-1">Nombre del Terminal</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Biométrico Entrada Principal"
                className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-gray-700 mb-1">Sede Asignada</label>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 outline-none focus:border-amber-500"
              >
                {branches.map((b: any) => (
                  <option key={b.id} value={b.id}>
                    {b.name || b.id}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-black text-gray-700 mb-1">Dirección IP Estática</label>
                <input
                  type="text"
                  required
                  value={ipAddress}
                  onChange={(e) => setIpAddress(e.target.value)}
                  placeholder="192.168.3.220"
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs font-black text-gray-700 mb-1">Puerto HTTP (ISAPI)</label>
                <input
                  type="number"
                  required
                  value={port}
                  onChange={(e) => setPort(Number(e.target.value))}
                  placeholder="80"
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-black text-gray-700 mb-1">Usuario ISAPI</label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs font-black text-gray-700 mb-1">Contraseña</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-black bg-amber-400 hover:bg-amber-500 text-gray-950 rounded-xl shadow-xs cursor-pointer"
              >
                Guardar Terminal
              </button>
            </div>
          </form>
        </div>
      )}

      {showBioModal && (
        <AdminEmployeeBiometricsModal onClose={() => setShowBioModal(false)} />
      )}
    </div>
  );
}
