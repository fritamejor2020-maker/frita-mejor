import React, { useState } from 'react';
import { useSupplierStore } from '../../store/useSupplierStore';
import { Button } from '../ui/Button';
import { Edit2, Trash2, Check, X, Truck } from 'lucide-react';

export function AdminSuppliersTab() {
  const { suppliers, addSupplier, updateSupplier, removeSupplier } = useSupplierStore();
  const [isEditing, setIsEditing] = useState<string | null>(null);
  
  // Form State
  const [name, setName] = useState('');
  const [commonProducts, setCommonProducts] = useState('');

  const handleEdit = (supplier: any) => {
    setIsEditing(supplier.id);
    setName(supplier.name);
    setCommonProducts(supplier.commonProducts?.join(', ') || '');
  };

  const cancelEdit = () => {
    setIsEditing(null);
    setName('');
    setCommonProducts('');
  };

  const handleSave = () => {
    if (!name.trim()) return;

    // Convert comma string to array of clean lowercase strings
    const productsArray = commonProducts
      .split(',')
      .map(p => p.trim().toLowerCase())
      .filter(p => p.length > 0);

    if (isEditing) {
      updateSupplier(isEditing, { name, commonProducts: productsArray });
      setIsEditing(null);
    } else {
      addSupplier({ name, commonProducts: productsArray });
    }
    
    setName('');
    setCommonProducts('');
  };

  const toggleActive = (id: string, currentStatus: boolean) => {
    updateSupplier(id, { active: !currentStatus });
  };

  return (
    <div className="flex-1 p-4">
      {/* HEADER & FORM */}
      <div className="bg-[#FFD56B] rounded-[32px] p-6 shadow-sm mb-6 relative overflow-hidden">
        <div className="relative z-10">
          <h3 className="text-2xl font-black text-gray-900 mb-4">
            {isEditing ? 'Editar Proveedor' : 'Añadir Proveedor'}
          </h3>
          
          <div className="flex flex-col md:flex-row gap-4 items-end bg-white/60 backdrop-blur-md p-4 rounded-2xl border-2 border-white/50">
            <div className="flex-1 w-full">
              <label className="text-xs font-bold text-gray-600 uppercase block mb-1">Nombre</label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Comercializadora XYZ"
                className="w-full bg-white border-2 border-white hover:border-[#FFB700] rounded-xl py-3 px-4 text-gray-800 font-bold focus:border-[#FFB700] outline-none transition-colors shadow-sm"
              />
            </div>
            <div className="flex-1 w-full">
              <label className="text-xs font-bold text-gray-600 uppercase block mb-1">Productos (separados por coma)</label>
              <input 
                type="text" 
                value={commonProducts}
                onChange={(e) => setCommonProducts(e.target.value)}
                placeholder="Ej. papas, aceite, sal"
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
        <h3 className="text-xl font-black text-gray-800">Proveedores Activos</h3>
        <p className="text-xs font-bold text-gray-400 bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200 hidden md:block">
          💡 Palabras de autocompletado para Egresos
        </p>
      </div>
        
      <div className="flex flex-col gap-3">
        {suppliers.map((s: any) => (
          <div key={s.id} className={`bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row items-start md:items-center justify-between transition-colors ${!s.active ? 'opacity-60 bg-gray-50' : 'hover:border-[#FFD56B]'}`}>
            <div className="flex items-center gap-4 mb-3 md:mb-0">
              <div className="w-12 h-12 rounded-xl bg-[#FFD56B]/30 flex items-center justify-center shadow-inner">
                <Truck size={24} className="text-[#FF9900]" strokeWidth={2.5} />
              </div>
              <div>
                <span className={`font-black block text-lg ${!s.active ? 'line-through text-gray-400' : 'text-gray-800'}`}>{s.name}</span>
                <div className="flex flex-wrap gap-1 mt-1">
                   {(s.commonProducts || []).map((cp: string, idx: number) => (
                     <span key={idx} className="bg-gray-100 border border-gray-200 text-gray-500 font-bold text-[10px] px-2 py-0.5 rounded-md uppercase tracking-wide">
                       {cp}
                     </span>
                   ))}
                   {(!s.commonProducts || s.commonProducts.length === 0) && (
                     <span className="text-gray-400 text-[10px] font-bold">Sin descripción</span>
                   )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 ml-[64px] md:ml-0">
              <button 
                onClick={() => toggleActive(s.id, s.active)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-transform active:scale-95 ${s.active ? 'bg-green-100 text-green-600 border border-green-200' : 'bg-red-100 text-red-600 border border-red-200'}`}
              >
                {s.active ? 'Activo' : 'Inactivo'}
              </button>
              <div className="h-6 w-px bg-gray-200 mx-1 hidden md:block"></div>
              <button className="bg-gray-50 text-gray-400 hover:text-chunky-main hover:bg-gray-100 p-2 rounded-xl transition-all" onClick={() => handleEdit(s)}>
                <Edit2 size={18} strokeWidth={2.5} />
              </button>
              <button className="bg-red-50 text-red-400 hover:text-red-600 hover:bg-red-100 p-2 rounded-xl transition-all" onClick={() => { if(confirm('¿Seguro que deseas eliminar?')) removeSupplier(s.id); }}>
                <Trash2 size={18} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        ))}
        
        {suppliers.length === 0 && (
          <div className="bg-white p-8 rounded-[24px] border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-center">
            <Truck size={48} className="text-gray-300 mb-3" />
            <p className="text-gray-500 font-bold">No hay proveedores en la base de datos.</p>
            <p className="text-gray-400 text-sm mt-1">Usa el formulario superior para añadir uno.</p>
          </div>
        )}
      </div>
    </div>
  );
}
