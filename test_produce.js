import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// A simple script to read useInventoryStore.js, extract produceItem logic, and run it
const content = fs.readFileSync('src/store/useInventoryStore.js', 'utf-8');

// We'll simulate the state manually from the INITIAL constants
const INITIAL_INVENTORY = [
  { id: 'INS-001', warehouseId: 'BOD-001', name: 'Carne de Cerdo', qty: 120, unit: 'kg' },
];

const INITIAL_PRODUCTS = [
  { id: 'P-001', name: 'Chorizo Tradicional', recipeId: 'R-001', outputInventoryId: 'PRD-001', unit: 'kg' },
];

const INITIAL_RECIPES = [
  { id: 'R-001', name: 'Chorizo Tradicional', productId: 'P-001', yieldQty: 10, yieldUnit: 'kg', ingredients: [{ inventoryId: 'INS-001', qty: 5 }] },
];

let state = {
  inventory: INITIAL_INVENTORY,
  products: INITIAL_PRODUCTS,
  recipes: INITIAL_RECIPES,
  movements: [],
  warehouses: [{id: 'BOD-003', name: 'Bodega de Secos'}],
};

function produceItem(productId, batches = 1) {
  const product = state.products.find(p => p.id === productId);
  const recipe = state.recipes.find(r => r.id === product.recipeId);
  const produced = recipe.yieldQty * batches;

  // Extracted logic from fixed useInventoryStore.js
  let newInventory = state.inventory.map((item) => {
    const ingredient = recipe.ingredients.find((i) => i.inventoryId === item.id);
    if (ingredient) {
      return { ...item, qty: Math.max(0, +(item.qty - (ingredient.qty * batches)).toFixed(3)) };
    }
    return item;
  });

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

  state.inventory = newInventory;
  console.log("Production successful.");
}

console.log("--- BEFORE PRODUCTION ---");
console.log("Inventory count:", state.inventory.length);
console.log("Chorizo Tradicional found? ", !!state.inventory.find(i => i.id === 'PRD-001'));

produceItem('P-001', 1);

console.log("\n--- AFTER PRODUCTION ---");
console.log("Inventory count:", state.inventory.length);
const chorizo = state.inventory.find(i => i.id === 'PRD-001');
console.log("Chorizo Tradicional found? ", !!chorizo);
if (chorizo) {
  console.log("Chorizo Qty:", chorizo.qty, chorizo.unit);
  console.log("Chorizo Warehouse:", chorizo.warehouseId);
}

// Second run to test increment
produceItem('P-001', 2);
console.log("\n--- AFTER SECOND PRODUCTION (2 batches) ---");
const chorizo2 = state.inventory.find(i => i.id === 'PRD-001');
if (chorizo2) {
  console.log("Chorizo Qty:", chorizo2.qty, chorizo2.unit);
}
