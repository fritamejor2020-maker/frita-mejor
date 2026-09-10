import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { calculateCartTotal } from '../utils/financeUtils';
import { useInventoryStore } from './useInventoryStore';
import { useAuthStore } from './useAuthStore';

/**
 * Resuelve un ítem de un pedido OlaClick contra el inventario del POS.
 * Orden: mapeo manual por sede -> ID/nombre exacto -> coincidencia parcial (>=4 chars) -> genérico.
 * Devuelve siempre un objeto de carrito listo para usar.
 */
function matchOlaClickItem(item, inventory, branchMappings = {}) {
  const rawName = item.product_name || item.name || 'Producto';
  const normalizedItemName = rawName.toLowerCase().trim();
  const qty = Number(item.quantity || item.qty || 1);
  const price = Number(item.combo_price || item.variant_price || item.price || 0);
  const productId = item.product_id || item.productId;

  let match = null;

  const mappedPosId = branchMappings[productId];
  if (mappedPosId) match = inventory.find(i => i.id === mappedPosId);

  if (!match) {
    match = inventory.find(i =>
      (i.id === productId || (i.name && i.name.toLowerCase().trim() === normalizedItemName)) &&
      i.inTricycles === true
    );
  }

  // Coincidencia parcial: solo si el término más corto tiene >=4 caracteres,
  // para no mapear "Té" dentro de "Tostada" ni "L" dentro de "Limonada".
  if (!match && normalizedItemName.length >= 4) {
    match = inventory.find(i => {
      if (!i.name || i.inTricycles !== true) return false;
      const invName = i.name.toLowerCase().trim();
      const shorter = invName.length <= normalizedItemName.length ? invName : normalizedItemName;
      if (shorter.length < 4) return false;
      return invName.includes(normalizedItemName) || normalizedItemName.includes(invName);
    });
  }

  if (match) {
    return {
      id: match.id,
      productId: match.id,
      cartItemId: match.id,
      name: match.name,
      price: match.price || price,
      qty,
    };
  }

  const genericId = productId || `GEN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  return {
    id: genericId,
    productId: genericId,
    cartItemId: genericId,
    name: `${rawName} (OlaClick)`,
    price,
    qty,
    isExternal: true,
  };
}

export const usePosStore = create((set, get) => ({
  // Array de items [{ productId, name, price, qty, isExternal }]
  cart: [], 
  total: 0,

  // Pedidos de OlaClick sincronizados globalmente
  olaclickOrders: (() => {
    try {
      const cached = localStorage.getItem('olaclick_orders_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    return [];
  })(),

  setOlaClickOrders: (orders) => {
    const safeOrders = Array.isArray(orders) ? orders : [];
    try {
      localStorage.setItem('olaclick_orders_cache', JSON.stringify(safeOrders));
    } catch (e) {}
    set({ olaclickOrders: safeOrders });
  },

  upsertOlaClickOrder: (order) => {
    if (!order || !order.id) return;
    set((state) => {
      const prev = state.olaclickOrders || [];
      const exists = prev.some(o => o.id === order.id);
      const next = exists 
        ? prev.map(o => o.id === order.id ? { ...o, ...order } : o)
        : [order, ...prev];
      try {
        localStorage.setItem('olaclick_orders_cache', JSON.stringify(next));
      } catch (e) {}
      return { olaclickOrders: next };
    });
  },

  removeOlaClickOrder: (orderId) => {
    set((state) => {
      const next = (state.olaclickOrders || []).filter(o => o.id !== orderId);
      try {
        localStorage.setItem('olaclick_orders_cache', JSON.stringify(next));
      } catch (e) {}
      return { olaclickOrders: next };
    });
  },

  updateOlaClickOrderStatus: (orderId, status, extra = {}) => {
    set((state) => {
      const next = (state.olaclickOrders || []).map(o => 
        o.id === orderId ? { ...o, status, ...extra, updated_at: new Date().toISOString() } : o
      );
      try {
        localStorage.setItem('olaclick_orders_cache', JSON.stringify(next));
      } catch (e) {}
      return { olaclickOrders: next };
    });
  },

  updateManyOlaClickOrderStatus: (orderIds, status, extra = {}) => {
    const idSet = new Set(orderIds);
    set((state) => {
      const next = (state.olaclickOrders || []).map(o => 
        idSet.has(o.id) ? { ...o, status, ...extra, updated_at: new Date().toISOString() } : o
      );
      try {
        localStorage.setItem('olaclick_orders_cache', JSON.stringify(next));
      } catch (e) {}
      return { olaclickOrders: next };
    });
  },

  // storeId: id de comercio OlaClick de la sede (olaclick_orders.store_id). Si se pasa,
  // solo trae los pedidos de esa sede. Si es null/undefined trae todos (retrocompatible).
  fetchOlaClickOrders: async (storeId = null) => {
    try {
      const since48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      let query = supabase
        .from('olaclick_orders')
        .select('id,customer_name,customer_phone,delivery_address,items,total_amount,payment_method,status,rejection_reason,store_id,created_at,updated_at,public_id,delivery_price,service_type')
        .gte('created_at', since48h);
      if (storeId) query = query.eq('store_id', storeId);
      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(30);
      if (!error && Array.isArray(data)) {
        get().setOlaClickOrders(data);
        return data;
      }
    } catch (e) {
      console.warn('[usePosStore] Error al cargar olaclick_orders:', e);
    }
    return get().olaclickOrders || [];
  },

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
   * Disminuye en 1 la cantidad del producto o lo elimina si la cantidad es 1
   */
  decreaseFromCart: (id) => {
    const currentCart = get().cart;
    const existingIndex = currentCart.findIndex(p => (p.cartItemId || p.productId) === id);
    if (existingIndex < 0) return;

    let newCart = [...currentCart];
    if (newCart[existingIndex].qty > 1) {
      newCart[existingIndex] = {
        ...newCart[existingIndex],
        qty: newCart[existingIndex].qty - 1
      };
    } else {
      newCart.splice(existingIndex, 1);
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
    const newCart = (items || []).map(item => matchOlaClickItem(item, inventory));
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
    const authUser = useAuthStore.getState().user || {};
    const branchId = authUser.branchId || 'GLOBAL';
    const branchMappings = posSettings.olaclickByBranch?.[branchId]?.productMappings || {};

    const normalizedCartItems = (order.items || []).map(item => matchOlaClickItem(item, inventory, branchMappings));

    const customerPhone = order.customer_phone || order.raw_payload?.data?.client?.phone_number || order.raw_payload?.client?.phone_number || '';
    const rawAddr = order.raw_payload?.data?.address || order.raw_payload?.address;
    const deliveryAddress = order.delivery_address || 
      [rawAddr?.address, rawAddr?.reference, rawAddr?.complement].filter(Boolean).join(' - ') || '';

    const newHeldSale = {
      id: `HELD-OLA-${order.id}`,
      originalOlaClickId: order.id,
      publicId: order.public_id || String(order.id)?.substring(0, 8),
      customerName: order.customer_name || order.raw_payload?.data?.client?.name || 'Cliente OlaClick',
      customerPhone: customerPhone,
      deliveryAddress: deliveryAddress,
      serviceType: order.service_type || order.raw_payload?.data?.service_type || 'DELIVERY',
      items: normalizedCartItems,
      subtotal: calculateCartTotal(normalizedCartItems),
      total: order.total_amount || order.raw_payload?.data?.total || calculateCartTotal(normalizedCartItems),
      status: 'SUSPENDED',
      timestamp: new Date().toISOString(),
      heldAt: new Date().toISOString(),
      isOlaClick: true
    };

    // 1. Guardar en memoria local
    set((state) => ({
      heldSales: [newHeldSale, ...state.heldSales.filter(h => h.originalOlaClickId !== order.id)]
    }));

    // 2. Marcar pedido como ACCEPTED en el listado global de OlaClick
    try {
      get().updateOlaClickOrderStatus(order.id, 'ACCEPTED');
    } catch (_) {}

    // 3. Persistir en posSales para sincronización con Supabase y localStorage
    try {
      useInventoryStore.getState().addPosSale(newHeldSale);
    } catch (e) {
      console.warn('[usePosStore] Error al agregar a posSales:', e);
    }
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
      subtotal: total,
      total: total,
      status: 'SUSPENDED',
      timestamp: new Date().toISOString(),
      heldAt: new Date().toISOString(),
      isOlaClick: false
    };

    set((state) => ({
      heldSales: [newHeldSale, ...state.heldSales],
      cart: [],
      total: 0
    }));

    // Persistir en posSales para Supabase y localStorage
    try {
      useInventoryStore.getState().addPosSale(newHeldSale);
    } catch (e) {
      console.warn('[usePosStore] Error al agregar a posSales:', e);
    }

    return true;
  },

  /**
   * Carga una venta en espera al carrito activo del POS y la remueve de la lista de pendientes
   */
  loadHeldSaleToCart: (heldSaleId) => {
    const state = get();
    const heldSale = (state.heldSales || []).find(h => h.id === heldSaleId || h.originalOlaClickId === heldSaleId) ||
      (useInventoryStore.getState().posSales || []).find(s => s.id === heldSaleId);
    if (!heldSale) return;

    set({
      cart: [...(heldSale.items || [])],
      total: calculateCartTotal(heldSale.items || []),
      heldSales: (state.heldSales || []).filter(h => h.id !== heldSaleId && h.originalOlaClickId !== heldSaleId)
    });

    try {
      useInventoryStore.getState().deletePosSale(heldSaleId);
    } catch (e) {
      console.warn('[usePosStore] Error al remover venta cargada de posSales:', e);
    }
  },

  /**
   * Elimina una venta en espera (local y opcionalmente de posSales)
   */
  deleteHeldSale: (heldSaleId, alsoDeleteFromInventory = true) => {
    set((state) => ({
      heldSales: (state.heldSales || []).filter(h => h.id !== heldSaleId && h.originalOlaClickId !== heldSaleId)
    }));
    if (alsoDeleteFromInventory) {
      try {
        useInventoryStore.getState().deletePosSale(heldSaleId);
      } catch (e) {
        console.warn('[usePosStore] Error al eliminar de posSales:', e);
      }
    }
  },

  /**
   * checkout — botón "COBRAR" del VendedorDashboard.
   *
   * ⚠️ INTENCIONAL (2026-09): por ahora el vendedor solo lo usa como CALCULADORA.
   * Las ventas del vendedor se cuadran por inventario (carga + surtido − sobrante),
   * NO por transacción, así que aquí NO se registra venta ni se descuenta stock —
   * solo se valida y se vacía el carrito.
   *
   * TODO (futuro): cuando se pase a facturación real, registrar la venta con
   * addPosSale + descuento de inventario, y quitar el cálculo por inventario para
   * ese vendedor para no duplicar el conteo.
   */
  checkout: async (pointId) => {
    const { cart, total } = get();
    if (cart.length === 0) throw new Error("Carrito vacío");
    if (!pointId) throw new Error("El candado (pointId) es requerido");

    console.log(`[checkout calculadora] ${pointId}:`, cart, `Total: $${total}`);

    // Limpia el carrito
    get().clearCart();
    return total;
  }
}));
