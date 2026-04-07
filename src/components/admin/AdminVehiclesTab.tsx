import React, { useState } from 'react';
import { useVehicleStore } from '../../store/useVehicleStore';
import { Button } from '../ui/Button';
import { Edit2, Trash2, Check, X, Truck } from 'lucide-react';

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
    <div className="flex-1 p-4">
      {/* HEADER & FORM */}
      <div className="bg-[#FFD56B] rounded-[32px] p-6 shadow-sm mb-6 relative overflow-hidden">
        <div className="relative z-10">
          <h3 className="text-2xl font-black text-gray-900 mb-4">
            {isEditing ? 'Editar Vehículo' : 'Añadir Nuevo Vehículo'}
          </h3>
          
          <div className="flex flex-col md:flex-row gap-4 items-end bg-white/60 backdrop-blur-md p-4 rounded-2xl border-2 border-white/50">
            <div className="flex-1 w-full">
              <label className="text-xs font-bold text-gray-600 uppercase block mb-1">Nombre</label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Triciclo Central"
                className="w-full bg-white border-2 border-white hover:border-[#FFB700] rounded-xl py-3 px-4 text-gray-800 font-bold focus:border-[#FFB700] outline-none transition-colors shadow-sm"
              />
            </div>
            <div className="flex-1 w-full">
              <label className="text-xs font-bold text-gray-600 uppercase block mb-1">Abreviatura (Código)</label>
              <input 
                type="text" 
                value={abbreviation}
                onChange={(e) => setAbbreviation(e.target.value.toUpperCase())}
                placeholder="Ej. T7"
                className="w-full bg-white border-2 border-white hover:border-[#FFB700] rounded-xl py-3 px-4 text-gray-800 font-bold focus:border-[#FFB700] outline-none transition-colors shadow-sm"
              />
            </div>
            
            <div className="flex gap-2 w-full md:w-auto mt-2 md:mt-0">
              {isEditing && (
                <button onClick={cancelEdit} className="py-3 px-4 rounded-xl bg-gray-400 hover:bg-gray-500 text-white font-black shadow-sm transition-transform active:scale-95 flex items-center gap-2">
                  <X size={20} strokeWidth={3} /> Cancelar
                </button>
              )}
              <button 
                onClick={handleSave} 
                className="py-3 px-6 rounded-xl bg-frita-red hover:bg-red-500 text-white font-black shadow-sm transition-transform active:scale-95 flex items-center gap-2 flex-1 md:flex-none justify-center"
              >
                <Check size={20} strokeWidth={3} /> {isEditing ? 'Guardar' : 'Añadir'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* LISTA COMO TARJETAS */}
      <div className="flex justify-between items-center mb-4 px-2">
        <h3 className="text-xl font-black text-gray-800">Flota de Vehículos</h3>
        <p className="text-xs font-bold text-gray-400 bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200 hidden md:block">
          💡 Puedes desactivar triciclos que estén en mantenimiento
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {tricycles.map((t: any) => (
          <div key={t.id} className={`bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row items-start md:items-center justify-between transition-colors ${!t.active ? 'opacity-60 bg-gray-50' : 'hover:border-[#FFD56B]'}`}>
            <div className="flex items-center gap-4 mb-3 md:mb-0">
              <div className="w-12 h-12 rounded-xl bg-[#FFD56B]/30 flex items-center justify-center shadow-inner">
                <Truck size={24} className="text-[#FF9900]" strokeWidth={2.5} />
              </div>
              <div>
                <span className={`font-black block text-lg ${!t.active ? 'line-through text-gray-400' : 'text-gray-800'}`}>{t.name}</span>
                <div className="flex gap-2 mt-1">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider bg-gray-100 text-gray-500 border border-gray-200">
                    CÓDIGO: {t.abbreviation}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 ml-[64px] md:ml-0">
              <button 
                onClick={() => toggleActive(t.id, t.active)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-transform active:scale-95 ${t.active ? 'bg-green-100 text-green-600 border border-green-200' : 'bg-red-100 text-red-600 border border-red-200'}`}
              >
                {t.active ? 'Activo' : 'Inactivo'}
              </button>
              <div className="h-6 w-px bg-gray-200 mx-1 hidden md:block"></div>
              <button className="bg-gray-50 text-gray-400 hover:text-chunky-main hover:bg-gray-100 p-2 rounded-xl transition-all" onClick={() => handleEdit(t)}>
                <Edit2 size={18} strokeWidth={2.5} />
              </button>
              <button className="bg-red-50 text-red-400 hover:text-red-600 hover:bg-red-100 p-2 rounded-xl transition-all" onClick={() => { if(confirm('¿Eliminar vehículo?')) removeVehicle(t.id); }}>
                <Trash2 size={18} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        ))}
        
        {tricycles.length === 0 && (
          <div className="bg-white p-8 rounded-[24px] border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-center">
            <Truck size={48} className="text-gray-300 mb-3" />
            <p className="text-gray-500 font-bold">No hay vehículos configurados.</p>
            <p className="text-gray-400 text-sm mt-1">Añade triciclos para que aparezcan en los módulos de venta.</p>
          </div>
        )}
      </div>
    </div>
  );
}
