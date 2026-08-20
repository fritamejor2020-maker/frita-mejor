const https = require('https');

const SUPABASE_REST_HOST = 'uevcotmnffftoelscjua.supabase.co';
const SUPABASE_REST_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVldmNvdG1uZmZmdG9lbHNjanVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTk3NjMsImV4cCI6MjA5MTIzNTc2M30.c8q811qfvwOvenGk4mwt1HVTBsD7cPYiTM-2orqz3pM';

function getSupabaseKey(keyName) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: SUPABASE_REST_HOST, port: 443, path: `/rest/v1/app_state?key=eq.${keyName}&select=*`, method: 'GET',
      headers: { 'apikey': SUPABASE_REST_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_REST_ANON_KEY}` }
    }, res => {
      let data = ''; res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)[0]?.value || null); } catch (e) { resolve(null); }
      });
    });
    req.on('error', reject); req.end();
  });
}

function postToSupabaseKey(keyName, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ key: keyName, value: payload, updated_at: new Date().toISOString() });
    const req = https.request({
      hostname: SUPABASE_REST_HOST, port: 443, path: '/rest/v1/app_state', method: 'POST',
      headers: {
        'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates',
        'apikey': SUPABASE_REST_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_REST_ANON_KEY}`,
        'Content-Length': Buffer.byteLength(body)
      }
    }, res => resolve(res.statusCode));
    req.on('error', reject); req.write(body); req.end();
  });
}

async function restoreUserConfig() {
  console.log('=== RESTAURANDO CONFIGURACIÓN PERSONALIZADA DEL USUARIO ===');

  const userTicketConfig = {
    businessName: "Frita Mejor",
    nit: "12233346-7",
    phone: "314379377",
    address: "Pitalito, Huila",
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
    saleFooterMsg: "¡GRACIAS POR SU COMPRA!",
    saleSubFooterMsg: "Si desea factura electrónica escriba al 3138015176",
    saleBottomLine: "Dios los bendiga",
    zCustomTitle: "REPORTE Z — CIERRE DE TURNO",
    zReportFooterMsg: "FIN DE INFORME Z",
    zShowFinancialSummary: true,
    zShowContratasBreakdown: true,
    zShowLocalVsContratas: true,
    zShowCashRegisterMatch: true,
    zShowProductsSold: true,
    zShowExpensesDetail: true,
    zShowSignatureLine: true,
    zShowPaymentMethods: true,
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
    zShowCurrentMoney: false
  };

  for (const k of ['posSettings', 'posSettings_BRANCH-001']) {
    let current = await getSupabaseKey(k) || {};
    current.ticketConfig = { ...current.ticketConfig, ...userTicketConfig };
    const st = await postToSupabaseKey(k, current);
    console.log(`Guardado en Supabase "${k}": HTTP ${st}`);
  }
}

restoreUserConfig();
