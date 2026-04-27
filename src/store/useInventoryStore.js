import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useAuthStore } from './useAuthStore';
import { push, pullAll } from '../lib/syncManager';
import { markLocalWrite } from '../lib/useRealtimeSync';

// Helper: sincroniza una sección del store con Supabase
function syncKey(key, value) {
  markLocalWrite(key);
  push(key, value).catch(err => console.warn('[Sync]', key, err.message));
}

// =============================================================================
// DATOS INICIALES — BODEGAS Y PUNTOS DE PRODUCCIÓN
// =============================================================================

const INITIAL_WAREHOUSES = [
  { id: 'BOD-001', name: 'Bodega Central',     location: 'Planta Principal', active: true },
  { id: 'BOD-002', name: 'Bodega Refrigerada', location: 'Ala Norte',        active: true },
  { id: 'BOD-003', name: 'Bodega de Secos',    location: 'Exterior',         active: true },
];

const INITIAL_PRODUCTION_POINTS = [
  { id: 'PP-001', name: 'Línea 1 – Chorizos', location: 'Sala A', active: true },
  { id: 'PP-002', name: 'Línea 2 – Embutidos', location: 'Sala B', active: true },
  { id: 'PP-003', name: 'Línea 3 – Jamones',  location: 'Sala C', active: true },
];

const INITIAL_FRY_KITCHENS = [
  { id: 'FK-001', name: 'Cocina Principal', location: 'Zona Norte', active: true },
  { id: 'FK-002', name: 'Cocina Apoyo',     location: 'Zona Sur',   active: true },
];

const INITIAL_INVENTORY = [
  // Bodega Central — Insumos
  { id: 'INS-001', warehouseId: 'BOD-001', name: 'Carne de Cerdo',    qty: 120, unit: 'kg',  type: 'INSUMO',   alert: 20,  barcode: '7701234000001' },
  { id: 'INS-002', warehouseId: 'BOD-001', name: 'Grasa de Cerdo',   qty: 45,  unit: 'kg',  type: 'INSUMO',   alert: 10,  barcode: '7701234000002' },
  { id: 'INS-003', warehouseId: 'BOD-001', name: 'Especias Chorizo', qty: 8,   unit: 'kg',  type: 'INSUMO',   alert: 2,   barcode: '7701234000003' },
  { id: 'INS-004', warehouseId: 'BOD-001', name: 'Sal Nitral',       qty: 3,   unit: 'kg',  type: 'INSUMO',   alert: 1,   barcode: '7701234000004' },
  { id: 'INS-005', warehouseId: 'BOD-001', name: 'Tripa Natural',    qty: 50,  unit: 'm',   type: 'INSUMO',   alert: 10,  barcode: '7701234000005' },
  // Bodega Refrigerada — Insumos
  { id: 'INS-006', warehouseId: 'BOD-002', name: 'Carne de Res',     qty: 80,  unit: 'kg',  type: 'INSUMO',   alert: 15,  barcode: '7701234000006' },
  { id: 'INS-007', warehouseId: 'BOD-002', name: 'Paprika',          qty: 2,   unit: 'kg',  type: 'INSUMO',   alert: 0.5, barcode: '7701234000007' },
  { id: 'INS-008', warehouseId: 'BOD-002', name: 'Hielo',            qty: 200, unit: 'kg',  type: 'INSUMO',   alert: 30,  barcode: '7701234000008' },
  // Bodega de Secos — Productos terminados listos para despacho
  { id: 'PRD-001', warehouseId: 'BOD-003', name: 'Chorizo Tradicional', qty: 30, unit: 'kg', type: 'PRODUCTO', alert: 5, barcode: '7701234100001', price: 15000, posCategoryId: 'CAT-003' },
  { id: 'PRD-002', warehouseId: 'BOD-003', name: 'Salchicha Viena',     qty: 15, unit: 'kg', type: 'PRODUCTO', alert: 5, barcode: '7701234100002', price: 12000, posCategoryId: 'CAT-003' },
  { id: 'PRD-003', warehouseId: 'BOD-003', name: 'Morcilla Negra',      qty: 8,  unit: 'kg', type: 'PRODUCTO', alert: 3, barcode: '7701234100003', price: 14000, posCategoryId: 'CAT-003' },
  { id: 'PRD-004', warehouseId: 'BOD-003', name: 'Jamón del Diablo',    qty: 20, unit: 'kg', type: 'PRODUCTO', alert: 5, barcode: '7701234100004', price: 25000, posCategoryId: 'CAT-003' },
  
  // Productos listos para freír / Fritos
  // Productos listos para freír / Fritos
  { id: 'PRD-RAW-005', warehouseId: 'BOD-002', name: 'Empanadas Crudas', qty: 150, unit: 'ud', type: 'PRODUCTO', alert: 30, barcode: '7701234100005C' },
  { id: 'PRD-RAW-006', warehouseId: 'BOD-002', name: 'Pasteles Crudos',  qty: 80,  unit: 'ud', type: 'PRODUCTO', alert: 15, barcode: '7701234100006C' },
  { id: 'PRD-005', warehouseId: 'BOD-003', name: 'Empanadas Fritas',    qty: 100, unit: 'ud', type: 'FRITO',    alert: 20, barcode: '7701234100005', price: 2000, posCategoryId: 'CAT-001', imageUrl: 'https://images.unsplash.com/photo-1626202868472-3580436d6a2f?q=80&w=300&auto=format&fit=crop' },
  { id: 'PRD-006', warehouseId: 'BOD-003', name: 'Pasteles Fritos',     qty: 50,  unit: 'ud', type: 'FRITO',    alert: 10, barcode: '7701234100006', price: 4000, posCategoryId: 'CAT-001', imageUrl: 'https://images.unsplash.com/photo-1604467715878-83e57e8ba129?q=80&w=300&auto=format&fit=crop' },
];

