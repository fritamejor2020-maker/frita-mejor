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

/**
 * Genera la abreviación de un producto a partir de las iniciales de cada palabra.
 * Ej: "Hamburguesas de Patacón" → "HP" (ignora palabras de ≤2 letras como "de", "el", "la")
 * Ej: "Chorizo" → "CH" (nombre de 1 sola palabra → primeras 2 letras)
 */
export const getProductAbbreviation = (name: string, abbreviation?: string): string => {
  if (abbreviation && abbreviation.trim()) return abbreviation.trim().toUpperCase().slice(0, 3);
  if (!name) return '??';
  const stopWords = new Set(['de', 'del', 'el', 'la', 'los', 'las', 'y', 'e', 'a', 'en', 'con', 'sin']);
  const words = name.trim().split(/\s+/).filter(w => !stopWords.has(w.toLowerCase()));
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words.map(w => w[0].toUpperCase()).join('').slice(0, 3);
};

/** Quita signos y separadores de miles para obtener un número puro. Ej: "$25.000" → 25000 */
export const parseMoney = (str: string): number => {
  if (!str) return 0;
  const cleaned = str.replace(/[^0-9-]/g, '');
  return parseInt(cleaned, 10) || 0;
};
