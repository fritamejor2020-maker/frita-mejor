import React from 'react';
import { LOGO_BASE64 } from './logoBase64';
import { generateBarcodeSVG } from './barcodeUtils';

const formatMoney = (val) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(val);

export const generateReceiptHTML = (sale, customer, ticketConfig = {}, customerTypes = []) => {
  if (!sale) return '';

  const tc = {
    businessName: 'Frita Mejor',
    nit: '900.000.000-1',
    phone: '300 123 4567',
    address: 'Cali, Colombia',
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
    saleFooterMsg: '¡GRACIAS POR SU COMPRA!',
    saleSubFooterMsg: 'Conserve este tiquete para reclamos.',
    saleBottomLine: 'Sistema POS • fritamejor.com',
    ...ticketConfig,
  };

  const dateStr = new Date(sale.timestamp).toLocaleString('es-CO', {
    dateStyle: 'short', timeStyle: 'short'
  });

  const customerName = customer?.name || 'Cliente General';
  const customerDoc = (tc.showCustomerDoc && customer?.document) ? `<p style="margin: 0;">NIT/CC: ${customer.document}</p>` : '';
  const customerAddr = (tc.showCustomerAddress && customer?.address) ? `<p style="margin: 0;">Dir: ${customer.address}</p>` : '';
  const customerPhone = (tc.showCustomerPhone && customer?.phone) ? `<p style="margin: 0;">Tel: ${customer.phone}</p>` : '';

  // Contrata type name
  let contrataTypeHtml = '';
  if (tc.showContrataType && customer?.typeId && customerTypes.length > 0) {
    const cType = customerTypes.find(t => t.id === customer.typeId);
    if (cType) {
      contrataTypeHtml = `<p style="margin: 0; font-style: italic; font-size: 11px;">Tipo: ${cType.name}</p>`;
    }
  }

  const discountHtml = (tc.showDiscount && sale.discountAmount > 0) ? `
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

  const ticketNo = (sale.id || 'N/A').replace('SALE-', '').slice(-6);

    return `
    <div style="width: 78mm; color: black; font-family: 'Courier New', Courier, monospace; font-size: 12px; padding: 8px; margin: 0 auto;">
      <style>
        @page { size: 80mm auto; margin: 0; }
        * { color: black !important; font-weight: bold !important; }
        @media print {
          body { margin: 0; padding: 0; background: white; }
          html { background: transparent; }
          * { color: black !important; background: transparent !important; font-weight: bold !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          img { filter: grayscale(100%) contrast(1000%) !important; }
        }
      </style>

      <!-- Header & Logo -->
      <div style="text-align: center; margin-bottom: 12px;">
        ${tc.showLogo ? `<div style="display: flex; justify-content: center; margin-bottom: 6px;">
          <img src="${LOGO_BASE64}" alt="${tc.businessName}" style="width: 120px; height: auto; display: block; margin: 0 auto; filter: grayscale(100%) contrast(1000%);" />
        </div>` : ''}
        ${tc.showNit && tc.nit ? `<p style="font-weight: bold; margin: 0;">NIT: ${tc.nit}</p>` : ''}
        ${tc.showPhone && tc.phone ? `<p style="margin: 0;">Tel: ${tc.phone}</p>` : ''}
        ${tc.showAddress && tc.address ? `<p style="margin: 0;">${tc.address}</p>` : ''}
      </div>

      <div style="border-bottom: 2px dashed black; margin: 8px 0;"></div>

      <!-- Transaction Info -->
      <div style="margin-bottom: 8px;">
        ${tc.showTicketNumber ? `<p style="margin: 0; font-size: 14px;">Ticket No: ${ticketNo}</p>` : ''}
        ${tc.showDate ? `<p style="margin: 0;">Fecha: ${dateStr}</p>` : ''}
        ${tc.showCashier ? `<p style="margin: 0;">Cajero: PRINCIPAL</p>` : ''}
      </div>

      <div style="border-bottom: 2px dashed black; margin: 8px 0;"></div>

      <!-- Customer Info -->
      <div style="margin-bottom: 8px;">
        ${tc.showCustomerName ? `<p style="margin: 0;">Cliente: ${customerName}</p>` : ''}
        ${customerDoc}
        ${customerAddr}
        ${customerPhone}
        ${contrataTypeHtml}
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
        ${tc.showSubtotal ? `<div style="display: flex; justify-content: space-between;">
          <span>Subtotal:</span><span>${formatMoney(sale.subtotal)}</span>
        </div>` : ''}
        ${discountHtml}
        <div style="display: flex; justify-content: space-between; font-size: 18px; font-weight: 900; margin-top: 4px; padding-top: 4px; border-top: 2px solid black;">
          <span>TOTAL:</span>
          <span>${formatMoney(sale.total)}</span>
        </div>
      </div>

      <!-- Payments -->
      ${tc.showPaymentInfo ? `<div style="margin-bottom: 12px; padding: 4px; border: 1px solid black; border-radius: 4px;">
        ${sale.contrataPaymentMethod === 'credit'
          ? `<p style="font-weight: 900; text-align: center; border-bottom: 1px solid black; margin: 0 0 4px 0; padding-bottom: 4px;">*** VENTA A CREDITO — POR COBRAR ***</p>
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
      </div>` : ''}

      <div style="border-bottom: 2px dashed black; margin: 12px 0;"></div>

      <!-- Footer -->
      <div style="text-align: center;">
        ${tc.saleFooterMsg ? `<p style="font-weight: 900; font-size: 14px; margin: 0 0 4px 0;">${tc.saleFooterMsg}</p>` : ''}
        ${tc.saleSubFooterMsg ? `<p style="font-size: 10px; margin: 0 0 8px 0;">${tc.saleSubFooterMsg}</p>` : ''}
        ${tc.showBarcode ? `
          <div style="margin: 8px auto 4px auto; text-align: center;">
            ${generateBarcodeSVG(ticketNo, 36)}
            <p style="font-size: 10px; margin: 4px 0 0 0; font-weight: bold; letter-spacing: 2px;">${ticketNo}</p>
          </div>
        ` : ''}
        ${tc.saleBottomLine ? `<p style="margin-top: 8px; font-size: 9px;">${tc.saleBottomLine}</p>` : ''}
      </div>

    </div>
  `;
};
