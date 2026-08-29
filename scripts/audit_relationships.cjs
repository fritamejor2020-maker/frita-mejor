const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://uevcotmnffftoelscjua.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVldmNvdG1uZmZmdG9lbHNjanVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTk3NjMsImV4cCI6MjA5MTIzNTc2M30.c8q811qfvwOvenGk4mwt1HVTBsD7cPYiTM-2orqz3pM';
const supabase = createClient(supabaseUrl, supabaseKey);

async function runComprehensiveAudit() {
  console.log('================================================================');
  console.log('🔍 AUDITORÍA DE RELACIONES: VENDEDORES, DEJADORES, ADMIN, TURNOS, PEDIR');
  console.log('================================================================\n');

  const keys = [
    'posShifts_BRANCH-001', 'posShifts', 'posShifts_master_history',
    'vendorLocations', 'vendorLocations_BRANCH-001',
    'pendingRequests_BRANCH-001', 'completedRequests_BRANCH-001',
    'loadHistory_BRANCH-001',
    'customer_delivery_requests',
    'users', 'vehicles', 'inventory_BRANCH-001'
  ];

  const { data, error } = await supabase.from('app_state').select('key, value, updated_at').in('key', keys);
  if (error) {
    console.error('Error al consultar datos:', error);
    return;
  }

  const map = new Map();
  data.forEach(r => map.set(r.key, r.value));

  const shifts = map.get('posShifts_BRANCH-001') || map.get('posShifts') || [];
  const users = map.get('users') || [];
  const vehicles = map.get('vehicles') || {};
  const pendingRequests = map.get('pendingRequests_BRANCH-001') || [];
  const completedRequests = map.get('completedRequests_BRANCH-001') || [];
  const loadHistory = map.get('loadHistory_BRANCH-001') || [];
  const customerRequests = map.get('customer_delivery_requests') || [];
  const vendorLocations = map.get('vendorLocations') || {};
  const inventory = map.get('inventory_BRANCH-001') || [];

  // 1. AUDITORÍA DE VENDEDORES VS USUARIOS
  console.log('1. VENDEDORES Y CUENTAS:');
  const vendorUsers = Array.isArray(users) ? users.filter(u => u.role === 'VENDEDOR' || (u.access || []).includes('vendedor')) : [];
  console.log(   • Total usuarios registrados: );
  console.log(   • Vendedores activos: );
  vendorUsers.forEach(v => {
    console.log(     - []:  (Rol: ));
  });

  // 2. AUDITORÍA DE VEHÍCULOS / FLOTA
  console.log('\n2. FLOTA Y VEHÍCULOS:');
  const vehList = Array.isArray(vehicles) ? vehicles : Object.values(vehicles);
  console.log(   • Total vehículos configurados: );
  vehList.forEach(veh => {
    console.log(     - []:  (Tipo: ));
  });

  // 3. AUDITORÍA DE TURNOS Y JORNADAS
  console.log('\n3. TURNOS (posShifts):');
  console.log(   • Total turnos en historial: );
  const openShifts = shifts.filter(s => !s.closedAt);
  const closedShifts = shifts.filter(s => s.closedAt);
  console.log(   • Turnos cerrados (liquidados): );
  console.log(   • Turnos abiertos actualmente: );
  openShifts.forEach(s => {
    console.log(     - Turno Abierto: ID= | Tipo= | Punto= | Jornada= | Resp=);
  });

  // 4. AUDITORÍA DE LOGÍSTICA DE DEJADORES (Cargas y Surtidos)
  console.log('\n4. LOGÍSTICA Y DEJADORES:');
  const loads = loadHistory.filter(h => h.type === 'carga');
  const recvs = loadHistory.filter(h => h.type === 'recepcion');
  console.log(   • Cargas registradas en historial: );
  console.log(   • Recepciones de sobrantes: );
  console.log(   • Surtidos pendientes (cola Dejador): );
  console.log(   • Surtidos completados en ruta: );

  // Verificar integridad de shiftId en surtidos recientes
  const recentCompleted = completedRequests.slice(0, 5);
  console.log('   • Muestra de surtidos completados recientes:');
  recentCompleted.forEach(c => {
    console.log(     - Req ID= | Punto= | shiftId= | Jornada= | Items=);
  });

  // 5. AUDITORÍA DE PEDIR (/pedir y Domicilios)
  console.log('\n5. MÓDULO PEDIR (/pedir & Domicilios):');
  console.log(   • Pedidos a domicilio registrados: );
  console.log(   • GPS Vendedores en vivo (vendorLocations): );
  Object.entries(vendorLocations).forEach(([pointId, loc]) => {
    console.log(     - []: Lat=, Lng=, Resp=, Hora=);
  });

  // 6. AUDITORÍA DE INVENTARIO CENTRAL
  console.log('\n6. INVENTARIO CENTRAL (Bodega):');
  console.log(   • Total productos activos: );
  const tricycleItems = inventory.filter(i => i.inTricycles === true || String(i.inTricycles) === 'true');
  console.log(   • Ítems disponibles para Triciclos/Flota: );

  console.log('\n================================================================');
  console.log('✅ AUDITORÍA DE RELACIONES FINALIZADA CON ÉXITO');
  console.log('================================================================');
}

runComprehensiveAudit().catch(console.error);
