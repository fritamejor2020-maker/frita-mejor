import React, { useState } from 'react';
import { useFinanceStore } from '../../store/useFinanceStore';
import { useInventoryStore } from '../../store/useInventoryStore';
import { useLogisticsStore } from '../../store/useLogisticsStore';
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

  // Precio por productId
  const priceMap: Record<string, { price: number; name: string }> = {};
  products.forEach((p: any) => { priceMap[p.id] = { price: p.price || 0, name: p.name }; });

  // Fecha para filtro
  const dateOf = (iso: string) => iso ? new Date(iso).toISOString().split('T')[0] : '';

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

    // Carga inicial (suma por producto)
    const cargaMap: Record<string, { name: string; qty: number }> = {};
    loadHistory
      .filter((e: any) => e.type === 'carga' && e.vehicleId === vehicleId)
      .forEach((e: any) => {
        e.items.forEach(({ productId, qty, name }: any) => {
          if (!cargaMap[productId]) cargaMap[productId] = { name: name || priceMap[productId]?.name || productId, qty: 0 };
          cargaMap[productId].qty += qty;
        });
      });

    // Surtidos entregados
    const surtidoMap: Record<string, { name: string; qty: number }> = {};
    completedRequests
      .filter((r: any) => r.requester_point_id === vehicleId)
      .forEach((r: any) => {
        (r.items_payload || []).forEach(({ productId, qty, name }: any) => {
          if (!surtidoMap[productId]) surtidoMap[productId] = { name: name || priceMap[productId]?.name || productId, qty: 0 };
          surtidoMap[productId].qty += qty;
        });
      });

    // Sobrantes (recepcion)
    const sobranteMap: Record<string, { name: string; qty: number }> = {};
    loadHistory
      .filter((e: any) => e.type === 'recepcion' && e.vehicleId === vehicleId)
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

    return {
      vehicleId,
      shiftDate,
      shiftTurno,
      responsibleName,
      productLines,
      theoreticalTotal,
      realAmount,
      cashAmount,
      transferAmount,
      expenses,
      diff,
      hasCierre: !!latestShift,
      // Dejador info from the DEJADOR posShift of same date/turno
      dejadorShift: (posShifts || []).find((s: any) =>
        s.type === 'DEJADOR' &&
        s.shift === shiftTurno &&
        dateOf(s.closedAt) === shiftDate
      ) || null,
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
}

interface MockClosing {
  id: string;
  pointName: string;
  initials: string;
  shift: string;
  date: string;
  theoretical: number;  // Ventas POS calculadas (sin incluir gastos)
  real: number;         // Cash + Transferencias entregado por el vendedor
  expenses: number;     // Gastos declarados por el vendedor
  details: ClosingDetail[];
}

const MOCK_CLOSINGS: MockClosing[] = [
  {
    id: 'CL-001',
    pointName: 'Triciclo 01',
    initials: 'Tr',
    shift: 'AM',
    date: '2026-03-16',
    theoretical: 250000,
    real: 245000,
    expenses: 5000,
    details: [
      { product: 'Empanada', sent: 100, returned: 0, sold: 100, unitPrice: 2500 },
      { product: 'Pastel de Pollo', sent: 50, returned: 10, sold: 40, unitPrice: 3000 },
      { product: 'Vaso 7oz', sent: 200, returned: 50, sold: 150, unitPrice: 500 },
    ],
  },
  {
    id: 'CL-002',
    pointName: 'Triciclo 02',
    initials: 'Tr',
    shift: 'AM',
    date: '2026-03-16',
    theoretical: 180000,
    real: 165000,
    expenses: 10000,
    details: [
      { product: 'Empanada', sent: 80, returned: 5, sold: 75, unitPrice: 2500 },
      { product: 'Dedito de Queso', sent: 30, returned: 5, sold: 25, unitPrice: 2000 },
      { product: 'Vaso 7oz', sent: 100, returned: 30, sold: 70, unitPrice: 500 },
    ],
  },
  {
    id: 'CL-003',
    pointName: 'Triciclo 01',
    initials: 'Tr',
    shift: 'PM',
    date: '2026-03-15',
    theoretical: 320000,
    real: 320000,
    expenses: 5000,
    details: [
      { product: 'Empanada', sent: 120, returned: 10, sold: 110, unitPrice: 2500 },
      { product: 'Chorizo', sent: 40, returned: 0, sold: 40, unitPrice: 3500 },
      { product: 'Papas Rellenas', sent: 60, returned: 15, sold: 45, unitPrice: 2000 },
    ],
  },
  {
    id: 'CL-004',
    pointName: 'Local 01',
    initials: 'Lo',
    shift: 'AM',
    date: '2026-03-16',
    theoretical: 450000,
    real: 440000,
    expenses: 10000,
    details: [
      { product: 'Empanada', sent: 200, returned: 0, sold: 200, unitPrice: 2500 },
      { product: 'Pastel de Pollo', sent: 80, returned: 20, sold: 60, unitPrice: 3000 },
      { product: 'Dedito de Queso', sent: 50, returned: 10, sold: 40, unitPrice: 2000 },
    ],
  },
];

