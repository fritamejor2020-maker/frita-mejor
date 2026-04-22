import React, { useState } from 'react';
import { useFinanceStore } from '../../store/useFinanceStore';
import { useInventoryStore } from '../../store/useInventoryStore';
import { useLogisticsStore } from '../../store/useLogisticsStore';
import { refreshAllFromSupabase } from '../../lib/useRealtimeSync';
import * as XLSX from 'xlsx';

// ─── Helpers ────────────────────────────────────────────────
import { formatMoney as fmt } from '../../utils/formatUtils';
import { getProductAbbreviation } from '../../utils/formatUtils';

// ─── ResumenOperativoTab ─────────────────────────────────────────────
// Consolida por vehículo: carga inicial + surtidos + sobrantes + cierre vendedor
export const ResumenOperativoTab = () => {
  const { loadHistory, completedRequests } = useLogisticsStore();
  const { posShifts, getPosItems } = useInventoryStore();
  const products = getPosItems();

  const [filterDate, setFilterDate] = useState('');
  const [filterShift, setFilterShift] = useState('');
  const [expandedVehicle, setExpandedVehicle] = useState<string | null>(null);

  // Precio por productId — usa referencePrice para productos con precio variable
  const priceMap: Record<string, { price: number; name: string }> = {};
  products.forEach((p: any) => {
    const isVariable = p.variablePrice === true || (p.price === 0 && p.variablePrice !== false);
    priceMap[p.id] = { price: isVariable ? (p.referencePrice || 0) : (p.price || 0), name: p.name };
  });

  // Fecha para filtro — usa fecha LOCAL (UTC-5 Colombia)
  const dateOf = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };

  // Filtrar entries por fecha y turno usando el posShift del vendedor de ese vehículo
  const vendedorShifts = (posShifts || []).filter((s: any) => s.type === 'VENDEDOR' && s.closedAt);

  // Reunir todos los vehicleIds únicos que aparecen en loadHistory
  const allVehicleIds = Array.from(new Set([
    ...loadHistory.map((e: any) => e.vehicleId),
    ...completedRequests.map((r: any) => r.requester_point_id),
    ...vendedorShifts.map((s: any) => s.pointId),
  ])).filter(Boolean) as string[];

  // Construir resumen por vehículo
  const vehicleSummaries = allVehicleIds.map((vehicleId: string) => {
    // Encontrar el posShift asociado a este vehículo (el más reciente)
    const vs = vendedorShifts
      .filter((s: any) => s.pointId === vehicleId)
      .sort((a: any, b: any) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime());
    const latestShift = vs[0] || null;

    const shiftDate = latestShift ? dateOf(latestShift.closedAt) : dateOf(loadHistory.find((e: any) => e.vehicleId === vehicleId)?.timestamp || '');
    const shiftTurno = latestShift?.shift || '—';

    // Aplicar filtros
    if (filterDate && shiftDate !== filterDate) return null;
    if (filterShift && shiftTurno !== filterShift) return null;

    // Carga inicial (suma por producto) — solo del día de la jornada
    const cargaMap: Record<string, { name: string; qty: number }> = {};
    const seenCargaIds = new Set<string>();
    loadHistory
      .filter((e: any) => e.type === 'carga' && e.vehicleId === vehicleId
        && (!shiftDate || dateOf(e.timestamp) === shiftDate)
        && !seenCargaIds.has(e.id) && (seenCargaIds.add(e.id) || true))
      .forEach((e: any) => {
        e.items.forEach(({ productId, qty, name }: any) => {
          if (!cargaMap[productId]) cargaMap[productId] = { name: name || priceMap[productId]?.name || productId, qty: 0 };
          cargaMap[productId].qty += qty;
        });
      });

    // Surtidos entregados — solo del día de la jornada
    const surtidoMap: Record<string, { name: string; qty: number }> = {};
    const seenSurtidoIds = new Set<string>();
    completedRequests
      .filter((r: any) => r.requester_point_id === vehicleId
        && (!shiftDate || dateOf(r.completed_at || r.created_at) === shiftDate)
        && !seenSurtidoIds.has(r.id) && (seenSurtidoIds.add(r.id) || true))
      .forEach((r: any) => {
        (r.items_payload || []).forEach(({ productId, qty, name }: any) => {
          if (!surtidoMap[productId]) surtidoMap[productId] = { name: name || priceMap[productId]?.name || productId, qty: 0 };
          surtidoMap[productId].qty += qty;
        });
      });

    // Sobrantes (recepcion) — solo del día de la jornada
    const sobranteMap: Record<string, { name: string; qty: number }> = {};
    const seenRecepcionIds = new Set<string>();
    loadHistory
      .filter((e: any) => e.type === 'recepcion' && e.vehicleId === vehicleId
        && (!shiftDate || dateOf(e.timestamp) === shiftDate)
        && !seenRecepcionIds.has(e.id) && (seenRecepcionIds.add(e.id) || true))
      .forEach((e: any) => {
        e.items.forEach(({ productId, qty, name }: any) => {
          if (!sobranteMap[productId]) sobranteMap[productId] = { name: name || priceMap[productId]?.name || productId, qty: 0 };
          sobranteMap[productId].qty += qty;
        });
      });

    // Vendido teórico = carga + surtidos - sobrantes
    const allProductIds = new Set([...Object.keys(cargaMap), ...Object.keys(surtidoMap), ...Object.keys(sobranteMap)]);
    let theoreticalTotal = 0;
    const productLines: any[] = [];
    allProductIds.forEach(pid => {
      const carga = cargaMap[pid]?.qty || 0;
      const surtido = surtidoMap[pid]?.qty || 0;
      const sobrante = sobranteMap[pid]?.qty || 0;
      const vendido = Math.max(0, carga + surtido - sobrante);
      const price = priceMap[pid]?.price || 0;
      const name = cargaMap[pid]?.name || surtidoMap[pid]?.name || sobranteMap[pid]?.name || pid;
      theoreticalTotal += vendido * price;
      productLines.push({ pid, name, carga, surtido, sobrante, vendido, price });
    });

    // Cierre real del vendedor
    const realAmount = latestShift ? (latestShift.realAmount || 0) : 0;
    const cashAmount = latestShift ? (latestShift.cashAmount || 0) : 0;
    const transferAmount = latestShift ? (latestShift.transferAmount || 0) : 0;
    const expenses = latestShift ? (latestShift.expenses || 0) : 0;
    const responsibleName = latestShift?.responsibleName || latestShift?.userName || '—';
    const diff = realAmount - theoreticalTotal;

    // Anotador / Dejador: guardado en la entrada de carga inicial de este vehículo
    const firstCarga = loadHistory
      .filter((e: any) => e.type === 'carga' && e.vehicleId === vehicleId)
      .sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())[0];
    const anotadorName = firstCarga?.anotadorName || null;
    const dejadorName = firstCarga?.dejadorName || null;

    return {
      vehicleId,
      shiftDate,
      shiftTurno,
      responsibleName,
      anotadorName,
      dejadorName,
      productLines,
      theoreticalTotal,
      realAmount,
      cashAmount,
      transferAmount,
      expenses,
      diff,
      hasCierre: !!latestShift,
    };
  }).filter(Boolean);

  if (vehicleSummaries.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-5xl mb-4">📋</p>
        <p className="font-bold text-lg">No hay operaciones registradas aún.</p>
        <p className="text-sm mt-1">Los datos aparecen aquí cuando el Dejador registra cargas y el Vendedor hace su cierre.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filtros */}
      <div className="inline-flex items-center gap-3 bg-white rounded-full px-5 py-2.5 shadow-sm border border-gray-100 self-center flex-wrap justify-center">
        <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
          className="bg-transparent text-sm font-bold text-gray-700 outline-none cursor-pointer" />
        <div className="w-px h-6 bg-gray-200" />
        <select value={filterShift} onChange={e => setFilterShift(e.target.value)}
          className="bg-transparent text-sm font-bold text-gray-700 outline-none cursor-pointer">
          <option value="">Todos los Turnos</option>
          <option value="AM">AM</option>
          <option value="MD">MD</option>
          <option value="PM">PM</option>
        </select>
        {(filterDate || filterShift) && (
          <button onClick={() => { setFilterDate(''); setFilterShift(''); }}
            className="text-xs font-bold text-red-400 hover:text-red-600 transition-colors">✕ Limpiar</button>
        )}
      </div>

      {/* Cards por vehículo */}
      {vehicleSummaries.map((v: any) => {
        const isExpanded = expandedVehicle === v.vehicleId;
        const diffColor = v.diff === 0 ? 'text-green-600' : v.diff > 0 ? 'text-green-600' : 'text-red-500';
        const diffLabel = v.diff === 0 ? '✅ Cuadrado' : v.diff > 0 ? `+${fmt(v.diff)} Sobrante` : `${fmt(v.diff)} Faltante`;

        return (
          <div key={v.vehicleId} className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
            {/* Header de la tarjeta */}
            <div className="p-5 sm:p-7">
              {/* Fila superior: vehículo + turno + responsable */}
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-400 flex items-center justify-center text-white font-black text-lg shadow-sm flex-shrink-0">
                    {v.vehicleId.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-gray-900 text-lg">{v.vehicleId}</span>
                      <span className="bg-amber-100 text-amber-700 text-[10px] font-black px-2 py-0.5 rounded-full tracking-widest">{v.shiftTurno}</span>
                      {v.shiftDate && <span className="text-gray-400 text-xs font-bold">{v.shiftDate}</span>}
                    </div>
                    {v.responsibleName !== '—' && (
                      <p className="text-sm font-bold text-gray-500 mt-0.5">🧑 {v.responsibleName}</p>
                    )}
                    {/* Dejador info */}
                    {v.dejadorShift && (
                      <div className="flex gap-1.5 mt-1 flex-wrap">
                        {v.dejadorShift.anotadorName && (
                          <span className="text-[10px] font-bold bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full">📋 {v.dejadorShift.anotadorName}</span>
                        )}
                        {v.dejadorShift.dejadorName && (
                          <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">🛵 {v.dejadorShift.dejadorName}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  {v.hasCierre ? (
                    <p className={`text-lg font-black ${diffColor}`}>{diffLabel}</p>
                  ) : (
                    <span className="text-[10px] font-bold bg-gray-100 text-gray-400 px-3 py-1 rounded-full tracking-widest">SIN CIERRE</span>
                  )}
                </div>
              </div>

              {/* Métricas rápidas en píldoras */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                <div className="bg-red-50 rounded-2xl px-4 py-3 text-center">
                  <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-1">Teórico</p>
                  <p className="text-base font-black text-red-600">{fmt(v.theoreticalTotal)}</p>
                </div>
                <div className="bg-green-50 rounded-2xl px-4 py-3 text-center">
                  <p className="text-[10px] font-bold text-green-500 uppercase tracking-widest mb-1">Real</p>
                  <p className="text-base font-black text-green-700">{fmt(v.realAmount)}</p>
                </div>
                <div className="bg-blue-50 rounded-2xl px-4 py-3 text-center">
                  <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">Efectivo</p>
                  <p className="text-base font-black text-blue-600">{fmt(v.cashAmount)}</p>
                </div>
                <div className="bg-purple-50 rounded-2xl px-4 py-3 text-center">
                  <p className="text-[10px] font-bold text-purple-400 uppercase tracking-widest mb-1">Transf.</p>
                  <p className="text-base font-black text-purple-600">{fmt(v.transferAmount)}</p>
                </div>
              </div>

              {/* Toggle detalles */}
              <button
                onClick={() => setExpandedVehicle(isExpanded ? null : v.vehicleId)}
                className="text-sm font-bold text-amber-500 hover:text-amber-600 transition-colors flex items-center gap-1"
              >
                {isExpanded ? 'Ocultar detalle por producto' : 'Ver detalle por producto'}
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                  className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
            </div>

            {/* Tabla de detalle */}
            {isExpanded && (
              <div className="border-t border-gray-100">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="py-3 px-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-left">Producto</th>
                        <th className="py-3 px-4 text-[10px] font-bold text-red-400 uppercase tracking-widest text-center">Carga</th>
                        <th className="py-3 px-4 text-[10px] font-bold text-amber-500 uppercase tracking-widest text-center">Surtidos</th>
                        <th className="py-3 px-4 text-[10px] font-bold text-indigo-400 uppercase tracking-widest text-center">Sobrantes</th>
                        <th className="py-3 px-4 text-[10px] font-bold text-green-500 uppercase tracking-widest text-center">Vendido</th>
                        <th className="py-3 px-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {v.productLines.map((pl: any) => (
                        <tr key={pl.pid} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-3 px-5">
                            <div className="flex items-center gap-2">
                              <span className="bg-gray-900 text-white text-[10px] font-black px-2 py-0.5 rounded-md">
                                {getProductAbbreviation(pl.name)}
                              </span>
                              <span className="font-bold text-gray-700 text-xs">{pl.name}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="bg-red-100 text-red-600 font-black text-xs px-2 py-0.5 rounded-full">{pl.carga}</span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`font-black text-xs px-2 py-0.5 rounded-full ${pl.surtido > 0 ? 'bg-amber-100 text-amber-600' : 'text-gray-300'}`}>
                              {pl.surtido > 0 ? `+${pl.surtido}` : '—'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`font-black text-xs px-2 py-0.5 rounded-full ${pl.sobrante > 0 ? 'bg-indigo-100 text-indigo-600' : 'text-gray-300'}`}>
                              {pl.sobrante > 0 ? pl.sobrante : '—'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="bg-green-100 text-green-700 font-black text-xs px-2 py-0.5 rounded-full">{pl.vendido}</span>
                          </td>
                          <td className="py-3 px-5 text-right font-black text-gray-800 text-sm">
                            {fmt(pl.vendido * pl.price)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 border-t border-gray-200">
                        <td colSpan={4} className="py-3 px-5 font-bold text-gray-400 text-xs uppercase tracking-widest">Total Teórico</td>
                        <td colSpan={2} className="py-3 px-5 text-right font-black text-[#FF4040] text-base">{fmt(v.theoreticalTotal)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};



// ─── Mock Product Details ───────────────────────────────────
interface ClosingDetail {
  product: string;
  sent: number;
  returned: number;
  sold: number;
  unitPrice: number;
  stringCounts?: Record<string, number>; // ej: { MON: 2, '20K': 1 }
}


// ─── Component: Cierres ──────────────────────────────────────────────
export const AdminFinancesTab = ({ allowDelete = true }: { allowDelete?: boolean } = {}) => {
  const { posShifts, posSales, posExpenses, updatePosShift, deletePosShift } = useInventoryStore();
  const { loadHistory, completedRequests, updateLoadEntry, updateCompletedRequestItems } = useLogisticsStore();

  // Cierres filters
  const [filterDate, setFilterDate] = useState('');
  const [filterShift, setFilterShift] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedHistorialId, setExpandedHistorialId] = useState<string | null>(null);
  const [editingClosing, setEditingClosing] = useState<any | null>(null);
  const [editCash, setEditCash] = useState('');
  const [editTransfer, setEditTransfer] = useState('');
  const [editExpenses, setEditExpenses] = useState('');
  const [editExpensesDesc, setEditExpensesDesc] = useState('');
  const [editDetails, setEditDetails] = useState<any[]>([]);
  const [editLogistics, setEditLogistics] = useState<any[]>([]); // historial editable
  const [expensesDescModal, setExpensesDescModal] = useState<{ desc: string; amount: number; name: string } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try { await refreshAllFromSupabase(); } finally { setIsRefreshing(false); }
  };

  const updateEditDetail = (idx: number, field: string, value: string) => {
    setEditDetails(prev => prev.map((d, i) => {
      if (i !== idx) return d;
      const updated = { ...d, [field]: value };
      // Vendido = Enviado - Quedó (siempre calculado automáticamente)
      if (field === 'sent' || field === 'returned') {
        const s = parseInt(field === 'sent' ? value : updated.sent) || 0;
        const r = parseInt(field === 'returned' ? value : updated.returned) || 0;
        updated.sold = String(Math.max(0, s - r));
      }
      return updated;
    }));
  };

  const updateEditLogisticItem = (entryIdx: number, itemIdx: number, qty: string) => {
    setEditLogistics(prev => prev.map((entry: any, ei: number) =>
      ei === entryIdx
        ? { ...entry, items: entry.items.map((item: any, ii: number) =>
            ii === itemIdx ? { ...item, qty: parseInt(qty) || 0 } : item) }
        : entry
    ));
  };

  // Helper reutilizable
  // Helper reutilizable — usa fecha LOCAL para evitar desfases con UTC-5
  const dateOf = (ts: string) => {
    if (!ts) return '';
    const d = new Date(ts);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // Carga el historial logístico de un vehículo en una fecha dada
  const buildLogisticsTimeline = (vehicleId: string, shiftDate: string) => {
    const seenIds = new Set<string>();

    // Aceptar entradas del mismo día o hasta ±1 día para absorber desfases de huso horario
    const isNearDate = (ts: string) => {
      if (!shiftDate || !ts) return true; // si no hay fecha de referencia, incluir todo
      const entryDate = dateOf(ts);
      if (entryDate === shiftDate) return true;
      // También aceptar el día anterior/siguiente por desfase UTC
      const base = new Date(shiftDate);
      const prev = new Date(base); prev.setDate(base.getDate() - 1);
      const next = new Date(base); next.setDate(base.getDate() + 1);
      const prevStr = `${prev.getFullYear()}-${String(prev.getMonth()+1).padStart(2,'0')}-${String(prev.getDate()).padStart(2,'0')}`;
      const nextStr = `${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}-${String(next.getDate()).padStart(2,'0')}`;
      return entryDate === prevStr || entryDate === nextStr;
    };

    const logEntries = (loadHistory as any[])
      .filter(e => {
        if (e.vehicleId !== vehicleId || !isNearDate(e.timestamp)) return false;
        if (seenIds.has(e.id)) return false;
        seenIds.add(e.id);
        return true;
      })
      .map(e => ({ id: e.id, type: e.type, timestamp: e.timestamp, items: e.items.map((i: any) => ({ ...i })) }));

    const surtidoEntries = (completedRequests as any[])
      .filter(r => {
        if (r.requester_point_id !== vehicleId || !isNearDate(r.completed_at || r.created_at)) return false;
        if (seenIds.has(r.id)) return false;
        seenIds.add(r.id);
        return true;
      })
      .map(r => ({ id: r.id, type: 'surtido', timestamp: r.completed_at || r.created_at, items: (r.items_payload || []).map((i: any) => ({ ...i })) }));

    return [...logEntries, ...surtidoEntries]
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  };

  // Solo VENDEDOR y POS tienen cierre de finanzas. Los DEJADORES no.
  const mappedShifts = (posShifts || []).filter((s: any) => s.closedAt && s.type !== 'DEJADOR').map((s: any) => {
     let details: ClosingDetail[] = [];
     let theoretical = 0;
     let real = 0;
     let expenses = 0;

     // Calcular la fecha del cierre al inicio para usarla en los filtros logísticos
     // ⚠️ Usar dateOf() (fecha local) y NO toISOString() para evitar desfase UTC-5 Colombia
     const shiftDate = dateOf(s.closedAt);

     if (s.type === 'VENDEDOR') {
         const priceMap: Record<string, { price: number, name: string }> = {};
         (useInventoryStore.getState().getPosItems() || []).forEach((p: any) => {
           const isVariable = p.variablePrice === true || (p.price === 0 && p.variablePrice !== false);
           priceMap[p.id] = { price: isVariable ? (p.referencePrice || 0) : (p.price || 0), name: p.name };
         });

         const { loadHistory, completedRequests } = useLogisticsStore.getState();
         const vehicleId = s.pointId;

         // Carga inicial por producto — solo del día del cierre, deduplicar por ID
         const seenCargaIds = new Set<string>();
         const cargaMap: Record<string, { name: string; qty: number; stringCounts: Record<string,number> }> = {};
         loadHistory
           .filter((e: any) => e.type === 'carga' && e.vehicleId === vehicleId
             && dateOf(e.timestamp) === shiftDate   // ← solo la jornada del cierre
             && !seenCargaIds.has(e.id) && (seenCargaIds.add(e.id) || true))
           .forEach((e: any) => {
             e.items.forEach(({ productId, qty, name, stringValue }: any) => {
               if (!cargaMap[productId]) cargaMap[productId] = { name: name || priceMap[productId]?.name || productId, qty: 0, stringCounts: {} };
               cargaMap[productId].qty += qty;
               if (stringValue)
                 cargaMap[productId].stringCounts[stringValue] = (cargaMap[productId].stringCounts[stringValue] || 0) + (qty || 1);
             });
           });

         // Surtidos entregados — solo del día del cierre, deduplicar por ID
         const seenSurtidoIds = new Set<string>();
         const surtidoMap: Record<string, { name: string; qty: number; stringCounts: Record<string,number> }> = {};
         completedRequests
           .filter((r: any) => r.requester_point_id === vehicleId
             && dateOf(r.completed_at || r.created_at) === shiftDate  // ← solo la jornada
             && !seenSurtidoIds.has(r.id) && (seenSurtidoIds.add(r.id) || true))
           .forEach((r: any) => {
             (r.items_payload || []).forEach(({ productId, qty, name, stringValue }: any) => {
               if (!surtidoMap[productId]) surtidoMap[productId] = { name: name || priceMap[productId]?.name || productId, qty: 0, stringCounts: {} };
               surtidoMap[productId].qty += qty;
               if (stringValue)
                 surtidoMap[productId].stringCounts[stringValue] = (surtidoMap[productId].stringCounts[stringValue] || 0) + (qty || 1);
             });
           });

         // Sobrantes recibidos — solo del día del cierre, deduplicar por ID
         const seenRecepcionIds = new Set<string>();
         const sobranteMap: Record<string, { name: string; qty: number }> = {};
         loadHistory
           .filter((e: any) => e.type === 'recepcion' && e.vehicleId === vehicleId
             && dateOf(e.timestamp) === shiftDate  // ← solo la jornada
             && !seenRecepcionIds.has(e.id) && (seenRecepcionIds.add(e.id) || true))
           .forEach((e: any) => {
             e.items.forEach(({ productId, qty, name }: any) => {
               if (!sobranteMap[productId]) sobranteMap[productId] = { name: name || priceMap[productId]?.name || productId, qty: 0 };
               sobranteMap[productId].qty += qty;
             });
           });

         // productOverrides: overrides de cantidades por producto guardados por admin
         // Retrocompatibilidad: si no hay productOverrides pero hay soldItems con datos reales, usar soldItems
         const _siRaw = (s.soldItems || {}) as Record<string, any>;
         const _siOverrides: Record<string, {sent:number; returned:number; sold:number}> = {};
         Object.values(_siRaw).forEach((i: any) => {
           // Solo usar soldItems si tiene datos reales (sent explícito > 0 O returned > 0 O es el único registro)
           const name = i.name || i.id;
           if (name && (i.sent > 0 || i.returned > 0)) {
             _siOverrides[name] = { sent: i.sent || 0, returned: i.returned || 0, sold: i.qty || 0 };
           }
         });
         const productOverrides = (s.productOverrides && Object.keys(s.productOverrides).length > 0)
           ? (s.productOverrides as Record<string, {sent:number; returned:number; sold:number}>)
           : _siOverrides;
         const allPids = new Set([...Object.keys(cargaMap), ...Object.keys(surtidoMap), ...Object.keys(sobranteMap)]);
         theoretical = 0;
         details = [];
         allPids.forEach(pid => {
           const carga    = cargaMap[pid]?.qty   || 0;
           const surtido  = surtidoMap[pid]?.qty  || 0;
           const sobrante = sobranteMap[pid]?.qty  || 0;
           const logEnviado = carga + surtido;
           const logQuedo   = sobrante;
           const unitPrice  = priceMap[pid]?.price || 0;
           const prodName   = priceMap[pid]?.name || cargaMap[pid]?.name || surtidoMap[pid]?.name || sobranteMap[pid]?.name || pid;
           // Admin puede haber sobreescrito las cantidades de este producto
           const ov = productOverrides[prodName];
           const finalSent     = ov ? ov.sent     : logEnviado;
           const finalReturned = ov ? ov.returned  : logQuedo;
           const finalSold     = ov ? ov.sold      : Math.max(0, logEnviado - logQuedo);
           theoretical += finalSold * unitPrice;
           const _allCounts: Record<string, number> = {};
           Object.entries(cargaMap[pid]?.stringCounts || {}).forEach(([sv, n]) => { _allCounts[sv] = (_allCounts[sv] || 0) + (n as number); });
           Object.entries(surtidoMap[pid]?.stringCounts || {}).forEach(([sv, n]) => { _allCounts[sv] = (_allCounts[sv] || 0) + (n as number); });
           details.push({ product: prodName, sent: finalSent, returned: finalReturned, sold: finalSold, unitPrice, stringCounts: Object.keys(_allCounts).length > 0 ? _allCounts : undefined });
         });

          // Logística tiene prioridad absoluta. theoreticalOverride solo actúa si NO hay logística.
          if (details.length === 0) {
            // Sin logística: usar soldItems + theoreticalOverride si existen
            if (s.theoreticalOverride !== undefined && s.soldItems && Object.keys(s.soldItems).length > 0) {
              theoretical = s.theoreticalOverride;
              details = Object.values(s.soldItems).map((i: any) => ({
                product: i.name || i.id,
                sent: (i.sent > 0) ? i.sent : (i.qty || 0),
                returned: i.returned || 0,
                sold: i.qty || 0,
                unitPrice: i.price || 0,
              }));
            } else if (s.soldItems) {
              // Fallback básico: sin logística ni override
              Object.values(s.soldItems).forEach((i: any) => {
                const prod = (useInventoryStore.getState().getPosItems() || []).find((p: any) => p.id === i.id);
                const isVarProd = prod && (prod.variablePrice === true || (prod.price === 0 && prod.variablePrice !== false));
                const price = isVarProd ? (prod.referencePrice || 0) : (priceMap[i.id]?.price || i.price || 0);
                theoretical += (i.qty || 0) * price;
                details.push({ product: i.name || i.id, sent: i.qty || 0, returned: 0, sold: i.qty || 0, unitPrice: price });
              });
              if (details.length === 0) theoretical = s.theorySales || 0;
            }
          }
          // Cuando hay logística: theoretical ya fue calculado de (enviado-sobrantes)×precio.

         expenses = s.expensesAmount || s.expenses || 0;
         // Calcular real SIEMPRE desde sus componentes para evitar datos corruptos
         // realAmount puede estar mal si fue guardado antes del fix del formulario
         const cashAmt     = s.cashAmount    || 0;
         const transferAmt = s.transferAmount || 0;
         real = cashAmt + transferAmt + expenses;  // efectivo + transferencia + salidas



     } else {
         // POS Shift
         const shiftSales = (posSales || []).filter((sale: any) => sale.shiftId === s.id && sale.status === 'PAID');
         theoretical = shiftSales.reduce((acc: number, sale: any) => acc + sale.total, 0);
         expenses = (posExpenses || []).filter((e: any) => e.shiftId === s.id).reduce((acc: number, e: any) => acc + e.amount, 0); 
         
         const transferSales = shiftSales.filter((sale: any) => sale.paymentMethod !== 'EFECTIVO').reduce((acc: number, sale: any) => acc + sale.total, 0);
         real = (s.realAmount || 0) + transferSales; // realAmount in POS is just cash in drawer. Total real is cash + transfer
         
         const itemsMap: Record<string, any> = {};
         shiftSales.forEach((sale: any) => {
             sale.items.forEach((item: any) => {
                 if (!itemsMap[item.name]) itemsMap[item.name] = { product: item.name, sold: 0, sent: 0, returned: 0, unitPrice: item.price };
                 itemsMap[item.name].sold += item.qty;
                 itemsMap[item.name].sent += item.qty;
             });
         });
         details = Object.values(itemsMap);
     }
     // prioritize the vendor's real name, fall back to pointId
     const vendorName = s.userName || s.responsibleName || s.pointId || 'Caja Frita Mejor';
     const pointLabel = s.pointId && s.pointId !== vendorName ? s.pointId : null;

     // Buscar el cierre del DEJADOR de la misma jornada (mismo turno y fecha)
     const matchingDejadorShift = (posShifts || []).find((ds: any) =>
       ds.type === 'DEJADOR' &&
       ds.shift === (s.shift || '') &&
       ds.closedAt &&
       new Date(ds.closedAt).toISOString().split('T')[0] === shiftDate
     );

     // Fallback: buscar en cualquier entrada del vehículo en esa fecha
     // (carga, recepcion, o completedRequest surtido)
     const anyEntry = [
       // loadHistory entries (carga / recepcion)
       ...loadHistory.filter((e: any) => e.vehicleId === s.pointId
         && new Date(e.timestamp).toISOString().split('T')[0] === shiftDate
         && (e.anotadorName || e.dejadorName)),
       // completedRequests (surtidos entregados por el dejador)
       ...completedRequests.filter((r: any) => r.requester_point_id === s.pointId
         && new Date(r.completed_at || r.created_at).toISOString().split('T')[0] === shiftDate
         && (r.anotadorName || r.dejadorName)),
     ].sort((a: any, b: any) => {
       const ta = a.timestamp || a.completed_at || a.created_at || '';
       const tb = b.timestamp || b.completed_at || b.created_at || '';
       return new Date(ta).getTime() - new Date(tb).getTime();
     })[0];

     const anotadorName = anyEntry?.anotadorName || matchingDejadorShift?.anotadorName || null;
     const dejadorName  = anyEntry?.dejadorName  || matchingDejadorShift?.dejadorName  || null;

     return {
        id: s.id,
        _raw: s,
        pointName: vendorName,
        pointLabel,
        initials: (s.pointId || vendorName || 'CA').substring(0, 2).toUpperCase(),
        shift: s.shift || 'TD',
        date: shiftDate,
        type: s.type || '',
        anotadorName,
        dejadorName,
        theoretical,
        real,
        cashAmount: s.cashAmount || 0,
        transferAmount: s.transferAmount || 0,
        expenses,
        details
     };
  });

  // Deduplicar: si hay 2 registros cerrados para el mismo vehículo+turno+fecha,
  // quedarse con el más completo (con datos reales) o el más reciente.
  const deduplicatedClosings = (() => {
    const seen = new Map<string, any>();
    for (const c of mappedShifts) {
      const key = `${c.date}__${c.shift}__${c._raw?.pointId || c.pointName}`;
      const existing = seen.get(key);
      if (!existing) {
        seen.set(key, c);
      } else {
        // Preferir el que tiene datos financieros reales
        const cHasReal  = (c._raw?.cashAmount || 0) + (c._raw?.transferAmount || 0) > 0;
        const exHasReal = (existing._raw?.cashAmount || 0) + (existing._raw?.transferAmount || 0) > 0;
        if (cHasReal && !exHasReal) {
          seen.set(key, c); // el nuevo tiene datos, el viejo no → reemplazar
        } else if (!cHasReal && exHasReal) {
          // mantener el existente
        } else {
          // Ambos tienen (o no tienen) datos — quedarse con el más reciente
          const cTime  = new Date(c._raw?.closedAt || 0).getTime();
          const exTime = new Date(existing._raw?.closedAt || 0).getTime();
          if (cTime > exTime) seen.set(key, c);
        }
      }
    }
    return Array.from(seen.values());
  })();

  const filteredClosings = deduplicatedClosings.filter((c: any) => {
    if (filterDate && c.date !== filterDate) return false;
    if (filterShift && c.shift !== filterShift) return false;
    return true;
  });

  // Teórico = solo el valor calculado por logística (productos)
  // Real     = efectivo + transferencias + gastos (todo lo que el vendedor manejó)
  // Diferencia = Real - Teórico
  //   > 0 → Sobrante (el vendedor entregó más de lo esperado)
  //   < 0 → Faltante (el vendedor entregó menos)
  const getDiff = (c: any) => c.real - c.theoretical;

  const renderBadge = (c: any) => {
    const diff = getDiff(c);
    if (diff === 0) {
      return (
        <span className="inline-flex items-center gap-1.5 bg-green-50 text-green-600 text-xs font-bold px-3 py-1.5 rounded-full">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
          Cuadrado Perfecto
        </span>
      );
    }
    if (diff < 0) {
      // Real < Teórico → Faltante
      return (
        <span className="inline-flex items-center gap-1.5 bg-red-50 text-red-500 text-xs font-bold px-3 py-1.5 rounded-full">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
          Faltante: {fmt(Math.abs(diff))}
        </span>
      );
    }
    // Real > Teórico → Sobrante
    return (
      <span className="inline-flex items-center gap-1.5 bg-green-50 text-green-600 text-xs font-bold px-3 py-1.5 rounded-full">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
        Sobrante: {fmt(diff)}
      </span>
    );
  };

  return (
    <div className="flex-1 flex flex-col gap-6">
      {/* Filters + Actualizar */}
      <div className="flex items-center justify-center gap-3 flex-wrap mt-2">
        <div className="inline-flex items-center gap-3 bg-white rounded-full px-5 py-2.5 shadow-sm border border-gray-100 flex-wrap justify-center">
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="bg-transparent text-sm font-bold text-gray-700 outline-none cursor-pointer"
          />
          <div className="w-px h-6 bg-gray-200" />
          <select
            value={filterShift}
            onChange={(e) => setFilterShift(e.target.value)}
            className="bg-transparent text-sm font-bold text-gray-700 outline-none cursor-pointer appearance-none pr-6"
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='none' stroke='%239ca3af' stroke-width='2.5' viewBox='0 0 24 24'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0 center' }}
          >
            <option value="">Todas las Jornadas</option>
            <option value="AM">AM</option>
            <option value="MD">MD</option>
            <option value="PM">PM</option>
          </select>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          title="Actualizar datos desde la nube"
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold shadow-sm border transition-all ${isRefreshing ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' : 'bg-white text-amber-600 border-amber-200 hover:bg-amber-50 hover:border-amber-300 active:scale-95'}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={isRefreshing ? 'animate-spin' : ''}>
            <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          {isRefreshing ? 'Actualizando...' : 'Actualizar'}
        </button>
      </div>

      {/* Main Card */}
      <div className="bg-white rounded-[2rem] p-6 md:p-8 shadow-sm border border-gray-100">
        <h3 className="text-xl font-black text-gray-800 mb-6">Conciliación de Cierres</h3>

        {filteredClosings.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p className="text-5xl mb-3">📭</p>
            <p className="font-bold">No hay cierres para los filtros seleccionados.</p>
          </div>
        )}

        <div className="divide-y divide-gray-100">
          {filteredClosings.map((closing) => {
            const isExpanded = expandedId === closing.id;
            const calculatedTheoretical = closing.details.reduce(
              (sum: number, d: any) => sum + d.sold * d.unitPrice,
              0
            );

            return (
              <div key={closing.id} className="py-6 first:pt-0 last:pb-0">
                {/* ─── Row Header ─────────────────────── */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {/* Initials circle */}
                    <div className="w-11 h-11 rounded-full border-2 border-red-400 flex items-center justify-center text-red-500 font-black text-sm shrink-0">
                      {closing.initials}
                    </div>
                    <div>
                       <div className="flex items-center gap-2">
                         <span className="font-black text-gray-800 text-base">{closing.pointName}</span>
                         {closing.pointLabel && (
                           <span className="bg-red-50 text-red-400 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase">{closing.pointLabel}</span>
                         )}
                         <span className="bg-gray-100 text-gray-500 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase">{closing.shift}</span>
                       </div>
                       <p className="text-xs text-gray-400 font-bold mt-0.5">{closing.date}</p>
                       {/* Anotador / Dejador badges */}
                       {(closing.anotadorName || closing.dejadorName) && (
                         <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                           {closing.anotadorName && (
                             <span className="flex items-center gap-1 bg-amber-50 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-100">
                               📋 {closing.anotadorName}
                             </span>
                           )}
                           {closing.dejadorName && (
                             <span className="flex items-center gap-1 bg-gray-900 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                               🛵 {closing.dejadorName}
                             </span>
                           )}
                         </div>
                       )}
                     </div>
                  </div>

                  {/* Edit + Delete buttons */}
                  {closing._raw && (
                    <div className="flex items-center gap-1">
                      <button
                        className="text-gray-300 hover:text-[#FF4040] transition-colors p-1.5 hover:bg-red-50 rounded-lg"
                        title="Editar cierre"
                        onClick={() => {
                          setEditingClosing(closing);
                          setEditCash(String(closing._raw.cashAmount || closing.real || 0));
                          setEditTransfer(String(closing._raw.transferAmount || 0));
                          setEditExpenses(String(closing.expenses || 0));
                          setEditExpensesDesc(closing._raw.expensesDesc || "");
                           // Si los detalles tienen enviado=0 (datos corruptos de edit antigua),
                           // reconstruir desde logística para que el form muestre datos reales.
                           const _hasRealLogistics = closing.details.some((d: any) => (d.sent || 0) > 0);
                           let _initDetails = closing.details.map((d: any) => ({ ...d }));
                           if (!_hasRealLogistics) {
                             const _vid = closing._raw?.pointId;
                             if (_vid) {
                               const _tl = buildLogisticsTimeline(_vid, closing.date);
                               const _cM: Record<string,number> = {};
                               const _sM: Record<string,number> = {};
                               const _rM: Record<string,number> = {};
                               _tl.forEach((e: any) => {
                                 (e.items || []).forEach((item: any) => {
                                   const n = item.name || item.productId || '';
                                   if (e.type === 'carga')    _cM[n] = (_cM[n] || 0) + (item.qty || 0);
                                   else if (e.type === 'surtido')  _sM[n] = (_sM[n] || 0) + (item.qty || 0);
                                   else if (e.type === 'recepcion') _rM[n] = (_rM[n] || 0) + (item.qty || 0);
                                 });
                               });
                               _initDetails = closing.details.map((d: any) => {
                                 const logSent = (_cM[d.product] || 0) + (_sM[d.product] || 0);
                                 const logRet  = _rM[d.product] || 0;
                                 if (logSent > 0) return { ...d, sent: logSent, returned: logRet, sold: String(Math.max(0, logSent - logRet)) };
                                 return { ...d };
                               });
                             }
                           }
                           setEditDetails(_initDetails);
                          const vehicleId = closing._raw?.pointId;
                          setEditLogistics(vehicleId ? buildLogisticsTimeline(vehicleId, closing.date) : []);
                        }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      {closing._raw && allowDelete && (
                        <button
                          className="text-gray-300 hover:text-red-500 transition-colors p-1.5 hover:bg-red-50 rounded-lg"
                          title="Eliminar conciliacion"
                          onClick={() => {
                            if (!window.confirm(`Eliminar cierre de ${closing.pointName} (${closing.shift} - ${closing.date})?`)) return;
                            deletePosShift(closing._raw.id);
                            const { loadHistory: lh, completedRequests: cr } = useLogisticsStore.getState();
                            const newLH = lh.filter((e: any) => !(e.vehicleId === closing._raw.pointId && dateOf(e.timestamp) === closing.date));
                            const newCR = cr.filter((r: any) => !(r.requester_point_id === closing._raw.pointId && dateOf(r.completed_at || r.created_at) === closing.date));
                            useLogisticsStore.setState({ loadHistory: newLH, completedRequests: newCR });
                            // Persistir en localStorage para que otras tabs vean la eliminación
                            try {
                              const logKey = 'frita-mejor-logistics';
                              const raw = localStorage.getItem(logKey);
                              if (raw) {
                                const parsed = JSON.parse(raw);
                                if (parsed?.state) {
                                  parsed.state.loadHistory = newLH;
                                  parsed.state.completedRequests = newCR;
                                  localStorage.setItem(logKey, JSON.stringify(parsed));
                                }
                              }
                            } catch(_e) {}
                          }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* ─── Comparison Block ────────────────── */}
                <div className="bg-gray-50 rounded-2xl border border-gray-100 mb-4 overflow-hidden">
                  {/* Fila principal: Teórico vs Real */}
                  <div className="grid grid-cols-2 divide-x divide-gray-200">
                    <div className="py-5 px-6 text-center">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Teórico (APP)</p>
                      <p className="text-2xl font-black text-gray-800">{fmt(closing.theoretical)}</p>
                      <p className="text-[10px] font-bold text-gray-300 mt-1">Calc. por logística</p>
                    </div>
                    <div className="py-5 px-6 text-center">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Real (Caja)</p>
                      <p className="text-2xl font-black text-gray-800">{fmt(closing.real)}</p>
                      <p className="text-[10px] font-bold text-gray-300 mt-1">Total recibido</p>
                    </div>
                  </div>
                  {/* Desglose de Real */}
                  <div className="grid grid-cols-3 divide-x divide-gray-200 border-t border-gray-200 bg-white">
                    <div className="py-3 px-4 text-center">
                      <p className="text-[9px] font-bold text-green-500 uppercase tracking-widest mb-0.5">💵 Efectivo</p>
                      <p className="text-base font-black text-green-700">{fmt(closing.cashAmount)}</p>
                    </div>
                    <div className="py-3 px-4 text-center">
                      <p className="text-[9px] font-bold text-blue-400 uppercase tracking-widest mb-0.5">📲 Transferencia</p>
                      <p className="text-base font-black text-blue-600">{fmt(closing.transferAmount)}</p>
                    </div>
                     <button
                       className="py-3 px-4 text-center group hover:bg-red-50/60 rounded-xl transition-colors cursor-pointer w-full"
                       onClick={() => setExpensesDescModal({ desc: closing._raw?.expensesDesc || '', amount: closing.expenses, name: closing.pointName })}
                       title="Ver descripción del gasto"
                     >
                       <p className="text-[9px] font-bold text-red-400 uppercase tracking-widest mb-0.5">📌 Salidas</p>
                       <p className="text-base font-black text-red-500 group-hover:text-red-600 transition-colors">{fmt(closing.expenses)}</p>
                       {closing._raw?.expensesDesc && closing._raw.expensesDesc.trim() !== ''
                         ? <p className="text-[8px] font-bold text-red-300 mt-0.5 truncate max-w-[80px] mx-auto">{closing._raw.expensesDesc}</p>
                         : <p className="text-[8px] font-bold text-gray-300 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">Ver detalle</p>
                       }
                     </button>
                   </div>
                 </div>

                {/* ─── Footer: Badge + Toggle ─────────── */}
                <div className="flex items-center justify-between">
                  {renderBadge(closing)}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : closing.id)}
                    className="text-sm font-bold text-amber-500 hover:text-amber-600 transition-colors flex items-center gap-1"
                  >
                    {isExpanded ? 'Ocultar' : 'Ver Detalles'}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                </div>

                {/* ─── Accordion Details ──────────────── */}
                {isExpanded && (
                  <div className="mt-5 border border-gray-100 rounded-2xl overflow-hidden animate-[fadeIn_0.2s_ease-out]">

                    {/* Banner: Valor Editado manualmente */}
                    {(closing as any)._raw?.editedAt && (
                      <div className="px-5 py-2.5 bg-blue-50 border-b border-blue-100 flex items-center gap-2">
                        <span className="text-sm">✏️</span>
                        <span className="text-xs font-black text-blue-600">Valor Editado por Admin</span>
                        <span className="text-[10px] font-bold text-blue-400 ml-auto">
                          {new Date((closing as any)._raw.editedAt).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      </div>
                    )}

                    {/* Bloque Anotador / Dejador */}
                    {((closing as any).anotadorName || (closing as any).dejadorName) && (
                      <div className="px-5 py-3 bg-amber-50/60 border-b border-amber-100 flex flex-wrap gap-3 items-center">
                        <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Equipo Jornada:</span>
                        {(closing as any).anotadorName && (
                          <span className="inline-flex items-center gap-1.5 bg-white border border-amber-200 text-amber-700 text-xs font-bold px-3 py-1 rounded-full">
                            📋 Anotador: {(closing as any).anotadorName}
                          </span>
                        )}
                        {(closing as any).dejadorName && (
                          <span className="inline-flex items-center gap-1.5 bg-white border border-gray-200 text-gray-600 text-xs font-bold px-3 py-1 rounded-full">
                            🛵 Dejador: {(closing as any).dejadorName}
                          </span>
                        )}
                      </div>
                    )}

                     {/* ── Historial de Envíos (colapsable) ── */}
                     {closing._raw?.pointId && (() => {
                       const timeline = buildLogisticsTimeline(closing._raw.pointId, closing.date);
                       // Inyectar entrada virtual si el cierre fue editado manualmente
                       // Inyectar entradas del editHistory (una por cada edicion)
                       const rawHistory = closing._raw?.editHistory;
                       const buildDiffItems = (snap: any) => {
                         const items: any[] = [];
                         if (!snap) return items;
                         const beforeDetails = snap.before?.details || (Array.isArray(snap.before) ? snap.before : []);
                         const afterDetails  = snap.after?.details  || (Array.isArray(snap.after)  ? snap.after  : []);
                         afterDetails.forEach((d: any) => {
                           const prev = beforeDetails.find((b: any) => b.product === d.product);
                           items.push({ name: d.product, qty: d.sold, before: prev?.sold ?? '?' });
                         });
                         if (snap.before?.cash !== undefined && snap.before.cash !== snap.after.cash)
                           items.push({ name: '💵 Efectivo', qty: snap.after.cash, before: snap.before.cash, financial: true });
                         if (snap.before?.transfer !== undefined && snap.before.transfer !== snap.after.transfer)
                           items.push({ name: '📲 Transferencia', qty: snap.after.transfer, before: snap.before.transfer, financial: true });
                         if (snap.before?.expenses !== undefined && snap.before.expenses !== snap.after.expenses)
                           items.push({ name: '📌 Salidas', qty: snap.after.expenses, before: snap.before.expenses, financial: true });
                         return items;
                       };
                       if (rawHistory && rawHistory.length > 0) {
                         rawHistory.forEach((hist: any, hIdx: number) => {
                           timeline.push({
                             id: 'edit-' + closing.id + '-' + hIdx,
                             type: 'edicion',
                             timestamp: hist.editedAt,
                             items: buildDiffItems(hist),
                           });
                         });
                       } else if (closing._raw?.editedAt) {
                         // Backward compat: snapshot antiguo de una sola edición
                         timeline.push({
                           id: 'edit-' + closing.id,
                           type: 'edicion',
                           timestamp: closing._raw.editedAt,
                           items: buildDiffItems(closing._raw.editSnapshot),
                         });
                         timeline.sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                       }
                       if (timeline.length === 0) return null;
                       const isHistorialOpen = expandedHistorialId === closing.id;
                       let surtidoCount = 0;
                       return (
                         <div className="border-b border-gray-100">
                           {/* Toggle button */}
                           <button
                             onClick={() => setExpandedHistorialId(isHistorialOpen ? null : closing.id)}
                             className="w-full flex items-center justify-between px-5 py-3 text-sm font-bold text-amber-500 hover:text-amber-600 transition-colors"
                           >
                             <span>📋 Historial de Envíos ({timeline.length})</span>
                             <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                               className={`transition-transform duration-200 ${isHistorialOpen ? 'rotate-180' : ''}`}>
                               <polyline points="6 9 12 15 18 9" />
                             </svg>
                           </button>

                           {/* Content (collapsed by default) */}
                           {isHistorialOpen && (
                             <div className="px-5 pb-4 bg-gray-50/30">
                               <div className="flex flex-col gap-2.5">
                                 {timeline.map((entry: any, idx: number) => {
                                   if (entry.type === 'surtido') surtidoCount++;
                                   const icon = entry.type === 'carga' ? '📦'
                                     : entry.type === 'surtido' ? '🔄'
                                     : entry.type === 'edicion' ? '✏️'
                                     : '📬';
                                   const label = entry.type === 'carga' ? 'Carga Inicial'
                                     : entry.type === 'surtido' ? `Surtido #${surtidoCount}`
                                     : entry.type === 'edicion' ? 'Valor Editado por Admin'
                                     : 'Productos Recibidos';
                                   const bg = entry.type === 'carga' ? 'bg-red-50 border-red-100'
                                     : entry.type === 'surtido' ? 'bg-amber-50 border-amber-100'
                                     : entry.type === 'edicion' ? 'bg-blue-50 border-blue-200'
                                     : 'bg-indigo-50 border-indigo-100';
                                   const textColor = entry.type === 'carga' ? 'text-red-600'
                                     : entry.type === 'surtido' ? 'text-amber-700'
                                     : entry.type === 'edicion' ? 'text-blue-700'
                                     : 'text-indigo-600';
                                   const time = new Date(entry.timestamp).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
                                   return (
                                     <div key={entry.id || idx} className={`rounded-2xl border p-3 ${bg}`}>
                                       <div className="flex items-center gap-2 mb-2">
                                         <span>{icon}</span>
                                         <span className={`font-black text-sm ${textColor}`}>{label}</span>
                                         <span className="text-gray-400 text-xs font-bold ml-auto">{time}</span>
                                       </div>
                                       <div className="flex flex-wrap gap-2">
                                         {entry.type === 'edicion' ? (() => {
                                           const diffs = (entry.items || []).filter((item: any) => String(item.before) !== String(item.qty));
                                           const fmtV = (v: any, fin: boolean) => fin ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(v)) : String(v);
                                           return diffs.length === 0
                                             ? <span className="text-xs text-gray-400 italic">Sin cambios en valores</span>
                                             : diffs.map((item: any, ii: number) => (
                                               <span key={ii} className="text-xs font-bold bg-white px-2.5 py-1.5 rounded-xl border border-blue-100 shadow-sm flex items-center gap-1">
                                                 <span className="text-gray-500">{item.name}:</span>
                                                 <span className="text-red-400 line-through">{fmtV(item.before, item.financial)}</span>
                                                 <span className="text-gray-300 mx-0.5">&#x2192;</span>
                                                 <span className="text-blue-700 font-black">{fmtV(item.qty, item.financial)}</span>
                                               </span>
                                             ));
                                         })() : (entry.items || []).map((item: any, ii: number) => (
                                           <span key={ii} className="text-xs font-bold bg-white px-2.5 py-1 rounded-xl border border-white/80 shadow-sm">
                                             <span className="text-gray-500">{item.name || item.productId}:</span>{' '}
                                             <span className="text-gray-900">{item.qty}</span>
                                           </span>
                                         ))}
                                       </div>
                                     </div>
                                   );
                                 })}
                               </div>
                             </div>
                           )}
                         </div>
                       );
                     })()}

                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50">
                          <th className="py-3 px-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Producto</th>
                          <th className="py-3 px-5 text-[10px] font-bold text-blue-400 uppercase tracking-widest text-center">Enviado</th>
                          <th className="py-3 px-5 text-[10px] font-bold text-indigo-400 uppercase tracking-widest text-center">Quedó</th>
                          <th className="py-3 px-5 text-[10px] font-bold text-green-500 uppercase tracking-widest text-right">Venta</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {closing.details.map((d, i) => {
                          const ventaQty = Math.max(0, d.sent - d.returned);
                          const ventaTotal = ventaQty * d.unitPrice;
                          return (
                            <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                              <td className="py-3.5 px-5">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="bg-gray-900 text-white text-[10px] font-black px-2 py-0.5 rounded-md">
                                    {(d.product || '??').substring(0, 3).toUpperCase()}
                                  </span>
                                  <span className="font-bold text-gray-800">{d.product}</span>
                                  {(d as any).stringCounts && Object.entries((d as any).stringCounts).map(([sv, n]: [string, any]) => (
                                    <span key={sv} className="bg-amber-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full tracking-wide">
                                      {Number(n) > 1 ? `${sv} x${n}` : sv}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="py-3.5 px-5 text-center">
                                <span className="bg-blue-100 text-blue-700 font-black text-xs px-2 py-0.5 rounded-full">{d.sent}</span>
                              </td>
                              <td className="py-3.5 px-5 text-center">
                                {d.returned > 0
                                  ? <span className="bg-indigo-100 text-indigo-600 font-black text-xs px-2 py-0.5 rounded-full">{d.returned}</span>
                                  : <span className="text-gray-300 font-bold text-xs">—</span>
                                }
                              </td>
                              <td className="py-3.5 px-5 text-right">
                                <span className="font-black text-gray-800">{ventaQty}</span>
                                <p className="text-[11px] text-gray-400 font-bold">{fmt(ventaTotal)}</p>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {/* Total Calculado */}
                    <div className="border-t border-gray-100 py-4 px-5 flex justify-end items-center gap-3 bg-gray-50/50">
                      <span className="text-sm font-bold text-gray-500">Total Teórico Calculado:</span>
                      <span className="text-lg font-black text-[#FF4040]">{fmt(closing.details.reduce((sum: number, d: any) => sum + Math.max(0, d.sent - d.returned) * d.unitPrice, 0))}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Edit Closing Modal ────────────────────────────────── */}
      {editingClosing && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg flex flex-col animate-[fadeIn_0.2s_ease-out]"
               style={{ maxHeight: 'min(90vh, 700px)' }}>

            {/* ── Header fijo ── */}
            <div className="flex items-start justify-between px-8 pt-7 pb-5 border-b border-gray-100 flex-shrink-0">
              <div>
                <h3 className="text-xl font-black text-gray-800">Editar Cierre</h3>
                <p className="text-sm font-bold text-gray-400 mt-0.5">
                  {editingClosing.pointName} · {editingClosing.shift} · {editingClosing.date}
                </p>
              </div>
              <button onClick={() => setEditingClosing(null)}
                className="text-gray-400 hover:text-gray-700 p-2 rounded-xl hover:bg-gray-100 transition-colors -mr-1 -mt-1">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {/* ── Cuerpo scrolleable ── */}
            <div className="flex-1 overflow-y-auto px-8 py-6 flex flex-col gap-6" style={{ scrollbarWidth: 'thin' }}>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Efectivo</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">$</span>
                    <input type="number" value={editCash} onChange={e => setEditCash(e.target.value)}
                      className="w-full border-2 border-gray-100 focus:border-[#FF4040] rounded-xl py-3 pl-8 pr-4 text-lg font-black text-gray-800 outline-none transition-colors bg-gray-50" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Transferencias</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">$</span>
                    <input type="number" value={editTransfer} onChange={e => setEditTransfer(e.target.value)}
                      className="w-full border-2 border-gray-100 focus:border-[#FF4040] rounded-xl py-3 pl-8 pr-4 text-lg font-black text-gray-800 outline-none transition-colors bg-gray-50" />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Gastos / Salidas</label>
                <div className="flex gap-2">
                  <div className="relative w-1/3">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">$</span>
                    <input type="number" value={editExpenses} onChange={e => setEditExpenses(e.target.value)}
                      className="w-full border-2 border-gray-100 focus:border-[#FF4040] rounded-xl py-3 pl-8 pr-3 text-lg font-black text-gray-800 outline-none transition-colors bg-gray-50" />
                  </div>
                  <input type="text" value={editExpensesDesc} onChange={e => setEditExpensesDesc(e.target.value)}
                    placeholder="Descripción del gasto..."
                    className="flex-1 border-2 border-gray-100 focus:border-[#FF4040] rounded-xl py-3 px-4 text-sm font-bold text-gray-600 outline-none transition-colors bg-gray-50" />
                </div>
              </div>

              {editDetails.length > 0 && (
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Detalle de Productos</label>
                  <div className="border border-gray-100 rounded-2xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="py-2.5 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-left">Producto</th>
                          <th className="py-2.5 px-2 text-[10px] font-bold text-blue-400 uppercase tracking-widest text-center">Enviado</th>
                          <th className="py-2.5 px-2 text-[10px] font-bold text-indigo-400 uppercase tracking-widest text-center">Quedó</th>
                          <th className="py-2.5 px-2 text-[10px] font-bold text-green-500 uppercase tracking-widest text-center">Vendido</th>
                          <th className="py-2.5 px-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Precio</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {editDetails.map((d: any, i: number) => (
                          <tr key={i} className="hover:bg-gray-50/50">
                            <td className="py-2 px-4 font-bold text-gray-700 text-xs max-w-[90px] truncate">{d.product}</td>
                            {(['sent','returned'] as const).map(field => (
                              <td key={field} className="py-1.5 px-1 text-center">
                                <input
                                  type="number" min="0"
                                  value={d[field]}
                                  onChange={e => updateEditDetail(i, field, e.target.value)}
                                  className="w-14 text-center border border-gray-200 focus:border-[#FF4040] rounded-lg py-1 text-sm font-black text-gray-800 outline-none bg-white transition-colors"
                                />
                              </td>
                            ))}
                            {/* Vendido: ENVIADO - QUEDÓ, solo lectura */}
                            <td className="py-1.5 px-1 text-center">
                              <span className="inline-block w-14 text-center bg-green-50 border border-green-200 rounded-lg py-1 text-sm font-black text-green-700">
                                {Math.max(0, (parseInt(d.sent) || 0) - (parseInt(d.returned) || 0))}
                              </span>
                            </td>
                            <td className="py-1.5 px-2">
                              <div className="relative">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                                <input
                                  type="number" min="0"
                                  value={d.unitPrice}
                                  onChange={e => updateEditDetail(i, 'unitPrice', e.target.value)}
                                  className="w-20 border border-gray-200 focus:border-[#FF4040] rounded-lg py-1 pl-5 pr-1 text-xs font-black text-gray-800 outline-none bg-white transition-colors text-right"
                                />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="bg-gray-50 border-t border-gray-100 px-4 py-2.5 flex justify-between items-center">
                      <span className="text-xs font-bold text-gray-400">Total Calculado por Productos:</span>
                      <span className="text-sm font-black text-[#FF4040]">
                        {fmt(editDetails.reduce((sum: number, d: any) => sum + Math.max(0, (parseInt(d.sent)||0)-(parseInt(d.returned)||0)) * (parseInt(d.unitPrice) || 0), 0))}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Historial de Envíos (editable) ── */}
              {editLogistics.length > 0 && (
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Historial de Envíos</label>
                  <div className="flex flex-col gap-2.5">
                    {editLogistics.map((entry: any, ei: number) => {
                      const surtidosBefore = editLogistics.slice(0, ei + 1).filter((e: any) => e.type === 'surtido').length;
                      const icon = entry.type === 'carga' ? '📦' : entry.type === 'surtido' ? '🔄' : '📬';
                      const label = entry.type === 'carga' ? 'Carga Inicial'
                        : entry.type === 'surtido' ? `Surtido #${surtidosBefore}`
                        : 'Productos Recibidos';
                      const bg = entry.type === 'carga' ? 'bg-red-50'
                        : entry.type === 'surtido' ? 'bg-amber-50' : 'bg-indigo-50';
                      const textColor = entry.type === 'carga' ? 'text-red-600'
                        : entry.type === 'surtido' ? 'text-amber-700' : 'text-indigo-600';
                      const time = new Date(entry.timestamp).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
                      return (
                        <div key={entry.id || ei} className={`rounded-2xl p-3 ${bg}`}>
                          <div className="flex items-center gap-2 mb-2.5">
                            <span>{icon}</span>
                            <span className={`font-black text-xs ${textColor}`}>{label}</span>
                            <span className="text-gray-400 text-xs ml-auto">{time}</span>
                          </div>
                          <div className="flex flex-col gap-1.5">
                            {(entry.items || []).map((item: any, ii: number) => (
                              <div key={ii} className="flex items-center justify-between bg-white rounded-xl px-3 py-2 border border-white/80 shadow-sm">
                                <span className="font-bold text-gray-700 text-xs truncate max-w-[140px]">{item.name || item.productId}</span>
                                <input
                                  type="number" min="0"
                                  value={item.qty}
                                  onChange={e => updateEditLogisticItem(ei, ii, e.target.value)}
                                  className="w-16 text-center border border-gray-200 focus:border-[#FF4040] rounded-lg py-1 text-sm font-black text-gray-800 outline-none bg-gray-50 transition-colors"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Preview diff */}
              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 text-center">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Diferencia Corregida</p>
                {(() => {
                  const newReal = (parseInt(editCash) || 0) + (parseInt(editTransfer) || 0) + (parseInt(editExpenses) || 0);
                  // Recalcular teórico en tiempo real desde los detalles editados
                  const newTheoretical = editDetails.reduce((sum: number, d: any) =>
                    sum + Math.max(0,(parseInt(d.sent)||0)-(parseInt(d.returned)||0)) * (parseInt(d.unitPrice)||0), 0);
                  const diff = newReal - newTheoretical;
                  return (
                    <p className={`text-2xl font-black ${diff === 0 ? 'text-green-600' : diff < 0 ? 'text-red-500' : 'text-green-600'}`}>
                      {diff === 0 ? '✅ Cuadrado' : diff > 0 ? `Sobrante ${fmt(diff)}` : `Faltante ${fmt(Math.abs(diff))}`}
                    </p>
                  );
                })()}
              </div>
            </div>

            {/* ── Footer fijo — siempre visible ── */}
            <div className="flex gap-3 px-8 py-5 border-t border-gray-100 flex-shrink-0 bg-white rounded-b-[2rem]">
              <button onClick={() => setEditingClosing(null)}
                className="flex-1 py-3.5 rounded-2xl bg-gray-100 text-gray-600 font-bold hover:bg-gray-200 transition-colors active:scale-95 text-sm">
                Cancelar
              </button>
              <button
                onClick={() => {
                  const newCash = parseInt(editCash) || 0;
                  const newTransfer = parseInt(editTransfer) || 0;
                  const newExpenses = parseInt(editExpenses) || 0;
                  const parsedDetails = editDetails.map((d: any) => ({
                    ...d,
                    sent: parseInt(d.sent) || 0,
                    returned: parseInt(d.returned) || 0,
                    sold: Math.max(0, (parseInt(d.sent)||0) - (parseInt(d.returned)||0)),
                    unitPrice: parseInt(d.unitPrice) || 0,
                  }));
                  const soldItems: Record<string, any> = {};
                  parsedDetails.forEach((d: any) => {
                    soldItems[d.product] = { name: d.product, qty: d.sold, sent: d.sent, returned: d.returned, price: d.unitPrice };
                  });
                  const theoreticalOverride = parsedDetails.reduce(
                    (sum: number, d: any) => sum + d.sold * d.unitPrice, 0
                  );
                  updatePosShift(editingClosing.id, {
                    cashAmount: newCash,
                    transferAmount: newTransfer,
                    realAmount: newCash + newTransfer + newExpenses,
                    expenses: newExpenses,
                    expensesDesc: editExpensesDesc,
                    soldItems,
                    theoreticalOverride,
                    productOverrides: parsedDetails.reduce((acc: any, d: any) => { acc[d.product] = { sent: d.sent, returned: d.returned, sold: d.sold }; return acc; }, {}),
                    editedAt: new Date().toISOString(),
                    editHistory: [
                      ...(editingClosing._raw?.editHistory || []),
                      {
                        editedAt: new Date().toISOString(),
                        before: {
                          details: editingClosing.details || [],
                          cash: editingClosing.cashAmount || 0,
                          transfer: editingClosing.transferAmount || 0,
                          expenses: editingClosing.expenses || 0,
                        },
                        after: {
                          details: parsedDetails,
                          cash: newCash,
                          transfer: newTransfer,
                          expenses: newExpenses,
                        },
                      },
                    ],
                  });
                  // Guardar cambios de logística al store
                  for (const entry of editLogistics) {
                    if (entry.type === 'carga' || entry.type === 'recepcion') {
                      updateLoadEntry(entry.id, entry.items);
                    } else if (entry.type === 'surtido') {
                      updateCompletedRequestItems(entry.id, entry.items);
                    }
                  }
                  setEditingClosing(null);
                }}
                className="flex-[2] py-3.5 rounded-2xl bg-[#FF4040] text-white font-black hover:bg-red-500 transition-colors shadow-lg shadow-red-100 active:scale-95 text-sm flex items-center justify-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                Guardar Corrección
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal: Descripción de Salidas ─── */}
      {expensesDescModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          onClick={() => setExpensesDescModal(null)}
        >
          <div
            className="bg-white rounded-[28px] p-7 shadow-2xl w-full max-w-sm animate-[fadeIn_0.2s_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-red-50 flex items-center justify-center text-xl">📌</div>
              <div>
                <h3 className="font-black text-gray-900 text-base leading-tight">Descripción de Salidas</h3>
                <p className="text-xs font-bold text-gray-400">{expensesDescModal.name}</p>
              </div>
              <button
                onClick={() => setExpensesDescModal(null)}
                className="ml-auto w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 font-black transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="bg-red-50 rounded-2xl p-4 mb-4 border border-red-100">
              <p className="text-sm font-bold text-red-400 uppercase tracking-widest mb-1">Monto</p>
              <p className="text-2xl font-black text-red-600">{fmt(expensesDescModal.amount)}</p>
            </div>

            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Nota del vendedor</p>
              <p className="text-sm font-bold text-gray-800 leading-relaxed">
                {expensesDescModal.desc && expensesDescModal.desc.trim() !== ''
                  ? expensesDescModal.desc
                  : <span className="text-gray-400 italic">Sin descripción registrada</span>
                }
              </p>
            </div>

            <button
              onClick={() => setExpensesDescModal(null)}
              className="mt-5 w-full py-3 rounded-2xl bg-gray-900 text-white font-black text-sm hover:bg-gray-700 transition-colors active:scale-95"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export const AdminIncomesTab = () => {
  const { incomes } = useFinanceStore();

  const exportIncomesToExcel = () => {
    if (!incomes || incomes.length === 0) { alert('No hay ingresos para exportar.'); return; }
    const data = incomes.map((inc: any) => ({
      Fecha: new Date(inc.fecha || inc.created_at).toLocaleDateString(),
      Ubicación: inc.ubicacion,
      Jornada: inc.jornada,
      Tipo: inc.tipo,
      Efectivo: inc.efectivo,
      Transferencias: inc.transferencias,
      Salidas: inc.salidas,
      Total: inc.total,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ingresos');
    XLSX.writeFile(wb, `Ingresos_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="flex-1 flex flex-col gap-6 mt-2">
      <div className="bg-white rounded-[2rem] p-6 md:p-8 shadow-sm border border-gray-100">
        <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
          <h3 className="text-xl font-black text-gray-800">Ingresos Registrados</h3>
          <button
            onClick={exportIncomesToExcel}
            className="bg-green-600 hover:bg-green-500 text-white font-bold text-sm px-5 py-2.5 rounded-xl shadow-md transition-all hover:scale-[1.02] active:scale-95 flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
            Exportar Excel
          </button>
        </div>

        {(!incomes || incomes.length === 0) ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-5xl mb-3">💰</p>
            <p className="font-bold">No hay ingresos registrados aún.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b-2 border-gray-100">
                  <th className="pb-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Fecha</th>
                  <th className="pb-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Ubicación</th>
                  <th className="pb-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Jornada</th>
                  <th className="pb-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Tipo</th>
                  <th className="pb-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Efectivo</th>
                  <th className="pb-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Transf.</th>
                  <th className="pb-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {incomes.map((inc: any, idx: number) => (
                  <tr key={idx} className="hover:bg-gray-50/50">
                    <td className="py-3 font-bold text-gray-600">{new Date(inc.fecha || inc.created_at).toLocaleDateString('es-CO')}</td>
                    <td className="py-3 font-bold text-gray-800">{inc.ubicacion}</td>
                    <td className="py-3"><span className="bg-gray-100 text-gray-500 text-[10px] font-bold px-2 py-0.5 rounded-md">{inc.jornada}</span></td>
                    <td className="py-3 font-bold text-gray-600">{inc.tipo}</td>
                    <td className="py-3 text-right font-bold text-gray-700">{fmt(inc.efectivo || 0)}</td>
                    <td className="py-3 text-right font-bold text-gray-700">{fmt(inc.transferencias || 0)}</td>
                    <td className="py-3 text-right font-black text-gray-800">{fmt(inc.total || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export const AdminExpensesTab = () => {
  const { expenses } = useFinanceStore();

  const exportExpensesToExcel = () => {
    if (!expenses || expenses.length === 0) { alert('No hay gastos para exportar.'); return; }
    const data = expenses.map((exp: any) => ({
      Fecha: new Date(exp.fecha || exp.created_at).toLocaleDateString(),
      Proveedor: exp.proveedor,
      'Descripción / Motivo': exp.descripcion,
      'Monto ($)': exp.valor,
      Adjunto: exp.facturaUrl || 'N/A',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Egresos');
    XLSX.writeFile(wb, `Egresos_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="flex-1 flex flex-col gap-6 mt-2">
      <div className="bg-white rounded-[2rem] p-6 md:p-8 shadow-sm border border-gray-100">
        <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
          <h3 className="text-xl font-black text-gray-800">Egresos Registrados</h3>
          <button
            onClick={exportExpensesToExcel}
            className="bg-red-600 hover:bg-red-500 text-white font-bold text-sm px-5 py-2.5 rounded-xl shadow-md transition-all hover:scale-[1.02] active:scale-95 flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
            Exportar Excel
          </button>
        </div>

        {(!expenses || expenses.length === 0) ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-5xl mb-3">💸</p>
            <p className="font-bold">No hay egresos registrados aún.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b-2 border-gray-100">
                  <th className="pb-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Fecha</th>
                  <th className="pb-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Proveedor</th>
                  <th className="pb-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Descripción</th>
                  <th className="pb-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {expenses.map((exp: any, idx: number) => (
                  <tr key={idx} className="hover:bg-gray-50/50">
                    <td className="py-3 font-bold text-gray-600">{new Date(exp.fecha || exp.created_at).toLocaleDateString('es-CO')}</td>
                    <td className="py-3 font-bold text-gray-800">{exp.proveedor || '—'}</td>
                    <td className="py-3 font-bold text-gray-600">{exp.descripcion}</td>
                    <td className="py-3 text-right font-black text-red-500">{fmt(exp.valor || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Modal: Descripción de Salidas ─── */}
      {expensesDescModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          onClick={() => setExpensesDescModal(null)}
        >
          <div
            className="bg-white rounded-[28px] p-7 shadow-2xl w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-red-50 flex items-center justify-center text-xl">📌</div>
              <div>
                <h3 className="font-black text-gray-900 text-base leading-tight">Descripción de Salidas</h3>
                <p className="text-xs font-bold text-gray-400">{expensesDescModal.name}</p>
              </div>
              <button
                onClick={() => setExpensesDescModal(null)}
                className="ml-auto w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 font-black transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="bg-red-50 rounded-2xl p-4 mb-4 border border-red-100">
              <p className="text-sm font-bold text-red-400 uppercase tracking-widest mb-1">Monto</p>
              <p className="text-2xl font-black text-red-600">{fmt(expensesDescModal.amount)}</p>
            </div>

            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Nota del vendedor</p>
              <p className="text-sm font-bold text-gray-800 leading-relaxed">
                {expensesDescModal.desc && expensesDescModal.desc.trim() !== ''
                  ? expensesDescModal.desc
                  : <span className="text-gray-400 italic">Sin descripción registrada</span>
                }
              </p>
            </div>

            <button
              onClick={() => setExpensesDescModal(null)}
              className="mt-5 w-full py-3 rounded-2xl bg-gray-900 text-white font-black text-sm hover:bg-gray-700 transition-colors active:scale-95"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
