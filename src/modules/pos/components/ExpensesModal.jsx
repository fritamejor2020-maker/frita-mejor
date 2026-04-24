import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useFinanceStore } from '../../../store/useFinanceStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { useSupplierStore } from '../../../store/useSupplierStore';
import { uploadFactura } from '../../../lib/storageUtils';
import { Button } from '../../../components/ui/Button';
import { MoneyInput } from '../../../components/ui/MoneyInput';

// Normaliza texto para comparar (sin tildes, minúsculas)
const norm = (s = '') =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

export function ExpensesModal({ onClose }) {
  const { addExpense } = useFinanceStore();
  const { user } = useAuthStore();
  const { expenses } = useFinanceStore();
  const {
    suppliers,
    addSupplier,
    learnProductForSupplier,
    getSuppliersForProduct,
  } = useSupplierStore();

  const fileInputRef   = useRef(null);
  const cameraInputRef = useRef(null);
  const descRef        = useRef(null);
  const provRef        = useRef(null);

  const [facturaFile, setFacturaFile]   = useState(null);
  const [photoRotation, setPhotoRotation] = useState(0);
  const [fecha, setFecha]               = useState(new Date().toISOString().split('T')[0]);
  const [descripcion, setDescripcion]   = useState('');
  const [proveedor, setProveedor]       = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [valor, setValor]               = useState('');
  const [facturaPreview, setFacturaPreview] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Visibilidad de dropdowns ────────────────────────────────────────────────
  const [showDescSugg, setShowDescSugg] = useState(false);
  const [showProvSugg, setShowProvSugg] = useState(false);

  // ── Sugerencias de descripción: gastos pasados + commonProducts ─────────────
  const descSuggestions = useMemo(() => {
    if (!descripcion || norm(descripcion).length < 2) return [];
    const q = norm(descripcion);

    // 1. Descripciones únicas de gastos pasados
    const pastDescs = [...new Set(
      expenses.map(e => e.descripcion).filter(Boolean)
    )];

    // 2. Productos de la BD de proveedores
    const provProds = [...new Set(
      suppliers.flatMap(s => s.commonProducts || [])
    )];

    // Combinar, filtrar y ordenar
    return [...new Set([...pastDescs, ...provProds])]
      .filter(p => norm(p).includes(q))
      .sort((a, b) => {
        const aStart = norm(a).startsWith(q) ? 0 : 1;
        const bStart = norm(b).startsWith(q) ? 0 : 1;
        return aStart - bStart || a.localeCompare(b, 'es');
      })
      .slice(0, 8);
  }, [descripcion, expenses, suppliers]);

  // ── Sugerencias de proveedor: filtrados por producto escrito ─────────────────
  const provSuggestions = useMemo(() => {
    const q = norm(descripcion);
    const pq = norm(proveedor);
    const activeAll = suppliers.filter(s => s.active);

    let base;

    if (q.length < 2) {
      // Sin descripción → todos los proveedores
      base = activeAll;
    } else {
      // 1. Proveedores de gastos pasados con esa descripción
      const namesFromExpenses = [...new Set(
        expenses
          .filter(e => norm(e.descripcion || '').includes(q) && e.proveedor)
          .map(e => e.proveedor)
      )];

      // 2. Proveedores del store con ese producto en commonProducts
      const namesFromStore = activeAll
        .filter(s => s.commonProducts?.some(p => norm(p).includes(q) || q.includes(norm(p))))
        .map(s => s.name);

      const matched = [...new Set([...namesFromExpenses, ...namesFromStore])];

      if (matched.length === 0) {
        // Producto no registrado → mostrar todos (comportamiento solicitado)
        base = activeAll;
      } else {
        // Reconstruir objetos (incluyendo los que vienen de gastos y no están en el store)
        base = matched.map(name => {
          const found = suppliers.find(s => s.name.toLowerCase() === name.toLowerCase());
          return found || { id: name, name, commonProducts: [] };
        });
      }
    }

    // Filtrar por texto escrito en el campo proveedor
    if (!pq) return base.slice(0, 8);
    return base.filter(s => norm(s.name).includes(pq)).slice(0, 8);
  }, [proveedor, descripcion, suppliers, expenses]);

  const numValor   = parseFloat(valor) || 0;
  const isFormValid = descripcion.trim() !== '' && (proveedor.trim() !== '' || selectedSupplierId !== '') && numValor > 0;

  // ── Cerrar dropdowns al hacer clic fuera ────────────────────────────────────
  useEffect(() => {
    const handle = (e) => {
      if (!descRef.current?.contains(e.target)) setShowDescSugg(false);
      if (!provRef.current?.contains(e.target))  setShowProvSugg(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  // ── Seleccionar sugerencia de descripción ───────────────────────────────────
  const selectDesc = (product) => {
    setDescripcion(product);
    setShowDescSugg(false);
    // Auto-rellenar el primer proveedor que vende ese producto
    const forProduct = getSuppliersForProduct(product);
    if (forProduct.length === 1) {
      setProveedor(forProduct[0].name);
      setSelectedSupplierId(forProduct[0].id);
    } else {
      setProveedor('');
      setSelectedSupplierId('');
      setTimeout(() => setShowProvSugg(true), 50);
    }
  };

  // ── Seleccionar sugerencia de proveedor ─────────────────────────────────────
  const selectSupplier = (supplier) => {
    setProveedor(supplier.name);
    setSelectedSupplierId(supplier.id);
    setShowProvSugg(false);
  };

  // ── Foto ────────────────────────────────────────────────────────────────────
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFacturaFile(file);
      setFacturaPreview(URL.createObjectURL(file));
      setPhotoRotation(0);
      e.target.value = '';
    }
  };

  const getBakedFile = (file, degrees) => new Promise((resolve) => {
    if (!file || degrees === 0) { resolve(file); return; }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const rad  = (degrees * Math.PI) / 180;
      const swap = degrees === 90 || degrees === 270;
      const w = swap ? img.height : img.width;
      const h = swap ? img.width  : img.height;
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.translate(w / 2, h / 2);
      ctx.rotate(rad);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => resolve(new File([blob], file.name, { type: file.type })), file.type, 0.92);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!isFormValid) return;
    setIsSubmitting(true);

    let finalFacturaUrl = null;
    if (facturaFile) {
      const bakedFile = await getBakedFile(facturaFile, photoRotation);
      finalFacturaUrl = await uploadFactura(bakedFile);
    }

    let finalSupplierName = proveedor;
    let finalSupplierId   = selectedSupplierId;

    if (!finalSupplierId) {
      const existing = suppliers.find(s => s.name.toLowerCase() === finalSupplierName.toLowerCase());
      if (existing) {
        finalSupplierId   = existing.id;
        finalSupplierName = existing.name;
      } else {
        const newSup = addSupplier({ name: finalSupplierName, commonProducts: [descripcion] });
        finalSupplierId = newSup.id;
      }
    } else {
      learnProductForSupplier(finalSupplierId, descripcion);
    }

    await addExpense({
      fecha,
      descripcion,
      proveedor: finalSupplierName,
      supplierId: finalSupplierId,
      valor: numValor,
      facturaUrl: finalFacturaUrl,
      creado_por: user?.name || 'Desconocido',
    });

    setIsSubmitting(false);
    onClose();
  };

  // ── UI ──────────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#1e1f26] border border-gray-700/50 rounded-[32px] w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-red-950/20">
          <h2 className="text-2xl font-black text-red-500 flex items-center gap-2">
            <span>💸</span> Registrar Gasto (Egreso)
          </h2>
          <button className="text-gray-400 hover:text-white bg-[#16171d] p-2 rounded-full hover:bg-gray-800 transition-colors" onClick={onClose} disabled={isSubmitting}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5">

          {/* Fecha + Valor */}
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Fecha</label>
              <input type="date" className="w-full bg-[#0c0d11] border border-gray-800 focus:border-red-500 rounded-xl py-3 px-4 font-bold text-white outline-none"
                value={fecha} onChange={e => setFecha(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Valor ($)</label>
              <MoneyInput value={valor} onChange={setValor} placeholder="0"
                className="w-full bg-[#0c0d11] border-2 border-gray-700 focus:border-red-500 rounded-xl py-3 px-4 text-xl font-black text-white outline-none text-right" />
            </div>
          </div>

          {/* ── Motivo / Descripción con autocompletado ── */}
          <div className="relative" ref={descRef}>
            <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Motivo / Descripción</label>
            <textarea
              className="w-full bg-[#0c0d11] border border-gray-800 focus:border-red-500 rounded-xl py-3 px-4 font-bold text-white outline-none resize-none h-20"
              placeholder="Ej: Compra de papas y aceite..."
              value={descripcion}
              onChange={e => { setDescripcion(e.target.value); setShowDescSugg(true); setSelectedSupplierId(''); }}
              onFocus={() => setShowDescSugg(true)}
            />

            {/* Dropdown de productos */}
            {showDescSugg && descSuggestions.length > 0 && (
              <div className="absolute left-0 right-0 mt-1 bg-[#1a1b23] border border-gray-700 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
                <div className="px-3 py-1.5 text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-gray-800">
                  📦 Productos registrados
                </div>
                {descSuggestions.map((prod) => (
                  <button key={prod}
                    className="w-full text-left px-4 py-2.5 hover:bg-red-900/30 transition-colors border-b border-gray-800/50 last:border-0 flex items-center gap-2"
                    onMouseDown={() => selectDesc(prod)}
                  >
                    <span className="text-red-400 text-sm">🔖</span>
                    <span className="font-bold text-white text-sm capitalize">{prod}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Proveedor / Tercero con autocompletado filtrado ── */}
          <div className="relative" ref={provRef}>
            <label className="text-xs font-bold text-gray-400 uppercase flex justify-between items-center mb-1">
              <span>Proveedor / Tercero</span>
              {selectedSupplierId && <span className="text-green-500 text-[10px] bg-green-900/30 px-2 py-0.5 rounded-full">✓ Enlazado</span>}
            </label>
            <input
              type="text"
              className="w-full bg-[#0c0d11] border border-gray-800 focus:border-red-500 rounded-xl py-3 px-4 font-bold text-white outline-none"
              placeholder="Nombre del proveedor o tienda..."
              value={proveedor}
              onChange={e => { setProveedor(e.target.value); setSelectedSupplierId(''); setShowProvSugg(true); }}
              onFocus={() => setShowProvSugg(true)}
            />

            {/* Dropdown de proveedores filtrados */}
            {showProvSugg && provSuggestions.length > 0 && (
              <div className="absolute left-0 right-0 mt-1 bg-[#1a1b23] border border-gray-700 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
                <div className="px-3 py-1.5 text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-gray-800">
                  🏪 {descripcion.trim() ? `Proveedores de "${descripcion}"` : 'Proveedores'}
                </div>
                {provSuggestions.map((sup) => (
                  <button key={sup.id}
                    className="w-full text-left px-4 py-2.5 hover:bg-red-900/30 transition-colors border-b border-gray-800/50 last:border-0"
                    onMouseDown={() => selectSupplier(sup)}
                  >
                    <span className="font-black text-white text-sm block">{sup.name}</span>
                    {sup.commonProducts?.length > 0 && (
                      <span className="text-[10px] font-bold text-gray-500 truncate block">
                        Vende: {sup.commonProducts.slice(0, 4).join(', ')}
                      </span>
                    )}
                  </button>
                ))}
                {!selectedSupplierId && proveedor.trim().length > 0 && !provSuggestions.some(s => s.name.toLowerCase() === proveedor.toLowerCase()) && (
                  <div className="px-4 py-2 border-t border-gray-800">
                    <p className="text-[10px] text-gray-500 font-bold flex items-center gap-1">
                      <span>✨</span> Se creará: "<span className="text-white">{proveedor}</span>"
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Foto de factura ── */}
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase block mb-2 text-center">Factura (Foto Opcional)</label>

            <input type="file" accept="image/*" capture="environment" className="hidden" ref={cameraInputRef} onChange={handleFileChange} />
            <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileChange} />

            {facturaPreview && (
              <div className="relative mb-3 rounded-xl overflow-hidden border border-green-500/30">
                <img src={facturaPreview} alt="Factura"
                  style={{ transform: `rotate(${photoRotation}deg)`, transition: 'transform 0.2s' }}
                  className="w-full h-40 object-contain bg-black/40" />
                <div className="absolute top-2 left-2 flex gap-1.5">
                  <button type="button" onClick={() => setPhotoRotation(r => (r - 90 + 360) % 360)}
                    className="bg-black/70 text-white rounded-full w-8 h-8 flex items-center justify-center text-base hover:bg-blue-600 transition-colors">↺</button>
                  <button type="button" onClick={() => setPhotoRotation(r => (r + 90) % 360)}
                    className="bg-black/70 text-white rounded-full w-8 h-8 flex items-center justify-center text-base hover:bg-blue-600 transition-colors">↻</button>
                </div>
                <button className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1.5 hover:bg-red-600 transition-colors"
                  onClick={() => { setFacturaFile(null); setFacturaPreview(''); setPhotoRotation(0); }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
                <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-3 py-1.5">
                  <p className="text-xs text-green-400 font-bold">✓ Foto lista{photoRotation !== 0 ? ` · ${photoRotation}°` : ''}</p>
                </div>
              </div>
            )}

            {!facturaPreview && (
              <div className="grid grid-cols-2 gap-3">
                <button type="button"
                  className="py-4 rounded-xl border-2 border-dashed border-gray-700 hover:border-blue-500 hover:bg-blue-500/5 flex flex-col items-center gap-2 text-gray-500 hover:text-blue-400 transition-colors"
                  onClick={() => cameraInputRef.current?.click()}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
                  <span className="font-bold text-xs">Tomar Foto</span>
                </button>
                <button type="button"
                  className="py-4 rounded-xl border-2 border-dashed border-gray-700 hover:border-purple-500 hover:bg-purple-500/5 flex flex-col items-center gap-2 text-gray-500 hover:text-purple-400 transition-colors"
                  onClick={() => fileInputRef.current?.click()}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  <span className="font-bold text-xs">Desde Galería</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-[#16171d] border-t border-gray-800">
          <Button
            className="w-full rounded-[20px] py-4 font-black text-lg bg-red-600 hover:bg-red-500 text-white shadow-[0_4px_14px_0_rgba(220,38,38,0.39)] disabled:opacity-50 disabled:grayscale transition-all"
            disabled={!isFormValid || isSubmitting}
            onClick={handleSubmit}
          >
            {isSubmitting ? 'Guardando...' : 'Registrar Gasto'}
          </Button>
        </div>
      </div>
    </div>
  );
}
