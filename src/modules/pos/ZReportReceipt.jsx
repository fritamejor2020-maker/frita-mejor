import React from 'react';
import { LOGO_BASE64 } from './logoBase64';
import { parseDrawerCode } from '../../services/printerAgent';

const formatMoney = (val) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(val || 0);

export const generateZReportHTML = (shift, sales, expenses, customers, customerTypes, ticketConfig = {}, cashDrawerCode = '', paymentMethods = []) => {
  if (!shift) return '';

  const tc = {
    businessName: 'Frita Mejor',
    nit: '12233346-7',
    phone: '314379377',
    address: 'Pitalito, Huila',
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
    zShowProductsSold: false,
    zShowExpensesDetail: true,
    zShowSignatureLine: false,
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

  // ── Clasificación Dinámica de Métodos de Pago ──────────────────────────────────
  const configuredMethods = (paymentMethods && paymentMethods.length > 0) ? paymentMethods : (ticketConfig?.paymentMethods || [
    { id: '1', name: 'EFECTIVO', openDrawer: true, printReceipt: false, isTransfer: false },
    { id: '2', name: 'TARJETA', openDrawer: false, printReceipt: false, isTransfer: true },
    { id: '3', name: 'NEQUI', openDrawer: false, printReceipt: false, isTransfer: true },
    { id: '4', name: 'BANCOLOMBIA', openDrawer: false, printReceipt: false, isTransfer: true },
    { id: '5', name: 'DAVIPLATA', openDrawer: false, printReceipt: false, isTransfer: true }
  ]);

  const isDigital = (pmName) => {
    const norm = String(pmName || '').trim().toUpperCase();
    const found = configuredMethods.find(m => String(m.name || '').trim().toUpperCase() === norm);
    if (!found) {
      if (norm === 'EFECTIVO' || norm === 'IMPRIMIR' || norm === 'CASH') return false;
      return true;
    }
    if (found.isTransfer === true) return true;
    if (found.isTransfer === false || found.openDrawer === true) return false;
    return norm !== 'EFECTIVO' && norm !== 'IMPRIMIR';
  };

  const digitalMethodsList = configuredMethods.filter(m => isDigital(m.name));

  // ── Separación entre Ventas Local y Ventas Contratas ──────────────────────────
  const contrataCustomers = (customers || []).filter(c => c.typeId);
  const contrataIds = new Set(contrataCustomers.map(c => c.id));

  const safeSales = sales || [];
  const contrataSales = safeSales.filter(s => s.customerId && contrataIds.has(s.customerId));
  const localSales    = safeSales.filter(s => !s.customerId || !contrataIds.has(s.customerId));

  // 1. DESGLOSE MEDIOS DE PAGO — LOCAL
  const localCash = localSales
    .filter(s => !isDigital(s.paymentMethod))
    .reduce((a, s) => a + (s.total || 0), 0);

  const localMethodTotals = digitalMethodsList.map(m => {
    const normM = m.name.trim().toUpperCase();
    const sum = localSales
      .filter(s => String(s.paymentMethod || '').trim().toUpperCase() === normM)
      .reduce((a, s) => a + (s.total || 0), 0);
    return { name: m.name, amount: sum };
  });

  const localTotalTransfer = localMethodTotals.reduce((a, m) => a + m.amount, 0);
  const localTotalSales    = localCash + localTotalTransfer;

  // 2. DESGLOSE MEDIOS DE PAGO — CONTRATAS
  const contrataNonCredit = contrataSales.filter(s => s.contrataPaymentMethod !== 'credit');
  const contrataCash = contrataNonCredit
    .filter(s => !isDigital(s.paymentMethod))
    .reduce((a, s) => a + (s.total || 0), 0);

  const contrataMethodTotals = digitalMethodsList.map(m => {
    const normM = m.name.trim().toUpperCase();
    const sum = contrataNonCredit
      .filter(s => String(s.paymentMethod || '').trim().toUpperCase() === normM)
      .reduce((a, s) => a + (s.total || 0), 0);
    return { name: m.name, amount: sum };
  });

  const contrataCredit       = contrataSales.filter(s => s.contrataPaymentMethod === 'credit').reduce((a, s) => a + (s.creditAmount || s.total || 0), 0);
  const contrataTotalTransfer = contrataMethodTotals.reduce((a, m) => a + m.amount, 0);
  const contrataTotalSales    = contrataCash + contrataTotalTransfer + contrataCredit;

  // 3. DESGLOSE DETALLADO POR CLIENTE CONTRATA
  const contrataByClient = contrataCustomers
    .map(c => {
      const cs = contrataSales.filter(s => s.customerId === c.id);
      if (cs.length === 0) return null;
      const type = (customerTypes || []).find(t => t.id === c.typeId);
      const csNonCredit = cs.filter(s => s.contrataPaymentMethod !== 'credit');

      const cash = csNonCredit
        .filter(s => !isDigital(s.paymentMethod))
        .reduce((a, s) => a + (s.total || 0), 0);

      const methodTotals = digitalMethodsList.map(m => {
        const normM = m.name.trim().toUpperCase();
        const sum = csNonCredit
          .filter(s => String(s.paymentMethod || '').trim().toUpperCase() === normM)
          .reduce((a, s) => a + (s.total || 0), 0);
        return { name: m.name, amount: sum };
      });

      const transfer = methodTotals.reduce((a, m) => a + m.amount, 0);
      const credit = cs
        .filter(s => s.contrataPaymentMethod === 'credit')
        .reduce((a, s) => a + (s.creditAmount || s.total || 0), 0);

      return {
        name: c.name,
        typeName: type?.name || '',
        cash,
        methodTotals,
        transfer,
        credit,
        total: cash + transfer + credit
      };
    })
    .filter(Boolean);

  // 4. TOTALES GENERALES Y ABSORCIÓN DE SALIDAS EN CASCADA
  const retiros        = (expenses || []).filter(e => e.type !== 'deposito');
  const depositos      = (expenses || []).filter(e => e.type === 'deposito');
  const totalExpenses  = retiros.reduce((acc, e) => acc + e.amount, 0);
  const totalDeposits  = depositos.reduce((acc, e) => acc + e.amount, 0);

  // ── Lógica de Cálculo: Efectivo Real Contado vs Modo Teórico ──
  const realCountedCash = Number(shift.realAmount);
  const hasRealCount = !isNaN(realCountedCash) && realCountedCash > 0;

  let localCashNeto = 0;
  let localSalidasAbsorbidas = 0;
  let contrataCashNeto = 0;
  let contrataSalidasAbsorbidas = 0;

  if (hasRealCount) {
    // Modo Real Contado:
    // El efectivo real de ventas disponible en gaveta (descontando base inicial):
    const efVentasRealEnGaveta = Math.max(0, realCountedCash - initial);
    
    // Salidas pagadas:
    localSalidasAbsorbidas = Math.min(totalExpenses, localCash);
    contrataSalidasAbsorbidas = Math.min(totalExpenses - localSalidasAbsorbidas, contrataCash);

    // Distribuimos el efectivo real que quedó en gaveta entre Local y Contratas:
    const contrataEsperadoNeto = Math.max(0, contrataCash - contrataSalidasAbsorbidas);
    if (efVentasRealEnGaveta >= contrataEsperadoNeto) {
      contrataCashNeto = contrataEsperadoNeto;
      localCashNeto = efVentasRealEnGaveta - contrataEsperadoNeto;
    } else {
      contrataCashNeto = efVentasRealEnGaveta;
      localCashNeto = 0;
    }
  } else {
    // Modo Sistema Teórico (sin conteo real ingresado):
    localSalidasAbsorbidas = Math.min(totalExpenses, localCash);
    localCashNeto = localCash - localSalidasAbsorbidas;
    contrataSalidasAbsorbidas = Math.min(totalExpenses - localSalidasAbsorbidas, contrataCash);
    contrataCashNeto = contrataCash - contrataSalidasAbsorbidas;
  }

  const localTotalCalculado = localCashNeto + localSalidasAbsorbidas + localTotalTransfer;
  const contrataTotalCalculado = contrataCashNeto + contrataSalidasAbsorbidas + contrataTotalTransfer + contrataCredit;

  const totalGastosCierre = localSalidasAbsorbidas + contrataSalidasAbsorbidas;
  const totalGeneralCalculado = localTotalCalculado + contrataTotalCalculado;

  const cashSalesTotal     = localCash + contrataCash;
  const transferSalesTotal = localTotalTransfer + contrataTotalTransfer;
  const totalSales         = localTotalSales + contrataTotalSales;

  const totalDiscounts = safeSales.reduce((acc, s) => acc + (s.discountAmount || 0), 0);

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
    <div style="display: flex; justify-content: space-between; margin-top: 2px;">
      <span>Total Descuentos:</span>
      <span>${formatMoney(totalDiscounts)}</span>
    </div>
  ` : '';

  const itemsHtml = Object.entries(itemsSold).sort((a,b) => b[1].qty - a[1].qty).map(([name, data]) => `
    <tr style="border-bottom: 1px dashed #aaa;">
      <td style="padding: 2px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 50mm;">${name}</td>
      <td style="padding: 2px 0; text-align: right; font-weight: bold;">${data.qty}</td>
    </tr>
  `).join('');

  const expensesHtml = (tc.zShowExpensesDetail !== false && expenses && expenses.length > 0) ? `
    <div style="font-size: 10.5px; font-weight: bold; margin-top: 6px;">
        <h3 style="text-align: center; border: 1px solid black; padding: 2px 0; margin-bottom: 4px; font-weight: 900; text-transform: uppercase; font-size: 11px;">Retiros y Depositos</h3>
        ${expenses.map(e => `
            <div style="display: flex; justify-content: space-between; margin-bottom: 2px; border-bottom: 1px dashed #ccc; padding-bottom: 2px;">
                <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 48mm;">${e.type === 'deposito' ? '[+]' : '[-]'} ${e.reason}</span>
                <span style="font-weight: 900;">${e.type === 'deposito' ? '+' : '-'}${formatMoney(e.amount)}</span>
            </div>
        `).join('')}
    </div>
  ` : '';

  // Generar bytes ESC/POS de apertura de cajón
  let drawerKickHtml = '';
  if (cashDrawerCode) {
    const bytes = parseDrawerCode(cashDrawerCode);
    if (bytes.length > 0) {
      const escChars = bytes.map(b => `&#${b};`).join('');
      drawerKickHtml = `<span style="font-size:0;line-height:0;overflow:hidden;display:block;height:0;">${escChars}</span>`;
    }
  }

  return `
    <div style="width: 76mm; color: black; font-family: 'Courier New', Courier, monospace; font-size: 11px; line-height: 1.2; padding: 4px; margin: 0 auto;">
      ${drawerKickHtml}
      <style>
        @page { size: 80mm auto; margin: 0; }
        * { color: black !important; font-weight: bold !important; box-sizing: border-box; }
        @media print {
          body { margin: 0; padding: 0; background: white; }
          html { background: transparent; }
          * { color: black !important; background: transparent !important; font-weight: bold !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          img { filter: grayscale(100%) contrast(1000%) !important; }
        }
      </style>

      <!-- Header Compacto -->
      <div style="text-align: center; margin-bottom: 4px;">
        ${tc.showLogo ? `<img src="${LOGO_BASE64}" alt="${tc.businessName}" style="width: 90px; height: auto; display: block; margin: 0 auto 2px auto; filter: grayscale(100%) contrast(1000%);" />` : ''}
        <h2 style="font-weight: 900; font-size: 14px; margin: 0; text-transform: uppercase; letter-spacing: 0.5px;">${tc.zCustomTitle || 'REPORTE Z — CIERRE TURNO'}</h2>
        <p style="font-size: 9.5px; margin: 1px 0 0 0;">
          ${tc.businessName} ${tc.showNit && tc.nit ? `· NIT: ${tc.nit}` : ''}
        </p>
        <p style="font-size: 9.5px; margin: 0;">
          ${tc.showPhone && tc.phone ? `Tel: ${tc.phone}` : ''} ${tc.showAddress && tc.address ? `· ${tc.address}` : ''}
        </p>
        <div style="border-bottom: 1px dashed black; margin: 3px 0;"></div>
        <div style="font-size: 10px; font-weight: 900; display: flex; justify-content: space-between;">
          ${shift.registerName ? `<span>Caja: ${shift.registerName}</span>` : ''}
          ${tc.zShowShiftId !== false ? `<span>Turno: ${shift.id.slice(-6)}</span>` : ''}
          ${tc.zShowCashier !== false ? `<span>Cajero: ${shift.userName || 'PRINCIPAL'}</span>` : ''}
        </div>
        <div style="font-size: 9.5px; margin-top: 1px;">
          ${tc.zShowOpenDate !== false ? `Apertura: ${dateStrOpened}` : ''} ${tc.zShowCloseDate !== false ? `· Cierre: ${dateStrClosed}` : ''}
        </div>
      </div>

      <div style="border-bottom: 1px dashed black; margin: 4px 0;"></div>

      <!-- 1. VENTAS LOCAL COMPACTO -->
      ${tc.zShowPaymentMethods !== false ? `
      <div style="font-size: 10.5px; font-weight: bold; margin-bottom: 6px;">
        <h3 style="text-align: center; border: 1px solid black; padding: 2px 0; margin: 0 0 4px 0; font-weight: 900; text-transform: uppercase; font-size: 11px;">Ventas Local</h3>
        ${tc.zShowCashSales !== false ? `<div style="display: flex; justify-content: space-between;"><span>Efectivo Local:</span><span>${formatMoney(localCash)}</span></div>` : ''}
        ${localMethodTotals.map(m => `
          <div style="display: flex; justify-content: space-between;"><span>${m.name} Local:</span><span>${formatMoney(m.amount)}</span></div>
        `).join('')}
        <div style="display: flex; justify-content: space-between; border-top: 1px dashed black; padding-top: 2px; margin-top: 2px; font-weight: 900;">
          <span>Total Transferencias Local:</span><span>${formatMoney(localTotalTransfer)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; border-top: 1px solid black; padding-top: 2px; margin-top: 2px; font-weight: 900; font-size: 11.5px;">
          <span>= TOTAL VENTA LOCAL:</span><span>${formatMoney(localTotalSales)}</span>
        </div>
      </div>

      <div style="border-bottom: 1px dashed black; margin: 4px 0;"></div>
      ` : ''}

      <!-- 2. VENTAS CONTRATAS COMPACTO -->
      ${(tc.zShowLocalVsContratas !== false || contrataTotalSales > 0) ? `
      <div style="font-size: 10.5px; font-weight: bold; margin-bottom: 6px;">
        <h3 style="text-align: center; border: 1px solid black; padding: 2px 0; margin: 0 0 4px 0; font-weight: 900; text-transform: uppercase; font-size: 11px;">Ventas Contratas</h3>
        ${tc.zShowCashSales !== false ? `<div style="display: flex; justify-content: space-between;"><span>Efectivo Contratas:</span><span>${formatMoney(contrataCash)}</span></div>` : ''}
        ${contrataMethodTotals.map(m => `
          <div style="display: flex; justify-content: space-between;"><span>${m.name} Contratas:</span><span>${formatMoney(m.amount)}</span></div>
        `).join('')}
        <div style="display: flex; justify-content: space-between; border-top: 1px dashed black; padding-top: 2px; margin-top: 2px; font-weight: 900;">
          <span>Total Transferencias Contratas:</span><span>${formatMoney(contrataTotalTransfer)}</span>
        </div>
        ${contrataCredit > 0 ? `<div style="display: flex; justify-content: space-between; font-weight: 900; margin-top: 2px;"><span>** A Crédito (Por Cobrar):</span><span>${formatMoney(contrataCredit)}</span></div>` : ''}
        <div style="display: flex; justify-content: space-between; border-top: 1px solid black; padding-top: 2px; margin-top: 2px; font-weight: 900; font-size: 11.5px;">
          <span>= TOTAL CONTRATAS:</span><span>${formatMoney(contrataTotalSales)}</span>
        </div>
      </div>

      <div style="border-bottom: 1px dashed black; margin: 4px 0;"></div>
      ` : ''}

      <!-- 3. DESGLOSE POR CLIENTE CONTRATA -->
      ${(tc.zShowContratasBreakdown !== false && contrataByClient.length > 0) ? `
      <div style="font-size: 10px; font-weight: bold; margin-bottom: 6px; border: 1px solid black; padding: 4px;">
        <h4 style="text-align: center; border-bottom: 1px solid black; padding-bottom: 2px; margin: 0 0 4px 0; font-weight: 900; text-transform: uppercase;">Detalle por Cliente Contrata</h4>
        ${contrataByClient.map(c => `
          <div style="margin-bottom: 4px; padding-bottom: 2px; border-bottom: 1px dashed #ccc;">
            <div style="font-weight: 900; margin-bottom: 1px;">${c.name} <span style="font-weight: normal; font-size: 9px;">(${c.typeName})</span></div>
            ${c.cash > 0 ? `<div style="display:flex;justify-content:space-between;"><span> · Efectivo:</span><span>${formatMoney(c.cash)}</span></div>` : ''}
            ${c.methodTotals.filter(m => m.amount > 0).map(m => `
              <div style="display:flex;justify-content:space-between;"><span> · ${m.name}:</span><span>${formatMoney(m.amount)}</span></div>
            `).join('')}
            ${c.credit > 0 ? `<div style="display:flex;justify-content:space-between;font-weight:900;"><span> · A Crédito:</span><span>${formatMoney(c.credit)}</span></div>` : ''}
            <div style="display:flex;justify-content:space-between;font-weight:900;border-top:1px solid black;margin-top:1px;padding-top:1px;"><span> TOTAL CLIENTE:</span><span>${formatMoney(c.total)}</span></div>
          </div>
        `).join('')}
      </div>

      <div style="border-bottom: 1px dashed black; margin: 4px 0;"></div>
      ` : ''}

      <!-- 4. RESUMEN FINANCIERO DEL TURNO -->
      ${tc.zShowFinancialSummary !== false ? `
      <div style="font-size: 10.5px; font-weight: bold; margin-bottom: 6px;">
        <div style="text-align: center; border: 1.5px solid black; padding: 2px 0; margin: 2px 0 6px 0; font-weight: 900; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">
          RESUMEN FINANCIERO DEL TURNO
        </div>
        
        <!-- Local -->
        <div style="margin-bottom: 2px;">
          <div style="font-weight: 900; text-decoration: underline; margin-bottom: 3px; font-size: 11px;">Local</div>
          ${tc.zShowCashSales !== false ? `<div style="display: flex; justify-content: space-between;"><span>Efectivo Local:</span><span>${formatMoney(localCashNeto)}</span></div>` : ''}
          ${tc.zShowExpensesLine !== false && totalExpenses > 0 ? `<div style="display: flex; justify-content: space-between;"><span>Salidas Local:</span><span>${formatMoney(localSalidasAbsorbidas)}</span></div>` : ''}
          <div style="display: flex; justify-content: space-between;"><span>Transferencias Local:</span><span>${formatMoney(localTotalTransfer)}</span></div>
          <div style="border-top: 1px dashed black; margin: 3px 0 2px 0;"></div>
          <div style="display: flex; justify-content: space-between; font-weight: 900;">
            <span>Total Local:</span><span>${formatMoney(localTotalCalculado)}</span>
          </div>
        </div>

        <div style="border-bottom: 1px dashed #999; margin: 5px 0;"></div>

        <!-- Contratas -->
        <div style="margin-bottom: 2px;">
          <div style="font-weight: 900; text-decoration: underline; margin-bottom: 3px; font-size: 11px;">Contratas</div>
          ${tc.zShowCashSales !== false ? `<div style="display: flex; justify-content: space-between;"><span>Efectivo Contratas:</span><span>${formatMoney(contrataCashNeto)}</span></div>` : ''}
          ${tc.zShowExpensesLine !== false && contrataSalidasAbsorbidas > 0 ? `<div style="display: flex; justify-content: space-between;"><span>Salidas Contratas:</span><span>${formatMoney(contrataSalidasAbsorbidas)}</span></div>` : ''}
          <div style="display: flex; justify-content: space-between;"><span>Transferencias Contratas:</span><span>${formatMoney(contrataTotalTransfer)}</span></div>
          ${contrataCredit > 0 ? `<div style="display: flex; justify-content: space-between; font-weight: 900;"><span>Créditos Contratas:</span><span>${formatMoney(contrataCredit)}</span></div>` : ''}
          <div style="border-top: 1px dashed black; margin: 3px 0 2px 0;"></div>
          <div style="display: flex; justify-content: space-between; font-weight: 900;">
            <span>Total Contratas:</span><span>${formatMoney(contrataTotalCalculado)}</span>
          </div>
        </div>

        <div style="border-bottom: 1.5px solid black; margin: 5px 0;"></div>

        <!-- Total Gastos del cierre -->
        ${tc.zShowExpensesLine !== false && totalExpenses > 0 ? `
        <div style="display: flex; justify-content: space-between; font-weight: 900; color: #dc2626 !important; font-size: 11px; margin-bottom: 4px;">
          <span>Total Gastos del cierre:</span>
          <span>${formatMoney(totalGastosCierre)}</span>
        </div>
        ` : ''}

        <!-- Total General del cierre -->
        ${tc.zShowTotalSales !== false ? `
        <div style="display: flex; justify-content: space-between; font-weight: 900; font-size: 12px;">
          <span>Total General del cierre:</span>
          <span>${formatMoney(totalGeneralCalculado)}</span>
        </div>
        ` : ''}

        ${discountsHtml}
      </div>

      <div style="border-bottom: 1px dashed black; margin: 4px 0;"></div>
      ` : ''}

      ${(shift.earnedBonus && shift.earnedBonus > 0) ? `
      <!-- Metas y Bonos -->
      <div style="font-size: 10.5px; font-weight: bold; margin-bottom: 6px;">
        <h3 style="text-align: center; border: 1px solid black; padding: 2px 0; margin: 0 0 4px 0; font-weight: 900; text-transform: uppercase; font-size: 11px;">Metas y Bonos</h3>
        <div style="display: flex; justify-content: space-between;">
          <span>Meta Turno:</span>
          <span>${formatMoney(shift.bonusGoalAmount || 0)}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>Comisión:</span>
          <span>${shift.bonusPercent || 0}%</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-weight: 900; font-size: 11.5px; border-top: 1px solid black; padding-top: 2px; margin-top: 2px;">
          <span>Bono Total Ganado:</span>
          <span>${formatMoney(shift.earnedBonus)}</span>
        </div>
        ${shift.bonusRecipients && shift.bonusRecipients.length > 0 ? `
          <div style="margin-top: 4px; font-size: 9.5px; border-top: 1px dashed black; padding-top: 2px;">
            <span style="font-weight: 900; display: block; margin-bottom: 2px;">Beneficiarios:</span>
            ${shift.bonusRecipients.map(r => `
              <div style="display: flex; justify-content: space-between; padding-left: 4px; margin-bottom: 1px;">
                <span>· ${r.name}:</span>
                <span>${formatMoney(r.bonusAmount)}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
      <div style="border-bottom: 1px dashed black; margin: 4px 0;"></div>
      ` : ''}

      ${tc.zShowCashRegisterMatch !== false ? `
      <!-- Cash Register Match -->
      <div style="font-size: 10.5px; font-weight: bold; margin-bottom: 6px; display: flex; flex-direction: column; gap: 2px;">
        <h3 style="text-align: center; border: 1px solid black; padding: 2px 0; margin: 0 0 4px 0; font-weight: 900; text-transform: uppercase; font-size: 11px;">Cuadre de Caja (Efectivo)</h3>
        
        ${tc.zShowInitialBase !== false ? `
        <div style="display: flex; justify-content: space-between;">
          <span>Base Inicial:</span>
          <span>${formatMoney(initial)}</span>
        </div>` : ''}

        <div style="display: flex; justify-content: space-between;">
          <span>Efectivo Esperado en Caja:</span>
          <span>${formatMoney(expectedCash)}</span>
        </div>
        ${tc.zShowCurrentMoney === true ? `<div style="display: flex; justify-content: space-between;">
          <span>Efectivo Real Contado:</span>
          <span>${formatMoney(countedCash)}</span>
        </div>` : ''}
        
        ${tc.zShowCurrentMoney === true ? `<div style="border-top: 1px solid black; padding-top: 2px; margin-top: 2px; display: flex; justify-content: space-between; font-weight: 900; font-size: 12px;">
          <span>${difference === 0 ? 'CUADRE EXACTO' : (difference > 0 ? 'SOBRANTE' : 'FALTANTE')}:</span>
          <span>${formatMoney(Math.abs(difference))}</span>
        </div>` : ''}
      </div>
      ` : ''}

      ${tc.zShowProductsSold !== false ? `
      <div style="border-bottom: 1px dashed black; margin: 4px 0;"></div>
      <!-- Products Sold Summary -->
      <div style="font-size: 10.5px; font-weight: bold;">
        <h3 style="text-align: center; border: 1px solid black; padding: 2px 0; margin: 0 0 4px 0; font-weight: 900; text-transform: uppercase; font-size: 11px;">Productos Vendidos</h3>
        <table style="width: 100%; text-align: left; table-layout: fixed; border-collapse: collapse; font-size: 10px;">
          <thead>
            <tr style="border-bottom: 1px solid black; font-weight: 900;">
              <th style="width: 75%; padding: 2px 0;">Producto</th>
              <th style="width: 25%; padding: 2px 0; text-align: right;">Cant</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
      </div>
      ` : ''}

      ${expensesHtml}

      <!-- Footer Compacto -->
      <div style="text-align: center; font-size: 10px; margin-top: 12px;">
        ${tc.zShowSignatureLine !== false ? `<p style="border-top: 1px solid black; padding-top: 2px; margin-bottom: 8px; width: 70%; margin-left: auto; margin-right: auto;">Firma Cajero</p>` : ''}
        <p style="font-weight: 900; margin: 0;">${tc.zReportFooterMsg}</p>
      </div>

    </div>
  `;
};
