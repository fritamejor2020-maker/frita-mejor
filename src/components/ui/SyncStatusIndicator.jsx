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
  // Desactivado para evitar que el letrero flotante obstruya los botones del usuario.
  return null;
}
