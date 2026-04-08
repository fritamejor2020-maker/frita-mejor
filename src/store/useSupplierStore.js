import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { push } from '../lib/syncManager';
import { markLocalWrite } from '../lib/useRealtimeSync';

function syncSuppliers(suppliers) {
  markLocalWrite('suppliers');
  push('suppliers', suppliers).catch(err => console.warn('[Sync] suppliers:', err.message));
}

/**
 * Global store to manage Suppliers and the common products/descriptions they sell.
 */
export const useSupplierStore = create(
  persist(
    (set, get) => ({
      suppliers: [
        { id: '1', name: 'Distribuidora XYZ', commonProducts: ['papas', 'aceite', 'sal'], active: true },
        { id: '2', name: 'Carnes el Primo', commonProducts: ['carne', 'pollo', 'chorizo'], active: true },
        { id: '3', name: 'Empaques del Norte', commonProducts: ['fundas', 'tarrinas', 'servilletas'], active: true },
      ],

      addSupplier: (supplierData) => {
        const newSupplier = {
          id: Date.now().toString(),
          active: true,
          commonProducts: [],
          ...supplierData
        };
        // Ensure commonProducts are lowercase for easier matching
        if (newSupplier.commonProducts) {
          newSupplier.commonProducts = newSupplier.commonProducts.map(p => p.toLowerCase().trim());
        }
        set((state) => ({ suppliers: [...state.suppliers, newSupplier] }));
        syncSuppliers(useSupplierStore.getState().suppliers);
        return newSupplier; // Return so the UI can auto-select it if created on the fly
      },

      updateSupplier: (id, updatedData) => {
        set((state) => {
          const newSuppliers = state.suppliers.map(s => {
            if (s.id === id) {
              const updated = { ...s, ...updatedData };
              if (updated.commonProducts) {
                 updated.commonProducts = updated.commonProducts.map(p => p.toLowerCase().trim());
              }
              return updated;
            }
            return s;
          });
          return { suppliers: newSuppliers };
        });
        syncSuppliers(useSupplierStore.getState().suppliers);
      },

      removeSupplier: (id) => {
        set((state) => ({
          suppliers: state.suppliers.filter(s => s.id !== id)
        }));
        syncSuppliers(useSupplierStore.getState().suppliers);
      },

      /**
       * Dynamically learns that a supplier sells a new product
       * if the user types a Description that wasn't registered yet.
       */
      learnProductForSupplier: (supplierId, productName) => {
        if (!productName || !productName.trim()) return;
        const normalizedProduct = productName.toLowerCase().trim();
        
        set((state) => {
          return {
            suppliers: state.suppliers.map(s => {
              if (s.id === supplierId) {
                const currentProducts = s.commonProducts || [];
                // Only add if it doesn't already exist
                if (!currentProducts.includes(normalizedProduct)) {
                  return { ...s, commonProducts: [...currentProducts, normalizedProduct] };
                }
              }
              return s;
            })
          };
        });
      },

      /**
       * Returns a list of suppliers that usually sell the typed product string.
       * Useful for auto-select or suggestions in ExpensesModal.
       */
      suggestSuppliersForProduct: (searchString) => {
        if (!searchString || !searchString.trim()) return [];
        const query = searchString.toLowerCase().trim();
        
        return get().suppliers.filter(s => 
          s.active && 
          s.commonProducts?.some(prod => prod.includes(query) || query.includes(prod))
        );
      }
    }),
    {
      name: 'frita-mejor-suppliers',
      version: 1,
    }
  )
);
