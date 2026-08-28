const assert = require('assert');

// 1. Simulación de la lógica de buildShiftLogistics / isMovementMatch
function matchVehicleId(sPointId, targetId) {
  if (!sPointId || !targetId) return false;
  const cleanS = String(sPointId).toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanT = String(targetId).toLowerCase().replace(/[^a-z0-9]/g, '');
  return cleanS === cleanT;
}

function testIsMovementMatch(e, shift, vehicleId, shiftDate, shiftJornada, windowStart, windowEnd) {
  if (!e) return false;

  // 1. Coincidencia estricta de vehículo
  const eVehicle = e.vehicleId || e.pointId || e.requester_point_id || e.vehicle;
  if (!matchVehicleId(eVehicle, vehicleId)) return false;

  // 2. Coincidencia por shiftId exacto (máxima prioridad)
  if (e.shiftId && shift.id) {
    if (e.shiftId === shift.id) return true;
    return false; // Tiene otro shiftId explícito -> DESCARTAR
  }

  // 3. Coincidencia por fecha
  const eDate = (e.timestamp || e.completed_at || e.created_at || '').slice(0, 10);
  if (shiftDate && eDate && eDate !== shiftDate) return false;

  // 4. Coincidencia por jornada
  const eJornada = (e.jornada || e.shift || '').toUpperCase();
  if (eJornada && shiftJornada && eJornada !== 'COMPLETA' && shiftJornada !== 'COMPLETA' && eJornada !== shiftJornada) {
    return false;
  }

  // 5. Ventana de tiempo
  const ts = new Date(e.timestamp || e.completed_at || e.created_at || 0).getTime();
  return ts >= windowStart && ts <= windowEnd;
}

console.log('=== TEST DE AISLAMIENTO DE TURNOS Y CARGAS ===\n');

const date = '2026-08-27';

// Escenario: Dos turnos para el mismo vehículo T1 en el mismo día
const shiftAM = {
  id: 'SHIFT-T1-AM',
  pointId: 'T1',
  shift: 'AM',
  openedAt: `${date}T08:00:00.000Z`,
  closedAt: `${date}T12:30:00.000Z`
};

const shiftPM = {
  id: 'SHIFT-T1-PM',
  pointId: 'T1',
  shift: 'PM',
  openedAt: `${date}T14:00:00.000Z`,
  closedAt: `${date}T20:00:00.000Z`
};

// Movimientos
const cargaAM = {
  id: 'LOAD-1',
  type: 'carga',
  vehicleId: 'T1',
  shiftId: 'SHIFT-T1-AM',
  jornada: 'AM',
  items: [{ productId: 'PRD-EMP', qty: 20 }],
  timestamp: `${date}T07:45:00.000Z`
};

const surtidoAM = {
  id: 'REQ-1',
  requester_point_id: 'T1',
  shiftId: 'SHIFT-T1-AM',
  jornada: 'AM',
  items_payload: [{ productId: 'PRD-EMP', qty: 10 }],
  completed_at: `${date}T10:00:00.000Z`
};

const cargaPM = {
  id: 'LOAD-2',
  type: 'carga',
  vehicleId: 'T1',
  shiftId: 'SHIFT-T1-PM',
  jornada: 'PM',
  items: [{ productId: 'PRD-EMP', qty: 30 }],
  timestamp: `${date}T13:45:00.000Z`
};

const surtidoPM = {
  id: 'REQ-2',
  requester_point_id: 'T1',
  shiftId: 'SHIFT-T1-PM',
  jornada: 'PM',
  items_payload: [{ productId: 'PRD-EMP', qty: 15 }],
  completed_at: `${date}T16:00:00.000Z`
};

// Ventanas
const windowStartAM = new Date(shiftAM.openedAt).getTime() - 25 * 60 * 1000;
const windowEndAM = new Date(shiftAM.closedAt).getTime() + 15 * 60 * 1000;

const windowStartPM = new Date(shiftPM.openedAt).getTime() - 25 * 60 * 1000;
const windowEndPM = new Date(shiftPM.closedAt).getTime() + 15 * 60 * 1000;

// Test 1: Turno AM solo debe aceptar sus movimientos
assert.strictEqual(testIsMovementMatch(cargaAM, shiftAM, 'T1', date, 'AM', windowStartAM, windowEndAM), true, 'Carga AM debe pertenecer a Turno AM');
assert.strictEqual(testIsMovementMatch(surtidoAM, shiftAM, 'T1', date, 'AM', windowStartAM, windowEndAM), true, 'Surtido AM debe pertenecer a Turno AM');
assert.strictEqual(testIsMovementMatch(cargaPM, shiftAM, 'T1', date, 'AM', windowStartAM, windowEndAM), false, 'Carga PM NO debe pertenecer a Turno AM');
assert.strictEqual(testIsMovementMatch(surtidoPM, shiftAM, 'T1', date, 'AM', windowStartAM, windowEndAM), false, 'Surtido PM NO debe pertenecer a Turno AM');
console.log('✅ Test 1 Superado: Turno AM estrictamente aislado de movimientos PM.');

// Test 2: Turno PM solo debe aceptar sus movimientos (INCLUSO si está evaluado de forma aislada)
assert.strictEqual(testIsMovementMatch(cargaPM, shiftPM, 'T1', date, 'PM', windowStartPM, windowEndPM), true, 'Carga PM debe pertenecer a Turno PM');
assert.strictEqual(testIsMovementMatch(surtidoPM, shiftPM, 'T1', date, 'PM', windowStartPM, windowEndPM), true, 'Surtido PM debe pertenecer a Turno PM');
assert.strictEqual(testIsMovementMatch(cargaAM, shiftPM, 'T1', date, 'PM', windowStartPM, windowEndPM), false, 'Carga AM NO debe pertenecer a Turno PM');
assert.strictEqual(testIsMovementMatch(surtidoAM, shiftPM, 'T1', date, 'PM', windowStartPM, windowEndPM), false, 'Surtido AM NO debe pertenecer a Turno PM');
console.log('✅ Test 2 Superado: Turno PM estrictamente aislado de movimientos AM.');

// Test 3: Movimiento huérfano sin shiftId explícito pero con timestamp de la mañana
const legacyCargaAM = {
  id: 'LOAD-LEGACY',
  type: 'carga',
  vehicleId: 'T1',
  jornada: 'AM',
  items: [{ productId: 'PRD-EMP', qty: 10 }],
  timestamp: `${date}T08:05:00.000Z`
};
assert.strictEqual(testIsMovementMatch(legacyCargaAM, shiftPM, 'T1', date, 'PM', windowStartPM, windowEndPM), false, 'Carga de la mañana NO debe filtrarse al turno PM');
console.log('✅ Test 3 Superado: Cargas sin shiftId respetan jornada y ventana temporal sin contaminación.');

console.log('\n🎉 TODOS LOS TESTS DE AISLAMIENTO PASARON AL 100%!');
