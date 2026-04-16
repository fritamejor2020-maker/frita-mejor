import React, { useState, useMemo } from 'react';
import { useLogisticsStore } from '../../store/useLogisticsStore';
import { useInventoryStore } from '../../store/useInventoryStore';
import { useSellerSessionStore } from '../../store/useSellerSessionStore';
import { ChevronDown, ChevronUp, Package, RefreshCw, RotateCcw, AlertTriangle } from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────────────────────────
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
  const from = openedAt ? new Date(openedAt).getTime() : 0;
  const to   = closedAt ? new Date(closedAt).getTime() : Date.now();

  const inWindow = (ts: string) => {
    if (!ts) return false;
    const t = new Date(ts).getTime();
    if (openedAt) return t >= from && t <= to;
    return dateOf(ts) === shiftDate;
  };

  // Cargas
  const cargaMap: Record<string, { name: string; qty: number }> = {};
  const seenCargas = new Set<string>();
  loadHistory
    .filter((e: any) => e.type === 'carga' && e.vehicleId === vehicleId
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
    .filter((r: any) => r.requester_point_id === vehicleId
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
    .filter((e: any) => e.type === 'recepcion' && e.vehicleId === vehicleId
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
  const vendedor  = shift.responsibleName || shift.userName || '—';
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
            {isExpanded ? <><ChevronUp size={16} /> Ocultar detalle</> : <><ChevronDown size={16} /> Ver detalle por producto</>}
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
  const [showDebug,   setShowDebug]   = useState(false);

  // Mapa de precios
  const products = getPosItems();
  const priceMap: Record<string, { price: number; name: string }> = {};
  (products || []).forEach((p: any) => { priceMap[p.id] = { price: p.price || 0, name: p.name }; });

  // ── Construir lista combinada de turnos ──────────────────────────────────────
  // Fuente 1: posShifts — solo turnos de VENDEDOR (excluye POS caja y DEJADOR)
  const storedShifts: any[] = useMemo(() =>
    (posShifts || []).filter((s: any) => s.type === 'VENDEDOR'),
    [posShifts]
  );

  // Fuente 2: sesión activa LOCAL del vendedor (puede no estar en posShifts aún)
  const liveShift: any | null = useMemo(() => {
    if (!sellerSession?.isSetupComplete || !sellerSession?.pointId) return null;
    // Verificar si ya está en posShifts para no duplicar
    const alreadyStored = storedShifts.some(
      (s: any) => !s.closedAt && s.pointId === sellerSession.pointId && s.openedAt === sellerSession.openedAt
    );
    if (alreadyStored) return null;
    // Sintetizar un registro temporal basado en la sesión activa
    return {
      id: `LIVE-${sellerSession.pointId}`,
      pointId: sellerSession.pointId,
      shift: sellerSession.shift,
      responsibleName: sellerSession.responsibleName,
      openedAt: sellerSession.openedAt,
      closedAt: null,
      type: 'VENDEDOR',
      _isLive: true, // marcador para la UI
    };
  }, [sellerSession, storedShifts]);

  // Combinar: sesión live primero, luego historial almacenado (ordenado desc)
  const allShifts: any[] = useMemo(() => {
    const combined = liveShift ? [liveShift, ...storedShifts] : [...storedShifts];
    return combined.sort((a: any, b: any) => {
      // Activos primero
      if (!a.closedAt && b.closedAt) return -1;
      if (a.closedAt && !b.closedAt) return 1;
      const tA = new Date(a.closedAt || a.openedAt || 0).getTime();
      const tB = new Date(b.closedAt || b.openedAt || 0).getTime();
      return tB - tA;
    });
  }, [liveShift, storedShifts]);

  // Aplicar filtros fecha/jornada
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

      {/* ── Filtros ── */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="inline-flex items-center gap-3 bg-white rounded-full px-5 py-2.5 shadow-sm border border-gray-100 flex-wrap">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Filtrar:</span>
          <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
            className="bg-transparent text-sm font-bold text-gray-700 outline-none cursor-pointer" />
          <div className="w-px h-5 bg-gray-200" />
          <select value={filterShift} onChange={e => setFilterShift(e.target.value)}
            className="bg-transparent text-sm font-bold text-gray-700 outline-none cursor-pointer">
            <option value="">Todas las jornadas</option>
            {availableJornadas.length > 0
              ? availableJornadas.map(j => <option key={j} value={j}>{j}</option>)
              : ['AM', 'MD', 'PM'].map(j => <option key={j} value={j}>{j}</option>)}
          </select>
          {(filterDate || filterShift) && (
            <button onClick={() => { setFilterDate(''); setFilterShift(''); }}
              className="text-xs font-bold text-red-400 hover:text-red-600 transition-colors">
              ✕ Limpiar
            </button>
          )}
        </div>
        {/* Debug toggle */}
        <button onClick={() => setShowDebug(d => !d)}
          className="text-xs font-bold text-gray-300 hover:text-gray-500 transition-colors px-3 py-1 rounded-full border border-gray-100">
          {showDebug ? '🔍 Ocultar debug' : '🔍 Debug'}
        </button>
      </div>

      {/* ── Panel de debug ── */}
      {showDebug && (
        <div className="bg-gray-900 text-green-400 font-mono text-xs rounded-2xl p-4 space-y-1">
          <p>📦 posShifts total: <strong>{(posShifts || []).length}</strong></p>
          <p>🔍 Tipos en posShifts: <strong>{[...new Set((posShifts || []).map((s: any) => s.type || 'sin-tipo'))].join(', ') || 'vacío'}</strong></p>
          <p>🔴 Sesión vendedor activa: <strong>{sellerSession?.isSetupComplete ? `${sellerSession.pointId} / ${sellerSession.shift} (${sellerSession.responsibleName})` : 'Ninguna'}</strong></p>
          <p>📋 Turnos combinados (allShifts): <strong>{allShifts.length}</strong></p>
          <p>✅ Filtrados (filteredShifts): <strong>{filteredShifts.length}</strong></p>
          {(posShifts || []).slice(0, 3).map((s: any, i: number) => (
            <p key={i}>→ [{i}] type=<strong>{s.type}</strong> pointId=<strong>{s.pointId}</strong> closedAt=<strong>{s.closedAt ? '✅' : 'null'}</strong></p>
          ))}
        </div>
      )}

      {/* ── KPIs ── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-center">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">En curso</p>
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

      {/* ── Indicador ── */}
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        <p className="text-xs font-bold text-gray-400">
          Datos en tiempo real · <span className="text-blue-500">Carga</span> + <span className="text-orange-500">Surtidos</span> − <span className="text-purple-500">Sobrantes</span>
          {liveShift && <span className="text-amber-600 ml-2">· 🔴 Sesión local detectada</span>}
        </p>
      </div>

      {/* ── Lista de turnos ── */}
      {filteredShifts.length === 0 ? (
        <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-3xl p-10 text-center">
          <span className="text-5xl block mb-4">📋</span>
          <p className="font-black text-gray-600 text-lg">No hay turnos registrados</p>
          <p className="text-gray-400 font-bold text-sm mt-1">
            {filterDate || filterShift
              ? 'Cambia los filtros de fecha / jornada'
              : 'El turno aparece aquí en cuanto el Vendedor inicia sesión'}
          </p>
          <button onClick={() => setShowDebug(true)}
            className="mt-4 text-xs font-bold text-gray-400 hover:text-gray-600 underline transition-colors">
            Ver diagnóstico →
          </button>
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
              onForceClose={!shift.closedAt ? () => {
                const confirm = window.confirm(
                  `¿Confirmas el CIERRE FORZADO del turno ${shift.pointId} (${shift.shift}) de "${shift.responsibleName || 'desconocido'}"?\n\nEsta acción cerrará la sesión activa del Vendedor desde el panel Admin.`
                );
                if (!confirm) return;

                const closedAt = new Date().toISOString();

                // Si el turno ya está en posShifts, actualizarlo; si es un turno LIVE sintético, registrarlo
                const existingShift = (posShifts || []).find(
                  (s: any) => s.type === 'VENDEDOR' && !s.closedAt && s.pointId === shift.pointId
                );
                if (existingShift) {
                  updatePosShift(existingShift.id, { closedAt, forcedByAdmin: true });
                } else {
                  // Registrar el turno como cerrado directamente
                  addPosShift({
                    ...shift,
                    id: shift.id.startsWith('LIVE-') ? `SHIFT-FORCED-${Date.now()}` : shift.id,
                    closedAt,
                    forcedByAdmin: true,
                    type: 'VENDEDOR',
                  });
                }

                // Limpiar la sesión local del vendedor
                forceEndShift();
              } : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
