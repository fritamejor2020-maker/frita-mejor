import React, { useState } from 'react';
import { useFinanceStore } from '../../store/useFinanceStore';
import { useInventoryStore } from '../../store/useInventoryStore';
import { useLogisticsStore } from '../../store/useLogisticsStore';
import * as XLSX from 'xlsx';

// ─── Helpers ────────────────────────────────────────────────
import { formatMoney as fmt } from '../../utils/formatUtils';

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

  const updateEditDetail = (idx: number, field: string, value: string) => {
    setEditDetails(prev => prev.map((d, i) => i === idx ? { ...d, [field]: value } : d));
  };

  // Filter logic
  const mappedShifts = (posShifts || []).filter((s: any) => s.closedAt).map((s: any) => {
     let details: ClosingDetail[] = [];
     let theoretical = 0;
     let real = 0;
     let expenses = 0;

     if (s.type === 'VENDEDOR') {
         // Recalculate live from logistics for accurate details
         const priceMap: Record<string, { price: number, name: string }> = {};
         (useInventoryStore.getState().getPosItems() || []).forEach((p: any) => {
           priceMap[p.id] = { price: p.price || 0, name: p.name };
         });
         const { soldItems: liveSold, theoretical: liveTheoretical } =
           useLogisticsStore.getState().calcSoldByVehicle(s.pointId, priceMap, s.openedAt);
         // Fall back to stored soldItems if logistics has no record (e.g. old shifts)
         const soldSource = Object.keys(liveSold).length > 0 ? liveSold : (s.soldItems || {});
         theoretical = Object.keys(liveSold).length > 0 ? liveTheoretical : (s.theorySales || 0);
         real = s.realAmount || 0;
         expenses = s.expensesAmount || s.expenses || 0;
         details = Object.values(soldSource).map((i: any) => ({
             product: i.name,
             sent: i.qty,
             returned: 0,
             sold: i.qty,
             unitPrice: i.price || priceMap[i.id]?.price || 0
         }));
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

     return {
        id: s.id,
        _raw: s, // keep raw shift for editing
        pointName: vendorName,
        pointLabel,
        initials: (s.pointId || vendorName || 'CA').substring(0, 2).toUpperCase(),
        shift: s.shift || 'TD',
        date: new Date(s.closedAt).toISOString().split('T')[0],
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
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="py-3 px-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Producto</th>
                          <th className="py-3 px-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Enviado</th>
                          <th className="py-3 px-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Quedó</th>
                          <th className="py-3 px-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Venta</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {closing.details.map((d, i) => (
                          <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                            <td className="py-3.5 px-5 font-bold text-gray-800">{d.product}</td>
                            <td className="py-3.5 px-5 text-gray-600 text-center font-bold">{d.sent}</td>
                            <td className="py-3.5 px-5 text-gray-600 text-center font-bold">{d.returned}</td>
                            <td className="py-3.5 px-5 text-right">
                              <span className="font-black text-gray-800">{d.sold}</span>
                              <p className="text-[11px] text-gray-400 font-bold">{fmt(d.sold * d.unitPrice)}</p>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Calculated Total */}
                    <div className="border-t border-gray-100 py-4 px-5 flex justify-end items-center gap-3 bg-gray-50/50">
                      <span className="text-sm font-bold text-gray-500">Total Teórico Calculado:</span>
                      <span className="text-lg font-black text-[#FF4040]">{fmt(calculatedTheoretical)}</span>
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
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] p-8 shadow-2xl w-full max-w-md flex flex-col gap-6 animate-[fadeIn_0.2s_ease-out]">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-black text-gray-800">Editar Cierre</h3>
                <p className="text-sm font-bold text-gray-400 mt-0.5">{editingClosing.pointName} · {editingClosing.shift} · {editingClosing.date}</p>
              </div>
              <button onClick={() => setEditingClosing(null)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

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

            {/* Editable details table */}
            {editDetails.length > 0 && (
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Detalle de Productos</label>
                <div className="border border-gray-100 rounded-2xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="py-2.5 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-left">Producto</th>
                        <th className="py-2.5 px-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Enviado</th>
                        <th className="py-2.5 px-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Quedó</th>
                        <th className="py-2.5 px-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Vendido</th>
                        <th className="py-2.5 px-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Price</th>
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

            <div className="flex gap-3 pt-1">
              <button onClick={() => setEditingClosing(null)}
                className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-600 font-bold hover:bg-gray-200 transition-colors active:scale-95">
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
                  // Recalculate soldItems map for VENDEDOR type
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
                  setEditingClosing(null);
                }}
                className="flex-[2] py-3 rounded-xl bg-[#FF4040] text-white font-black hover:bg-red-500 transition-colors shadow-lg shadow-red-100 active:scale-95"
              >
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
