import fs from 'node:fs';
import path from 'node:path';
import { isapiDigestFetch, DEFAULT_DEVICE_CONFIG } from '../src/services/hikvisionIsapiService.ts';

async function descargarTodasLasMarcacionesHikvision(config = DEFAULT_DEVICE_CONFIG) {
  const acsUrl = '/ISAPI/AccessControl/AcsEvent?format=json';
  let posicion = 0;
  let marcacionesTotales = [];
  let totalEnMemoria = 0;

  console.log(`📡 Iniciando descarga con algoritmo del usuario desde ${config.ipAddress}...`);
  const startTime = Date.now();

  do {
    const payload = JSON.stringify({
      AcsEventCond: {
        searchID: "1",
        searchResultPosition: posicion,
        maxResults: 10,
        major: 0,
        minor: 0
      }
    });

    try {
      const res = await isapiDigestFetch(config, acsUrl, { method: 'POST', body: payload });
      if (!res.ok || !res.text) {
        console.error(`Error HTTP ${res.status} en posición ${posicion}`);
        break;
      }

      const data = JSON.parse(res.text);
      totalEnMemoria = data.AcsEvent?.totalMatches || 0;
      let loteActual = data.AcsEvent?.InfoList || [];
      if (!Array.isArray(loteActual)) loteActual = [loteActual];

      if (loteActual.length === 0) break;

      marcacionesTotales.push(...loteActual);
      posicion += loteActual.length;

      if (posicion % 1000 === 0 || posicion >= totalEnMemoria) {
        const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`⏳ Descargadas ${posicion} / ${totalEnMemoria} marcaciones (${elapsedSec}s)...`);
      }
    } catch (err) {
      console.error(`Error en posición ${posicion}:`, err);
      break;
    }
  } while (posicion < totalEnMemoria);

  console.log(`\n================================================================`);
  console.log(`✅ DESCARGA FINALIZADA: ${marcacionesTotales.length} de ${totalEnMemoria} eventos descargados.`);
  console.log(`================================================================\n`);

  // Filtrar solo las que tengan attendanceStatus checkIn o checkOut
  const marcacionesAsistencia = marcacionesTotales.filter(m => 
    m.attendanceStatus === 'checkIn' || m.attendanceStatus === 'checkOut' || Boolean(m.attendanceStatus)
  );

  console.log(`🎯 Total de marcaciones con attendanceStatus (checkIn/checkOut): ${marcacionesAsistencia.length}`);

  // Filtrar marcaciones del 5 de agosto de 2026 (hoy)
  const hoyStr = '2026-08-05';
  const marcacionesHoy = marcacionesAsistencia.filter(m => m.time && m.time.startsWith(hoyStr));
  console.log(`📅 Marcaciones registradas hoy (${hoyStr}): ${marcacionesHoy.length}\n`);

  marcacionesHoy.forEach(m => {
    console.log(`   - Emp #${m.employeeNoString} | Hora: ${m.time} | Estado: ${m.attendanceStatus} | Serial: ${m.serialNo}`);
  });

  // Guardar en extractedBiometricLogs.json
  const logsPath = path.join(process.cwd(), 'src', 'data', 'extractedBiometricLogs.json');
  fs.writeFileSync(logsPath, JSON.stringify(marcacionesAsistencia, null, 2), 'utf-8');
  console.log(`\n💾 Guardado en: ${logsPath}`);

  return marcacionesAsistencia;
}

descargarTodasLasMarcacionesHikvision();
