import React, { useState, useMemo } from 'react';
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
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n || 0);

const fmtTime = (iso: string) =>
  iso ? new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '—';

// ─── Construye el resumen logístico de un turno ───────────────────────────────
function buildShiftLogistics(
  vehicleId: string,
  shiftDate: string,
  openedAt: string | null,
  closedAt: string | null,
  loadHistory: any[],
  completedRequests: any[],
  priceMap: Record<string, { price: number; name: string }>
) {
  // Use START OF DAY as lower bound so loads made before the vendor opens their session
  // (which is the normal Dejador workflow) are still counted. Mirrors calcSoldByVehicle.
  const fromDay: number = (() => {
    const ref = openedAt || (shiftDate ? `${shiftDate}T00:00:00` : null);
    if (!ref) return 0;
    const d = new Date(ref);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); // midnight local
  })();
  const to = closedAt ? new Date(closedAt).getTime() : Date.now();

  const inWindow = (ts: string) => {
    if (!ts) return false;
    const t = new Date(ts).getTime();
    return t >= fromDay && t <= to;
  };

  // Cargas
  const cargaMap: Record<string, { name: string; qty: number }> = {};
  const seenCargas = new Set<string>();
  loadHistory
    .filter((e: any) => e.type === 'carga' && matchVehicleId(e.vehicleId, vehicleId)
      && inWindow(e.timestamp) && !seenCargas.has(e.id) && (seenCargas.add(e.id) || true))
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
    .filter((r: any) => matchVehicleId(r.requester_point_id, vehicleId)
      && inWindow(r.completed_at || r.created_at)
      && !seenSurtidos.has(r.id) && (seenSurtidos.add(r.id) || true))
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
    .filter((e: any) => e.type === 'recepcion' && matchVehicleId(e.vehicleId, vehicleId)
      && inWindow(e.timestamp) && !seenRecepciones.has(e.id) && (seenRecepciones.add(e.id) || true))
    .forEach((e: any) => {
      (e.items || []).forEach(({ productId, qty, name }: any) => {
        if (!sobranteMap[productId]) sobranteMap[productId] = { name: name || priceMap[productId]?.name || productId, qty: 0 };
        sobranteMap[productId].qty += qty;
      });
    });

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
function ShiftCard({ shift, loadHistory, completedRequests, priceMap, isExpanded, onToggle, onForceClose }: any) {
  const vehicleId = shift.pointId || shift.vehicle || '?';
  const shiftDate = shift.fecha || dateOf(shift.closedAt || shift.openedAt || '');
  const openedAt  = shift.openedAt || shift.start_time || null;
  const closedAt  = shift.closedAt || null;
  const jornada   = shift.shift || '—';
  const vendedor  = getVendedorName(shift, vehicleId, loadHistory, completedRequests);
  const isClosed  = !!closedAt;

  const { lines, totalCarga, totalSurtido, totalSobrante, totalVendido, totalVendidoPesos } =
    useMemo(() => buildShiftLogistics(vehicleId, shiftDate, openedAt, closedAt, loadHistory, completedRequests, priceMap),
      [vehicleId, shiftDate, openedAt, closedAt, loadHistory, completedRequests]);

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
  const { loadHistory, completedRequests } = useLogisticsStore();
  const { posShifts, getPosItems, addPosShift, updatePosShift } = useInventoryStore();
  const forceEndShift = useSellerSessionStore((s: any) => s.forceEndShift);

  // ── Leer sesión activa LOCAL del vendedor directamente ──────────────────────
  // Esto captura el turno en curso aunque no haya sincronizado con posShifts todavía
  const sellerSession = useSellerSessionStore() as any;

  const [filterDate,  setFilterDate]  = useState('');
  const [filterShift, setFilterShift] = useState('');
  const [expandedId,  setExpandedId]  = useState<string | null>(null);

  // Mapa de precios
  const products = getPosItems();
  const priceMap: Record<string, { price: number; name: string }> = {};
  (products || []).forEach((p: any) => { priceMap[p.id] = { price: p.price || 0, name: p.name }; });

  // ── Construir lista combinada de turnos ──────────────────────────────────────
  // Fuente 1: posShifts — solo turnos de VENDEDOR (excluye POS caja y DEJADOR)
  const storedShifts: any[] = useMemo(() => {
    const raw = (posShifts || []).filter((s: any) => s.type === 'VENDEDOR');

    const uniqueMap = new Map<string, any>();
    raw.forEach((s: any) => {
      const key = s.id || `${s.pointId}_${s.responsibleName}_${s.openedAt}`;
      const existing = uniqueMap.get(key);
      if (!existing) {
        uniqueMap.set(key, s);
      } else if (!existing.closedAt && s.closedAt) {
        uniqueMap.set(key, s);
      }
    });

    return Array.from(uniqueMap.values());
  }, [posShifts]);

  // Fecha de hoy local
  const today = dateOf(new Date().toISOString());

  const liveShifts: any[] = useMemo(() => {
    const lives: any[] = [];

    if (sellerSession?.isSetupComplete && sellerSession?.pointId) {
      const pId = sellerSession.pointId;
      const matchingStored = storedShifts.filter((s: any) => matchVehicleId(s.pointId, pId));
      const hasOpenShift = matchingStored.some((s: any) => !s.closedAt);
      const hasClosedShiftToday = matchingStored.some((s: any) => s.closedAt && (dateOf(s.closedAt) === today || dateOf(s.openedAt) === today));
      
      if (!hasOpenShift && !hasClosedShiftToday) {
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

    const vendorLocs = (useInventoryStore.getState() as any).vendorLocations || {};
    Object.values(vendorLocs).forEach((loc: any) => {
      const pId = loc?.pointId || loc?.name;
      if (!pId) return;

      const matchingStored = storedShifts.filter((s: any) => matchVehicleId(s.pointId, pId));
      const hasOpenShift = matchingStored.some((s: any) => !s.closedAt);
      const hasClosedShiftToday = matchingStored.some((s: any) => s.closedAt && (dateOf(s.closedAt) === today || dateOf(s.openedAt) === today));

      if (hasOpenShift || hasClosedShiftToday) return;

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
    });

    return lives;
  }, [sellerSession, storedShifts, today]);

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
      const sDate    = s.fecha || dateOf(s.closedAt || s.openedAt || '');
      const sJornada = s.shift || '';
      if (filterDate  && sDate    !== filterDate)  return false;
      if (filterShift && sJornada !== filterShift) return false;
      return true;
    });
  }, [allShifts, filterDate, filterShift]);

  const activeCount = filteredShifts.filter((s: any) => !s.closedAt).length;
  const closedCount = filteredShifts.filter((s: any) => !!s.closedAt).length;
  const uniqueDates = new Set(filteredShifts.map((s: any) => s.fecha || dateOf(s.closedAt || s.openedAt || ''))).size;

  const availableJornadas = useMemo(() => {
    const j = new Set(allShifts.map((s: any) => s.shift).filter(Boolean));
    return Array.from(j) as string[];
  }, [allShifts]);

  return (
    <div className="flex-1 p-4 space-y-5">

      <div className="flex items-center gap-3 flex-wrap bg-gray-50 p-3 rounded-2xl border border-gray-100">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-gray-500">Fecha:</span>
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="text-xs font-bold bg-white border border-gray-200 rounded-xl px-2.5 py-1.5 outline-none focus:border-amber-400"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-gray-500">Jornada:</span>
          <select
            value={filterShift}
            onChange={(e) => setFilterShift(e.target.value)}
            className="text-xs font-bold bg-white border border-gray-200 rounded-xl px-2.5 py-1.5 outline-none focus:border-amber-400"
          >
            <option value="">Todas</option>
            {availableJornadas.map((j) => (
              <option key={j} value={j}>{j}</option>
            ))}
          </select>
        </div>
        {(filterDate || filterShift) && (
          <button
            onClick={() => { setFilterDate(''); setFilterShift(''); }}
            className="text-xs font-bold text-red-500 hover:text-red-700 px-2 py-1 bg-red-50 rounded-lg active:scale-95 transition-all"
          >
            Limpiar filtros
          </button>
        )}
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

                const matchingShifts = (posShifts || []).filter(
                  (s: any) => s.type === 'VENDEDOR' && !s.closedAt && matchVehicleId(s.pointId, targetPointId)
                );
                if (matchingShifts.length > 0) {
                  matchingShifts.forEach((s: any) => {
                    updatePosShift(s.id, { closedAt, forcedByAdmin: true });
                  });
                } else {
                  addPosShift({
                    ...shift,
                    id: shift.id.startsWith('LIVE-') ? `SHIFT-FORCED-${Date.now()}` : shift.id,
                    closedAt,
                    forcedByAdmin: true,
                    type: 'VENDEDOR',
                  });
                }

                try {
                  useInventoryStore.getState().clearVendorLocation(targetPointId);

                  await supabase
                    .from('vendor_locations')
                    .delete()
                    .or(`point_id.ilike.%${targetPointId}%,assigned_vendor_id.ilike.%${targetPointId}%,name.ilike.%${targetPointId}%`);

                  await supabase
                    .from('vendor_locations')
                    .update({ is_active: false })
                    .or(`point_id.ilike.%${targetPointId}%,assigned_vendor_id.ilike.%${targetPointId}%,name.ilike.%${targetPointId}%`);
                } catch (e) {
                  console.warn('[ForzarCierre] Warning al desactivar vendor_locations:', e);
                }

                forceEndShift();
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
  const sellerSession = useSellerSessionStore() as any;
  const { loadHistory, completedRequests } = useLogisticsStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const today = dateOf(new Date().toISOString());

  const products = getPosItems();
  const priceMap: Record<string, { price: number; name: string }> = {};
  (products || []).forEach((p: any) => { priceMap[p.id] = { price: p.price || 0, name: p.name }; });

  const liveShift = useMemo(() => {
    if (sellerSession?.isSetupComplete && matchVehicleId(sellerSession?.pointId, vehicleId)) {
      const matchingStored = (posShifts || []).filter((s: any) => matchVehicleId(s.pointId, vehicleId));
      const hasOpenShift = matchingStored.some((s: any) => !s.closedAt);
      const hasClosedShiftToday = matchingStored.some((s: any) => s.closedAt && (dateOf(s.closedAt) === today || dateOf(s.openedAt) === today));

      if (!hasOpenShift && !hasClosedShiftToday) {
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

    const vendorLocs = (useInventoryStore.getState() as any).vendorLocations || {};
    const matchedLoc: any = Object.values(vendorLocs).find((loc: any) =>
      matchVehicleId(loc?.pointId || loc?.name, vehicleId)
    );
    if (matchedLoc) {
      const matchingStored = (posShifts || []).filter((s: any) => matchVehicleId(s.pointId, vehicleId));
      const hasOpenShift = matchingStored.some((s: any) => !s.closedAt);
      const hasClosedShiftToday = matchingStored.some((s: any) => s.closedAt && (dateOf(s.closedAt) === today || dateOf(s.openedAt) === today));

      if (!hasOpenShift && !hasClosedShiftToday) {
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
  }, [sellerSession, posShifts, vehicleId, today]);

  // Buscar el turno correcto con prioridad:
  // 1. Sesión live del vendedor
  // 2. PRIMERA PRIORIDAD: Cualquier turno abierto (!closedAt) que coincida con el vehículo
  // 3. Turno de hoy que coincida con jornada actual (solo si !activeOnly)
  // 4. Turno de hoy (si !activeOnly)
  // 5. El más reciente (fallback — solo si !activeOnly)
  // 6. Si activeOnly=true y hay cargas/surtidos hoy para este vehículo, inyectar turno activo sintético
  const shift = useMemo(() => {
    if (liveShift) return liveShift;

    const forVehicle = (posShifts || []).filter(
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
        isExpanded={isExpanded}
        onToggle={() => setIsExpanded(e => !e)}
        onForceClose={undefined}
      />
    </div>
  );
}
