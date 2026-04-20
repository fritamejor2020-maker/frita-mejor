import { supabase } from './supabase';

const BUCKET = 'facturas';

/**
 * Sube una imagen de factura a Supabase Storage y devuelve la URL pública.
 * Si el bucket no existe o hay error, devuelve null (no bloquea el flujo).
 */
export async function uploadFactura(file) {
  try {
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });

    if (uploadError) {
      console.warn('[Storage] No se pudo subir la factura:', uploadError.message);
      return null;
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data?.publicUrl ?? null;
  } catch (e) {
    console.warn('[Storage] Error inesperado:', e);
    return null;
  }
}
