import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useAuthStore } from './useAuthStore';
import { useBranchStore } from './useBranchStore';
import { push, pullAll, getBranchKey, BRANCH_KEYS, GLOBAL_KEYS, markAppReady, atomicUpdateItem, atomicAppendItem, atomicRemoveItem } from '../lib/syncManager';
import { markLocalWrite, applyRemoteSnapshot } from '../lib/useRealtimeSync';
import { safeJSONStorage } from '../utils/safeStorage';
import inventoryBackupSeed from '../data/inventoryBackupSeed.json';

// Helper: sincroniza una sección del store con Supabase.
// Para BRANCH_KEYS: si el usuario no tiene sede (Admin, branchId=null),
// usa BRANCH-001 como fallback en lugar de escribir en la llave global.
// Esto previene que el Admin contamine la partición global con datos de sede.
//
// PROTECCIÓN CRÍTICA: Solo permite push si:
//   1. Hay un usuario autenticado con sesión activa (no una rehidratación de localStorage)
//   2. La app está corriendo en el dominio de producción (no localhost ni preview)
//   3. El flag _hasLoadedRemote está activo (ya descargó datos reales de Supabase)
function syncKey(key, value) {
  // Bloqueo 1: Si no hay usuario autenticado, no sincronizar
  const user = useAuthStore.getState().user;
  if (!user || !user.role) {
    console.warn(`[SyncGuard] Push de "${key}" bloqueado: no hay sesión de usuario activa.`);
    return;
  }

  // Bloqueo 2: Si la app no ha terminado de cargar datos remotos, no sincronizar
  // Esto evita que los valores INITIAL_* del código sobreescriban Supabase al arrancar
  const store = useInventoryStore.getState();
  if (!store._hasLoadedRemote && key !== 'posShifts' && !key.startsWith('posShifts_')) {
    console.warn(`[SyncGuard] Push de "${key}" bloqueado: aún no se ha cargado el estado remoto.`);
    return;
  }

  const activeBranchId = useAuthStore.getState().getActiveBranchId();
  const effectiveBranchId = BRANCH_KEYS.includes(key) ? activeBranchId : null;
  const resolvedKey = getBranchKey(key, effectiveBranchId);
  markLocalWrite(key, effectiveBranchId);
  push(key, value, effectiveBranchId).catch(err => console.warn('[Sync]', resolvedKey, err.message));

  if (key === 'inventory' || key === 'products') {
    markLocalWrite(key, null);
    markLocalWrite(key, 'BRANCH-001');
    Promise.allSettled([
      push(key, value, null),
      push(key, value, 'BRANCH-001'),
    ]).catch(() => {});
  }

  // Para BRANCH_KEYS: también actualizar la llave legacy sin sufijo para mantener ambas en 100% sincronía
  if (BRANCH_KEYS.includes(key)) {
    push(key, value, null).catch(() => {});
  }
  // Para GLOBAL_KEYS (customerTypes, customers, etc.): también actualizar la llave de la sede activa si existe
  if (GLOBAL_KEYS.includes(key) && activeBranchId) {
    push(key, value, activeBranchId).catch(() => {});
  }
}

