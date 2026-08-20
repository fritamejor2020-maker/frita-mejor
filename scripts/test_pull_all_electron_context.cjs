const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://uevcotmnffftoelscjua.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVldmNvdG1uZmZmdG9lbHNjanVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTk3NjMsImV4cCI6MjA5MTIzNTc2M30.c8q811qfvwOvenGk4mwt1HVTBsD7cPYiTM-2orqz3pM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testPullAll(branchId) {
  console.log(`=== Testing pullAll for branchId: ${branchId} ===`);
  const GLOBAL_KEYS = ['products', 'recipes', 'fritadoRecipes', 'posCategories', 'itemTypes', 'users', 'branches', 'suppliers', 'posRegisters', 'customers', 'customerTypes', 'payrollEmployees', 'salesGoals', 'transfers'];
  const BRANCH_KEYS = ['warehouses', 'inventory', 'movements', 'posShifts', 'posSales', 'posExpenses', 'posRegisters', 'posSettings', 'contrataPayments', 'deletedShiftIds', 'deletedInventoryIds', 'loadTemplates', 'vendorLocations'];

  const keysToFetch = [...GLOBAL_KEYS];
  const allBranchIds = ['BRANCH-001'];

  if (branchId === null) {
    for (const bid of allBranchIds) {
      for (const bk of BRANCH_KEYS) keysToFetch.push(`${bk}_${bid}`);
    }
  } else {
    for (const bk of BRANCH_KEYS) keysToFetch.push(`${bk}_${branchId}`);
  }

  const { data, error } = await supabase.from('app_state').select('key, value').in('key', keysToFetch);
  if (error) {
    console.error('Error:', error);
    return;
  }
  const result = Object.fromEntries(data.map(row => [row.key, row.value]));
  console.log('customerTypes in result:', result.customerTypes);
  console.log('customers in result:', result.customers);
}

async function run() {
  await testPullAll(null); // Admin
  await testPullAll('BRANCH-001'); // Branch user
}

run();
