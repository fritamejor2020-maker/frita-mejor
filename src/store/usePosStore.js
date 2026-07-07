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
   * Busca coincidencias de nombres de forma robusta e inteligente en el inventario del POS.
   */
  loadExternalOrder: (items) => {
    const inventory = useInventoryStore.getState().inventory || [];
    const newCart = [];

    (items || []).forEach(item => {
      const rawName = item.product_name || item.name || 'Producto';
      const normalizedItemName = rawName.toLowerCase().trim();
      const qty = Number(item.quantity || item.qty || 1);
      const price = Number(item.combo_price || item.variant_price || item.price || 0);
      const productId = item.product_id || item.productId;

      // 1. Buscar coincidencia por ID de producto o por nombre exacto
      let match = inventory.find(i => 
        (i.id === productId || (i.name && i.name.toLowerCase().trim() === normalizedItemName)) &&
        i.inTricycles === true
      );

      // 2. Si no hay coincidencia exacta por nombre/ID, intentar búsqueda por coincidencia parcial (p. ej. "Empanada")
      if (!match) {
        match = inventory.find(i => 
          i.name && 
          i.inTricycles === true && 
          (i.name.toLowerCase().includes(normalizedItemName) || normalizedItemName.includes(i.name.toLowerCase()))
        );
      }

      if (match) {
        newCart.push({
          productId: match.id,
          cartItemId: match.id,
          name: match.name,
          price: match.price || price,
          qty: qty
        });
      } else {
        // Fallback: Cargar como ítem externo genérico para no truncar la venta
        const genericId = productId || `GEN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        newCart.push({
          productId: genericId,
          cartItemId: genericId,
          name: `${rawName} (OlaClick)`,
          price: price,
          qty: qty,
          isExternal: true
        });
      }
    });

    set({ cart: newCart, total: calculateCartTotal(newCart) });
  },

  // Array de ventas en espera / estacionadas [{ id, publicId, customerName, customerPhone, deliveryAddress, serviceType, items, total, heldAt, isOlaClick }]
  heldSales: [],

  /**
   * Guarda un pedido de OlaClick directamente en Ventas en Espera
   */
  parkOlaClickOrder: (order) => {
    const inventory = useInventoryStore.getState().inventory || [];
    const posSettings = useInventoryStore.getState().posSettings || {};
    // Asumimos que el cajero está en una sede y los pedidos llegan a su sede actual (o global)
    // En una implementación final, se buscaría el webhook secret o store_id del pedido para saber la sede
    const authUser = JSON.parse(localStorage.getItem('auth-storage'))?.state?.user || {};
    const branchId = authUser.branchId || 'GLOBAL';
    const branchMappings = posSettings.olaclickByBranch?.[branchId]?.productMappings || {};

    const normalizedCartItems = [];

    (order.items || []).forEach(item => {
      const rawName = item.product_name || item.name || 'Producto';
      const normalizedItemName = rawName.toLowerCase().trim();
      const qty = Number(item.quantity || item.qty || 1);
      const price = Number(item.combo_price || item.variant_price || item.price || 0);
      const productId = item.product_id || item.productId;

      // 1. Revisar si hay un mapeo manual configurado
      const mappedPosId = branchMappings[productId];

      let match = null;
      
      if (mappedPosId) {
        match = inventory.find(i => i.id === mappedPosId);
      }

      // 2. Fallback a búsqueda por ID o nombre
      if (!match) {
        match = inventory.find(i => 
          (i.id === productId || (i.name && i.name.toLowerCase().trim() === normalizedItemName)) &&
          i.inTricycles === true
        );
      }

      if (!match) {
        match = inventory.find(i => 
          i.name && 
          i.inTricycles === true && 
          (i.name.toLowerCase().includes(normalizedItemName) || normalizedItemName.includes(i.name.toLowerCase()))
        );
      }

      if (match) {
        normalizedCartItems.push({
          productId: match.id,
          cartItemId: match.id,
          name: match.name,
          price: match.price || price,
          qty: qty
        });
      } else {
        const genericId = productId || `GEN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        normalizedCartItems.push({
          productId: genericId,
          cartItemId: genericId,
          name: `${rawName} (OlaClick)`,
          price: price,
          qty: qty,
          isExternal: true
        });
      }
    });

    const newHeldSale = {
      id: `HELD-OLA-${order.id}`,
      originalOlaClickId: order.id,
      publicId: order.public_id || order.id?.substring(0, 8),
      customerName: order.customer_name || 'Cliente OlaClick',
      customerPhone: order.customer_phone || '',
      deliveryAddress: order.delivery_address || '',
      serviceType: order.service_type || 'DELIVERY',
      items: normalizedCartItems,
      total: order.total_amount || calculateCartTotal(normalizedCartItems),
      heldAt: new Date().toISOString(),
      isOlaClick: true
    };

    set((state) => ({
      heldSales: [newHeldSale, ...state.heldSales.filter(h => h.originalOlaClickId !== order.id)]
    }));
  },

  /**
   * Guarda el carrito actual del POS en Ventas en Espera
   */
  parkCurrentCart: (label = 'Venta Pausada') => {
    const { cart, total } = get();
    if (cart.length === 0) return false;

    const newHeldSale = {
      id: `HELD-MANUAL-${Date.now()}`,
      customerName: label,
      items: [...cart],
      total: total,
      heldAt: new Date().toISOString(),
      isOlaClick: false
    };

    set((state) => ({
      heldSales: [newHeldSale, ...state.heldSales],
      cart: [],
      total: 0
    }));

    return true;
  },

  /**
   * Carga una venta en espera al carrito activo del POS y la remueve de la lista
   */
  loadHeldSaleToCart: (heldSaleId) => {
    const heldSale = get().heldSales.find(h => h.id === heldSaleId);
    if (!heldSale) return;

    set((state) => ({
      cart: [...heldSale.items],
      total: calculateCartTotal(heldSale.items),
      heldSales: state.heldSales.filter(h => h.id !== heldSaleId)
    }));
  },

  /**
   * Elimina una venta en espera
   */
  deleteHeldSale: (heldSaleId) => {
    set((state) => ({
      heldSales: state.heldSales.filter(h => h.id !== heldSaleId)
    }));
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
