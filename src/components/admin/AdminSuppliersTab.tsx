import React, { useState } from 'react';
import { useSupplierStore } from '../../store/useSupplierStore';
import { Button } from '../ui/Button';

export function AdminSuppliersTab() {
  const { suppliers, addSupplier, updateSupplier, removeSupplier } = useSupplierStore();
  const [isEditing, setIsEditing] = useState<string | null>(null);
  
  // Form State
  const [name, setName] = useState('');
  const [commonProducts, setCommonProducts] = useState(''); // Comma separated string for input

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
    <div className="space-y-6">
      <div className="bg-[#1e1f26] rounded-[24px] border border-gray-800 p-6">
        <h3 className="text-xl font-black text-white mb-4">
          {isEditing ? 'Editar Proveedor' : 'Añadir Nuevo Proveedor'}
        </h3>
        
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
            <label className="text-xs font-bold text-gray-400 uppercase block mb-2">Nombre del Proveedor</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Comercializadora XYZ"
              className="w-full bg-[#0c0d11] border border-gray-700 rounded-xl py-3 px-4 text-white font-bold focus:border-[#FFB700] outline-none"
            />
          </div>
          <div className="flex-1 w-full">
            <label className="text-xs font-bold text-gray-400 uppercase block mb-2">Productos (separados por coma)</label>
            <input 
              type="text" 
              value={commonProducts}
              onChange={(e) => setCommonProducts(e.target.value)}
              placeholder="Ej. papas, aceite, sal"
              className="w-full bg-[#0c0d11] border border-gray-700 rounded-xl py-3 px-4 text-white font-bold focus:border-[#FFB700] outline-none"
              title="Palabras clave para sugerir a este proveedor cuando ingresen un gasto"
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
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-black text-white">Lista de Proveedores</h3>
          <p className="text-xs font-bold text-gray-400">Palabras asociadas al autocompletado de Egresos.</p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-800 text-xs text-gray-400 uppercase tracking-widest">
                <th className="p-3 font-black">Nombre</th>
                <th className="p-3 font-black">Vende principalmente</th>
                <th className="p-3 font-black text-center">Estado</th>
                <th className="p-3 font-black text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s: any) => (
                <tr key={s.id} className={`border-b border-gray-800/50 hover:bg-[#2a2d38]/30 transition-colors ${!s.active ? 'opacity-50' : ''}`}>
                  <td className="p-3 font-bold text-white text-lg">{s.name}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                       {(s.commonProducts || []).map((cp: string, idx: number) => (
                         <span key={idx} className="bg-gray-800 border border-gray-700 text-gray-300 font-bold text-xs px-2 py-0.5 rounded">
                           {cp}
                         </span>
                       ))}
                       {(!s.commonProducts || s.commonProducts.length === 0) && (
                         <span className="text-gray-600 text-xs font-bold">Sin descripción aprendida</span>
                       )}
                    </div>
                  </td>
                  <td className="p-3 text-center">
                    <button 
                      onClick={() => toggleActive(s.id, s.active)}
                      className={`px-3 py-1 rounded-full text-xs font-bold ${s.active ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'}`}
                    >
                      {s.active ? 'ACTIVO' : 'INACTIVO'}
                    </button>
                  </td>
                  <td className="p-3 text-right">
                    <button onClick={() => handleEdit(s)} className="text-blue-400 hover:text-blue-300 font-bold text-sm mr-4">
                      Editar
                    </button>
                    <button onClick={() => removeSupplier(s.id)} className="text-red-400 hover:text-red-300 font-bold text-sm">
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
              
              {suppliers.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-gray-500 font-bold">
                    No hay proveedores en la base de datos.
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
