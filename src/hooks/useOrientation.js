import { useState, useEffect } from 'react';

/**
 * Hook custom para detectar y reaccionar dinámicamente al cambio de orientación
 * (Horizontal / Landscape vs Vertical / Portrait) en Tablets y Móviles (Opera, Chrome, Safari).
 */
export function useOrientation() {
  const getOrientation = () => {
    if (typeof window === 'undefined') return 'portrait';
    
    // 1. Usar dimensiones reales de ventana (la métrica más confiable en Opera Tablet)
    const width = window.innerWidth || document.documentElement.clientWidth || screen.width;
    const height = window.innerHeight || document.documentElement.clientHeight || screen.height;
    if (width > height) return 'landscape';
    if (height > width) return 'portrait';

    // 2. Fallback a screen.orientation.type
    if (window.screen && window.screen.orientation && window.screen.orientation.type) {
      return window.screen.orientation.type.includes('landscape') ? 'landscape' : 'portrait';
    }

    // 3. Fallback a window.orientation o matchMedia
    if (typeof window.orientation !== 'undefined') {
      const angle = Math.abs(Number(window.orientation));
      return (angle === 90 || angle === 270) ? 'landscape' : 'portrait';
    }

    return window.matchMedia('(orientation: landscape)').matches ? 'landscape' : 'portrait';
  };

  const [orientation, setOrientation] = useState(getOrientation);

  useEffect(() => {
    const handleOrientationChange = () => {
      const current = getOrientation();
      setOrientation(current);

      // Actualizar atributos y clases globales en <html> y <body>
      const root = document.documentElement;
      const body = document.body;

      root.setAttribute('data-orientation', current);
      if (body) body.setAttribute('data-orientation', current);

      if (current === 'landscape') {
        root.classList.add('is-landscape');
        root.classList.remove('is-portrait');
        if (body) { body.classList.add('is-landscape'); body.classList.remove('is-portrait'); }
      } else {
        root.classList.add('is-portrait');
        root.classList.remove('is-landscape');
        if (body) { body.classList.add('is-portrait'); body.classList.remove('is-landscape'); }
      }

      // Intentar desbloquear cualquier restricción de orientación impuesta por el contenedor PWA/Opera
      try {
        if (window.screen && window.screen.orientation && typeof window.screen.orientation.unlock === 'function') {
          window.screen.orientation.unlock().catch(() => {});
        }
      } catch (_) {}

      // Orientación actualizada correctamente en DOM sin bucles de eventos
    };

    // Aplicar orientación inicial al montar
    handleOrientationChange();

    // Listeners para todos los eventos de giro
    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', handleOrientationChange);

    let mediaQuery;
    try {
      mediaQuery = window.matchMedia('(orientation: landscape)');
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleOrientationChange);
      } else if (mediaQuery.addListener) {
        mediaQuery.addListener(handleOrientationChange);
      }
    } catch (_) {}

    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', handleOrientationChange);
      if (mediaQuery) {
        if (mediaQuery.removeEventListener) {
          mediaQuery.removeEventListener('change', handleOrientationChange);
        } else if (mediaQuery.removeListener) {
          mediaQuery.removeListener(handleOrientationChange);
        }
      }
    };
  }, []);

  return {
    orientation,
    isLandscape: orientation === 'landscape',
    isPortrait: orientation === 'portrait',
  };
}