// Helper: realiza un merge inteligente de arrays locales y remotos para evitar
// pérdida de actualizaciones concurrentes (como el cierre de un turno en otro dispositivo)
export function mergeArrays(localArr, remoteArr, key) {
  if (!Array.isArray(localArr)) return remoteArr || [];
  if (!Array.isArray(remoteArr)) return localArr || [];
  
  const remoteById = new Map(remoteArr.filter(x => x?.id).map(x => [x.id, x]));
  const queuedIds = getQueuedOfflineItemIds(key);

  const deletedSales = new Set(useInventoryStore.getState()?.deletedPosSaleIds || []);
  const deletedShifts = new Set(useInventoryStore.getState()?.deletedShiftIds || []);
  const deletedInvs = new Set(useInventoryStore.getState()?.deletedInventoryIds || []);
  const deletedRegs = new Set(useInventoryStore.getState()?.deletedPosRegisterIds || []);
  const deletedBranches = new Set(useBranchStore.getState()?.deletedBranchIds || []);

  const merged = [];
  const addedIds = new Set();

  localArr.forEach(localItem => {
    if (localItem?.id) {
      const remoteVersion = remoteById.get(localItem.id);
      if (remoteVersion) {
        // Reglas de fusión específicas por tipo de datos
        if (key === 'posShifts') {
          if (remoteVersion.closedAt) {
            merged.push(remoteVersion);
          } else if (localItem.closedAt) {
            merged.push(localItem);
          } else {
            merged.push({ ...localItem, ...remoteVersion });
          }
        } else if (key === 'posSales') {
          if (deletedSales.has(localItem.id) || deletedSales.has(remoteVersion.id) || (localItem.originalOlaClickId && deletedSales.has(localItem.originalOlaClickId))) {
            // Ignorar ventas eliminadas
          } else if (remoteVersion.status === 'PAID' || remoteVersion.status === 'REJECTED') {
            merged.push(remoteVersion);
          } else if (localItem.status === 'PAID' || localItem.status === 'REJECTED') {
            merged.push(localItem);
          } else {
            merged.push({ ...localItem, ...remoteVersion });
          }
        } else {
          // Por defecto, remoto gana para actualizaciones (inventarios, productos, etc.)
          merged.push(remoteVersion);
        }
        addedIds.add(localItem.id);
      } else {
        // Solo existe localmente en el localStorage de este dispositivo.
        // PREVENCIÓN DE RESURRECCIÓN: Si no existe en Supabase y NO fue creado offline en este dispositivo,
        // significa que fue ELIMINADO en otro equipo y NO debe ser resucitado ni re-subido a Supabase.
        const isDeletedTombstone =
          deletedSales.has(localItem.id) ||
          deletedShifts.has(localItem.id) ||
          deletedInvs.has(localItem.id) ||
          deletedRegs.has(localItem.id) ||
          deletedBranches.has(localItem.id);

        const isQueuedOffline = queuedIds.has(localItem.id);

        if (!isDeletedTombstone && (isQueuedOffline || key === 'posSales' || key === 'posShifts' || key === 'movements')) {
          merged.push(localItem);
          addedIds.add(localItem.id);
        }
      }
    } else {
      merged.push(localItem);
    }
  });

  remoteArr.forEach(remoteItem => {
    if (remoteItem?.id && !addedIds.has(remoteItem.id)) {
      const isDeletedTombstone =
        (key === 'posSales' && deletedSales.has(remoteItem.id)) ||
        (key === 'posShifts' && deletedShifts.has(remoteItem.id)) ||
        (key === 'inventory' && deletedInvs.has(remoteItem.id)) ||
        (key === 'posRegisters' && deletedRegs.has(remoteItem.id)) ||
        (key === 'branches' && deletedBranches.has(remoteItem.id));

      if (!isDeletedTombstone) {
        merged.push(remoteItem);
        addedIds.add(remoteItem.id);
      }
    }
  });

  return merged;
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

const INITIAL_INVENTORY = [];

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

export const INITIAL_ITEM_TYPES = [
  { id: 'IT-001', name: 'INSUMO', description: 'Materias primas e ingredientes para recetas', isSystem: true, color: 'bg-blue-50 text-blue-500 border border-blue-200' },
  { id: 'IT-002', name: 'PRODUCTO', description: 'Productos terminados o mercancía general', isSystem: true, color: 'bg-green-50 text-green-600 border border-green-200' },
  { id: 'IT-003', name: 'BEBIDA', description: 'Gaseosas, jugos y bebidas', isSystem: true, color: 'bg-cyan-50 text-cyan-600 border border-cyan-200' },
  { id: 'IT-004', name: 'CRUDO', description: 'Masas o preparados congelados pendientes por freír', isSystem: true, color: 'bg-orange-50 text-orange-600 border border-orange-200' },
  { id: 'IT-005', name: 'FRITO', description: 'Productos fritos calientes listos para venta rápida', isSystem: true, color: 'bg-yellow-50 text-yellow-600 border border-yellow-200' },
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
  cashDrawerCode: '27,112,48,55,121',
  supervisorPin: '1234',
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
  inventoryControl: {
    linkProduction: false,       // Ligado de Crudos a Fritos en Producción y Fritado
    linkSalesToInventory: false, // Ligado de Caja POS/Ventas a Inventario (descuento automático)
    strictTricycleStock: false,  // Ligado de stock físico estricto en Triciclos
  },
  layout: {
    gridColumns: 6,
    gridRows: 4,
    showOnlySelected: false,
    selectedProductIds: [],
  },
};

const INITIAL_POS_REGISTERS = [
  { id: 'REG-001', name: 'Caja Principal', active: true, branchId: 'BRANCH-001' },
];

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
      itemTypes:          INITIAL_ITEM_TYPES,
      customers:          INITIAL_CUSTOMERS,
      customerTypes:      INITIAL_CUSTOMER_TYPES,
      posSettings:        INITIAL_POS_SETTINGS,
      posRegisters:       INITIAL_POS_REGISTERS,
      fritadoRecipes:     INITIAL_FRITADO_RECIPES,
      salesGoals:         [],
      movements:          [],
      posShifts:          [],
      posSales:           [],
      posExpenses:        [],
      loadTemplates:      INITIAL_LOAD_TEMPLATES,
      deletedShiftIds:    [],  // tombstone: IDs de cierres eliminados por el admin
      deletedPosSaleIds:  [],  // tombstone: IDs de ventas / pedidos en espera eliminados o procesados
      vendorLocations:    {},  // { [vendorId]: { lat, lng, name, pointId, updatedAt } }
      // Pagos y abonos de clientes contrata
      // { id, customerId, customerName, amount, method, note, shiftId, date }
      contrataPayments:   [],

      // Flag de protección: indica que ya se cargaron datos reales de Supabase.
      // Mientras sea false, syncKey() rechaza todas las escrituras a la nube.
      _hasLoadedRemote: false,

      // ─── CARGA REMOTA NETWORK-FIRST CON CACHÉ OFFLINE DE RESPALDO ───────────
      // ESTRATEGIA:
      // 1. Si HAY internet: Consulta primero a Supabase (Network-First).
      //    Los datos autoritativos de la nube REEMPLAZAN el estado local de localStorage.
      // 2. Si NO HAY internet (offline): Captura el error y usa el respaldo local
      //    guardado en localStorage para permitir operar sin interrupción.
      loadFromRemote: async () => {
        if (sessionStorage.getItem('__reset_done__') === '1') {
          sessionStorage.removeItem('__reset_done__');
          console.log('[Store] Reset recién ejecutado — omitiendo carga remota.');
          return;
        }
        try {
          console.log('[SyncEngine] 🌐 Iniciando verificación Network-First en Supabase...');
          const user = useAuthStore.getState().user;
          const isAdmin = user?.role === 'ADMIN';
          const branchId = isAdmin ? null : (user?.branchId || 'BRANCH-001');

          // Obtener IDs de todas las sedes para el Admin
          let allBranchIds = ['BRANCH-001'];
          try {
            allBranchIds = useBranchStore.getState().branches.map(b => b.id);
          } catch { /* useBranchStore puede no estar listo aún */ }

          const remote = await pullAll(branchId, allBranchIds);

          // Rehidratar inmediatamente TODOS los stores de la aplicación con el snapshot fresco de la nube
          if (remote && Object.keys(remote).length > 0) {
            applyRemoteSnapshot(remote, branchId, allBranchIds);
          }

          // Llaves globales — se aplican directamente al store
          const GLOBAL_STORE_KEYS = [
            'products', 'recipes', 'fritadoRecipes', 'posCategories', 'itemTypes', 'customers', 'customerTypes', 'salesGoals', 'posRegisters', 'deletedPosRegisterIds',
          ];

          // Llaves locales de sede — mapeamos su nombre con sufijo al nombre del store
          const BRANCH_STORE_KEYS = [
            'warehouses', 'inventory', 'movements',
            'posShifts', 'posSales', 'posExpenses', 'posRegisters', 'posSettings',
            'contrataPayments', 'deletedShiftIds', 'deletedInventoryIds', 'deletedPosSaleIds',
            'loadTemplates', 'vendorLocations',
          ];

          const updates = {};

          // ════════════════════════════════════════════════════════════════════
          // REGLA DE ORO: Si Supabase tiene datos para una llave, esos datos
          // REEMPLAZAN completamente el estado local (que viene de INITIAL_*).
          // NO se mezclan. Esto previene que datos de demo/plantilla del código
          // contaminen las configuraciones reales del usuario.
          //
          // Excepción: datos creados offline (que no están en Supabase porque
          // no se han sincronizado aún). Estos se preservan SOLO si no tienen
          // un ID que coincida con los INITIAL_* del código fuente.
          // ════════════════════════════════════════════════════════════════════

          // IDs conocidos de datos de plantilla/demo del código fuente
          // Si un ítem local tiene uno de estos IDs, es de DEMO y debe descartarse
          const DEMO_IDS = new Set([
            // Bodegas demo
            'BOD-001', 'BOD-002', 'BOD-003',
            // Puntos de producción demo
            'PP-001', 'PP-002', 'PP-003',
            // Cocinas demo
            'FK-001', 'FK-002',
            // Inventario demo
            'INS-001','INS-002','INS-003','INS-004','INS-005','INS-006','INS-007','INS-008',
            'PRD-001','PRD-002','PRD-003','PRD-004','PRD-005','PRD-006','PRD-RAW-005','PRD-RAW-006',
            // Productos demo
            'P-001','P-002','P-003','P-004',
            // Recetas demo
            'R-001','R-002','R-003','R-004',
            // Fritado demo
            'FR-001','FR-002',
            // Categorías POS demo
            'CAT-001','CAT-002','CAT-003',
            // Tipos de Ítem demo
            'IT-001','IT-002','IT-003','IT-004','IT-005',
            // Clientes demo
            'CUST-002',
            // Tipos de cliente demo
            'CTYPE-001','CTYPE-002',
            // Registros de caja demo
            'REG-001',
          ]);

          // Procesar llaves globales — REMOTO REEMPLAZA LOCAL
          for (const key of GLOBAL_STORE_KEYS) {
            const branchKeyName = branchId ? `${key}_${branchId}` : null;
            const branchVal = branchKeyName ? remote[branchKeyName] : null;
            const val = branchVal !== undefined && branchVal !== null ? branchVal : remote[key];
            if (val !== undefined && val !== null) {
              if (Array.isArray(val)) {
                // Tomar los datos remotos como base
                const remoteIds = new Set(val.filter(x => x?.id).map(x => x.id));
                const deletedRegs = new Set(get().deletedPosRegisterIds || []);
                // Preservar SOLO ítems locales creados por el usuario que NO están en remoto,
                // que NO son datos de demo del código fuente y que NO han sido borrados
                const localArr = get()[key] || [];
                const userCreatedOffline = localArr.filter(item =>
                  item?.id && !remoteIds.has(item.id) && !DEMO_IDS.has(item.id) && !deletedRegs.has(item.id)
                );
                let finalArr = [...val, ...userCreatedOffline];
                if (key === 'posRegisters') {
                  finalArr = finalArr.filter(r => !deletedRegs.has(r.id));
                }
                updates[key] = finalArr;
              } else {
                updates[key] = val;
              }
            }
          }

          // Procesar llaves de sede
          if (branchId) {
            // Usuario de sede: cargar solo su sede
            const effectiveBranch = branchId;
            const deletedShifts = get().deletedShiftIds || [];
            const deletedInv = get().deletedInventoryIds || [];
            const deletedRegs = new Set(get().deletedPosRegisterIds || []);

            for (const key of BRANCH_STORE_KEYS) {
              const branchKeyName = `${key}_${effectiveBranch}`;
              const rawBranchVal = remote[branchKeyName];
              let val = rawBranchVal !== undefined && rawBranchVal !== null ? rawBranchVal : remote[key];
              if (Array.isArray(rawBranchVal) || Array.isArray(remote[key])) {
                const combinedMap = new Map();
                if (Array.isArray(remote[key])) {
                  remote[key].forEach(item => { if (item?.id) combinedMap.set(item.id, item); });
                }
                if (Array.isArray(rawBranchVal)) {
                  rawBranchVal.forEach(item => {
                    if (item?.id) {
                      const existing = combinedMap.get(item.id);
                      if (!existing || (!existing.closedAt && item.closedAt)) {
                        combinedMap.set(item.id, item);
                      }
                    }
                  });
                }
                if (key === 'posShifts' && Array.isArray(remote['posShifts_master_history'])) {
                  remote['posShifts_master_history'].forEach(item => {
                    if (item?.id) {
                      const existing = combinedMap.get(item.id);
                      if (!existing || (!existing.closedAt && item.closedAt)) {
                        combinedMap.set(item.id, item);
                      }
                    }
                  });
                }
                val = Array.from(combinedMap.values());
              }
              if (val !== undefined && val !== null) {
                if (Array.isArray(val)) {
                  // Remoto reemplaza local; preservar solo offline genuinos
                  const remoteIds = new Set(val.filter(x => x?.id).map(x => x.id));
                  // Mapa de turnos remotos por ID para comparar estado de cierre
                  const remoteById = new Map(val.filter(x => x?.id).map(x => [x.id, x]));
                  const localArr = get()[key] || [];
                  const userCreatedOffline = localArr.filter(item => {
                    if (!item?.id || DEMO_IDS.has(item.id) || deletedRegs.has(item.id)) return false;
                    if (remoteIds.has(item.id)) return false; // ya en remoto, no duplicar
                    // Para posShifts: verificar que no sea un residuo cerrado en remoto
                    if (key === 'posShifts') {
                      // 1. Si el item local está "abierto" pero existe una versión cerrada en cualquier fuente remota, NO incluir
                      const allRemoteSources = [
                        ...(remote['posShifts'] || []),
                        ...(remote['posShifts_BRANCH-001'] || []),
                        ...(remote['posShifts_master_history'] || []),
                      ];
                      const remoteVersion = allRemoteSources.find(r => r?.id === item.id);
                      if (remoteVersion?.closedAt && !item.closedAt) return false; // remoto cerrado gana

                      // 3. Si en remoto ya hay un turno activo para ese mismo vehículo hoy, el remoto manda
                      if (!item.closedAt && item.pointId) {
                        const cleanP = String(item.pointId).toLowerCase().replace(/[^a-z0-9]/g, '');
                        const remoteHasPoint = val.some(r =>
                          !r.closedAt && String(r.pointId || '').toLowerCase().replace(/[^a-z0-9]/g, '') === cleanP
                        );
                        if (remoteHasPoint) return false;
                      }
                    }
                    return true;
                  });
                  let finalVal = [...val, ...userCreatedOffline];
                  // Aplicar tombstones
                  if (key === 'posShifts') finalVal = finalVal.filter(s => !deletedShifts.includes(s.id));
                  if (key === 'inventory') {
                    // 🛡️ Filtro de seguridad: preserte productos activos de triciclos frente a tombstones viejos
                    finalVal = finalVal.filter(i => {
                      if (!i?.id) return false;
                      if (i.inTricycles === true || String(i.inTricycles) === 'true' || i.showInTricicloPos === true) return true;
                      return !deletedInv.includes(i.id);
                    });
                  }
                  if (key === 'posRegisters') finalVal = finalVal.filter(r => !deletedRegs.has(r.id));
                  updates[key] = finalVal;
                } else {
                  // Objetos (posSettings, etc.): remoto GANA siempre
                  updates[key] = val;
                }
              }
            }
            console.log('[Store] Cargado desde Supabase (sede:', effectiveBranch, '):', Object.keys(updates));
          } else {
            // Admin carga y fusiona datos de TODAS las sedes
            const deleted = get().deletedShiftIds || [];
            const deletedRegs = new Set(get().deletedPosRegisterIds || []);
            const mergedArrayKeys = ['inventory', 'warehouses', 'posShifts', 'posSales', 'posExpenses', 'movements', 'contrataPayments', 'posRegisters', 'deletedShiftIds', 'deletedInventoryIds', 'deletedPosSaleIds', 'deletedPosRegisterIds'];
            for (const key of BRANCH_STORE_KEYS) {
              let merged = [];
              const addedIds = new Set();

              // 1. PRIMERO cargar llaves específicas de sede (tienen máxima prioridad sobre llaves legacy)
              for (const bId of allBranchIds) {
                const branchKeyName = `${key}_${bId}`;
                const val = remote[branchKeyName];
                if (Array.isArray(val) && val.length > 0) {
                  val.forEach(item => {
                    if (item?.id && !addedIds.has(item.id)) {
                      merged.push(item);
                      addedIds.add(item.id);
                    }
                  });
                } else if (val && typeof val === 'object' && !Array.isArray(val)) {
                  // Objetos (posSettings, etc.): usar solo la sede activa
                  const activeBranch = useAuthStore.getState().getActiveBranchId() || 'BRANCH-001';
                  if (bId === activeBranch || !updates[key]) {
                    updates[key] = val;
                  }
                }
              }

              // 2. LUEGO incluir ítems de la llave legacy (sin sufijo) SOLO si no estaban ya en la llave de sede
              if (remote[key] && Array.isArray(remote[key])) {
                remote[key].forEach(item => {
                  if (item?.id && !addedIds.has(item.id)) {
                    merged.push(item);
                    addedIds.add(item.id);
                  }
                });
              }

              // 3. Respaldo permanente posShifts_master_history para posShifts
              if (key === 'posShifts' && Array.isArray(remote['posShifts_master_history'])) {
                remote['posShifts_master_history'].forEach(item => {
                  if (item?.id && !addedIds.has(item.id)) {
                    merged.push(item);
                    addedIds.add(item.id);
                  }
                });
              }

              if (mergedArrayKeys.includes(key) && merged.length > 0) {
                if (key === 'posShifts') {
                  merged = merged.filter(s => !deleted.includes(s.id));

                  // Auto-cerrar borradores abiertos si el vehículo ya fue cerrado en esa fecha
                  const closedTimesByPointDate = new Map();
                  merged.forEach(s => {
                    if (s.closedAt && s.pointId) {
                      const cP = String(s.pointId).toLowerCase().replace(/[^a-z0-9]/g, '');
                      const cD = s.closedAt.slice(0, 10);
                      closedTimesByPointDate.set(`${cP}_${cD}`, s.closedAt);
                    }
                  });

                  const today = new Date().toISOString().slice(0, 10);
                  merged = merged.map(s => {
                    if (!s.closedAt) {
                      if (s.pointId) {
                        const cP = String(s.pointId).toLowerCase().replace(/[^a-z0-9]/g, '');
                        const cD = s.openedAt ? s.openedAt.slice(0, 10) : (s.fecha || '');
                        const matchingClosedAt = closedTimesByPointDate.get(`${cP}_${cD}`);
                        if (matchingClosedAt) {
                          const sOpenTime = new Date(s.openedAt || 0).getTime();
                          const closedTime = new Date(matchingClosedAt).getTime();
                          // Solo auto-cerrar si la apertura fue ANTES del cierre registrado (borrador viejo)
                          if (sOpenTime < closedTime) {
                            return { ...s, closedAt: matchingClosedAt };
                          }
                        }
                      }
                      const shiftDate = (s.openedAt || s.fecha || s.date || '').slice(0, 10);
                      if (shiftDate && shiftDate < today) {
                        return { ...s, closedAt: s.openedAt || new Date().toISOString(), _autoClosedStale: true };
                      }
                    }
                    return s;
                  });

                  const shiftMap = new Map();
                  merged.forEach(s => {
                    const shiftKey = s.id || `${s.pointId}_${s.responsibleName}_${s.openedAt}`;
                    const existing = shiftMap.get(shiftKey);
                    if (!existing) {
                      shiftMap.set(shiftKey, s);
                    } else if (!s.closedAt && existing.closedAt) {
                      // La versión ABIERTA prevalece sobre la cerrada
                      shiftMap.set(shiftKey, s);
                    } else if (!existing.closedAt && s.closedAt) {
                      // Mantener la versión ABIERTA si la versión cerrada no fue abierta después
                      const sOpen = new Date(s.openedAt || 0).getTime();
                      const exOpen = new Date(existing.openedAt || 0).getTime();
                      if (sOpen > exOpen) {
                        shiftMap.set(shiftKey, s);
                      }
                    } else if (existing.closedAt && s.closedAt) {
                      if (new Date(s.closedAt).getTime() > new Date(existing.closedAt).getTime()) {
                        shiftMap.set(shiftKey, s);
                      }
                    }
                  });
                  merged = Array.from(shiftMap.values());
                }
                if (key === 'posRegisters') merged = merged.filter(r => !deletedRegs.has(r.id));
                if (key === 'deletedInventoryIds') {
                  const localDeleted = get().deletedInventoryIds || [];
                  merged = [...new Set([...merged, ...localDeleted])];
                }
                if (key === 'deletedPosRegisterIds') {
                  const localDeleted = get().deletedPosRegisterIds || [];
                  merged = [...new Set([...merged, ...localDeleted])];
                }
                updates[key] = merged;
              } else if (merged.length > 0 && !updates[key]) {
                updates[key] = merged;
              }
            }
            console.log('[Store] Admin: cargado desde Supabase (todas las sedes):', Object.keys(updates));
          }

          // Carga estricta de inventario desde Supabase: filtrar siempre los productos demo de la plantilla inicial
          const DEMO_PRD_SET = new Set(['PRD-001', 'PRD-002', 'PRD-003', 'PRD-004', 'PRD-005', 'PRD-006', 'PRD-RAW-005', 'PRD-RAW-006']);
          if (updates.inventory && Array.isArray(updates.inventory)) {
            const deletedInvIds = get().deletedInventoryIds || [];
            updates.inventory = updates.inventory.filter(i => {
              if (!i?.id || DEMO_PRD_SET.has(i.id)) return false;
              if (i.inTricycles === true || String(i.inTricycles) === 'true' || i.showInTricicloPos === true) return true;
              return !deletedInvIds.includes(i.id);
            });
          } else if (get().inventory && get().inventory.length > 0) {
            const localInv = get().inventory.filter(i => i?.id && !DEMO_PRD_SET.has(i.id));
            updates.inventory = localInv;
          }

          if (Object.keys(updates).length > 0) {
            set(updates);
          }

          // Activar el flag de protección: a partir de aquí syncKey() permite escrituras
          set({ _hasLoadedRemote: true });
          markAppReady();
          console.log('[SyncGuard] ✅ Carga remota completada — escrituras a Supabase habilitadas.');
        } catch (err) {
          console.warn('[Store] No se pudo cargar estado remoto:', err.message);
          // Incluso si falla la carga remota, activar el flag para no bloquear la operación
          // del usuario para siempre. El usuario puede seguir trabajando offline.
          set({ _hasLoadedRemote: true });
          markAppReady();
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
      getPosItems: () => {
        const DEMO_PRD_IDS = new Set(['PRD-001', 'PRD-002', 'PRD-003', 'PRD-004', 'PRD-005', 'PRD-006', 'PRD-RAW-005', 'PRD-RAW-006']);
        return get().inventory.filter(
          (i) => i.type !== 'INSUMO' && i.inTricycles === true && !DEMO_PRD_IDS.has(i.id)
        );
      },

      /**
       * Productos del flujo logístico del Dejador (Surtir + Recibir) y Pedir Surtido del Vendedor.
       * Incluye los productos agregados en Admin ➔ Productos Triciclos (inTricycles === true)
       * Y GARANTIZA la inclusión de insumos 'No POS' de la flota (Vasos 10 OZ, Vasos 7 Onzas, Cambio).
       * Excluye únicamente ítems 'Solo POS' (showInTricicloPos === true, ej: Café, Limonada) y materias primas de bodega.
       */
      getDeliveryItems: () => {
        let inv = get().inventory || [];
        if (!inv || inv.length === 0) {
          inv = inventoryBackupSeed || [];
        }
        const DEMO_PRD_IDS = new Set(['PRD-001', 'PRD-002', 'PRD-003', 'PRD-004', 'PRD-005', 'PRD-006', 'PRD-RAW-005', 'PRD-RAW-006']);
        const NON_PHYSICAL_SERVICES = new Set(['Bebida No Guardada', 'Domicilio Transferencia', 'Producto No Registrado']);

        const isDeliveryItem = (i) => {
          if (!i || !i.id || DEMO_PRD_IDS.has(i.id)) return false;
          if (NON_PHYSICAL_SERVICES.has(i.name?.trim())) return false;
          if (i.active === false || String(i.active) === 'false') return false;

          const nameClean = String(i.name || '').toLowerCase().trim();

          // 🥤 Vasos y 💵 Cambio SIEMPRE deben estar disponibles para Pedir Surtido y Surtir
          if (nameClean.includes('vaso') || nameClean.includes('cambio')) {
            return true;
          }

          // Excluir de Surtir/Pedir los productos etiquetados 'Solo POS' ("Exclusivo POS / Dejador no surte")
          if (i.showInTricicloPos === true || String(i.showInTricicloPos) === 'true') return false;

          // Incluir productos de flota (inTricycles === true) O insumos de flota No POS (showInPos === false)
          const isTricycleItem =
            i.inTricycles === true ||
            String(i.inTricycles) === 'true' ||
            i.showInPos === false ||
            String(i.showInPos) === 'false';

          return isTricycleItem;
        };

        let filtered = inv.filter(isDeliveryItem);

        if (filtered.length === 0) {
          filtered = (inventoryBackupSeed || []).filter(isDeliveryItem);
        }

        return filtered || [];
      },

      /**
       * Productos del POS del Vendedor de triciclo (Venta Rápida).
       * Incluye estrictamente los productos de venta autorizados por el Admin (inTricycles === true, excluye showInPos: false).
       */
      getVendedorPosItems: () => {
        let inv = get().inventory || [];
        if (!inv || inv.length === 0) {
          inv = inventoryBackupSeed || [];
        }
        const DEMO_PRD_IDS = new Set(['PRD-001', 'PRD-002', 'PRD-003', 'PRD-004', 'PRD-005', 'PRD-006', 'PRD-RAW-005', 'PRD-RAW-006']);

        let filtered = inv.filter((i) => {
          if (!i || DEMO_PRD_IDS.has(i.id) || i.type === 'INSUMO' || i.showInPos === false) return false;
          return i.inTricycles === true || i.inTricycles === 'true';
        });

        if (filtered.length === 0) {
          filtered = (inventoryBackupSeed || []).filter((i) => {
            if (!i || DEMO_PRD_IDS.has(i.id) || i.type === 'INSUMO' || i.showInPos === false) return false;
            return i.inTricycles === true || i.inTricycles === 'true';
          });
        }

        return filtered || [];
      },


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

        const linkProduction = get().posSettings?.inventoryControl?.linkProduction ?? false;

        if (linkProduction) {
          const { canProduce, missing } = get().checkStock(recipe.id, batches);
          if (!canProduce) {
            const detail = missing.map(
              (m) => `${m.name}: necesitas ${m.need.toFixed(2)} ${m.unit}, hay ${m.have.toFixed(2)}`
            ).join('\n');
            return { ok: false, message: `Insumos insuficientes:\n${detail}` };
          }
        }

        const produced = recipe.yieldQty * batches;

        set((state) => {
          // 1. Descontar insumos (solo si está ligado)
          let newInventory = state.inventory;
          if (linkProduction) {
            newInventory = state.inventory.map((item) => {
              const ingredient = recipe.ingredients.find((i) => i.inventoryId === item.id);
              if (ingredient) {
                return { ...item, qty: Math.max(0, +(item.qty - (ingredient.qty * batches)).toFixed(3)) };
              }
              return item;
            });
          }

          // 2. Sumar al producto terminado
          const outputId = product?.outputInventoryId;
          const targetItemIndex = newInventory.findIndex(
            (item) => (outputId && item.id === outputId) || (!outputId && item.type === 'PRODUCTO' && item.name === product.name)
          );

          if (targetItemIndex !== -1) {
            const targetItem = newInventory[targetItemIndex];
            newInventory[targetItemIndex] = {
              ...targetItem,
              qty: +(targetItem.qty + produced).toFixed(3)
            };
          } else {
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

        const linkProduction = get().posSettings?.inventoryControl?.linkProduction ?? false;

        if (linkProduction) {
          if (!rawItem || rawItem.qty < qty) {
             return { ok: false, message: `No hay suficiente stock de ${rawItem?.name ?? 'crudo'} (Disponible: ${rawItem?.qty ?? 0}).` };
          }
        }
        if (!fritoItem) {
           return { ok: false, message: 'Producto frito destino no encontrado.' };
        }

        set((state) => {
          const newInventory = state.inventory.map(i => {
            if (i.id === rawInventoryId && linkProduction) return { ...i, qty: +(i.qty - qty).toFixed(3) };
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
      addFryKitchen: (fk) => {
        const user = useAuthStore.getState().user;
        const branchId = fk.branchId || user?.branchId || 'BRANCH-001';
        set((s) => ({
          fryKitchens: [...(s.fryKitchens || []), { ...fk, id: `FK-${Date.now()}`, active: true, branchId }],
        }));
      },
      updateFryKitchen: (id, data) => set((s) => ({
        fryKitchens: (s.fryKitchens || []).map((k) => k.id === id ? { ...k, ...data } : k),
      })),
      deleteFryKitchen: (id) => set((s) => ({
        fryKitchens: (s.fryKitchens || []).filter((k) => k.id !== id),
      })),

      // Inventario
      addInventoryItem: (item) => {
        const prefix = item.type === 'FRITO' ? 'FR' : item.type === 'BEBIDA' ? 'BEB' : item.type === 'PRODUCTO' ? 'PRD' : 'INS';
        const newItem = {
          inTricycles: item.inTricycles === true,
          ...item,
          id: `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
          qty: parseFloat(item.qty) || 0
        };
        set((s) => ({ inventory: [...s.inventory, newItem] }));
        syncKey('inventory', useInventoryStore.getState().inventory);
        atomicAppendItem('inventory', null, newItem);
        atomicAppendItem('inventory', 'BRANCH-001', newItem);
      },
      setInventory: (newInventory) => {
        set({ inventory: newInventory });
        syncKey('inventory', newInventory);
      },
      updateInventoryItem: (id, data) => {
        set((s) => ({ inventory: s.inventory.map((i) => i.id === id ? { ...i, ...data } : i) }));
        const updatedItem = useInventoryStore.getState().inventory.find(i => i.id === id);
        syncKey('inventory', useInventoryStore.getState().inventory);
        atomicUpdateItem('inventory', null, id, data);
        atomicUpdateItem('inventory', 'BRANCH-001', id, data);
      },
      deleteInventoryItem: (id) => {
        set((s) => ({
          inventory: s.inventory.filter((i) => i.id !== id),
          deletedInventoryIds: [...new Set([...(s.deletedInventoryIds || []), id])]
        }));
        syncKey('inventory', useInventoryStore.getState().inventory);
        syncKey('deletedInventoryIds', useInventoryStore.getState().deletedInventoryIds);
        atomicRemoveItem('inventory', null, id);
        atomicRemoveItem('inventory', 'BRANCH-001', id);
      },

      // Productos
      addProduct: (p) => { set((s) => ({ products: [...s.products, { ...p, id: `P-${Date.now()}` }] })); syncKey('products', useInventoryStore.getState().products); },
      updateProduct: (id, data) => { set((s) => ({ products: s.products.map((p) => p.id === id ? { ...p, ...data } : p) })); syncKey('products', useInventoryStore.getState().products); },
      deleteProduct: (id) => { set((s) => ({ products: s.products.filter((p) => p.id !== id) })); syncKey('products', useInventoryStore.getState().products); },

      // Recetas
      addRecipe: (r) => { set((s) => ({ recipes: [...s.recipes, { ...r, id: `R-${Date.now()}` }] })); syncKey('recipes', useInventoryStore.getState().recipes); },
      updateRecipe: (id, data) => { set((s) => ({ recipes: s.recipes.map((r) => r.id === id ? { ...r, ...data } : r) })); syncKey('recipes', useInventoryStore.getState().recipes); },
      deleteRecipe: (id) => { set((s) => ({ recipes: s.recipes.filter((r) => r.id !== id) })); syncKey('recipes', useInventoryStore.getState().recipes); },

      // POS Categorías
      addPosCategory: (c) => { set((s) => ({ posCategories: [...(s.posCategories || []), { ...c, id: `CAT-${Date.now()}` }] })); syncKey('posCategories', useInventoryStore.getState().posCategories); },
      updatePosCategory: (id, data) => { set((s) => ({ posCategories: (s.posCategories || []).map((c) => c.id === id ? { ...c, ...data } : c) })); syncKey('posCategories', useInventoryStore.getState().posCategories); },
      deletePosCategory: (id) => { set((s) => ({ posCategories: (s.posCategories || []).filter((c) => c.id !== id) })); syncKey('posCategories', useInventoryStore.getState().posCategories); },

      // Tipos de Ítem Personalizados
      addItemType: (typeData) => {
        const name = typeData.name ? typeData.name.toUpperCase().trim() : '';
        if (!name) return;
        set((s) => ({ itemTypes: [...(s.itemTypes || INITIAL_ITEM_TYPES), { ...typeData, id: `IT-${Date.now()}`, name, isSystem: false }] }));
        syncKey('itemTypes', useInventoryStore.getState().itemTypes);
      },
      updateItemType: (id, data) => {
        set((s) => ({ itemTypes: (s.itemTypes || INITIAL_ITEM_TYPES).map((t) => t.id === id ? { ...t, ...data } : t) }));
        syncKey('itemTypes', useInventoryStore.getState().itemTypes);
      },
      deleteItemType: (id) => {
        set((s) => ({ itemTypes: (s.itemTypes || INITIAL_ITEM_TYPES).filter((t) => t.id !== id || t.isSystem) }));
        syncKey('itemTypes', useInventoryStore.getState().itemTypes);
      },

      // Metas de Venta
      addSalesGoal: (g) => { set((s) => ({ salesGoals: [...(s.salesGoals || []), { ...g, id: `GOAL-${Date.now()}` }] })); syncKey('salesGoals', useInventoryStore.getState().salesGoals); },
      updateSalesGoal: (id, data) => { set((s) => ({ salesGoals: (s.salesGoals || []).map((g) => g.id === id ? { ...g, ...data } : g) })); syncKey('salesGoals', useInventoryStore.getState().salesGoals); },
      deleteSalesGoal: (id) => { set((s) => ({ salesGoals: (s.salesGoals || []).filter((g) => g.id !== id) })); syncKey('salesGoals', useInventoryStore.getState().salesGoals); },

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
      addCustomerType: (typeData) => { set((state) => ({ customerTypes: [...(state.customerTypes || []), { ...typeData, id: `CTYPE-${Date.now()}` }] })); syncKey('customerTypes', useInventoryStore.getState().customerTypes); },
      updateCustomerType: (id, updates) => { set((state) => ({ customerTypes: (state.customerTypes || []).map(c => c.id === id ? { ...c, ...updates } : c) })); syncKey('customerTypes', useInventoryStore.getState().customerTypes); },
      deleteCustomerType: (id) => { set((state) => ({ customerTypes: (state.customerTypes || []).filter(c => c.id !== id), customers: (state.customers || []).map(c => c.typeId === id ? { ...c, typeId: null } : c) })); syncKey('customerTypes', useInventoryStore.getState().customerTypes); },

      // Configuración POS y Global settings
      updatePosSettings: (data) => { set((s) => ({ posSettings: { ...(s.posSettings || INITIAL_POS_SETTINGS), ...data, _updatedAt: new Date().toISOString() } })); syncKey('posSettings', useInventoryStore.getState().posSettings); },

      // Registros de Caja (Multi-Caja)
      addPosRegister: (reg) => { set((s) => ({ posRegisters: [...(s.posRegisters || INITIAL_POS_REGISTERS), { ...reg, id: `REG-${Date.now()}`, active: true }] })); syncKey('posRegisters', useInventoryStore.getState().posRegisters); },
      updatePosRegister: (id, data) => { set((s) => ({ posRegisters: (s.posRegisters || []).map(r => r.id === id ? { ...r, ...data } : r) })); syncKey('posRegisters', useInventoryStore.getState().posRegisters); },
      deletePosRegister: (id) => {
        set((s) => {
          const updatedRegisters = (s.posRegisters || []).filter(r => r.id !== id);
          const newDeleted = [...new Set([...(s.deletedPosRegisterIds || []), id])];
          return { posRegisters: updatedRegisters, deletedPosRegisterIds: newDeleted };
        });
        syncKey('posRegisters', useInventoryStore.getState().posRegisters);
        syncKey('deletedPosRegisterIds', useInventoryStore.getState().deletedPosRegisterIds);
      },

      // Fritado Recipes
      addFritadoRecipe: (recipe) => { set((s) => ({ fritadoRecipes: [...(s.fritadoRecipes || []), { ...recipe, id: `FR-${Date.now()}` }] })); syncKey('fritadoRecipes', useInventoryStore.getState().fritadoRecipes); },
      updateFritadoRecipe: (id, data) => { set((s) => ({ fritadoRecipes: (s.fritadoRecipes || []).map(r => r.id === id ? { ...r, ...data } : r) })); syncKey('fritadoRecipes', useInventoryStore.getState().fritadoRecipes); },
      deleteFritadoRecipe: (id) => { set((s) => ({ fritadoRecipes: (s.fritadoRecipes || []).filter(r => r.id !== id) })); syncKey('fritadoRecipes', useInventoryStore.getState().fritadoRecipes); },

      // Plantillas de Carga / Surtido
      addLoadTemplate: (template) => { set((s) => ({ loadTemplates: [...(s.loadTemplates || []), { ...template, id: `TPL-${Date.now()}` }] })); syncKey('loadTemplates', useInventoryStore.getState().loadTemplates); },
      updateLoadTemplate: (id, updates) => { set((s) => ({ loadTemplates: (s.loadTemplates || []).map(t => t.id === id ? { ...t, ...updates } : t) })); syncKey('loadTemplates', useInventoryStore.getState().loadTemplates); },
      deleteLoadTemplate: (id) => { set((s) => ({ loadTemplates: (s.loadTemplates || []).filter(t => t.id !== id) })); syncKey('loadTemplates', useInventoryStore.getState().loadTemplates); },

      // Ventas / Caja
      addPosSale: (sale) => {
        set((s) => {
          const saleId = sale.id || `SALE-${Date.now()}`;
          const updatedSales = [{ ...sale, id: saleId }, ...(s.posSales || []).filter(item => item.id !== saleId)];
          let newInventory = s.inventory;
          const linkSales = s.posSettings?.inventoryControl?.linkSalesToInventory ?? false;
          if (linkSales && sale.items && sale.status === 'PAID') {
            newInventory = s.inventory.map(invItem => {
              const soldItem = sale.items.find(i => String(i.productId || i.id) === String(invItem.id));
              if (soldItem) {
                return { ...invItem, qty: Math.max(0, +(invItem.qty - (soldItem.qty || 1)).toFixed(3)) };
              }
              return invItem;
            });
          }
          // Limpiar de deletedPosSaleIds para asegurar que no quede bloqueada si era una venta en espera re-guardada
          const newDeleted = (s.deletedPosSaleIds || []).filter(dId => dId !== saleId && dId !== sale.originalOlaClickId && dId !== sale.publicId);
          return { posSales: updatedSales, inventory: newInventory, deletedPosSaleIds: newDeleted };
        });
        syncKey('posSales', useInventoryStore.getState().posSales);
        syncKey('inventory', useInventoryStore.getState().inventory);
        syncKey('deletedPosSaleIds', useInventoryStore.getState().deletedPosSaleIds);
      },
      updatePosSale: (id, data) => {
        set((s) => {
          const linkSales = s.posSettings?.inventoryControl?.linkSalesToInventory ?? false;
          let newInventory = s.inventory;
          const updatedSales = (s.posSales || []).map((sale) => {
            if (sale.id === id) {
              const wasPaid = sale.status === 'PAID';
              const isPaid = (data.status || sale.status) === 'PAID';

              if (linkSales) {
                // Caso A: De suspendida a pagada (descontar inventario)
                if (!wasPaid && isPaid) {
                  const saleItems = data.items || sale.items || [];
                  newInventory = newInventory.map(invItem => {
                    const soldItem = saleItems.find(i => String(i.productId || i.id) === String(invItem.id));
                    if (soldItem) {
                      return { ...invItem, qty: Math.max(0, +(invItem.qty - (soldItem.qty || 1)).toFixed(3)) };
                    }
                    return invItem;
                  });
                } 
                // Caso B: Venta ya pagada que se edita (revertir cantidades viejas y descontar las nuevas)
                else if (wasPaid && isPaid && data.items) {
                  // 1. Devolver items viejos
                  let tempInv = newInventory.map(invItem => {
                    const oldSoldItem = sale.items.find(i => String(i.productId || i.id) === String(invItem.id));
                    if (oldSoldItem) {
                      return { ...invItem, qty: +(invItem.qty + (oldSoldItem.qty || 0)).toFixed(3) };
                    }
                    return invItem;
                  });
                  // 2. Restar items nuevos
                  newInventory = tempInv.map(invItem => {
                    const newSoldItem = data.items.find(i => String(i.productId || i.id) === String(invItem.id));
                    if (newSoldItem) {
                      return { ...invItem, qty: Math.max(0, +(invItem.qty - (newSoldItem.qty || 0)).toFixed(3)) };
                    }
                    return invItem;
                  });
                }
              }
              let updatedSale = { ...sale, ...data };
              if (sale.contrataPaymentMethod === 'credit' && data.total !== undefined && data.creditAmount === undefined) {
                updatedSale.creditAmount = data.total;
              }

              // Registrar historial de modificaciones (cambios)
              const oldItems = sale.items || [];
              const oldTotal = sale.total || 0;
              const oldPaymentMethod = sale.paymentMethod || '';
              const oldDiscount = sale.discountAmount || 0;
              const oldCustomerId = sale.customerId || null;

              const hasItemsChanged = data.items && JSON.stringify(oldItems) !== JSON.stringify(data.items);
              const hasTotalChanged = data.total !== undefined && oldTotal !== data.total;
              const hasPaymentMethodChanged = data.paymentMethod !== undefined && oldPaymentMethod !== data.paymentMethod;
              const hasDiscountChanged = data.discountAmount !== undefined && oldDiscount !== data.discountAmount;
              const hasCustomerChanged = data.customerId !== undefined && oldCustomerId !== data.customerId;

              if (hasItemsChanged || hasTotalChanged || hasPaymentMethodChanged || hasDiscountChanged || hasCustomerChanged) {
                const editRecord = {
                  editedAt: new Date().toISOString(),
                  before: {
                    items: oldItems.map(i => ({ ...i })),
                    total: oldTotal,
                    paymentMethod: oldPaymentMethod,
                    discountAmount: oldDiscount,
                    customerId: oldCustomerId
                  },
                  after: {
                    items: (data.items || oldItems).map(i => ({ ...i })),
                    total: data.total !== undefined ? data.total : oldTotal,
                    paymentMethod: data.paymentMethod || oldPaymentMethod,
                    discountAmount: data.discountAmount !== undefined ? data.discountAmount : oldDiscount,
                    customerId: data.customerId !== undefined ? data.customerId : oldCustomerId
                  }
                };
                updatedSale.editHistory = [...(sale.editHistory || []), editRecord];
              }

              return updatedSale;
            }
            return sale;
          });
          const newDeleted = (s.deletedPosSaleIds || []).filter(dId => dId !== id && dId !== data.originalOlaClickId && dId !== data.publicId);
          return { posSales: updatedSales, inventory: newInventory, deletedPosSaleIds: newDeleted };
        });
        syncKey('posSales', useInventoryStore.getState().posSales);
        syncKey('inventory', useInventoryStore.getState().inventory);
        syncKey('deletedPosSaleIds', useInventoryStore.getState().deletedPosSaleIds);
      },
      deletePosSale: (id) => {
        set((s) => {
          const saleToDelete = (s.posSales || []).find((sale) => sale.id === id || sale.originalOlaClickId === id);
          let newInventory = s.inventory;
          const linkSales = s.posSettings?.inventoryControl?.linkSalesToInventory ?? false;
          if (linkSales && saleToDelete && saleToDelete.status === 'PAID' && saleToDelete.items) {
            newInventory = s.inventory.map(invItem => {
              const oldSoldItem = saleToDelete.items.find(i => String(i.productId || i.id) === String(invItem.id));
              if (oldSoldItem) {
                return { ...invItem, qty: +(invItem.qty + (oldSoldItem.qty || 0)).toFixed(3) };
              }
              return invItem;
            });
          }
          const updatedSales = (s.posSales || []).filter((sale) => sale.id !== id && sale.originalOlaClickId !== id);
          const extraIds = [];
          if (id) extraIds.push(id);
          if (saleToDelete?.id) extraIds.push(saleToDelete.id);
          if (saleToDelete?.originalOlaClickId) extraIds.push(saleToDelete.originalOlaClickId);
          if (saleToDelete?.publicId) extraIds.push(saleToDelete.publicId);

          const newDeleted = [...new Set([...(s.deletedPosSaleIds || []), ...extraIds])];
          return { posSales: updatedSales, inventory: newInventory, deletedPosSaleIds: newDeleted };
        });
        syncKey('posSales', useInventoryStore.getState().posSales);
        syncKey('inventory', useInventoryStore.getState().inventory);
        syncKey('deletedPosSaleIds', useInventoryStore.getState().deletedPosSaleIds);
      },

      addPosShift: (shift) => {
        const current = useInventoryStore.getState().posShifts || [];
        const deleted = useInventoryStore.getState().deletedShiftIds || [];

        // Generar ID determinista por fecha, sede, caja y jornada
        const dateStr = shift.openedAt ? shift.openedAt.slice(0, 10) : new Date().toISOString().slice(0, 10);
        const branch = shift.branchId || 'BRANCH-001';
        const reg = shift.registerId || 'REG-001';
        const jornadaLabel = shift.jornada || shift.shift || 'AM';
        const jornadaSlug = String(jornadaLabel).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');

        // ── CRÍTICO: Si el turno es de VENDEDOR (triciclo/vehículo), incluir pointId, responsable y timestamp para distinguir vendedores distintos de forma 100% única
        const cleanPoint = shift.pointId ? String(shift.pointId).toLowerCase().replace(/[^a-z0-9]/g, '') : null;
        const cleanResp = shift.responsibleName ? String(shift.responsibleName).toLowerCase().replace(/[^a-z0-9]/g, '') : '';
        const shiftTime = shift.openedAt ? new Date(shift.openedAt).getTime() : Date.now();
        const deterministicId = shift.id || (
          shift.type === 'VENDEDOR' && cleanPoint
            ? `SHIFT-VENDOR-${cleanPoint}-${cleanResp || 'vendor'}-${dateStr}-${jornadaSlug}-${shiftTime}`
            : `SHIFT-${branch}-${reg}-${dateStr}-${jornadaSlug}`
        );

        // ── CASO 1: CIERRE DE TURNO (shift.closedAt presente) ──
        if (shift.closedAt) {
          let updatedCount = 0;
          const nextShifts = current.map(s => {
            const isMatch = (
              s.id === shift.id ||
              s.id === deterministicId ||
              (!s.closedAt && (
                (cleanPoint && String(s.pointId || '').toLowerCase().replace(/[^a-z0-9]/g, '') === cleanPoint &&
                 (s.shift === jornadaLabel || !s.shift || s.shift === s.jornada)) ||
                (s.type !== 'VENDEDOR' && s.branchId === branch && s.registerId === reg)
              ))
            );
            if (isMatch) {
              updatedCount++;
              const isAccountCode = (n) => !n || n.trim() === '' || n === '—' || n.toLowerCase().includes('vendedor m') || n.toLowerCase() === 'vendedor';
              const keptResponsibleName = (!isAccountCode(s.responsibleName))
                ? s.responsibleName
                : (!isAccountCode(shift.responsibleName) ? shift.responsibleName : (s.responsibleName || shift.responsibleName || shift.userName || 'Vendedor'));

              return {
                ...s,
                ...shift,
                closedAt: shift.closedAt,
                responsibleName: keptResponsibleName,
              };
            }
            return s;
          });

          if (updatedCount > 0) {
            set({ posShifts: nextShifts });
            syncKey('posShifts', nextShifts);

            if (cleanPoint) {
              const currentLocs = { ...(get().vendorLocations || {}) };
              Object.keys(currentLocs).forEach(k => {
                const loc = currentLocs[k];
                const lP = String(loc?.pointId || k || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                if (lP === cleanPoint) {
                  currentLocs[k] = { ...loc, isActive: false, closedAt: shift.closedAt };
                }
              });
              set({ vendorLocations: currentLocs });
              syncKey('vendorLocations', currentLocs);
            }

            console.log(`[Shift] Cierre aplicado exitosamente sobre ${updatedCount} turno(s) existente(s)`);
            return nextShifts.find(s => s.id === shift.id || s.id === deterministicId) || nextShifts[0];
          }

          // Si no existía turno previo, registrar el nuevo turno cerrado
          const closedShift = {
            ...shift,
            id: deterministicId,
            date: dateStr,
            branchId: branch,
            registerId: reg,
            jornada: jornadaLabel
          };
          set((s) => ({
            posShifts: [
              closedShift,
              ...(s.posShifts || []).filter(sh => !deleted.includes(sh.id) && sh.id !== closedShift.id)
            ]
          }));
          syncKey('posShifts', useInventoryStore.getState().posShifts);
          console.log(`[Shift] Nuevo turno cerrado registrado: ${closedShift.id}`);
          return closedShift;
        }

        // ── CASO 2: APERTURA DE TURNO (sin closedAt) ──
        if (shift.type === 'VENDEDOR' && cleanPoint && shift.shift) {
          const duplicate = current.find(
            s => s.type === 'VENDEDOR' &&
                 String(s.pointId || '').toLowerCase().replace(/[^a-z0-9]/g, '') === cleanPoint &&
                 s.shift === shift.shift &&
                 !s.closedAt
          );
          if (duplicate) {
            console.log(`[Shift] Ya existe turno abierto para vendedor ${shift.pointId} ${shift.shift} — reusando turno existente`);
            return duplicate;
          }
        }

        const existingOpenShift = current.find(
          s => !s.closedAt && (s.type === (shift.type || 'POS')) && (
            s.id === deterministicId ||
            (s.type === 'VENDEDOR' && cleanPoint && String(s.pointId || '').toLowerCase().replace(/[^a-z0-9]/g, '') === cleanPoint && (s.openedAt || '').startsWith(dateStr) && s.shift === jornadaLabel) ||
            (s.type !== 'VENDEDOR' && s.branchId === branch && s.registerId === reg && (s.openedAt || '').startsWith(dateStr) && (s.jornada === jornadaLabel || s.shift === jornadaLabel))
          )
        );

        if (existingOpenShift) {
          console.log(`[Shift] Re-asociando a turno activo existente: ${existingOpenShift.id}`);
          return existingOpenShift;
        }

        const newShift = { 
          ...shift, 
          id: deterministicId, 
          date: dateStr, 
          branchId: branch, 
          registerId: reg, 
          jornada: jornadaLabel 
        };
        set((s) => ({
          posShifts: [
            newShift,
            ...(s.posShifts || []).filter(sh => !deleted.includes(sh.id) && sh.id !== newShift.id)
          ]
        }));
        syncKey('posShifts', useInventoryStore.getState().posShifts);
        return newShift;
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
      updateVendorLocation: (vendorId, lat, lng, name, pointId, openedAt, shift) => {
        const now = new Date().toISOString();
        const primaryKey = pointId || vendorId || name;
        if (!primaryKey || !lat || !lng) return;

        const locObj = {
          lat: Number(lat),
          lng: Number(lng),
          name: name || pointId || 'Vendedor',
          pointId: pointId || vendorId || primaryKey,
          vendorId: vendorId || pointId || primaryKey,
          updatedAt: now,
          openedAt: openedAt || now,
          shift: shift || 'AM',
          isActive: true,
        };

        set((s) => {
          const prev = s.vendorLocations || {};
          const next = { ...prev, [primaryKey]: locObj };
          if (pointId && pointId !== primaryKey) next[pointId] = locObj;
          if (vendorId && vendorId !== primaryKey) next[vendorId] = locObj;
          return { vendorLocations: next };
        });
        syncKey('vendorLocations', useInventoryStore.getState().vendorLocations);
      },

      clearVendorLocation: (vendorIdOrPointId) => {
        if (!vendorIdOrPointId) return;
        const cleanTarget = String(vendorIdOrPointId).toLowerCase().replace(/[^a-z0-9]/g, '');
        set((s) => {
          const locs = { ...(s.vendorLocations || {}) };
          Object.keys(locs).forEach((k) => {
            const loc = locs[k];
            const cleanK = String(k).toLowerCase().replace(/[^a-z0-9]/g, '');
            const cleanP = String(loc?.pointId || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const cleanN = String(loc?.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            if (cleanK === cleanTarget || cleanP === cleanTarget || cleanN === cleanTarget || cleanTarget.includes(cleanP) || cleanP.includes(cleanTarget)) {
              delete locs[k];
            }
          });
          return { vendorLocations: locs };
        });
        syncKey('vendorLocations', useInventoryStore.getState().vendorLocations);
      },
    }),
    {
      name: 'frita-mejor-inventory',
      storage: safeJSONStorage,
      version: 14, // v14: forzar invalidez de caché local e inclusión de Vasos y Cambio
      migrate: (persisted, fromVersion) => {
        if (fromVersion < 14) {
          // Vaciar inventario en rehidratación para forzar descarga limpia desde Supabase
          persisted.inventory = [];
        }
        // v9 → v10: agregar branchId a cajas POS que no lo tienen
        if (fromVersion < 10) {
          const registers = persisted.posRegisters || [];
          persisted.posRegisters = registers.map(r =>
            r.branchId ? r : { ...r, branchId: 'BRANCH-001' }
          );
        }
        // v10 → v11: agregar branchId a líneas de fritado que no lo tienen
        if (fromVersion < 11) {
          persisted.fryKitchens = (persisted.fryKitchens || []).map(k =>
            k.branchId ? k : { ...k, branchId: 'BRANCH-001' }
          );
        }
        // v11 → v12: inicializar tombstone de inventario
        if (fromVersion < 12) {
          persisted.deletedInventoryIds = persisted.deletedInventoryIds || [];
        }
        // v12 → v13: corregir formato de cashDrawerCode y proteger posSettings
        if (fromVersion < 13) {
          if (persisted.posSettings) {
            const code = persisted.posSettings.cashDrawerCode || '';
            // Si no tiene formato decimal separado por comas (ej: 27,112,48,55,121), resetear
            if (!code.match(/^\d+(,\s*\d+)*$/)) {
              persisted.posSettings = {
                ...persisted.posSettings,
                cashDrawerCode: '27,112,48,55,121',
              };
            }
          }
        }
        return persisted;
      },
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
        posRegisters:       state.posRegisters || INITIAL_POS_REGISTERS,
        posShifts:          state.posShifts,
        posSales:           state.posSales,
        posExpenses:        state.posExpenses,
        loadTemplates:      state.loadTemplates,
        salesGoals:         state.salesGoals || [],
        deletedShiftIds:      state.deletedShiftIds || [],
        deletedInventoryIds:  state.deletedInventoryIds || [],
        deletedPosRegisterIds: state.deletedPosRegisterIds || [],
        vendorLocations:      state.vendorLocations  || {},
        contrataPayments:     state.contrataPayments || [],
      }),
      // Al rehidratar desde localStorage, filtrar items borrados y duplicados
      onRehydrateStorage: () => (state) => {
        if (!state) return;

        // Filtrar cajas borradas
        const deletedRegs = state.deletedPosRegisterIds || [];
        if (deletedRegs.length > 0 && state.posRegisters?.length > 0) {
          state.posRegisters = state.posRegisters.filter(r => !deletedRegs.includes(r.id));
        }

        // ── Limpiar inventory, customerTypes y customers DEMO del localStorage ──
        const DEMO_CTYPE_IDS = new Set(['CTYPE-001', 'CTYPE-002']);
        const DEMO_CUST_IDS = new Set(['CUST-002']);
        const DEMO_PRD_IDS = new Set(['PRD-001', 'PRD-002', 'PRD-003', 'PRD-004', 'PRD-005', 'PRD-006', 'PRD-RAW-005', 'PRD-RAW-006']);
        if (Array.isArray(state.inventory)) {
          const hasReal = state.inventory.some(i => i?.id && !DEMO_PRD_IDS.has(i.id));
          if (hasReal) {
            state.inventory = state.inventory.filter(i => !i?.id || !DEMO_PRD_IDS.has(i.id));
          }
        }
        if (Array.isArray(state.customerTypes)) {
          const realTypes = state.customerTypes.filter(ct => ct?.id && !DEMO_CTYPE_IDS.has(ct.id));
          if (realTypes.length === 0) {
            state.customerTypes = [];
          } else {
            state.customerTypes = realTypes;
          }
        }
        if (Array.isArray(state.customers)) {
          // Mantener CUST-001 (Cliente General) pero eliminar demos
          const realCustomers = state.customers.filter(c => c?.id && !DEMO_CUST_IDS.has(c.id));
          // Si solo queda CUST-001 (sin clientes contrata reales), vaciar para que Supabase los traiga
          const hasRealContrata = realCustomers.some(c => c.typeId && !DEMO_CTYPE_IDS.has(c.typeId));
          if (!hasRealContrata) {
            state.customers = [];
          } else {
            state.customers = realCustomers;
          }
        }

        const deletedShifts = state.deletedShiftIds || [];
        if (deletedShifts.length > 0 && state.posShifts?.length > 0) {
          state.posShifts = state.posShifts.filter(s => !deletedShifts.includes(s.id));
        }
        const deletedInv = state.deletedInventoryIds || [];
        if (!state.inventory || state.inventory.length === 0) {
          // NO usar inventoryBackupSeed aquí — esperar a que loadFromRemote traiga los datos reales
          state.inventory = [];
        } else {
          let inv = state.inventory;
          if (deletedInv.length > 0) {
            inv = inv.filter(i => !deletedInv.includes(i.id));
          }
          
          // Eliminar duplicados locales (mismo ID o mismo nombre + código de barras)
          const seenIds = new Set();
          const seenNames = new Set();
          const uniqueInventory = [];
          
          inv.forEach(item => {
            if (!item || !item.id) return;
            const nameKey = `${item.name.toLowerCase().trim()}_${item.barcode || ''}`;
            if (!seenIds.has(item.id) && !seenNames.has(nameKey)) {
              seenIds.add(item.id);
              seenNames.add(nameKey);
              uniqueInventory.push(item);
            }
          });
          state.inventory = uniqueInventory;
        }
      },
    }
  )
);

// Registrar en globalThis para que useLogisticsStore pueda leer posShifts
// sin crear una dependencia circular entre stores.
if (typeof globalThis !== 'undefined') {
  globalThis.__inventoryStore__ = useInventoryStore;
}