// ─── Component: Cierres ──────────────────────────────────────────────
export const AdminFinancesTab = () => {
  const { posShifts, posSales, posExpenses, updatePosShift } = useInventoryStore();
  const { loadHistory, completedRequests, updateLoadEntry, updateCompletedRequestItems } = useLogisticsStore();

  // Cierres filters
  const [filterDate, setFilterDate] = useState('');
  const [filterShift, setFilterShift] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingClosing, setEditingClosing] = useState<any | null>(null);
  const [editCash, setEditCash] = useState('');
  const [editTransfer, setEditTransfer] = useState('');
  const [editExpenses, setEditExpenses] = useState('');
  const [editExpensesDesc, setEditExpensesDesc] = useState('');
  const [editDetails, setEditDetails] = useState<any[]>([]);
  const [editLogistics, setEditLogistics] = useState<any[]>([]); // historial editable

  const updateEditDetail = (idx: number, field: string, value: string) => {
    setEditDetails(prev => prev.map((d, i) => i === idx ? { ...d, [field]: value } : d));
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
  const dateOf = (ts: string) => ts ? new Date(ts).toISOString().split('T')[0] : '';

  // Carga el historial logístico de un vehículo en una fecha dada
  const buildLogisticsTimeline = (vehicleId: string, shiftDate: string) => {
    // Deduplicar por ID para evitar entradas repetidas
    const seenIds = new Set<string>();

    const logEntries = (loadHistory as any[])
      .filter(e => {
        if (e.vehicleId !== vehicleId || dateOf(e.timestamp) !== shiftDate) return false;
        if (seenIds.has(e.id)) return false; // descarta duplicados
        seenIds.add(e.id);
        return true;
      })
      .map(e => ({ id: e.id, type: e.type, timestamp: e.timestamp, items: e.items.map((i: any) => ({ ...i })) }));

    const surtidoEntries = (completedRequests as any[])
      .filter(r => {
        if (r.requester_point_id !== vehicleId || dateOf(r.completed_at || r.created_at) !== shiftDate) return false;
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
     const shiftDate = new Date(s.closedAt).toISOString().split('T')[0];

     if (s.type === 'VENDEDOR') {
         const priceMap: Record<string, { price: number, name: string }> = {};
         (useInventoryStore.getState().getPosItems() || []).forEach((p: any) => {
           priceMap[p.id] = { price: p.price || 0, name: p.name };
         });

         const { loadHistory, completedRequests } = useLogisticsStore.getState();
         const vehicleId = s.pointId;

         // Carga inicial por producto — solo del día del cierre, deduplicar por ID
         const seenCargaIds = new Set<string>();
         const cargaMap: Record<string, { name: string; qty: number }> = {};
         loadHistory
           .filter((e: any) => e.type === 'carga' && e.vehicleId === vehicleId
             && dateOf(e.timestamp) === shiftDate   // ← solo la jornada del cierre
             && !seenCargaIds.has(e.id) && (seenCargaIds.add(e.id) || true))
           .forEach((e: any) => {
             e.items.forEach(({ productId, qty, name }: any) => {
               if (!cargaMap[productId]) cargaMap[productId] = { name: name || priceMap[productId]?.name || productId, qty: 0 };
               cargaMap[productId].qty += qty;
             });
           });

         // Surtidos entregados — solo del día del cierre, deduplicar por ID
         const seenSurtidoIds = new Set<string>();
         const surtidoMap: Record<string, { name: string; qty: number }> = {};
         completedRequests
           .filter((r: any) => r.requester_point_id === vehicleId
             && dateOf(r.completed_at || r.created_at) === shiftDate  // ← solo la jornada
             && !seenSurtidoIds.has(r.id) && (seenSurtidoIds.add(r.id) || true))
           .forEach((r: any) => {
             (r.items_payload || []).forEach(({ productId, qty, name }: any) => {
               if (!surtidoMap[productId]) surtidoMap[productId] = { name: name || priceMap[productId]?.name || productId, qty: 0 };
               surtidoMap[productId].qty += qty;
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

         const allPids = new Set([...Object.keys(cargaMap), ...Object.keys(surtidoMap), ...Object.keys(sobranteMap)]);
         theoretical = 0;
         details = [];
         allPids.forEach(pid => {
           const carga = cargaMap[pid]?.qty || 0;
           const surtido = surtidoMap[pid]?.qty || 0;
           const sobrante = sobranteMap[pid]?.qty || 0;
           const enviado = carga + surtido;          // Carga Inicial + Surtidos
           const quedo = sobrante;                   // Sobrantes devueltos
           const vendido = Math.max(0, enviado - quedo);
           const unitPrice = priceMap[pid]?.price || 0;
           const prodName = priceMap[pid]?.name || cargaMap[pid]?.name || surtidoMap[pid]?.name || sobranteMap[pid]?.name || pid;
           theoretical += vendido * unitPrice;
           details.push({ product: prodName, sent: enviado, returned: quedo, sold: vendido, unitPrice });
         });

         // Si no hay logística registrada, caer en soldItems almacenados
         if (details.length === 0 && s.soldItems) {
           Object.values(s.soldItems).forEach((i: any) => {
             const price = priceMap[i.id]?.price || i.price || 0;
             theoretical += (i.qty || 0) * price;
             details.push({ product: i.name || i.id, sent: i.qty || 0, returned: 0, sold: i.qty || 0, unitPrice: price });
           });
           if (details.length === 0) theoretical = s.theorySales || 0;
         }

         real = s.realAmount || 0;
         expenses = s.expensesAmount || s.expenses || 0;
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
     // para mostrar quién fue el anotador y el dejador que trabajaron con este vendedor
     const matchingDejadorShift = (posShifts || []).find((ds: any) =>
       ds.type === 'DEJADOR' &&
       ds.shift === (s.shift || '') &&
       ds.closedAt &&
       new Date(ds.closedAt).toISOString().split('T')[0] === shiftDate
     );

     return {
        id: s.id,
        _raw: s, // keep raw shift for editing
        pointName: vendorName,
        pointLabel,
        initials: (s.pointId || vendorName || 'CA').substring(0, 2).toUpperCase(),
        shift: s.shift || 'TD',
        date: shiftDate,
        type: s.type || '',
        // Anotador y Dejador vienen del cierre del DEJADOR de la misma jornada
        anotadorName: matchingDejadorShift?.anotadorName || null,
        dejadorName: matchingDejadorShift?.dejadorName || null,
        theoretical,
        real,
        expenses,
        details
     };
  });

  const filteredClosings = [...mappedShifts, ...MOCK_CLOSINGS].filter((c: any) => {
    if (filterDate && c.date !== filterDate) return false;
    if (filterShift && c.shift !== filterShift) return false;
    return true;
  });

  // El Teórico (APP) = ventas POS + gastos
  const getTheoreticalWithExpenses = (c: any) => c.theoretical + (c.expenses || 0);
  
  // Diff = Real - (Theoretical + Expenses)
  const getDiff = (c: any) => c.real - getTheoreticalWithExpenses(c);

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
      return (
        <span className="inline-flex items-center gap-1.5 bg-red-50 text-red-500 text-xs font-bold px-3 py-1.5 rounded-full">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
          Faltante: {fmt(Math.abs(diff))}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 bg-green-50 text-green-600 text-xs font-bold px-3 py-1.5 rounded-full">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
        Sobrante: {fmt(diff)}
      </span>
    );
  };

  return (
    <div className="flex-1 flex flex-col gap-6">
      {/* Filters */}
      <div className="inline-flex items-center gap-3 bg-white rounded-full px-5 py-2.5 shadow-sm border border-gray-100 self-center flex-wrap justify-center mt-2">
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
                     </div>
                  </div>

                  {/* Edit icon — only for real shifts (not mock) */}
                  {closing._raw && (
                    <button
                      className="text-gray-300 hover:text-[#FF4040] transition-colors p-1.5 mt-0.5 hover:bg-red-50 rounded-lg"
                      title="Editar cierre"
                      onClick={() => {
                        setEditingClosing(closing);
                        setEditCash(String(closing._raw.cashAmount || closing.real || 0));
                        setEditTransfer(String(closing._raw.transferAmount || 0));
                        setEditExpenses(String(closing.expenses || 0));
                        setEditExpensesDesc(closing._raw.expensesDesc || '');
                        setEditDetails(closing.details.map((d: any) => ({ ...d })));
                        // Cargar historial logístico editable
                        const vehicleId = closing._raw?.pointId;
                        if (vehicleId) {
                          setEditLogistics(buildLogisticsTimeline(vehicleId, closing.date));
                        } else {
                          setEditLogistics([]);
                        }
                      }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                    </button>
                  )}
                </div>

                {/* ─── Comparison Block ────────────────── */}
                <div className="bg-gray-50 rounded-2xl border border-gray-100 mb-4">
                  <div className="grid grid-cols-2 divide-x divide-gray-200">
                    <div className="py-5 px-6 text-center">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Teórico (APP)</p>
                      <p className="text-2xl font-black text-gray-800">{fmt(getTheoreticalWithExpenses(closing))}</p>
                      {(closing.expenses ?? 0) > 0 && (
                        <p className="text-[10px] font-bold text-blue-400 mt-1">
                          Ventas {fmt(closing.theoretical)} + Gastos {fmt(closing.expenses ?? 0)}
                        </p>
                      )}
                    </div>
                    <div className="py-5 px-6 text-center">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Real (Caja)</p>
                      <p className="text-2xl font-black text-gray-800">{fmt(closing.real)}</p>
                      <p className="text-[10px] font-bold text-gray-300 mt-1">Efectivo + Transferencias</p>
                    </div>
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

                     {/* ── Historial de Envíos (timeline) ── */}
                     {closing._raw?.pointId && (() => {
                       const timeline = buildLogisticsTimeline(closing._raw.pointId, closing.date);
                       if (timeline.length === 0) return null;
                       let surtidoCount = 0;
                       return (
                         <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/30">
                           <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">📋 Historial de Envíos</p>
                           <div className="flex flex-col gap-2.5">
                             {timeline.map((entry: any, idx: number) => {
                               if (entry.type === 'surtido') surtidoCount++;
                               const icon = entry.type === 'carga' ? '📦' : entry.type === 'surtido' ? '🔄' : '📬';
                               const label = entry.type === 'carga' ? 'Carga Inicial'
                                 : entry.type === 'surtido' ? `Surtido #${surtidoCount}`
                                 : 'Productos Recibidos';
                               const bg = entry.type === 'carga' ? 'bg-red-50 border-red-100'
                                 : entry.type === 'surtido' ? 'bg-amber-50 border-amber-100'
                                 : 'bg-indigo-50 border-indigo-100';
                               const textColor = entry.type === 'carga' ? 'text-red-600'
                                 : entry.type === 'surtido' ? 'text-amber-700' : 'text-indigo-600';
                               const time = new Date(entry.timestamp).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
                               return (
                                 <div key={entry.id || idx} className={`rounded-2xl border p-3 ${bg}`}>
                                   <div className="flex items-center gap-2 mb-2">
                                     <span>{icon}</span>
                                     <span className={`font-black text-sm ${textColor}`}>{label}</span>
                                     <span className="text-gray-400 text-xs font-bold ml-auto">{time}</span>
                                   </div>
                                   <div className="flex flex-wrap gap-2">
                                     {(entry.items || []).map((item: any, ii: number) => (
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
                                <div className="flex items-center gap-2">
                                  <span className="bg-gray-900 text-white text-[10px] font-black px-2 py-0.5 rounded-md">
                                    {(d.product || '??').substring(0, 3).toUpperCase()}
                                  </span>
                                  <span className="font-bold text-gray-800">{d.product}</span>
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
                            {(['sent','returned','sold'] as const).map(field => (
                              <td key={field} className="py-1.5 px-1 text-center">
                                <input
                                  type="number" min="0"
                                  value={d[field]}
                                  onChange={e => updateEditDetail(i, field, e.target.value)}
                                  className="w-14 text-center border border-gray-200 focus:border-[#FF4040] rounded-lg py-1 text-sm font-black text-gray-800 outline-none bg-white transition-colors"
                                />
                              </td>
                            ))}
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
                        {fmt(editDetails.reduce((sum: number, d: any) => sum + (parseInt(d.sold) || 0) * (parseInt(d.unitPrice) || 0), 0))}
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
                  const newReal = (parseInt(editCash) || 0) + (parseInt(editTransfer) || 0);
                  const newTheoretical = editingClosing.theoretical + (parseInt(editExpenses) || 0);
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
                    sold: parseInt(d.sold) || 0,
                    unitPrice: parseInt(d.unitPrice) || 0,
                  }));
                  const soldItems: Record<string, any> = {};
                  parsedDetails.forEach((d: any) => {
                    soldItems[d.product] = { name: d.product, qty: d.sold, price: d.unitPrice };
                  });
                  updatePosShift(editingClosing.id, {
                    cashAmount: newCash,
                    transferAmount: newTransfer,
                    realAmount: newCash + newTransfer,
                    expenses: newExpenses,
                    expensesDesc: editExpensesDesc,
                    soldItems,
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
    </div>
  );
};
