import { supabase } from './supabase';

// =============================================================================
// ERROR TRACKER — Registro automático de errores en Supabase
// Captura errores de:
//   1. ErrorBoundary (crashes de React)
//   2. window.onerror (errores JS no capturados)
//   3. window.onunhandledrejection (promesas rechazadas)
//   4. Errores manuales (llamando trackError directamente)
// =============================================================================

const MAX_LOCAL_ERRORS = 50;       // Máximo de errores guardados localmente
const LOCAL_KEY = 'frita-error-log';
const THROTTLE_MS = 5000;          // No enviar más de 1 error cada 5s
let lastSentAt = 0;

/**
 * Obtiene información del dispositivo para contexto del error.
 */
function getDeviceInfo() {
  const ua = navigator.userAgent || '';
  return {
    userAgent: ua,
    platform: navigator.platform || 'unknown',
    screenSize: `${screen.width}x${screen.height}`,
    viewportSize: `${window.innerWidth}x${window.innerHeight}`,
    online: navigator.onLine,
    language: navigator.language || 'unknown',
  };
}

/**
 * Obtiene el usuario actual desde localStorage (sin importar el store).
 */
function getCurrentUser() {
  try {
    const raw = localStorage.getItem('frita-mejor-auth-v2');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const user = parsed?.state?.user;
    if (!user) return null;
    return { id: user.id, name: user.name, role: user.role, branchId: user.branchId || null };
  } catch {
    return null;
  }
}

/**
 * Guarda errores localmente (por si no hay internet).
 */
function saveLocally(entry) {
  try {
    const existing = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
    existing.push(entry);
    // Mantener solo los últimos N errores
    if (existing.length > MAX_LOCAL_ERRORS) {
      existing.splice(0, existing.length - MAX_LOCAL_ERRORS);
    }
    localStorage.setItem(LOCAL_KEY, JSON.stringify(existing));
  } catch {
    // localStorage lleno — no hacer nada
  }
}

/**
 * Intenta enviar un error a Supabase (tabla error_logs).
 * Si falla, lo guarda localmente.
 */
async function sendToSupabase(entry) {
  try {
    const url = import.meta.env.VITE_SUPABASE_URL || '';
    if (!url || url.includes('placeholder')) {
      saveLocally(entry);
      return;
    }

    const { error } = await supabase
      .from('error_logs')
      .insert([entry]);

    if (error) {
      console.warn('[ErrorTracker] No se pudo enviar a Supabase:', error.message);
      saveLocally(entry);
    }
  } catch (err) {
    console.warn('[ErrorTracker] Error de red, guardando localmente:', err.message);
    saveLocally(entry);
  }
}

/**
 * Vacía errores guardados localmente enviándolos a Supabase.
 */
export async function flushLocalErrors() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return;
    const errors = JSON.parse(raw);
    if (!errors.length) return;

    const url = import.meta.env.VITE_SUPABASE_URL || '';
    if (!url || url.includes('placeholder')) return;

    const { error } = await supabase
      .from('error_logs')
      .insert(errors);

    if (!error) {
      localStorage.removeItem(LOCAL_KEY);
      console.log(`[ErrorTracker] ${errors.length} errores locales enviados a Supabase.`);
    }
  } catch {
    // Reintentar en la próxima carga
  }
}

/**
 * API pública: registra un error con contexto completo.
 * @param {'crash' | 'error' | 'unhandled_rejection' | 'manual'} type
 * @param {Error|string} error
 * @param {Object} [extra] — info adicional (componentStack, etc.)
 */
export function trackError(type, error, extra = {}) {
  // Throttle: no spamear errores repetidos
  const now = Date.now();
  if (now - lastSentAt < THROTTLE_MS) {
    saveLocally(buildEntry(type, error, extra));
    return;
  }
  lastSentAt = now;

  const entry = buildEntry(type, error, extra);
  console.error(`[ErrorTracker] ${type}:`, error);
  sendToSupabase(entry);
}

function buildEntry(type, error, extra) {
  const errorObj = typeof error === 'string' ? { message: error } : error;
  return {
    type,
    message: errorObj?.message || String(error),
    stack: errorObj?.stack || null,
    component_stack: extra.componentStack || null,
    url: window.location.href,
    user_info: getCurrentUser(),
    device_info: getDeviceInfo(),
    app_version: __APP_VERSION__,
    extra: Object.keys(extra).length > 0
      ? JSON.stringify(extra, null, 0)
      : null,
    created_at: new Date().toISOString(),
  };
}

// =============================================================================
// GLOBAL HANDLERS — Captura automática de errores no manejados
// =============================================================================

/**
 * Instala handlers globales. Llamar una sola vez en el init de la app.
 */
export function installGlobalErrorHandlers() {
  // JS errors no capturados
  window.addEventListener('error', (event) => {
    trackError('error', {
      message: event.message,
      stack: event.error?.stack || `${event.filename}:${event.lineno}:${event.colno}`,
    });
  });

  // Promesas rechazadas sin catch
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    trackError('unhandled_rejection', reason instanceof Error ? reason : {
      message: String(reason),
      stack: reason?.stack || null,
    });
  });

  // Intentar enviar errores locales almacenados
  setTimeout(() => flushLocalErrors(), 5000);

  console.log('[ErrorTracker] Global error handlers instalados.');
}
