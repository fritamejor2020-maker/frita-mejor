import React from 'react';
import { LOGO_BASE64 } from './logoBase64';
import { parseDrawerCode } from '../../services/printerAgent';

const formatMoney = (val) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(val || 0);

export const generateZReportHTML = (shift, sales, expenses, customers, customerTypes, ticketConfig = {}, cashDrawerCode = '') => {
  if (!shift) return '';

  const tc = {
    businessName: 'Frita Mejor',
    nit: '900.000.000-1',
    phone: '300 123 4567',
    address: 'Cali, Colombia',
    showLogo: true,
    showCashier: true,
    showNit: true,
    showPhone: true,
    showAddress: true,
    zCustomTitle: 'REPORTE Z — CIERRE DE TURNO',
    zReportFooterMsg: 'FIN DE INFORME Z',
    // Sections
    zShowFinancialSummary: true,
    zShowContratasBreakdown: true,
    zShowLocalVsContratas: true,
    zShowCashRegisterMatch: true,
    zShowProductsSold: true,
    zShowExpensesDetail: true,
    zShowSignatureLine: true,
    zShowPaymentMethods: true,
    // Header lines
    zShowShiftId: true,
    zShowCashier: true,
    zShowOpenDate: true,
    zShowCloseDate: true,
    // Financial lines
    zShowInitialBase: true,
    zShowCashSales: true,
    zShowCardSales: true,
    zShowNequiSales: true,
    zShowBancolSales: true,
    zShowTotalSales: true,
    zShowExpensesLine: true,
    zShowDiscountsLine: true,
    zShowCurrentMoney: false,
    ...ticketConfig,
  };

  const dateStrOpened = new Date(shift.openedAt).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
  const dateStrClosed = shift.closedAt ? new Date(shift.closedAt).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' }) : 'EN CURSO';

  const initial = shift.initialAmount || 0;

  // ── Separación entre Ventas Local y Ventas Contratas ──────────────────────────
  const contrataCustomers = (customers || []).filter(c => c.typeId);
  const contrataIds = new Set(contrataCustomers.map(c => c.id));

  const safeSales = sales || [];
  const contrataSales = safeSales.filter(s => s.customerId && contrataIds.has(s.customerId));
  const localSales    = safeSales.filter(s => !s.customerId || !contrataIds.has(s.customerId));

  // 1. DESGLOSE MEDIOS DE PAGO — LOCAL
  const localCash     = localSales.filter(s => s.paymentMethod === 'EFECTIVO').reduce((a, s) => a + (s.total || 0), 0);
  const localBancol   = localSales.filter(s => s.paymentMethod === 'BANCOLOMBIA').reduce((a, s) => a + (s.total || 0), 0);
  const localTarjeta  = localSales.filter(s => s.paymentMethod === 'TARJETA').reduce((a, s) => a + (s.total || 0), 0);
  const localNequi    = localSales.filter(s => s.paymentMethod === 'NEQUI').reduce((a, s) => a + (s.total || 0), 0);
  const localOther    = localSales.filter(s => !['EFECTIVO', 'BANCOLOMBIA', 'TARJETA', 'NEQUI'].includes(s.paymentMethod)).reduce((a, s) => a + (s.total || 0), 0);

  const localTotalTransfer = localBancol + localTarjeta + localNequi + localOther;
  const localTotalSales    = localCash + localTotalTransfer;

  // 2. DESGLOSE MEDIOS DE PAGO — CONTRATAS
  const contrataCash     = contrataSales.filter(s => s.paymentMethod === 'EFECTIVO' && s.contrataPaymentMethod !== 'credit').reduce((a, s) => a + (s.total || 0), 0);
  const contrataBancol   = contrataSales.filter(s => s.paymentMethod === 'BANCOLOMBIA' && s.contrataPaymentMethod !== 'credit').reduce((a, s) => a + (s.total || 0), 0);
  const contrataTarjeta  = contrataSales.filter(s => s.paymentMethod === 'TARJETA' && s.contrataPaymentMethod !== 'credit').reduce((a, s) => a + (s.total || 0), 0);
  const contrataNequi    = contrataSales.filter(s => s.paymentMethod === 'NEQUI' && s.contrataPaymentMethod !== 'credit').reduce((a, s) => a + (s.total || 0), 0);
  const contrataOther    = contrataSales.filter(s => !['EFECTIVO', 'BANCOLOMBIA', 'TARJETA', 'NEQUI'].includes(s.paymentMethod) && s.contrataPaymentMethod !== 'credit').reduce((a, s) => a + (s.total || 0), 0);
  const contrataCredit   = contrataSales.filter(s => s.contrataPaymentMethod === 'credit').reduce((a, s) => a + (s.creditAmount || s.total || 0), 0);

  const contrataTotalTransfer = contrataBancol + contrataTarjeta + contrataNequi + contrataOther;
  const contrataTotalSales    = contrataCash + contrataTotalTransfer + contrataCredit;

  // 3. DESGLOSE DETALLADO POR CLIENTE CONTRATA
  const contrataByClient = contrataCustomers
    .map(c => {
      const cs = contrataSales.filter(s => s.customerId === c.id);
      if (cs.length === 0) return null;
      const type = (customerTypes || []).find(t => t.id === c.typeId);
      const cash     = cs.filter(s => s.paymentMethod === 'EFECTIVO' && s.contrataPaymentMethod !== 'credit').reduce((a, s) => a + (s.total || 0), 0);
      const bancol   = cs.filter(s => s.paymentMethod === 'BANCOLOMBIA' && s.contrataPaymentMethod !== 'credit').reduce((a, s) => a + (s.total || 0), 0);
      const tarjeta  = cs.filter(s => s.paymentMethod === 'TARJETA' && s.contrataPaymentMethod !== 'credit').reduce((a, s) => a + (s.total || 0), 0);
      const nequi    = cs.filter(s => s.paymentMethod === 'NEQUI' && s.contrataPaymentMethod !== 'credit').reduce((a, s) => a + (s.total || 0), 0);
      const other    = cs.filter(s => !['EFECTIVO', 'BANCOLOMBIA', 'TARJETA', 'NEQUI'].includes(s.paymentMethod) && s.contrataPaymentMethod !== 'credit').reduce((a, s) => a + (s.total || 0), 0);
      const transfer = bancol + tarjeta + nequi + other;
      const credit   = cs.filter(s => s.contrataPaymentMethod === 'credit').reduce((a, s) => a + (s.creditAmount || s.total || 0), 0);
      return { name: c.name, typeName: type?.name || '', cash, bancol, tarjeta, nequi, transfer, credit, total: cash + transfer + credit };
    })
    .filter(Boolean);

  // 4. TOTALES GENERALES DEL TURNO
  const cashSalesTotal     = localCash + contrataCash;
  const bancSalesTotal     = localBancol + contrataBancol;
  const cardSalesTotal     = localTarjeta + contrataTarjeta;
  const nequiSalesTotal    = localNequi + contrataNequi;
  const transferSalesTotal = localTotalTransfer + contrataTotalTransfer;
  const totalSales         = localTotalSales + contrataTotalSales;

  const totalDiscounts = safeSales.reduce((acc, s) => acc + (s.discountAmount || 0), 0);
  const retiros        = (expenses || []).filter(e => e.type !== 'deposito');
  const depositos      = (expenses || []).filter(e => e.type === 'deposito');
  const totalExpenses  = retiros.reduce((acc, e) => acc + e.amount, 0);
  const totalDeposits  = depositos.reduce((acc, e) => acc + e.amount, 0);

  const expectedCash = initial + cashSalesTotal - totalExpenses + totalDeposits;
  const countedCash  = shift.realAmount || 0;
  const difference   = countedCash - expectedCash;

  // Items sold summary
  const itemsSold = {};
  safeSales.forEach(sale => {
    (sale.items || []).forEach(item => {
      if (!itemsSold[item.name]) itemsSold[item.name] = { qty: 0, total: 0 };
      itemsSold[item.name].qty += item.qty;
      itemsSold[item.name].total += (item.price * item.qty);
    });
  });

  const discountsHtml = (tc.zShowDiscountsLine !== false && totalDiscounts > 0) ? `
    <div style="display: flex; justify-content: space-between; margin-top: 4px;">
      <span>Total Descuentos:</span>
      <span>${formatMoney(totalDiscounts)}</span>
    </div>
  ` : '';

  const itemsHtml = Object.entries(itemsSold).sort((a,b) => b[1].qty - a[1].qty).map(([name, data]) => `
    <tr style="border-bottom: 1px dashed black;">
      <td style="padding: 4px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 50mm;">${name}</td>
      <td style="padding: 4px 0; text-align: right;">${data.qty}</td>
    </tr>
  `).join('');

  const expensesHtml = (tc.zShowExpensesDetail !== false && expenses && expenses.length > 0) ? `
    <div style="font-size: 12px; font-weight: bold; margin-top: 16px;">
        <h3 style="text-align: center; border: 2px solid black; padding: 4px 0; margin-bottom: 8px; font-weight: 900; text-transform: uppercase;">Retiros y Depositos</h3>
        ${expenses.map(e => `
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px; border-bottom: 1px dashed black; padding-bottom: 4px;">
                <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 50mm;">${e.type === 'deposito' ? '[+]' : '[-]'} ${e.reason}</span>
                <span style="font-weight: 900;">${e.type === 'deposito' ? '+' : '-'}${formatMoney(e.amount)}</span>
            </div>
        `).join('')}
    </div>
  ` : '';

  // Generar bytes ESC/POS de apertura de cajón como caracteres invisibles
  let drawerKickHtml = '';
  if (cashDrawerCode) {
    const bytes = parseDrawerCode(cashDrawerCode);
    if (bytes.length > 0) {
      const escChars = bytes.map(b => `&#${b};`).join('');
      drawerKickHtml = `<span style="font-size:0;line-height:0;overflow:hidden;display:block;height:0;">${escChars}</span>`;
    }
  }

  return `
    <div style="width: 80mm; color: black; font-family: sans-serif; font-size: 14px; padding: 16px; margin: 0 auto;">
      ${drawerKickHtml}
      <style>
        @page { size: auto; margin: 0; }
        * { color: black !important; font-weight: bold !important; }
        @media print {
          body { margin: 0; }
          * { color: black !important; background: transparent !important; font-weight: bold !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          img { filter: grayscale(100%) contrast(1000%) !important; }
        }
      </style>

      <!-- Header -->
      <div style="text-align: center; margin-bottom: 16px;">
        ${tc.showLogo ? `<img src="${LOGO_BASE64}" alt="${tc.businessName}" style="width: 100px; height: auto; display: block; margin: 0 auto 6px auto; filter: grayscale(100%) contrast(1000%);" />` : ''}
        <h1 style="font-weight: 900; font-size: 16px; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 1px;">${tc.zCustomTitle || 'REPORTE Z — CIERRE DE TURNO'}</h1>
        ${tc.showNit !== false && tc.nit ? `<p style="font-size: 11px; margin: 0;">NIT: ${tc.nit}</p>` : ''}
        ${tc.showPhone !== false && tc.phone ? `<p style="font-size: 11px; margin: 0;">Tel: ${tc.phone}</p>` : ''}
        ${tc.showAddress !== false && tc.address ? `<p style="font-size: 11px; margin: 0;">${tc.address}</p>` : ''}
        <div style="border-bottom: 1px dashed black; margin: 8px 0;"></div>
        ${shift.registerName ? `<p style="font-size: 13px; font-weight: 900; line-height: 1.25; margin: 0; border: 2px solid black; padding: 3px 6px;">[ ${shift.registerName} ]</p>` : ''}
        ${tc.zShowShiftId !== false ? `<p style="font-size: 12px; font-weight: bold; line-height: 1.25; margin: 4px 0 0 0;">Turno ID: ${shift.id.slice(-6)}</p>` : ''}
        ${tc.zShowCashier !== false ? `<p style="font-size: 12px; font-weight: bold; line-height: 1.25; margin: 0;">Cajero: ${shift.userName || 'PRINCIPAL'}</p>` : ''}
        ${tc.zShowOpenDate !== false ? `<p style="font-size: 12px; margin: 4px 0 0 0;">Apertura: ${dateStrOpened}</p>` : ''}
        ${tc.zShowCloseDate !== false ? `<p style="font-size: 12px; margin: 0;">Cierre: ${dateStrClosed}</p>` : ''}
      </div>

      <div style="border-bottom: 1px dashed black; margin-bottom: 8px;"></div>

      <!-- 1. VENTAS LOCAL -->
      <div style="font-size: 12px; font-weight: bold; margin-bottom: 12px;">
        <h3 style="text-align: center; border: 2px solid black; padding: 4px 0; margin-bottom: 8px; font-weight: 900; text-transform: uppercase;">Ventas Local</h3>
        ${tc.zShowCashSales !== false ? `<div style="display: flex; justify-content: space-between;"><span>Efectivo Local:</span><span>${formatMoney(localCash)}</span></div>` : ''}
        ${tc.zShowBancolSales !== false ? `<div style="display: flex; justify-content: space-between;"><span>Bancolombia Local:</span><span>${formatMoney(localBancol)}</span></div>` : ''}
        ${tc.zShowCardSales !== false ? `<div style="display: flex; justify-content: space-between;"><span>Tarjeta Local:</span><span>${formatMoney(localTarjeta)}</span></div>` : ''}
        ${tc.zShowNequiSales !== false ? `<div style="display: flex; justify-content: space-between;"><span>Nequi Local:</span><span>${formatMoney(localNequi)}</span></div>` : ''}
        ${localOther > 0 ? `<div style="display: flex; justify-content: space-between;"><span>Otros Métodos Local:</span><span>${formatMoney(localOther)}</span></div>` : ''}
        <div style="display: flex; justify-content: space-between; border-top: 1px dashed black; padding-top: 3px; margin-top: 3px; font-weight: 900;">
          <span>Total Transferencias Local:</span><span>${formatMoney(localTotalTransfer)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; border-top: 1px solid black; padding-top: 4px; margin-top: 4px; font-weight: 900; font-size: 13px;">
          <span>= TOTAL VENTA LOCAL:</span><span>${formatMoney(localTotalSales)}</span>
        </div>
      </div>

      <div style="border-bottom: 1px dashed black; margin-bottom: 8px;"></div>

      <!-- 2. VENTAS CONTRATAS -->
      ${tc.zShowContratasBreakdown !== false ? `
      <div style="font-size: 12px; font-weight: bold; margin-bottom: 12px;">
        <h3 style="text-align: center; border: 2px solid black; padding: 4px 0; margin-bottom: 8px; font-weight: 900; text-transform: uppercase;">Ventas Contratas</h3>
        ${tc.zShowCashSales !== false ? `<div style="display: flex; justify-content: space-between;"><span>Efectivo Contratas:</span><span>${formatMoney(contrataCash)}</span></div>` : ''}
        ${tc.zShowBancolSales !== false ? `<div style="display: flex; justify-content: space-between;"><span>Bancolombia Contratas:</span><span>${formatMoney(contrataBancol)}</span></div>` : ''}
        ${tc.zShowCardSales !== false ? `<div style="display: flex; justify-content: space-between;"><span>Tarjeta Contratas:</span><span>${formatMoney(contrataTarjeta)}</span></div>` : ''}
        ${tc.zShowNequiSales !== false ? `<div style="display: flex; justify-content: space-between;"><span>Nequi Contratas:</span><span>${formatMoney(contrataNequi)}</span></div>` : ''}
        ${contrataOther > 0 ? `<div style="display: flex; justify-content: space-between;"><span>Otros Métodos Contratas:</span><span>${formatMoney(contrataOther)}</span></div>` : ''}
        <div style="display: flex; justify-content: space-between; border-top: 1px dashed black; padding-top: 3px; margin-top: 3px; font-weight: 900;">
          <span>Total Transferencias Contratas:</span><span>${formatMoney(contrataTotalTransfer)}</span>
        </div>
        ${contrataCredit > 0 ? `<div style="display: flex; justify-content: space-between; font-weight: 900; margin-top: 3px;"><span>** A Crédito (Por Cobrar):</span><span>${formatMoney(contrataCredit)}</span></div>` : ''}
        <div style="display: flex; justify-content: space-between; border-top: 1px solid black; padding-top: 4px; margin-top: 4px; font-weight: 900; font-size: 13px;">
          <span>= TOTAL CONTRATAS:</span><span>${formatMoney(contrataTotalSales)}</span>
        </div>
      </div>

      <!-- DESGLOSE POR CLIENTE CONTRATA -->
      ${contrataByClient.length > 0 ? `
      <div style="font-size: 11px; font-weight: bold; margin-bottom: 12px; border: 1px solid black; padding: 6px;">
        <h4 style="text-align: center; border-bottom: 1px solid black; padding-bottom: 3px; margin-bottom: 6px; font-weight: 900; text-transform: uppercase;">Detalle por Cliente Contrata</h4>
        ${contrataByClient.map(c => `
          <div style="margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px dashed black;">
            <div style="font-weight: 900; margin-bottom: 2px;">${c.name} <span style="font-weight: normal; font-size: 10px;">(${c.typeName})</span></div>
            ${c.cash > 0 ? `<div style="display:flex;justify-content:space-between;"><span>  · Efectivo:</span><span>${formatMoney(c.cash)}</span></div>` : ''}
            ${c.bancol > 0 ? `<div style="display:flex;justify-content:space-between;"><span>  · Bancolombia:</span><span>${formatMoney(c.bancol)}</span></div>` : ''}
            ${c.tarjeta > 0 ? `<div style="display:flex;justify-content:space-between;"><span>  · Tarjeta:</span><span>${formatMoney(c.tarjeta)}</span></div>` : ''}
            ${c.nequi > 0 ? `<div style="display:flex;justify-content:space-between;"><span>  · Nequi:</span><span>${formatMoney(c.nequi)}</span></div>` : ''}
            ${c.credit > 0 ? `<div style="display:flex;justify-content:space-between;font-weight:900;"><span>  · A Crédito:</span><span>${formatMoney(c.credit)}</span></div>` : ''}
            <div style="display:flex;justify-content:space-between;font-weight:900;border-top:1px solid black;margin-top:2px;padding-top:2px;"><span>  TOTAL CLIENTE:</span><span>${formatMoney(c.total)}</span></div>
          </div>
        `).join('')}
      </div>
      ` : ''}

      <div style="border-bottom: 1px dashed black; margin-bottom: 8px;"></div>
      ` : ''}

      <!-- 📊 3. RESUMEN GENERAL DEL TURNO -->
      ${tc.zShowFinancialSummary !== false ? `
      <div style="font-size: 12px; font-weight: bold; margin-bottom: 12px; display: flex; flex-direction: column; gap: 4px;">
        <h3 style="text-align: center; border: 2px solid black; padding: 4px 0; margin-bottom: 8px; font-weight: 900; text-transform: uppercase;">Resumen Financiero del Turno</h3>
        
        ${tc.zShowInitialBase !== false ? `<div style="display: flex; justify-content: space-between;">
          <span>Base Inicial Caja:</span>
          <span>${formatMoney(initial)}</span>
        </div>` : ''}
        
        <div style="display: flex; justify-content: space-between;">
          <span>Total Efectivo Caja (Local + Contratas):</span>
          <span>${formatMoney(cashSalesTotal)}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>Total Transferencias / Digital (Local + Contratas):</span>
          <span>${formatMoney(transferSalesTotal)}</span>
        </div>

        ${tc.zShowTotalSales !== false ? `<div style="border-top: 1px solid black; padding-top: 4px; display: flex; justify-content: space-between; font-weight: 900; font-size: 14px;">
          <span>TOTAL GENERAL VENTAS:</span>
          <span>${formatMoney(totalSales)}</span>
        </div>` : ''}

        ${tc.zShowExpensesLine !== false ? `<div style="display: flex; justify-content: space-between; margin-top: 8px;">
          <span>Retiros / Gastos:</span>
          <span>-${formatMoney(totalExpenses)}</span>
        </div>` : ''}

        ${totalDeposits > 0 ? `<div style="display: flex; justify-content: space-between; margin-top: 4px;">
          <span>Depositos:</span>
          <span>+${formatMoney(totalDeposits)}</span>
        </div>` : ''}

        ${discountsHtml}
      </div>

      <div style="border-bottom: 1px dashed black; margin-bottom: 8px;"></div>
      ` : ''}

      ${(shift.earnedBonus && shift.earnedBonus > 0) ? `
      <!-- Metas y Bonos -->
      <div style="font-size: 12px; font-weight: bold; margin-bottom: 12px;">
        <h3 style="text-align: center; border: 2px solid black; padding: 4px 0; margin-bottom: 8px; font-weight: 900; text-transform: uppercase;">Metas y Bonos</h3>
        <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
          <span>Meta Turno:</span>
          <span>${formatMoney(shift.bonusGoalAmount || 0)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
          <span>Comisión:</span>
          <span>${shift.bonusPercent || 0}%</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-weight: 900; font-size: 13px; border-top: 1px solid black; padding-top: 4px; margin-top: 4px;">
          <span>Bono Total Ganado:</span>
          <span>${formatMoney(shift.earnedBonus)}</span>
        </div>
        ${shift.bonusRecipients && shift.bonusRecipients.length > 0 ? `
          <div style="margin-top: 6px; font-size: 11px; border-top: 1px dashed black; padding-top: 4px;">
            <span style="font-weight: 900; display: block; margin-bottom: 3px;">Beneficiarios:</span>
            ${shift.bonusRecipients.map(r => `
              <div style="display: flex; justify-content: space-between; padding-left: 6px; margin-bottom: 2px;">
                <span>· ${r.name}:</span>
                <span>${formatMoney(r.bonusAmount)}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
      <div style="border-bottom: 1px dashed black; margin-bottom: 8px;"></div>
      ` : ''}

      ${tc.zShowCashRegisterMatch !== false ? `
      <!-- Cash Register Match -->
      <div style="font-size: 12px; font-weight: bold; margin-top: 8px; margin-bottom: 16px; display: flex; flex-direction: column; gap: 4px;">
        <h3 style="text-align: center; border: 2px solid black; padding: 4px 0; margin-bottom: 8px; font-weight: 900; text-transform: uppercase;">Cuadre de Caja (Efectivo)</h3>
        
        <div style="display: flex; justify-content: space-between;">
          <span>Efectivo Esperado en Caja:</span>
          <span>${formatMoney(expectedCash)}</span>
        </div>
        ${tc.zShowCurrentMoney === true ? `<div style="display: flex; justify-content: space-between;">
          <span>Efectivo Real Contado:</span>
          <span>${formatMoney(countedCash)}</span>
        </div>` : ''}
        
        ${tc.zShowCurrentMoney === true ? `<div style="border-top: 1px solid black; padding-top: 4px; display: flex; justify-content: space-between; font-weight: 900; font-size: 14px; margin-top: 4px;">
          <span>${difference === 0 ? 'CUADRE EXACTO' : (difference > 0 ? 'SOBRANTE' : 'FALTANTE')}:</span>
          <span>${formatMoney(Math.abs(difference))}</span>
        </div>` : ''}
      </div>
      ` : ''}

      <div style="border-bottom: 3px solid black; margin: 12px 0;"></div>

      ${tc.zShowProductsSold !== false ? `
      <!-- Products Sold Summary -->
      <div style="font-size: 12px; font-weight: bold;">
        <h3 style="text-align: center; border: 2px solid black; padding: 4px 0; margin-bottom: 8px; font-weight: 900; text-transform: uppercase;">Productos Vendidos</h3>
        <table style="width: 100%; text-align: left; table-layout: fixed; border-collapse: collapse;">
          <thead>
            <tr style="border-bottom: 1px solid black;">
              <th style="width: 75%; padding: 4px 0;">Producto</th>
              <th style="width: 25%; padding: 4px 0; text-align: right;">Cant</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
      </div>
      ` : ''}

      ${expensesHtml}

      <!-- Footer -->
      <div style="text-align: center; font-size: 12px; margin-top: 24px;">
        ${tc.zShowSignatureLine !== false ? `<p style="border-top: 1px solid black; padding-top: 4px; margin-bottom: 16px; width: 75%; margin-left: auto; margin-right: auto;">Firma Cajero</p>` : ''}
        <p style="font-weight: bold; margin: 0;">${tc.zReportFooterMsg}</p>
      </div>

    </div>
  `;
};
