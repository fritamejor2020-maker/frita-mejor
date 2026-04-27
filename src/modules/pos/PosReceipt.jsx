import React from 'react';
import { LOGO_BASE64 } from './logoBase64';

const formatMoney = (val) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(val);

export const generateReceiptHTML = (sale, customer, ticketConfig = {}) => {
  if (!sale) return '';

  const tc = {
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
    ...ticketConfig,
  };

  const dateStr = new Date(sale.timestamp).toLocaleString('es-CO', {
    dateStyle: 'short', timeStyle: 'short'
  });

  const customerName = customer?.name || 'Cliente General';
  const customerDoc = customer?.document ? `<p style="margin: 0;">NIT/CC: <span style="font-weight: normal;">${customer.document}</span></p>` : '';
  const discountHtml = sale.discountAmount > 0 ? `
    <div style="display: flex; justify-content: space-between;">
      <span>Descuento (${sale.discountPercent}%):</span>
      <span>-${formatMoney(sale.discountAmount)}</span>
    </div>
  ` : '';

  const itemsHtml = sale.items.map(item => `
    <tr>
      <td style="vertical-align: top; padding-right: 4px; padding-top: 4px; font-weight: bold;">${item.qty}</td>
      <td style="vertical-align: top; padding-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 40mm;">${item.name}</td>
      <td style="vertical-align: top; padding-top: 4px; text-align: right;">${formatMoney(item.qty * item.price)}</td>
    </tr>
  `).join('');

  return `
    <div style="width: 78mm; color: black; font-family: 'Courier New', Courier, monospace; font-size: 12px; padding: 8px; margin: 0 auto;">
      <style>
        @page { size: 80mm auto; margin: 0; }
        @media print {
          body { -webkit-print-color-adjust: exact; margin: 0; padding: 0; background: white; }
          html { background: transparent; }
        }
      </style>

      <!-- Header & Logo -->
      <div style="text-align: center; margin-bottom: 12px;">
        ${tc.showLogo ? `<div style="display: flex; justify-content: center; margin-bottom: 6px;">
          <img src="${LOGO_BASE64}" alt="${tc.businessName}" style="width: 120px; height: auto; display: block; margin: 0 auto;" />
        </div>` : ''}
        ${tc.nit ? `<p style="font-weight: bold; margin: 0;">NIT: ${tc.nit}</p>` : ''}
        ${tc.phone ? `<p style="margin: 0;">Tel: ${tc.phone}</p>` : ''}
        ${tc.address ? `<p style="margin: 0;">${tc.address}</p>` : ''}
      </div>

      <div style="border-bottom: 2px dashed black; margin: 8px 0;"></div>

      <!-- Transaction Info -->
      <div style="margin-bottom: 8px;">
        <p style="font-weight: bold; margin: 0; font-size: 14px;">Ticket No: <span style="font-weight: normal;">${(sale.id || 'N/A').replace('SALE-', '').slice(-6)}</span></p>
        <p style="font-weight: bold; margin: 0;">Fecha: <span style="font-weight: normal;">${dateStr}</span></p>
        ${tc.showCashier ? `<p style="font-weight: bold; margin: 0;">Cajero: <span style="font-weight: normal;">PRINCIPAL</span></p>` : ''}
      </div>

      <div style="border-bottom: 2px dashed black; margin: 8px 0;"></div>

      <!-- Customer Info -->
      <div style="margin-bottom: 8px;">
        <p style="font-weight: bold; margin: 0;">Cliente: <span style="font-weight: normal;">${customerName}</span></p>
        ${customerDoc}
      </div>

      <div style="border-bottom: 2px dashed black; margin: 8px 0;"></div>

      <!-- Items -->
      <table style="width: 100%; text-align: left; margin-bottom: 8px; table-layout: fixed; border-collapse: collapse;">
        <thead>
          <tr style="border-bottom: 1px solid black; font-weight: bold;">
            <th style="padding: 4px 0; width: 15%;">CANT</th>
            <th style="padding: 4px 0; width: 50%;">DESCRIPCION</th>
            <th style="padding: 4px 0; width: 35%; text-align: right;">TOTAL</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <div style="border-bottom: 2px dashed black; margin: 8px 0;"></div>

      <!-- Totals -->
      <div style="text-align: right; margin-bottom: 12px; display: flex; flex-direction: column; gap: 4px;">
        <div style="display: flex; justify-content: space-between;">
          <span>Subtotal:</span>
          <span>${formatMoney(sale.subtotal)}</span>
        </div>
        ${discountHtml}
        <div style="display: flex; justify-content: space-between; font-size: 18px; font-weight: 900; margin-top: 4px; padding-top: 4px; border-top: 2px solid black;">
          <span>TOTAL:</span>
          <span>${formatMoney(sale.total)}</span>
        </div>
      </div>

      <!-- Payments -->
      <div style="margin-bottom: 12px; padding: 4px; border: 1px solid black; border-radius: 4px;">
        ${sale.contrataPaymentMethod === 'credit'
          ? `<p style="font-weight: 900; text-align: center; color: #DC2626; border-bottom: 1px solid black; margin: 0 0 4px 0; padding-bottom: 4px;">⚠ VENTA A CRÉDITO — POR COBRAR</p>
             <p style="text-align:center;font-size:11px;margin:0;">Monto pendiente: ${formatMoney(sale.creditAmount || sale.total)}</p>`
          : `<p style="font-weight: bold; text-align: center; border-bottom: 1px solid black; margin: 0 0 4px 0; padding-bottom: 4px;">PAGO EN ${sale.paymentMethod || 'EFECTIVO'}</p>
             <div style="display: flex; justify-content: space-between;">
               <span>Recibido:</span>
               <span style="font-weight: bold;">${formatMoney(sale.amountProvided)}</span>
             </div>
             <div style="display: flex; justify-content: space-between;">
               <span>Cambio:</span>
               <span style="font-weight: bold;">${formatMoney(sale.change || 0)}</span>
             </div>`
        }
      </div>

      <div style="border-bottom: 2px dashed black; margin: 12px 0;"></div>

      <!-- Footer -->
      <div style="text-align: center;">
        ${tc.saleFooterMsg ? `<p style="font-weight: 900; font-size: 14px; margin: 0 0 4px 0;">${tc.saleFooterMsg}</p>` : ''}
        ${tc.saleSubFooterMsg ? `<p style="font-size: 10px; margin: 0 0 8px 0;">${tc.saleSubFooterMsg}</p>` : ''}
        ${tc.showBarcode ? `<div style="width: 75%; height: 32px; background-color: black; margin: 0 auto 4px auto; opacity: 0.8; background-image: repeating-linear-gradient(90deg, transparent, transparent 2px, white 2px, white 4px); background-size: 4px 100%;"></div>` : ''}
        ${tc.saleBottomLine ? `<p style="margin-top: 8px; font-size: 9px;">${tc.saleBottomLine}</p>` : ''}
      </div>

    </div>
  `;
};
