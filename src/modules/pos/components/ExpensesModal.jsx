import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useFinanceStore } from '../../../store/useFinanceStore';
import { useSupplierStore } from '../../../store/useSupplierStore';
import { Button } from '../../../components/ui/Button';

export function ExpensesModal({ onClose }) {
  const { addExpense } = useFinanceStore();
  const { suppliers, addSupplier, learnProductForSupplier, suggestSuppliersForProduct } = useSupplierStore();
  const fileInputRef = useRef(null);
  
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]); // YYYY-MM-DD
  const [descripcion, setDescripcion] = useState('');
  const [proveedor, setProveedor] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  const [valor, setValor] = useState('');
  const [facturaUrl, setFacturaUrl] = useState(''); // Text for now or object URL if local preview
  const [isSubmitting, setIsSubmitting] = useState(false);

  const numValor = parseFloat(valor) || 0;
  const isFormValid = descripcion.trim() !== '' && (proveedor.trim() !== '' || selectedSupplierId !== '') && numValor > 0;

  // Derive suggestions dynamically when description changes
  const suggestedSuppliers = useMemo(() => {
    return suggestSuppliersForProduct(descripcion);
  }, [descripcion, suggestSuppliersForProduct]);

  // Handle picking a suggestion
  const selectSupplier = (supplier) => {
    setProveedor(supplier.name);
    setSelectedSupplierId(supplier.id);
    setShowSuggestions(false);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // In a real app with Storage, you'd upload this file first.
      // For now, we just create a local preview URL or store the file name.
      setFacturaUrl(file.name);
    }
  };

  const handleSubmit = async () => {
    if (!isFormValid) return;
    setIsSubmitting(true);
    
    // Simulating upload delay if there is a file
    if (facturaUrl) await new Promise(r => setTimeout(r, 600));

    // Handle Supplier logic:
    // If they typed a name but didn't pick an ID, create or find it.
    let finalSupplierName = proveedor;
    let finalSupplierId = selectedSupplierId;

    if (!finalSupplierId) {
      // Check if it already exists by exact name
      const existing = suppliers.find(s => s.name.toLowerCase() === finalSupplierName.toLowerCase());
      if (existing) {
        finalSupplierId = existing.id;
        finalSupplierName = existing.name;
      } else {
        // Create new
        const newSup = addSupplier({ name: finalSupplierName, commonProducts: [descripcion] });
        finalSupplierId = newSup.id;
      }
    } else {
      // If they picked an existing one, teach it that it also sells this new description
      learnProductForSupplier(finalSupplierId, descripcion);
    }

    await addExpense({
      fecha,
      descripcion,
      proveedor: finalSupplierName, // Save text for backward compatibility
      supplierId: finalSupplierId,  // Link to DB
      valor: numValor,
      facturaUrl,
      created_at: new Date().toISOString()
    });
    
    setIsSubmitting(false);
    onClose();
  };

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

        {/* Dynamic Body */}
        <div className="p-6 overflow-y-auto space-y-5">
           
           <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Fecha</label>
                <input 
                  type="date" 
                  className="w-full bg-[#0c0d11] border border-gray-800 focus:border-red-500 rounded-xl py-3 px-4 font-bold text-white outline-none" 
                  value={fecha} 
                  onChange={e => setFecha(e.target.value)} 
                />
             </div>
             <div>
                <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Valor ($)</label>
                <input 
                  type="number" 
                  className="w-full bg-[#0c0d11] border-2 border-gray-700 focus:border-red-500 rounded-xl py-3 px-4 text-xl font-black text-white outline-none text-right" 
                  placeholder="0" 
                  value={valor} 
                  onChange={e => setValor(e.target.value)} 
                />
             </div>
           </div>

           <div className="relative z-10">
              <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Motivo / Descripción</label>
              <textarea 
                className="w-full bg-[#0c0d11] border border-gray-800 focus:border-red-500 rounded-xl py-3 px-4 font-bold text-white outline-none resize-none h-24" 
                placeholder="Ej: Compra de papas y aceite..." 
                value={descripcion} 
                onChange={e => {
                  setDescripcion(e.target.value);
                  if (e.target.value.length > 2) setShowSuggestions(true);
                }} 
              />
              
              {/* Sugerencias de proveedores */}
              {showSuggestions && suggestedSuppliers.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 border border-gray-100 z-50">
                  <div className="bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 border-b border-amber-100 flex items-center gap-1">
                    <span>💡</span> Proveedores sugeridos para "{descripcion}"
                  </div>
                  {suggestedSuppliers.map(sup => (
                    <button
                      key={sup.id}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-0 transition-colors"
                      onClick={() => selectSupplier(sup)}
                    >
                      <span className="font-black text-chunky-dark text-sm block">{sup.name}</span>
                      <span className="text-xs font-bold text-gray-400 mt-0.5 block truncate">Suele vender: {sup.commonProducts?.join(', ')}</span>
                    </button>
                  ))}
                </div>
              )}
           </div>

           <div>
              <label className="text-xs font-bold text-gray-400 uppercase flex justify-between items-center mb-1">
                <span>Proveedor / Tercero</span>
                {selectedSupplierId && <span className="text-green-500 text-[10px] bg-green-900/30 px-2 py-0.5 rounded-full">✓ Enlazado a BDD</span>}
              </label>
              <input 
                type="text" 
                className="w-full bg-[#0c0d11] border border-gray-800 focus:border-red-500 rounded-xl py-3 px-4 font-bold text-white outline-none" 
                placeholder="Nombre del proveedor o tienda..." 
                value={proveedor} 
                onChange={e => {
                  setProveedor(e.target.value);
                  setSelectedSupplierId(''); // User is typing custom, break link
                }} 
              />
               {!selectedSupplierId && proveedor.trim().length > 0 && (
                <p className="text-[10px] text-gray-500 font-bold mt-2 ml-1 flex items-center gap-1">
                  <span>✨</span> Se creará un nuevo proveedor: "{proveedor}"
                </p>
              )}
           </div>

           <div>
              <label className="text-xs font-bold text-gray-400 uppercase block mb-1 text-center">Factura (Foto Opcional)</label>
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                ref={fileInputRef} 
                onChange={handleFileChange}
              />
              <button 
                className={`w-full py-4 rounded-xl border-2 border-dashed flex flex-col items-center gap-2 transition-colors ${facturaUrl ? 'border-green-500/50 bg-green-500/5 text-green-400' : 'border-gray-700 hover:border-gray-500 hover:bg-gray-800 text-gray-500'}`}
                onClick={() => fileInputRef.current?.click()}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                <span className="font-bold text-sm">
                  {facturaUrl ? `Archivo subido: ${facturaUrl}` : 'Toca para tomar foto o elegir factura'}
                </span>
              </button>
           </div>

        </div>

        {/* Footer Actions */}
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
