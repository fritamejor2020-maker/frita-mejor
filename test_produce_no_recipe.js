import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const INITIAL_INVENTORY = [
  { id: 'INS-001', warehouseId: 'BOD-001', name: 'Carne de Cerdo', qty: 120, unit: 'kg' },
];

// Product without recipe
const INITIAL_PRODUCTS = [
  { id: 'P-002', name: 'Producto Nuevo Sin Receta', unit: 'unidades', outputInventoryId: 'PRD-NEW' },
];

let state = {
  inventory: INITIAL_INVENTORY,
  products: INITIAL_PRODUCTS,
  recipes: [],
  movements: [],
  warehouses: [{id: 'BOD-003', name: 'Bodega de Secos'}],
};

function produceItem(productId, batches = 1) {
  const product = state.products.find(p => p.id === productId);
  let recipe  = state.recipes.find(r => r.id === product.recipeId);
  
  if (!recipe) {
    recipe = {
      id: 'R-NONE',
      name: product.name,
      yieldQty: 1,
      yieldUnit: product.unit,
      ingredients: []
    };
  }

  const produced = recipe.yieldQty * batches;

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
  console.log(`Production successful: +${produced} ${recipe.yieldUnit}`);
}

console.log("--- TEST ENVIROMENT ---");
console.log("Inventory count:", state.inventory.length);

produceItem('P-002', 5);

console.log("\n--- AFTER PRODUCTION ---");
console.log("Inventory count:", state.inventory.length);
const prod = state.inventory.find(i => i.id === 'PRD-NEW');
console.log("Product found? ", !!prod);
if (prod) {
  console.log("Product Qty:", prod.qty, prod.unit);
  console.log("Product Warehouse:", prod.warehouseId);
}