const INITIAL_PRODUCTS = [
  {
    id: 'P-001', name: 'Chorizo Tradicional', recipeId: 'R-001',
    productionPointIds: ['PP-001'], unit: 'kg', outputInventoryId: 'PRD-001',
    linePresets: { 'PP-001': [1, 2, 5, 10, 20] },
  },
  {
    id: 'P-002', name: 'Salchicha Viena', recipeId: 'R-002',
    productionPointIds: ['PP-002'], unit: 'kg', outputInventoryId: 'PRD-002',
    linePresets: { 'PP-002': [1, 2, 5, 10, 20] },
  },
  {
    id: 'P-003', name: 'Morcilla Negra', recipeId: 'R-003',
    productionPointIds: ['PP-001'], unit: 'kg', outputInventoryId: 'PRD-003',
    linePresets: { 'PP-001': [1, 2, 5, 10, 20] },
  },
  {
    id: 'P-004', name: 'Jamón del Diablo', recipeId: 'R-004',
    productionPointIds: ['PP-003'], unit: 'kg', outputInventoryId: 'PRD-004',
    linePresets: { 'PP-003': [1, 2, 5, 10, 20] },
  },
];

const INITIAL_FRITADO_RECIPES = [
  { id: 'FR-001', crudoId: 'PRD-RAW-005', fritoId: 'PRD-005', presets: [10, 20, 50, 100, 200], fryKitchenIds: ['FK-001'] },
  { id: 'FR-002', crudoId: 'PRD-RAW-006', fritoId: 'PRD-006', presets: [10, 20, 50, 100, 200], fryKitchenIds: ['FK-001'] },
];

const INITIAL_RECIPES = [
  {
    id: 'R-001', name: 'Chorizo Tradicional', productId: 'P-001',
    yieldQty: 10, yieldUnit: 'kg',
    ingredients: [
      { inventoryId: 'INS-001', name: 'Carne de Cerdo',    qty: 6.5,  unit: 'kg' },
      { inventoryId: 'INS-002', name: 'Grasa de Cerdo',   qty: 2.5,  unit: 'kg' },
      { inventoryId: 'INS-003', name: 'Especias Chorizo', qty: 0.3,  unit: 'kg' },
      { inventoryId: 'INS-004', name: 'Sal Nitral',       qty: 0.05, unit: 'kg' },
      { inventoryId: 'INS-005', name: 'Tripa Natural',    qty: 3,    unit: 'm'  },
    ],
  },
  {
    id: 'R-002', name: 'Salchicha Viena', productId: 'P-002',
    yieldQty: 5, yieldUnit: 'kg',
    ingredients: [
      { inventoryId: 'INS-001', name: 'Carne de Cerdo', qty: 2.5,  unit: 'kg' },
      { inventoryId: 'INS-006', name: 'Carne de Res',   qty: 1.5,  unit: 'kg' },
      { inventoryId: 'INS-004', name: 'Sal Nitral',     qty: 0.03, unit: 'kg' },
      { inventoryId: 'INS-008', name: 'Hielo',          qty: 1.5,  unit: 'kg' },
    ],
  },
  {
    id: 'R-003', name: 'Morcilla Negra', productId: 'P-003',
    yieldQty: 5, yieldUnit: 'kg',
    ingredients: [
      { inventoryId: 'INS-002', name: 'Grasa de Cerdo', qty: 3,    unit: 'kg' },
      { inventoryId: 'INS-007', name: 'Paprika',        qty: 0.1,  unit: 'kg' },
      { inventoryId: 'INS-004', name: 'Sal Nitral',     qty: 0.02, unit: 'kg' },
    ],
  },
  {
    id: 'R-004', name: 'Jamón del Diablo', productId: 'P-004',
    yieldQty: 8, yieldUnit: 'kg',
    ingredients: [
      { inventoryId: 'INS-006', name: 'Carne de Res',   qty: 6,    unit: 'kg' },
      { inventoryId: 'INS-001', name: 'Carne de Cerdo', qty: 1.5,  unit: 'kg' },
      { inventoryId: 'INS-004', name: 'Sal Nitral',     qty: 0.04, unit: 'kg' },
      { inventoryId: 'INS-003', name: 'Especias',       qty: 0.1,  unit: 'kg' },
    ],
  },
];

// =============================================================================
// DATOS INICIALES — POS (PUNTO DE VENTA)
// =============================================================================

const INITIAL_POS_CATEGORIES = [
  { id: 'CAT-001', name: 'Fritos', color: 'bg-orange-500' },
  { id: 'CAT-002', name: 'Bebidas', color: 'bg-blue-500' },
  { id: 'CAT-003', name: 'Crudos / Paquetes', color: 'bg-green-500' },
];

const INITIAL_CUSTOMERS = [
  { id: 'CUST-002', name: 'Mayorista VIP', document: '900123456', discountPercent: 10, active: true, typeId: 'CTYPE-001', phone: '', creditLimit: 500000, notes: '', address: '' },
];

