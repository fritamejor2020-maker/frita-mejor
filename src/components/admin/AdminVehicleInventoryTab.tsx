import React, { useState, useMemo, useEffect } from 'react';
import { useLogisticsStore } from '../../store/useLogisticsStore';
import { useInventoryStore } from '../../store/useInventoryStore';
import { useSellerSessionStore } from '../../store/useSellerSessionStore';
import { useVehicleStore } from '../../store/useVehicleStore';
import { useAttendanceStore } from '../../store/useAttendanceStore';
import { usePayrollStore } from '../../store/usePayrollStore';
import { supabase } from '../../lib/supabase';
import { ChevronDown, ChevronUp, Package, RefreshCw, RotateCcw, AlertTriangle } from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────────────────────────
export const matchVehicleId = (sPointId: string | null | undefined, targetId: string | null | undefined) => {
  if (!sPointId || !targetId) return false;
  const cleanS = String(sPointId).toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanT = String(targetId).toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!cleanS || !cleanT) return false;
  if (cleanS === cleanT) return true;
  if (cleanS.includes(cleanT) || cleanT.includes(cleanS)) return true;

  const vehicles = useVehicleStore.getState().vehicles || [];
  const targetVeh = vehicles.find((v: any) => {
    const vId = (v.id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const vAbbr = (v.abbreviation || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const vName = (v.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return cleanT === vId || cleanT === vAbbr || cleanT === vName;
  });

  if (targetVeh) {
    const vAbbr = (targetVeh.abbreviation || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const vName = (targetVeh.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const vId = (targetVeh.id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (cleanS === vAbbr || cleanS === vName || cleanS === vId) return true;
  }
  return false;
};

export function getVendedorName(
  shift: any,
  vehicleId: string,
  loadHistory: any[] = [],
  completedRequests: any[] = []
): string {
  // 1. Usar directamente el nombre del responsable guardado en el turno
  if (shift?.responsibleName && shift.responsibleName.trim() !== '' && shift.responsibleName !== '—') {
    return shift.responsibleName;
  }
  if (shift?.userName && shift.userName.trim() !== '' && shift.userName !== '—') {
    return shift.userName;
  }
  if (shift?.employeeName && shift.employeeName.trim() !== '' && shift.employeeName !== '—') {
    return shift.employeeName;
  }

  const shiftDate = shift?.fecha || dateOf(shift?.closedAt || shift?.openedAt || '');
  const isGeneric = (name: string | null | undefined) =>
    !name || name.trim() === '' || name === '—' || name.toLowerCase().includes('vendedor m') || name.toLowerCase() === 'vendedor';

  // 2. Buscar en los surtidos (completedRequests) de este vehículo
  for (const r of completedRequests) {
    if (matchVehicleId(r.requester_point_id, vehicleId) && (!shiftDate || dateOf(r.completed_at || r.created_at) === shiftDate)) {
      const name = r.requester_name || r.created_by_name || r.responsibleName;
      if (name && !isGeneric(name)) return name;
    }
  }

  // 3. Buscar en la logística de este turno (loadHistory)
  for (const e of loadHistory) {
    if (matchVehicleId(e.vehicleId, vehicleId) && (!shiftDate || dateOf(e.timestamp) === shiftDate)) {
      const name = e.responsibleName || e.created_by_name || e.userName || e.vendorName;
      if (name && !isGeneric(name)) return name;
    }
  }

  // 4. Buscar en los contratos de asistencia (employeeContracts) por vehículo/punto asignado
  try {
    const contracts = (useAttendanceStore.getState() as any).employeeContracts || [];
    const matchedContract = contracts.find((c: any) =>
      matchVehicleId(c.assignedPointId || c.assignedVehicleId || c.pointId, vehicleId)
    );
    if (matchedContract && !isGenericOrAccount(matchedContract.employeeName)) {
      return matchedContract.employeeName;
    }
  } catch (e) {}

  // 5. Buscar en los empleados de nómina (payrollEmployees) por punto asignado
  try {
    const payroll = (usePayrollStore.getState() as any).payrollEmployees || [];
    const matchedPayroll = payroll.find((e: any) =>
      matchVehicleId(e.assignedVehicle || e.pointId, vehicleId)
    );
    if (matchedPayroll && !isGenericOrAccount(matchedPayroll.name)) {
      return matchedPayroll.name;
    }
  } catch (e) {}

  // Fallback si no hay nombre de persona real disponible
  if (shift?.responsibleName && shift.responsibleName !== '—') return shift.responsibleName;
  if (shift?.userName && shift.userName !== '—') return shift.userName;

  return '—';
}

const dateOf = (iso: string) => {
  if (!iso) return '';
  if (typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(iso.trim())) return iso.trim();
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Deriva la jornada desde la hora de apertura si no viene explícita en el turno
const deriveJornada = (shift: any): string => {
  if (shift.shift && shift.shift !== '—') return shift.shift;
  const ref = shift.openedAt || shift.start_time || null;
  if (!ref) return 'AM';
  const h = new Date(ref).getHours(); // hora local
  if (h < 12) return 'AM';
  if (h < 17) return 'MD';
  return 'PM';
};

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n || 0);

const fmtTime = (iso: string) =>
  iso ? new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '—';

// ─── Construye el resumen logístico de un turno ───────────────────────────────
function buildShiftLogistics(
  shift: any,
  vehicleId: string,
  shiftDate: string,
  openedAt: string | null,
  closedAt: string | null,
  loadHistory: any[],
  completedRequests: any[],
  priceMap: Record<string, { price: number; name: string }>,
  allShifts: any[] = []
) {
  const shiftJornada = (deriveJornada(shift) || '').toUpperCase();

  // Encontrar otros turnos del mismo vehículo en la misma fecha para delimitar ventanas estrictas
  const sameDayVehicleShifts = (allShifts || [])
    .filter((s: any) => matchVehicleId(s.pointId || s.vehicle, vehicleId) && (s.fecha || s.date || dateOf(s.closedAt || s.openedAt || '')) === shiftDate)
    .sort((a: any, b: any) => new Date(a.openedAt || a.closedAt || 0).getTime() - new Date(b.openedAt || b.closedAt || 0).getTime());

  const shiftIdx = sameDayVehicleShifts.findIndex((s: any) => s.id === shift.id);

  // Inicio de ventana: no puede ser anterior al cierre del turno previo
  let windowStart = 0;
  if (shiftIdx > 0) {
    const prevShift = sameDayVehicleShifts[shiftIdx - 1];
    if (prevShift.closedAt) {
      windowStart = new Date(prevShift.closedAt).getTime();
    } else if (prevShift.openedAt) {
      windowStart = new Date(prevShift.openedAt).getTime() + 60 * 1000;
    }
  } else if (openedAt) {
    // Permite cargas hasta 25 min antes de que el vendedor abra sesión en la tablet
    windowStart = Math.max(0, new Date(openedAt).getTime() - 25 * 60 * 1000);
  } else if (shiftDate) {
    windowStart = new Date(`${shiftDate}T00:00:00`).getTime();
  }

  // Fin de ventana: no puede sobrepasar el cierre de este turno ni la apertura del siguiente
  let windowEnd = Infinity;
  if (closedAt) {
    windowEnd = new Date(closedAt).getTime() + 15 * 60 * 1000; // 15 min tras el cierre
  } else if (shiftIdx >= 0 && shiftIdx < sameDayVehicleShifts.length - 1) {
    const nextShift = sameDayVehicleShifts[shiftIdx + 1];
    if (nextShift.openedAt) {
      windowEnd = new Date(nextShift.openedAt).getTime();
    }
  }

  const inWindow = (ts: string) => {
    if (!ts) return false;
    const t = new Date(ts).getTime();
    return t >= windowStart && t <= windowEnd;
  };

  const isMovementMatch = (e: any, isCargaOrSobrante: boolean = true) => {
    if (!e) return false;
    // 1. Coincidencia por shiftId exacto
    if (e.shiftId && shift.id && e.shiftId === shift.id) return true;

    // 2. OBLIGATORIO: Coincidencia estricta de Vehículo / Triciclo (T1, T2...)
    const eVehicle = e.vehicleId || e.pointId || e.requester_point_id || e.vehicle;
    const isVehicleMatch = matchVehicleId(eVehicle, vehicleId);
    if (!isVehicleMatch) return false; // 🚫 Si no es el mismo triciclo, descartar de inmediato

    // 3. OBLIGATORIO: Coincidencia por Fecha (AAAA-MM-DD)
    const eDate = dateOf(e.timestamp || e.completed_at || e.created_at || e.fecha || '');
    if (shiftDate && eDate && eDate !== shiftDate) return false;

    // 4. Si sólo hay 1 turno para este vehículo hoy, todas las cargas y surtidos de hoy le pertenecen
    if (sameDayVehicleShifts.length <= 1) return true;

    // 5. Si hay múltiples turnos del mismo vehículo hoy, delimitar por ventana de tiempo (openedAt -> closedAt)
    return inWindow(e.timestamp || e.completed_at || e.created_at);
  };

  // Cargas
  const cargaMap: Record<string, { name: string; qty: number }> = {};
  const seenCargas = new Set<string>();
  loadHistory
    .filter((e: any) => {
      if (e.type !== 'carga') return false;
      if (seenCargas.has(e.id)) return false;
      if (!isMovementMatch(e, true)) return false;
      seenCargas.add(e.id);
      return true;
    })
    .forEach((e: any) => {
      (e.items || []).forEach(({ productId, qty, name }: any) => {
        if (!cargaMap[productId]) cargaMap[productId] = { name: name || priceMap[productId]?.name || productId, qty: 0 };
        cargaMap[productId].qty += qty;
      });
    });

  // Surtidos completados
  const surtidoMap: Record<string, { name: string; qty: number }> = {};
  const seenSurtidos = new Set<string>();
  completedRequests
    .filter((r: any) => {
      if (seenSurtidos.has(r.id)) return false;
      if (!isMovementMatch(r, false)) return false;
      seenSurtidos.add(r.id);
      return true;
    })
    .forEach((r: any) => {
      (r.items_payload || []).forEach(({ productId, qty, name }: any) => {
        if (!surtidoMap[productId]) surtidoMap[productId] = { name: name || priceMap[productId]?.name || productId, qty: 0 };
        surtidoMap[productId].qty += qty;
      });
    });

  // Recepciones / sobrantes
  const sobranteMap: Record<string, { name: string; qty: number }> = {};
  const seenRecepciones = new Set<string>();
  loadHistory
    .filter((e: any) => {
      if (e.type !== 'recepcion') return false;
      if (seenRecepciones.has(e.id)) return false;
      if (!isMovementMatch(e, true)) return false;
      seenRecepciones.add(e.id);
      return true;
    })
    .forEach((e: any) => {
      (e.items || []).forEach(({ productId, qty, name }: any) => {
        if (!sobranteMap[productId]) sobranteMap[productId] = { name: name || priceMap[productId]?.name || productId, qty: 0 };
        sobranteMap[productId].qty += qty;
      });
    });

  // Si el turno mismo tiene sobrantes registrados en su cierre (shift.sobrantes)
  if (closedAt && shift?.sobrantes && typeof shift.sobrantes === 'object') {
    Object.entries(shift.sobrantes).forEach(([pid, qty]: [string, any]) => {
      if (typeof qty === 'number' && qty > 0) {
        if (!sobranteMap[pid]) sobranteMap[pid] = { name: priceMap[pid]?.name || pid, qty: 0 };
        sobranteMap[pid].qty += qty;
      }
    });
  }

  const allIds = new Set([...Object.keys(cargaMap), ...Object.keys(surtidoMap), ...Object.keys(sobranteMap)]);
  const lines: any[] = [];
  let totalCarga = 0, totalSurtido = 0, totalSobrante = 0, totalVendido = 0, totalVendidoPesos = 0;

  allIds.forEach(pid => {
    const carga    = cargaMap[pid]?.qty    || 0;
    const surtido  = surtidoMap[pid]?.qty  || 0;
    const sobrante = sobranteMap[pid]?.qty || 0;
    const vendido  = Math.max(0, carga + surtido - sobrante);
    const price    = priceMap[pid]?.price || 0;
    const name     = cargaMap[pid]?.name || surtidoMap[pid]?.name || sobranteMap[pid]?.name || pid;
    totalCarga    += carga;
    totalSurtido  += surtido;
    totalSobrante += sobrante;
    totalVendido  += vendido;
    totalVendidoPesos += vendido * price;
    lines.push({ pid, name, carga, surtido, sobrante, vendido, price });
  });

  return { lines, totalCarga, totalSurtido, totalSobrante, totalVendido, totalVendidoPesos };
}

// ─── Card de un turno ─────────────────────────────────────────────────────────
function ShiftCard({ shift, loadHistory, completedRequests, priceMap, isExpanded, onToggle, onForceClose, allShifts }: any) {
  const vehicleId = shift.pointId || shift.vehicle || '?';
  const shiftDate = shift.fecha || shift.date || dateOf(shift.openedAt || shift.closedAt || '');
  const openedAt  = shift.openedAt || shift.start_time || null;
  const closedAt  = shift.closedAt || null;
  const jornada   = deriveJornada(shift); // ← usa hora real de apertura para AM/MD/PM
  const vendedor  = getVendedorName(shift, vehicleId, loadHistory, completedRequests);
  const isClosed  = !!closedAt;

  const { lines, totalCarga, totalSurtido, totalSobrante, totalVendido, totalVendidoPesos } =
    useMemo(() => buildShiftLogistics(shift, vehicleId, shiftDate, openedAt, closedAt, loadHistory, completedRequests, priceMap, allShifts),
      [shift, vehicleId, shiftDate, openedAt, closedAt, loadHistory, completedRequests, allShifts]);

  const hasData = lines.length > 0;

  return (
    <div className={`rounded-[2rem] border-2 overflow-hidden transition-all ${
      isClosed ? 'bg-white border-gray-100' : 'bg-amber-50 border-amber-200'
    }`}>
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white text-lg shadow-sm flex-shrink-0 ${
              isClosed ? 'bg-gray-400' : 'bg-amber-400'
            }`}>
              {vehicleId.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-black text-gray-900 text-lg">{vehicleId}</span>
                <span className="bg-amber-100 text-amber-700 text-[10px] font-black px-2 py-0.5 rounded-full tracking-widest">{jornada}</span>
                <span className="text-gray-400 text-xs font-bold">{shiftDate}</span>
                {isClosed
                  ? <span className="bg-green-100 text-green-700 text-[10px] font-black px-2 py-0.5 rounded-full">✅ CERRADO</span>
                  : <span className="bg-amber-200 text-amber-800 text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse">🔴 EN CURSO</span>
                }
              </div>
              {vendedor !== '—' && <p className="text-sm font-bold text-gray-500 mt-0.5">🧑 {vendedor}</p>}
              <p className="text-xs text-gray-400 font-bold mt-0.5">
                {fmtTime(openedAt)} → {isClosed ? fmtTime(closedAt) : 'En curso'}
              </p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            {hasData && (
              <div className="text-right">
                <p className="font-black text-gray-900 text-xl">{isClosed ? totalVendido : totalCarga + totalSurtido}</p>
                <p className="text-xs font-bold text-gray-400">{isClosed ? 'uds. vendidas' : 'uds. en ruta'}</p>
                {isClosed && totalVendidoPesos > 0 && (
                  <p className="text-sm font-black text-green-600 mt-0.5">{fmt(totalVendidoPesos)}</p>
                )}
              </div>
            )}
            {!isClosed && onForceClose && (
              <button
                onClick={onForceClose}
                className="flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-600 font-black text-xs px-3 py-2 rounded-xl border border-red-200 transition-all hover:scale-105 active:scale-95"
                title="Cerrar sesión forzosamente desde el Admin"
              >
                <AlertTriangle size={13} />
                Forzar Cierre
              </button>
            )}
          </div>
        </div>

        {hasData && (
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="bg-blue-50 rounded-2xl px-3 py-2.5 text-center">
              <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest flex items-center justify-center gap-1 mb-1">
                <Package size={10} /> Carga
              </p>
              <p className="text-lg font-black text-blue-700">{totalCarga}</p>
            </div>
            <div className="bg-orange-50 rounded-2xl px-3 py-2.5 text-center">
              <p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest flex items-center justify-center gap-1 mb-1">
                <RefreshCw size={10} /> Surtido
              </p>
              <p className="text-lg font-black text-orange-600">{totalSurtido}</p>
            </div>
            <div className="bg-purple-50 rounded-2xl px-3 py-2.5 text-center">
              <p className="text-[10px] font-bold text-purple-400 uppercase tracking-widest flex items-center justify-center gap-1 mb-1">
                <RotateCcw size={10} /> Sobrante
              </p>
              <p className="text-lg font-black text-purple-700">
                {totalSobrante > 0 ? totalSobrante : isClosed ? '0' : '—'}
              </p>
            </div>
          </div>
        )}

        {!hasData && (
          <div className="bg-gray-50 rounded-2xl px-4 py-3 text-center">
            <p className="text-gray-400 font-bold text-sm">
              {isClosed ? 'Sin movimientos logísticos registrados' : 'Esperando primera carga del Dejador…'}
            </p>
          </div>
        )}

        {hasData && (
          <button
            onClick={onToggle}
            className="text-sm font-bold text-amber-500 hover:text-amber-600 flex items-center gap-1 transition-colors"
          >
            {isExpanded
              ? <><ChevronUp size={16} /><span>Ocultar detalle</span></>
              : <><ChevronDown size={16} /><span>Ver detalle por producto</span></>}
          </button>
        )}
      </div>

      {isExpanded && hasData && (
        <div className="border-t border-gray-100 px-5 sm:px-6 py-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pb-3 pr-4">Producto</th>
                  <th className="text-[10px] font-bold text-blue-400 uppercase tracking-widest pb-3 pr-4 text-center">Carga</th>
                  <th className="text-[10px] font-bold text-orange-400 uppercase tracking-widest pb-3 pr-4 text-center">Surtido</th>
                  <th className="text-[10px] font-bold text-purple-400 uppercase tracking-widest pb-3 pr-4 text-center">Sobrante</th>
                  <th className="text-[10px] font-bold text-green-500 uppercase tracking-widest pb-3 text-center">Vendido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {lines
                  .filter(l => l.carga > 0 || l.surtido > 0)
                  .sort((a, b) => (b.carga + b.surtido) - (a.carga + a.surtido))
                  .map(l => (
                    <tr key={l.pid} className="hover:bg-gray-50 transition-colors">
                      <td className="py-2.5 pr-4 font-bold text-gray-800 truncate max-w-[140px]">{l.name}</td>
                      <td className="py-2.5 pr-4 text-center">
                        {l.carga > 0
                          ? <span className="bg-blue-50 text-blue-700 font-black text-xs px-2.5 py-1 rounded-full">{l.carga}</span>
                          : <span className="text-gray-300 font-bold">—</span>}
                      </td>
                      <td className="py-2.5 pr-4 text-center">
                        {l.surtido > 0
                          ? <span className="bg-orange-50 text-orange-600 font-black text-xs px-2.5 py-1 rounded-full">+{l.surtido}</span>
                          : <span className="text-gray-300 font-bold">—</span>}
                      </td>
                      <td className="py-2.5 pr-4 text-center">
                        {l.sobrante > 0
                          ? <span className="bg-purple-50 text-purple-600 font-black text-xs px-2.5 py-1 rounded-full">{l.sobrante}</span>
                          : <span className="text-gray-300 font-bold">{isClosed ? '0' : '—'}</span>}
                      </td>
                      <td className="py-2.5 text-center">
                        {isClosed
                          ? <span className={`font-black text-xs px-2.5 py-1 rounded-full ${l.vendido > 0 ? 'bg-green-50 text-green-700' : 'text-gray-300'}`}>{l.vendido}</span>
                          : <span className="text-gray-300 font-bold">—</span>}
                      </td>
                    </tr>
                  ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-100">
                  <td className="pt-3 font-black text-gray-600 text-xs uppercase tracking-wider">TOTAL</td>
                  <td className="pt-3 text-center"><span className="font-black text-blue-700">{totalCarga}</span></td>
                  <td className="pt-3 text-center"><span className="font-black text-orange-600">+{totalSurtido}</span></td>
                  <td className="pt-3 text-center"><span className="font-black text-purple-600">{isClosed ? totalSobrante : '—'}</span></td>
                  <td className="pt-3 text-center"><span className="font-black text-green-700">{isClosed ? totalVendido : '?'}</span></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab Principal ─────────────────────────────────────────────────────────────
export function AdminVehicleInventoryTab() {
  const posShifts = useInventoryStore((state: any) => state.posShifts) || [];
  const getPosItems = useInventoryStore((state: any) => state.getPosItems);
  const addPosShift = useInventoryStore((state: any) => state.addPosShift);
  const updatePosShift = useInventoryStore((state: any) => state.updatePosShift);
  const loadHistory = useLogisticsStore((state: any) => state.loadHistory) || [];
  const completedRequests = useLogisticsStore((state: any) => state.completedRequests) || [];
  const forceEndShift = useSellerSessionStore((s: any) => s.forceEndShift);

  const sellerSession = useSellerSessionStore() as any;

  const [filterDate,  setFilterDate]  = useState('');
  const [filterShift, setFilterShift] = useState('');
  const [expandedId,  setExpandedId]  = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [supabaseShifts, setSupabaseShifts] = useState<any[]>([]);
  const [supabaseLoaded, setSupabaseLoaded] = useState(() => (useInventoryStore.getState().posShifts || []).length > 0);

  const loadShiftsFromSupabase = async () => {
    try {
      const { data, error } = await supabase
        .from('app_state')
        .select('key, value')
        .or('key.ilike.posShifts%,key.ilike.deletedShiftIds%');

      if (!error && data) {
        const map: Record<string, any> = {};
        data.forEach((row: any) => { map[row.key] = row.value; });

        const shiftMap = new Map<string, any>();

        // Recopilar de TODAS las llaves de posShifts encontradas en app_state
        Object.keys(map).forEach(key => {
          if (key.includes('posShifts') && Array.isArray(map[key])) {
            map[key].forEach((s: any) => {
              if (!s?.id) return;
              const existing = shiftMap.get(s.id);
              if (!existing) {
                shiftMap.set(s.id, s);
              } else {
                const sTime = new Date(s.openedAt || s.closedAt || 0).getTime();
                const exTime = new Date(existing.openedAt || existing.closedAt || 0).getTime();
                if (!s.closedAt && existing.closedAt && sTime >= exTime) {
                  shiftMap.set(s.id, s);
                } else if (!existing.closedAt && s.closedAt && sTime > exTime + 60000) {
                  shiftMap.set(s.id, s);
                } else if (s.closedAt && existing.closedAt && new Date(s.closedAt).getTime() > new Date(existing.closedAt).getTime()) {
                  shiftMap.set(s.id, s);
                }
              }
            });
          }
        });

        // Recopilar de Zustand store también
        const storeShifts = useInventoryStore.getState().posShifts || [];
        storeShifts.forEach((s: any) => {
          if (!s?.id) return;
          const existing = shiftMap.get(s.id);
          if (!existing) {
            shiftMap.set(s.id, s);
          } else if (!s.closedAt && existing.closedAt) {
            shiftMap.set(s.id, s);
          }
        });

        const allShifts = Array.from(shiftMap.values());

        // Recopilar tombstones
        const deletedIds = new Set<string>();
        Object.keys(map).forEach(key => {
          if (key.includes('deletedShiftIds') && Array.isArray(map[key])) {
            map[key].forEach((id: string) => deletedIds.add(id));
          }
        });

        const filtered = allShifts.filter((s: any) => !deletedIds.has(s.id));
        setSupabaseShifts(filtered);

        // También actualizar el store de Zustand para que quede sincronizado
        useInventoryStore.setState({ posShifts: filtered });
      }
    } catch (e) {
      // No bloquear la UI si falla Supabase
    } finally {
      setSupabaseLoaded(true);
    }
  };

  // Asegurar carga de datos remotos al abrir la pestaña y suscripción en tiempo real
  useEffect(() => {
    loadShiftsFromSupabase();
    useLogisticsStore.getState().fetchPendingRequests().catch(() => {});
    useInventoryStore.getState().loadFromRemote().catch(() => {});

    // Forzar término de carga en máximo 1.5s para no bloquear la pantalla
    const safetyTimeout = setTimeout(() => setSupabaseLoaded(true), 1500);

    // Intervalo de respaldo cada 10 segundos
    const interval = setInterval(loadShiftsFromSupabase, 10000);

    // Canal Realtime para cambios instantáneos
    const channel = supabase
      .channel(`admin-shifts-live-sync-${Date.now()}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'app_state'
      }, (payload) => {
        const key = payload.new?.key || '';
        if (key.includes('posShifts') || key.includes('vendorLocations')) {
          loadShiftsFromSupabase();
        }
      })
      .subscribe();

    return () => {
      clearTimeout(safetyTimeout);
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await loadShiftsFromSupabase();
      await useLogisticsStore.getState().fetchPendingRequests();
    } finally {
      setIsRefreshing(false);
    }
  };

  // Mapa de precios
  const products = getPosItems();
  const priceMap: Record<string, { price: number; name: string }> = {};
  (products || []).forEach((p: any) => { priceMap[p.id] = { price: p.price || 0, name: p.name }; });

  // ── Construir lista combinada de turnos ──────────────────────────────────────
  // Fuente primaria: supabaseShifts (cargados directamente al montar la vista)
  // Fuente reactiva: posShifts del store de Zustand (se actualiza en tiempo real)
  const storedShifts: any[] = useMemo(() => {
    // Combinar ambas fuentes: supabase (confiable) + store (tiempo real)
    const combined = [...supabaseShifts, ...(posShifts || [])];

    const isVehicleShift = (s: any) => {
      if (!s || !s.id) return false;
      const typeStr = String(s.type || '').toUpperCase();

      // 🚫 EXCLUIR ESTRICTAMENTE TURNOS DE CAJERO / PUNTO DE VENTA (van en el módulo Punto de Venta)
      if (typeStr === 'POS' || typeStr === 'CAJERO' || typeStr === 'PUNTO_DE_VENTA' || typeStr === 'CAJA') return false;
      if (s.registerId || s.cajaId || s.isCashier) return false;

      // Incluir únicamente turnos de VENDEDOR, DEJADOR o VEHÍCULO DE FLOTA
      if (typeStr === 'VENDEDOR' || typeStr === 'DEJADOR' || typeStr === 'VEHICULO' || typeStr === 'TRICICLO') return true;
      if (s.vehicle || s.pointId) return true;
      return false;
    };

    const raw = combined.filter(isVehicleShift);

    // ── Deduplicar por ID único de turno o vehículo (favoreciendo turnos ABIERTOS en curso) ──
    const shiftIdMap = new Map<string, any>();
    raw.forEach((s: any) => {
      if (!s?.id) return;
      const existing = shiftIdMap.get(s.id);
      if (!existing) {
        shiftIdMap.set(s.id, s);
      } else {
        // Mismo ID: si una versión tiene fecha de cierre (closedAt), esa versión prevalece para mantener el cierre firme
        if (s.closedAt && !existing.closedAt) {
          shiftIdMap.set(s.id, s);
        } else if (!s.closedAt && existing.closedAt) {
          shiftIdMap.set(s.id, existing);
        } else if (s.closedAt && existing.closedAt) {
          if (new Date(s.closedAt).getTime() >= new Date(existing.closedAt).getTime()) {
            shiftIdMap.set(s.id, s);
          }
        } else {
          // Ambos abiertos: preferir la versión del store (más reciente)
          shiftIdMap.set(s.id, s);
        }
      }
    });

    return Array.from(shiftIdMap.values());
  }, [posShifts, supabaseShifts]);

  // Fecha de hoy local
  const today = dateOf(new Date().toISOString());

  const vendorLocations = useInventoryStore((s: any) => s.vendorLocations) || {};

  const liveShifts: any[] = useMemo(() => {
    const lives: any[] = [];

    if (sellerSession?.isSetupComplete && sellerSession?.pointId) {
      const pId = sellerSession.pointId;
      const matchingStored = storedShifts.filter((s: any) => matchVehicleId(s.pointId, pId));
      const hasOpenShift = matchingStored.some((s: any) => !s.closedAt);
      
      // Si NO hay ningún turno abierto registrado para este vehículo hoy, agregar sesión local en vivo
      if (!hasOpenShift) {
        lives.push({
          id: `LIVE-${pId}`,
          pointId: pId,
          shift: sellerSession.shift || 'AM',
          responsibleName: sellerSession.responsibleName || 'Vendedor',
          openedAt: sellerSession.openedAt || new Date().toISOString(),
          closedAt: null,
          type: 'VENDEDOR',
          _isLive: true,
        });
      }
    }

    // Solo generar liveShifts por GPS cuando los turnos remotos ya hayan cargado para evitar destellos
    if (!supabaseLoaded && supabaseShifts.length === 0) return lives;

    Object.values(vendorLocations).forEach((loc: any) => {
      const pId = loc?.pointId || loc?.name;
      if (!pId || loc?.isActive === false) return;

      // Descartar pings GPS viejos (más de 30 minutos sin actualizar)
      const locTime = loc.updatedAt || loc.timestamp;
      if (locTime) {
        const ageMs = Date.now() - new Date(locTime).getTime();
        if (ageMs > 30 * 60 * 1000) return;
      }

      const matchingStored = storedShifts.filter((s: any) => matchVehicleId(s.pointId, pId));
      const hasOpenShift = matchingStored.some((s: any) => !s.closedAt);

      // Si NO hay ningún turno abierto registrado para este vehículo, agregar fake live por GPS activo
      if (!hasOpenShift) {
        const alreadyInLives = lives.some((l: any) => matchVehicleId(l.pointId, pId));
        if (!alreadyInLives) {
          lives.push({
            id: `LIVE-GPS-${pId}`,
            pointId: pId,
            shift: loc.shift || 'AM',
            responsibleName: loc.name || 'Vendedor en Ruta',
            openedAt: loc.openedAt || loc.updatedAt || loc.timestamp || new Date().toISOString(),
            closedAt: null,
            type: 'VENDEDOR',
            _isLive: true,
          });
        }
      }
    });

    return lives;
  }, [sellerSession, storedShifts, vendorLocations, today]);

  const allShifts: any[] = useMemo(() => {
    const combined = [...liveShifts, ...storedShifts];
    return combined.sort((a: any, b: any) => {
      if (!a.closedAt && b.closedAt) return -1;
      if (a.closedAt && !b.closedAt) return 1;
      const tA = new Date(a.closedAt || a.openedAt || 0).getTime();
      const tB = new Date(b.closedAt || b.openedAt || 0).getTime();
      return tB - tA;
    });
  }, [liveShifts, storedShifts]);

  const filteredShifts = useMemo(() => {
    return allShifts.filter((s: any) => {
      const sDate    = s.fecha || s.date || dateOf(s.openedAt || s.closedAt || '');
      const sJornada = s.shift || '';
      if (filterDate  && sDate    !== filterDate)  return false;
      if (filterShift && sJornada !== filterShift) return false;
      return true;
    });
  }, [allShifts, filterDate, filterShift]);

  // Contar todos los turnos abiertos en curso reales (!closedAt)
  const activeCount = useMemo(() => {
    return filteredShifts.filter((s: any) => !s.closedAt).length;
  }, [filteredShifts]);

  const closedCount = filteredShifts.filter((s: any) => !!s.closedAt).length;
  const uniqueDates = new Set(filteredShifts.map((s: any) => s.fecha || s.date || dateOf(s.closedAt || s.openedAt || ''))).size;

  const availableJornadas = useMemo(() => {
    const j = new Set(allShifts.map((s: any) => s.shift).filter(Boolean));
    return Array.from(j) as string[];
  }, [allShifts]);

  return (
    <div className="flex-1 p-4 space-y-5">

      <div className="flex items-center gap-3 flex-wrap bg-gray-50 p-3 rounded-2xl border border-gray-100 justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-white px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold">
            <span className="text-gray-400">Fecha:</span>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="outline-none text-gray-700 bg-transparent font-bold cursor-pointer"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-white px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold">
            <span className="text-gray-400">Jornada:</span>
            <select
              value={filterShift}
              onChange={(e) => setFilterShift(e.target.value)}
              className="outline-none text-gray-700 bg-transparent font-bold cursor-pointer"
            >
              <option value="">Todas</option>
              {availableJornadas.map(j => (
                <option key={j} value={j}>{j}</option>
              ))}
            </select>
          </div>

          {(filterDate || filterShift) && (
            <button
              onClick={() => { setFilterDate(''); setFilterShift(''); }}
              className="text-xs text-red-500 font-bold px-2 py-1 hover:underline"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 bg-white hover:bg-gray-100 text-gray-700 font-bold text-xs px-3 py-2 rounded-xl border border-gray-200 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
          {isRefreshing ? 'Actualizando...' : 'Actualizar'}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-center">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">En Curso</p>
          <p className="text-2xl font-black text-amber-600 leading-none mt-1">{activeCount}</p>
        </div>
        <div className="bg-green-50 border border-green-100 rounded-2xl p-4 text-center">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Cerrados</p>
          <p className="text-2xl font-black text-green-600 leading-none mt-1">{closedCount}</p>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-center">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Fechas</p>
          <p className="text-2xl font-black text-blue-600 leading-none mt-1">{uniqueDates || '—'}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        <p className="text-xs font-bold text-gray-400">
          Datos en tiempo real · <span className="text-blue-500">Carga</span> + <span className="text-orange-500">Surtidos</span> − <span className="text-purple-500">Sobrantes</span>
          {liveShifts.length > 0 && <span className="text-amber-600 ml-2">· 🔴 {liveShifts.length} {liveShifts.length === 1 ? 'sesión en vivo detectada' : 'sesiones en vivo detectadas'}</span>}
        </p>
      </div>

      {filteredShifts.length === 0 ? (
        <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-3xl p-10 text-center">
          <span className="text-5xl block mb-4">📋</span>
          <p className="font-black text-gray-600 text-lg">No hay turnos registrados</p>
          <p className="text-gray-400 font-bold text-sm mt-1">
            {filterDate || filterShift
              ? 'Cambia los filtros de fecha / jornada'
              : 'El turno aparece aquí en cuanto el Vendedor inicia sesión'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredShifts.map((shift: any) => (
            <ShiftCard
              key={shift.id}
              shift={shift}
              loadHistory={loadHistory || []}
              completedRequests={completedRequests || []}
              priceMap={priceMap}
              allShifts={allShifts}
              isExpanded={expandedId === shift.id}
              onToggle={() => setExpandedId(expandedId === shift.id ? null : shift.id)}
              onForceClose={!shift.closedAt ? async () => {
                const vendedorName = shift.responsibleName || 'desconocido';
                const confirm = window.confirm(
                  `¿Confirmas el CIERRE FORZADO del turno ${shift.pointId} (${shift.shift}) de "${vendedorName}"?\n\nEsta acción cerrará la sesión activa del Vendedor desde el panel Admin.`
                );
                if (!confirm) return;

                const closedAt = new Date().toISOString();
                const targetPointId = shift.pointId;

                // 1. Marcar como CERRADOS todos los turnos abiertos de este vehículo preservando la lista completa
                const allKnownShifts = [...supabaseShifts, ...(useInventoryStore.getState().posShifts || [])];
                const shiftMap = new Map<string, any>();
                allKnownShifts.forEach((s: any) => {
                  if (s && s.id) shiftMap.set(s.id, s);
                });

                // Calcular ventas teóricas antes de cerrar forzosamente
                const sDate = shift.fecha || shift.date || dateOf(shift.openedAt || shift.closedAt || '');
                const logCalc = buildShiftLogistics(
                  shift, targetPointId, sDate, shift.openedAt, closedAt, loadHistory, completedRequests, priceMap, allShifts
                );
                const theorySalesVal = logCalc.totalVendidoPesos || 0;

                let shiftModified = false;
                shiftMap.forEach((s: any, id: string) => {
                  const matchPoint = matchVehicleId(s.pointId || s.vehicle || s.point_id, targetPointId);
                  const matchId = s.id === shift.id;
                  if ((matchPoint || matchId) && !s.closedAt) {
                    shiftModified = true;
                    shiftMap.set(id, {
                      ...s,
                      closedAt,
                      forcedByAdmin: true,
                      theorySales: theorySalesVal,
                      realAmount: theorySalesVal,
                      cashAmount: theorySalesVal,
                      totalVendido: logCalc.totalVendido,
                    });
                  }
                });

                if (!shiftModified) {
                  const fallbackId = shift.id && !shift.id.startsWith('LIVE-') ? shift.id : `SHIFT-FORCED-${Date.now()}`;
                  shiftMap.set(fallbackId, {
                    ...shift,
                    id: fallbackId,
                    closedAt,
                    forcedByAdmin: true,
                    type: 'VENDEDOR',
                    theorySales: theorySalesVal,
                    realAmount: theorySalesVal,
                    cashAmount: theorySalesVal,
                    totalVendido: logCalc.totalVendido,
                  });
                }

                const updatedShifts = Array.from(shiftMap.values());

                // Actualizar store y estado local inmediatamente
                useInventoryStore.setState({ posShifts: updatedShifts });
                setSupabaseShifts(updatedShifts);

                // 2. Persistir directamente en Supabase (todas las llaves para sincronización inmediata)
                try {
                  const nowIso = new Date().toISOString();
                  await Promise.allSettled([
                    supabase.from('app_state').upsert({ key: 'posShifts', value: updatedShifts, updated_at: nowIso }, { onConflict: 'key' }),
                    supabase.from('app_state').upsert({ key: 'posShifts_BRANCH-001', value: updatedShifts, updated_at: nowIso }, { onConflict: 'key' }),
                    supabase.from('app_state').upsert({ key: 'posShifts_master_history', value: updatedShifts, updated_at: nowIso }, { onConflict: 'key' }),
                  ]);
                } catch (e) {
                  console.warn('[ForzarCierre] Error sincronizando posShifts en Supabase:', e);
                }

                // 3. Desactivar GPS y ubicación del vendedor en Supabase y localmente
                try {
                  useInventoryStore.getState().clearVendorLocation(targetPointId);

                  // Limpiar en app_state (ambas llaves: global + sede)
                  const clearFromAppState = async (key: string) => {
                    const { data } = await supabase.from('app_state').select('value').eq('key', key).maybeSingle();
                    if (!data?.value || typeof data.value !== 'object') return;
                    const locs = { ...data.value } as Record<string, any>;
                    const cleanTarget = String(targetPointId).toLowerCase().replace(/[^a-z0-9]/g, '');
                    Object.keys(locs).forEach(k => {
                      const loc = locs[k];
                      const cleanK = String(k).toLowerCase().replace(/[^a-z0-9]/g, '');
                      const cleanP = String(loc?.pointId || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                      if (cleanK === cleanTarget || cleanP === cleanTarget) delete locs[k];
                    });
                    await supabase.from('app_state').upsert({ key, value: locs, updated_at: new Date().toISOString() }, { onConflict: 'key' });
                  };
                  await clearFromAppState('vendorLocations');
                  await clearFromAppState('vendorLocations_BRANCH-001');
                } catch (e) {
                  console.warn('[ForzarCierre] Warning al desactivar vendorLocations:', e);
                }

                // 4. Si la sesión activa del browser coincide con este punto, cerrarla
                if (sellerSession?.pointId && matchVehicleId(sellerSession.pointId, targetPointId)) {
                  forceEndShift();
                }
              } : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function VehicleShiftCard({
  vehicleId,
  currentShift,
  activeOnly = false,
}: {
  vehicleId: string;
  currentShift?: string;
  activeOnly?: boolean;
}) {
  const { posShifts, getPosItems } = useInventoryStore();
  const vendorLocations = useInventoryStore((s: any) => s.vendorLocations) || {};
  const sellerSession = useSellerSessionStore() as any;
  const { loadHistory, completedRequests } = useLogisticsStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [remoteShifts, setRemoteShifts] = useState<any[]>([]);

  useEffect(() => {
    supabase
      .from('app_state')
      .select('key,value')
      .in('key', [
        'posShifts_BRANCH-001', 'posShifts',
        'loadHistory_BRANCH-001', 'loadHistory',
        'completedRequests_BRANCH-001', 'completedRequests',
        'vendorLocations_BRANCH-001', 'vendorLocations'
      ])
      .then(({ data }) => {
        if (data) {
          const map: Record<string, any> = {};
          data.forEach(r => { map[r.key] = r.value; });
          const all = [...(map['posShifts_BRANCH-001'] || map['posShifts'] || [])];
          setRemoteShifts(all);
          if (map['loadHistory_BRANCH-001'] || map['loadHistory']) {
            useLogisticsStore.setState({ loadHistory: map['loadHistory_BRANCH-001'] || map['loadHistory'] });
          }
          if (map['completedRequests_BRANCH-001'] || map['completedRequests']) {
            useLogisticsStore.setState({ completedRequests: map['completedRequests_BRANCH-001'] || map['completedRequests'] });
          }
          if (map['vendorLocations_BRANCH-001'] || map['vendorLocations']) {
            useInventoryStore.setState({ vendorLocations: map['vendorLocations_BRANCH-001'] || map['vendorLocations'] });
          }
        }
      })
      .catch(() => {});
  }, [vehicleId]);

  const combinedShifts = useMemo(() => {
    const byId = new Map<string, any>();
    [...remoteShifts, ...(posShifts || [])].forEach((s: any) => {
      if (!s?.id) return;
      const existing = byId.get(s.id);
      if (!existing || (!existing.closedAt && s.closedAt)) {
        byId.set(s.id, s);
      }
    });
    return Array.from(byId.values());
  }, [remoteShifts, posShifts]);

  const today = dateOf(new Date().toISOString());

  const products = getPosItems();
  const priceMap: Record<string, { price: number; name: string }> = {};
  (products || []).forEach((p: any) => { priceMap[p.id] = { price: p.price || 0, name: p.name }; });

  const liveShift = useMemo(() => {
    if (sellerSession?.isSetupComplete && matchVehicleId(sellerSession?.pointId, vehicleId)) {
      const matchingStored = combinedShifts.filter((s: any) => matchVehicleId(s.pointId, vehicleId));
      const hasOpenShift = matchingStored.some((s: any) => !s.closedAt);

      if (!hasOpenShift) {
        return {
          id: `LIVE-${vehicleId}`,
          pointId: vehicleId,
          shift: sellerSession.shift || 'AM',
          responsibleName: sellerSession.responsibleName || 'Vendedor',
          openedAt: sellerSession.openedAt || new Date().toISOString(),
          closedAt: null,
          type: 'VENDEDOR',
          _isLive: true,
        };
      }
    }

    const matchedLoc: any = Object.values(vendorLocations).find((loc: any) =>
      matchVehicleId(loc?.pointId || loc?.name, vehicleId) && loc?.isActive !== false
    );
    if (matchedLoc) {
      const matchingStored = combinedShifts.filter((s: any) => matchVehicleId(s.pointId, vehicleId));
      const hasOpenShift = matchingStored.some((s: any) => !s.closedAt);

      if (!hasOpenShift) {
        return {
          id: `LIVE-GPS-${vehicleId}`,
          pointId: vehicleId,
          shift: matchedLoc.shift || 'AM',
          responsibleName: matchedLoc.name || 'Vendedor en Ruta',
          openedAt: matchedLoc.openedAt || matchedLoc.updatedAt || matchedLoc.timestamp || new Date().toISOString(),
          closedAt: null,
          type: 'VENDEDOR',
          _isLive: true,
        };
      }
    }

    return null;
  }, [sellerSession, combinedShifts, vendorLocations, vehicleId, today]);

  // Buscar el turno correcto con prioridad:
  // 1. Sesión live del vendedor
  // 2. PRIMERA PRIORIDAD: Cualquier turno abierto (!closedAt) que coincida con el vehículo
  // 3. Turno de hoy que coincida con jornada actual (solo si !activeOnly)
  // 4. Turno de hoy (si !activeOnly)
  // 5. El más reciente (fallback — solo si !activeOnly)
  // 6. Si activeOnly=true y hay cargas/surtidos hoy para este vehículo, inyectar turno activo sintético
  const shift = useMemo(() => {
    if (liveShift) return liveShift;

    const forVehicle = combinedShifts.filter(
      (s: any) => s.type === 'VENDEDOR' && matchVehicleId(s.pointId, vehicleId)
    );

    // 1. CUALQUIER TURNO ACTIVO ABIERTO (!closedAt) TIENE MÁXIMA PRIORIDAD
    const anyActiveOpen = forVehicle.find((s: any) => !s.closedAt);
    if (anyActiveOpen) return anyActiveOpen;

    if (currentShift) {
      if (!activeOnly) {
        // Hoy + jornada actual (aunque esté cerrado)
        const todayMatchingShift = forVehicle
          .filter((s: any) => {
            const sDate = s.fecha || dateOf(s.closedAt || s.openedAt || '');
            return sDate === today && s.shift === currentShift;
          })
          .sort((a: any, b: any) =>
            new Date(b.openedAt || 0).getTime() - new Date(a.openedAt || 0).getTime()
          )[0];
        if (todayMatchingShift) return todayMatchingShift;
      }
    }

    // Fallback: cualquier turno de hoy (cerrado) si !activeOnly
    if (!activeOnly) {
      const todayShift = forVehicle
        .filter((s: any) => {
          const sDate = s.fecha || dateOf(s.closedAt || s.openedAt || '');
          return sDate === today;
        })
        .sort((a: any, b: any) =>
          new Date(b.openedAt || 0).getTime() - new Date(a.openedAt || 0).getTime()
        )[0];
      if (todayShift) return todayShift;

      // Fallback final al más reciente
      return forVehicle.sort((a: any, b: any) =>
        new Date(b.openedAt || 0).getTime() - new Date(a.openedAt || 0).getTime()
      )[0] || null;
    }

    // Si activeOnly es true, pero hay movimientos logísticos hoy para este vehículo, inyectar turno sintético activo
    if (activeOnly) {
      const hasLoadsToday = (loadHistory || []).some(
        (e: any) => matchVehicleId(e.vehicleId, vehicleId) && dateOf(e.timestamp) === today
      );
      const hasRequestsToday = (completedRequests || []).some(
        (r: any) => matchVehicleId(r.requester_point_id, vehicleId) && dateOf(r.completed_at || r.created_at) === today
      );
      if (hasLoadsToday || hasRequestsToday) {
        return {
          id: `AUTO-ACTIVE-${vehicleId}`,
          pointId: vehicleId,
          shift: currentShift || 'AM',
          responsibleName: 'Vendedor en Ruta',
          openedAt: today + 'T00:00:00',
          closedAt: null,
          type: 'VENDEDOR',
          _isLive: true,
        };
      }
    }

    return null;
  }, [posShifts, vehicleId, liveShift, currentShift, activeOnly, today, loadHistory, completedRequests]);

  if (!vehicleId) return null;

  if (!shift) {
    return (
      <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-3xl px-6 py-8 text-center mt-4">
        <span className="text-3xl block mb-2">🛵</span>
        <p className="font-bold text-gray-500 text-sm">
          {activeOnly
            ? <>Sin turno activo para <strong>{vehicleId}</strong> ahora</>
            : <>Sin turno {currentShift ? `(${currentShift}) ` : ''}registrado para <strong>{vehicleId}</strong> hoy</>
          }
        </p>
        <p className="text-gray-400 text-xs mt-1">El turno aparece cuando el Vendedor inicia sesión</p>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <ShiftCard
        shift={shift}
        loadHistory={loadHistory || []}
        completedRequests={completedRequests || []}
        priceMap={priceMap}
        allShifts={combinedShifts}
        isExpanded={isExpanded}
        onToggle={() => setIsExpanded(e => !e)}
        onForceClose={!shift.closedAt ? async () => {
          const vendedorName = shift.responsibleName || 'desconocido';
          const targetPointId = shift.pointId || vehicleId;
          const confirm = window.confirm(
            `¿Confirmas el CIERRE FORZADO del turno ${targetPointId} de "${vendedorName}"?\n\nEsta acción cerrará la sesión activa del Vendedor desde el panel Admin.`
          );
          if (!confirm) return;

          const closedAt = new Date().toISOString();
          const allKnownShifts = useInventoryStore.getState().posShifts || [];
          const shiftMap = new Map<string, any>();
          allKnownShifts.forEach((s: any) => {
            if (s && s.id) shiftMap.set(s.id, s);
          });

          let shiftModified = false;
          shiftMap.forEach((s: any, id: string) => {
            const matchPoint = matchVehicleId(s.pointId || s.vehicle || s.point_id, targetPointId);
            const matchId = s.id === shift.id;
            if ((matchPoint || matchId) && !s.closedAt) {
              shiftModified = true;
              shiftMap.set(id, { ...s, closedAt, forcedByAdmin: true });
            }
          });

          if (!shiftModified) {
            const fallbackId = shift.id && !shift.id.startsWith('LIVE-') ? shift.id : `SHIFT-FORCED-${Date.now()}`;
            shiftMap.set(fallbackId, { ...shift, id: fallbackId, closedAt, forcedByAdmin: true, type: 'VENDEDOR' });
          }

          const updatedShifts = Array.from(shiftMap.values());
          useInventoryStore.setState({ posShifts: updatedShifts });
          useInventoryStore.getState().clearVendorLocation(targetPointId);

          const nowIso = new Date().toISOString();
          await Promise.allSettled([
            supabase.from('app_state').upsert({ key: 'posShifts', value: updatedShifts, updated_at: nowIso }, { onConflict: 'key' }),
            supabase.from('app_state').upsert({ key: 'posShifts_BRANCH-001', value: updatedShifts, updated_at: nowIso }, { onConflict: 'key' }),
            supabase.from('app_state').upsert({ key: 'posShifts_master_history', value: updatedShifts, updated_at: nowIso }, { onConflict: 'key' }),
            supabase.from('app_state').upsert({ key: 'vendorLocations', value: {}, updated_at: nowIso }, { onConflict: 'key' }),
            supabase.from('app_state').upsert({ key: 'vendorLocations_BRANCH-001', value: {}, updated_at: nowIso }, { onConflict: 'key' }),
          ]);
          toast.success(`Turno ${targetPointId} cerrado forzosamente`);
        } : undefined}
      />
    </div>
  );
}
