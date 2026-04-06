/**
 * Utilidades de formato para toda la app Frita Mejor.
 * Formato COP con separador de miles (punto): $1.000, $25.000
 */

/** Formatea un número como moneda COP sin decimales. Ej: 25000 → "$25.000" */
export const formatMoney = (val: number | string): string =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(val) || 0);

/** Quita signos y separadores de miles para obtener un número puro. Ej: "$25.000" → 25000 */
export const parseMoney = (str: string): number => {
  if (!str) return 0;
  const cleaned = str.replace(/[^0-9-]/g, '');
  return parseInt(cleaned, 10) || 0;
};