const INITIAL_CUSTOMER_TYPES = [
  { id: 'CTYPE-001', name: 'Mayoristas', productDiscounts: [{ productId: 'PRD-001', discountValue: 1800 }], allowCredit: true, globalDiscountPercent: 0, color: 'bg-blue-500' },
  { id: 'CTYPE-002', name: 'Eventos Especiales', productDiscounts: [], allowCredit: false, globalDiscountPercent: 0, color: 'bg-purple-500' }
];

const INITIAL_POS_SETTINGS = {
  printerName: 'POS-58',
  cashDrawerCode: '\\x1B\\x70\\x00\\x19\\xFA',
  paymentMethods: [
    { id: 'PM-001', name: 'EFECTIVO', openDrawer: true, printReceipt: true },
    { id: 'PM-002', name: 'TARJETA', openDrawer: false, printReceipt: true },
    { id: 'PM-003', name: 'NEQUI', openDrawer: false, printReceipt: true },
    { id: 'PM-004', name: 'BANCOLOMBIA', openDrawer: false, printReceipt: true },
  ],
  restockPresets: [5, 10, 15, 20],
  ticketConfig: {
    businessName: 'Frita Mejor',
    nit: '900.000.000-1',
    phone: '300 123 4567',
    address: 'Cali, Colombia',
    showLogo: true,
    showBarcode: true,
    showCashier: true,
    saleFooterMsg: '¡GRACIAS POR SU COMPRA!',
    saleSubFooterMsg: 'Conserve este tiquete para reclamos.',
    saleBottomLine: 'Sistema POS • fritamejor.com',
    zReportFooterMsg: 'FIN DE INFORME Z',
  },
};

// Templates vacíos — el usuario crea sus propias plantillas desde el Dejador
const INITIAL_LOAD_TEMPLATES = [];

// =============================================================================
// ZUSTAND STORE CON PERSISTENCIA (localStorage)
// =============================================================================

