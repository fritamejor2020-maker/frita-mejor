/**
 * Utilidades de formato para toda la app Frita Mejor.
 * Formato COP con separador de miles (punto): $1.000, $25.000
 */

/** Formatea un número como moneda COP.
 *  - Sin decimales si el valor es entero:  25000   → "$25.000"
 *  - Con decimales si los tiene:           3500.5  → "$3.500,50"
 */
export const formatMoney = (val: number | string): string => {
  const n = Number(val) || 0;
  const hasFraction = n % 1 !== 0;
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: hasFraction ? 2 : 0,
  }).format(n);
};

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

/** Parsea una cadena de moneda a número (con o sin decimales).
 *  Admite formato es-CO ($3.500,50) y estándar (3500.50).
 *  Ej: "$3.500,50" → 3500.5 | "3500"→ 3500 | "3500.5"→ 3500.5
 */
export const parseMoney = (str: string): number => {
  if (!str) return 0;
  // Eliminar símbolo de moneda y espacios
  let s = str.replace(/[$ ]/g, '').trim();
  // Detectar si el separador de miles es punto (formato es-CO: 3.500,50)
  // vs si el punto es decimal (formato estándar: 3500.50)
  const hasCommaDecimal = /,\d{1,2}$/.test(s);
  if (hasCommaDecimal) {
    // Formato es-CO: quitar puntos de miles, convertir coma decimal a punto
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    // Formato estándar: quitar comas de miles si las hay
    s = s.replace(/,/g, '');
  }
  return parseFloat(s) || 0;
};
