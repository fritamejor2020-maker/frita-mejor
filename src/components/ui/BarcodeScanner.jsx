import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from './Button';

/**
 * BarcodeScanner - Usa la cámara del dispositivo para escanear códigos de barras
 * con BarcodeDetector API (Chrome/Edge). En desktop funciona como búsqueda manual.
 * @param {function} onScan - callback(code: string)
 * @param {function} onClose - cerrar el escáner
 */
export function BarcodeScanner({ onScan, onClose }) {
  const videoRef   = useRef(null);
  const streamRef  = useRef(null);
  const rafRef     = useRef(null);
  const [manual, setManual]         = useState('');
  const [scanning, setScanning]     = useState(false);
  const [error, setError]           = useState(null);
  const [supported, setSupported]   = useState(false);
  const [lastCode, setLastCode]     = useState(null);

  const startCamera = useCallback(async () => {
    if (!('BarcodeDetector' in window)) {
      setSupported(false);
      setError('Tu navegador no soporta el escáner de cámara. Usa Chrome/Edge o ingresa el código manualmente.');
      return;
    }

    try {
      setSupported(true);
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setScanning(true);
      }
    } catch (err) {
      setError('No se pudo acceder a la cámara. Verifica los permisos en tu navegador.');
      console.error('Camera error:', err);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setScanning(false);
  }, []);

  // Lógica de detección de código de barras
  useEffect(() => {
    if (!scanning || !videoRef.current || !('BarcodeDetector' in window)) return;

    const detector = new window.BarcodeDetector({
      formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'qr_code', 'upc_a', 'upc_e'],
    });

    const scan = async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) {
        rafRef.current = requestAnimationFrame(scan);
        return;
      }
      try {
        const barcodes = await detector.detect(videoRef.current);
        if (barcodes.length > 0) {
          const code = barcodes[0].rawValue;
          if (code !== lastCode) {
            setLastCode(code);
            onScan(code);
            // Pausa breve después de detectar para evitar lecturas duplicadas
            setTimeout(() => setLastCode(null), 2000);
          }
        }
      } catch (_) { /* ignore */ }
      rafRef.current = requestAnimationFrame(scan);
    };

    rafRef.current = requestAnimationFrame(scan);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [scanning, lastCode, onScan]);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (manual.trim()) {
      onScan(manual.trim());
      setManual('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end md:items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-[32px] w-full max-w-md overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-3">
          <div>
            <h2 className="text-xl font-black text-chunky-dark leading-none">Escanear Código</h2>
            <p className="text-gray-400 font-bold text-xs mt-1">Apunta la cámara al código de barras</p>
          </div>
          <button className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 hover:bg-gray-200" onClick={onClose}>✕</button>
        </div>

        {/* Visor de cámara */}
        <div className="relative bg-black mx-4 rounded-2xl overflow-hidden" style={{ aspectRatio: '4/3', maxHeight: '300px' }}>
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            muted
            playsInline
          />

          {/* Guía visual de escaneo */}
          {scanning && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="border-2 border-chunky-main rounded-xl w-2/3 h-16 relative">
                <div className="absolute inset-x-0 top-1/2 h-0.5 bg-chunky-main/60 animate-pulse" />
                <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-chunky-main rounded-tl" />
                <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-chunky-main rounded-tr" />
                <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-chunky-main rounded-bl" />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-chunky-main rounded-br" />
              </div>
            </div>
          )}

          {/* Estado: sin cámara activa */}
          {!scanning && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-2">
              <span className="text-4xl">📷</span>
              <p className="font-bold text-sm">Iniciando cámara...</p>
            </div>
          )}

          {/* Estado: error de cámara */}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-3 p-6 text-center bg-gray-800">
              <span className="text-3xl">📷</span>
              <p className="font-bold text-sm">{error}</p>
            </div>
          )}

          {/* Indicador de código detectado */}
          {lastCode && (
            <div className="absolute bottom-2 inset-x-2 bg-green-500 text-white text-xs font-bold rounded-xl px-3 py-2 text-center animate-pulse">
              ✅ Detectado: {lastCode}
            </div>
          )}
        </div>

        {/* Entrada manual */}
        <div className="p-5 pt-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">O ingresa el código manualmente</p>
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              type="text"
              placeholder="Ej. 7702011234567"
              className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 font-bold text-sm outline-none focus:border-chunky-main"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              autoComplete="off"
            />
            <Button type="submit" variant="secondary" className="rounded-2xl px-5 font-bold shrink-0">
              Buscar
            </Button>
          </form>

          {!supported && !error && (
            <p className="text-gray-300 font-bold text-xs text-center mt-3">
              El escáner de cámara requiere Chrome o Edge en HTTPS.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
