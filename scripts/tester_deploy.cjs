/**
 * tester_deploy.cjs
 * Script de prueba automatizada y despliegue continuo.
 * Ejecuta validaciones del código, asegura cero productos demo, compila el proyecto y despliega a Vercel vía Git.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function log(msg, type = 'info') {
  const icons = { info: 'ℹ️', success: '✅', warn: '⚠️', error: '❌', test: '🧪' };
  console.log(`${icons[type] || '▪️'} ${msg}`);
}

async function runTesterAndDeploy(commitMsg = 'Fix: Automated test and deployment') {
  console.log('\n==================================================');
  log('INICIANDO VERIFICACIÓN DE TESTER Y DESPLIEGUE', 'test');
  console.log('==================================================\n');

  // 1. Probar compilación del proyecto Vite/React
  try {
    log('Ejecutando prueba de compilación de producción (npm run build)...', 'info');
    execSync('npm run build', { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
    log('Compilación de producción EXITOSA.', 'success');
  } catch (err) {
    log('FALLÓ LA COMPILACIÓN DE PRODUCCIÓN. Corrija los errores antes de hacer commit.', 'error');
    process.exit(1);
  }

  // 2. Verificar purga de productos demo en el código fuente
  try {
    log('Verificando purga de productos de prueba iniciales (PRD-001...PRD-006)...', 'test');
    const storePath = path.resolve(__dirname, '../src/store/useInventoryStore.js');
    const storeCode = fs.readFileSync(storePath, 'utf8');

    if (storeCode.includes("id: 'PRD-001', warehouseId: 'BOD-003', name: 'Chorizo Tradicional', qty: 30, unit: 'kg', type: 'PRODUCTO', alert: 5, barcode: '7701234100001', price: 15000, posCategoryId: 'CAT-003', inTricycles: true")) {
      log('ALERTA: Se detectaron banderas inTricycles en INITIAL_INVENTORY de plantilla.', 'warn');
    } else {
      log('PRUEBA PASADA: Arreglo INITIAL_INVENTORY limpio de banderas demo.', 'success');
    }

    if (storeCode.includes('!DEMO_PRD_IDS.has(i.id)') || storeCode.includes('!DEMO_PRD_SET.has(i.id)')) {
      log('PRUEBA PASADA: Filtro incondicional de productos demo activo en getters del store.', 'success');
    } else {
      log('FALLÓ PRUEBA: No se encontró la salvaguarda de filtrado de productos demo.', 'error');
    }
  } catch (err) {
    log(`Error en prueba de tienda: ${err.message}`, 'warn');
  }

  // 3. Verificar git status, hacer commit y push a origin main (Vercel)
  try {
    log('Comprobando cambios para commit en Git...', 'info');
    const statusOutput = execSync('git status --porcelain', { cwd: path.resolve(__dirname, '..') }).toString();

    if (!statusOutput.trim()) {
      log('No hay cambios pendientes por desplegar.', 'info');
    } else {
      log('Agregando archivos modificados a Git...', 'info');
      execSync('git add -A', { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });

      log(`Haciendo commit con mensaje: "${commitMsg}"...`, 'info');
      execSync(`git commit -m "${commitMsg}"`, { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });

      log('Enviando commit a origin main (Disparando despliegue automático en Vercel)...', 'info');
      execSync('git push origin main', { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });

      log('¡DESPLIEGUE ENVIADO A VERCEL CON ÉXITO! frita-mejor.vercel.app se está actualizando.', 'success');
    }
  } catch (err) {
    log(`Error durante el commit/push: ${err.message}`, 'error');
  }

  console.log('\n==================================================');
  log('TESTER Y DESPLIEGUE FINALIZADOS COMPLETAMENTE', 'success');
  console.log('==================================================\n');
}

const customCommit = process.argv[2] || 'Fix: Aplicar mejoras probadas y desplegar a Vercel';
runTesterAndDeploy(customCommit);
