import React, { useState, useEffect } from 'react';
import { useInventoryStore } from '../../store/useInventoryStore';
import { useBranchStore } from '../../store/useBranchStore';

const DEFAULTS = {
  businessName: 'Frita Mejor',
  nit: '900.000.000-1',
  phone: '300 123 4567',
  address: 'Cali, Colombia',
  // ── Sale Ticket Toggles ──
  showLogo: true,
  showBarcode: true,
  showCashier: true,
  showNit: true,
  showPhone: true,
  showAddress: true,
  showTicketNumber: true,
  showDate: true,
  showCustomerName: true,
  showCustomerDoc: true,
  showCustomerAddress: true,
  showCustomerPhone: true,
  showContrataType: true,
  showSubtotal: true,
  showDiscount: true,
  showPaymentInfo: true,
  // ── Sale Ticket Messages ──
  saleFooterMsg: '¡GRACIAS POR SU COMPRA!',
  saleSubFooterMsg: 'Conserve este tiquete para reclamos.',
  saleBottomLine: 'Sistema POS • fritamejor.com',
  // ── Z-Report Sections ──
  zCustomTitle: 'REPORTE Z — CIERRE DE TURNO',
  zReportFooterMsg: 'FIN DE INFORME Z',
  zShowFinancialSummary: true,
  zShowContratasBreakdown: true,
  zShowLocalVsContratas: true,
  zShowCashRegisterMatch: true,
  zShowProductsSold: true,
  zShowExpensesDetail: true,
  zShowSignatureLine: true,
  zShowPaymentMethods: true,
  // ── Z-Report Granular Lines ──
  zShowShiftId: true,
  zShowCashier: true,
  zShowOpenDate: true,
  zShowCloseDate: true,
  zShowInitialBase: true,
  zShowCashSales: true,
  zShowCardSales: true,
  zShowNequiSales: true,
  zShowBancolSales: true,
  zShowTotalSales: true,
  zShowExpensesLine: true,
  zShowDiscountsLine: true,
  zShowCurrentMoney: false,
};

