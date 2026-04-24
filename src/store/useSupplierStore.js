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
      // Mapa producto → tipo de gasto (persiste entre sesiones)
      productTypes: {
        papas: 'insumo', aceite: 'insumo', sal: 'insumo',
        carne: 'insumo', pollo: 'insumo', chorizo: 'insumo',
        fundas: 'insumo', tarrinas: 'insumo', servilletas: 'insumo',
      },

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
            }),
            // Si el producto es nuevo, registrarlo como 'por_definir'
            productTypes: (state.productTypes || {})[normalizedProduct]
              ? state.productTypes
              : { ...state.productTypes, [normalizedProduct]: 'por_definir' },
          };
        });
      },

      /**
       * Devuelve el tipo de gasto de un producto (por nombre).
       * Si no existe, retorna 'por_definir'.
       */
      getTipoGasto: (productName) => {
        if (!productName) return 'por_definir';
        const key = productName.toLowerCase().trim();
        return (get().productTypes || {})[key] || 'por_definir';
      },

      /**
       * Asigna un tipo de gasto a un producto y persiste el cambio.
       */
      setTipoGasto: (productName, tipo) => {
        if (!productName) return;
        const key = productName.toLowerCase().trim();
        set((state) => ({
          productTypes: { ...(state.productTypes || {}), [key]: tipo },
        }));
        syncSuppliers(useSupplierStore.getState().suppliers);
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
      },

      /**
       * Returns unique product names across all suppliers that match the query.
       * Used to autocomplete the "Motivo / Descripción" field.
       */
      suggestProducts: (searchString) => {
        if (!searchString || searchString.trim().length < 2) return [];
        const query = searchString.toLowerCase().trim();
        const all = get().suppliers
          .filter(s => s.active)
          .flatMap(s => s.commonProducts || []);
        const unique = [...new Set(all)];
        return unique
          .filter(p => p.includes(query))
          .sort((a, b) => {
            // Exact prefix match first
            const aStarts = a.startsWith(query) ? 0 : 1;
            const bStarts = b.startsWith(query) ? 0 : 1;
            return aStarts - bStarts || a.localeCompare(b);
          })
          .slice(0, 8);
      },

      /**
       * Returns suppliers that sell a specific product (exact / close match).
       * Used to filter the "Proveedor" dropdown when description is already set.
       */
      getSuppliersForProduct: (descripcion) => {
        if (!descripcion || !descripcion.trim()) return get().suppliers.filter(s => s.active);
        const query = descripcion.toLowerCase().trim();
        const matched = get().suppliers.filter(s =>
          s.active &&
          s.commonProducts?.some(p => p.includes(query) || query.includes(p))
        );
        // If no exact match, return all active suppliers as fallback
        return matched.length > 0 ? matched : get().suppliers.filter(s => s.active);
      },
    }),
    {
      name: 'frita-mejor-suppliers',
      version: 1,
    }
  )
);
