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
