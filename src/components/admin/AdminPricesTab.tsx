import React, { useState } from 'react';
import { useInventoryStore } from '../../store/useInventoryStore';
import { Edit2, Check } from 'lucide-react';
import { formatMoney } from '../../utils/formatUtils';

export const AdminPricesTab = () => {
  const { inventory, updateInventoryItem } = useInventoryStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState<number>(0);

  // Solo filtramos los artículos vendibles (PRODUCTO o FRITO)
  const products = inventory.filter((i: any) => i.type === 'PRODUCTO' || i.type === 'FRITO');

  const handleSave = (id: string) => {
    updateInventoryItem(id, { price: editPrice });
    setEditingId(null);
  };

  return (
    <div className="p-4 bg-[#FFD56B] flex-1 rounded-bl-[32px] rounded-br-[32px] md:rounded-[32px]">
      <h2 className="text-2xl font-black text-gray-800 mb-2">Precios Maestros</h2>
      <p className="text-xs font-bold text-gray-400 mb-6 bg-frita-yellow/20 p-3 rounded-lg border border-frita-yellow/50">
        💡 Cambiar precios no afecta los reportes pasados ya que el precio se guarda con cada cierre.
      </p>

      <div className="space-y-3">
        {products.map((p: any) => (
          <div key={p.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center">
            <span className="font-bold text-gray-800 text-lg">{p.name}</span>
            
            <div className="flex items-center gap-3">
              {editingId === p.id ? (
                <>
                  <div className="flex bg-gray-50 border border-gray-200 rounded-xl overflow-hidden focus-within:border-frita-orange">
                    <span className="px-3 py-2 text-gray-400 font-bold">$</span>
                    <input 
                      type="number" 
                      value={editPrice}
                      onChange={(e) => setEditPrice(parseInt(e.target.value))}
                      className="bg-transparent outline-none font-black w-20 py-2 text-frita-red"
                    />
                  </div>
                  <button 
                    onClick={() => handleSave(p.id)}
                    className="bg-green-500 text-white p-2.5 rounded-xl shadow-sm hover:scale-105"
                  >
                    <Check size={18} strokeWidth={3} />
                  </button>
                </>
              ) : (
                <>
                  <span className="font-black text-frita-red text-xl">{formatMoney(p.price)}</span>
                  <button 
                    onClick={() => { setEditingId(p.id); setEditPrice(p.price); }}
                    className="bg-gray-100 text-gray-400 hover:text-gray-700 hover:bg-gray-200 p-2.5 rounded-xl transition-colors"
                  >
                    <Edit2 size={18} strokeWidth={3} />
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
