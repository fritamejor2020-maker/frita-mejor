/**
 * ═══════════════════════════════════════════════════════════════════
 *  Printer Agent Service
 *  Se comunica con frita-printer-agent.exe (localhost:9099)
 *  para abrir cajón y enviar comandos ESC/POS silenciosamente.
 * ═══════════════════════════════════════════════════════════════════
 */

const AGENT_URL = 'http://localhost:9099';
const TIMEOUT_MS = 2000;

/**
 * Verifica si el agente está corriendo
 * @returns {Promise<{ok: boolean, printerName?: string}>}
 */
export async function checkAgent() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    
    const res = await fetch(`${AGENT_URL}/status`, { signal: controller.signal });
    clearTimeout(timeout);
    
    if (res.ok) {
      const data = await res.json();
      return { ok: true, printerName: data.printerName, version: data.version };
    }
    return { ok: false };
  } catch (e) {
    return { ok: false };
  }
}

/**
 * Abre el cajón de dinero vía el agente local
 * @param {string} [code] - Código ESC/POS opcional (ej: "27,112,48,55,121")
 * @returns {Promise<boolean>} - true si se envió correctamente
 */
export async function openDrawer(code) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    
    const res = await fetch(`${AGENT_URL}/open-drawer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: code ? JSON.stringify({ code }) : '{}',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    
    if (res.ok) {
      console.log('[PrinterAgent] ✅ Cajón abierto');
      return true;
    }
    console.warn('[PrinterAgent] Error al abrir cajón:', await res.text());
    return false;
  } catch (e) {
    console.warn('[PrinterAgent] Agente no disponible:', e.message);
    return false;
  }
}

/**
 * Envía bytes RAW a la impresora
 * @param {number[]} bytes - Array de bytes a enviar
 * @param {string} [printerName] - Nombre de impresora opcional
 * @returns {Promise<boolean>}
 */
export async function sendRawBytes(bytes, printerName) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    
    const res = await fetch(`${AGENT_URL}/print-raw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bytes, printerName }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    
    return res.ok;
  } catch (e) {
    return false;
  }
}