export const useInventoryStore = create(
  persist(
    (set, get) => ({
      warehouses:         INITIAL_WAREHOUSES,
      productionPoints:   INITIAL_PRODUCTION_POINTS,
      fryKitchens:        INITIAL_FRY_KITCHENS,
      inventory:          INITIAL_INVENTORY,
      products:           INITIAL_PRODUCTS,
      recipes:            INITIAL_RECIPES,
      posCategories:      INITIAL_POS_CATEGORIES,
      customers:          INITIAL_CUSTOMERS,
      customerTypes:      INITIAL_CUSTOMER_TYPES,
      posSettings:        INITIAL_POS_SETTINGS,
      fritadoRecipes:     INITIAL_FRITADO_RECIPES,
      movements:          [],
      posShifts:          [],
      posSales:           [],
      posExpenses:        [],
      loadTemplates:      INITIAL_LOAD_TEMPLATES,
      deletedShiftIds:    [],  // tombstone: IDs de cierres eliminados por el admin
      vendorLocations:    {},  // { [vendorId]: { lat, lng, name, pointId, updatedAt } }
      // Pagos y abonos de clientes contrata
      // { id, customerId, customerName, amount, method, note, shiftId, date }
      contrataPayments:   [],

      // ─── CARGA REMOTA (al arrancar la app) ───────────────────────────────────
      // Descarga el estado de Supabase y lo aplica encima del caché local.
      // Si Supabase tiene datos más recientes, los usa; si está vacío, queda el local.
      // GUARD: si justo se ejecutó un Reset General, no cargar datos remotos
      //        (los datos en Supabase deberían estar vacíos, pero por si acaso).
      loadFromRemote: async () => {
        if (sessionStorage.getItem('__reset_done__') === '1') {
          sessionStorage.removeItem('__reset_done__');
          console.log('[Store] Reset recién ejecutado — omitiendo carga remota.');
          return;
        }
        try {
          const remote = await pullAll();
          const SYNC_KEYS = [
            'warehouses', 'inventory', 'movements', 'products', 'recipes',
            'fritadoRecipes', 'posCategories', 'posSettings', 'posShifts',
            'posSales', 'posExpenses', 'customers', 'customerTypes', 'loadTemplates',
            'vendorLocations', 'contrataPayments',
          ];
          const updates = {};
          for (const key of SYNC_KEYS) {
            if (remote[key] !== undefined && remote[key] !== null) {
              const isNonEmpty = Array.isArray(remote[key])
                ? remote[key].length > 0
                : Object.keys(remote[key]).length > 0;
              if (isNonEmpty) {
                let val = remote[key];
                // Filtrar tombstones de posShifts remotos
                if (key === 'posShifts') {
                  const deleted = get().deletedShiftIds || [];
                  val = val.filter(s => !deleted.includes(s.id));
                }
                updates[key] = val;
              }
            }
          }
          if (Object.keys(updates).length > 0) {
            // Smart merge for inventory: local ALWAYS wins over remote.
            // - For items that exist locally: keep local version entirely (preserves price:null for deleted items)
            // - For items that only exist in remote: append them (synced from other devices)
            if (updates.inventory) {
              const localInventory = get().inventory;
              const localIds = new Set(localInventory.map(i => i.id));
              const remoteOnlyItems = updates.inventory.filter(i => !localIds.has(i.id));
              updates.inventory = [...localInventory, ...remoteOnlyItems];
            }
            set(updates);
            console.log('[Store] Estado cargado desde Supabase:', Object.keys(updates));
          }
        } catch (err) {
          console.warn('[Store] No se pudo cargar estado remoto:', err.message);
        }
      },

      // ─── GETTERS ──────────────────────────────────────────────────────────────

      getInventoryByWarehouse: (warehouseId) =>
        get().inventory.filter((i) => i.warehouseId === warehouseId),

      getProductsByProductionPoint: (ppId) =>
        get().products.filter((p) => p.productionPointIds?.includes(ppId)),

      getRecipeByProductId: (productId) =>
        get().recipes.find((r) => r.productId === productId),

      /**
       * Lista unificada de productos del POS / campo.
       * Todos los módulos (Dejador, Vendedor, POS) deben usar ESTE selector
       * para que los productIds coincidan en cargas, surtidos, pedidos y cierres.
       * Filtra inventory por tipo FRITO o PRODUCTO y que tenga precio definido.
       */
      getPosItems: () =>
        get().inventory.filter(
          (i) => ['FRITO', 'PRODUCTO', 'CRUDO'].includes(i.type) && i.price != null
        ),

      /**
       * Productos del flujo logístico del Dejador (Surtir + Recibir).
       * Excluye productos marcados como showInTricicloPos:true
       * (esos son solo para el POS del vendedor, no necesitan ser cargados en triciclo).
       */
      getDeliveryItems: () =>
        get().inventory.filter(
          (i) => ['FRITO', 'PRODUCTO', 'CRUDO'].includes(i.type) && i.price != null && !i.showInTricicloPos
        ),

      /**
       * Productos del POS del Vendedor de triciclo.
       * Incluye TODOS los productos con precio, incluyendo los showInTricicloPos.
       * Excluye los marcados showInPos:false.
       */
      getVendedorPosItems: () =>
        get().inventory.filter(
          (i) => ['FRITO', 'PRODUCTO', 'CRUDO'].includes(i.type) && i.price != null && i.showInPos !== false
        ),


      // Verifica si hay stock para producir [batches] lotes
      checkStock: (recipeId, batches = 1) => {
        const recipe = get().recipes.find((r) => r.id === recipeId);
        if (!recipe) return { canProduce: true, missing: [] };
        const missing = [];
        recipe.ingredients.forEach((ing) => {
          const item   = get().inventory.find((i) => i.id === ing.inventoryId);
          const needed = ing.qty * batches;
          if (!item || item.qty < needed) {
            missing.push({ name: ing.name, need: needed, have: item?.qty ?? 0, unit: ing.unit });
          }
        });
        return { canProduce: missing.length === 0, missing };
      },

      // ─── PRODUCCIÓN ──────────────────────────────────────────────────────────

      produceItem: (productId, batches = 1, productionPointId = null) => {
        const product = get().products.find((p) => p.id === productId);
        let recipe  = get().getRecipeByProductId(productId);
        
        // Si no hay receta, asumimos una receta vacía que rinde 1 unidad base del producto
        if (!recipe) {
          recipe = {
            id: 'R-NONE',
            name: product.name,
            yieldQty: 1,
            yieldUnit: product.unit,
            ingredients: []
          };
        }

        const { canProduce, missing } = get().checkStock(recipe.id, batches);
        if (!canProduce) {
          const detail = missing.map(
            (m) => `${m.name}: necesitas ${m.need.toFixed(2)} ${m.unit}, hay ${m.have.toFixed(2)}`
          ).join('\n');
          return { ok: false, message: `Insumos insuficientes:\n${detail}` };
        }

        const produced = recipe.yieldQty * batches;

        set((state) => {
          // 1. Descontar insumos
          let newInventory = state.inventory.map((item) => {
            const ingredient = recipe.ingredients.find((i) => i.inventoryId === item.id);
            if (ingredient) {
              return { ...item, qty: Math.max(0, +(item.qty - (ingredient.qty * batches)).toFixed(3)) };
            }
            return item;
          });

          // 2. Sumar al producto terminado
          const outputId = product?.outputInventoryId;
          // Buscar primero por ID explícito, luego por nombre + tipo
          const targetItemIndex = newInventory.findIndex(
            (item) => (outputId && item.id === outputId) || (!outputId && item.type === 'PRODUCTO' && item.name === product.name)
          );

          if (targetItemIndex !== -1) {
            // El producto ya existe en alguna bodega, sumarle
            const targetItem = newInventory[targetItemIndex];
            newInventory[targetItemIndex] = {
              ...targetItem,
              qty: +(targetItem.qty + produced).toFixed(3)
            };
          } else {
            // El producto no existe o fue eliminado, crearlo en la bodega principal (BOD-003 es asumiendo que es Secos/Terminados)
            // Si el nombre dice 'Crudo' lo mandamos a BOD-002 (Refrigerada). Si no sabemos, BOD-003.
            const targetWarehouseId = product.name.toLowerCase().includes('crudo') ? 'BOD-002' : 'BOD-003';
            const newItem = {
              id: outputId || `PRD-${Date.now()}`,
              warehouseId: targetWarehouseId,
              name: product.name,
              qty: produced,
              unit: product.unit || recipe.yieldUnit,
              type: 'PRODUCTO',
              alert: 5,
            };
            newInventory.push(newItem);
          }

          const movement = {
            id: Date.now(),
            type: 'PRODUCCION',
            productId,
            recipeId: recipe.id,
            batches,
            produced,
            productionPointId,
            person: useAuthStore.getState().user?.name || 'Sistema',
            timestamp: new Date().toISOString(),
          };

          return { inventory: newInventory, movements: [movement, ...state.movements] };
        });

        // Sync remoto
        syncKey('inventory', get().inventory);
        syncKey('movements', get().movements);

        return {
          ok: true,
          message: `✔ ${produced} ${recipe.yieldUnit} de ${recipe.name} producidos.`,
          produced,
        };
      },

      fryItem: (rawInventoryId, fritoInventoryId, qty, fryKitchenId = null) => {
        const rawItem = get().inventory.find(i => i.id === rawInventoryId);
        const fritoItem = get().inventory.find(i => i.id === fritoInventoryId);

        if (!rawItem || rawItem.qty < qty) {
           return { ok: false, message: `No hay suficiente stock de ${rawItem?.name ?? 'crudo'} (Disponible: ${rawItem?.qty ?? 0}).` };
        }
        if (!fritoItem) {
           return { ok: false, message: 'Producto frito destino no encontrado.' };
        }

        set((state) => {
          const newInventory = state.inventory.map(i => {
            if (i.id === rawInventoryId) return { ...i, qty: +(i.qty - qty).toFixed(3) };
            if (i.id === fritoInventoryId) return { ...i, qty: +(i.qty + qty).toFixed(3) };
            return i;
          });
          const movement = {
            id: Date.now(),
            type: 'FRITADO',
            inventoryId: fritoInventoryId,
            rawInventoryId,
            qty,
            fryKitchenId,
            person: useAuthStore.getState().user?.name || 'Operario',
            timestamp: new Date().toISOString(),
          };
          return { inventory: newInventory, movements: [movement, ...state.movements] };
        });

        syncKey('inventory', get().inventory);
        syncKey('movements', get().movements);
        return { ok: true, message: `✔ ${qty} unidades fritas registradas de ${fritoItem.name}.` };
      },

      reportWaste: (inventoryId, qty, reason = '', locationId = null) => {
        set((state) => {
          const newInventory = state.inventory.map((item) =>
            item.id === inventoryId
              ? { ...item, qty: Math.max(0, +(item.qty - qty).toFixed(3)) }
              : item
          );
          const movement = {
            id: Date.now(), type: 'MERMA', inventoryId, qty, reason, productionPointId: locationId, fryKitchenId: locationId, 
            person: useAuthStore.getState().user?.name || 'Operario',
            timestamp: new Date().toISOString(),
          };
          return { inventory: newInventory, movements: [movement, ...state.movements] };
        });
        syncKey('inventory', get().inventory);
        syncKey('movements', get().movements);
        return { ok: true };
      },

      // ─── BODEGA ──────────────────────────────────────────────────────────────

      receiveItem: (inventoryId, qty, warehouseId = null) => {
        set((state) => {
          const newInventory = state.inventory.map((item) =>
            item.id === inventoryId ? { ...item, qty: +(item.qty + qty).toFixed(3) } : item
          );
          const movement = {
            id: Date.now(), type: 'RECEPCION', inventoryId, qty, warehouseId,
            timestamp: new Date().toISOString(),
          };
          return { inventory: newInventory, movements: [movement, ...state.movements] };
        });
        syncKey('inventory', get().inventory);
        syncKey('movements', get().movements);
        return { ok: true };
      },

      dispatchItem: (inventoryId, qty, warehouseId = null, reason = '', person = '') => {
        const item = get().inventory.find((i) => i.id === inventoryId);
        if (!item || item.qty < qty) {
          return { ok: false, message: `Stock insuficiente. Disponible: ${item?.qty ?? 0} ${item?.unit ?? ''}` };
        }
        set((state) => {
          const newInventory = state.inventory.map((i) =>
            i.id === inventoryId ? { ...i, qty: +(i.qty - qty).toFixed(3) } : i
          );
          const movement = {
            id: Date.now(), type: 'DESPACHO', inventoryId, qty, warehouseId,
            reason, person,
            timestamp: new Date().toISOString(),
          };
          return { inventory: newInventory, movements: [movement, ...state.movements] };
        });
        syncKey('inventory', get().inventory);
        syncKey('movements', get().movements);
        return { ok: true, message: `Despachado: -${qty} ${item.unit}` };
      },

      // Transferir stock entre bodegas
      transferItem: (inventoryId, qty, fromWarehouseId, toWarehouseId) => {
        const item = get().inventory.find((i) => i.id === inventoryId);
        if (!item || item.qty < qty) {
          return { ok: false, message: 'Stock insuficiente para transferir.' };
        }

        set((state) => {
          const destItem = state.inventory.find(
            (i) => i.name === item.name && i.warehouseId === toWarehouseId
          );
          let newInventory;
          if (destItem) {
            newInventory = state.inventory.map((i) => {
              if (i.id === inventoryId) return { ...i, qty: +(i.qty - qty).toFixed(3) };
              if (i.id === destItem.id) return { ...i, qty: +(i.qty + qty).toFixed(3) };
              return i;
            });
          } else {
            const newItem = { ...item, id: `INS-${Date.now()}`, warehouseId: toWarehouseId, qty };
            newInventory = [
              ...state.inventory.map((i) =>
                i.id === inventoryId ? { ...i, qty: +(i.qty - qty).toFixed(3) } : i
              ),
              newItem,
            ];
          }
          const movement = {
            id: Date.now(), type: 'TRANSFERENCIA', inventoryId,
            qty, fromWarehouseId, toWarehouseId, timestamp: new Date().toISOString(),
          };
          return { inventory: newInventory, movements: [movement, ...state.movements] };
        });
        syncKey('inventory', get().inventory);
        syncKey('movements', get().movements);
        return { ok: true, message: `Transferencia completada: ${qty} ${item.unit} de ${item.name}` };
      },

      // Ajustar stock físico (suma o resta sin afectar otras bodegas)
      adjustInventory: (inventoryId, newQty, diff, warehouseId) => {
        set((state) => {
          const newInventory = state.inventory.map((i) =>
            i.id === inventoryId ? { ...i, qty: newQty } : i
          );
          
          if (diff === 0) return { inventory: newInventory }; // No movement if no diff

          const movement = {
            id: Date.now(),
            type: 'AJUSTE',
            inventoryId,
            qty: Math.abs(diff),
            reason: diff > 0 ? 'Sobrante en conteo' : 'Faltante en conteo',
            warehouseId,
            timestamp: new Date().toISOString(),
          };
          
          return { inventory: newInventory, movements: [movement, ...state.movements] };
        });
        syncKey('inventory', get().inventory);
        syncKey('movements', get().movements);
      },

      updateMovement: (id, updates) => {
        set((state) => {
          const mvIndex = state.movements.findIndex((m) => m.id === id);
          if (mvIndex === -1) return state;

          const oldMv = state.movements[mvIndex];
          const newMv = { ...oldMv, ...updates };
          const newMovements = [...state.movements];
          newMovements[mvIndex] = newMv;

          // Si la cantidad cambió, ajustamos el inventario acorde al tipo de movimiento
          if (updates.qty !== undefined && updates.qty !== oldMv.qty) {
            const diff = updates.qty - oldMv.qty; // Diferencia en valor absoluto
            let newInventory = [...state.inventory];
            const itemIdx = newInventory.findIndex((i) => i.id === oldMv.inventoryId && (i.warehouseId === oldMv.warehouseId || i.warehouseId === oldMv.fromWarehouseId));

            if (itemIdx !== -1) {
              const item = { ...newInventory[itemIdx] };
              if (oldMv.type === 'DESPACHO' || oldMv.type === 'MERMA') {
                // Si despachó más, quitamos más del stock (-diff). Si despachó menos, devolvemos stock (+(-diff) porque diff es negativo, wait, diff = nuevo - viejo. Si viejo era 10 y nuevo es 5, diff es -5. Hay que devolver 5 al stock. O sea, stock -= diff.
                item.qty = +(item.qty - diff).toFixed(3);
              } else if (oldMv.type === 'RECEPCION') {
                // Si recibió más, sumamos más al stock (+diff). Si viejo 10, nuevo 15, diff = 5. Stock += 5.
                item.qty = +(item.qty + diff).toFixed(3);
              } else if (oldMv.type === 'AJUSTE') {
                // Ajuste viejo: 10, nuevo: 15. Si es sobrante (+), sumamos diff al stock. Si es faltante (-), restamos diff.
                if (oldMv.reason === 'Sobrante en conteo') {
                  item.qty = +(item.qty + diff).toFixed(3);
                } else {
                  item.qty = +(item.qty - diff).toFixed(3);
                }
              }
              newInventory[itemIdx] = item;
            }

            // Transferiencia afecta dos bodegas
            if (oldMv.type === 'TRANSFERENCIA') {
               const srcIdx = newInventory.findIndex(i => i.id === oldMv.inventoryId && i.warehouseId === oldMv.fromWarehouseId);
               const dstIdx = newInventory.findIndex(i => i.id === oldMv.inventoryId && i.warehouseId === oldMv.toWarehouseId);
               if (srcIdx !== -1) {
                 const srcItem = { ...newInventory[srcIdx] };
                 srcItem.qty = +(srcItem.qty - diff).toFixed(3); // devuelto a la cuenta
                 newInventory[srcIdx] = srcItem;
               }
               if (dstIdx !== -1) {
                 const dstItem = { ...newInventory[dstIdx] };
                 dstItem.qty = +(dstItem.qty + diff).toFixed(3); // extraído de la cuenta
                 newInventory[dstIdx] = dstItem;
               }
            }
            return { movements: newMovements, inventory: newInventory };
          }
          return { movements: newMovements };
        });
        syncKey('movements', get().movements);
        syncKey('inventory', get().inventory);
      },

      // ─── ADMIN CRUD ────────────────────────────────────────────────────────────

      // Bodegas
      addWarehouse: (w) => { set((s) => ({ warehouses: [...s.warehouses, { ...w, id: `BOD-${Date.now()}`, active: true }] })); syncKey('warehouses', useInventoryStore.getState().warehouses); },
      updateWarehouse: (id, data) => { set((s) => ({ warehouses: s.warehouses.map((w) => w.id === id ? { ...w, ...data } : w) })); syncKey('warehouses', useInventoryStore.getState().warehouses); },
      deleteWarehouse: (id) => { set((s) => ({ warehouses: s.warehouses.filter((w) => w.id !== id) })); syncKey('warehouses', useInventoryStore.getState().warehouses); },

      // Puntos de Producción
      addProductionPoint: (pp) => set((s) => ({
        productionPoints: [...s.productionPoints, { ...pp, id: `PP-${Date.now()}`, active: true }],
      })),
      updateProductionPoint: (id, data) => set((s) => ({
        productionPoints: s.productionPoints.map((p) => p.id === id ? { ...p, ...data } : p),
      })),
      deleteProductionPoint: (id) => set((s) => ({
        productionPoints: s.productionPoints.filter((p) => p.id !== id),
      })),

      // Cocinas de Fritado
      addFryKitchen: (fk) => set((s) => ({
        fryKitchens: [...(s.fryKitchens || []), { ...fk, id: `FK-${Date.now()}`, active: true }],
      })),
      updateFryKitchen: (id, data) => set((s) => ({
        fryKitchens: (s.fryKitchens || []).map((k) => k.id === id ? { ...k, ...data } : k),
      })),
      deleteFryKitchen: (id) => set((s) => ({
        fryKitchens: (s.fryKitchens || []).filter((k) => k.id !== id),
      })),

      // Inventario
      addInventoryItem: (item) => {
        const prefix = item.type === 'FRITO' ? 'FR' : item.type === 'PRODUCTO' ? 'PRD' : 'INS';
        const newItem = { ...item, id: `${prefix}-${Date.now()}`, qty: parseFloat(item.qty) || 0 };
        set((s) => ({ inventory: [...s.inventory, newItem] }));
        syncKey('inventory', useInventoryStore.getState().inventory);
      },
      updateInventoryItem: (id, data) => { set((s) => ({ inventory: s.inventory.map((i) => i.id === id ? { ...i, ...data } : i) })); syncKey('inventory', useInventoryStore.getState().inventory); },
      deleteInventoryItem: (id) => { set((s) => ({ inventory: s.inventory.filter((i) => i.id !== id) })); syncKey('inventory', useInventoryStore.getState().inventory); },

      // Productos
      addProduct: (p) => { set((s) => ({ products: [...s.products, { ...p, id: `P-${Date.now()}` }] })); syncKey('products', useInventoryStore.getState().products); },
      updateProduct: (id, data) => { set((s) => ({ products: s.products.map((p) => p.id === id ? { ...p, ...data } : p) })); syncKey('products', useInventoryStore.getState().products); },
      deleteProduct: (id) => { set((s) => ({ products: s.products.filter((p) => p.id !== id) })); syncKey('products', useInventoryStore.getState().products); },

      // Recetas
      addRecipe: (r) => { set((s) => ({ recipes: [...s.recipes, { ...r, id: `R-${Date.now()}` }] })); syncKey('recipes', useInventoryStore.getState().recipes); },
      updateRecipe: (id, data) => { set((s) => ({ recipes: s.recipes.map((r) => r.id === id ? { ...r, ...data } : r) })); syncKey('recipes', useInventoryStore.getState().recipes); },
      deleteRecipe: (id) => { set((s) => ({ recipes: s.recipes.filter((r) => r.id !== id) })); syncKey('recipes', useInventoryStore.getState().recipes); },

      // POS Categorías
      addPosCategory: (c) => set((s) => ({
        posCategories: [...(s.posCategories || []), { ...c, id: `CAT-${Date.now()}` }],
      })),
      updatePosCategory: (id, data) => set((s) => ({
        posCategories: (s.posCategories || []).map((c) => c.id === id ? { ...c, ...data } : c),
      })),
      deletePosCategory: (id) => set((s) => ({
        posCategories: (s.posCategories || []).filter((c) => c.id !== id),
      })),

      // Clientes
      addCustomer: (c) => { set((s) => ({
        customers: [...(s.customers || []), { ...c, id: `CUST-${Date.now()}`, active: true, typeId: c.typeId || null }],
      })); syncKey('customers', useInventoryStore.getState().customers); },
      updateCustomer: (id, data) => { set((s) => ({
        customers: (s.customers || []).map((c) => c.id === id ? { ...c, ...data } : c),
      })); syncKey('customers', useInventoryStore.getState().customers); },
      deleteCustomer: (id) => { set((s) => ({
        customers: (s.customers || []).filter((c) => c.id !== id),
      })); syncKey('customers', useInventoryStore.getState().customers); },

      // Tipos de Clientes (Customer Types VIP)
      addCustomerType: (typeData) => set((state) => ({
        customerTypes: [...(state.customerTypes || []), { ...typeData, id: `CTYPE-${Date.now()}` }]
      })),
      updateCustomerType: (id, updates) => set((state) => ({
        customerTypes: (state.customerTypes || []).map(c => c.id === id ? { ...c, ...updates } : c)
      })),
      deleteCustomerType: (id) => set((state) => ({
        customerTypes: (state.customerTypes || []).filter(c => c.id !== id),
        customers: (state.customers || []).map(c => c.typeId === id ? { ...c, typeId: null } : c)
      })),

      // Configuración POS y Global settings
      updatePosSettings: (data) => { set((s) => ({ posSettings: { ...(s.posSettings || INITIAL_POS_SETTINGS), ...data } })); syncKey('posSettings', useInventoryStore.getState().posSettings); },

      // Fritado Recipes
      addFritadoRecipe: (recipe) => set((s) => ({
        fritadoRecipes: [...(s.fritadoRecipes || []), { ...recipe, id: `FR-${Date.now()}` }]
      })),
      updateFritadoRecipe: (id, data) => set((s) => ({
        fritadoRecipes: (s.fritadoRecipes || []).map(r => r.id === id ? { ...r, ...data } : r)
      })),
      deleteFritadoRecipe: (id) => set((s) => ({
        fritadoRecipes: (s.fritadoRecipes || []).filter(r => r.id !== id)
      })),

      // Plantillas de Carga / Surtido
      addLoadTemplate: (template) => set((s) => ({
        loadTemplates: [...(s.loadTemplates || []), { ...template, id: `TPL-${Date.now()}` }]
      })),
      updateLoadTemplate: (id, updates) => set((s) => ({
        loadTemplates: (s.loadTemplates || []).map(t => t.id === id ? { ...t, ...updates } : t)
      })),
      deleteLoadTemplate: (id) => set((s) => ({
        loadTemplates: (s.loadTemplates || []).filter(t => t.id !== id)
      })),

      // Ventas / Caja
      addPosSale: (sale) => { set((s) => ({ posSales: [{ ...sale, id: `SALE-${Date.now()}` }, ...(s.posSales || [])] })); syncKey('posSales', useInventoryStore.getState().posSales); },
      updatePosSale: (id, data) => { set((s) => ({ posSales: (s.posSales || []).map((sale) => sale.id === id ? { ...sale, ...data } : sale) })); syncKey('posSales', useInventoryStore.getState().posSales); },
      deletePosSale: (id) => { set((s) => ({ posSales: (s.posSales || []).filter((sale) => sale.id !== id) })); syncKey('posSales', useInventoryStore.getState().posSales); },

      addPosShift: (shift) => {
        const deleted = useInventoryStore.getState().deletedShiftIds || [];
        const newShift = { ...shift, id: `SHIFT-${Date.now()}` };
        // Solo agregar si no está en la lista de eliminados (por IDs previos)
        set((s) => ({
          posShifts: [
            newShift,
            ...(s.posShifts || []).filter(sh => !deleted.includes(sh.id))
          ]
        }));
        syncKey('posShifts', useInventoryStore.getState().posShifts);
      },
      updatePosShift: (id, data) => { set((s) => ({ posShifts: (s.posShifts || []).map((shift) => shift.id === id ? { ...shift, ...data } : shift) })); syncKey('posShifts', useInventoryStore.getState().posShifts); },
      deletePosShift: (id) => {
        // Agregar al tombstone para que otras tabs no lo restauren
        set((s) => ({
          posShifts: (s.posShifts || []).filter((shift) => shift.id !== id),
          deletedShiftIds: [...new Set([...(s.deletedShiftIds || []), id])]
        }));
        syncKey('posShifts', useInventoryStore.getState().posShifts);
        syncKey('deletedShiftIds', useInventoryStore.getState().deletedShiftIds);
      },

      addPosExpense: (expense) => { set((s) => ({ posExpenses: [{ ...expense, id: `EXP-${Date.now()}` }, ...(s.posExpenses || [])] })); syncKey('posExpenses', useInventoryStore.getState().posExpenses); },

      // ─── CONTRATAS: Pagos / Abonos ───────────────────────────────────────────
      // El balance real de una contrata = sum(ventas crédito) - sum(pagos)
      // Se calcula siempre en tiempo real para evitar inconsistencias de sync.
      addContrataPayment: (payment) => {
        const newPayment = {
          ...payment,
          id: `PAY-${Date.now()}`,
          date: new Date().toISOString(),
        };
        set((s) => ({ contrataPayments: [newPayment, ...(s.contrataPayments || [])] }));
        syncKey('contrataPayments', useInventoryStore.getState().contrataPayments);
      },

      // Calcula saldo pendiente de una contrata (cuánto debe actualmente)
      // deuda > 0 significa que el cliente DEBE plata
      getContrataBalance: (customerId) => {
        const sales = (useInventoryStore.getState().posSales || []).filter(
          s => s.customerId === customerId && s.status === 'PAID' && s.contrataPaymentMethod === 'credit'
        );
        const creditDebt = sales.reduce((acc, s) => acc + (s.creditAmount || s.total || 0), 0);
        const payments = (useInventoryStore.getState().contrataPayments || []).filter(
          p => p.customerId === customerId
        );
        const paid = payments.reduce((acc, p) => acc + (p.amount || 0), 0);
        return Math.max(0, creditDebt - paid);
      },

      /**
       * Guarda la última ubicación conocida del vendedor en app_state.
       * Esto permite mostrarla en el mapa aunque la app esté cerrada.
       */
      updateVendorLocation: (vendorId, lat, lng, name, pointId) => {
        const now = new Date().toISOString();
        set((s) => ({
          vendorLocations: {
            ...(s.vendorLocations || {}),
            [vendorId]: { lat, lng, name, pointId, updatedAt: now, isActive: true },
          }
        }));
        syncKey('vendorLocations', useInventoryStore.getState().vendorLocations);
      },

      clearVendorLocation: (vendorId) => {
        set((s) => {
          const locs = { ...(s.vendorLocations || {}) };
          if (locs[vendorId]) locs[vendorId] = { ...locs[vendorId], isActive: false };
          return { vendorLocations: locs };
        });
        syncKey('vendorLocations', useInventoryStore.getState().vendorLocations);
      },
    }),
    {
      name: 'frita-mejor-inventory',
      version: 9, // v9: contrataPayments + allowCredit + color en customerTypes
      partialize: (state) => ({
        warehouses:         state.warehouses,
        productionPoints:   state.productionPoints,
        fryKitchens:        state.fryKitchens || [],
        inventory:          state.inventory,
        products:           state.products,
        recipes:            state.recipes,
        fritadoRecipes:     state.fritadoRecipes,
        movements:          state.movements,
        posCategories:      state.posCategories,
        customers:          state.customers,
        customerTypes:      state.customerTypes,
        posSettings:        state.posSettings,
        posShifts:          state.posShifts,
        posSales:           state.posSales,
        posExpenses:        state.posExpenses,
        loadTemplates:      state.loadTemplates,
        deletedShiftIds:    state.deletedShiftIds || [],
        vendorLocations:    state.vendorLocations  || {},
        contrataPayments:   state.contrataPayments || [],
      }),
      // Al rehidratar desde localStorage, filtrar posShifts borrados
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const deleted = state.deletedShiftIds || [];
        if (deleted.length > 0 && state.posShifts?.length > 0) {
          state.posShifts = state.posShifts.filter(s => !deleted.includes(s.id));
        }
      },
    }
  )
);
