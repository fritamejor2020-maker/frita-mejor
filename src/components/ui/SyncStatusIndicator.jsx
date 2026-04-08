import { useState, useEffect } from 'react';
import { onSyncStatusChange, getSyncStatus } from '../../lib/syncManager';

/**
 * SyncStatusIndicator
 * Muestra el estado de sincronización con Supabase.
 * Verde = online y sincronizado
 * Amarillo = sin internet, con cambios pendientes
 * Azul animado = sincronizando
 */
export default function SyncStatusIndicator() {
  const [status, setStatus] = useState(getSyncStatus());

  useEffect(() => {
    const unsub = onSyncStatusChange(setStatus);
    return unsub;
  }, []);

  // No mostrar nada si está online y sin pendientes (estado normal silencioso)
  if (status.online && status.pendingCount === 0 && !status.syncing) {
    return null;
  }

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
    </div>
  );
}
