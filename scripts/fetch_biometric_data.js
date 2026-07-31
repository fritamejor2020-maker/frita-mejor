import fs from 'node:fs';
import path from 'node:path';
import { fetchCompleteDeviceData, DEFAULT_DEVICE_CONFIG } from '../src/services/hikvisionIsapiService.ts';

async function runTestExtraction() {
  console.log('================================================================');
  console.log('🚀 INICIANDO EXTRACCIÓN COMPLETA DEL BIOMÉTRICO HIKVISION');
  console.log(`📍 IP: ${DEFAULT_DEVICE_CONFIG.ipAddress}:${DEFAULT_DEVICE_CONFIG.port}`);
  console.log(`👤 Usuario: ${DEFAULT_DEVICE_CONFIG.username}`);
  console.log('================================================================\n');

  try {
    const data = await fetchCompleteDeviceData(DEFAULT_DEVICE_CONFIG);

    console.log('\n================================================================');
    console.log('📊 RESUMEN DE EXTRACCIÓN OBTENIDA:');
    console.log(`- Modelo del Dispositivo : ${data.deviceInfo.model || 'DS-K1T8003MF'}`);
    console.log(`- Número de Serie       : ${data.deviceInfo.serialNumber || 'N/A'}`);
    console.log(`- Total Usuarios Leídos  : ${data.summary.totalUsers}`);
    console.log(`- Total Eventos Leídos   : ${data.summary.totalEvents}`);
    console.log('================================================================\n');

    const outputFilePath = path.join(process.cwd(), 'datos_biometrico.json');
    fs.writeFileSync(outputFilePath, JSON.stringify(data, null, 2), 'utf-8');

    console.log(`💾 Resultado guardado exitosamente en: ${outputFilePath}`);
    console.log('✨ Extracción 100% completada sin errores.');
  } catch (error) {
    console.error('❌ Error durante la extracción del biométrico:', error);
  }
}

runTestExtraction();
