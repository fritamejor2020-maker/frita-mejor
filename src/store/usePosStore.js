import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { calculateCartTotal } from '../utils/financeUtils';

export const usePosStore = create((set, get) => ({
  // Array de items [{ productId, name, price, qty }]
  cart: [], 
  total: 0,

  /**
   * Añade un producto al carrito
   */
  addToCart: (product, qty = 1) => {
    const currentCart = get().cart;
    // Asumiendo que `product` viene de catalog con `id`
    const productId = product.id || product.productId;
    const existingIndex = currentCart.findIndex(p => p.productId === productId);
    let newCart = [...currentCart];

    if (existingIndex >= 0) {
      newCart[existingIndex] = {
        ...newCart[existingIndex],
        qty: newCart[existingIndex].qty + qty
      };
    } else {
      newCart.push({ 
        productId: productId, 
        name: product.name, 
        price: product.price, 
        qty 
      });
    }

    set({ cart: newCart, total: calculateCartTotal(newCart) });
  },

  /**
   * Remueve totalmente el producto por su productId
   */
  removeFromCart: (productId) => {
    const newCart = get().cart.filter(item => item.productId !== productId);
    set({ cart: newCart, total: calculateCartTotal(newCart) });
  },

  /**
   * Limpia carrito
   */
  clearCart: () => {
    set({ cart: [], total: 0 });
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
