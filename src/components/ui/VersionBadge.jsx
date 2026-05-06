import { useState } from 'react';

/**
 * VersionBadge
 * Muestra la versión de la app como un badge discreto en la esquina inferior.
 * Al tocarlo muestra info detallada del dispositivo (útil para debugging).
 */
export default function VersionBadge() {
  const [expanded, setExpanded] = useState(false);

  const version = __APP_VERSION__;
  const buildDate = __APP_BUILD_DATE__;

  const deviceInfo = expanded ? {
    'Navegador': navigator.userAgent.split(') ')[0].split('(')[1] || navigator.userAgent.slice(0, 60),
    'Pantalla': `${screen.width}×${screen.height}`,
    'Viewport': `${window.innerWidth}×${window.innerHeight}`,
    'Online': navigator.onLine ? 'Sí' : 'No',
    'SW': 'serviceWorker' in navigator ? 'Activo' : 'No soportado',
    'SW Cache': localStorage.getItem('frita-sw-version') || '?',
  } : null;

  return (
    <>
      {/* Badge flotante discreto */}
      <button
        onClick={() => setExpanded(!expanded)}
        aria-label="Versión de la app"
        style={{
          position: 'fixed',
          bottom: '12px',
          right: '12px',
          zIndex: 40,
          background: expanded ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.4)',
          color: 'rgba(255,255,255,0.8)',
          border: 'none',
          borderRadius: '12px',
          padding: expanded ? '12px 16px' : '4px 10px',
          fontSize: '11px',
          fontFamily: 'monospace',
          fontWeight: 700,
          cursor: 'pointer',
          backdropFilter: 'blur(8px)',
          transition: 'all 0.2s ease',
          textAlign: 'left',
          lineHeight: 1.5,
          maxWidth: expanded ? '280px' : '120px',
        }}
      >
        {!expanded ? (
          <span>v{version}</span>
        ) : (
          <div>
            <div style={{ marginBottom: '6px', fontSize: '12px', color: '#FFCD5A', fontWeight: 900 }}>
              🍟 Frita Mejor v{version}
            </div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>
              Build: {buildDate}
            </div>
            {deviceInfo && Object.entries(deviceInfo).map(([key, val]) => (
              <div key={key} style={{ fontSize: '10px', display: 'flex', gap: '6px' }}>
                <span style={{ color: 'rgba(255,255,255,0.4)', minWidth: '60px' }}>{key}:</span>
                <span style={{ color: 'rgba(255,255,255,0.8)', wordBreak: 'break-all' }}>{val}</span>
              </div>
            ))}
            <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', marginTop: '8px', textAlign: 'center' }}>
              toca para cerrar
            </div>
          </div>
        )}
      </button>
    </>
  );
}
