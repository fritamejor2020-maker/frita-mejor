import React, { useState } from 'react';
import { useVehicleStore } from '../../store/useVehicleStore';
import { Button } from '../ui/Button';

export function AdminVehiclesTab() {
  const { vehicles, addVehicle, updateVehicle, removeVehicle } = useVehicleStore();
  const [isEditing, setIsEditing] = useState<string | null>(null);
  
  // Form State
  const [name, setName] = useState('');
  const [abbreviation, setAbbreviation] = useState('');

  const tricycles = vehicles.filter((v: any) => v.type === 'Triciclo');

  const handleEdit = (vehicle: any) => {
    setIsEditing(vehicle.id);
    setName(vehicle.name);
    setAbbreviation(vehicle.abbreviation || '');
  };

  const cancelEdit = () => {
    setIsEditing(null);
    setName('');
    setAbbreviation('');
  };

  const handleSave = () => {
    if (!name || !abbreviation) return;

    if (isEditing) {
      updateVehicle(isEditing, { name, abbreviation });
      setIsEditing(null);
    } else {
      addVehicle({ name, abbreviation });
    }
    
    setName('');
    setAbbreviation('');
  };

  const toggleActive = (id: string, currentStatus: boolean) => {
    updateVehicle(id, { active: !currentStatus });
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#1e1f26] rounded-[24px] border border-gray-800 p-6">
        <h3 className="text-xl font-black text-white mb-4">
          {isEditing ? 'Editar Triciclo' : 'Añadir Nuevo Triciclo'}
        </h3>
        
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
            <label className="text-xs font-bold text-gray-400 uppercase block mb-2">Nombre</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Triciclo Central"
              className="w-full bg-[#0c0d11] border border-gray-700 rounded-xl py-3 px-4 text-white font-bold focus:border-[#FFB700] outline-none"
            />
          </div>
          <div className="flex-1 w-full">
            <label className="text-xs font-bold text-gray-400 uppercase block mb-2">Abreviatura (Código)</label>
            <input 
              type="text" 
              value={abbreviation}
              onChange={(e) => setAbbreviation(e.target.value.toUpperCase())}
              placeholder="Ej. T7"
              className="w-full bg-[#0c0d11] border border-gray-700 rounded-xl py-3 px-4 text-white font-bold focus:border-[#FFB700] outline-none"
            />
          </div>
          
          <div className="flex gap-2 w-full md:w-auto mt-4 md:mt-0">
            {isEditing && (
              <Button onClick={cancelEdit} className="py-3 px-6 rounded-xl bg-gray-700 hover:bg-gray-600 text-white font-black">
                Cancelar
              </Button>
            )}
            <Button onClick={handleSave} className="py-3 px-8 rounded-xl bg-[#FFB700] hover:bg-yellow-400 text-black font-black flex-1 md:flex-none">
              {isEditing ? 'Guardar Cambios' : 'Añadir'}
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-[#1e1f26] rounded-[24px] border border-gray-800 p-6">
        <h3 className="text-xl font-black text-white mb-6">Lista de Triciclos Activos</h3>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-800 text-xs text-gray-400 uppercase tracking-widest">
                <th className="p-3 font-black">Nombre</th>
                <th className="p-3 font-black">Código</th>
                <th className="p-3 font-black text-center">Estado</th>
                <th className="p-3 font-black text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {tricycles.map((t: any) => (
                <tr key={t.id} className={`border-b border-gray-800/50 hover:bg-[#2a2d38]/30 transition-colors ${!t.active ? 'opacity-50' : ''}`}>
                  <td className="p-3 font-bold text-white text-lg">{t.name}</td>
                  <td className="p-3 font-black text-[#FFB700] text-xl">{t.abbreviation}</td>
                  <td className="p-3 text-center">
                    <button 
                      onClick={() => toggleActive(t.id, t.active)}
                      className={`px-3 py-1 rounded-full text-xs font-bold ${t.active ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'}`}
                    >
                      {t.active ? 'ACTIVO' : 'INACTIVO'}
                    </button>
                  </td>
                  <td className="p-3 text-right">
                    <button onClick={() => handleEdit(t)} className="text-blue-400 hover:text-blue-300 font-bold text-sm mr-4">
                      Editar
                    </button>
                    <button onClick={() => removeVehicle(t.id)} className="text-red-400 hover:text-red-300 font-bold text-sm">
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
              
              {tricycles.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-gray-500 font-bold">
                    No hay triciclos configurados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
