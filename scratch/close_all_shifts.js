import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uevcotmnffftoelscjua.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVldmNvdG1uZmZmdG9lbHNjanVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTk3NjMsImV4cCI6MjA5MTIzNTc2M30.c8q811qfvwOvenGk4mwt1HVTBsD7cPYiTM-2orqz3pM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const keys = ['posShifts', 'posShifts_BRANCH-001'];
  console.log('Fetching shifts from Supabase...');
  const { data, error } = await supabase
    .from('app_state')
    .select('key, value')
    .in('key', keys);

  if (error || !data) {
    console.error('Error fetching:', error);
    return;
  }

  for (const row of data) {
    const shifts = row.value || [];
    let updatedCount = 0;
    const updatedShifts = shifts.map(s => {
      if (!s.closedAt) {
        // Si no está cerrado, cerrarlo.
        // Si es de hoy (7 de julio de 2026), podemos dejarlo abierto o cerrarlo.
        // Vamos a cerrar TODOS los turnos antiguos (anteriores a hoy).
        const openedDate = new Date(s.openedAt);
        const today = new Date();
        const isToday = openedDate.getUTCDate() === today.getUTCDate() &&
                        openedDate.getUTCMonth() === today.getUTCMonth() &&
                        openedDate.getUTCFullYear() === today.getUTCFullYear();
        
        if (!isToday) {
          console.log(`Closing old open shift: id=${s.id}, openedAt=${s.openedAt}`);
          updatedCount++;
          return { ...s, closedAt: s.openedAt }; // Cerrar usando la hora de apertura
        }
      }
      return s;
    });

    if (updatedCount > 0) {
      console.log(`Updating ${row.key} with ${updatedCount} closed shifts...`);
      const { error: writeErr } = await supabase
        .from('app_state')
        .upsert({ key: row.key, value: updatedShifts }, { onConflict: 'key' });
      
      if (writeErr) {
        console.error(`Error saving ${row.key}:`, writeErr);
      } else {
        console.log(`Saved ${row.key} successfully!`);
      }
    } else {
      console.log(`No old open shifts found in ${row.key}.`);
    }
  }
}

run();
