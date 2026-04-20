import { useState, useEffect } from 'react';
import { onSyncStatusChange, getSyncStatus } from '../../lib/syncManager';

const isSupabaseConfigured = () => {
  const url = import.meta.env.VITE_SUPABASE_URL || '';
  return url.length > 0 && !url.includes('placeholder');
};

/**
 * SyncStatusIndicator
 * Muestra el estado de sincronización con Supabase.
 * Verde = online y sincronizado
 * Amarillo = sin internet, con cambios pendientes
 * Azul animado = sincronizando
 * Rojo = Supabase no configurado
 */
export default function SyncStatusIndicator() {
  const [status, setStatus] = useState(getSyncStatus());

  useEffect(() => {
    const unsub = onSyncStatusChange(setStatus);
    return unsub;
  }, []);

  // Supabase no configurado → silencioso, no mostrar nada
  if (!isSupabaseConfigured()) {
    return null;
  }

  // No mostrar nada si está online y sin pendientes (estado normal silencioso)
  if (status.online && status.pendingCount === 0 && !status.syncing) {
    return null;
  }

  const clearQueue = () => {
    localStorage.removeItem('frita-sync-queue');
    setStatus({ online: status.online, pendingCount: 0, syncing: false });
  };

  let icon, text, bgColor, textColor;

  if (status.syncing) {
    icon = '🔄';
    text = 'Sincronizando...';
    bgColor = 'bg-blue-500/90';
    textColor = 'text-white';
  } else if (!status.online) {
    icon = '📡';
    text = status.pendingCount > 0
      ? `Sin internet · ${status.pendingCount} cambio${status.pendingCount !== 1 ? 's' : ''} pendiente${status.pendingCount !== 1 ? 's' : ''}`
      : 'Sin internet';
    bgColor = 'bg-amber-500/90';
    textColor = 'text-white';
  } else {
    // Online pero con pendientes (flushing)
    icon = '⬆️';
    text = `Subiendo cambios...`;
    bgColor = 'bg-blue-500/90';
    textColor = 'text-white';
  }

  return (
    <div
      className={`
        fixed top-4 left-1/2 -translate-x-1/2 z-50
        flex items-center gap-2 px-4 py-2 rounded-full
        shadow-lg backdrop-blur-sm text-sm font-medium
        ${bgColor} ${textColor}
        transition-all duration-300 ease-in-out
      `}
      style={{ animation: status.syncing ? 'pulse 1.5s infinite' : 'none' }}
    >
      <span>{icon}</span>
      <span>{text}</span>
      {/* Botón para limpiar cola atascada */}
      {!status.syncing && status.pendingCount > 0 && (
        <button
          onClick={clearQueue}
          title="Descartar cambios pendientes"
          style={{
            marginLeft: '6px',
            background: 'rgba(255,255,255,0.25)',
            border: 'none',
            borderRadius: '50%',
            width: '20px',
            height: '20px',
            cursor: 'pointer',
            fontSize: '11px',
            color: 'white',
            lineHeight: '20px',
            textAlign: 'center',
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}
