// Helper utilitario para resolucion instantanea y offline de fotos de productos en POS

const LOCAL_PRODUCT_IMAGES_BY_ID = {
  'PRD-1784642642030-1':  '/products/empanada.png',
  'PRD-1784642642030-2':  '/products/pastel.png',
  'PRD-1784642642030-3':  '/products/maduro.png',
  'PRD-1784642642030-4':  '/products/chorizo.png',
  'PRD-1784642642030-5':  '/products/hamburguesa-de-patacon.png',
  'PRD-1784642642030-6':  '/products/hamburguesa-de-arepa.png',
  'PRD-1784642642030-7':  '/products/hamburguesa-sencilla.png',
  'PRD-1784642642030-8':  '/products/bofe.png',
  'PRD-1784642642030-9':  '/products/rellena.png',
  'PRD-1784642642030-10': '/products/chicharron.png',
  'PRD-1784642642030-11': '/products/hueso.png',
  'PRD-1784642642030-66': '/products/arepa-de-huevo.png',
  'PRD-1784642642030-58': '/products/chunchulla.png',
  'PRD-1784642642030-71': '/products/picada.png',
  'PRD-1784642642030-12': '/products/limonada.png',
  'PRD-1784642642030-13': '/products/limonada.png',
  'PRD-1784642642030-14': '/products/avena-10-oz.png',
  'PRD-1784642642030-15': '/products/masato-10-oz.png',
  'PRD-1784642642030-82': '/products/chorizo-crudo.png',
};

const LOCAL_PRODUCT_IMAGES_BY_NAME = {
  'empanada':                '/products/empanada.png',
  'pastel':                  '/products/pastel.png',
  'maduro':                  '/products/maduro.png',
  'chorizo':                 '/products/chorizo.png',
  'chor.':                   '/products/chorizo.png',
  'chor':                    '/products/chorizo.png',
  'hamburguesa de patacon':  '/products/hamburguesa-de-patacon.png',
  'hamburguesa de arepa':    '/products/hamburguesa-de-arepa.png',
  'hamburguesa sencilla':    '/products/hamburguesa-sencilla.png',
  'bofe':                    '/products/bofe.png',
  'rellena':                 '/products/rellena.png',
  'chicharron':              '/products/chicharron.png',
  'hueso':                   '/products/hueso.png',
  'arepa de huevo':          '/products/arepa-de-huevo.png',
  'chunchulla':              '/products/chunchulla.png',
  'picada':                  '/products/picada.png',
  'limonada':                '/products/limonada.png',
  'avena 10 oz':             '/products/avena-10-oz.png',
  'avena':                   '/products/avena-10-oz.png',
  'masato 10 oz':            '/products/masato-10-oz.png',
  'masato':                  '/products/masato-10-oz.png',
  'chorizo crudo':           '/products/chorizo-crudo.png',
};

function normalizeText(text) {
  if (!text) return '';
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function resolveAssetPath(path) {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path;
  }
  if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    const basePath = window.location.href.split('index.html')[0];
    return basePath + cleanPath;
  }
  return path;
}

export function getProductLocalFallback(item) {
  if (!item) return null;
  let rawPath = null;
  if (item.id && LOCAL_PRODUCT_IMAGES_BY_ID[item.id]) {
    rawPath = LOCAL_PRODUCT_IMAGES_BY_ID[item.id];
  } else {
    const normName = normalizeText(item.name);
    if (normName && LOCAL_PRODUCT_IMAGES_BY_NAME[normName]) {
      rawPath = LOCAL_PRODUCT_IMAGES_BY_NAME[normName];
    } else {
      for (const [key, path] of Object.entries(LOCAL_PRODUCT_IMAGES_BY_NAME)) {
        if (normName.includes(key)) {
          rawPath = path;
          break;
        }
      }
    }
  }
  return rawPath ? resolveAssetPath(rawPath) : null;
}

export function getProductImageUrl(item) {
  if (!item) return null;

  // 1. Prioridad: URL autoritativa en la nube (Supabase Storage) o URL directa
  if (item.imageUrl && typeof item.imageUrl === 'string' && item.imageUrl.trim().length > 0) {
    const trimmed = item.imageUrl.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
      return trimmed;
    }
  }

  // 2. Respaldo local empaquetado (Offline / Fallback adaptativo Electron + Web)
  const localAsset = getProductLocalFallback(item);
  if (localAsset) {
    return localAsset;
  }

  // 3. Fallback de compatibilidad
  if (item.imageUrl && typeof item.imageUrl === 'string' && item.imageUrl.trim().length > 0) {
    return resolveAssetPath(item.imageUrl.trim());
  }

  return null;
}

export function hasProductImage(item) {
  return !!getProductImageUrl(item);
}
