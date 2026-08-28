const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://uevcotmnffftoelscjua.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVldmNvdG1uZmZmdG9lbHNjanVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTk3NjMsImV4cCI6MjA5MTIzNTc2M30.c8q811qfvwOvenGk4mwt1HVTBsD7cPYiTM-2orqz3pM';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runAudit() {
  console.log('==================================================');
  console.log('🔍 AUDITORIA PROFUNDA DE SUPABASE — FRITA MEJOR');
  console.log('==================================================\n');

  const t0 = Date.now();

  // 1. Test de lectura en app_state
  const { data: rows, error: readErr } = await supabase.from('app_state').select('key, updated_at');
  const readLatency = Date.now() - t0;

  if (readErr) {
    console.error('❌ Error de lectura en app_state:', readErr);
    return;
  }
  console.log('1. LECTURA REST Y LATENCIA:');
  console.log('   Status: ✅ OK');
  console.log('   Latencia de respuesta:', readLatency, 'ms');
  console.log('   Total de llaves registradas:', rows.length, 'llaves\n');

  // 2. Test de escritura, actualización y borrado en app_state
  console.log('2. PRUEBA DE ESCRITURA Y BORRADO (RLS / PERMISOS):');
  const tWrite = Date.now();
  const testKey = 'audit_healthcheck_test_' + Date.now();
  const testPayload = { test: true, timestamp: new Date().toISOString() };
  const { error: writeErr } = await supabase.from('app_state').upsert({
    key: testKey,
    value: testPayload,
    updated_at: new Date().toISOString()
  });

  if (writeErr) {
    console.error('   ❌ Error al escribir en app_state:', writeErr);
  } else {
    console.log('   ✅ Escritura/Upsert: OK (' + (Date.now() - tWrite) + ' ms)');
    const { error: delErr } = await supabase.from('app_state').delete().eq('key', testKey);
    if (delErr) {
      console.warn('   ⚠️ Error al borrar llave temporal:', delErr);
    } else {
      console.log('   ✅ Borrado: OK');
    }
  }
  console.log('');

  // 3. Inspección detallada de llaves críticas
  const criticalKeys = [
    'posShifts', 'posShifts_BRANCH-001', 'posShifts_master_history',
    'inventory_BRANCH-001', 'inventory',
    'vendorLocations', 'vendorLocations_BRANCH-001',
    'pendingRequests', 'pendingRequests_BRANCH-001',
    'completedRequests', 'completedRequests_BRANCH-001',
    'loadHistory', 'loadHistory_BRANCH-001',
    'customer_delivery_requests',
    'users', 'vehicles', 'branches', 'posSales', 'posSales_BRANCH-001'
  ];

  console.log('3. ESTADO Y SALUD DE LAS LLAVES CRÍTICAS:');
  const { data: fullRows, error: fullErr } = await supabase
    .from('app_state')
    .select('key, value, updated_at')
    .in('key', criticalKeys);

  if (fullErr) {
    console.error('   ❌ Error al consultar llaves críticas:', fullErr);
    return;
  }

  const foundMap = new Map();
  fullRows.forEach(r => foundMap.set(r.key, r));

  criticalKeys.forEach(k => {
    const r = foundMap.get(k);
    if (!r) {
      console.log('   ⚠️ [' + k + ']: NO EXISTE en app_state (no inicializada)');
      return;
    }
    let detail = 'N/A';
    if (Array.isArray(r.value)) {
      detail = 'Array con ' + r.value.length + ' elementos';
    } else if (typeof r.value === 'object' && r.value !== null) {
      detail = 'Objeto con ' + Object.keys(r.value).length + ' propiedades';
    } else {
      detail = typeof r.value;
    }
    const bytes = JSON.stringify(r.value || '').length;
    const kb = (bytes / 1024).toFixed(2);
    console.log('   ✅ [' + k + ']: ' + detail + ' | ' + kb + ' KB | Última mod: ' + (r.updated_at || 'N/A'));
  });

  // 4. Chequeo de inconsistencias de datos (ej. turnos sin cerrar viejos, GPS huerfano)
  console.log('\n4. INTEGRIDAD Y AUDITORÍA DE DATOS DE HOY:');
  const today = new Date().toISOString().slice(0, 10);
  
  // Turnos
  const shifts = foundMap.get('posShifts_BRANCH-001')?.value || foundMap.get('posShifts')?.value || [];
  const openShifts = shifts.filter(s => !s.closedAt);
  const closedShifts = shifts.filter(s => s.closedAt);
  console.log('   • Turnos Totales:', shifts.length);
  console.log('   • Turnos Abiertos:', openShifts.length, openShifts.map(s => (s.pointId || s.vehicle) + ' (' + (s.shift || 'AM') + ')'));
  console.log('   • Turnos Cerrados:', closedShifts.length);

  // GPS
  const locs = foundMap.get('vendorLocations')?.value || {};
  console.log('   • Vendedores emitiendo GPS activo:', Object.keys(locs).length, Object.keys(locs));

  // Surtidos pendientes y completados
  const pending = foundMap.get('pendingRequests_BRANCH-001')?.value || [];
  const completed = foundMap.get('completedRequests_BRANCH-001')?.value || [];
  console.log('   • Surtidos Pendientes (Dejador):', pending.length);
  console.log('   • Surtidos Completados:', completed.length);

  // Cargas y recepciones
  const history = foundMap.get('loadHistory_BRANCH-001')?.value || [];
  const loads = history.filter(h => h.type === 'carga');
  const recvs = history.filter(h => h.type === 'recepcion');
  console.log('   • Cargas registradas en historial:', loads.length);
  console.log('   • Recepciones de sobrantes:', recvs.length);

  console.log('\n==================================================');
  console.log('🎉 AUDITORÍA COMPLETADA CON ÉXITO');
  console.log('==================================================');
}

runAudit().catch(console.error);
