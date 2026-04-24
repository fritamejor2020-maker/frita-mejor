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
  'bg-green-500', 'bg-teal-500', 'bg-emerald-500', 'bg-cyan-600',
  'bg-lime-600', 'bg-blue-500', 'bg-indigo-500',
];
function avatarColor(name = '') {
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ── Thumbnail de foto expandible ────────────────────────────────────────────
// Prioriza photoUrl (Supabase Storage, visible en todos los dispositivos)
// Fallback a photoBase64 (solo local, del dispositivo que tomó la foto)
function PhotoThumbnail({ src, rotation = 0 }) {
  const [expanded, setExpanded] = useState(false);
  if (!src) return null;
  return (
    <>
      <div className="mt-2 cursor-pointer" onClick={() => setExpanded(true)}>
        <img
          src={src}
          alt="Foto sobre"
          style={{ transform: `rotate(${rotation}deg)`, transition: 'transform 0.2s' }}
          className="w-full max-h-32 object-cover rounded-xl border border-green-800/50 hover:opacity-90 transition-opacity"
        />
        <p className="text-[9px] font-bold text-gray-600 mt-0.5 ml-0.5">Toca para ver completa</p>
      </div>
      {expanded && (
        <div className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center" onClick={() => setExpanded(false)}>
          <img
            src={src}
            alt="Foto sobre"
            style={{ transform: `rotate(${rotation}deg)`, transition: 'transform 0.2s' }}
            className="max-w-full max-h-full object-contain rounded-xl"
          />
          <button onClick={() => setExpanded(false)} className="absolute top-4 right-4 text-white bg-black/50 rounded-full w-10 h-10 flex items-center justify-center text-xl font-black">✕</button>
        </div>
      )}
    </>
  );
}

// ── Burbuja de ingreso ────────────────────────────────────────────────────────
function IncomesBubble({ income }) {
  const name    = income.creado_por || income.vendedor || 'Sistema';
  const time    = timeAgo(income.fecha || income.created_at);
  const color   = avatarColor(name);

  const shareText =
    `💰 *INGRESO REGISTRADO*\n` +
    `👤 ${name}\n` +
    `📍 ${income.ubicacion || ''} ${income.jornada ? `· Jornada ${income.jornada}` : ''} ${income.tipo ? `· ${income.tipo}` : ''}\n` +
    (income.vendedor ? `🛵 Vendedor: ${income.vendedor}\n` : '') +
    `💵 Efectivo: ${formatMoney(income.efectivo || 0)}\n` +
    (income.transferencias ? `📲 Transferencias: ${formatMoney(income.transferencias)}\n` : '') +
    (income.salidas ? `⬇️ Salidas: ${formatMoney(income.salidas)}\n` : '') +
    (income.observaciones ? `📝 Obs: ${income.observaciones}\n` : '') +
    `✅ Total: ${formatMoney(income.total || 0)}\n` +
    `🕐 ${new Date(income.fecha || income.created_at).toLocaleString('es-CO')}`;

  // ── Compartir con Web Share API (incluye foto en móviles) ──────────────────
  const handleShare = async () => {
    // La foto puede estar como URL de Storage (todos los dispositivos)
    // o como base64 local (solo quien la tomó)
    const photoSrc = income.photoUrl || income.photoBase64;

    if (photoSrc && navigator.canShare) {
      try {
        let file;
        if (photoSrc.startsWith('http')) {
          // Es URL de Storage → descargar primero
          const res  = await fetch(photoSrc);
          const blob = await res.blob();
          const ext  = blob.type.includes('png') ? 'png' : 'jpg';
          file = new File([blob], `ingreso_${Date.now()}.${ext}`, { type: blob.type });
        } else {
          // Es base64 local
          const res  = await fetch(photoSrc);
          const blob = await res.blob();
          const ext  = blob.type.includes('png') ? 'png' : 'jpg';
          file = new File([blob], `ingreso_${Date.now()}.${ext}`, { type: blob.type });
        }

        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], text: shareText });
          return;
        }
      } catch (_) {
        // Falla silenciosa → fallback a texto
      }
    }

    // Fallback 1: Web Share API solo con texto
    if (navigator.share) {
      try {
        await navigator.share({ text: shareText });
        return;
      } catch (_) {}
    }

    // Fallback 2: Abrir WhatsApp con texto (desktop / navegadores sin share)
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank');
  };

  return (
    <div className="flex items-end gap-2 mb-3">
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-full ${color} flex items-center justify-center text-white text-xs font-black flex-shrink-0`}>
        {initials(name)}
      </div>

      {/* Burbuja */}
      <div className="max-w-[78%]">
        <p className="text-[10px] font-bold text-gray-400 mb-1 ml-1">{name} · {time}</p>
        <div className="bg-[#1e2d22] border border-green-900/40 rounded-[18px] rounded-bl-sm px-4 py-3 shadow-sm">

          {/* Etiquetas */}
          <div className="flex flex-wrap gap-1.5 mb-2">
            {income.ubicacion && (
              <span className="text-[10px] font-bold bg-green-900/40 text-green-300 px-2 py-0.5 rounded-full">
                {income.ubicacion}
              </span>
            )}
            {income.jornada && (
              <span className="text-[10px] font-bold bg-green-900/30 text-green-400 px-2 py-0.5 rounded-full">
                Jornada {income.jornada}
              </span>
            )}
            {income.tipo && income.tipo !== income.jornada && (
              <span className="text-[10px] font-bold bg-teal-900/40 text-teal-300 px-2 py-0.5 rounded-full">
                {income.tipo}
              </span>
            )}
          </div>

          {/* Montos */}
          <div className="space-y-1">
            {(income.efectivo > 0) && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400 font-bold">💵 Efectivo</span>
                <span className="font-black text-white">{formatMoney(income.efectivo)}</span>
              </div>
            )}
            {(income.transferencias > 0) && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400 font-bold">📲 Transferencias</span>
                <span className="font-black text-white">{formatMoney(income.transferencias)}</span>
              </div>
            )}
            {(income.salidas > 0) && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400 font-bold">⬇️ Salidas</span>
                <span className="font-black text-green-300">{formatMoney(income.salidas)}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-1 border-t border-green-900/30 mt-1">
              <span className="text-gray-400 font-bold text-xs uppercase tracking-wider">Total</span>
              <span className="font-black text-green-400 text-lg">{formatMoney(income.total || 0)}</span>
            </div>
          </div>

          {/* Observaciones */}
          {income.observaciones && (
            <p className="text-[11px] font-bold text-gray-400 mt-2 pt-2 border-t border-green-900/20 italic">
              📝 {income.observaciones}
            </p>
          )}

          {/* Foto del sobre — usa URL de Storage (visible en todos) o base64 local */}
          {(income.photoUrl || income.photoBase64) && (
            <PhotoThumbnail
              src={income.photoUrl || income.photoBase64}
              rotation={income.photoRotation || 0}
            />
          )}
        </div>

        {/* Botón compartir — usa Web Share API con foto */}
        <button
          onClick={handleShare}
          className="flex items-center gap-1 text-[10px] font-bold text-gray-600 hover:text-green-400 transition-colors mt-1 ml-1"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          Compartir{income.photoBase64 ? ' con foto' : ''}
        </button>
      </div>
    </div>
  );
}

// ── Chat completo de ingresos ─────────────────────────────────────────────────
export function IncomesChatView({ onClose }) {
  const incomes = useFinanceStore((s) => s.incomes);
  const fetchFinances = useFinanceStore((s) => s.fetchFinances);
  const subscribeToIncomes = useFinanceStore((s) => s.subscribeToIncomes);
  const bottomRef = useRef(null);

  // Cargar todos los ingresos de Supabase y suscribir Realtime al abrir
  useEffect(() => {
    fetchFinances();
    const unsubscribe = subscribeToIncomes();
    return () => unsubscribe?.();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [incomes.length]);

  // Resumen para compartir todo por WhatsApp
  const total = incomes.reduce((s, i) => s + (i.total || 0), 0);
  const waResumen = encodeURIComponent(
    `📊 *RESUMEN DE INGRESOS*\n\n` +
    incomes.slice(0, 20).map(i =>
      `• ${i.ubicacion || ''} ${i.jornada || ''} ${i.tipo || ''}: ${formatMoney(i.total || 0)}` +
      (i.vendedor ? ` (${i.vendedor})` : '')
    ).join('\n') +
    `\n\n✅ *TOTAL: ${formatMoney(total)}*\n` +
    `📅 ${new Date().toLocaleDateString('es-CO')}`
  );

  return (
    <div className="fixed inset-0 z-[90] bg-[#0a0f0a] flex flex-col">
      {/* Header estilo WhatsApp */}
      <div className="bg-[#128C7E] px-4 py-3 flex items-center gap-3 shadow-lg flex-shrink-0">
        <button onClick={onClose} className="text-white hover:text-green-200 transition-colors p-1">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </button>
        <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center text-xl flex-shrink-0">💰</div>
        <div className="flex-1">
          <h2 className="text-white font-black text-base leading-tight">Chat de Ingresos</h2>
          <p className="text-green-200 text-xs font-bold">{incomes.length} registros · Total: {formatMoney(total)}</p>
        </div>
        {/* Botón compartir resumen */}
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

      {/* Fondo de chat */}
      <div className="flex-1 overflow-y-auto px-4 py-4" style={{ background: 'linear-gradient(rgba(0,0,0,0.7) 0%, rgba(0,20,5,0.95) 100%)' }}>
        {incomes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <span className="text-6xl opacity-30">💰</span>
            <p className="text-gray-500 font-bold text-lg">Sin ingresos registrados</p>
            <p className="text-gray-600 font-bold text-sm">Los ingresos que registres aparecerán aquí</p>
          </div>
        ) : (
          <>
            {/* Mostrar más antiguos primero (como WhatsApp) */}
            {[...incomes].reverse().map((income) => (
              <IncomesBubble key={income.id || income.created_at} income={income} />
            ))}
            <div ref={bottomRef} />
          </>
        )}
      </div>
    </div>
  );
}
