import React, { useRef, useEffect, useState } from 'react';
import { useFinanceStore } from '../../../store/useFinanceStore';
import { formatMoney } from '../../../utils/formatUtils';

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'ahora';
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  return `hace ${d}d`;
}

function initials(name = '') {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
}

const AVATAR_COLORS = [
  'bg-red-500', 'bg-rose-500', 'bg-orange-500', 'bg-pink-500',
  'bg-fuchsia-500', 'bg-red-700', 'bg-orange-600',
];
function avatarColor(name = '') {
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ── Burbuja de gasto ──────────────────────────────────────────────────────────
function ExpenseBubble({ expense }) {
  const name  = expense.creado_por || 'Sistema';
  const time  = timeAgo(expense.fecha || expense.created_at);
  const color = avatarColor(name);
  const [showPhoto, setShowPhoto] = useState(false);

  const waText = encodeURIComponent(
    `💸 *GASTO REGISTRADO*\n` +
    `👤 ${name}\n` +
    `📋 ${expense.descripcion || ''}\n` +
    `🏪 Proveedor: ${expense.proveedor || '—'}\n` +
    `💰 Valor: ${formatMoney(expense.valor || 0)}\n` +
    `📅 Fecha: ${expense.fecha || ''}\n` +
    (expense.facturaUrl ? `🖼️ Factura: ${expense.facturaUrl}\n` : '') +
    `🕐 Registrado: ${new Date(expense.created_at || expense.fecha).toLocaleString('es-CO')}`
  );

  return (
    <div className="flex items-end gap-2 mb-3">
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-full ${color} flex items-center justify-center text-white text-xs font-black flex-shrink-0`}>
        {initials(name)}
      </div>

      {/* Burbuja */}
      <div className="max-w-[78%]">
        <p className="text-[10px] font-bold text-gray-400 mb-1 ml-1">{name} · {time}</p>
        <div className="bg-[#2d1e1e] border border-red-900/40 rounded-[18px] rounded-bl-sm px-4 py-3 shadow-sm">

          {/* Descripción */}
          <p className="text-white font-bold text-sm mb-2 leading-snug">{expense.descripcion || 'Sin descripción'}</p>

          {/* Proveedor */}
          {expense.proveedor && (
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-[10px] font-bold bg-red-900/40 text-red-300 px-2 py-0.5 rounded-full">
                🏪 {expense.proveedor}
              </span>
            </div>
          )}

          {/* Foto de factura */}
          {expense.facturaUrl && (
            <div className="mb-2">
              {showPhoto ? (
                <div className="relative">
                  <img
                    src={expense.facturaUrl}
                    alt="Factura"
                    className="w-full max-h-48 object-cover rounded-xl border border-red-900/30"
                  />
                  <button
                    onClick={() => setShowPhoto(false)}
                    className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-red-700 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowPhoto(true)}
                  className="flex items-center gap-2 text-xs font-bold text-red-400 hover:text-red-300 transition-colors bg-red-900/20 hover:bg-red-900/30 rounded-xl px-3 py-2 w-full"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  Ver factura adjunta
                </button>
              )}
            </div>
          )}

          {/* Monto */}
          <div className="flex justify-between items-center pt-2 border-t border-red-900/30">
            <span className="text-gray-400 font-bold text-xs uppercase tracking-wider">Valor</span>
            <span className="font-black text-red-400 text-xl">{formatMoney(expense.valor || 0)}</span>
          </div>
        </div>

        {/* Botón compartir */}
        <a
          href={`https://wa.me/?text=${waText}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[10px] font-bold text-gray-600 hover:text-green-400 transition-colors mt-1 ml-1"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          Compartir
        </a>
      </div>
    </div>
  );
}

// ── Chat completo de gastos ───────────────────────────────────────────────────
export function ExpensesChatView({ onClose }) {
  const expenses = useFinanceStore((s) => s.expenses);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [expenses.length]);

  const total = expenses.reduce((s, e) => s + (e.valor || 0), 0);

  const waResumen = encodeURIComponent(
    `📊 *RESUMEN DE GASTOS*\n\n` +
    expenses.slice(0, 20).map(e =>
      `• ${e.descripcion || '—'} (${e.proveedor || '—'}): ${formatMoney(e.valor || 0)}`
    ).join('\n') +
    `\n\n💸 *TOTAL GASTADO: ${formatMoney(total)}*\n` +
    `📅 ${new Date().toLocaleDateString('es-CO')}`
  );

  return (
    <div className="fixed inset-0 z-[90] bg-[#0f0a0a] flex flex-col">
      {/* Header */}
      <div className="bg-[#a72020] px-4 py-3 flex items-center gap-3 shadow-lg flex-shrink-0">
        <button onClick={onClose} className="text-white hover:text-red-200 transition-colors p-1">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </button>
        <div className="w-10 h-10 rounded-full bg-red-900 flex items-center justify-center text-xl flex-shrink-0">💸</div>
        <div className="flex-1">
          <h2 className="text-white font-black text-base leading-tight">Chat de Gastos</h2>
          <p className="text-red-200 text-xs font-bold">{expenses.length} registros · Total: {formatMoney(total)}</p>
        </div>
        <a
          href={`https://wa.me/?text=${waResumen}`}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-white/20 hover:bg-white/30 text-white px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          Compartir resumen
        </a>
      </div>

      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto px-4 py-4" style={{ background: 'linear-gradient(rgba(0,0,0,0.75) 0%, rgba(20,0,0,0.95) 100%)' }}>
        {expenses.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <span className="text-6xl opacity-30">💸</span>
            <p className="text-gray-500 font-bold text-lg">Sin gastos registrados</p>
            <p className="text-gray-600 font-bold text-sm">Los gastos que registres aparecerán aquí</p>
          </div>
        ) : (
          <>
            {[...expenses].reverse().map((expense) => (
              <ExpenseBubble key={expense.id || expense.created_at} expense={expense} />
            ))}
            <div ref={bottomRef} />
          </>
        )}
      </div>
    </div>
  );
}
