import React from 'react';
import { LOGO_BASE64 } from './logoBase64';
import { generateBarcodeSVG } from './barcodeUtils';

const formatMoney = (val) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(val || 0);

export const generateReceiptHTML = (sale, customer, ticketConfig = {}, customerTypes = [], cashDrawerCode = '') => {
  if (!sale) return '';

  const tc = {
    businessName: 'Frita Mejor',
    nit: '12233346-7',
    phone: '314379377',
    address: 'Pitalito, Huila',
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
    saleSubFooterMsg: 'Si desea factura electrónica escriba al 3138015176',
    saleBottomLine: 'Dios los bendiga',
    ...ticketConfig,
  };

  const dateStr = new Date(sale.timestamp).toLocaleString('es-CO', {
    dateStyle: 'short', timeStyle: 'short'
  });

  const customerName = customer?.name || 'Cliente General';
  const customerDocStr = (tc.showCustomerDoc && customer?.document) ? ` · CC/NIT: ${customer.document}` : '';
  const customerAddrStr = (tc.showCustomerAddress && customer?.address) ? ` · Dir: ${customer.address}` : '';
  const customerPhoneStr = (tc.showCustomerPhone && customer?.phone) ? ` · Tel: ${customer.phone}` : '';

  // Contrata type name
  let contrataTypeStr = '';
  if (tc.showContrataType && customer?.typeId && customerTypes.length > 0) {
    const cType = customerTypes.find(t => t.id === customer.typeId);
    if (cType) contrataTypeStr = ` (${cType.name})`;
  }

  const discountHtml = (tc.showDiscount && sale.discountAmount > 0) ? `
    <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
      <span>Descuento (${sale.discountPercent}%):</span>
      <span>-${formatMoney(sale.discountAmount)}</span>
    </div>
  ` : '';

  const itemsHtml = sale.items.map(item => `
    <tr style="border-bottom: 1px dashed #ccc;">
      <td style="vertical-align: top; padding: 2px 2px 2px 0; font-weight: bold; width: 12%; text-align: left;">${item.qty}x</td>
      <td style="vertical-align: top; padding: 2px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 40mm;">${item.name}</td>
      <td style="vertical-align: top; padding: 2px 0; text-align: right; width: 35%; font-weight: bold;">${formatMoney(item.qty * item.price)}</td>
    </tr>
  `).join('');

  const ticketNo = (sale.id || 'N/A').replace('SALE-', '').slice(-6);

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

      <!-- Header & Logo Compacto -->
      <div style="text-align: center; margin-bottom: 4px;">
        ${tc.showLogo ? `<img src="${LOGO_BASE64}" alt="${tc.businessName}" style="width: 95px; height: auto; display: block; margin: 0 auto 2px auto; filter: grayscale(100%) contrast(1000%);" />` : ''}
        <h2 style="font-size: 14px; font-weight: 900; margin: 0; text-transform: uppercase; letter-spacing: 0.5px;">${tc.businessName}</h2>
        <p style="font-size: 10px; margin: 1px 0 0 0;">
          ${tc.showNit && tc.nit ? `NIT: ${tc.nit}` : ''}
          ${tc.showPhone && tc.phone ? ` · Tel: ${tc.phone}` : ''}
        </p>
        ${tc.showAddress && tc.address ? `<p style="font-size: 10px; margin: 0;">${tc.address}</p>` : ''}
      </div>

      <div style="border-bottom: 1px dashed black; margin: 4px 0;"></div>

      <!-- Transaction Info Compacto -->
      <div style="font-size: 10.5px; margin-bottom: 2px;">
        <div style="display: flex; justify-content: space-between; font-weight: 900;">
          ${tc.showTicketNumber ? `<span>No: ${ticketNo}</span>` : ''}
          ${tc.showDate ? `<span>${dateStr}</span>` : ''}
        </div>
        ${tc.showCashier ? `<div style="margin-top: 1px;">Cajero: ${(sale.userName || 'PRINCIPAL').toUpperCase()}</div>` : ''}
      </div>

      <!-- Customer Info Compacto -->
      ${tc.showCustomerName ? `
        <div style="font-size: 10px; margin-top: 2px; padding-top: 2px; border-top: 1px dotted #aaa;">
          <span>Cliente: ${customerName}${contrataTypeStr}${customerDocStr}${customerPhoneStr}${customerAddrStr}</span>
        </div>
      ` : ''}

      <div style="border-bottom: 1px dashed black; margin: 4px 0;"></div>

      <!-- Items Tabla Compacta -->
      <table style="width: 100%; text-align: left; margin-bottom: 4px; table-layout: fixed; border-collapse: collapse; font-size: 10.5px;">
        <thead>
          <tr style="border-bottom: 1px solid black; font-weight: 900;">
            <th style="padding: 2px 0; width: 12%;">CANT</th>
            <th style="padding: 2px 0; width: 53%;">DESCRIPCION</th>
            <th style="padding: 2px 0; width: 35%; text-align: right;">TOTAL</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <!-- Totales Compactos -->
      <div style="text-align: right; margin-bottom: 6px; font-size: 11px;">
        ${tc.showSubtotal ? `<div style="display: flex; justify-content: space-between; margin-bottom: 1px;">
          <span>Subtotal:</span><span>${formatMoney(sale.subtotal)}</span>
        </div>` : ''}
        ${discountHtml}
        <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: 900; margin-top: 2px; padding-top: 2px; border-top: 1.5px solid black;">
          <span>TOTAL:</span>
          <span>${formatMoney(sale.total)}</span>
        </div>
      </div>

      <!-- Payments Compacto -->
      ${tc.showPaymentInfo ? `<div style="margin-bottom: 6px; padding: 3px 4px; border: 1px solid black; border-radius: 3px; font-size: 10.5px;">
        ${sale.contrataPaymentMethod === 'credit'
          ? `<p style="font-weight: 900; text-align: center; border-bottom: 1px solid black; margin: 0 0 2px 0; padding-bottom: 2px;">*** VENTA A CREDITO — POR COBRAR ***</p>
             <p style="text-align:center;font-size:10px;margin:0;">Monto pendiente: ${formatMoney(sale.creditAmount || sale.total)}</p>`
          : `<p style="font-weight: 900; text-align: center; border-bottom: 1px solid black; margin: 0 0 2px 0; padding-bottom: 2px;">PAGO EN ${sale.paymentMethod || 'EFECTIVO'}</p>
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

      <div style="border-bottom: 1px dashed black; margin: 4px 0;"></div>

      <!-- Footer Compacto -->
      <div style="text-align: center; font-size: 10px;">
        ${tc.saleFooterMsg ? `<p style="font-weight: 900; font-size: 12px; margin: 0 0 2px 0;">${tc.saleFooterMsg}</p>` : ''}
        ${tc.saleSubFooterMsg ? `<p style="font-size: 9.5px; margin: 0 0 4px 0;">${tc.saleSubFooterMsg}</p>` : ''}
        ${tc.showBarcode ? `
          <div style="margin: 4px auto 2px auto; text-align: center;">
            ${generateBarcodeSVG(ticketNo, 28)}
            <p style="font-size: 9px; margin: 2px 0 0 0; font-weight: bold; letter-spacing: 2px;">${ticketNo}</p>
          </div>
        ` : ''}
        ${tc.saleBottomLine ? `<p style="margin-top: 4px; font-size: 8.5px;">${tc.saleBottomLine}</p>` : ''}
      </div>

    </div>
  `;
};
