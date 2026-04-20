import React, { useState } from 'react';
import { useInventoryStore } from '../../store/useInventoryStore';
import { Button } from '../ui/Button';
import { formatMoney } from '../../utils/formatUtils';

export function AdminCustomerDiscountsTab() {
  const { customers, customerTypes, updateCustomerType, addCustomerType, addCustomer, updateCustomer, deleteCustomerType, inventory } = useInventoryStore();

  const [selectedTypeId, setSelectedTypeId] = useState('');
  const [newTypeName, setNewTypeName] = useState('');

  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerDoc, setNewCustomerDoc] = useState('');
  const [newCustomerType, setNewCustomerType] = useState('');

  // Filtering out raw materials, we only want to discount Products or Fritos
  const sellableItems = inventory.filter((i: any) => i.type === 'PRODUCTO' || i.type === 'FRITO');

  const selectedType = (customerTypes || []).find((t: any) => t.id === selectedTypeId);
  const customersInType = (customers || []).filter((c: any) => c.typeId === selectedTypeId);

  const handleCreateType = () => {
    if (!newTypeName.trim()) return;
    addCustomerType({
      name: newTypeName.trim(),
      productDiscounts: [] // Array of { productId, discountValue }
    });
    setNewTypeName('');
  };

  const handleCreateCustomer = () => {
    if (!newCustomerName.trim() || !newCustomerType) {
      alert("Debes ingresar el nombre y asignar un tipo.");
      return;
    }
    addCustomer({
      name: newCustomerName.trim(),
      document: newCustomerDoc.trim(),
      typeId: newCustomerType,
      discountPercent: 0 // Legacy
    });
    setNewCustomerName('');
    setNewCustomerDoc('');
  };

  const handleDeleteType = () => {
    if (!selectedType) return;
    if (confirm(`¿Estás seguro de eliminar el grupo "${selectedType.name}"? Los clientes en este grupo perderán todos estos precios especiales.`)) {
      deleteCustomerType(selectedType.id);
      setSelectedTypeId('');
    }
  };

  const handleUpdateProductDiscount = (productId: string, newPrice: string) => {
    if (!selectedType) return;

    const currentDiscounts = selectedType.productDiscounts || [];
    let updatedDiscounts;

    if (newPrice === '' || isNaN(Number(newPrice)) || Number(newPrice) < 0) {
      // Remove setting if empty
      updatedDiscounts = currentDiscounts.filter((d: any) => d.productId !== productId);
    } else {
      const existingIdx = currentDiscounts.findIndex((d: any) => d.productId === productId);
      if (existingIdx >= 0) {
        updatedDiscounts = [...currentDiscounts];
        updatedDiscounts[existingIdx].discountValue = Number(newPrice);
      } else {
        updatedDiscounts = [...currentDiscounts, { productId, discountValue: Number(newPrice) }];
      }
    }

    updateCustomerType(selectedType.id, { productDiscounts: updatedDiscounts });
  };

  const getCustomPrice = (productId: string) => {
    if (!selectedType || !selectedType.productDiscounts) return '';
    const d = selectedType.productDiscounts.find((pd: any) => pd.productId === productId);
    return d ? d.discountValue : '';
  };

  return (
    <div className="p-4 flex-1 flex flex-col h-full bg-[#FFD56B]/20 rounded-3xl">
      <div className="flex justify-between items-center mb-6">
         <h2 className="text-2xl font-black text-gray-800">Grupos VIP & Precios Especiales</h2>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 h-full overflow-hidden">
        
         {/* LEFT PANEL: Types and Customers List */}
         <div className="xl:col-span-1 flex flex-col gap-6 overflow-hidden h-full">

            {/* TYPES (GROUPS) MANAGER */}
            <div className="bg-white rounded-[24px] border border-gray-200 p-5 flex flex-col h-1/2 overflow-hidden shadow-sm">
              <h3 className="text-lg font-black text-chunky-dark mb-3 uppercase tracking-wider flex justify-between items-center">
                <span>Tipos de Cliente</span>
                <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full text-[10px]">{(customerTypes || []).length} Grupos</span>
              </h3>
              
              <div className="flex gap-2 mb-4">
                <input 
                  type="text" 
                  placeholder="Ej: Mayorista..." 
                  value={newTypeName}
                  onChange={e => setNewTypeName(e.target.value)}
                  className="w-full bg-gray-50 text-gray-800 font-bold border-2 border-gray-100 rounded-xl px-3 py-2 text-sm focus:border-[#FFB700] outline-none"
                />
                <Button onClick={handleCreateType} className="bg-chunky-main hover:bg-red-500 rounded-xl px-4 font-black shadow-sm border-none text-white whitespace-nowrap active:scale-95 transition-transform">+</Button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                 {(customerTypes || []).map((t: any) => (
                   <button 
                     key={t.id}
                     onClick={() => setSelectedTypeId(t.id)}
                     className={`w-full text-left p-3 rounded-[20px] border-2 transition-all flex justify-between items-center ${selectedTypeId === t.id ? 'bg-yellow-50 border-[#FFB700]' : 'bg-white border-gray-100 hover:border-gray-200 hover:bg-gray-50'}`}
                   >
                     <p className="font-black text-gray-800">{t.name}</p>
                     <span className="text-[10px] text-gray-500 font-bold bg-gray-100 px-2 py-1 rounded-full">
                        {(t.productDiscounts || []).length} reglas
                     </span>
                   </button>
                 ))}
                 {(!customerTypes || customerTypes.length === 0) && (
                   <p className="text-gray-400 font-bold text-center text-xs py-4">No hay grupos creados.</p>
                 )}
              </div>
            </div>

            {/* CUSTOMER MANAGER (QUICK ADD) */}
            <div className="bg-white rounded-[24px] border border-gray-200 p-5 flex flex-col h-1/2 overflow-hidden shadow-sm">
                <h3 className="text-lg font-black text-blue-500 mb-3 uppercase tracking-wider">Crear Cliente POS</h3>
                <div className="flex flex-col gap-2 flex-1 overflow-y-auto pr-1">
                  <input 
                    type="text" 
                    placeholder="Nombre del Cliente..." 
                    value={newCustomerName}
                    onChange={e => setNewCustomerName(e.target.value)}
                    className="w-full bg-gray-50 text-gray-800 font-bold border-2 border-gray-100 rounded-xl px-4 py-3 text-sm focus:border-blue-500 outline-none"
                  />
                  <input 
                    type="text" 
                    placeholder="NIT / Doc (Opcional)" 
                    value={newCustomerDoc}
                    onChange={e => setNewCustomerDoc(e.target.value)}
                    className="w-full bg-gray-50 text-gray-800 font-bold border-2 border-gray-100 rounded-xl px-4 py-3 text-sm focus:border-blue-500 outline-none"
                  />
                  <select
                    className="w-full bg-gray-50 text-gray-800 font-bold border-2 border-gray-100 rounded-xl px-4 py-3 text-sm focus:border-blue-500 outline-none"
                    value={newCustomerType}
                    onChange={e => setNewCustomerType(e.target.value)}
                  >
                    <option value="" disabled>Asignar Grupo / Tipo...</option>
                    {(customerTypes || []).map((t: any) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <Button onClick={handleCreateCustomer} className="w-full bg-blue-500 hover:bg-blue-600 rounded-xl py-3 font-black text-white mt-1 border-none shadow-sm active:scale-95 transition-transform">
                    Registrar Cliente
                  </Button>
                </div>
            </div>

         </div>

         {/* RIGHT PANEL: Settings for Selected Type */}
         <div className="xl:col-span-3 bg-white rounded-[32px] border border-gray-200 flex flex-col h-full overflow-hidden relative shadow-sm">
            {!selectedType ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                 <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-4 opacity-50"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                 <p className="font-black text-xl text-gray-500">Seleccione un Grupo de Clientes</p>
                 <p className="text-sm font-bold">para definir precios especiales (VIP) fijos.</p>
              </div>
            ) : (
              <div className="flex flex-col h-full bg-white">
                
                {/* Header */}
                <div className="p-6 pb-4 border-b border-gray-100 flex justify-between items-start bg-yellow-50/50">
                   <div>
                     <h2 className="text-3xl font-black text-chunky-dark flex items-center gap-3">
                       {selectedType.name}
                       <span className="bg-white text-gray-500 border border-gray-200 text-[10px] px-2 py-1 rounded-full uppercase tracking-wider shadow-sm">{customersInType.length} CLIENTES</span>
                     </h2>
                     <p className="text-sm font-bold text-gray-500 mt-1">Los clientes asignados a este grupo tomarán los precios aquí configurados en la caja POS.</p>
                   </div>
                   
                   <Button variant="outline" onClick={handleDeleteType} className="border-red-100 text-red-500 hover:bg-red-50 rounded-xl text-sm font-bold h-10 px-4 active:scale-95 transition-transform">
                     Eliminar Grupo
                   </Button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 pt-4">
                   <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-6">
                      <p className="text-blue-600 font-bold text-sm leading-snug">
                        Para asignar un <span className="text-blue-800">Precio VIP Privado</span>, edita la caja correspondiente al producto. Este valor anulará por completo el precio público genérico en el POS.<br/>
                        <span className="text-xs text-blue-400 mt-1 block">Deja la casilla vacía para que el sistema cobre el precio estándar publicado.</span>
                      </p>
                   </div>

                   <table className="w-full text-left border-collapse">
                     <thead>
                       <tr className="border-b-2 border-gray-100">
                         <th className="pb-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-2">Producto de Venta</th>
                         <th className="pb-3 text-[10px] font-bold text-gray-400 uppercase text-center tracking-widest">Precio Base/Público</th>
                         <th className="pb-3 text-[10px] font-bold text-chunky-main uppercase text-right tracking-widest w-1/3 pr-2">PRECIO VIP PARA GRUPO ($)</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-50">
                       {sellableItems.map((item: any) => {
                         const hasDiscount = getCustomPrice(item.id) !== '';
                         return (
                           <tr key={item.id} className={`hover:bg-gray-50 transition-colors ${hasDiscount ? 'bg-yellow-50/50' : ''}`}>
                             <td className="py-4 pl-2">
                               <p className="font-black text-gray-800 text-base md:text-lg">{item.name}</p>
                               <span className={`text-[9px] px-2 py-0.5 rounded-full uppercase font-black tracking-widest ${item.type === 'FRITO' ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}>
                                 {item.type}
                               </span>
                             </td>
                             <td className="py-4 text-center">
                               <p className={`font-bold text-sm ${hasDiscount ? 'text-gray-400 line-through' : 'text-gray-600'}`}>
                                 {formatMoney(item.price || 0)}
                               </p>
                             </td>
                             <td className="py-4 pr-2">
                               <div className="relative w-full max-w-[160px] ml-auto">
                                 <span className={`absolute left-4 top-1/2 -translate-y-1/2 font-bold ${hasDiscount ? 'text-chunky-main' : 'text-gray-400'}`}>$</span>
                                 <input 
                                   type="number" 
                                   min="0"
                                   placeholder="Precio Publico"
                                   value={getCustomPrice(item.id)}
                                   onChange={(e) => handleUpdateProductDiscount(item.id, e.target.value)}
                                   className={`w-full bg-white border-2 ${hasDiscount ? 'border-chunky-main text-chunky-main shadow-sm' : 'border-gray-200 text-gray-800 focus:border-[#FFB700] hover:border-gray-300'} rounded-[20px] py-3 pl-8 pr-4 font-black text-right outline-none transition-all placeholder:text-gray-300 text-lg`}
                                 />
                               </div>
                             </td>
                           </tr>
                         );
                       })}
                       {sellableItems.length === 0 && (
                         <tr>
                           <td colSpan={3} className="py-12 text-center text-gray-400 font-bold">El inventario está vacío. Añade productos desde la pestaña de Inventario o Producción.</td>
                         </tr>
                       )}
                     </tbody>
                   </table>
                </div>
              </div>
            )}
         </div>

      </div>
    </div>
  );
}
