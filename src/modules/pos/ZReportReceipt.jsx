import React from 'react';

const formatMoney = (val) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(val);

export const generateZReportHTML = (shift, sales, expenses) => {
  if (!shift) return '';

  const dateStrOpened = new Date(shift.openedAt).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
  const dateStrClosed = shift.closedAt ? new Date(shift.closedAt).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' }) : 'EN CURSO';

  const initial = shift.initialAmount || 0;
  
  // Calculate Totals By Method
  const cashSalesTotal = sales.filter(s => s.paymentMethod === 'EFECTIVO').reduce((acc, s) => acc + s.total, 0);
  const cardSalesTotal = sales.filter(s => s.paymentMethod === 'TARJETA').reduce((acc, s) => acc + s.total, 0);
  const transferSalesTotal = sales.filter(s => s.paymentMethod === 'NEQUI' || s.paymentMethod === 'BANCOLOMBIA').reduce((acc, s) => acc + s.total, 0);
  
  const totalSales = cashSalesTotal + cardSalesTotal + transferSalesTotal;
  const totalDiscounts = sales.reduce((acc, s) => acc + (s.discountAmount || 0), 0);
  
  const totalExpenses = (expenses || []).reduce((acc, e) => acc + e.amount, 0);

  const expectedCash = initial + cashSalesTotal - totalExpenses;
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

  const discountsHtml = totalDiscounts > 0 ? `
    <div style="display: flex; justify-content: space-between; margin-top: 4px; color: #4B5563;">
      <span>Total Descuentos:</span>
      <span>${formatMoney(totalDiscounts)}</span>
    </div>
  ` : '';

  const itemsHtml = Object.entries(itemsSold).sort((a,b) => b[1].qty - a[1].qty).map(([name, data]) => `
    <tr style="border-bottom: 1px dashed #D1D5DB;">
      <td style="padding: 4px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 50mm;">${name}</td>
      <td style="padding: 4px 0; text-align: right;">${data.qty}</td>
    </tr>
  `).join('');

  const expensesHtml = (expenses && expenses.length > 0) ? `
    <div style="font-size: 12px; font-weight: bold; margin-top: 16px;">
        <h3 style="text-align: center; background-color: #E5E7EB; padding: 4px 0; margin-bottom: 8px; font-weight: 900; text-transform: uppercase;">Detalle de Gastos</h3>
        ${expenses.map(e => `
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px; border-bottom: 1px dashed #D1D5DB; padding-bottom: 4px;">
                <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 50mm;">${e.reason}</span>
                <span>${formatMoney(e.amount)}</span>
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
        <h1 style="font-weight: 900; font-size: 20px; margin-bottom: 4px;">REPORTE Z (CIERRE)</h1>
        <h2 style="font-weight: bold; font-size: 18px; margin-bottom: 4px;">FRITA MEJOR</h2>
        <div style="border-bottom: 1px dashed black; margin: 8px 0;"></div>
        <p style="font-size: 12px; font-weight: bold; line-height: 1.25; margin: 0;">Turno ID: ${shift.id.slice(-6)}</p>
        <p style="font-size: 12px; font-weight: bold; line-height: 1.25; margin: 0;">Cajero: ${shift.userName || 'PRINCIPAL'}</p>
        <p style="font-size: 12px; margin: 4px 0 0 0;">Apertura: ${dateStrOpened}</p>
        <p style="font-size: 12px; margin: 0;">Cierre: ${dateStrClosed}</p>
      </div>

      <div style="border-bottom: 1px dashed black; margin-bottom: 8px;"></div>

      <!-- Financials -->
      <div style="font-size: 12px; font-weight: bold; margin-bottom: 12px; display: flex; flex-direction: column; gap: 4px;">
        <h3 style="text-align: center; background-color: #E5E7EB; padding: 4px 0; margin-bottom: 8px; font-weight: 900; text-transform: uppercase;">Resumen Financiero</h3>
        
        <div style="display: flex; justify-content: space-between;">
          <span>Base Inicial:</span>
          <span>${formatMoney(initial)}</span>
        </div>
        
        <div style="display: flex; justify-content: space-between;">
          <span>Ventas Efectivo:</span>
          <span>${formatMoney(cashSalesTotal)}</span>
        </div>
        
        <div style="display: flex; justify-content: space-between;">
          <span>Ventas Tarjeta:</span>
          <span>${formatMoney(cardSalesTotal)}</span>
        </div>
        
        <div style="display: flex; justify-content: space-between;">
          <span>Ventas Transferencia:</span>
          <span>${formatMoney(transferSalesTotal)}</span>
        </div>

        <div style="border-top: 1px solid black; padding-top: 4px; display: flex; justify-content: space-between; font-weight: 900; font-size: 14px;">
          <span>Total Ventas:</span>
          <span>${formatMoney(totalSales)}</span>
        </div>

        <div style="display: flex; justify-content: space-between; margin-top: 8px; color: #DC2626;">
          <span>Retiros/Gastos:</span>
          <span>-${formatMoney(totalExpenses)}</span>
        </div>

        ${discountsHtml}
      </div>

      <div style="border-bottom: 1px dashed black; margin-bottom: 8px;"></div>

      <!-- Cash Register Match -->
      <div style="font-size: 12px; font-weight: bold; margin-top: 8px; margin-bottom: 16px; display: flex; flex-direction: column; gap: 4px;">
        <h3 style="text-align: center; background-color: #E5E7EB; padding: 4px 0; margin-bottom: 8px; font-weight: 900; text-transform: uppercase;">Cuadre de Caja (Efectivo)</h3>
        
        <div style="display: flex; justify-content: space-between;">
          <span>Efectivo Esperado:</span>
          <span>${formatMoney(expectedCash)}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>Efectivo Contado:</span>
          <span>${formatMoney(countedCash)}</span>
        </div>
        
        <div style="border-top: 1px solid black; padding-top: 4px; display: flex; justify-content: space-between; font-weight: 900; font-size: 14px; margin-top: 4px;">
          <span>${difference === 0 ? 'CUADRE EXACTO' : (difference > 0 ? 'SOBRANTE' : 'FALTANTE')}:</span>
          <span>${formatMoney(Math.abs(difference))}</span>
        </div>
      </div>

      <div style="border-bottom: 3px solid black; margin: 12px 0;"></div>

      <!-- Products Sold Summary -->
      <div style="font-size: 12px; font-weight: bold;">
        <h3 style="text-align: center; background-color: #E5E7EB; padding: 4px 0; margin-bottom: 8px; font-weight: 900; text-transform: uppercase;">Productos Vendidos</h3>
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

      ${expensesHtml}

      <!-- Footer -->
      <div style="text-align: center; font-size: 12px; margin-top: 24px;">
        <p style="border-top: 1px solid black; padding-top: 4px; margin-bottom: 16px; width: 75%; margin-left: auto; margin-right: auto;">Firma Cajero</p>
        <p style="font-weight: bold; margin: 0;">FIN DE INFORME Z</p>
      </div>

    </div>
  `;
};
