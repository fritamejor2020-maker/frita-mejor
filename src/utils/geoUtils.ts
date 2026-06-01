/**
 * Utilidades Geográficas para validación de Geocercas y Proximidad GPS
 */

export interface Coordinate {
  lat: number;
  lng: number;
}

/**
 * Algoritmo de Ray-Casting (Punto en Polígono)
 * Determina de forma matemática si unas coordenadas (lat, lng) se encuentran
 * dentro de un polígono cerrado (array de coordenadas).
 *
 * @param lat Latitud del punto
 * @param lng Longitud del punto
 * @param polygon Array de coordenadas del polígono
 * @returns boolean true si el punto está dentro, false en caso contrario
 */
export function isPointInPolygon(lat: number, lng: number, polygon: Coordinate[]): boolean {
  if (!polygon || polygon.length < 3) return false;

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;

    const intersect = ((yi > lat) !== (yj > lat))
        && (lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi);
    
    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Fórmula de Haversine
 * Calcula la distancia en línea recta sobre la superficie terrestre (gran círculo)
 * entre dos pares de coordenadas (latitud/longitud) en kilómetros.
 *
 * @param lat1 Latitud punto 1
 * @param lng1 Longitud punto 1
 * @param lat2 Latitud punto 2
 * @param lng2 Longitud punto 2
 * @returns number Distancia en kilómetros
 */
export function getHaversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Radio de la Tierra en kilómetros
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distancia en kilómetros
}

/**
 * Formatea la distancia de manera legible (ej: "350 m" o "2.4 km")
 * @param distanceKm Distancia en kilómetros
 */
export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${distanceKm.toFixed(1)} km`;
}
