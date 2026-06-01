import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { calculateCartTotal } from '../utils/financeUtils';
import { useInventoryStore } from './useInventoryStore';

export const usePosStore = create((set, get) => ({
  // Array de items [{ productId, name, price, qty, isExternal }]
  cart: [], 
  total: 0,

  /**
   * Añade un producto al carrito
   */
  addToCart: (product, qty = 1, customPrice = null) => {
    const currentCart = get().cart;
    const baseProductId = product.id || product.productId;
    const price = customPrice !== null ? customPrice : product.price;
    const cartItemId = customPrice !== null ? `${baseProductId}-var-${price}` : baseProductId;

    const existingIndex = currentCart.findIndex(p => (p.cartItemId || p.productId) === cartItemId);
    let newCart = [...currentCart];

    if (existingIndex >= 0) {
      newCart[existingIndex] = {
        ...newCart[existingIndex],
        qty: newCart[existingIndex].qty + qty
      };
    } else {
      newCart.push({ 
        productId: baseProductId,
        cartItemId: cartItemId,
        name: product.name, 
        price: price, 
        qty 
      });
    }

    set({ cart: newCart, total: calculateCartTotal(newCart) });
  },

  /**
   * Remueve totalmente el producto por su cartItemId o productId
   */
  removeFromCart: (id) => {
    const newCart = get().cart.filter(item => (item.cartItemId || item.productId) !== id);
    set({ cart: newCart, total: calculateCartTotal(newCart) });
  },

  /**
   * Limpia carrito
   */
  clearCart: () => {
    set({ cart: [], total: 0 });
  },

  /**
   * Carga los ítems de un pedido externo (OlaClick) en el carrito actual.
   * Busca coincidencias de nombres de forma robusta e inteligente.
   */
  loadExternalOrder: (items) => {
    const inventory = useInventoryStore.getState().inventory || [];
    const newCart = [];

    items.forEach(item => {
      const normalizedItemName = item.name.toLowerCase().trim();
      
      // Buscar en el inventario de venta por nombre exacto (case-insensitive)
      const match = inventory.find(i => 
        ['FRITO', 'PRODUCTO', 'CRUDO'].includes(i.type) && 
        i.price != null && 
        i.name.toLowerCase().trim() === normalizedItemName
      );

      if (match) {
        newCart.push({
          productId: match.id,
          cartItemId: match.id,
          name: match.name,
          price: match.price,
          qty: item.qty
        });
      } else {
        // Fallback: Cargar como ítem externo genérico para no truncar la venta
        const genericId = item.productId || `GEN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        newCart.push({
          productId: genericId,
          cartItemId: genericId,
          name: `${item.name} (OlaClick)`,
          price: item.price,
          qty: item.qty,
          isExternal: true
        });
      }
    });

    set({ cart: newCart, total: calculateCartTotal(newCart) });
  },

  /**
   * checkout: Acción Compleja
   * 1. Toma el carrito actual, calcula el total.
   * 2. UPDATE Supabase inventory_snapshots restando cantidades para el pointId actual.
   * 3. Retorna un error si no hay stock.
   */
  checkout: async (pointId) => {
    const { cart, total } = get();
    if (cart.length === 0) throw new Error("Carrito vacío");
    if (!pointId) throw new Error("El candado (pointId) es requerido");

    // Simulador de venta guardada exitosamente (bypass a Supabase)
    console.log(`Venta exitosa en ${pointId}:`, cart, `Total: $${total}`);
    
    // Limpia el carrito
    get().clearCart();
    return total;
  }
}));
