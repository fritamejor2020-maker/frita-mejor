/**
 * Minimal Code128B barcode generator — outputs inline SVG string.
 * Encodes ASCII 32-126. Perfect for ticket numbers.
 */

// Code128 bar patterns — each value is a string of 6 digits: bar,space,bar,space,bar,space
// Module widths 1-4. Total per symbol = 11 modules.
const PATTERNS = [
  '212222','222122','222221','121223','121322','131222','122213','122312','132212','221213',
  '221312','231212','112232','122132','122231','113222','123122','123221','223211','221132',
  '221231','213212','223112','312131','311222','321122','321221','312212','322112','322211',
  '212123','212321','232121','111323','131123','131321','112313','132113','132311','211313',
  '231113','231311','112133','112331','132131','113123','113321','133121','313121','211331',
  '231131','213113','213311','213131','311123','311321','331121','312113','312311','332111',
  '314111','221411','431111','111224','111422','121124','121421','141122','141221','112214',
  '112412','122114','122411','142112','142211','241211','221114','413111','241112','134111',
  '111242','121142','121241','114212','124112','124211','411212','421112','421211','212141',
  '214121','412121','111143','111341','131141','114113','114311','411113','411311','113141',
  '114131','311141','411131','211412','211214','211232',
  '233111', // START A (103)
  '211133', // START B (104)  
  '211313', // START C (105)
  '2331112', // STOP (106) — 7 digits (extra termination bar)
];

/**
 * Generate an inline SVG barcode string for the given text using Code128B.
 * @param {string} text - ASCII text to encode
 * @param {number} height - Bar height in px (default 32)
 * @returns {string} SVG element as HTML string
 */
export function generateBarcodeSVG(text, height = 32) {
  if (!text) return '';
  
  // Encode using Code128B
  const codes = [];
  const startB = 104;
  codes.push(startB);
  
  // Encode each character
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i) - 32;
    if (code < 0 || code > 94) continue; // Skip non-printable
    codes.push(code);
  }
  
  // Calculate check digit
  let checksum = codes[0]; // Start code weight = 1 × startCode
  for (let i = 1; i < codes.length; i++) {
    checksum += codes[i] * i;
  }
  codes.push(checksum % 103);
  
  // Add stop code
  codes.push(106);
  
  // Convert codes to bar pattern
  let bars = '';
  for (const code of codes) {
    bars += PATTERNS[code];
  }
  
  // Calculate total width in modules
  let totalModules = 0;
  for (const ch of bars) totalModules += parseInt(ch);
  
  // Render SVG
  const moduleWidth = 1; // 1px per module for thermal printer sharpness
  const svgWidth = totalModules * moduleWidth;
  
  let x = 0;
  let rects = '';
  for (let i = 0; i < bars.length; i++) {
    const w = parseInt(bars[i]) * moduleWidth;
    if (i % 2 === 0) {
      // Even index = bar (black)
      rects += `<rect x="${x}" y="0" width="${w}" height="${height}" fill="black"/>`;
    }
    // Odd index = space (white, no rect needed)
    x += w;
  }
  
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${height}" viewBox="0 0 ${svgWidth} ${height}" style="display:block;margin:0 auto;">${rects}</svg>`;
}
