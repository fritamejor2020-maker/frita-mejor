const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://uevcotmnffftoelscjua.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVldmNvdG1uZmZmdG9lbHNjanVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTk3NjMsImV4cCI6MjA5MTIzNTc2M30.c8q811qfvwOvenGk4mwt1HVTBsD7cPYiTM-2orqz3pM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function listTables() {
  const tables = ['incomes', 'income_types', 'income_sources', 'app_state', 'branches', 'employees', 'pos_shifts', 'pos_sales', 'pos_items'];
  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('*').limit(5);
    console.log(`=== Table '${t}' ===`, error ? error.message : `Rows: ${data.length}`, data ? data.slice(0, 2) : '');
  }
}

listTables();
