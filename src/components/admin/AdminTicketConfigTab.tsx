import React, { useState, useEffect } from 'react';
import { useInventoryStore } from '../../store/useInventoryStore';

const DEFAULTS = {
  businessName: 'Frita Mejor',
  nit: '900.000.000-1',
  phone: '300 123 4567',
  address: 'Cali, Colombia',
  showLogo: true,
  showBarcode: true,
  showCashier: true,
  saleFooterMsg: '¡GRACIAS POR SU COMPRA!',
  saleSubFooterMsg: 'Conserve este tiquete para reclamos.',
  saleBottomLine: 'Sistema POS • fritamejor.com',
  zReportFooterMsg: 'FIN DE INFORME Z',
  // Z-Report sections
  zShowFinancialSummary: true,
  zShowContratasBreakdown: true,
  zShowLocalVsContratas: true,
  zShowCashRegisterMatch: true,
  zShowProductsSold: true,
  zShowExpensesDetail: true,
  zShowSignatureLine: true,
  zShowPaymentMethods: true,
};

export function AdminTicketConfigTab() {
  const { posSettings, updatePosSettings } = useInventoryStore();
  const tc = posSettings?.ticketConfig || DEFAULTS;

  const [form, setForm] = useState({ ...DEFAULTS, ...tc });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setForm({ ...DEFAULTS, ...tc });
  }, [posSettings]);

  const handleChange = (key: string, value: any) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    updatePosSettings({ ticketConfig: form });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 py-4">
      <div>
        <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2">
          🧾 Configuración de Tickets
        </h2>
        <p className="text-gray-500 text-sm mt-1">
          Personaliza la información que aparece en los tickets de venta y en el Cierre Z.
        </p>
      </div>

      {/* ── Información del Negocio ── */}
      <section className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="font-black text-lg text-gray-700 border-b pb-2 flex items-center gap-2">
          🏪 Información del Negocio
        </h3>
        <p className="text-xs text-gray-400">Estos datos aparecen en el encabezado de todos los tickets.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-gray-600 mb-1">Nombre del Negocio</label>
            <input
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              value={form.businessName}
              onChange={e => handleChange('businessName', e.target.value)}
              placeholder="Ej: Frita Mejor"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-600 mb-1">NIT / CC</label>
            <input
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              value={form.nit}
              onChange={e => handleChange('nit', e.target.value)}
              placeholder="Ej: 900.000.000-1"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-600 mb-1">Teléfono</label>
            <input
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              value={form.phone}
              onChange={e => handleChange('phone', e.target.value)}
              placeholder="Ej: 300 123 4567"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-600 mb-1">Dirección / Ciudad</label>
            <input
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              value={form.address}
              onChange={e => handleChange('address', e.target.value)}
              placeholder="Ej: Cali, Colombia"
            />
          </div>
        </div>
      </section>

      {/* ── Opciones de Visualización ── */}
      <section className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="font-black text-lg text-gray-700 border-b pb-2 flex items-center gap-2">
          👁️ Elementos Visibles en el Ticket
        </h3>
        <p className="text-xs text-gray-400">Activa o desactiva qué secciones aparecen al imprimir.</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { key: 'showLogo', label: '🖼️ Mostrar Logo', desc: 'Logo del negocio en la parte superior' },
            { key: 'showBarcode', label: '📊 Mostrar Código de Barras', desc: 'Barra decorativa en el pie del ticket' },
            { key: 'showCashier', label: '👤 Mostrar Cajero', desc: 'Nombre del cajero en la sección de info' },
          ].map(opt => (
            <label key={opt.key} className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
              form[opt.key] ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-gray-50 hover:border-gray-300'
            }`}>
              <input
                type="checkbox"
                className="mt-0.5 w-5 h-5 accent-blue-600 rounded"
                checked={form[opt.key]}
                onChange={e => handleChange(opt.key, e.target.checked)}
              />
              <div>
                <span className="font-bold text-sm text-gray-700 block">{opt.label}</span>
                <span className="text-xs text-gray-400">{opt.desc}</span>
              </div>
            </label>
          ))}
        </div>
      </section>

      {/* ── Mensajes del Ticket de Venta ── */}
      <section className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="font-black text-lg text-gray-700 border-b pb-2 flex items-center gap-2">
          🛒 Mensajes — Ticket de Venta
        </h3>
        <p className="text-xs text-gray-400">Personaliza los textos que aparecen al pie del ticket de venta.</p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-600 mb-1">Mensaje Principal (Grande)</label>
            <input
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
              value={form.saleFooterMsg}
              onChange={e => handleChange('saleFooterMsg', e.target.value)}
              placeholder="Ej: ¡GRACIAS POR SU COMPRA!"
            />
            <p className="text-xs text-gray-400 mt-1">Aparece en negrita grande después del resumen de pago.</p>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-600 mb-1">Mensaje Secundario</label>
            <input
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
              value={form.saleSubFooterMsg}
              onChange={e => handleChange('saleSubFooterMsg', e.target.value)}
              placeholder="Ej: Conserve este tiquete para reclamos."
            />
            <p className="text-xs text-gray-400 mt-1">Texto pequeño debajo del mensaje principal.</p>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-600 mb-1">Línea Inferior</label>
            <input
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
              value={form.saleBottomLine}
              onChange={e => handleChange('saleBottomLine', e.target.value)}
              placeholder="Ej: Sistema POS • fritamejor.com"
            />
            <p className="text-xs text-gray-400 mt-1">Texto más pequeño, al final del ticket (sitio web, etc.).</p>
          </div>
        </div>
      </section>

      {/* ── Configuración del Cierre Z ── */}
      <section className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-5">
        <h3 className="font-black text-lg text-gray-700 border-b pb-2 flex items-center gap-2">
          📊 Reporte Z — Secciones del Cierre
        </h3>
        <p className="text-xs text-gray-400">Activa o desactiva cada sección que aparece en el ticket de cierre de caja.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { key: 'zShowFinancialSummary', label: '💰 Resumen Financiero', desc: 'Base inicial, ventas por método de pago, total ventas, gastos' },
            { key: 'zShowPaymentMethods', label: '💳 Desglose por Método', desc: 'Efectivo, Tarjeta, NEQUI, BANCOLOMBIA por separado' },
            { key: 'zShowContratasBreakdown', label: '🤝 Desglose Contratas', desc: 'Detalle por cliente contrata: efectivo, transferencia, crédito' },
            { key: 'zShowLocalVsContratas', label: '🏪 Local vs Contratas', desc: 'Separación de efectivo local vs efectivo de contratas' },
            { key: 'zShowCashRegisterMatch', label: '🧮 Cuadre de Caja', desc: 'Efectivo esperado vs contado, sobrante o faltante' },
            { key: 'zShowProductsSold', label: '📦 Productos Vendidos', desc: 'Lista de productos vendidos con cantidades' },
            { key: 'zShowExpensesDetail', label: '💸 Detalle de Gastos', desc: 'Lista detallada de retiros y gastos del turno' },
            { key: 'zShowSignatureLine', label: '✍️ Firma del Cajero', desc: 'Línea de firma al pie del reporte' },
          ].map(opt => (
            <label key={opt.key} className={`flex items-start gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
              form[opt.key] !== false ? 'border-purple-400 bg-purple-50' : 'border-gray-200 bg-gray-50 hover:border-gray-300'
            }`}>
              <input
                type="checkbox"
                className="mt-0.5 w-5 h-5 accent-purple-600 rounded"
                checked={form[opt.key] !== false}
                onChange={e => handleChange(opt.key, e.target.checked)}
              />
              <div>
                <span className="font-bold text-sm text-gray-700 block">{opt.label}</span>
                <span className="text-[11px] text-gray-400 leading-tight">{opt.desc}</span>
              </div>
            </label>
          ))}
        </div>

        <div className="pt-2">
          <label className="block text-sm font-bold text-gray-600 mb-1">Mensaje Final del Reporte Z</label>
          <input
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all"
            value={form.zReportFooterMsg}
            onChange={e => handleChange('zReportFooterMsg', e.target.value)}
            placeholder="Ej: FIN DE INFORME Z"
          />
        </div>
      </section>

      {/* ── Preview + Save ── */}
      <div className="flex items-center gap-4">
        <button
          className="flex-1 py-4 rounded-2xl bg-blue-600 text-white font-black text-lg hover:bg-blue-700 active:scale-[0.98] transition-all shadow-lg shadow-blue-600/20"
          onClick={handleSave}
        >
          {saved ? '✅ Guardado' : '💾 Guardar Configuración'}
        </button>
      </div>

      {/* ── Preview ── */}
      <section className="bg-gray-100 border border-gray-200 rounded-2xl p-6 shadow-sm">
        <h3 className="font-black text-lg text-gray-700 border-b pb-2 mb-4 flex items-center gap-2">
          👀 Vista Previa del Ticket de Venta
        </h3>
        <div className="bg-white mx-auto max-w-[300px] p-4 rounded-xl border border-gray-300 shadow-inner font-mono text-xs text-gray-800">
          <div className="text-center mb-3">
            {form.showLogo && <div className="text-2xl mb-1">🍟</div>}
            <p className="font-black text-sm">{form.businessName}</p>
            {form.nit && <p>NIT: {form.nit}</p>}
            {form.phone && <p>Tel: {form.phone}</p>}
            {form.address && <p>{form.address}</p>}
          </div>
          <div className="border-b border-dashed border-gray-400 my-2" />
          <p className="font-bold">Ticket No: 00A1B2</p>
          <p>Fecha: 27/4/2026, 9:00 a.m.</p>
          {form.showCashier && <p>Cajero: PRINCIPAL</p>}
          <div className="border-b border-dashed border-gray-400 my-2" />
          <p>Cliente: Consumidor Final</p>
          <div className="border-b border-dashed border-gray-400 my-2" />
          <div className="flex justify-between"><span>2x Empanadas</span><span>$4.000</span></div>
          <div className="flex justify-between"><span>1x Gaseosa</span><span>$2.500</span></div>
          <div className="border-b border-dashed border-gray-400 my-2" />
          <div className="flex justify-between font-black text-sm border-t border-gray-800 pt-1">
            <span>TOTAL:</span><span>$6.500</span>
          </div>
          <div className="border-b border-dashed border-gray-400 my-2" />
          <div className="text-center mt-2">
            <p className="font-black text-sm">{form.saleFooterMsg || '...'}</p>
            <p className="text-[10px] text-gray-500">{form.saleSubFooterMsg || '...'}</p>
            {form.showBarcode && (
              <div className="my-2 text-center">
                <div className="w-3/4 h-8 bg-black mx-auto opacity-90" style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 1px, white 1px, white 2px, transparent 2px, transparent 4px, white 4px, white 5px)', backgroundSize: '5px 100%' }} />
                <p className="text-[10px] font-bold tracking-[3px] mt-1">00A1B2</p>
              </div>
            )}
            <p className="text-[9px] text-gray-400">{form.saleBottomLine || '...'}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
