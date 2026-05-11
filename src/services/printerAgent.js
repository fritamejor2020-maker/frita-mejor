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
 * Verifica si el agente está corriendo o si estamos dentro de Electron
 * @returns {Promise<{ok: boolean, printerName?: string}>}
 */
export async function checkAgent() {
  // 1. Si estamos dentro del cajero Desktop (Electron), el agente es nativo
  if (window.cajeroAPI && window.cajeroAPI.getConfig) {
    try {
      const config = await window.cajeroAPI.getConfig();
      return { ok: true, printerName: config.printerName, version: 'Electron' };
    } catch (e) {
      return { ok: false };
    }
  }

  // 2. Si no, intentar por HTTP (localhost:9099)
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
 * Abre el cajón de dinero
 * @param {string} [code] - Código ESC/POS opcional (ej: "27,112,48,55,121")
 * @returns {Promise<boolean>} - true si se envió correctamente
 */
export async function openDrawer(code) {
  // 1. Si estamos en Electron, abrir nativamente vía IPC
  if (window.cajeroAPI && window.cajeroAPI.openDrawer) {
    try {
      const res = await window.cajeroAPI.openDrawer(code);
      if (res.ok) {
        console.log('[PrinterAgent] ✅ Cajón abierto (Electron nativo)');
        return true;
      }
      console.warn('[PrinterAgent] Error al abrir cajón (Electron):', res.error);
      return false;
    } catch (e) {
      console.warn('[PrinterAgent] Error IPC:', e.message);
      return false;
    }
  }

  // 2. Fallback HTTP
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
      console.log('[PrinterAgent] ✅ Cajón abierto (HTTP)');
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
  if (window.cajeroAPI && window.cajeroAPI.printRaw) {
    try {
      const res = await window.cajeroAPI.printRaw(bytes);
      return res.ok;
    } catch (e) {
      return false;
    }
  }

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