const ToggleCard = ({ checked, onChange, label, desc, color = 'blue' }: { checked: boolean; onChange: (v: boolean) => void; label: string; desc: string; color?: string }) => {
  const colors: Record<string, { border: string; bg: string; accent: string }> = {
    blue:   { border: 'border-blue-500',   bg: 'bg-blue-50',   accent: 'accent-blue-600' },
    purple: { border: 'border-purple-400', bg: 'bg-purple-50', accent: 'accent-purple-600' },
    amber:  { border: 'border-amber-400',  bg: 'bg-amber-50',  accent: 'accent-amber-600' },
    green:  { border: 'border-green-400',  bg: 'bg-green-50',  accent: 'accent-green-600' },
    red:    { border: 'border-red-400',    bg: 'bg-red-50',    accent: 'accent-red-600' },
  };
  const c = colors[color] || colors.blue;
  return (
    <label className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${checked ? `${c.border} ${c.bg}` : 'border-gray-200 bg-gray-50 hover:border-gray-300'}`}>
      <input type="checkbox" className={`mt-0.5 w-5 h-5 ${c.accent} rounded`} checked={checked} onChange={e => onChange(e.target.checked)} />
      <div>
        <span className="font-bold text-sm text-gray-700 block">{label}</span>
        <span className="text-[11px] text-gray-400 leading-tight">{desc}</span>
      </div>
    </label>
  );
};

const TextInput = ({ label, value, onChange, placeholder, hint, color = 'blue' }: any) => {
  const ring = color === 'green' ? 'focus:ring-green-500 focus:border-green-500' : color === 'purple' ? 'focus:ring-purple-500 focus:border-purple-500' : 'focus:ring-blue-500 focus:border-blue-500';
  return (
    <div>
      <label className="block text-sm font-bold text-gray-600 mb-1">{label}</label>
      <input className={`w-full border border-gray-300 rounded-xl px-4 py-3 text-sm font-bold ${ring} outline-none transition-all`} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
};

export function AdminTicketConfigTab() {
  const { posSettings, updatePosSettings, posRegisters = [], addPosRegister, updatePosRegister, deletePosRegister } = useInventoryStore();
  const { branches } = useBranchStore();
  const activeBranches = branches.filter(b => b.active !== false);
  const tc = posSettings?.ticketConfig || DEFAULTS;
  const [newRegName, setNewRegName] = useState('');
  const [newRegBranch, setNewRegBranch] = useState(activeBranches[0]?.id || '');
  const [confirmDeleteReg, setConfirmDeleteReg] = useState<{id:string;name:string}|null>(null);

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
        <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2">🧾 Configuración de Tickets</h2>
        <p className="text-gray-500 text-sm mt-1">Personaliza la información que aparece en los tickets de venta y en el Cierre Z.</p>
      </div>

      {/* ── Registros de Caja (Multi-Caja) ── */}
      <section className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="font-black text-lg text-gray-700 border-b pb-2 flex items-center gap-2">💻 Registros de Caja</h3>
        <p className="text-xs text-gray-400">Administra las cajas del punto de venta. Cada caja puede tener su propio turno y cierre Z.</p>
        
        <div className="space-y-2">
          {posRegisters.map(reg => (
            <div key={reg.id} className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
              <span className="text-lg">{reg.active !== false ? '🟢' : '🔴'}</span>
              <div className="flex-1 min-w-0">
                <input
                  className="w-full bg-transparent border-none outline-none font-bold text-sm text-gray-700 focus:bg-white focus:ring-2 focus:ring-blue-400 rounded-lg px-2 py-1 transition-all"
                  value={reg.name}
                  onChange={e => updatePosRegister(reg.id, { name: e.target.value })}
                />
                {reg.branchId && (
                  <p className="text-[10px] text-gray-400 font-medium px-2">
                    📍 {activeBranches.find(b => b.id === reg.branchId)?.name || reg.branchId}
                  </p>
                )}
              </div>
              <button
                className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${reg.active !== false ? 'bg-orange-100 text-orange-600 hover:bg-orange-200' : 'bg-green-100 text-green-600 hover:bg-green-200'}`}
                onClick={() => updatePosRegister(reg.id, { active: reg.active === false ? true : false })}
              >
                {reg.active !== false ? 'Desactivar' : 'Activar'}
              </button>
              {posRegisters.length > 1 && (
                <button
                  className="text-xs font-bold px-3 py-1.5 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-all"
                  onClick={() => setConfirmDeleteReg({ id: reg.id, name: reg.name })}
                >
                  🗑️
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-sm font-bold focus:ring-blue-500 focus:border-blue-500 outline-none"
              value={newRegName}
              onChange={e => setNewRegName(e.target.value)}
              placeholder="Nombre de la nueva caja..."
              onKeyDown={e => { if (e.key === 'Enter' && newRegName.trim()) { addPosRegister({ name: newRegName.trim(), branchId: newRegBranch }); setNewRegName(''); } }}
            />
            <button
              className="bg-blue-600 text-white font-bold px-5 py-3 rounded-xl hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              disabled={!newRegName.trim()}
              onClick={() => { addPosRegister({ name: newRegName.trim(), branchId: newRegBranch }); setNewRegName(''); }}
            >
              + Agregar
            </button>
          </div>
          {/* Selector de sede para la nueva caja */}
          {activeBranches.length > 1 && (
            <select
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-700 outline-none focus:border-blue-400"
              value={newRegBranch}
              onChange={e => setNewRegBranch(e.target.value)}
            >
              <option value="">— Sin sede asignada (global) —</option>
              {activeBranches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          )}
        </div>
      </section>

      {/* ── Información del Negocio ── */}
      <section className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="font-black text-lg text-gray-700 border-b pb-2 flex items-center gap-2">🏪 Información del Negocio</h3>
        <p className="text-xs text-gray-400">Estos datos aparecen en el encabezado de todos los tickets.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextInput label="Nombre del Negocio" value={form.businessName} onChange={(v: string) => handleChange('businessName', v)} placeholder="Ej: Frita Mejor" />
          <TextInput label="NIT / CC" value={form.nit} onChange={(v: string) => handleChange('nit', v)} placeholder="Ej: 900.000.000-1" />
          <TextInput label="Teléfono" value={form.phone} onChange={(v: string) => handleChange('phone', v)} placeholder="Ej: 300 123 4567" />
          <TextInput label="Dirección / Ciudad" value={form.address} onChange={(v: string) => handleChange('address', v)} placeholder="Ej: Cali, Colombia" />
        </div>
      </section>

      {/* ── Ticket de Venta — Elementos Visibles ── */}
      <section className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-5">
        <h3 className="font-black text-lg text-gray-700 border-b pb-2 flex items-center gap-2">🛒 Ticket de Venta — Elementos Visibles</h3>
        <p className="text-xs text-gray-400">Activa o desactiva qué información aparece en el ticket impreso de cada venta.</p>

        {/* Encabezado */}
        <div>
          <p className="text-xs font-black text-gray-500 uppercase tracking-wider mb-2">Encabezado del Negocio</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ToggleCard checked={form.showLogo} onChange={v => handleChange('showLogo', v)} label="🖼️ Logo" desc="Logo del negocio arriba" />
            <ToggleCard checked={form.showNit} onChange={v => handleChange('showNit', v)} label="🏷️ NIT del Negocio" desc="Muestra el NIT en el encabezado" />
            <ToggleCard checked={form.showPhone} onChange={v => handleChange('showPhone', v)} label="📞 Teléfono Negocio" desc="Número de teléfono del local" />
            <ToggleCard checked={form.showAddress} onChange={v => handleChange('showAddress', v)} label="📍 Dirección Negocio" desc="Dirección o ciudad del local" />
          </div>
        </div>

        {/* Info Venta */}
        <div>
          <p className="text-xs font-black text-gray-500 uppercase tracking-wider mb-2">Información de la Venta</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <ToggleCard checked={form.showTicketNumber} onChange={v => handleChange('showTicketNumber', v)} label="🔢 N° Ticket" desc="Número del ticket" />
            <ToggleCard checked={form.showDate} onChange={v => handleChange('showDate', v)} label="📅 Fecha/Hora" desc="Fecha y hora de la venta" />
            <ToggleCard checked={form.showCashier} onChange={v => handleChange('showCashier', v)} label="👤 Cajero" desc="Nombre del cajero" />
          </div>
        </div>

        {/* Info Cliente */}
        <div>
          <p className="text-xs font-black text-gray-500 uppercase tracking-wider mb-2">Información del Cliente</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ToggleCard checked={form.showCustomerName} onChange={v => handleChange('showCustomerName', v)} label="👤 Nombre Cliente" desc="Nombre del cliente" color="green" />
            <ToggleCard checked={form.showCustomerDoc} onChange={v => handleChange('showCustomerDoc', v)} label="🪪 NIT/CC Cliente" desc="Documento del cliente" color="green" />
            <ToggleCard checked={form.showCustomerAddress} onChange={v => handleChange('showCustomerAddress', v)} label="📍 Dirección Cliente/Contrata" desc="Dirección de la contrata o cliente" color="green" />
            <ToggleCard checked={form.showCustomerPhone} onChange={v => handleChange('showCustomerPhone', v)} label="📞 Teléfono Cliente" desc="Teléfono del cliente" color="green" />
            <ToggleCard checked={form.showContrataType} onChange={v => handleChange('showContrataType', v)} label="🤝 Tipo de Contrata" desc="Mostrar nivel/tipo (Ej: Restaurante)" color="green" />
          </div>
        </div>

        {/* Financiero */}
        <div>
          <p className="text-xs font-black text-gray-500 uppercase tracking-wider mb-2">Detalles Financieros</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <ToggleCard checked={form.showSubtotal} onChange={v => handleChange('showSubtotal', v)} label="🧮 Subtotal" desc="Subtotal antes de descuento" color="amber" />
            <ToggleCard checked={form.showDiscount} onChange={v => handleChange('showDiscount', v)} label="🏷️ Descuento" desc="Línea de descuento aplicado" color="amber" />
            <ToggleCard checked={form.showPaymentInfo} onChange={v => handleChange('showPaymentInfo', v)} label="💵 Info de Pago" desc="Recibido, cambio, método" color="amber" />
          </div>
        </div>

        {/* Pie */}
        <div>
          <p className="text-xs font-black text-gray-500 uppercase tracking-wider mb-2">Pie del Ticket</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ToggleCard checked={form.showBarcode} onChange={v => handleChange('showBarcode', v)} label="📊 Código de Barras" desc="Barra decorativa al final" />
          </div>
        </div>
      </section>

      {/* ── Mensajes del Ticket de Venta ── */}
      <section className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="font-black text-lg text-gray-700 border-b pb-2 flex items-center gap-2">✏️ Mensajes — Ticket de Venta</h3>
        <p className="text-xs text-gray-400">Personaliza los textos que aparecen al pie del ticket de venta.</p>
        <div className="space-y-4">
          <TextInput label="Mensaje Principal (Grande)" value={form.saleFooterMsg} onChange={(v: string) => handleChange('saleFooterMsg', v)} placeholder="Ej: ¡GRACIAS POR SU COMPRA!" hint="Aparece en negrita grande después del resumen de pago." color="green" />
          <TextInput label="Mensaje Secundario" value={form.saleSubFooterMsg} onChange={(v: string) => handleChange('saleSubFooterMsg', v)} placeholder="Ej: Conserve este tiquete para reclamos." hint="Texto pequeño debajo del mensaje principal." color="green" />
          <TextInput label="Línea Inferior" value={form.saleBottomLine} onChange={(v: string) => handleChange('saleBottomLine', v)} placeholder="Ej: Sistema POS • fritamejor.com" hint="Texto más pequeño, al final del ticket." color="green" />
        </div>
      </section>

      {/* ── Configuración del Cierre Z ── */}
      <section className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-5">
        <h3 className="font-black text-lg text-gray-700 border-b pb-2 flex items-center gap-2">📊 Reporte Z — Control Total</h3>
        <p className="text-xs text-gray-400">Controla cada sección y cada línea que aparece en el ticket de cierre de caja.</p>

        {/* Título personalizable */}
        <div>
          <TextInput label="Título del Reporte Z" value={form.zCustomTitle} onChange={(v: string) => handleChange('zCustomTitle', v)} placeholder="Ej: REPORTE Z — CIERRE DE TURNO" color="purple" />
        </div>

        {/* Secciones principales */}
        <div>
          <p className="text-xs font-black text-gray-500 uppercase tracking-wider mb-2">Secciones del Reporte</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { key: 'zShowFinancialSummary', label: '💰 Resumen Financiero', desc: 'Sección completa de resumen financiero' },
              { key: 'zShowContratasBreakdown', label: '🤝 Desglose Contratas', desc: 'Detalle por cliente contrata' },
              { key: 'zShowLocalVsContratas', label: '🏪 Local vs Contratas', desc: 'Separación efectivo local vs contratas' },
              { key: 'zShowCashRegisterMatch', label: '🧮 Cuadre de Caja', desc: 'Esperado vs contado, sobrante/faltante' },
              { key: 'zShowProductsSold', label: '📦 Productos Vendidos', desc: 'Lista de productos con cantidades' },
              { key: 'zShowExpensesDetail', label: '💸 Detalle de Gastos', desc: 'Lista detallada de retiros y gastos' },
              { key: 'zShowSignatureLine', label: '✍️ Firma del Cajero', desc: 'Línea de firma al pie' },
            ].map(opt => (
              <ToggleCard key={opt.key} checked={form[opt.key] !== false} onChange={v => handleChange(opt.key, v)} label={opt.label} desc={opt.desc} color="purple" />
            ))}
          </div>
        </div>

        {/* Encabezado Z */}
        <div>
          <p className="text-xs font-black text-gray-500 uppercase tracking-wider mb-2">Encabezado del Reporte</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ToggleCard checked={form.zShowShiftId !== false} onChange={v => handleChange('zShowShiftId', v)} label="🔢 Turno ID" desc="Número del turno" color="purple" />
            <ToggleCard checked={form.zShowCashier !== false} onChange={v => handleChange('zShowCashier', v)} label="👤 Cajero" desc="Nombre del cajero en el Z" color="purple" />
            <ToggleCard checked={form.zShowOpenDate !== false} onChange={v => handleChange('zShowOpenDate', v)} label="📅 Fecha Apertura" desc="Hora en que abrió la caja" color="purple" />
            <ToggleCard checked={form.zShowCloseDate !== false} onChange={v => handleChange('zShowCloseDate', v)} label="🕐 Fecha Cierre" desc="Hora en que cerró la caja" color="purple" />
          </div>
        </div>

        {/* Líneas financieras granulares */}
        <div>
          <p className="text-xs font-black text-gray-500 uppercase tracking-wider mb-2">Líneas del Resumen Financiero</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ToggleCard checked={form.zShowInitialBase !== false} onChange={v => handleChange('zShowInitialBase', v)} label="💵 Base Inicial" desc="Monto de apertura de caja" color="purple" />
            <ToggleCard checked={form.zShowCashSales !== false} onChange={v => handleChange('zShowCashSales', v)} label="💵 Ventas Efectivo" desc="Total de ventas en efectivo" color="purple" />
            <ToggleCard checked={form.zShowCardSales !== false} onChange={v => handleChange('zShowCardSales', v)} label="💳 Ventas Tarjeta" desc="Total de ventas con tarjeta" color="purple" />
            <ToggleCard checked={form.zShowNequiSales !== false} onChange={v => handleChange('zShowNequiSales', v)} label="📱 Ventas NEQUI" desc="Total de ventas por NEQUI" color="purple" />
            <ToggleCard checked={form.zShowBancolSales !== false} onChange={v => handleChange('zShowBancolSales', v)} label="🏦 Ventas BANCOLOMBIA" desc="Total de ventas por Bancolombia" color="purple" />
            <ToggleCard checked={form.zShowTotalSales !== false} onChange={v => handleChange('zShowTotalSales', v)} label="📊 Total Ventas" desc="Línea de total de todas las ventas" color="purple" />
            <ToggleCard checked={form.zShowExpensesLine !== false} onChange={v => handleChange('zShowExpensesLine', v)} label="💸 Retiros/Gastos" desc="Línea de total de gastos en resumen" color="purple" />
            <ToggleCard checked={form.zShowDiscountsLine !== false} onChange={v => handleChange('zShowDiscountsLine', v)} label="🏷️ Total Descuentos" desc="Línea de total de descuentos" color="purple" />
          </div>
        </div>

        {/* Monto actual */}
        <div>
          <p className="text-xs font-black text-gray-500 uppercase tracking-wider mb-2">💰 Opciones Especiales</p>
          <div className="grid grid-cols-1 gap-3">
            <ToggleCard checked={form.zShowCurrentMoney === true} onChange={v => handleChange('zShowCurrentMoney', v)} label="🔒 Monto Actual Contado en Ticket" desc="Imprimir el monto real de dinero contado al cerrar. DESACTIVADO por defecto por seguridad." color="red" />
          </div>
        </div>

        <TextInput label="Mensaje Final del Reporte Z" value={form.zReportFooterMsg} onChange={(v: string) => handleChange('zReportFooterMsg', v)} placeholder="Ej: FIN DE INFORME Z" color="purple" />
      </section>

      {/* ── Save ── */}
      <div className="flex items-center gap-4">
        <button className="flex-1 py-4 rounded-2xl bg-blue-600 text-white font-black text-lg hover:bg-blue-700 active:scale-[0.98] transition-all shadow-lg shadow-blue-600/20" onClick={handleSave}>
          {saved ? '✅ Guardado' : '💾 Guardar Configuración'}
        </button>
      </div>

      {/* ── Preview ── */}
      <section className="bg-gray-100 border border-gray-200 rounded-2xl p-6 shadow-sm">
        <h3 className="font-black text-lg text-gray-700 border-b pb-2 mb-4 flex items-center gap-2">👀 Vista Previa del Ticket de Venta</h3>
        <div className="bg-white mx-auto max-w-[300px] p-4 rounded-xl border border-gray-300 shadow-inner font-mono text-xs text-gray-800">
          <div className="text-center mb-3">
            {form.showLogo && <div className="text-2xl mb-1">🍟</div>}
            <p className="font-black text-sm">{form.businessName}</p>
            {form.showNit && form.nit && <p>NIT: {form.nit}</p>}
            {form.showPhone && form.phone && <p>Tel: {form.phone}</p>}
            {form.showAddress && form.address && <p>{form.address}</p>}
          </div>
          <div className="border-b border-dashed border-gray-400 my-2" />
          {form.showTicketNumber && <p className="font-bold">Ticket No: 00A1B2</p>}
          {form.showDate && <p>Fecha: 27/4/2026, 9:00 a.m.</p>}
          {form.showCashier && <p>Cajero: PRINCIPAL</p>}
          <div className="border-b border-dashed border-gray-400 my-2" />
          {form.showCustomerName && <p>Cliente: Juan Restaurante</p>}
          {form.showCustomerDoc && <p className="text-gray-500">NIT/CC: 900.123.456-7</p>}
          {form.showCustomerAddress && <p className="text-gray-500">Dir: Cra 5 #10-20, Local 3</p>}
          {form.showCustomerPhone && <p className="text-gray-500">Tel: 310 555 1234</p>}
          {form.showContrataType && <p className="text-gray-500 italic">Tipo: Restaurante VIP</p>}
          <div className="border-b border-dashed border-gray-400 my-2" />
          <div className="flex justify-between"><span>2x Empanadas</span><span>$4.000</span></div>
          <div className="flex justify-between"><span>1x Gaseosa</span><span>$2.500</span></div>
          <div className="border-b border-dashed border-gray-400 my-2" />
          {form.showSubtotal && <div className="flex justify-between"><span>Subtotal:</span><span>$6.500</span></div>}
          {form.showDiscount && <div className="flex justify-between text-orange-600"><span>Desc (10%):</span><span>-$650</span></div>}
          <div className="flex justify-between font-black text-sm border-t border-gray-800 pt-1">
            <span>TOTAL:</span><span>$5.850</span>
          </div>
          {form.showPaymentInfo && (
            <>
              <div className="border-b border-dashed border-gray-400 my-2" />
              <div className="border border-gray-300 rounded p-2 text-center">
                <p className="font-bold">PAGO EN EFECTIVO</p>
                <div className="flex justify-between"><span>Recibido:</span><span>$10.000</span></div>
                <div className="flex justify-between"><span>Cambio:</span><span>$4.150</span></div>
              </div>
            </>
          )}
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
      {/* Modal confirmar eliminar caja */}
      {confirmDeleteReg && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[24px] p-6 w-full max-w-sm shadow-2xl text-center">
            <div className="text-4xl mb-3">🗑️</div>
            <h2 className="text-lg font-black text-gray-900 mb-1">¿Eliminar caja?</h2>
            <p className="text-sm text-gray-500 mb-1 font-medium">"{confirmDeleteReg.name}"</p>
            <p className="text-xs text-gray-400 mb-5">Las ventas existentes se mantendrán en el historial.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeleteReg(null)}
                className="flex-1 border-2 border-gray-200 text-gray-500 font-bold py-2.5 rounded-full hover:bg-gray-50"
              >Cancelar</button>
              <button
                onClick={() => { deletePosRegister(confirmDeleteReg.id); setConfirmDeleteReg(null); }}
                className="flex-1 bg-red-500 text-white font-black py-2.5 rounded-full hover:bg-red-600"
              >Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
