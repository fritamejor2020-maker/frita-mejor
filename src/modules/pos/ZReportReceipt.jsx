import React from 'react';
import { LOGO_BASE64 } from './logoBase64';

const formatMoney = (val) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(val);

export const generateZReportHTML = (shift, sales, expenses, customers, customerTypes, ticketConfig = {}) => {
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

  // ── Contratas: agrupar ventas por cliente contrata ──────────────────────────
  const contrataCustomers = (customers || []).filter(c => c.typeId);
  const contrataIds = new Set(contrataCustomers.map(c => c.id));

  const contrataSales = sales.filter(s => s.customerId && contrataIds.has(s.customerId));
  const localSales    = sales.filter(s => !s.customerId || !contrataIds.has(s.customerId));

  const contrataByClient = contrataCustomers
    .map(c => {
      const cs = contrataSales.filter(s => s.customerId === c.id);
      if (cs.length === 0) return null;
      const type = (customerTypes || []).find(t => t.id === c.typeId);
      const cash     = cs.filter(s => s.paymentMethod === 'EFECTIVO' && s.contrataPaymentMethod !== 'credit').reduce((a, s) => a + s.total, 0);
      const transfer = cs.filter(s => s.paymentMethod !== 'EFECTIVO' && s.contrataPaymentMethod !== 'credit').reduce((a, s) => a + s.total, 0);
      const credit   = cs.filter(s => s.contrataPaymentMethod === 'credit').reduce((a, s) => a + (s.creditAmount || s.total), 0);
      return { name: c.name, typeName: type?.name || '', cash, transfer, credit, total: cash + transfer + credit };
    })
    .filter(Boolean);

  const totalContrataCash     = contrataByClient.reduce((a, c) => a + c.cash, 0);
  const totalContrataTransfer = contrataByClient.reduce((a, c) => a + c.transfer, 0);
  const totalContrataCredit   = contrataByClient.reduce((a, c) => a + c.credit, 0);

  // Calculate Totals By Method (full shift)
  const cashSalesTotal     = sales.filter(s => s.paymentMethod === 'EFECTIVO').reduce((acc, s) => acc + s.total, 0);
  const cardSalesTotal     = sales.filter(s => s.paymentMethod === 'TARJETA').reduce((acc, s) => acc + s.total, 0);
  const nequiSalesTotal    = sales.filter(s => s.paymentMethod === 'NEQUI').reduce((acc, s) => acc + s.total, 0);
  const bancSalesTotal     = sales.filter(s => s.paymentMethod === 'BANCOLOMBIA').reduce((acc, s) => acc + s.total, 0);
  const transferSalesTotal = nequiSalesTotal + bancSalesTotal;

  const localCash = cashSalesTotal - totalContrataCash;

  const totalSales    = cashSalesTotal + cardSalesTotal + transferSalesTotal;
  const totalDiscounts = sales.reduce((acc, s) => acc + (s.discountAmount || 0), 0);
  const retiros  = (expenses || []).filter(e => e.type !== 'deposito');
  const depositos = (expenses || []).filter(e => e.type === 'deposito');
  const totalExpenses  = retiros.reduce((acc, e) => acc + e.amount, 0);
  const totalDeposits  = depositos.reduce((acc, e) => acc + e.amount, 0);

  const expectedCash = initial + cashSalesTotal - totalExpenses + totalDeposits;
  const countedCash = shift.realAmount || 0;
  const difference = countedCash - expectedCash;

  // Items sold summary
  const itemsSold = {};
  sales.forEach(sale => {
      sale.items.forEach(item => {
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

  return `
    <div style="width: 80mm; color: black; font-family: sans-serif; font-size: 14px; padding: 16px; margin: 0 auto;">
      <style>
        @page { size: auto; margin: 0; }
        @media print {
          body { -webkit-print-color-adjust: exact; margin: 0; }
        }
      </style>

      <!-- Header -->
      <div style="text-align: center; margin-bottom: 16px;">
        ${tc.showLogo ? `<img src="${LOGO_BASE64}" alt="${tc.businessName}" style="width: 100px; height: auto; display: block; margin: 0 auto 6px auto;" />` : ''}
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

      ${tc.zShowFinancialSummary !== false ? `
      <!-- Financials -->
      <div style="font-size: 12px; font-weight: bold; margin-bottom: 12px; display: flex; flex-direction: column; gap: 4px;">
        <h3 style="text-align: center; border: 2px solid black; padding: 4px 0; margin-bottom: 8px; font-weight: 900; text-transform: uppercase;">Resumen Financiero</h3>
        
        ${tc.zShowInitialBase !== false ? `<div style="display: flex; justify-content: space-between;">
          <span>Base Inicial:</span>
          <span>${formatMoney(initial)}</span>
        </div>` : ''}
        ${tc.zShowCashSales !== false ? `<div style="display: flex; justify-content: space-between;">
          <span>Ventas Efectivo:</span>
          <span>${formatMoney(cashSalesTotal)}</span>
        </div>` : ''}
        ${tc.zShowCardSales !== false ? `<div style="display: flex; justify-content: space-between;">
          <span>Ventas Tarjeta:</span>
          <span>${formatMoney(cardSalesTotal)}</span>
        </div>` : ''}
        ${tc.zShowNequiSales !== false ? `<div style="display: flex; justify-content: space-between;">
          <span>Ventas NEQUI:</span>
          <span>${formatMoney(nequiSalesTotal)}</span>
        </div>` : ''}
        ${tc.zShowBancolSales !== false ? `<div style="display: flex; justify-content: space-between;">
          <span>Ventas BANCOLOMBIA:</span>
          <span>${formatMoney(bancSalesTotal)}</span>
        </div>` : ''}

        ${tc.zShowTotalSales !== false ? `<div style="border-top: 1px solid black; padding-top: 4px; display: flex; justify-content: space-between; font-weight: 900; font-size: 14px;">
          <span>Total Ventas:</span>
          <span>${formatMoney(totalSales)}</span>
        </div>` : ''}

        ${tc.zShowExpensesLine !== false ? `<div style="display: flex; justify-content: space-between; margin-top: 8px;">
          <span>Retiros:</span>
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

      ${tc.zShowContratasBreakdown !== false && contrataByClient.length > 0 ? `
      <!-- Contratas Breakdown -->
      <div style="font-size: 12px; font-weight: bold; margin-bottom: 12px;">
        <h3 style="text-align: center; border: 2px solid black; padding: 4px 0; margin-bottom: 8px; font-weight: 900; text-transform: uppercase;">Desglose Contratas</h3>
        ${contrataByClient.map(c => `
          <div style="margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px dashed black;">
            <div style="font-weight: 900; margin-bottom: 3px;">${c.name} <span style="font-weight: normal; font-size: 11px;">(${c.typeName})</span></div>
            ${c.cash > 0 ? `<div style="display:flex;justify-content:space-between;"><span>  Efectivo:</span><span>${formatMoney(c.cash)}</span></div>` : ''}
            ${c.transfer > 0 ? `<div style="display:flex;justify-content:space-between;"><span>  Transferencia:</span><span>${formatMoney(c.transfer)}</span></div>` : ''}
            ${c.credit > 0 ? `<div style="display:flex;justify-content:space-between;font-weight:900;"><span>  ** A credito (por cobrar):</span><span>${formatMoney(c.credit)}</span></div>` : ''}
            <div style="display:flex;justify-content:space-between;font-weight:900;border-top:1px solid black;margin-top:2px;padding-top:2px;"><span>  TOTAL:</span><span>${formatMoney(c.total)}</span></div>
          </div>
        `).join('')}
        <div style="border: 2px solid black; padding: 6px 4px; margin-top: 4px;">
          <div style="display:flex;justify-content:space-between;"><span>Total Contratas Efectivo:</span><span>${formatMoney(totalContrataCash)}</span></div>
          <div style="display:flex;justify-content:space-between;"><span>Total Contratas Transfer:</span><span>${formatMoney(totalContrataTransfer)}</span></div>
          ${totalContrataCredit > 0 ? `<div style="display:flex;justify-content:space-between;font-weight:900;"><span>** Total A Credito:</span><span>${formatMoney(totalContrataCredit)}</span></div>` : ''}
        </div>
      </div>

      <div style="border-bottom: 1px dashed black; margin-bottom: 8px;"></div>

      ${tc.zShowLocalVsContratas !== false ? `
      <!-- Cuadre Local vs Contratas -->
      <div style="font-size: 12px; font-weight: bold; margin-bottom: 12px; border: 2px solid black; padding: 8px;">
        <h3 style="text-align: center; border-bottom: 2px solid black; padding: 4px 0; margin-bottom: 8px; font-weight: 900; text-transform: uppercase;">Efectivo: Local vs Contratas</h3>
        <div style="display:flex;justify-content:space-between;"><span>Efectivo Total Caja:</span><span>${formatMoney(cashSalesTotal)}</span></div>
        <div style="display:flex;justify-content:space-between;"><span>- Efectivo Contratas:</span><span>-${formatMoney(totalContrataCash)}</span></div>
        <div style="display:flex;justify-content:space-between;font-weight:900;font-size:14px;border-top:2px solid black;padding-top:4px;margin-top:4px;"><span>= Efectivo LOCAL:</span><span>${formatMoney(localCash)}</span></div>
      </div>

      <div style="border-bottom: 1px dashed black; margin-bottom: 8px;"></div>
      ` : ''}
      ` : ''}

      ${tc.zShowCashRegisterMatch !== false ? `
      <!-- Cash Register Match -->
      <div style="font-size: 12px; font-weight: bold; margin-top: 8px; margin-bottom: 16px; display: flex; flex-direction: column; gap: 4px;">
        <h3 style="text-align: center; border: 2px solid black; padding: 4px 0; margin-bottom: 8px; font-weight: 900; text-transform: uppercase;">Cuadre de Caja (Efectivo)</h3>
        
        <div style="display: flex; justify-content: space-between;">
          <span>Efectivo Esperado:</span>
          <span>${formatMoney(expectedCash)}</span>
        </div>
        ${tc.zShowCurrentMoney === true ? `<div style="display: flex; justify-content: space-between;">
          <span>Efectivo Contado:</span>
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
