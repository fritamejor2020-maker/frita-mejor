import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import * as XLSX from 'xlsx';
import { Button } from '../../components/ui/Button';
import { toast } from 'react-hot-toast';
import { useAuthStore, ROLE_ACCESS } from '../../store/useAuthStore';
import { uploadProductImage } from '../../lib/storageUtils';
import { useInventoryStore, INITIAL_ITEM_TYPES } from '../../store/useInventoryStore';
import { parseDrawerCode } from '../../services/printerAgent';
import { useFinanceStore } from '../../store/useFinanceStore';
import { useLogisticsStore } from '../../store/useLogisticsStore';
import { usePayrollStore } from '../../store/usePayrollStore';
import { useVendorTransferStore } from '../../store/useVendorTransferStore';
import { AdminFinancesTab, AdminIncomesTab, AdminExpensesTab, ResumenOperativoTab } from '../../components/admin/AdminFinancesTab';
import { AdminIncomesExpensesTab } from '../../components/admin/AdminIncomesExpensesTab';
import { AdminPricesTab } from '../../components/admin/AdminPricesTab';
import { AdminChatAuditTab } from '../../components/admin/AdminChatAuditTab';
import { AdminUsersTab } from '../../components/admin/AdminUsersTab';
import { AdminVehiclesTab } from '../../components/admin/AdminVehiclesTab';
import { AdminSuppliersTab } from '../../components/admin/AdminSuppliersTab';
import { ResetGeneralPanel } from '../../components/admin/ResetGeneralPanel';
import { AdminIncomeSourcesTab } from '../../components/admin/AdminIncomeSourcesTab';
import { GlobalSettingsPanel } from '../../components/admin/GlobalSettingsPanel';
import { PermissionsPanel } from '../../components/admin/PermissionsPanel';

import { AdminContratasTab } from '../../components/admin/AdminContratasTab';
import { AdminTicketConfigTab } from '../../components/admin/AdminTicketConfigTab';
import { AdminVehicleInventoryTab } from '../../components/admin/AdminVehicleInventoryTab';
import { OlaClickConfigPanel } from './components/OlaClickConfigPanel';
import { LuckyRewardsConfigPanel } from './components/LuckyRewardsConfigPanel';
import { AdminTasksConfigPanel } from './components/AdminTasksConfigPanel';
import { AdminTerminalsTab } from './AdminTerminalsTab';
import { AdminEmployeeBiometricsModal } from './AdminEmployeeBiometricsModal';
import { formatMoney } from '../../utils/formatUtils';
import { AdminGeofencesTab } from './AdminGeofencesTab';

// ─── Componente de fila editable genérica ─────────────────────────────────────
// ─── Componente para subida de imagen inline ──────────────────────────────────
const compressImage = (file, maxWidth = 800, maxHeight = 800, quality = 0.75) => {
  return new Promise((resolve) => {
    if (!file || !file.type.startsWith('image/')) {
      resolve(file);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          } else {
            resolve(file);
          }
        }, 'image/jpeg', quality);
      };
      img.onerror = () => resolve(file);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
};

function ImageUploadField({ value, onChange, onAutoSave, label }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(value || '');
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => { setPreview(value || ''); }, [value]);

  const handleFile = async (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    setUploading(true);
    try {
      const compressedFile = await compressImage(file);
      const localUrl = URL.createObjectURL(compressedFile);
      setPreview(localUrl);
      
      const publicUrl = await uploadProductImage(compressedFile);
      const finalUrl = publicUrl || localUrl;
      onChange(finalUrl);
      setPreview(finalUrl);
      if (onAutoSave) onAutoSave(finalUrl);
    } catch (err) {
      console.warn('[Upload] Error compressing/uploading image, falling back to original:', err);
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target.result;
        onChange(dataUrl);
        setPreview(dataUrl);
        if (onAutoSave) onAutoSave(dataUrl);
      };
      reader.readAsDataURL(file);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
  };

  const removeImage = () => {
    onChange('');
    setPreview('');
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="shrink-0">
      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">{label}</label>
      {preview ? (
        <div className="relative group w-16 h-16">
          <div className="w-16 h-16 rounded-xl overflow-hidden border-2 border-green-200 bg-gray-50">
            <img src={preview} alt="Preview" className="w-full h-full object-cover" onError={() => setPreview('')} />
          </div>
          {uploading && (
            <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          <button type="button" onClick={removeImage}
            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-[10px] font-black flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
          >✕</button>
          <button type="button" onClick={() => fileRef.current?.click()}
            className="absolute inset-0 bg-black/0 hover:bg-black/30 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
          </button>
        </div>
      ) : (
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`w-16 h-16 border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all ${
            dragOver ? 'border-chunky-main bg-yellow-50 scale-105' : 'border-gray-200 bg-white hover:border-chunky-main hover:bg-yellow-50/30'
          }`}
        >
          {uploading ? (
            <div className="w-5 h-5 border-2 border-chunky-main border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-300">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              <span className="text-[8px] font-bold text-gray-400 mt-0.5">Foto</span>
            </>
          )}
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
    </div>
  );
}

function EditableRow({ fields, values, onChange, onSave, onCancel, onImageAutoSave }) {
  const regularFields = fields.filter((f) => f.type !== 'image');
  const imageFields = fields.filter((f) => f.type === 'image');

  return (
    <div className="border-2 border-chunky-main rounded-2xl p-4 bg-yellow-50/30 space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        {regularFields.map((f) => (
          <div key={f.key} className={`${f.wide ? 'flex-1 min-w-[180px]' : 'w-28'}`}>
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">{f.label}</label>
            {f.options ? (
              <select 
                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-chunky-main" 
                value={values[f.key] !== undefined && values[f.key] !== null ? String(values[f.key]) : ''} 
                onChange={(e) => onChange(f.key, e.target.value)}
              >
                {f.options.map((o) => {
                  const optVal = typeof o === 'object' && o !== null ? String(o.value) : String(o);
                  const optLbl = typeof o === 'object' && o !== null ? o.label : o;
                  return <option key={optVal} value={optVal}>{optLbl}</option>;
                })}
              </select>
            ) : (
              <input type={f.type ?? 'text'} className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-chunky-main" value={values[f.key] ?? ''} onChange={(e) => onChange(f.key, e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') onSave(); }} />
            )}
          </div>
        ))}
      </div>
      <div className="flex items-end gap-3">
        {imageFields.map((f) => (
          <ImageUploadField 
            key={f.key} 
            value={values[f.key] ?? ''} 
            onChange={(v) => onChange(f.key, v)} 
            onAutoSave={(v) => {
              onChange(f.key, v);
              if (onImageAutoSave) onImageAutoSave(v);
            }}
            label={f.label} 
          />
        ))}
        <div className="flex gap-2 ml-auto">
          <Button variant="secondary" className="rounded-full text-sm py-2 px-6 shadow-md font-black" onClick={onSave}>💾 Guardar Cambios</Button>
          <Button variant="outline" className="rounded-full text-sm py-2 px-4 border-gray-200 text-gray-500 font-bold" onClick={onCancel}>Cancelar</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Panel: Bodegas ────────────────────────────────────────────────────────────
function WarehousesPanel() {
  const { warehouses, inventory, addWarehouse, updateWarehouse, deleteWarehouse } = useInventoryStore();
  const [editId, setEditId] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', location: '' });

  const fields = [
    { key: 'name',     label: 'Nombre',     wide: true },
    { key: 'location', label: 'Ubicación',  wide: true },
  ];

  const change = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-black text-chunky-dark text-lg">Bodegas ({warehouses.length})</h3>
        <Button variant="secondary" className="rounded-full text-sm py-2 px-5 shadow-sm" onClick={() => { setShowAdd(true); setEditId(null); setForm({ name: '', location: '' }); }}>
          + Nueva Bodega
        </Button>
      </div>

      {showAdd && (
        <div className="mb-4">
          <EditableRow fields={fields} values={form} onChange={change}
            onSave={() => { addWarehouse(form); setShowAdd(false); }}
            onCancel={() => setShowAdd(false)} />
        </div>
      )}

      <div className="space-y-3">
        {warehouses.map((w) => {
          const itemCount = inventory.filter((i) => i.warehouseId === w.id).length;
          const lowCount  = inventory.filter((i) => i.warehouseId === w.id && i.qty <= i.alert).length;
          return editId === w.id ? (
            <div key={w.id}>
              <EditableRow fields={fields} values={form} onChange={change}
                onSave={() => { updateWarehouse(w.id, form); setEditId(null); }}
                onCancel={() => setEditId(null)} />
            </div>
          ) : (
            <div key={w.id} className="border border-gray-100 rounded-2xl p-4 flex flex-wrap items-center gap-4 hover:border-gray-200 transition-colors">
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-xl border border-blue-100 shrink-0">📦</div>
              <div className="flex-1 min-w-[140px]">
                <span className="font-black text-chunky-dark block">{w.name}</span>
                <span className="text-gray-400 font-bold text-xs">{w.location}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-xs font-bold bg-gray-50 text-gray-400 px-2 py-1 rounded-full">{itemCount} ítems</span>
                {lowCount > 0 && <span className="text-xs font-bold bg-red-50 text-red-400 px-2 py-1 rounded-full">⚠️ {lowCount} bajo</span>}
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${w.active ? 'bg-green-50 text-green-500' : 'bg-gray-50 text-gray-400'}`}>{w.active ? 'Activa' : 'Inactiva'}</span>
              </div>
              <div className="flex gap-2 ml-auto">
                <button className="text-gray-300 hover:text-chunky-main" onClick={() => { setEditId(w.id); setForm({ name: w.name, location: w.location }); setShowAdd(false); }} title="Editar">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                </button>
                <button
                  className={`text-gray-300 transition-colors ${w.active ? 'hover:text-orange-400' : 'hover:text-green-500'}`}
                  onClick={() => updateWarehouse(w.id, { active: !w.active })}
                  title={w.active ? 'Desactivar bodega' : 'Activar bodega'}
                >
                  {w.active ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  )}
                </button>
                <button className="text-gray-300 hover:text-red-400" onClick={() => deleteWarehouse(w.id)} title="Eliminar">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="m19 6-.867 14.142A2 2 0 0 1 16.138 22H7.862a2 2 0 0 1-1.995-1.858L5 6m5 0V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2"/></svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Panel: Puntos de Producción ───────────────────────────────────────────────
function ProductionPointsPanel() {
  const { productionPoints, products, recipes, inventory, addProductionPoint, updateProductionPoint, deleteProductionPoint, updateProduct, addProduct } = useInventoryStore();
  const [editId, setEditId] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', location: '' });
  const [editingPresetsKey, setEditingPresetsKey] = useState(null);
  const [draftPresets, setDraftPresets] = useState([]);

  const fields = [
    { key: 'name',     label: 'Nombre',     wide: true },
    { key: 'location', label: 'Sala/Área',  wide: true },
  ];
  const change = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const startEditPresets = (prod, ppId) => {
    setEditingPresetsKey(`${prod.id}_${ppId}`);
    setDraftPresets([...(prod.linePresets?.[ppId] ?? [1, 2, 5, 10, 20])]);
  };

  const saveEditPresets = (prod, ppId) => {
    const parsed = draftPresets.map((v) => parseFloat(v)).filter((v) => !isNaN(v) && v > 0);
    const final = parsed.slice(0, 5);
    while (final.length < 5) final.push(final[final.length - 1] ?? 1);
    
    const current = prod.linePresets ? { ...prod.linePresets } : {};
    current[ppId] = final;
    updateProduct(prod.id, { linePresets: current });
    setEditingPresetsKey(null);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-black text-chunky-dark text-lg">Puntos de Producción ({productionPoints.length})</h3>
        <Button variant="secondary" className="rounded-full text-sm py-2 px-5 shadow-sm" onClick={() => { setShowAdd(true); setEditId(null); setForm({ name: '', location: '' }); }}>
          + Nuevo Punto
        </Button>
      </div>

      {showAdd && (
        <div className="mb-4">
          <EditableRow fields={fields} values={form} onChange={change}
            onSave={() => { addProductionPoint(form); setShowAdd(false); }}
            onCancel={() => setShowAdd(false)} />
        </div>
      )}

      <div className="space-y-4">
        {productionPoints.map((pp) => {
          const assigned = products.filter((p) => p.productionPointIds?.includes(pp.id));
          return editId === pp.id ? (
            <div key={pp.id}>
              <EditableRow fields={fields} values={form} onChange={change}
                onSave={() => { updateProductionPoint(pp.id, form); setEditId(null); }}
                onCancel={() => setEditId(null)} />
            </div>
          ) : (
            <div key={pp.id} className="border border-gray-100 rounded-2xl p-5 hover:border-gray-200 transition-colors bg-white shadow-sm">
              <div className="flex flex-wrap items-center gap-4">
                <div className="w-10 h-10 bg-yellow-50 rounded-xl flex items-center justify-center text-xl border border-yellow-100 shrink-0">🏭</div>
                <div className="flex-1 min-w-[140px]">
                  <span className="font-black text-chunky-dark text-lg block">{pp.name}</span>
                  <span className="text-gray-400 font-bold text-xs">{pp.location}</span>
                </div>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${pp.active ? 'bg-green-50 text-green-600 font-black' : 'bg-gray-50 text-gray-400'}`}>{pp.active ? 'Activo' : 'Inactivo'}</span>
                <div className="flex gap-2 ml-auto">
                  <button className="text-gray-300 hover:text-chunky-main" onClick={() => { setEditId(pp.id); setForm({ name: pp.name, location: pp.location }); setShowAdd(false); }} title="Editar">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                  </button>
                  <button
                    className={`text-gray-300 transition-colors ${pp.active ? 'hover:text-orange-400' : 'hover:text-green-500'}`}
                    onClick={() => updateProductionPoint(pp.id, { active: !pp.active })}
                    title={pp.active ? 'Desactivar línea' : 'Activar línea'}
                  >
                    {pp.active ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    )}
                  </button>
                  <button className="text-gray-300 hover:text-red-400" onClick={() => deleteProductionPoint(pp.id)} title="Eliminar">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="m19 6-.867 14.142A2 2 0 0 1 16.138 22H7.862a2 2 0 0 1-1.995-1.858L5 6m5 0V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2"/></svg>
                  </button>
                </div>
              </div>

              {/* Productos asignados + Botones editables por línea */}
              <div className="mt-4 pt-3 border-t border-gray-100">
                <p className="text-xs font-bold text-gray-400 mb-2">Productos y Botones Rápida Producción en esta Línea:</p>
                
                {assigned.length > 0 ? (
                  <div className="space-y-2 mb-3">
                    {assigned.map((prod) => {
                      const isEditing = editingPresetsKey === `${prod.id}_${pp.id}`;
                      const presets = prod.linePresets?.[pp.id] ?? [1, 2, 5, 10, 20];
                      const recipe = recipes.find(r => r.id === prod.recipeId);
                      const unit = recipe?.yieldUnit ?? prod.unit;

                      return (
                        <div key={prod.id} className="bg-yellow-50/50 border border-yellow-100 rounded-xl p-3 flex flex-col gap-2">
                          <div className="flex justify-between items-center">
                            <span className="font-black text-sm text-chunky-dark flex items-center gap-1.5">
                              📦 {prod.name}
                            </span>
                            <div className="flex items-center gap-2">
                              {!isEditing ? (
                                <button
                                  className="text-xs font-bold text-chunky-dark hover:text-black bg-yellow-200/60 hover:bg-yellow-300 px-2.5 py-0.5 rounded-full flex items-center gap-1 transition-colors"
                                  onClick={() => startEditPresets(prod, pp.id)}
                                >
                                  ✏️ Botones
                                </button>
                              ) : (
                                <div className="flex gap-1.5">
                                  <button className="text-xs font-bold text-green-700 bg-green-100 hover:bg-green-200 px-3 py-0.5 rounded-full" onClick={() => saveEditPresets(prod, pp.id)}>Guardar</button>
                                  <button className="text-xs font-bold text-gray-500 bg-white border border-gray-200 px-2.5 py-0.5 rounded-full" onClick={() => setEditingPresetsKey(null)}>Cancelar</button>
                                </div>
                              )}
                              <button className="text-gray-300 hover:text-red-500 text-xs font-bold ml-1" onClick={() => updateProduct(prod.id, { productionPointIds: prod.productionPointIds.filter(id => id !== pp.id) })}>✕ Desvincular</button>
                            </div>
                          </div>

                          {/* Grid de 5 botones */}
                          <div className="grid grid-cols-5 gap-1.5 mt-1">
                            {(isEditing ? draftPresets : presets).map((val, idx) => (
                              isEditing ? (
                                <input
                                  key={idx}
                                  type="number" min="0.1" step="0.5"
                                  className="w-full text-center font-black text-chunky-dark text-xs border-2 border-yellow-400 bg-white rounded-lg py-1 outline-none"
                                  value={draftPresets[idx]}
                                  onChange={(e) => {
                                    const copy = [...draftPresets];
                                    copy[idx] = e.target.value;
                                    setDraftPresets(copy);
                                  }}
                                />
                              ) : (
                                <div key={idx} className="bg-white border border-yellow-200 rounded-lg py-1 text-center shadow-xs">
                                  <span className="font-black text-gray-800 text-xs">{val}</span>
                                  <span className="text-[9px] font-bold text-gray-400 ml-0.5">{unit}</span>
                                </div>
                              )
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic font-bold mb-3">No hay productos asignados a este punto de producción.</p>
                )}

                {/* Asignar un producto no asignado a este punto */}
                {(() => {
                  const availableProducts = products.filter((p) => !p.productionPointIds?.includes(pp.id));
                  const unlinkedInventory = inventory.filter(i => 
                    ['PRODUCTO', 'FRITO', 'CRUDO'].includes(i.type) && 
                    !products.some(p => p.outputInventoryId === i.id || p.name === i.name)
                  );
                  
                  if (availableProducts.length === 0 && unlinkedInventory.length === 0) return null;
                  
                  return (
                    <select
                      className="bg-gray-50 border border-gray-200 text-xs font-bold px-3.5 py-1.5 rounded-full text-gray-600 outline-none max-w-[220px]"
                      value=""
                      onChange={(e) => { 
                        if (e.target.value) {
                          const val = e.target.value;
                          if (val.startsWith('INV:')) {
                            const invId = val.replace('INV:', '');
                            const invItem = inventory.find(i => i.id === invId);
                            if (invItem) {
                              addProduct({
                                name: invItem.name,
                                recipeId: '',
                                unit: invItem.unit || 'kg',
                                outputInventoryId: invItem.id,
                                productionPointIds: [pp.id],
                                linePresets: {}
                              });
                            }
                          } else {
                            const pToUpdate = products.find(p => p.id === val);
                            updateProduct(val, { productionPointIds: [...(pToUpdate.productionPointIds || []), pp.id] }); 
                          }
                        }
                      }}
                    >
                      <option value="">+ Asignar producto a esta línea...</option>
                      {availableProducts.length > 0 && (
                        <optgroup label="Ya configurados (Botones)">
                          {availableProducts.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </optgroup>
                      )}
                      {unlinkedInventory.length > 0 && (
                        <optgroup label="Nuevos desde Inventario">
                          {unlinkedInventory.map((i) => (
                            <option key={`INV:${i.id}`} value={`INV:${i.id}`}>{i.name}</option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  );
                })()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Panel: Cocinas de Fritado (Unificado) ────────────────────────────────────
function FryKitchensPanel() {
  const { fryKitchens = [], fritadoRecipes = [], inventory = [], products = [], addFryKitchen, updateFryKitchen, deleteFryKitchen, addFritadoRecipe, updateFritadoRecipe, deleteFritadoRecipe } = useInventoryStore();
  const [editId, setEditId] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showAddRecipe, setShowAddRecipe] = useState(false);
  const [form, setForm] = useState({ name: '', location: '' });
  const [newRecipe, setNewRecipe] = useState({ crudoId: '', fritoId: '' });
  const [editingPresetsKey, setEditingPresetsKey] = useState(null);
  const [draftPresets, setDraftPresets] = useState([]);

  const fields = [
    { key: 'name',     label: 'Nombre de la Cocina', wide: true },
    { key: 'location', label: 'Ubicación/Zona',  wide: true },
  ];
  const change = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const startEditPresets = (recipe, fkId) => {
    setEditingPresetsKey(`${recipe.id}_${fkId}`);
    setDraftPresets([...(recipe.linePresets?.[fkId] ?? recipe.presets ?? [10, 20, 50, 100, 200])]);
  };

  const saveEditPresets = (recipe, fkId) => {
    const parsed = draftPresets.map((v) => parseFloat(v)).filter((v) => !isNaN(v) && v > 0);
    const final = parsed.slice(0, 5);
    while (final.length < 5) final.push(final[final.length - 1] ?? 10);

    const current = recipe.linePresets ? { ...recipe.linePresets } : {};
    current[fkId] = final;
    updateFritadoRecipe(recipe.id, { linePresets: current });
    setEditingPresetsKey(null);
  };

  const resolveItem = (id) => {
    if (!id) return null;
    const inv = inventory.find(i => i.id === id || i.name === id || i.barcode === id);
    if (inv) return inv;
    const prod = products.find(p => p.id === id || p.name === id || p.outputInventoryId === id);
    if (prod) return prod;
    return null;
  };

  const availableItemsForRecipe = inventory.filter(i => ['PRODUCTO', 'FRITO', 'CRUDO', 'INSUMO'].includes(i.type));

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
        <div>
          <h3 className="font-black text-chunky-dark text-lg">Cocinas y Recetas de Fritado</h3>
          <p className="text-sm font-bold text-gray-400">Administra cocinas de fritado, vincula masas crudas con fritos y personaliza los 5 botones rápidos por cocina.</p>
        </div>
        <div className="flex gap-2">
          <button className="bg-yellow-500 hover:bg-yellow-600 text-chunky-dark font-black py-2 px-5 rounded-full shadow-sm transition-colors text-sm" onClick={() => { setShowAddRecipe(!showAddRecipe); setShowAdd(false); }}>
            {showAddRecipe ? 'Cancelar' : '+ Nueva Receta Fritado'}
          </button>
          <button className="bg-chunky-dark hover:bg-black text-white font-black py-2 px-5 rounded-full shadow-sm transition-colors text-sm" onClick={() => { setShowAdd(!showAdd); setShowAddRecipe(false); setEditId(null); setForm({ name: '', location: '' }); }}>
            {showAdd ? 'Cancelar' : '+ Nueva Cocina'}
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="mb-6">
          <EditableRow fields={fields} values={form} onChange={change}
            onSave={() => { addFryKitchen(form); setShowAdd(false); }}
            onCancel={() => setShowAdd(false)} />
        </div>
      )}

      {showAddRecipe && (
        <div className="bg-yellow-50 rounded-2xl p-6 border-2 border-yellow-200 mb-6 flex flex-wrap gap-4 items-end animate-fade-in">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-bold text-gray-400 block mb-1">🧊 Producto Origen (Masa / Crudo Descontado)</label>
            <select className="w-full bg-white border-2 border-gray-200 rounded-xl px-3 py-2 font-bold text-chunky-dark outline-none focus:border-chunky-main" value={newRecipe.crudoId} onChange={(e) => setNewRecipe({...newRecipe, crudoId: e.target.value})}>
              <option value="">Seleccionar origen (crudo)...</option>
              {availableItemsForRecipe.map(i => <option key={i.id} value={i.id}>{i.name} ({i.type})</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-bold text-gray-400 block mb-1">🔥 Producto Destino (Frito Sumado)</label>
            <select className="w-full bg-white border-2 border-gray-200 rounded-xl px-3 py-2 font-bold text-chunky-dark outline-none focus:border-chunky-main" value={newRecipe.fritoId} onChange={(e) => setNewRecipe({...newRecipe, fritoId: e.target.value})}>
              <option value="">Seleccionar destino (frito)...</option>
              {availableItemsForRecipe.map(i => <option key={i.id} value={i.id}>{i.name} ({i.type})</option>)}
            </select>
          </div>
          <button className="bg-green-500 text-white font-black py-2 px-6 rounded-xl hover:bg-green-600 disabled:opacity-50 transition-colors w-full md:w-auto mt-2 md:mt-0" 
            disabled={!newRecipe.crudoId || !newRecipe.fritoId}
            onClick={() => {
              addFritadoRecipe({ ...newRecipe, presets: [10, 20, 50, 100, 200], fryKitchenIds: [] });
              setShowAddRecipe(false);
              setNewRecipe({ crudoId: '', fritoId: '' });
            }}>
            Guardar Receta
          </button>
        </div>
      )}

      {(fryKitchens || []).map((fk) => {
        const isEditing = editId === fk.id;
        const isAssignedToKitchen = (r) => {
          if (r.fryKitchenIds === undefined || r.fryKitchenIds === null) return true;
          return Array.isArray(r.fryKitchenIds) && r.fryKitchenIds.includes(fk.id);
        };
        const assignedRecipes = fritadoRecipes.filter(isAssignedToKitchen);
        const availableRecipes = fritadoRecipes.filter(r => !isAssignedToKitchen(r));

        return (
          <div key={fk.id} className="bg-white border border-gray-100 rounded-2xl p-5 mb-5 hover:border-gray-200 transition-colors shadow-sm">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
              <div className="flex-1">
                {isEditing ? (
                  <EditableRow fields={fields} values={form} onChange={change}
                    onSave={() => { updateFryKitchen(fk.id, form); setEditId(null); }}
                    onCancel={() => setEditId(null)} />
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <h4 className="font-black text-gray-800 text-lg">🍳 {fk.name}</h4>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${fk.active ? 'bg-green-100 text-green-700 font-black' : 'bg-gray-100 text-gray-500'}`}>
                        {fk.active ? 'ACTIVO' : 'INACTIVO'}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-gray-400 mt-1 flex items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                      {fk.location}
                    </p>
                  </>
                )}
              </div>
              {!isEditing && (
                <div className="flex items-center gap-2">
                  <button className="px-3 py-1.5 rounded-lg font-bold text-xs border border-gray-200 hover:border-chunky-main text-gray-500 hover:text-chunky-main transition-colors"
                    onClick={() => { setEditId(fk.id); setForm({ name: fk.name, location: fk.location }); }}>
                    Editar
                  </button>
                  <button className="px-3 py-1.5 rounded-lg font-bold text-xs bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors"
                    onClick={() => deleteFryKitchen(fk.id)}>
                    Eliminar
                  </button>
                </div>
              )}
            </div>

            {/* Recetas y Botones Editables por Cocina */}
            <div className="mt-4 pt-3 border-t border-gray-100">
              <p className="text-xs font-bold text-gray-400 mb-2">Recetas y Botones Rápida Fritado en esta Cocina:</p>

              {assignedRecipes.length > 0 ? (
                <div className="space-y-2.5 mb-3">
                  {assignedRecipes.map((recipe) => {
                    const crudo = resolveItem(recipe.crudoId);
                    const frito = resolveItem(recipe.fritoId);
                    const fritoName = frito?.name || recipe.fritoName || recipe.name || 'Empanadas Fritas';
                    const crudoName = crudo?.name || recipe.crudoName || 'Empanadas Crudas';
                    const isEditingPresets = editingPresetsKey === `${recipe.id}_${fk.id}`;
                    const presets = recipe.linePresets?.[fk.id] ?? recipe.presets ?? [10, 20, 50, 100, 200];

                    const handleUnlink = () => {
                      const allKitchenIds = fryKitchens.map(k => k.id);
                      const current = (recipe.fryKitchenIds && Array.isArray(recipe.fryKitchenIds))
                        ? recipe.fryKitchenIds
                        : allKitchenIds;
                      const updated = current.filter(id => id !== fk.id);
                      updateFritadoRecipe(recipe.id, { fryKitchenIds: updated });
                    };

                    const handleDeleteSystemRecipe = () => {
                      deleteFritadoRecipe(recipe.id);
                    };

                    return (
                      <div key={recipe.id} className="bg-orange-50/40 border border-orange-100 rounded-xl p-3 flex flex-col gap-2">
                        <div className="flex justify-between items-center">
                          <div>
                            <span className="font-black text-sm text-gray-800 flex items-center gap-1.5">
                              🍳 {fritoName}
                            </span>
                            <span className="text-[11px] font-bold text-gray-400 block">
                              Masa: {crudoName}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {!isEditingPresets ? (
                              <button
                                className="text-xs font-bold text-orange-800 hover:text-orange-900 bg-orange-200/60 hover:bg-orange-300 px-2.5 py-0.5 rounded-full flex items-center gap-1 transition-colors"
                                onClick={() => startEditPresets(recipe, fk.id)}
                              >
                                ✏️ Botones
                              </button>
                            ) : (
                              <div className="flex gap-1.5">
                                <button className="text-xs font-bold text-green-700 bg-green-100 hover:bg-green-200 px-3 py-0.5 rounded-full" onClick={() => saveEditPresets(recipe, fk.id)}>Guardar</button>
                                <button className="text-xs font-bold text-gray-500 bg-white border border-gray-200 px-2.5 py-0.5 rounded-full" onClick={() => setEditingPresetsKey(null)}>Cancelar</button>
                              </div>
                            )}

                            <button
                              className="text-xs font-bold text-orange-700 hover:text-red-600 bg-white border border-orange-200 hover:border-red-300 px-2.5 py-0.5 rounded-full transition-colors flex items-center gap-1"
                              onClick={handleUnlink}
                              title="Quitar receta de esta cocina"
                            >
                              ✕ Quitar
                            </button>

                            <button
                              className="text-xs font-bold text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2 py-0.5 rounded-full transition-colors flex items-center gap-1"
                              onClick={handleDeleteSystemRecipe}
                              title="Eliminar receta por completo del sistema"
                            >
                              🗑️ Borrar
                            </button>
                          </div>
                        </div>

                        {/* Grid de 5 botones rápidas de fritado */}
                        <div className="grid grid-cols-5 gap-1.5 mt-1">
                          {(isEditingPresets ? draftPresets : presets).map((val, idx) => (
                            isEditingPresets ? (
                              <input
                                key={idx}
                                type="number" min="1" step="1"
                                className="w-full text-center font-black text-gray-800 text-xs border-2 border-orange-400 bg-white rounded-lg py-1 outline-none"
                                value={draftPresets[idx]}
                                onChange={(e) => {
                                  const copy = [...draftPresets];
                                  copy[idx] = e.target.value;
                                  setDraftPresets(copy);
                                }}
                              />
                            ) : (
                              <div key={idx} className="bg-white border border-orange-200 rounded-lg py-1 text-center shadow-xs">
                                <span className="font-black text-gray-800 text-xs">{val}</span>
                                <span className="text-[9px] font-bold text-gray-400 ml-0.5">uds</span>
                              </div>
                            )
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic font-bold mb-3">No hay recetas de fritado asignadas a esta cocina.</p>
              )}

              {/* Selector de nueva receta de fritado */}
              {availableRecipes.length > 0 && (
                <select
                  className="bg-gray-50 border border-gray-200 text-xs font-bold px-3.5 py-1.5 rounded-full text-gray-600 outline-none max-w-[240px]"
                  value=""
                  onChange={(e) => {
                    if (!e.target.value) return;
                    const rToUpdate = fritadoRecipes.find(r => r.id === e.target.value);
                    if (rToUpdate) {
                      const updated = [...(rToUpdate.fryKitchenIds || []), fk.id];
                      updateFritadoRecipe(rToUpdate.id, { fryKitchenIds: updated });
                    }
                  }}
                >
                  <option value="">+ Asignar receta de fritado a esta cocina...</option>
                  {availableRecipes.map((r) => {
                    const frito = resolveItem(r.fritoId);
                    return (
                      <option key={r.id} value={r.id}>{frito?.name || r.id}</option>
                    );
                  })}
                </select>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Panel: Inventario General ────────────────────────────────────────────────
const parseCSV = (text) => {
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) return [];
  const headerLine = lines[0];
  const delimiter = headerLine.includes(';') ? ';' : ',';
  const headers = headerLine.split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));
  const result = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    let row = [];
    let insideQuote = false;
    let entry = '';
    for (let charIndex = 0; charIndex < line.length; charIndex++) {
      const char = line[charIndex];
      if (char === '"') {
        insideQuote = !insideQuote;
      } else if (char === delimiter && !insideQuote) {
        row.push(entry.trim().replace(/^"|"$/g, ''));
        entry = '';
      } else {
        entry += char;
      }
    }
    row.push(entry.trim().replace(/^"|"$/g, ''));
    if (row.length === headers.length) {
      const obj = {};
      headers.forEach((header, idx) => {
        obj[header] = row[idx];
      });
      result.push(obj);
    }
  }
  return result;
};

export function InventoryPanel({ branchId, onOpenItemTypes }) {
  const { inventory, warehouses, posCategories, itemTypes, addInventoryItem, updateInventoryItem, deleteInventoryItem, addPosCategory, setInventory } = useInventoryStore();
  
  const typeList = itemTypes && itemTypes.length > 0 ? itemTypes : INITIAL_ITEM_TYPES;
  const availableTypes = typeList.map(t => t.name);

  // Filtrar bodegas de esta sede
  const activeWhs = warehouses.filter(w => !branchId || w.branchId === branchId);
  const activeWhsIds = activeWhs.map(w => w.id);

  const [editingId, setEditingId] = useState(null);
  const [showAdd,   setShowAdd]   = useState(false);
  const [form,      setForm]      = useState({ 
    name: '', 
    qty: 0, 
    unit: 'kg', 
    type: 'PRODUCTO', 
    alert: 5, 
    warehouseId: activeWhs[0]?.id || '', 
    barcode: '', 
    price: 0, 
    posCategoryId: '', 
    imageUrl: '', 
    variablePrice: false, 
    referencePrice: 0 
  });

  // Auto-ajustar warehouseId seleccionado si cambia el branchId
  useEffect(() => {
    if (activeWhs.length > 0 && !activeWhsIds.includes(form.warehouseId)) {
      setForm(f => ({ ...f, warehouseId: activeWhs[0].id }));
    }
  }, [branchId, warehouses]);

  const [filterWh,  setFilterWh]  = useState('ALL');
  const [filterType, setFilterType] = useState('ALL');
  const [filterStock, setFilterStock] = useState('ALL');
  const [filterCat, setFilterCat] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('name_asc');

  const downloadTemplate = () => {
    // Columnas de la plantilla en inglés y español para conveniencia del usuario
    const templateData = [
      {
        "Nombre": "Ejemplo Empanada de Carne",
        "Codigo": "EMP001",
        "Cantidad": 50,
        "Precio": 1500,
        "Unidad": "unidades",
        "Categoria": "Empanadas"
      },
      {
        "Nombre": "Ejemplo Papa Rellena",
        "Codigo": "PAP002",
        "Cantidad": 30,
        "Precio": 2000,
        "Unidad": "unidades",
        "Categoria": "Fritos"
      },
      {
        "Nombre": "Ejemplo Coca-Cola 350ml",
        "Codigo": "7702090037784",
        "Cantidad": 100,
        "Precio": 3500,
        "Unidad": "unidades",
        "Categoria": "Bebidas"
      }
    ];

    // Crear libro de trabajo y hoja
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    
    // Ajustar anchos de columnas para que se vea premium y limpio
    const colWidths = [
      { wch: 30 }, // Nombre
      { wch: 15 }, // Codigo
      { wch: 10 }, // Cantidad
      { wch: 10 }, // Precio
      { wch: 12 }, // Unidad
      { wch: 15 }  // Categoria
    ];
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Inventario");

    // Descargar archivo Excel
    XLSX.writeFile(workbook, "plantilla_inventario.xlsx");
  };

  const processImportedRows = (rows) => {
    const newInventory = [...inventory];
    let currentCategories = [...posCategories];
    let updatedCount = 0;
    let createdCount = 0;

    rows.forEach((row, idx) => {
      // Soportar campos tanto en español como en inglés
      const name = row.Nombre || row.nombre || row.Name || row.name;
      if (!name) return;

      const groupName = row.Categoria || row.categoria || row.Grupo || row.grupo || row.ProductGroup || row.productGroup;
      let catId = '';
      if (groupName && groupName.trim() !== '' && groupName.trim() !== 'No Leido') {
        const trimmedGroup = groupName.trim();
        const existingCat = currentCategories.find(c => c.name.toLowerCase() === trimmedGroup.toLowerCase());
        if (existingCat) {
          catId = existingCat.id;
        } else {
          const newCatId = `CAT-${Date.now()}-${Math.floor(Math.random() * 1000)}-${idx}`;
          const newCat = { id: newCatId, name: trimmedGroup, icon: '📦', color: '#ffb700' };
          addPosCategory(newCat);
          currentCategories.push(newCat);
          catId = newCatId;
        }
      }

      let quantity = parseFloat(row.Cantidad || row.cantidad || row.Quantity || row.quantity) || 0;
      if (quantity < 0) quantity = 0;

      const rawType = row.Tipo || row.tipo || row.Type || row.type;
      let typeVal = rawType ? rawType.toUpperCase().trim() : '';
      if (!typeVal) {
        const lowerName = name.toLowerCase();
        if (lowerName.includes('empanada') || lowerName.includes('pastel') || lowerName.includes('maduro') || lowerName.includes('chorizo') || lowerName.includes('hamburguesa') || lowerName.includes('bofe') || lowerName.includes('rellena') || lowerName.includes('chicharrón') || lowerName.includes('hueso') || lowerName.includes('arepa de huevo') || lowerName.includes('azadura') || lowerName.includes('chunchulla') || lowerName.includes('picada')) {
          typeVal = 'FRITO';
        } else {
          typeVal = 'PRODUCTO';
        }
      }

      const barcode = row.Codigo || row.codigo || row.Barcode || row.barcode || row.SKU || row.sku || '';
      const price = parseFloat(row.Precio || row.precio || row.Price || row.price) || 0;
      const unit = row.Unidad || row.unidad || row.MeasurementUnit || row.measurementUnit || 'unidades';

      const existingIndex = newInventory.findIndex(i => 
        (barcode && i.barcode === barcode) || 
        (i.name.toLowerCase().trim() === name.toLowerCase().trim())
      );

      if (existingIndex !== -1) {
        newInventory[existingIndex] = {
          ...newInventory[existingIndex],
          price,
          barcode,
          qty: quantity || newInventory[existingIndex].qty,
          posCategoryId: catId || newInventory[existingIndex].posCategoryId,
          type: rawType ? typeVal : (newInventory[existingIndex].type || 'PRODUCTO')
        };
        updatedCount++;
      } else {
        const prefix = typeVal === 'FRITO' ? 'FR' : typeVal === 'PRODUCTO' ? 'PRD' : 'INS';
        const newId = `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000000)}-${idx}`;
        newInventory.push({
          id: newId,
          name,
          barcode,
          qty: quantity,
          unit,
          type: typeVal,
          estado,
          alert: 5,
          warehouseId: activeWhs[0]?.id || 'BOD-001',
          price,
          posCategoryId: catId,
          imageUrl: '',
          inTricycles: typeVal !== 'INSUMO'
        });
        createdCount++;
      }
    });

    // Guardar todos en lote (un solo viaje al store y sync remoto)
    setInventory(newInventory);

    alert(`¡Importación exitosa! Se crearon ${createdCount} productos nuevos y se actualizaron ${updatedCount} existentes.`);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    const isCsv = file.name.endsWith('.csv');

    if (!isExcel && !isCsv) {
      alert('Formato de archivo no soportado. Por favor sube un archivo CSV o Excel (.xlsx, .xls).');
      return;
    }

    const reader = new FileReader();

    if (isExcel) {
      reader.onload = (event) => {
        try {
          const data = event.target?.result;
          if (!data) return;

          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const rows = XLSX.utils.sheet_to_json(worksheet);
          
          if (rows.length === 0) {
            alert('El archivo Excel está vacío o no tiene el formato correcto.');
            return;
          }

          processImportedRows(rows);
        } catch (err) {
          console.error('Error al procesar el archivo Excel:', err);
          alert('Error al procesar el archivo Excel: ' + err.message);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      // Es CSV
      reader.onload = (event) => {
        try {
          const text = event.target?.result;
          if (typeof text !== 'string') return;
          
          const rows = parseCSV(text);
          if (rows.length === 0) {
            alert('El archivo CSV está vacío o no tiene el formato correcto.');
            return;
          }

          processImportedRows(rows);
        } catch (err) {
          console.error('Error al procesar el archivo CSV:', err);
          alert('Error al procesar el archivo CSV: ' + err.message);
        }
      };
      reader.readAsText(file, 'UTF-8');
    }

    e.target.value = '';
  };

  const fields = [
    { key: 'name',        label: 'Nombre',          wide: true },
    { key: 'barcode',     label: 'Cód. de Barras',   wide: false },
    { key: 'warehouseId', label: 'Bodega',   options: activeWhs.map((w) => ({ value: w.id, label: w.name })) },
    { key: 'type',       label: 'Tipo de Ítem', options: availableTypes },
    { key: 'qty',         label: 'Cantidad', type: 'number' },
    { key: 'unit',        label: 'Unidad',   options: ['kg', 'g', 'L', 'mL', 'm', 'unidades', 'piezas'] },
    { key: 'alert',       label: 'Alerta en',type: 'number' },
    { key: 'price',       label: 'Precio ($)',type: 'number' },
    { key: 'variablePrice', label: 'Precio Var.', options: [{ value: 'false', label: 'No' }, { value: 'true', label: 'Sí' }] },
    { key: 'referencePrice', label: 'Precio Ref. ($)', type: 'number' },
    { key: 'inTricycles', label: 'Triciclos/Dejador', options: [{ value: 'true', label: 'Sí' }, { value: 'false', label: 'No' }] },
    { key: 'posCategoryId', label: 'Carpetas POS', options: [{ value: '', label: 'Ninguna' }, ...(posCategories || []).map((c) => ({ value: c.id, label: c.name }))] },
    { key: 'imageUrl',    label: 'Imagen (POS)', type: 'image' },
  ];

  const change = (k, v) => {
    let val = v;
    if (k === 'variablePrice' || k === 'inTricycles') {
      val = v === 'true' || v === true;
    }
    setForm((f) => ({ ...f, [k]: val }));
  };

  // 1. Filtrar los productos
  let filtered = inventory || [];
  if (branchId) {
    filtered = filtered.filter(i => activeWhsIds.includes(i.warehouseId));
  }

  // Filtro de Bodega
  if (filterWh !== 'ALL') {
    filtered = filtered.filter(i => i.warehouseId === filterWh);
  }

  // Filtro de Búsqueda
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    filtered = filtered.filter(i => 
      i.name.toLowerCase().includes(q) || 
      (i.barcode && String(i.barcode).toLowerCase().includes(q)) ||
      String(i.id).toLowerCase().includes(q)
    );
  }

  // Filtro de Tipo
  if (filterType !== 'ALL') {
    filtered = filtered.filter(i => i.type === filterType);
  }

  // Filtro de Nivel de Stock
  if (filterStock === 'LOW') {
    filtered = filtered.filter(i => i.qty <= i.alert);
  } else if (filterStock === 'OUT') {
    filtered = filtered.filter(i => i.qty === 0);
  } else if (filterStock === 'IN') {
    filtered = filtered.filter(i => i.qty > 0);
  }

  // Filtro de Categoría POS
  if (filterCat !== 'ALL') {
    if (filterCat === 'NONE') {
      filtered = filtered.filter(i => !i.posCategoryId);
    } else {
      filtered = filtered.filter(i => i.posCategoryId === filterCat);
    }
  }

  // 2. Ordenar los productos
  const displayed = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case 'name_asc':
        return a.name.localeCompare(b.name);
      case 'name_desc':
        return b.name.localeCompare(a.name);
      case 'qty_desc':
        return b.qty - a.qty;
      case 'qty_asc':
        return a.qty - b.qty;
      case 'price_desc':
        return (b.price || 0) - (a.price || 0);
      case 'price_asc':
        return (a.price || 0) - (b.price || 0);
      case 'low_stock':
        const criticalA = a.qty - a.alert;
        const criticalB = b.qty - b.alert;
        return criticalA - criticalB; // Más críticos primero (ratio negativo)
      default:
        return 0;
    }
  });

  return (
    <div>
      {/* Encabezado Principal */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <h3 className="font-black text-chunky-dark text-lg">Inventario ({displayed.length} ítems)</h3>
        <div className="flex gap-2 flex-wrap">
          <button 
            onClick={downloadTemplate}
            className="bg-gradient-to-r from-amber-500 to-orange-600 text-white font-black text-xs py-2.5 px-5 rounded-full shadow-sm hover:opacity-90 transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
          >
            📄 Plantilla Excel
          </button>
          <label className="bg-gradient-to-r from-green-500 to-emerald-600 text-white font-black text-xs py-2.5 px-5 rounded-full shadow-sm hover:opacity-90 transition-all cursor-pointer flex items-center gap-1.5 active:scale-95">
            📥 Importar Excel / CSV
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>
          {onOpenItemTypes && (
            <button 
              onClick={onOpenItemTypes}
              className="bg-purple-50 hover:bg-purple-100 text-purple-700 font-black text-xs py-2.5 px-5 rounded-full border border-purple-200 transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
            >
              🏷️ Tipos de Ítem
            </button>
          )}
          <Button variant="secondary" className="rounded-full text-sm py-2 px-5 shadow-sm" onClick={() => { setShowAdd(true); setEditingId(null); setForm({ name: '', qty: 0, unit: 'kg', type: 'PRODUCTO', alert: 5, warehouseId: activeWhs[0]?.id || '', barcode: '', price: 0, posCategoryId: '', imageUrl: '', variablePrice: false, referencePrice: 0 }); }}>
            + Agregar ítem
          </Button>
        </div>
      </div>

      {/* Barra de Filtros, Búsqueda y Ordenación */}
      <div className="bg-gray-50 border border-gray-200 rounded-3xl p-5 mb-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Búsqueda */}
          <div className="relative">
            <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-gray-400">🔍</span>
            <input 
              type="text"
              placeholder="Buscar por nombre o código..."
              className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm font-bold outline-none focus:border-chunky-main transition-colors"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Filtrar por Bodega */}
          <div>
            <select 
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-700 outline-none focus:border-chunky-main transition-colors"
              value={filterWh} 
              onChange={(e) => setFilterWh(e.target.value)}
            >
              <option value="ALL">📍 Todas las Bodegas</option>
              {activeWhs.map((w) => <option key={w.id} value={w.id}>📦 {w.name}</option>)}
            </select>
          </div>

          {/* Ordenar por */}
          <div>
            <select 
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-700 outline-none focus:border-chunky-main transition-colors"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="name_asc">🔤 Nombre (A-Z)</option>
              <option value="name_desc">🔤 Nombre (Z-A)</option>
              <option value="qty_desc">📈 Stock (Mayor a Menor)</option>
              <option value="qty_asc">📉 Stock (Menor a Mayor)</option>
              <option value="price_desc">💰 Precio (Mayor a Menor)</option>
              <option value="price_asc">💰 Precio (Menor a Mayor)</option>
              <option value="low_stock">⚠️ Mayor Alerta de Stock</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-gray-200/60 pt-4">
          {/* Filtrar por Tipo */}
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider block mb-1">Tipo de Item</label>
            <select 
              className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-700 outline-none focus:border-chunky-main transition-colors"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="ALL">Todos los tipos</option>
              {typeList.map((t) => (
                <option key={t.id || t.name} value={t.name}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Filtrar por Estado de Stock */}
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider block mb-1">Nivel de Stock</label>
            <select 
              className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-700 outline-none focus:border-chunky-main transition-colors"
              value={filterStock}
              onChange={(e) => setFilterStock(e.target.value)}
            >
              <option value="ALL">Cualquier cantidad</option>
              <option value="LOW">⚠️ Alerta / Bajo Stock</option>
              <option value="OUT">🔴 Sin Stock (Agotado)</option>
              <option value="IN">🟢 Con Stock disponible</option>
            </select>
          </div>

          {/* Filtrar por Carpeta POS */}
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider block mb-1">Carpeta / Categoría POS</label>
            <select 
              className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-700 outline-none focus:border-chunky-main transition-colors"
              value={filterCat}
              onChange={(e) => setFilterCat(e.target.value)}
            >
              <option value="ALL">Todas las carpetas</option>
              <option value="NONE">Sin carpeta asignada</option>
              {(posCategories || []).map((c) => <option key={c.id} value={c.id}>📁 {c.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {showAdd && (
        <div className="mb-4">
          <EditableRow fields={fields} values={form} onChange={change}
            onSave={() => { if (form.name.trim()) { addInventoryItem({ ...form, qty: parseFloat(form.qty) || 0, alert: parseFloat(form.alert) || 0, price: parseFloat(form.price) || 0, type: form.type || 'PRODUCTO', variablePrice: form.variablePrice === 'true' || form.variablePrice === true, referencePrice: parseFloat(form.referencePrice) || 0, inTricycles: form.inTricycles === 'true' || form.inTricycles === true || form.inTricycles === undefined }); setShowAdd(false); } }}
            onCancel={() => setShowAdd(false)} />
        </div>
      )}

      <div className="space-y-2">
        {displayed.map((item) => {
          const wh = warehouses.find((w) => w.id === item.warehouseId);
          const itemTypeObj = typeList.find((t) => t.name === item.type);
          const badgeStyle = itemTypeObj?.color || 'bg-gray-100 text-gray-600 border border-gray-200';
          return editingId === item.id ? (
            <div key={item.id}>
              <EditableRow fields={fields} values={form} onChange={change}
                onImageAutoSave={(imgUrl) => {
                  updateInventoryItem(item.id, {
                    ...form,
                    imageUrl: imgUrl,
                    qty: parseFloat(form.qty) || 0,
                    alert: parseFloat(form.alert) || 0,
                    price: parseFloat(form.price) || 0,
                    type: form.type || 'PRODUCTO',
                    variablePrice: form.variablePrice === 'true' || form.variablePrice === true,
                    referencePrice: parseFloat(form.referencePrice) || 0,
                    inTricycles: form.inTricycles === 'true' || form.inTricycles === true || form.inTricycles === undefined
                  });
                }}
                onSave={() => {
                  updateInventoryItem(item.id, {
                    ...form,
                    qty: parseFloat(form.qty) || 0,
                    alert: parseFloat(form.alert) || 0,
                    price: parseFloat(form.price) || 0,
                    type: form.type || 'PRODUCTO',
                    variablePrice: form.variablePrice === 'true' || form.variablePrice === true,
                    referencePrice: parseFloat(form.referencePrice) || 0,
                    inTricycles: form.inTricycles === 'true' || form.inTricycles === true || form.inTricycles === undefined
                  });
                  toast.success('💾 Cambios guardados y sincronizados');
                  setEditingId(null);
                }}
                onCancel={() => setEditingId(null)} />
            </div>
          ) : (
            <div key={item.id} className="border border-gray-100 rounded-2xl p-4 flex flex-wrap items-center gap-3 hover:border-gray-200 transition-colors">
              <span className={`w-[90px] text-center text-[10px] font-black uppercase tracking-wider py-1.5 rounded-full shrink-0 ${badgeStyle}`}>{item.type}</span>
              <div className="flex-1 min-w-[100px]">
                <span className="font-black text-chunky-dark block truncate">{item.name}</span>
                {item.barcode && (
                  <span className="text-[11px] font-bold text-gray-300 flex items-center gap-1 mt-0.5">
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 5v14"/><path d="M8 5v14"/><path d="M12 5v14"/><path d="M17 5v14"/><path d="M21 5v14"/></svg>
                    {item.barcode}
                  </span>
                )}
                {item.variablePrice ? (
                  <span className="text-[11px] font-bold text-orange-500 mt-0.5 block flex items-center gap-1">
                    ⚙️ Precio Variable {item.referencePrice > 0 && `(Ref: ${formatMoney(item.referencePrice)})`}
                  </span>
                ) : (
                  item.price > 0 && <span className="text-[11px] font-bold text-green-500 mt-0.5 block">Precio: {formatMoney(item.price)}</span>
                )}
              </div>
              {wh && <span className="text-xs font-bold bg-gray-50 text-gray-400 px-2 py-0.5 rounded-full shrink-0">{wh.name}</span>}
              <span className={`font-black text-lg ${item.qty <= item.alert ? 'text-red-500' : 'text-chunky-dark'}`}>
                {item.qty}<span className="text-gray-400 font-bold text-xs ml-1">{item.unit}</span>
              </span>
              <div className="flex gap-2 ml-auto">
                <button className="text-gray-300 hover:text-chunky-main" onClick={() => { setEditingId(item.id); setForm({ name: item.name, qty: item.qty, unit: item.unit, type: item.type || 'PRODUCTO', alert: item.alert, warehouseId: item.warehouseId ?? '', barcode: item.barcode ?? '', price: item.price ?? 0, posCategoryId: item.posCategoryId ?? '', imageUrl: item.imageUrl ?? '', variablePrice: item.variablePrice ?? false, referencePrice: item.referencePrice ?? 0, inTricycles: item.inTricycles !== false }); setShowAdd(false); }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                </button>
                <button className="text-gray-300 hover:text-red-400" onClick={() => deleteInventoryItem(item.id)}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="m19 6-.867 14.142A2 2 0 0 1 16.138 22H7.862a2 2 0 0 1-1.995-1.858L5 6m5 0V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2"/></svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Panel: Recetas ────────────────────────────────────────────────────────────
function RecipesPanel() {
  const { recipes, inventory, addRecipe, updateRecipe, deleteRecipe } = useInventoryStore();
  const [editing, setEditing] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newRecipe, setNewRecipe] = useState({ name: '', yieldQty: 10, yieldUnit: 'kg', ingredients: [] });
  const [newIng, setNewIng] = useState({ inventoryId: '', qty: '', unit: 'kg' });

  const insumos = inventory.filter((i) => i.type === 'INSUMO');

  const addIngredient = (target, setTarget) => {
    if (!newIng.inventoryId || !newIng.qty) return;
    const item = insumos.find((i) => i.id === newIng.inventoryId);
    setTarget((r) => ({ ...r, ingredients: [...(r.ingredients || []), { inventoryId: newIng.inventoryId, name: item?.name ?? '', qty: parseFloat(newIng.qty), unit: newIng.unit }] }));
    setNewIng({ inventoryId: '', qty: '', unit: 'kg' });
  };

  const RecipeForm = ({ recipe, setRecipe, onSave, onCancel }) => (
    <div className="border-2 border-chunky-main rounded-2xl p-5 bg-yellow-50/30 space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[180px]">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Nombre</label>
          <input className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 font-bold outline-none focus:border-chunky-main" value={recipe.name} onChange={(e) => setRecipe((r) => ({ ...r, name: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') onSave(); }} />
        </div>
        <div className="w-24">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Rinde</label>
          <input type="number" className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 font-bold outline-none focus:border-chunky-main" value={recipe.yieldQty} onChange={(e) => setRecipe((r) => ({ ...r, yieldQty: parseFloat(e.target.value) }))} onKeyDown={(e) => { if (e.key === 'Enter') onSave(); }} />
        </div>
        <div className="w-24">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Unidad</label>
          <select className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 font-bold outline-none focus:border-chunky-main" value={recipe.yieldUnit} onChange={(e) => setRecipe((r) => ({ ...r, yieldUnit: e.target.value }))}>
            {['kg', 'g', 'L', 'unidades'].map((u) => <option key={u}>{u}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">Ingredientes</label>
        <div className="space-y-2 mb-3">
          {(recipe.ingredients || []).map((ing, idx) => (
            <div key={idx} className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-3 py-2">
              <span className="flex-1 font-bold text-sm text-chunky-dark">{ing.name}</span>
              <span className="font-black text-chunky-dark">{ing.qty} {ing.unit}</span>
              <button onClick={() => setRecipe((r) => ({ ...r, ingredients: r.ingredients.filter((_, i) => i !== idx) }))} className="text-gray-300 hover:text-red-400">✕</button>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 bg-white border border-gray-100 rounded-xl p-3">
          <select className="flex-1 min-w-[140px] bg-gray-50 border border-gray-100 rounded-lg px-2 py-1 text-sm font-bold outline-none" value={newIng.inventoryId} onChange={(e) => setNewIng((n) => ({ ...n, inventoryId: e.target.value }))}>
            <option value="">Seleccionar insumo...</option>
            {insumos.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
          <input type="number" placeholder="Qty" className="w-20 bg-gray-50 border border-gray-100 rounded-lg px-2 py-1 text-sm font-bold outline-none text-center" value={newIng.qty} onChange={(e) => setNewIng((n) => ({ ...n, qty: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') addIngredient(recipe, setRecipe); }} />
          <select className="w-20 bg-gray-50 border border-gray-100 rounded-lg px-2 py-1 text-sm font-bold outline-none" value={newIng.unit} onChange={(e) => setNewIng((n) => ({ ...n, unit: e.target.value }))}>
            {['kg', 'g', 'L', 'mL', 'm', 'unidades'].map((u) => <option key={u}>{u}</option>)}
          </select>
          <button className="bg-chunky-main text-white rounded-lg px-3 py-1 text-sm font-bold hover:bg-chunky-secondary transition-colors" onClick={() => addIngredient(recipe, setRecipe)}>+ Agregar</button>
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" className="rounded-full text-sm py-2 px-6" onClick={onSave}>Guardar</Button>
        <Button variant="outline" className="rounded-full text-sm py-2 px-4 border-gray-200 text-gray-500" onClick={onCancel}>Cancelar</Button>
      </div>
    </div>
  );

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-black text-chunky-dark text-lg">Recetas ({recipes.length})</h3>
        <Button variant="secondary" className="rounded-full text-sm py-2 px-5 shadow-sm" onClick={() => { setShowAdd(true); setEditing(null); setNewRecipe({ name: '', yieldQty: 10, yieldUnit: 'kg', ingredients: [] }); }}>
          + Nueva Receta
        </Button>
      </div>
      {showAdd && <div className="mb-4"><RecipeForm recipe={newRecipe} setRecipe={setNewRecipe} onSave={() => { addRecipe(newRecipe); setShowAdd(false); }} onCancel={() => setShowAdd(false)} /></div>}
      <div className="space-y-3">
        {recipes.map((recipe) => editing?.id === recipe.id ? (
          <div key={recipe.id}>
            <RecipeForm recipe={editing} setRecipe={setEditing} onSave={() => { updateRecipe(recipe.id, editing); setEditing(null); }} onCancel={() => setEditing(null)} />
          </div>
        ) : (
          <div key={recipe.id} className="border border-gray-100 rounded-2xl p-5 hover:border-gray-200 transition-colors">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h4 className="font-black text-lg text-chunky-dark">{recipe.name}</h4>
                <p className="text-sm font-bold text-gray-400">Rinde: {recipe.yieldQty} {recipe.yieldUnit} por lote</p>
              </div>
              <div className="flex gap-2">
                <button className="text-gray-300 hover:text-chunky-main" onClick={() => { setEditing({ ...recipe }); setShowAdd(false); }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                </button>
                <button className="text-gray-300 hover:text-red-400" onClick={() => deleteRecipe(recipe.id)}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="m19 6-.867 14.142A2 2 0 0 1 16.138 22H7.862a2 2 0 0 1-1.995-1.858L5 6m5 0V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2"/></svg>
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {recipe.ingredients.map((ing, idx) => (
                <span key={idx} className="bg-gray-50 border border-gray-100 text-gray-600 text-xs font-bold px-3 py-1 rounded-full">{ing.name}: {ing.qty} {ing.unit}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Modal Editar Movimiento ──────────────────────────────────────────────────
function EditMovementModal({ movement, onClose, onSave }) {
  const [qty, setQty] = useState(movement.qty ?? '');
  const [person, setPerson] = useState(movement.person || '');
  const [reason, setReason] = useState(movement.reason || '');

  const isQtyEditable = ['DESPACHO', 'RECEPCION', 'MERMA', 'TRANSFERENCIA', 'AJUSTE'].includes(movement.type) && movement.qty !== undefined;

  const handleSave = () => {
    const updates = { person, reason };
    if (isQtyEditable) {
      const parsedQty = parseFloat(qty);
      if (!isNaN(parsedQty) && parsedQty >= 0) {
        updates.qty = parsedQty;
      }
    }
    onSave(movement.id, updates);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-[32px] p-8 w-full max-w-sm shadow-2xl space-y-4" onClick={e => e.stopPropagation()}>
        <h2 className="text-2xl font-black text-chunky-dark mb-1">Editar Reporte</h2>
        <p className="text-gray-400 font-bold text-sm mb-5">Modifica los detalles del movimiento seleccionado.</p>
        
        {isQtyEditable && (
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Cantidad</label>
            <input type="number" step="0.5" min="0" className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-3 py-2 font-bold text-chunky-dark outline-none focus:border-chunky-main" value={qty} onChange={(e) => setQty(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }} />
          </div>
        )}

        <div>
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Persona</label>
          <input placeholder="Ej. Juan Pérez" className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-3 py-2 font-bold text-chunky-dark outline-none focus:border-chunky-main" value={person} onChange={(e) => setPerson(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }} />
        </div>

        <div>
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Razón / Uso</label>
          <textarea placeholder="Ej. Uso en restaurante..." rows={2} className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-3 py-2 font-bold text-chunky-dark outline-none focus:border-chunky-main resize-none" value={reason} onChange={(e) => setReason(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSave(); } }} />
        </div>

        <div className="flex gap-3 mt-6">
          <button className="flex-1 border-2 border-gray-200 text-gray-400 font-bold py-3 rounded-full hover:bg-gray-50 transition-colors" onClick={onClose}>Cancelar</button>
          <button className="flex-1 bg-chunky-secondary text-white font-black py-3 rounded-full hover:opacity-90 transition-opacity" onClick={handleSave}>Guardar</button>
        </div>
      </div>
    </div>
  );
}

// ─── Panel: Centro de Reportes Completo ──────────────────────────────────────
function ReportsPanel() {
  const {
    movements: rawMovements, inventory, warehouses, productionPoints, fryKitchens, products,
    posSales: rawPosSales, posShifts: rawPosShifts, posExpenses: rawPosExpenses,
    updateMovement
  } = useInventoryStore();

  // Defensive fallbacks for old localStorage data
  const movements   = rawMovements   || [];
  const posSales    = rawPosSales    || [];
  const posShifts   = rawPosShifts   || [];
  const posExpenses = rawPosExpenses || [];

  // External stores
  const finIncomes = useFinanceStore(s => s.incomes) || [];
  const finExpenses = useFinanceStore(s => s.expenses) || [];
  const payrollRecords   = usePayrollStore(s => s.payrollRecords);
  const payrollEmployees = usePayrollStore(s => s.payrollEmployees);
  const { updatePayrollRow, deletePayrollRecord } = usePayrollStore.getState();
  
  const logLoadHistory = useLogisticsStore(s => s.loadHistory) || [];
  const logCompleted = useLogisticsStore(s => s.completedRequests) || [];
  const vendorTransfers = useVendorTransferStore(s => s.transfers) || [];

  const [activeReport, setActiveReport] = useState('INVENTARIO');
  const [finSubtab, setFinSubtab] = useState('ingresos');
  const [selectedReportPhoto, setSelectedReportPhoto] = useState(null);
  const [selectedReportSale, setSelectedReportSale] = useState(null);

  // ─── Helpers ────────────────────────────────────────────────────
  const fmtMoney = (v) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v || 0);
  const fmtDate  = (d) => d ? new Date(d).toLocaleDateString('es-CO') : '—';
  const fmtTime  = (d) => d ? new Date(d).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '—';
  const fmtDateTime = (d) => d ? `${fmtDate(d)} ${fmtTime(d)}` : '—';

  const typeColors = { PRODUCCION: 'bg-green-50 text-green-600', RECEPCION: 'bg-blue-50 text-blue-500', DESPACHO: 'bg-orange-50 text-orange-500', MERMA: 'bg-red-50 text-red-500', TRANSFERENCIA: 'bg-purple-50 text-purple-500', AJUSTE: 'bg-teal-50 text-teal-600', FRITADO: 'bg-yellow-50 text-yellow-600' };
  const typeLabels = { PRODUCCION: '🏭 Producción', RECEPCION: '📥 Recepción', DESPACHO: '📤 Despacho', MERMA: '🗑️ Merma', TRANSFERENCIA: '🔄 Transferencia', AJUSTE: '⚖️ Ajuste', FRITADO: '🍳 Fritado' };

  // ─── KPI Card component ─────────────────────────────────────────
  const Kpi = ({ icon, label, value, sub, color = 'bg-gray-50' }) => (
    <div className={`${color} rounded-2xl p-4 flex items-center gap-3 border border-gray-100/50`}>
      <span className="text-2xl">{icon}</span>
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{label}</p>
        <p className="text-xl font-black text-chunky-dark leading-tight">{value}</p>
        {sub && <p className="text-[11px] font-bold text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );

  // ─── Excel Download Icon ────────────────────────────────────────
  const DownloadIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
  );

  // ─── Excel export helpers ───────────────────────────────────────
  const buildMovementsSheet = () => {
    return movements.map((mv) => {
      const item = inventory.find((i) => i.id === mv.inventoryId);
      const product = products.find((p) => p.id === mv.productId);
      const wh = warehouses.find((w) => w.id === (mv.warehouseId || mv.fromWarehouseId));
      const destWh = warehouses.find((w) => w.id === mv.toWarehouseId);
      const pp = productionPoints.find((p) => p.id === mv.productionPointId);
      const fk = (fryKitchens || []).find((f) => f.id === mv.productionPointId || f.id === mv.fryKitchenId);
      return {
        Fecha: fmtDate(mv.timestamp), Hora: fmtTime(mv.timestamp), Tipo: mv.type,
        'Ítem/Producto': item?.name ?? product?.name ?? '—', Cantidad: mv.qty ?? mv.produced ?? 0,
        Unidad: item?.unit ?? 'kg', Lotes: mv.batches ?? '—',
        'Línea/Cocina': pp?.name ?? fk?.name ?? '—', 'Bodega Origen': wh?.name ?? '—',
        'Bodega Destino': destWh?.name ?? '—', Persona: mv.person || '—', Razón: mv.reason || '—',
      };
    });
  };

  const buildSalesSheet = () => {
    return posSales.map((s) => ({
      Fecha: fmtDateTime(s.timestamp), Ticket: s.id?.replace('SALE-', '') || '—',
      Cliente: s.customerName ? `${s.customerName}${s.customerDoc ? ' (' + s.customerDoc + ')' : ''}` : (s.clientName || s.client || 'Cliente General'),
      Estado: s.status === 'PAID' ? 'PAGADO' : 'SUSPENDIDA',
      'Método Pago': s.paymentMethod || '—', Descuento: s.discountAmount || 0,
      Total: s.total || 0,
      Ítems: (s.items || []).map(i => `${i.qty || 1}x ${i.name} (${fmtMoney((i.price || 0) * (i.qty || 1))})`).join(' | ') || '—',
    }));
  };

  const buildTransfersSheet = () => {
    return vendorTransfers.map((t) => ({
      Fecha: fmtDate(t.createdAt), Hora: fmtTime(t.createdAt),
      Punto: t.pointId || '—', Vendedor: t.vendorName || '—',
      Nota: t.note || '—', Monto: t.amount || 0,
      'Foto Adjunta': (t.photoBase64 || t.photo || t.imageUrl) ? 'SÍ' : 'NO',
    }));
  };

  const buildShiftsSheet = () => {
    return posShifts.map((sh) => ({
      Apertura: fmtDateTime(sh.openedAt), Cierre: fmtDateTime(sh.closedAt),
      Cajero: sh.userName || '—', 'Base Inicial': sh.initialAmount || 0,
      'Conteo Final': sh.realAmount || 0,
      Estado: sh.closedAt ? 'CERRADO' : 'EN CURSO',
    }));
  };

  const buildIncomesSheet = () => {
    return finIncomes.map((inc) => ({
      Fecha: fmtDate(inc.fecha || inc.created_at), Ubicación: inc.ubicacion || '—',
      Jornada: inc.jornada || '—', Tipo: inc.tipo || '—',
      Efectivo: inc.efectivo || 0, Transferencias: inc.transferencias || 0,
      Salidas: inc.salidas || 0, Total: inc.total || 0,
    }));
  };

  const buildExpensesSheet = () => {
    // Combine finance expenses + POS expenses
    const combined = [
      ...finExpenses.map(e => ({
        Fuente: 'Finanzas', Fecha: fmtDate(e.fecha || e.created_at),
        Proveedor: e.proveedor || '—', Descripción: e.descripcion || '—', Monto: e.valor || 0,
      })),
      ...posExpenses.map(e => ({
        Fuente: 'POS', Fecha: fmtDate(e.fecha || e.timestamp || e.created_at),
        Proveedor: e.proveedor || '—', Descripción: e.descripcion || e.description || '—', Monto: e.valor || e.amount || 0,
      })),
    ];
    return combined;
  };

  const buildLogisticsSheet = () => {
    return logLoadHistory.map((entry) => ({
      Fecha: fmtDateTime(entry.timestamp), Tipo: entry.type === 'carga' ? 'CARGA' : 'RECEPCIÓN',
      Vehículo: entry.vehicleId || '—',
      Productos: (entry.items || []).map(i => `${i.name}: ${i.qty}`).join(', ') || '—',
      'Total Ítems': (entry.items || []).reduce((s, i) => s + (i.qty || 0), 0),
    }));
  };

  const buildInventorySnapshotSheet = () => {
    return inventory.map((item) => {
      const wh = warehouses.find(w => w.id === item.warehouseId);
      return {
        Nombre: item.name, Tipo: item.type, Bodega: wh?.name || 'General',
        Cantidad: item.qty, Unidad: item.unit, 'Alerta en': item.alert,
        'Bajo Stock': item.qty <= item.alert ? '⚠️ SÍ' : 'No',
        Precio: item.price || 0, 'Valor Total': (item.price || 0) * item.qty,
        'Código Barras': item.barcode || '—',
      };
    });
  };

  const downloadSingleExcel = (sheetData, sheetName, fileName) => {
    try {
      if (!sheetData || sheetData.length === 0) { alert('No hay datos para exportar.'); return; }
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(sheetData);
      ws['!cols'] = Object.keys(sheetData[0]).map(() => ({ wch: 22 }));
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      XLSX.writeFile(wb, `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err) { console.error('Error exportando:', err); alert('Error al exportar. Intente nuevamente.'); }
  };

  const downloadAllExcel = () => {
    try {
      const wb = XLSX.utils.book_new();
      const sheets = [
        { data: buildMovementsSheet(), name: 'Mov. Inventario' },
        { data: buildSalesSheet(), name: 'Ventas POS' },
        { data: buildTransfersSheet(), name: 'Transferencias' },
        { data: buildShiftsSheet(), name: 'Turnos Caja' },
        { data: buildIncomesSheet(), name: 'Ingresos' },
        { data: buildExpensesSheet(), name: 'Egresos' },
        { data: buildLogisticsSheet(), name: 'Logística' },
        { data: buildInventorySnapshotSheet(), name: 'Inventario Actual' },
      ];
      let sheetsAdded = 0;
      sheets.forEach(({ data, name }) => {
        if (data && data.length > 0) {
          const ws = XLSX.utils.json_to_sheet(data);
          ws['!cols'] = Object.keys(data[0]).map(() => ({ wch: 20 }));
          XLSX.utils.book_append_sheet(wb, ws, name);
          sheetsAdded++;
        }
      });
      if (sheetsAdded === 0) { alert('No hay datos para exportar en ninguna sección.'); return; }
      XLSX.writeFile(wb, `Frita_Mejor_Reporte_Completo_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err) { console.error('Error exportando:', err); alert('Error al exportar. Intente nuevamente.'); }
  };

  // ─── Report tabs ────────────────────────────────────────────────
  const REPORT_TABS = [
    { id: 'INVENTARIO',   label: '📦 Inventario',   count: movements.length },
    { id: 'VENTAS_POS',   label: '💵 Ventas POS',   count: posSales.length },
    { id: 'TRANSFERENCIAS', label: '📲 Transferencias', count: vendorTransfers.length },
    { id: 'TURNOS',       label: '💰 Turnos/Cierres', count: posShifts.length },
    { id: 'FINANZAS',     label: '📊 Finanzas',     count: finIncomes.length + finExpenses.length + posExpenses.length },
    { id: 'LOGISTICA',    label: '🚚 Logística',    count: logLoadHistory.length },
    { id: 'SNAPSHOT',     label: '📋 Inventario Actual', count: inventory.length },
  ];

  // ─── Main render ────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
        <div>
          <h3 className="font-black text-chunky-dark text-xl">📊 Centro de Reportes</h3>
          <p className="text-xs text-gray-400 font-bold mt-0.5">Descarga y analiza todos los datos de la operación</p>
        </div>
        <button
          className="bg-gradient-to-r from-green-600 to-green-500 text-white font-black text-sm py-3 px-6 rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] active:scale-95 flex items-center gap-2"
          onClick={downloadAllExcel}
        >
          <DownloadIcon />
          ⬇️ Descargar TODO (Excel)
        </button>
      </div>

      {/* Report tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {REPORT_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveReport(tab.id)}
            className={`px-4 py-2 rounded-full font-bold text-sm transition-all duration-200 flex items-center gap-2
              ${activeReport === tab.id
                ? 'bg-chunky-dark text-white shadow-sm scale-105'
                : 'bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-chunky-dark border border-gray-100'}`}
          >
            {tab.label}
            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${activeReport === tab.id ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-500'}`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* ════════ TAB: INVENTARIO ════════ */}
      {activeReport === 'INVENTARIO' && (() => {
        const prodCount = movements.filter(m => m.type === 'PRODUCCION').length;
        const mermaCount = movements.filter(m => m.type === 'MERMA').length;
        const totalProduced = movements.filter(m => m.type === 'PRODUCCION').reduce((s, m) => s + (m.produced || 0), 0);
        return (
          <div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              <Kpi icon="📦" label="Total Movimientos" value={movements.length} color="bg-blue-50" />
              <Kpi icon="🏭" label="Producciones" value={prodCount} sub={`${totalProduced.toFixed(1)} kg producidos`} color="bg-green-50" />
              <Kpi icon="🗑️" label="Mermas" value={mermaCount} color="bg-red-50" />
              <Kpi icon="📥" label="Recepciones" value={movements.filter(m => m.type === 'RECEPCION').length} color="bg-purple-50" />
            </div>
            <div className="flex justify-end mb-3">
              <button className="bg-green-600 hover:bg-green-500 text-white font-bold text-xs px-4 py-2 rounded-full flex items-center gap-2 transition-all" onClick={() => downloadSingleExcel(buildMovementsSheet(), 'Movimientos', 'Frita_Movimientos')}>
                <DownloadIcon /> Excel Inventario
              </button>
            </div>
            {movements.length === 0 ? (
              <div className="text-center py-12"><span className="text-5xl block mb-3">📦</span><p className="font-bold text-gray-400">Sin movimientos registrados.</p></div>
            ) : (
              <div className="overflow-x-auto border border-gray-100 rounded-2xl">
                <table className="w-full text-sm text-left whitespace-nowrap">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase">Fecha</th>
                      <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase">Tipo</th>
                      <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase">Ítem</th>
                      <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase">Cantidad</th>
                      <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase">Ubicación</th>
                      <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase">Persona</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {movements.slice(0, 50).map((mv) => {
                      const item = inventory.find(i => i.id === mv.inventoryId);
                      const pp = productionPoints.find(p => p.id === mv.productionPointId);
                      const fk = (fryKitchens || []).find((f) => f.id === mv.productionPointId || f.id === mv.fryKitchenId);
                      const wh = warehouses.find(w => w.id === (mv.warehouseId || mv.fromWarehouseId));
                      const sign = (mv.type === 'RECEPCION' || mv.type === 'PRODUCCION' || mv.type === 'FRITADO') ? '+' : '-';
                      return (
                        <tr key={mv.id} className="hover:bg-gray-50/50">
                          <td className="py-3 px-4 text-gray-600 font-bold">{fmtDateTime(mv.timestamp)}</td>
                          <td className="py-3 px-4"><span className={`text-xs font-bold px-2 py-1 rounded-full ${typeColors[mv.type] || 'bg-gray-100 text-gray-500'}`}>{typeLabels[mv.type] || mv.type}</span></td>
                          <td className="py-3 px-4 font-bold text-chunky-dark">{item?.name ?? (mv.type === 'PRODUCCION' || mv.type === 'FRITADO' ? `Prod. x${mv.batches || 1} lote(s)` : '—')}</td>
                          <td className="py-3 px-4 font-black">{sign}{mv.qty || mv.produced} <span className="text-gray-400 text-xs font-bold">{item?.unit ?? 'kg'}</span></td>
                          <td className="py-3 px-4 text-gray-500 font-bold text-xs">{pp?.name || fk?.name || wh?.name || '—'}</td>
                          <td className="py-3 px-4 text-gray-500 font-bold text-xs">{mv.person || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {movements.length > 50 && <p className="text-center text-xs text-gray-400 font-bold py-3">Mostrando 50 de {movements.length} — Descarga Excel para ver todos</p>}
              </div>
            )}
          </div>
        );
      })()}

      {/* ════════ TAB: VENTAS POS ════════ */}
      {activeReport === 'VENTAS_POS' && (() => {
        const totalVentas = posSales.filter(s => s.status === 'PAID').reduce((s, sale) => s + (sale.total || 0), 0);
        const paidCount = posSales.filter(s => s.status === 'PAID').length;
        const totalDescuentos = posSales.reduce((s, sale) => s + (sale.discountAmount || 0), 0);
        return (
          <div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              <Kpi icon="🧾" label="Total Tickets" value={posSales.length} color="bg-blue-50" />
              <Kpi icon="✅" label="Pagados" value={paidCount} sub={fmtMoney(totalVentas)} color="bg-green-50" />
              <Kpi icon="⏸️" label="Suspendidos" value={posSales.filter(s => s.status !== 'PAID').length} color="bg-orange-50" />
              <Kpi icon="🏷️" label="Descuentos" value={fmtMoney(totalDescuentos)} color="bg-red-50" />
            </div>
            <div className="flex justify-end mb-3">
              <button className="bg-green-600 hover:bg-green-500 text-white font-bold text-xs px-4 py-2 rounded-full flex items-center gap-2 transition-all" onClick={() => downloadSingleExcel(buildSalesSheet(), 'Ventas', 'Frita_Ventas_POS')}>
                <DownloadIcon /> Excel Ventas
              </button>
            </div>
            {posSales.length === 0 ? (
              <div className="text-center py-12"><span className="text-5xl block mb-3">💵</span><p className="font-bold text-gray-400">No hay ventas POS registradas.</p></div>
            ) : (
              <div className="overflow-x-auto border border-gray-100 rounded-2xl">
                <table className="w-full text-sm text-left whitespace-nowrap">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase">Fecha</th>
                      <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase">Ticket</th>
                      <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase">Cliente</th>
                      <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase">Ítems Comprados</th>
                      <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase">Estado</th>
                      <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase">Método</th>
                      <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase">Descuento</th>
                      <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase text-right">Total</th>
                      <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase text-center">Detalle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {posSales.slice(0, 50).map((sale) => {
                      const clientLabel = sale.customerName ? `${sale.customerName}${sale.customerDoc ? ' (' + sale.customerDoc + ')' : ''}` : (sale.clientName || sale.client || 'Cliente General');
                      const itemsSummary = (sale.items || []).map(i => `${i.qty || 1}x ${i.name}`).join(', ');
                      return (
                        <tr key={sale.id} className="hover:bg-gray-50/50">
                          <td className="py-3 px-4 font-bold text-gray-600">{fmtDateTime(sale.timestamp)}</td>
                          <td className="py-3 px-4 font-bold text-chunky-dark">{sale.id?.replace('SALE-', '') || '—'}</td>
                          <td className="py-3 px-4 font-bold text-gray-700">{clientLabel}</td>
                          <td className="py-3 px-4">
                            <span className="text-xs font-bold text-gray-600 bg-gray-100 px-2.5 py-1 rounded-xl max-w-[200px] inline-block truncate" title={itemsSummary}>
                              🛒 {itemsSummary || 'Sin ítems'}
                            </span>
                          </td>
                          <td className="py-3 px-4"><span className={`text-xs font-bold px-2 py-1 rounded-full ${sale.status === 'PAID' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>{sale.status === 'PAID' ? 'PAGADO' : 'SUSPENDIDA'}</span></td>
                          <td className="py-3 px-4 font-bold text-gray-600">{sale.paymentMethod || '—'}</td>
                          <td className="py-3 px-4 text-orange-500 font-bold">{sale.discountAmount > 0 ? `-${fmtMoney(sale.discountAmount)}` : '—'}</td>
                          <td className="py-3 px-4 text-right font-black text-chunky-dark">{fmtMoney(sale.total)}</td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => setSelectedReportSale(sale)}
                              className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs transition-all active:scale-95 cursor-pointer"
                            >
                              👁️ Ticket
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {posSales.length > 50 && <p className="text-center text-xs text-gray-400 font-bold py-3">Mostrando 50 de {posSales.length}</p>}
              </div>
            )}
          </div>
        );
      })()}

      {/* ════════ TAB: TRANSFERENCIAS BANCARIAS ════════ */}
      {activeReport === 'TRANSFERENCIAS' && (() => {
        const totalTransf = vendorTransfers.reduce((acc, t) => acc + (t.amount || 0), 0);
        const withPhotoCount = vendorTransfers.filter(t => t.photoBase64 || t.photo || t.imageUrl).length;
        return (
          <div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
              <Kpi icon="📲" label="Total Transferencias" value={vendorTransfers.length} color="bg-blue-50" />
              <Kpi icon="💰" label="Monto Acumulado" value={fmtMoney(totalTransf)} color="bg-green-50" />
              <Kpi icon="🖼️" label="Con Comprobante" value={withPhotoCount} color="bg-purple-50" />
            </div>
            <div className="flex justify-end mb-3">
              <button className="bg-green-600 hover:bg-green-500 text-white font-bold text-xs px-4 py-2 rounded-full flex items-center gap-2 transition-all cursor-pointer" onClick={() => downloadSingleExcel(buildTransfersSheet(), 'Transferencias', 'Frita_Transferencias')}>
                <DownloadIcon /> Excel Transferencias
              </button>
            </div>
            {vendorTransfers.length === 0 ? (
              <div className="text-center py-12"><span className="text-5xl block mb-3">📲</span><p className="font-bold text-gray-400">No hay transferencias bancarias registradas.</p></div>
            ) : (
              <div className="overflow-x-auto border border-gray-100 rounded-2xl">
                <table className="w-full text-sm text-left whitespace-nowrap">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase">Fecha / Hora</th>
                      <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase">Punto / Vehículo</th>
                      <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase">Vendedor</th>
                      <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase">Nota / Motivo</th>
                      <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase text-right">Monto</th>
                      <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase text-center">Foto Comprobante</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {vendorTransfers.map((t, idx) => {
                      const imgUrl = t.photoBase64 || t.photo || t.imageUrl || t.photoUrl || t.comprobanteUrl || t.comprobante;
                      return (
                        <tr key={t.id || idx} className="hover:bg-gray-50/50">
                          <td className="py-3 px-4 font-bold text-gray-600">{fmtDateTime(t.createdAt)}</td>
                          <td className="py-3 px-4 font-black text-chunky-dark">{t.pointId || '—'}</td>
                          <td className="py-3 px-4 font-bold text-gray-600">{t.vendorName || 'Vendedor'}</td>
                          <td className="py-3 px-4 text-gray-500 font-bold text-xs truncate max-w-[180px]">{t.note || '—'}</td>
                          <td className="py-3 px-4 text-right font-black text-green-600">{fmtMoney(t.amount)}</td>
                          <td className="py-3 px-4 text-center">
                            {imgUrl ? (
                              <button
                                onClick={() => setSelectedReportPhoto(imgUrl)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 rounded-xl font-black text-xs transition-all active:scale-95 cursor-pointer"
                              >
                                🖼️ Ver Comprobante
                              </button>
                            ) : (
                              <span className="text-xs font-bold text-gray-300">Sin foto</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })()}

      {/* ════════ TAB: TURNOS/CIERRES Z ════════ */}
      {activeReport === 'TURNOS' && (() => {
        const closedShifts = posShifts.filter(s => s.closedAt);
        const totalCash = closedShifts.reduce((s, sh) => s + (sh.realAmount || 0), 0);
        return (
          <div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              <Kpi icon="💰" label="Total Turnos" value={posShifts.length} color="bg-blue-50" />
              <Kpi icon="🔒" label="Cerrados" value={closedShifts.length} color="bg-green-50" />
              <Kpi icon="🔓" label="En Curso" value={posShifts.filter(s => !s.closedAt).length} color="bg-orange-50" />
              <Kpi icon="💵" label="Total Conteos" value={fmtMoney(totalCash)} color="bg-purple-50" />
            </div>
            <div className="flex justify-end mb-3">
              <button className="bg-green-600 hover:bg-green-500 text-white font-bold text-xs px-4 py-2 rounded-full flex items-center gap-2 transition-all" onClick={() => downloadSingleExcel(buildShiftsSheet(), 'Turnos', 'Frita_Turnos_Caja')}>
                <DownloadIcon /> Excel Turnos
              </button>
            </div>
            {posShifts.length === 0 ? (
              <div className="text-center py-12"><span className="text-5xl block mb-3">💰</span><p className="font-bold text-gray-400">No hay turnos de caja registrados.</p></div>
            ) : (
              <div className="space-y-3">
                {posShifts.slice(0, 30).map((sh) => (
                  <div key={sh.id} className="border border-gray-100 rounded-2xl p-4 flex flex-wrap items-center gap-4 hover:border-gray-200 transition-colors">
                    <div className="w-10 h-10 bg-yellow-50 rounded-xl flex items-center justify-center text-xl border border-yellow-100 shrink-0">💰</div>
                    <div className="flex-1 min-w-[140px]">
                      <span className="font-black text-chunky-dark block">Turno {sh.id?.slice(-6)}</span>
                      <span className="text-gray-400 font-bold text-xs">Cajero: {sh.userName || '—'}</span>
                    </div>
                    <span className="text-xs font-bold text-gray-500">{fmtDateTime(sh.openedAt)}</span>
                    <div className="flex gap-3 items-center">
                      <span className="text-xs font-bold bg-gray-50 text-gray-500 px-2 py-1 rounded-full">Base: {fmtMoney(sh.initialAmount)}</span>
                      {sh.closedAt && <span className="text-xs font-bold bg-blue-50 text-blue-600 px-2 py-1 rounded-full">Conteo: {fmtMoney(sh.realAmount)}</span>}
                    </div>
                    <span className={`text-xs font-bold px-3 py-1 rounded-full ${sh.closedAt ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-600'}`}>
                      {sh.closedAt ? '🔒 CERRADO' : '🟢 EN CURSO'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* ════════ TAB: FINANZAS ════════ */}
      {activeReport === 'FINANZAS' && (() => {
        const totalIngresos = finIncomes.reduce((s, i) => s + (i.total || 0), 0);
        const totalEgresos = [...finExpenses.map(e => e.valor || 0), ...posExpenses.map(e => e.valor || e.amount || 0)].reduce((s, v) => s + v, 0);
        const allExpenses = buildExpensesSheet();
        return (
          <div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              <Kpi icon="💰" label="Total Ingresos" value={fmtMoney(totalIngresos)} sub={`${finIncomes.length} registros`} color="bg-green-50" />
              <Kpi icon="💸" label="Total Egresos" value={fmtMoney(totalEgresos)} sub={`${allExpenses.length} registros`} color="bg-red-50" />
              <Kpi icon="📈" label="Balance" value={fmtMoney(totalIngresos - totalEgresos)} color={totalIngresos >= totalEgresos ? 'bg-green-50' : 'bg-red-50'} />
              <Kpi icon="🧾" label="Gastos POS" value={posExpenses.length} sub="Desde caja registradora" color="bg-orange-50" />
            </div>
            {/* Sub-tabs */}
            <div className="flex gap-2 mb-4">
              <button onClick={() => setFinSubtab('ingresos')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${finSubtab === 'ingresos' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>💰 Ingresos ({finIncomes.length})</button>
              <button onClick={() => setFinSubtab('egresos')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${finSubtab === 'egresos' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>💸 Egresos ({allExpenses.length})</button>
              <button onClick={() => setFinSubtab('nomina')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${finSubtab === 'nomina' ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>👥 Nómina ({payrollRecords.length})</button>
            </div>
            <div className="flex justify-end mb-3 gap-2">
              {finSubtab === 'ingresos' && (
                <button className="bg-green-600 hover:bg-green-500 text-white font-bold text-xs px-4 py-2 rounded-full flex items-center gap-2 transition-all" onClick={() => downloadSingleExcel(buildIncomesSheet(), 'Ingresos', 'Frita_Ingresos')}>
                  <DownloadIcon /> Excel Ingresos
                </button>
              )}
              {finSubtab === 'egresos' && (
                <button className="bg-red-600 hover:bg-red-500 text-white font-bold text-xs px-4 py-2 rounded-full flex items-center gap-2 transition-all" onClick={() => downloadSingleExcel(buildExpensesSheet(), 'Egresos', 'Frita_Egresos')}>
                  <DownloadIcon /> Excel Egresos
                </button>
              )}
            </div>

            {finSubtab === 'ingresos' && (
              finIncomes.length === 0 ? (
                <div className="text-center py-12"><span className="text-5xl block mb-3">💰</span><p className="font-bold text-gray-400">No hay ingresos registrados.</p></div>
              ) : (
                <div className="overflow-x-auto border border-gray-100 rounded-2xl">
                  <table className="w-full text-sm text-left whitespace-nowrap">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase">Fecha</th>
                        <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase">Ubicación</th>
                        <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase">Jornada</th>
                        <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase">Tipo</th>
                        <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase text-right">Efectivo</th>
                        <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase text-right">Transf.</th>
                        <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {finIncomes.slice(0, 50).map((inc, idx) => (
                        <tr key={idx} className="hover:bg-gray-50/50">
                          <td className="py-3 px-4 font-bold text-gray-600">{fmtDate(inc.fecha || inc.created_at)}</td>
                          <td className="py-3 px-4 font-bold text-chunky-dark">{inc.ubicacion || '—'}</td>
                          <td className="py-3 px-4"><span className="bg-gray-100 text-gray-500 text-[10px] font-bold px-2 py-0.5 rounded-md">{inc.jornada || '—'}</span></td>
                          <td className="py-3 px-4 font-bold text-gray-600">{inc.tipo || '—'}</td>
                          <td className="py-3 px-4 text-right font-bold text-gray-700">{fmtMoney(inc.efectivo)}</td>
                          <td className="py-3 px-4 text-right font-bold text-gray-700">{fmtMoney(inc.transferencias)}</td>
                          <td className="py-3 px-4 text-right font-black text-chunky-dark">{fmtMoney(inc.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {finSubtab === 'egresos' && (
              allExpenses.length === 0 ? (
                <div className="text-center py-12"><span className="text-5xl block mb-3">💸</span><p className="font-bold text-gray-400">No hay egresos registrados.</p></div>
              ) : (
                <div className="overflow-x-auto border border-gray-100 rounded-2xl">
                  <table className="w-full text-sm text-left whitespace-nowrap">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase">Fuente</th>
                        <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase">Fecha</th>
                        <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase">Proveedor</th>
                        <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase">Descripción</th>
                        <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase text-right">Monto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {allExpenses.slice(0, 50).map((exp, idx) => (
                        <tr key={idx} className="hover:bg-gray-50/50">
                          <td className="py-3 px-4"><span className={`text-xs font-bold px-2 py-1 rounded-full ${exp.Fuente === 'POS' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>{exp.Fuente}</span></td>
                          <td className="py-3 px-4 font-bold text-gray-600">{exp.Fecha}</td>
                          <td className="py-3 px-4 font-bold text-chunky-dark">{exp.Proveedor}</td>
                          <td className="py-3 px-4 font-bold text-gray-600">{exp['Descripción']}</td>
                          <td className="py-3 px-4 text-right font-black text-red-500">{fmtMoney(exp.Monto)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
            {finSubtab === 'nomina' && (
              payrollRecords.length === 0 ? (
                <div className="text-center py-12"><span className="text-5xl block mb-3">👥</span><p className="font-bold text-gray-400">No hay registros de nómina.</p></div>
              ) : (
                <div className="space-y-6">
                  {[...payrollRecords].sort((a,b) => b.periodo.localeCompare(a.periodo)).map((rec) => {
                    const totalRec = rec.filas.reduce((s,f) => s + (Number(f.nomina)||0) + (Number(f.extras)||0) + (Number(f.vacaciones)||0) + (Number(f.liquidacion)||0), 0);
                    return (
                      <div key={rec.id} className="border border-violet-100 rounded-2xl overflow-hidden">
                        {/* Header del período */}
                        <div className="bg-violet-50 px-5 py-3 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-lg">📅</span>
                            <div>
                              <p className="font-black text-violet-800 text-sm">{rec.periodo}</p>
                              <p className="text-xs font-bold text-violet-400">{rec.filas.length} empleados</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-black text-violet-700">{fmtMoney(totalRec)}</span>
                            <button onClick={() => deletePayrollRecord(rec.id)} className="w-7 h-7 rounded-full bg-red-50 text-red-400 hover:bg-red-100 flex items-center justify-center transition-colors" title="Eliminar período">✕</button>
                          </div>
                        </div>
                        {/* Tabla editable */}
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm whitespace-nowrap">
                            <thead className="bg-gray-50 border-b border-gray-100">
                              <tr>
                                <th className="py-2 px-4 text-[10px] font-bold text-gray-400 uppercase text-left">Empleado</th>
                                <th className="py-2 px-4 text-[10px] font-bold text-gray-400 uppercase text-right">Nómina</th>
                                <th className="py-2 px-4 text-[10px] font-bold text-gray-400 uppercase text-right">Extras</th>
                                <th className="py-2 px-4 text-[10px] font-bold text-gray-400 uppercase text-right">Vacaciones</th>
                                <th className="py-2 px-4 text-[10px] font-bold text-gray-400 uppercase text-right">Liquidación</th>
                                <th className="py-2 px-4 text-[10px] font-bold text-gray-400 uppercase text-right">Total</th>
                                <th className="py-2 px-4 text-[10px] font-bold text-gray-400 uppercase">Notas</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {rec.filas.map((fila, filaIdx) => {
                                const totalFila = (Number(fila.nomina)||0)+(Number(fila.extras)||0)+(Number(fila.vacaciones)||0)+(Number(fila.liquidacion)||0);
                                const filaKey = fila.id || `idx-${filaIdx}`;
                                const EditCell = ({campo, color='text-gray-700'}) => (
                                  <td className="py-2 px-2 text-right">
                                    <input
                                      type="number" min="0"
                                      className={`w-24 text-right font-bold text-sm border border-gray-200 rounded-lg px-2 py-1 outline-none focus:border-violet-400 ${color}`}
                                      defaultValue={fila[campo] || ''}
                                      onBlur={(e) => updatePayrollRow(rec.id, filaKey, { [campo]: Number(e.target.value)||0 })}
                                    />
                                  </td>
                                );
                                return (
                                  <tr key={filaKey} className="hover:bg-violet-50/30">
                                    <td className="py-2 px-4">
                                      <input
                                        type="text"
                                        className="font-bold text-sm border border-gray-200 rounded-lg px-2 py-1 outline-none focus:border-violet-400 w-36"
                                        defaultValue={fila.empleadoNombre || fila.nombre || ''}
                                        onBlur={(e) => updatePayrollRow(rec.id, filaKey, { empleadoNombre: e.target.value })}
                                      />
                                    </td>
                                    <EditCell campo="nomina" color="text-emerald-700" />
                                    <EditCell campo="extras" color="text-blue-700" />
                                    <EditCell campo="vacaciones" color="text-amber-700" />
                                    <EditCell campo="liquidacion" color="text-red-700" />
                                    <td className="py-2 px-4 text-right font-black text-violet-700">{fmtMoney(totalFila)}</td>
                                    <td className="py-2 px-4">
                                      <input
                                        type="text"
                                        className="font-bold text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none focus:border-violet-400 w-32 text-gray-500"
                                        defaultValue={fila.observacion || fila.notas || ''}
                                        onBlur={(e) => updatePayrollRow(rec.id, filaKey, { observacion: e.target.value })}
                                      />
                                    </td>
                                  </tr>
                                );
                              })}
                              {/* Fila de totales */}
                              <tr className="bg-violet-50 font-black">
                                <td className="py-2 px-4 text-violet-700 text-xs uppercase tracking-wider">TOTAL</td>
                                {['nomina','extras','vacaciones','liquidacion'].map(campo => (
                                  <td key={campo} className="py-2 px-4 text-right text-violet-800">
                                    {fmtMoney(rec.filas.reduce((s,f) => s+(Number(f[campo])||0), 0))}
                                  </td>
                                ))}
                                <td className="py-2 px-4 text-right text-violet-900">{fmtMoney(totalRec)}</td>
                                <td />
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}

          </div>
        );
      })()}

      {/* ════════ TAB: LOGÍSTICA ════════ */}
      {activeReport === 'LOGISTICA' && (() => {
        const cargas = logLoadHistory.filter(e => e.type === 'carga');
        const recepciones = logLoadHistory.filter(e => e.type === 'recepcion');
        const totalItems = logLoadHistory.reduce((s, e) => s + (e.items || []).reduce((s2, i) => s2 + (i.qty || 0), 0), 0);
        return (
          <div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              <Kpi icon="🚚" label="Total Operaciones" value={logLoadHistory.length} color="bg-blue-50" />
              <Kpi icon="📤" label="Cargas Enviadas" value={cargas.length} color="bg-orange-50" />
              <Kpi icon="📥" label="Recepciones" value={recepciones.length} color="bg-green-50" />
              <Kpi icon="✅" label="Surtidos Completados" value={logCompleted.length} sub={`${totalItems} ítems total`} color="bg-purple-50" />
            </div>
            <div className="flex justify-end mb-3">
              <button className="bg-green-600 hover:bg-green-500 text-white font-bold text-xs px-4 py-2 rounded-full flex items-center gap-2 transition-all" onClick={() => downloadSingleExcel(buildLogisticsSheet(), 'Logística', 'Frita_Logistica')}>
                <DownloadIcon /> Excel Logística
              </button>
            </div>
            {logLoadHistory.length === 0 ? (
              <div className="text-center py-12"><span className="text-5xl block mb-3">🚚</span><p className="font-bold text-gray-400">No hay operaciones logísticas registradas.</p></div>
            ) : (
              <div className="space-y-3">
                {logLoadHistory.slice(0, 30).map((entry) => (
                  <div key={entry.id} className="border border-gray-100 rounded-2xl p-4 hover:border-gray-200 transition-colors">
                    <div className="flex flex-wrap items-center gap-3 mb-2">
                      <span className={`text-xs font-bold px-3 py-1 rounded-full ${entry.type === 'carga' ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}>
                        {entry.type === 'carga' ? '📤 Carga' : '📥 Recepción'}
                      </span>
                      <span className="font-bold text-chunky-dark text-sm">Vehículo: {entry.vehicleId || '—'}</span>
                      <span className="text-xs text-gray-400 font-bold ml-auto">{fmtDateTime(entry.timestamp)}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 pl-1">
                      {(entry.items || []).map((item, idx) => (
                        <span key={idx} className="bg-gray-50 border border-gray-100 text-xs font-bold px-3 py-1 rounded-full text-gray-600">
                          {item.name}: <span className="text-chunky-dark font-black">{item.qty}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* ════════ TAB: INVENTARIO ACTUAL (SNAPSHOT) ════════ */}
      {activeReport === 'SNAPSHOT' && (() => {
        const lowStock = inventory.filter(i => i.qty <= i.alert);
        const totalValue = inventory.reduce((s, i) => s + ((i.price || 0) * i.qty), 0);
        const byType = { INSUMO: 0, PRODUCTO: 0, BEBIDA: 0, CRUDO: 0, FRITO: 0 };
        inventory.forEach(i => { if (byType[i.type] !== undefined) byType[i.type]++; });
        return (
          <div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              <Kpi icon="📋" label="Total Ítems" value={inventory.length} color="bg-blue-50" />
              <Kpi icon="⚠️" label="Bajo Stock" value={lowStock.length} sub="Necesitan atención" color="bg-red-50" />
              <Kpi icon="💰" label="Valor Total" value={fmtMoney(totalValue)} color="bg-green-50" />
              <Kpi icon="📦" label="Bodegas" value={warehouses.length} color="bg-purple-50" />
            </div>
            <div className="flex justify-end mb-3">
              <button className="bg-green-600 hover:bg-green-500 text-white font-bold text-xs px-4 py-2 rounded-full flex items-center gap-2 transition-all" onClick={() => downloadSingleExcel(buildInventorySnapshotSheet(), 'Inventario', 'Frita_Inventario_Actual')}>
                <DownloadIcon /> Excel Inventario
              </button>
            </div>
            <div className="overflow-x-auto border border-gray-100 rounded-2xl">
              <table className="w-full text-sm text-left whitespace-nowrap">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase">Nombre</th>
                    <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase">Tipo</th>
                    <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase">Bodega</th>
                    <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase">Cantidad</th>
                    <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase">Precio</th>
                    <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase text-right">Valor</th>
                    <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {inventory.map((item) => {
                    const wh = warehouses.find(w => w.id === item.warehouseId);
                    const isLow = item.qty <= item.alert;
                    const typeColorMap = { INSUMO: 'bg-blue-50 text-blue-500', PRODUCTO: 'bg-green-50 text-green-500', BEBIDA: 'bg-cyan-50 text-cyan-600', CRUDO: 'bg-sky-50 text-sky-600', FRITO: 'bg-orange-50 text-orange-500' };
                    const typeIcon = { INSUMO: '📋', PRODUCTO: '📦', BEBIDA: '🥤', CRUDO: '🧊', FRITO: '🔥' };
                    return (
                      <tr key={item.id} className={`hover:bg-gray-50/50 ${isLow ? 'bg-red-50/30' : ''}`}>
                        <td className="py-3 px-4 font-black text-chunky-dark">{item.name}</td>
                        <td className="py-3 px-4"><span className={`text-xs font-bold px-2 py-1 rounded-full ${typeColorMap[item.type] || 'bg-gray-100 text-gray-500'}`}>{typeIcon[item.type] || ''} {item.type}</span></td>
                        <td className="py-3 px-4 font-bold text-gray-500 text-xs">{wh?.name || 'General'}</td>
                        <td className="py-3 px-4 font-black text-chunky-dark">{item.qty} <span className="text-gray-400 text-xs font-bold">{item.unit}</span></td>
                        <td className="py-3 px-4 font-bold text-gray-600">{item.price ? fmtMoney(item.price) : '—'}</td>
                        <td className="py-3 px-4 text-right font-bold text-gray-700">{item.price ? fmtMoney(item.price * item.qty) : '—'}</td>
                        <td className="py-3 px-4">
                          {isLow ? <span className="text-xs font-bold bg-red-100 text-red-500 px-2 py-1 rounded-full">⚠️ Bajo</span> : <span className="text-xs font-bold bg-green-100 text-green-600 px-2 py-1 rounded-full">✅ OK</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* ─── Modal: Foto de Transferencia Ampliada ─── */}
      {selectedReportPhoto && (
        <div
          className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/95 backdrop-blur-md p-3 sm:p-6 animate-fade-in"
          onClick={() => setSelectedReportPhoto(null)}
        >
          <div 
            className="relative max-w-4xl w-full max-h-[92vh] flex flex-col items-center bg-gray-900 rounded-3xl border border-white/20 shadow-2xl p-3 sm:p-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
              <span className="text-white font-black text-sm flex items-center gap-2">
                📸 Comprobante de Transferencia Bancaria
              </span>
              <button
                onClick={() => setSelectedReportPhoto(null)}
                className="bg-white text-gray-950 font-black text-xs px-4 py-1.5 rounded-full hover:bg-gray-200 transition-all active:scale-95 cursor-pointer shadow-md"
              >
                ✕ CERRAR
              </button>
            </div>
            <div className="w-full flex-1 min-h-0 flex items-center justify-center my-3 overflow-hidden rounded-2xl bg-black">
              <img 
                src={selectedReportPhoto} 
                alt="Comprobante Completo" 
                className="max-w-full max-h-[75vh] object-contain rounded-xl"
              />
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal: Detalle de Ticket POS ─── */}
      {selectedReportSale && (
        <div
          className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in"
          onClick={() => setSelectedReportSale(null)}
        >
          <div 
            className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-gray-100 flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-4 shrink-0">
              <div>
                <h3 className="font-black text-gray-900 text-lg leading-tight">
                  🧾 Ticket #{selectedReportSale.id?.replace('SALE-', '') || '—'}
                </h3>
                <p className="text-xs font-bold text-gray-400">
                  {fmtDateTime(selectedReportSale.timestamp)}
                </p>
              </div>
              <button
                onClick={() => setSelectedReportSale(null)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 font-black cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Info de Cliente y Cajero */}
            <div className="bg-blue-50/60 rounded-2xl p-4 mb-4 border border-blue-100/60 space-y-1.5 shrink-0">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-blue-500 uppercase tracking-widest text-[10px]">Cliente</span>
                <span className="font-black text-gray-800">
                  {selectedReportSale.customerName
                    ? `${selectedReportSale.customerName}${selectedReportSale.customerDoc ? ' (' + selectedReportSale.customerDoc + ')' : ''}`
                    : (selectedReportSale.clientName || selectedReportSale.client || 'Cliente General')
                  }
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-blue-500 uppercase tracking-widest text-[10px]">Método Pago</span>
                <span className="font-black text-gray-800">{selectedReportSale.paymentMethod || 'Efectivo'}</span>
              </div>
              {selectedReportSale.userName && (
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-blue-500 uppercase tracking-widest text-[10px]">Cajero/Vendedor</span>
                  <span className="font-bold text-gray-600">{selectedReportSale.userName}</span>
                </div>
              )}
            </div>

            {/* Lista de Ítems */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-2 mb-4">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Ítems Comprados</p>
              {(selectedReportSale.items || []).length === 0 ? (
                <p className="text-xs font-bold text-gray-400 italic">No hay detalle de productos registrado.</p>
              ) : (
                (selectedReportSale.items || []).map((item, i) => (
                  <div key={i} className="flex items-center justify-between bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <div>
                      <span className="font-black text-gray-900 text-sm">{item.name}</span>
                      <span className="block text-xs font-bold text-gray-400">{item.qty || 1} x {fmtMoney(item.price || 0)}</span>
                    </div>
                    <span className="font-black text-gray-900 text-sm">
                      {fmtMoney((item.price || 0) * (item.qty || 1))}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Totales */}
            <div className="border-t border-gray-100 pt-3 space-y-1.5 shrink-0">
              {selectedReportSale.discountAmount > 0 && (
                <div className="flex justify-between text-xs font-bold text-orange-500">
                  <span>Descuento Aplicado</span>
                  <span>-{fmtMoney(selectedReportSale.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-black text-gray-900 pt-1">
                <span>TOTAL COMPRA</span>
                <span>{fmtMoney(selectedReportSale.total)}</span>
              </div>
            </div>

            <button
              onClick={() => setSelectedReportSale(null)}
              className="mt-5 w-full py-3.5 rounded-2xl bg-gray-900 text-white font-black text-sm hover:bg-gray-800 transition-colors active:scale-95 shrink-0 cursor-pointer"
            >
              Cerrar Ticket
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Formulario de usuario (fuera del panel para evitar remount al escribir) ──
const USER_ROLES = [
  { value: 'OPERARIO',  label: '🧑‍🍳 Operario',      color: 'bg-orange-50 text-orange-600' },
  { value: 'BODEGUERO', label: '📦 Bodeguero',     color: 'bg-blue-50 text-blue-600'   },
  { value: 'CAJERO',    label: '💵 Cajero',        color: 'bg-green-50 text-green-600' },
  { value: 'VENDEDOR',  label: '🚲 Vendedor',      color: 'bg-red-50 text-frita-red'   },
  { value: 'DEJADOR',   label: '🛵 Dejador',       color: 'bg-yellow-50 text-frita-orange' },
  { value: 'MANAGER',   label: '👔 Gerente',       color: 'bg-violet-50 text-violet-600' },
  { value: 'ADMIN',     label: '⚙️ Administrador', color: 'bg-purple-50 text-purple-600' },
];
const USER_MODULE_LABELS = { produccion: '🏭 Producción', bodega: '📦 Bodega', pos: '💵 Caja', admin: '⚙️ Admin', 'vendedor-setup': '🔧 Conf. Vendedor', vendedor: '🚲 Vendedor', dejador: '🛵 Dejador', tracking: '🗺️ Rutas', gerente: '👔 Mi Sede' };
const USER_FIELDS = [
  { key: 'name',     label: 'Nombre',      placeholder: 'Nombre Apellido',              type: 'text'     },
  { key: 'email',    label: 'Correo',      placeholder: 'usuario@fritamejor.com',       type: 'email'    },
  { key: 'password', label: 'Contraseña',  placeholder: 'Mínimo 6 caracteres',          type: 'password' },
];

function UserForm({ form, setForm, onSave, onCancel, error }) {
  const [showPass, setShowPass] = React.useState(false);
  return (
    <div className="border-2 border-chunky-main rounded-2xl p-5 bg-yellow-50/30 space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 font-bold text-sm px-4 py-3 rounded-xl flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          {error}
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        {USER_FIELDS.map((f) => (
          <div key={f.key} className="flex-1 min-w-[180px]">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">{f.label}</label>
            <div className="relative">
              <input
                type={f.key === 'password' ? (showPass ? 'text' : 'password') : f.type}
                placeholder={f.placeholder}
                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 font-bold text-sm outline-none focus:border-chunky-main pr-10"
                value={form[f.key]}
                onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') onSave(); }}
              />
              {f.key === 'password' && (
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-chunky-dark transition-colors"
                  onClick={() => setShowPass((v) => !v)}
                  tabIndex={-1}
                  title={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPass ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              )}
            </div>
          </div>
        ))}
        <div className="flex-1 min-w-[160px]">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Rol</label>
          <select
            className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 font-bold text-sm outline-none focus:border-chunky-main"
            value={form.role}
            onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
          >
            {USER_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
      </div>
      <div className="flex items-center gap-2 bg-gray-50 rounded-xl p-3">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Acceso que tendrá:</span>
        <div className="flex gap-2">
          {(ROLE_ACCESS[form.role] ?? []).map((mod) => (
            <span key={mod} className="text-xs font-bold bg-yellow-50 border border-yellow-100 text-chunky-dark px-2 py-0.5 rounded-full">
              {USER_MODULE_LABELS[mod] ?? mod}
            </span>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" className="rounded-full text-sm py-2 px-6" onClick={onSave}>Guardar Usuario</Button>
        <Button variant="outline" className="rounded-full text-sm py-2 px-4 border-gray-200 text-gray-500" onClick={onCancel}>Cancelar</Button>
      </div>
    </div>
  );
}

// ─── Panel: Usuarios y Acceso ─────────────────────────────────────────────────
function UsersPanel() {
  const { users, user: currentUser, addUser, updateUser, deleteUser, toggleUserActive } = useAuthStore();
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId]   = useState(null);
  const [form, setForm]       = useState({ name: '', email: '', password: '', role: 'OPERARIO' });
  const [errorMsg, setErrorMsg] = useState('');

  const ROLES = USER_ROLES;

  const handleSave = () => {
    setErrorMsg('');
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      setErrorMsg('Todos los campos son obligatorios.');
      return;
    }

    let result;
    if (editId) {
      result = updateUser(editId, form);
    } else {
      result = addUser(form);
    }

    if (result && !result.ok) {
      setErrorMsg(result.error);
      return; // Stop saving, show error
    }

    setEditId(null);
    setShowAdd(false);
    setForm({ name: '', email: '', password: '', role: 'OPERARIO' });
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-black text-chunky-dark text-lg">Usuarios ({users.length})</h3>
        <Button variant="secondary" className="rounded-full text-sm py-2 px-5 shadow-sm" onClick={() => { setShowAdd(true); setEditId(null); setErrorMsg(''); setForm({ name: '', email: '', password: '', role: 'OPERARIO' }); }}>
          + Nuevo Usuario
        </Button>
      </div>

      {showAdd && (
        <div className="mb-4">
          <UserForm form={form} setForm={setForm} error={errorMsg} onSave={handleSave} onCancel={() => { setShowAdd(false); setErrorMsg(''); }} />
        </div>
      )}

      <div className="space-y-3">
        {users.map((u) => {
          const roleInfo = ROLES.find((r) => r.value === u.role);
          const isMe = currentUser?.id === u.id;

          return editId === u.id ? (
            <div key={u.id}>
              <UserForm form={form} setForm={setForm} onSave={handleSave} onCancel={() => setEditId(null)} />
            </div>
          ) : (
            <div key={u.id} className={`border rounded-2xl p-4 flex flex-wrap items-center gap-3 transition-colors ${u.active ? 'border-gray-100 hover:border-gray-200' : 'border-gray-100 bg-gray-50/50 opacity-60'}`}>
              {/* Avatar */}
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-yellow-100 to-yellow-200 flex items-center justify-center font-black text-chunky-dark text-lg shrink-0">
                {u.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-[140px]">
                <div className="flex items-center gap-2">
                  <span className="font-black text-chunky-dark">{u.name}</span>
                  {isMe && <span className="text-xs bg-chunky-main text-chunky-dark font-bold px-2 py-0.5 rounded-full">Tú</span>}
                </div>
                <span className="text-gray-400 font-bold text-xs block">{u.email}</span>
              </div>
              {/* Rol */}
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${roleInfo?.color ?? 'bg-gray-50 text-gray-500'}`}>{roleInfo?.label ?? u.role}</span>
              {/* Módulos */}
              <div className="flex gap-1">
                {(u.access ?? []).map((mod) => (
                  <span key={mod} className="text-xs font-bold bg-gray-50 text-gray-400 px-2 py-0.5 rounded-full">{USER_MODULE_LABELS[mod] ?? mod}</span>
                ))}
              </div>
              {/* Estado */}
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${u.active ? 'bg-green-50 text-green-500' : 'bg-red-50 text-red-400'}`}>{u.active ? 'Activo' : 'Inactivo'}</span>
              {/* Acciones — editar siempre disponible; toggle/eliminar solo para otros */}
              <div className="flex gap-2 ml-auto">
                {/* Editar — disponible para todos incluido uno mismo */}
                <button
                  className="text-gray-300 hover:text-chunky-main transition-colors"
                  title="Editar usuario"
                  onClick={() => {
                    setEditId(u.id);
                    setForm({ name: u.name, email: u.email, password: u.password, role: u.role });
                    setShowAdd(false);
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                </button>
                {/* Toggle activo y eliminar — solo para otros usuarios */}
                {!isMe && (
                  <>
                    <button className={`text-gray-300 hover:text-${u.active ? 'orange' : 'green'}-400 transition-colors`} onClick={() => toggleUserActive(u.id)} title={u.active ? 'Desactivar' : 'Activar'}>
                      {u.active ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      )}
                    </button>
                    <button className="text-gray-300 hover:text-red-400 transition-colors" onClick={() => deleteUser(u.id)} title="Eliminar">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="m19 6-.867 14.142A2 2 0 0 1 16.138 22H7.862a2 2 0 0 1-1.995-1.858L5 6m5 0V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2"/></svg>
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Panel: Presets de Producción por Producto ────────────────────────────────
// Permite al admin editar los 5 botones de cantidad de cada producto por línea y crear nuevos
function ProductsPresetsPanel() {
  const { products, recipes, productionPoints, fryKitchens = [], inventory, updateProduct, addProduct, deleteProduct, updateInventoryItem } = useInventoryStore();
  const [editingKey, setEditingKey] = useState(null); // formato: 'prodId_ppId'
  const [draftPresets, setDraftPresets] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newProd, setNewProd] = useState({ name: '', recipeId: '', unit: 'kg', outputInventoryId: '' });

  const startEdit = (prod, ppId) => {
    setEditingKey(`${prod.id}_${ppId}`);
    setDraftPresets([...(prod.linePresets?.[ppId] ?? [1, 2, 5, 10, 20])]);
  };

  const saveEdit = (prod, ppId) => {
    const parsed = draftPresets.map((v) => parseFloat(v)).filter((v) => !isNaN(v) && v > 0);
    // Asegurar exactamente 5 presets
    const final = parsed.slice(0, 5);
    while (final.length < 5) final.push(final[final.length - 1] ?? 1);
    
    const currentPresets = prod.linePresets ? { ...prod.linePresets } : {};
    currentPresets[ppId] = final;

    updateProduct(prod.id, { 
      linePresets: currentPresets
    });
    setEditingKey(null);
  };

  const toggleProductionPoint = (prod, ppId) => {
    const current = prod.productionPointIds || [];
    const updated = current.includes(ppId) ? current.filter(id => id !== ppId) : [...current, ppId];
    updateProduct(prod.id, { productionPointIds: updated });
    const inv = inventory.find(i => prod.outputInventoryId ? i.id === prod.outputInventoryId : i.name === prod.name);
    if (inv) {
      updateInventoryItem(inv.id, { productionPointIds: updated });
    }
  };

  const toggleFryKitchen = (prod, fkId) => {
    const current = prod.fryKitchenIds || [];
    const updated = current.includes(fkId) ? current.filter(id => id !== fkId) : [...current, fkId];
    updateProduct(prod.id, { fryKitchenIds: updated });
    const inv = inventory.find(i => prod.outputInventoryId ? i.id === prod.outputInventoryId : i.name === prod.name);
    if (inv) {
      updateInventoryItem(inv.id, { fryKitchenIds: updated });
    }
  };

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-5">
        <div>
          <h3 className="font-black text-chunky-dark text-lg">Botones y Asignación de Producción / Fritado</h3>
          <p className="text-xs font-bold text-gray-400 mt-1">
            Asigna productos a líneas de producción o fritado y edita sus 5 botones rápidos.
          </p>
        </div>
        <button className="bg-chunky-main text-white font-black py-2 px-6 rounded-full shadow-sm hover:bg-chunky-secondary transition-colors shrink-0" onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? 'Cancelar' : '+ Nuevo Botón Prod.'}
        </button>
      </div>

      {showAdd && (
        <div className="bg-blue-50 rounded-2xl p-6 border-2 border-blue-200 mb-6 flex flex-wrap gap-4 items-end animate-fade-in">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-bold text-gray-400 block mb-1">Nombre (ej. Chorizo Tradicional)</label>
            <input className="w-full bg-white border-2 border-gray-200 rounded-xl px-3 py-2 font-bold text-chunky-dark outline-none focus:border-chunky-main" value={newProd.name} onChange={(e) => setNewProd({...newProd, name: e.target.value})} />
          </div>
          <div className="flex-1 min-w-[200px]">
             <label className="text-xs font-bold text-gray-400 block mb-1">Receta (Descuenta Insumos)</label>
             <select className="w-full bg-white border-2 border-gray-200 rounded-xl px-3 py-2 font-bold text-chunky-dark outline-none focus:border-chunky-main" value={newProd.recipeId} onChange={(e) => setNewProd({...newProd, recipeId: e.target.value})}>
               <option value="">Sin receta (No descuenta)</option>
               {recipes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
             </select>
          </div>
          <div className="flex-1 min-w-[200px]">
             <label className="text-xs font-bold text-gray-400 block mb-1">Suma a Inventario</label>
             <select className="w-full bg-white border-2 border-gray-200 rounded-xl px-3 py-2 font-bold text-chunky-dark outline-none focus:border-chunky-main" value={newProd.outputInventoryId} onChange={(e) => setNewProd({...newProd, outputInventoryId: e.target.value})}>
               <option value="">(Crear nuevo automáticamente)</option>
               {inventory.filter(i => ['PRODUCTO', 'CRUDO', 'INSUMO'].includes(i.type)).map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
             </select>
          </div>
          <button className="bg-green-500 text-white font-black py-2 px-6 rounded-xl hover:bg-green-600 transition-colors w-full md:w-auto mt-2 md:mt-0 disabled:opacity-50"
            disabled={!newProd.name}
            onClick={() => { addProduct({ ...newProd, productionPointIds: [], fryKitchenIds: [], linePresets: {} }); setShowAdd(false); setNewProd({ name: '', recipeId: '', unit: 'kg', outputInventoryId: '' }); }}>
            Guardar
          </button>
        </div>
      )}

      <div className="space-y-4">
        {products.map((prod) => {
          const recipe   = recipes.find((r) => r.id === prod.recipeId);
          const assignedPts = productionPoints.filter(pp => prod.productionPointIds?.includes(pp.id));

          return (
            <div key={prod.id} className="border border-gray-100 rounded-2xl p-5 hover:border-gray-200 transition-colors bg-white shadow-sm">
              <div className="mb-3 flex justify-between items-start">
                <div>
                  <h4 className="font-black text-chunky-dark text-lg">{prod.name}</h4>
                  {recipe && (
                    <p className="text-xs font-bold text-gray-400 mt-0.5">
                      Receta: <span className="text-chunky-dark">{recipe.name}</span> · Rinde {recipe.yieldQty} {recipe.yieldUnit}/lote
                    </p>
                  )}
                </div>
                <button className="w-8 h-8 flex items-center justify-center rounded-xl bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors shrink-0" onClick={() => deleteProduct(prod.id)} title="Eliminar Botón">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="m19 6-.867 14.142A2 2 0 0 1 16.138 22H7.862a2 2 0 0 1-1.995-1.858L5 6m5 0V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2"/></svg>
                </button>
              </div>

              {/* Selector de asignación a Líneas de Producción */}
              <div className="mb-3 p-3 bg-yellow-50/50 rounded-xl border border-yellow-100/60">
                <span className="text-[11px] font-black text-yellow-800 uppercase tracking-wider block mb-1.5">🏭 Líneas de Producción:</span>
                <div className="flex flex-wrap gap-1.5">
                  {productionPoints.map((pp) => {
                    const isAssigned = prod.productionPointIds?.includes(pp.id);
                    return (
                      <button
                        key={pp.id}
                        onClick={() => toggleProductionPoint(prod, pp.id)}
                        className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                          isAssigned
                            ? 'bg-yellow-400 text-chunky-dark font-black shadow-xs'
                            : 'bg-white border border-gray-200 text-gray-400 hover:border-yellow-400 hover:text-yellow-600'
                        }`}
                      >
                        {isAssigned ? `✓ ${pp.name}` : `+ ${pp.name}`}
                      </button>
                    );
                  })}
                  {productionPoints.length === 0 && <span className="text-xs text-gray-400 font-bold">No hay líneas de producción creadas.</span>}
                </div>
              </div>

              {/* Selector de asignación a Cocinas de Fritado */}
              <div className="mb-4 p-3 bg-orange-50/50 rounded-xl border border-orange-100/60">
                <span className="text-[11px] font-black text-orange-800 uppercase tracking-wider block mb-1.5">🍳 Líneas / Cocinas de Fritado:</span>
                <div className="flex flex-wrap gap-1.5">
                  {(fryKitchens || []).map((fk) => {
                    const isAssigned = prod.fryKitchenIds?.includes(fk.id);
                    return (
                      <button
                        key={fk.id}
                        onClick={() => toggleFryKitchen(prod, fk.id)}
                        className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                          isAssigned
                            ? 'bg-orange-500 text-white font-black shadow-xs'
                            : 'bg-white border border-gray-200 text-gray-400 hover:border-orange-400 hover:text-orange-600'
                        }`}
                      >
                        {isAssigned ? `✓ ${fk.name}` : `+ ${fk.name}`}
                      </button>
                    );
                  })}
                  {(fryKitchens || []).length === 0 && <span className="text-xs text-gray-400 font-bold">No hay cocinas de fritado creadas.</span>}
                </div>
              </div>

              {assignedPts.length === 0 ? (
                <p className="text-xs font-bold text-gray-400 italic">Selecciona una línea de producción arriba para editar sus 5 botones rápidos.</p>
              ) : (
                <div className="space-y-4 pt-2 border-t border-gray-50">
                  {assignedPts.map(pp => {
                    const presets = prod.linePresets?.[pp.id] ?? [1, 2, 5, 10, 20];
                    const isEditing = editingKey === `${prod.id}_${pp.id}`;
                    const yieldQty = recipe?.yieldQty ?? 1;
                    const unit     = recipe?.yieldUnit ?? prod.unit;

                    return (
                      <div key={pp.id} className="bg-gray-50 rounded-xl p-4">
                        <div className="flex justify-between items-center mb-3">
                          <span className="font-bold text-sm text-chunky-dark">{pp.name}</span>
                          {!isEditing ? (
                            <button
                              className="text-gray-300 hover:text-chunky-main"
                              onClick={() => startEdit(prod, pp.id)}
                              title="Editar presets de línea"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                            </button>
                          ) : (
                            <div className="flex gap-2">
                              <button className="text-xs font-bold text-green-600 hover:text-green-700 bg-green-100 px-3 py-1 rounded-full" onClick={() => saveEdit(prod, pp.id)}>Guardar</button>
                              <button className="text-xs font-bold text-gray-400 hover:text-gray-600 bg-white border border-gray-200 px-3 py-1 rounded-full" onClick={() => setEditingKey(null)}>Cancelar</button>
                            </div>
                          )}
                        </div>
                        {/* Grid de 5 botones / inputs */}
                        <div className="grid grid-cols-5 gap-2">
                          {(isEditing ? draftPresets : presets).map((batches, idx) => {
                            const qty = batches * yieldQty;
                            return isEditing ? (
                              <div key={idx} className="flex flex-col items-center gap-1">
                                <label className="text-xs font-bold text-gray-400">Btn {idx + 1}</label>
                                <input
                                  type="number" min="0.1" step="0.5"
                                  className="w-full text-center font-black text-chunky-dark text-sm border-2 border-chunky-main rounded-xl py-1 outline-none focus:border-chunky-secondary"
                                  value={draftPresets[idx]}
                                  onChange={(e) => {
                                    const copy = [...draftPresets];
                                    copy[idx] = e.target.value;
                                    setDraftPresets(copy);
                                  }}
                                />
                                <span className="text-[10px] font-bold text-gray-400">={((parseFloat(draftPresets[idx])||0)*yieldQty).toFixed(1)}</span>
                              </div>
                            ) : (
                              <div key={idx} className="flex flex-col items-center">
                                <div className="w-full bg-white border-2 border-gray-200 hover:border-[#FFB700] hover:bg-yellow-50 transition-colors rounded-xl py-2 px-1 flex flex-col items-center shadow-sm">
                                  <span className="font-black text-gray-800 text-sm">{qty % 1 === 0 ? qty : qty.toFixed(1)}</span>
                                  <span className="text-[10px] font-bold text-gray-400">{unit}</span>
                                </div>
                                <span className="text-[10px] text-gray-400 font-bold mt-1">{batches} lote(s)</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Panel: Configuración de POS (Carpetas) ──────────────────────────────────
// ─── Panel: Tipos de Ítem Personalizados ───────────────────────────────────────
function ItemTypesPanel() {
  const { itemTypes, addItemType, updateItemType, deleteItemType } = useInventoryStore();
  const [editingId, setEditingId] = useState(null);
  const [showAdd,   setShowAdd]   = useState(false);
  const [form,      setForm]      = useState({ name: '', description: '', color: 'bg-purple-50 text-purple-600 border border-purple-200' });

  const typesList = itemTypes && itemTypes.length > 0 ? itemTypes : INITIAL_ITEM_TYPES;

  const fields = [
    { key: 'name',        label: 'Nombre del Tipo (ej. POSTRE, COMBO, EMPAQUE)' },
    { key: 'description', label: 'Descripción' },
    { key: 'color',       label: 'Estilo / Color', options: [
      { value: 'bg-cyan-50 text-cyan-600 border border-cyan-200',        label: 'Cyan (Bebida / Frío)' },
      { value: 'bg-purple-50 text-purple-600 border border-purple-200',    label: 'Morado (Combo / Especial)' },
      { value: 'bg-pink-50 text-pink-600 border border-pink-200',          label: 'Rosado (Dulce / Postre)' },
      { value: 'bg-emerald-50 text-emerald-600 border border-emerald-200',label: 'Esmeralda (Verde)' },
      { value: 'bg-amber-50 text-amber-600 border border-amber-200',       label: 'Ámbar (Dorado / Especial)' },
      { value: 'bg-indigo-50 text-indigo-600 border border-indigo-200',   label: 'Índigo (Azul Oscuro)' },
      { value: 'bg-blue-50 text-blue-500 border border-blue-200',          label: 'Azul Insumo' },
      { value: 'bg-green-50 text-green-600 border border-green-200',       label: 'Verde Producto' },
      { value: 'bg-orange-50 text-orange-600 border border-orange-200',    label: 'Naranja Crudo' },
      { value: 'bg-yellow-50 text-yellow-600 border border-yellow-200',    label: 'Amarillo Frito' },
      { value: 'bg-gray-100 text-gray-600 border border-gray-200',        label: 'Gris Neutro' },
    ] },
  ];

  const change = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h3 className="font-black text-chunky-dark text-lg">🏷️ Tipos de Ítem del Sistema ({typesList.length})</h3>
          <p className="text-xs font-bold text-gray-400 mt-0.5">Crea tus propios tipos personalizados para clasificar tu inventario.</p>
        </div>
        <Button variant="secondary" className="rounded-full text-sm py-2 px-5 shadow-sm shrink-0" onClick={() => { setShowAdd(true); setEditingId(null); setForm({ name: '', description: '', color: 'bg-purple-50 text-purple-600 border border-purple-200' }); }}>
          + Crear Nuevo Tipo
        </Button>
      </div>

      {showAdd && (
        <div className="mb-4">
          <EditableRow fields={fields} values={form} onChange={change}
            onSave={() => { if (form.name.trim()) { addItemType(form); setShowAdd(false); } }}
            onCancel={() => setShowAdd(false)} />
        </div>
      )}

      <div className="space-y-2">
        {typesList.map((type) => (
          editingId === type.id ? (
            <div key={type.id}>
              <EditableRow fields={fields} values={form} onChange={change}
                onSave={() => { updateItemType(type.id, form); setEditingId(null); }}
                onCancel={() => setEditingId(null)} />
            </div>
          ) : (
            <div key={type.id} className="border border-gray-100 rounded-2xl p-4 flex items-center justify-between hover:border-gray-200 transition-colors">
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 text-xs font-black uppercase tracking-wider rounded-full shrink-0 ${type.color || 'bg-gray-100 text-gray-600 border border-gray-200'}`}>
                  {type.name}
                </span>
                <div>
                  <span className="font-bold text-xs text-gray-600 block">{type.description || 'Sin descripción'}</span>
                  {type.isSystem ? (
                    <span className="text-[10px] font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full inline-block mt-0.5">🔒 Tipo Base del Sistema</span>
                  ) : (
                    <span className="text-[10px] font-bold text-purple-500 bg-purple-50 px-2 py-0.5 rounded-full inline-block mt-0.5">⭐ Tipo Personalizado</span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button className="text-gray-300 hover:text-chunky-main" onClick={() => { setEditingId(type.id); setForm({ name: type.name, description: type.description || '', color: type.color || 'bg-purple-50 text-purple-600 border border-purple-200' }); setShowAdd(false); }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                </button>
                {!type.isSystem && (
                  <button className="text-gray-300 hover:text-red-400" onClick={() => deleteItemType(type.id)}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="m19 6-.867 14.142A2 2 0 0 1 16.138 22H7.862a2 2 0 0 1-1.995-1.858L5 6m5 0V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2"/></svg>
                  </button>
                )}
              </div>
            </div>
          )
        ))}
      </div>
    </div>
  );
}

function PosCategoriesPanel() {
  const { posCategories, addPosCategory, updatePosCategory, deletePosCategory } = useInventoryStore();
  const [editingId, setEditingId] = useState(null);
  const [showAdd,   setShowAdd]   = useState(false);
  const [form,      setForm]      = useState({ name: '', color: 'bg-blue-500' });

  const fields = [
    { key: 'name',  label: 'Nombre Carpeta' },
    { key: 'color', label: 'Color', options: [
      { value: 'bg-blue-500',   label: 'Azul' },
      { value: 'bg-red-500',    label: 'Rojo' },
      { value: 'bg-green-500',  label: 'Verde' },
      { value: 'bg-orange-500', label: 'Naranja' },
      { value: 'bg-purple-500', label: 'Morado' },
      { value: 'bg-gray-800',   label: 'Oscuro' },
    ] },
  ];

  const change = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-black text-chunky-dark text-lg">Carpetas POS ({(posCategories || []).length})</h3>
        <Button variant="secondary" className="rounded-full text-sm py-2 shadow-sm" onClick={() => { setShowAdd(true); setEditingId(null); setForm({ name: '', color: 'bg-blue-500' }); }}>
          + Agregar Carpeta
        </Button>
      </div>
      {showAdd && (
        <div className="mb-4">
          <EditableRow fields={fields} values={form} onChange={change}
            onSave={() => { if (form.name.trim()) { addPosCategory(form); setShowAdd(false); } }}
            onCancel={() => setShowAdd(false)} />
        </div>
      )}
      <div className="space-y-2">
        {(posCategories || []).map((cat) => (
          editingId === cat.id ? (
            <div key={cat.id}>
              <EditableRow fields={fields} values={form} onChange={change}
                onSave={() => { updatePosCategory(cat.id, form); setEditingId(null); }}
                onCancel={() => setEditingId(null)} />
            </div>
          ) : (
            <div key={cat.id} className="border border-gray-100 rounded-2xl p-4 flex items-center justify-between hover:border-gray-200">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${cat.color} flex items-center justify-center text-white font-bold`}>
                  🗂️
                </div>
                <span className="font-black text-chunky-dark">{cat.name}</span>
              </div>
              <div className="flex gap-2">
                <button className="text-gray-300 hover:text-chunky-main" onClick={() => { setEditingId(cat.id); setForm({ name: cat.name, color: cat.color }); setShowAdd(false); }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                </button>
                <button className="text-gray-300 hover:text-red-400" onClick={() => deletePosCategory(cat.id)}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="m19 6-.867 14.142A2 2 0 0 1 16.138 22H7.862a2 2 0 0 1-1.995-1.858L5 6m5 0V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2"/></svg>
                </button>
              </div>
            </div>
          )
        ))}
      </div>
    </div>
  );
}

// ─── Panel: Clientes y Descuentos ──────────────────────────────────────────────
function CustomersPanel() {
  const { customers, addCustomer, updateCustomer, deleteCustomer } = useInventoryStore();
  const [editingId, setEditingId] = useState(null);
  const [showAdd,   setShowAdd]   = useState(false);
  const [form,      setForm]      = useState({ name: '', document: '', discountPercent: 0, active: true });

  const fields = [
    { key: 'name',            label: 'Nombre / Tipo', wide: true },
    { key: 'document',        label: 'NIT / CC',      type: 'text' },
    { key: 'discountPercent', label: '% Descuento',   type: 'number' },
    { key: 'active',          label: 'Activo',        options: [{ value: 'true', label: 'Sí' }, { value: 'false', label: 'No' }] },
  ];

  const change = (k, v) => setForm((f) => ({ ...f, [k]: k === 'active' ? v === 'true' || v === true : v }));

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-black text-chunky-dark text-lg">Base de Clientes ({(customers || []).length})</h3>
        <Button variant="secondary" className="rounded-full text-sm py-2 shadow-sm" onClick={() => { setShowAdd(true); setEditingId(null); setForm({ name: '', document: '', discountPercent: 0, active: true }); }}>
          + Agregar Cliente
        </Button>
      </div>
      {showAdd && (
        <div className="mb-4">
          <EditableRow fields={fields} values={form} onChange={change}
            onSave={() => { if (form.name.trim()) { addCustomer({ ...form, discountPercent: parseFloat(form.discountPercent) || 0 }); setShowAdd(false); } }}
            onCancel={() => setShowAdd(false)} />
        </div>
      )}
      <div className="space-y-2">
        {(customers || []).map((cust) => (
          editingId === cust.id ? (
            <div key={cust.id}>
              <EditableRow fields={fields} values={form} onChange={change}
                onSave={() => { updateCustomer(cust.id, { ...form, discountPercent: parseFloat(form.discountPercent) || 0 }); setEditingId(null); }}
                onCancel={() => setEditingId(null)} />
            </div>
          ) : (
            <div key={cust.id} className="border border-gray-100 rounded-2xl p-4 flex items-center justify-between hover:border-gray-200">
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${cust.active ? 'bg-green-500' : 'bg-red-500'}`}></span>
                  <span className="font-black text-chunky-dark">{cust.name}</span>
                  {cust.discountPercent > 0 && <span className="bg-orange-100 text-orange-600 font-bold text-xs px-2 py-0.5 rounded-full">-{cust.discountPercent}%</span>}
                </div>
                {cust.document && <span className="text-xs font-bold text-gray-400 mt-0.5">ID: {cust.document}</span>}
              </div>
              <div className="flex gap-2">
                <button className="text-gray-300 hover:text-chunky-main" onClick={() => { setEditingId(cust.id); setForm({ name: cust.name, document: cust.document, discountPercent: cust.discountPercent, active: cust.active }); setShowAdd(false); }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                </button>
                <button className="text-gray-300 hover:text-red-400" onClick={() => deleteCustomer(cust.id)}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="m19 6-.867 14.142A2 2 0 0 1 16.138 22H7.862a2 2 0 0 1-1.995-1.858L5 6m5 0V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2"/></svg>
                </button>
              </div>
            </div>
          )
        ))}
      </div>
    </div>
  );
}

// ─── Panel: Configuración POS (Hardware y Métodos de Pago) ──────────────────────
function PosConfigPanel() {
  const { posSettings, updatePosSettings } = useInventoryStore();
  
  const [methods, setMethods] = useState(posSettings?.paymentMethods || [
    { id: '1', name: 'EFECTIVO', openDrawer: true, printReceipt: true }
  ]);
  const [cashDrawerCode, setCashDrawerCode] = useState(posSettings?.cashDrawerCode || '\\x1B\\x70\\x00\\x19\\xFA');
  const [printerName, setPrinterName] = useState(posSettings?.printerName || 'POS-58');
  const [supervisorPin, setSupervisorPin] = useState(posSettings?.supervisorPin || '1234');
  const [gridSize, setGridSize] = useState(posSettings?.gridSize || 'medium');

  useEffect(() => {
    if (posSettings) {
      if (posSettings.paymentMethods) setMethods(posSettings.paymentMethods);
      if (posSettings.cashDrawerCode) setCashDrawerCode(posSettings.cashDrawerCode);
      if (posSettings.printerName) setPrinterName(posSettings.printerName);
      if (posSettings.supervisorPin) setSupervisorPin(posSettings.supervisorPin);
      if (posSettings.gridSize) setGridSize(posSettings.gridSize);
    }
  }, [posSettings]);

  const handleSave = () => {
    updatePosSettings({
      ...posSettings,
      paymentMethods: methods,
      cashDrawerCode,
      printerName,
      supervisorPin,
      gridSize
    });
    alert('Configuración de hardware y métodos de pago guardada');
  };

  const handleAddMethod = () => {
    const updated = [...methods, { id: Date.now().toString(), name: 'NUEVO PAGO', openDrawer: false, printReceipt: true, isTransfer: true }];
    setMethods(updated);
    updatePosSettings({ ...posSettings, paymentMethods: updated, cashDrawerCode, printerName, supervisorPin, gridSize });
  };

  const handleUpdateMethod = (id, field, value) => {
    const updated = methods.map(m => m.id === id ? { ...m, [field]: value } : m);
    setMethods(updated);
    updatePosSettings({ ...posSettings, paymentMethods: updated, cashDrawerCode, printerName, supervisorPin, gridSize });
  };

  const handleRemoveMethod = (id) => {
    const updated = methods.filter(m => m.id !== id);
    setMethods(updated);
    updatePosSettings({ ...posSettings, paymentMethods: updated, cashDrawerCode, printerName, supervisorPin, gridSize });
  };

  return (
    <div className="max-w-3xl">
      <h3 className="font-black text-chunky-dark text-lg mb-6">⚙️ Hardware y Métodos de Pago</h3>
      
      <div className="space-y-8">
        <div>
          <div className="flex justify-between items-center mb-4">
            <label className="text-sm font-bold text-gray-400 block">Métodos de Pago Habilitados y Reglas</label>
            <Button variant="secondary" className="rounded-full text-xs py-1" onClick={handleAddMethod}>+ Añadir Método</Button>
          </div>
          
          <div className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-100 text-gray-500 font-bold border-b border-gray-200">
                <tr>
                  <th className="py-3 px-4">Nombre del Método (ej. EFECTIVO)</th>
                  <th className="py-3 px-4 text-center">¿Abre Cajón?</th>
                  <th className="py-3 px-4 text-center">¿Imprime Ticket?</th>
                  <th className="py-3 px-4 text-center">¿Es Transferencia / Digital?</th>
                  <th className="py-3 px-4 w-12 text-center"></th>
                </tr>
              </thead>
              <tbody>
                {methods.map(method => (
                  <tr key={method.id} className="border-b border-gray-200/50 hover:bg-white transition-colors">
                    <td className="py-2 px-4">
                      <input 
                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 font-bold outline-none focus:border-chunky-main uppercase"
                        value={method.name}
                        onChange={(e) => handleUpdateMethod(method.id, 'name', e.target.value.toUpperCase())}
                      />
                    </td>
                    <td className="py-2 px-4 text-center">
                      <input 
                        type="checkbox" 
                        className="w-5 h-5 accent-chunky-main cursor-pointer"
                        checked={method.openDrawer}
                        onChange={(e) => handleUpdateMethod(method.id, 'openDrawer', e.target.checked)}
                      />
                    </td>
                    <td className="py-2 px-4 text-center">
                      <input 
                        type="checkbox" 
                        className="w-5 h-5 accent-chunky-main cursor-pointer"
                        checked={method.printReceipt}
                        onChange={(e) => handleUpdateMethod(method.id, 'printReceipt', e.target.checked)}
                      />
                    </td>
                    <td className="py-2 px-4 text-center">
                      <input 
                        type="checkbox" 
                        className="w-5 h-5 accent-blue-600 cursor-pointer"
                        checked={method.isTransfer !== false && method.name !== 'EFECTIVO'}
                        onChange={(e) => handleUpdateMethod(method.id, 'isTransfer', e.target.checked)}
                      />
                    </td>
                    <td className="py-2 px-4 text-center">
                      <button className="text-gray-400 hover:text-red-500" onClick={() => handleRemoveMethod(method.id)}>
                         <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="m19 6-.867 14.142A2 2 0 0 1 16.138 22H7.862a2 2 0 0 1-1.995-1.858L5 6m5 0V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2"/></svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <label className="text-sm font-bold text-gray-400 block mb-2">Código ESC/POS de Apertura de Cajón</label>
          <div className="flex items-center gap-3">
            <input 
              type="text" 
              className="w-full max-w-sm bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 font-bold text-chunky-dark font-mono outline-none focus:border-chunky-main"
              value={cashDrawerCode}
              onChange={(e) => setCashDrawerCode(e.target.value)}
            />
            <button
              className="whitespace-nowrap px-5 py-3 rounded-xl bg-chunky-dark text-white font-bold text-sm hover:opacity-90 active:scale-95 transition-all flex items-center gap-2 shadow-md"
              onClick={() => {
                const code = cashDrawerCode || '27,112,48,55,121';
                console.log(`--- PROBANDO APERTURA DE CAJÓN: ${code} ---`);
                const bytes = parseDrawerCode(code);
                const escChars = bytes.map(b => String.fromCharCode(b)).join('');
                const iframe = document.createElement('iframe');
                iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:none;opacity:0.01;';
                document.body.appendChild(iframe);
                const doc = iframe.contentWindow.document;
                doc.open();
                doc.write(`<!DOCTYPE html><html><head><title>Cajón</title></head><body style="margin:0;padding:0;"><pre style="font-size:0;line-height:0;color:transparent;">${escChars}</pre></body></html>`);
                doc.close();
                setTimeout(() => {
                  try {
                    iframe.contentWindow.focus();
                    iframe.contentWindow.print();
                  } catch (e) {
                    console.warn('Error al imprimir:', e);
                  }
                  setTimeout(() => document.body.removeChild(iframe), 3000);
                }, 300);
              }}
            >
              🔓 Probar Cajón
            </button>
          </div>
        </div>



        <div>
          <label className="text-sm font-bold text-gray-400 block mb-2">Clave de Seguridad para Editar Ventas (Supervisores)</label>
          <input 
            type="password" 
            maxLength={8}
            className="w-full max-w-sm bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 font-bold text-chunky-dark outline-none focus:border-chunky-main font-mono"
            value={supervisorPin}
            onChange={(e) => setSupervisorPin(e.target.value)}
            placeholder="Clave numérica"
          />
        </div>

        <div>
          <label className="text-sm font-bold text-gray-400 block mb-2">Tamaño de Cuadrícula (Botones POS)</label>
          <select 
            className="w-full max-w-sm bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 font-bold text-chunky-dark outline-none focus:border-chunky-main"
            value={gridSize}
            onChange={(e) => setGridSize(e.target.value)}
          >
            <option value="small">Módulos Pequeños (Pantallas pequeñas / Muchos prod.)</option>
            <option value="medium">Módulos Medianos (Predeterminado)</option>
            <option value="large">Módulos Grandes (Ideal para pantallas táctiles)</option>
          </select>
        </div>
        <Button className="rounded-full text-md py-3 px-8 shadow-sm bg-chunky-secondary hover:opacity-90 mt-6" onClick={handleSave}>
          Guardar Configuraciones
        </Button>
      </div>
    </div>
  );
}

function PosFeedConfigPanel() {
  const { posSettings, updatePosSettings, inventory = [] } = useInventoryStore();

  const [gridColumns, setGridColumns] = useState(posSettings?.layout?.gridColumns || 6);
  const [gridRows, setGridRows] = useState(posSettings?.layout?.gridRows || 4);
  const [showOnlySelected, setShowOnlySelected] = useState(posSettings?.layout?.showOnlySelected || false);
  const [selectedProductIds, setSelectedProductIds] = useState(posSettings?.layout?.selectedProductIds || []);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (posSettings?.layout) {
      setGridColumns(posSettings.layout.gridColumns || 6);
      setGridRows(posSettings.layout.gridRows || 4);
      setShowOnlySelected(posSettings.layout.showOnlySelected || false);
      setSelectedProductIds(posSettings.layout.selectedProductIds || []);
    }
  }, [posSettings]);

  const sellableProducts = inventory.filter(i => !i.type || i.type !== 'INSUMO');
  const filteredProducts = sellableProducts.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const handleSave = () => {
    updatePosSettings({
      ...posSettings,
      layout: {
        gridColumns: parseInt(gridColumns, 10) || 6,
        gridRows: parseInt(gridRows, 10) || 4,
        showOnlySelected,
        selectedProductIds
      }
    });
    alert('Configuración de diseño de menú y feed guardada');
  };

  return (
    <div className="max-w-3xl">
      <h3 className="font-black text-chunky-dark text-lg mb-6">🎨 Diseño y Feed del POS</h3>
      
      <div className="space-y-6">
        <p className="text-xs text-gray-500 font-bold mb-4">
          Configura el número de filas y columnas del menú del POS, y elige qué productos aparecen en el feed principal (pantalla de inicio) de la caja. Las categorías siempre mostrarán todos sus productos sin restricción.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="text-sm font-bold text-gray-700 block mb-2">Número de Columnas</label>
            <input 
              type="number" 
              min="3" 
              max="8"
              className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 font-bold text-chunky-dark outline-none focus:border-chunky-main"
              value={gridColumns}
              onChange={(e) => setGridColumns(e.target.value)}
            />
            <span className="text-[10px] text-gray-400 font-bold mt-1 block">Columnas de productos mostradas en la rejilla (Recomendado: 6)</span>
          </div>

          <div>
            <label className="text-sm font-bold text-gray-700 block mb-2">Número de Filas</label>
            <input 
              type="number" 
              min="2" 
              max="20"
              className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 font-bold text-chunky-dark outline-none focus:border-chunky-main"
              value={gridRows}
              onChange={(e) => setGridRows(e.target.value)}
            />
            <span className="text-[10px] text-gray-400 font-bold mt-1 block">Filas máximas visibles (el resto requerirá scroll)</span>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-5 space-y-4">
          <div className="flex items-center justify-between bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div>
              <span className="block font-black text-gray-800 text-sm">🏠 Personalizar productos del Feed Principal</span>
              <span className="block text-xs text-gray-400 font-medium mt-0.5">
                Si está activo, los productos que marques abajo serán los que aparecen en la pantalla de inicio del POS (sin ninguna categoría seleccionada). Los productos en categorías siguen siendo accesibles con normalidad.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowOnlySelected(!showOnlySelected)}
              className={`relative w-11 h-6 rounded-full transition-colors duration-200 outline-none flex-shrink-0 ${
                showOnlySelected ? 'bg-blue-500' : 'bg-gray-300'
              }`}
            >
              <div
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 transform ${
                  showOnlySelected ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {showOnlySelected && (
            <div className="bg-white rounded-2xl p-5 border border-gray-100 space-y-4 animate-[fadeIn_0.2s_ease-out]">
              <p className="text-xs text-blue-700 font-bold bg-blue-50 rounded-xl px-4 py-2">
                💡 Marca los productos que quieres ver en el feed principal. Las categorías siempre mostrarán todos sus productos.
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  placeholder="🔍 Buscar producto..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm font-bold outline-none focus:border-chunky-main"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
                {selectedProductIds.length > 0 && (
                  <button 
                    type="button"
                    onClick={() => setSelectedProductIds([])}
                    className="text-xs font-bold text-red-500 hover:underline shrink-0"
                  >
                    Desmarcar Todos ({selectedProductIds.length})
                  </button>
                )}
              </div>

              <div className="max-h-60 overflow-y-auto border border-gray-100 rounded-xl p-2 space-y-1">
                {filteredProducts.map(p => {
                  const isChecked = selectedProductIds.includes(p.id);
                  return (
                    <label 
                      key={p.id} 
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors text-xs font-bold ${
                        isChecked ? 'bg-blue-50/50 text-blue-800' : 'hover:bg-gray-50 text-gray-600'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="w-4 h-4 accent-blue-500 cursor-pointer"
                        checked={isChecked}
                        onChange={e => {
                          if (e.target.checked) {
                            setSelectedProductIds([...selectedProductIds, p.id]);
                          } else {
                            setSelectedProductIds(selectedProductIds.filter(id => id !== p.id));
                          }
                        }}
                      />
                      <div className="flex-1 flex justify-between items-center">
                        <span>{p.name}</span>
                        <div className="flex items-center gap-2">
                          {p.posCategoryId && (
                            <span className="text-[10px] text-orange-400 font-bold border border-orange-200 rounded px-1">📁 Con categoría</span>
                          )}
                          <span className="text-[10px] text-gray-400 font-semibold uppercase">{p.type}</span>
                        </div>
                      </div>
                    </label>
                  );
                })}
                {filteredProducts.length === 0 && (
                  <p className="text-center py-4 text-xs font-bold text-gray-400">No se encontraron productos</p>
                )}
              </div>

              {/* 📌 Ordenador de productos del Feed Principal */}
              {selectedProductIds.length > 0 && (
                <div className="border-t border-gray-100 pt-4 space-y-2">
                  <span className="block font-black text-gray-800 text-xs">📌 Orden de aparición en el POS</span>
                  <p className="text-[10px] text-gray-400 font-bold">Usa las flechas para ordenar cómo se mostrarán los productos en la pantalla de inicio del POS.</p>
                  <div className="max-h-56 overflow-y-auto border border-gray-100 rounded-xl p-2 space-y-1 bg-gray-50/50">
                    {selectedProductIds.map((id, index) => {
                      const prod = inventory.find(i => i.id === id);
                      if (!prod) return null;
                      return (
                        <div key={id} className="flex items-center justify-between bg-white px-3 py-1.5 border border-gray-200 rounded-xl shadow-sm">
                          <span className="text-[11px] font-bold text-gray-700">
                            <span className="text-gray-400 mr-1.5">{index + 1}.</span> {prod.name}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={() => {
                                const newIds = [...selectedProductIds];
                                [newIds[index - 1], newIds[index]] = [newIds[index], newIds[index - 1]];
                                setSelectedProductIds(newIds);
                              }}
                              className="p-1 hover:bg-gray-100 rounded text-xs disabled:opacity-30 disabled:hover:bg-transparent transition-colors font-bold text-blue-500"
                              title="Subir"
                            >
                              ⬆️
                            </button>
                            <button
                              type="button"
                              disabled={index === selectedProductIds.length - 1}
                              onClick={() => {
                                const newIds = [...selectedProductIds];
                                [newIds[index + 1], newIds[index]] = [newIds[index], newIds[index + 1]];
                                setSelectedProductIds(newIds);
                              }}
                              className="p-1 hover:bg-gray-100 rounded text-xs disabled:opacity-30 disabled:hover:bg-transparent transition-colors font-bold text-blue-500"
                              title="Bajar"
                            >
                              ⬇️
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <Button className="rounded-full text-md py-3 px-8 shadow-sm bg-chunky-secondary hover:opacity-90 mt-6" onClick={handleSave}>
          Guardar Diseño de Feed
        </Button>
      </div>
    </div>
  );
}

function PosInventoryConfigPanel() {
  const { posSettings, updatePosSettings } = useInventoryStore();

  const [linkProduction, setLinkProduction] = useState(posSettings?.inventoryControl?.linkProduction || false);
  const [linkSalesToInventory, setLinkSalesToInventory] = useState(posSettings?.inventoryControl?.linkSalesToInventory || false);
  const [strictTricycleStock, setStrictTricycleStock] = useState(posSettings?.inventoryControl?.strictTricycleStock || false);

  useEffect(() => {
    if (posSettings?.inventoryControl) {
      setLinkProduction(posSettings.inventoryControl.linkProduction || false);
      setLinkSalesToInventory(posSettings.inventoryControl.linkSalesToInventory || false);
      setStrictTricycleStock(posSettings.inventoryControl.strictTricycleStock || false);
    }
  }, [posSettings]);

  const handleSave = () => {
    updatePosSettings({
      ...posSettings,
      inventoryControl: {
        linkProduction,
        linkSalesToInventory,
        strictTricycleStock
      }
    });
    alert('Configuración de inventario modular guardada');
  };

  return (
    <div className="max-w-3xl">
      <h3 className="font-black text-chunky-dark text-lg mb-6">⚙️ Control de Inventario Modular</h3>
      
      <div className="space-y-6">
        <p className="text-xs text-gray-500 font-bold mb-4">
          Activa o desactiva de forma modular los enlaces automáticos de stock. Esto te permite ir incorporando el control estricto paso a paso.
        </p>

        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div>
              <span className="block font-black text-gray-800 text-sm">🏭 Ligado de Producción y Fritado (Crudos a Fritos)</span>
              <span className="block text-xs text-gray-400 font-medium mt-0.5">
                Si está activo, producir o freír fritos requiere insumos/crudos y los descuenta del inventario. Si está inactivo, se puede producir/freír de forma libre.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setLinkProduction(!linkProduction)}
              className={`relative w-11 h-6 rounded-full transition-colors duration-200 outline-none flex-shrink-0 ${
                linkProduction ? 'bg-amber-500' : 'bg-gray-300'
              }`}
            >
              <div
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 transform ${
                  linkProduction ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div>
              <span className="block font-black text-gray-800 text-sm">🛒 Ligado de Caja POS/Ventas a Inventario</span>
              <span className="block text-xs text-gray-400 font-medium mt-0.5">
                Si está activo, las ventas registradas en caja POS y los pedidos entregados por triciclo descuentan stock de forma automática.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setLinkSalesToInventory(!linkSalesToInventory)}
              className={`relative w-11 h-6 rounded-full transition-colors duration-200 outline-none flex-shrink-0 ${
                linkSalesToInventory ? 'bg-amber-500' : 'bg-gray-300'
              }`}
            >
              <div
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 transform ${
                  linkSalesToInventory ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div>
              <span className="block font-black text-gray-800 text-sm">🛵 Ligado de Stock Físico a Triciclos</span>
              <span className="block text-xs text-gray-400 font-medium mt-0.5">
                Si está activo, los clientes que piden por la app solo verán stock disponible si el Dejador ha cargado previamente mercancía en los triciclos. Si está inactivo, el stock se asume siempre disponible (10 unidades por defecto).
              </span>
            </div>
            <button
              type="button"
              onClick={() => setStrictTricycleStock(!strictTricycleStock)}
              className={`relative w-11 h-6 rounded-full transition-colors duration-200 outline-none flex-shrink-0 ${
                strictTricycleStock ? 'bg-amber-500' : 'bg-gray-300'
              }`}
            >
              <div
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 transform ${
                  strictTricycleStock ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        <Button className="rounded-full text-md py-3 px-8 shadow-sm bg-chunky-secondary hover:opacity-90 mt-6" onClick={handleSave}>
          Guardar Control de Inventario
        </Button>
      </div>
    </div>
  );
}

// ─── Panel: Historial POS (Cierres Z y Ventas Totales con Auditoría) ─────────
function PosHistoryPanel() {
  const { posShifts = [], posSales = [], posExpenses = [], customers = [], posSettings } = useInventoryStore();
  const [activeSubtab, setActiveSubtab] = useState('CIERRES_Z'); // 'CIERRES_Z' | 'SALES_AUDIT'

  // Estados de Filtro y Búsqueda para Ventas Totales
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilterMode, setDateFilterMode] = useState('TODAS'); // 'TODAS' | 'HOY' | 'AYER' | '7_DIAS' | 'MES' | 'CUSTOM'
  const [customDate, setCustomDate] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL'); // 'ALL' | 'PAID' | 'SUSPENDED'
  const [sortBy, setSortBy] = useState('DATE_DESC'); // 'DATE_DESC' | 'DATE_ASC' | 'AMOUNT_DESC' | 'AMOUNT_ASC' | 'TICKET_DESC'
  const [expandedSaleId, setExpandedSaleId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const formatMoney = (val) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(val || 0);

  // Lista única de métodos de pago disponibles
  const availablePaymentMethods = useMemo(() => {
    const methodsSet = new Set();
    (posSettings?.paymentMethods || []).forEach(m => { if (m?.name) methodsSet.add(m.name.toUpperCase().trim()); });
    (posSales || []).forEach(s => { if (s?.paymentMethod) methodsSet.add(s.paymentMethod.toUpperCase().trim()); });
    return Array.from(methodsSet).sort();
  }, [posSettings, posSales]);

  // Filtrado de Ventas
  const filteredSales = useMemo(() => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);

    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const term = searchTerm.toLowerCase().trim();

    return (posSales || []).filter(sale => {
      if (!sale) return false;

      // 1. Filtro por Estado
      if (selectedStatus !== 'ALL' && sale.status !== selectedStatus) return false;

      // 2. Filtro por Método de Pago
      if (selectedPaymentMethod !== 'ALL') {
        const saleMethod = String(sale.paymentMethod || '').toUpperCase().trim();
        if (saleMethod !== selectedPaymentMethod) return false;
      }

      // 3. Filtro por Fecha
      const saleDateObj = new Date(sale.timestamp || sale.createdAt || 0);
      const saleDateStr = !isNaN(saleDateObj.getTime())
        ? `${saleDateObj.getFullYear()}-${String(saleDateObj.getMonth() + 1).padStart(2, '0')}-${String(saleDateObj.getDate()).padStart(2, '0')}`
        : '';

      if (dateFilterMode === 'HOY') {
        if (saleDateStr !== todayStr) return false;
      } else if (dateFilterMode === 'AYER') {
        if (saleDateStr !== yesterdayStr) return false;
      } else if (dateFilterMode === '7_DIAS') {
        if (saleDateObj < sevenDaysAgo) return false;
      } else if (dateFilterMode === 'MES') {
        if (saleDateObj < firstDayOfMonth) return false;
      } else if (dateFilterMode === 'CUSTOM' && customDate) {
        if (saleDateStr !== customDate) return false;
      }

      // 4. Búsqueda por Texto
      if (term) {
        const ticketId = String(sale.id || '').toLowerCase();
        const shortTicket = ticketId.replace('sale-', '');
        const cust = customers.find(c => c.id === sale.customerId);
        const customerName = String(sale.customerName || cust?.name || '').toLowerCase();
        const itemsNames = (sale.items || []).map(i => String(i.name || '').toLowerCase()).join(' ');
        const cashierName = String(sale.userName || sale.cashierName || '').toLowerCase();

        const match = ticketId.includes(term) ||
          shortTicket.includes(term) ||
          customerName.includes(term) ||
          itemsNames.includes(term) ||
          cashierName.includes(term);

        if (!match) return false;
      }

      return true;
    }).sort((a, b) => {
      // Ordenamiento
      if (sortBy === 'DATE_DESC') {
        return new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime();
      }
      if (sortBy === 'DATE_ASC') {
        return new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime();
      }
      if (sortBy === 'AMOUNT_DESC') {
        return (b.total || 0) - (a.total || 0);
      }
      if (sortBy === 'AMOUNT_ASC') {
        return (a.total || 0) - (b.total || 0);
      }
      if (sortBy === 'TICKET_DESC') {
        return String(b.id).localeCompare(String(a.id));
      }
      return 0;
    });
  }, [posSales, customers, searchTerm, dateFilterMode, customDate, selectedPaymentMethod, selectedStatus, sortBy]);

  // Cálculos de KPIs en Vivo
  const kpis = useMemo(() => {
    let totalFacturado = 0;
    let totalEfectivo = 0;
    let totalDigital = 0;
    let countPagadas = 0;
    let countSuspendidas = 0;

    filteredSales.forEach(s => {
      const tot = s.total || 0;
      if (s.status === 'PAID') {
        totalFacturado += tot;
        countPagadas++;
        const method = String(s.paymentMethod || '').toUpperCase().trim();
        if (method === 'EFECTIVO' || method === 'CASH') {
          totalEfectivo += tot;
        } else {
          totalDigital += tot;
        }
      } else {
        countSuspendidas++;
      }
    });

    const ticketPromedio = countPagadas > 0 ? Math.round(totalFacturado / countPagadas) : 0;

    return {
      totalFacturado,
      totalEfectivo,
      totalDigital,
      countTotal: filteredSales.length,
      countPagadas,
      countSuspendidas,
      ticketPromedio
    };
  }, [filteredSales]);

  // Paginación
  const totalPages = rowsPerPage === 0 ? 1 : Math.ceil(filteredSales.length / rowsPerPage);
  const paginatedSales = useMemo(() => {
    if (rowsPerPage === 0) return filteredSales;
    const start = (currentPage - 1) * rowsPerPage;
    return filteredSales.slice(start, start + rowsPerPage);
  }, [filteredSales, currentPage, rowsPerPage]);

  const formatEditHistory = (edit) => {
    const changes = [];
    const before = edit.before || {};
    const after = edit.after || {};
    if (before.paymentMethod !== after.paymentMethod) changes.push(`Pago: ${before.paymentMethod} → ${after.paymentMethod}`);
    if (before.discountAmount !== after.discountAmount) changes.push(`Desc: ${formatMoney(before.discountAmount)} → ${formatMoney(after.discountAmount)}`);
    if (before.total !== after.total) changes.push(`Total: ${formatMoney(before.total)} → ${formatMoney(after.total)}`);
    return changes.length > 0 ? changes.join(' | ') : 'Modificación de ítems';
  };

  return (
    <div className="space-y-6">
      {/* Header del Panel */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-gray-100">
        <div>
          <h3 className="text-xl font-black text-chunky-dark flex items-center gap-2">
            <span>🧾</span> Historial de Ventas POS
          </h3>
          <p className="text-xs text-gray-500 font-bold mt-0.5">
            Consulta y audita cada venta individual con filtros avanzados por fecha, método de pago, buscador y ordenamiento.
          </p>
        </div>
      </div>

      {/* AUDITORÍA DE VENTAS TOTALES */}
      <div className="space-y-6 animate-fade-in">
          {/* Tarjetas KPI en Vivo */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/60 border border-emerald-200/80 rounded-2xl p-4 shadow-sm">
              <span className="text-[10px] font-black uppercase text-emerald-800 tracking-wider block mb-1">Total Facturado</span>
              <span className="text-lg sm:text-xl font-black text-emerald-950 block">{formatMoney(kpis.totalFacturado)}</span>
              <span className="text-[11px] font-bold text-emerald-700 mt-0.5 block">{kpis.countPagadas} ventas pagadas</span>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-blue-100/60 border border-blue-200/80 rounded-2xl p-4 shadow-sm">
              <span className="text-[10px] font-black uppercase text-blue-800 tracking-wider block mb-1">Efectivo</span>
              <span className="text-lg sm:text-xl font-black text-blue-950 block">{formatMoney(kpis.totalEfectivo)}</span>
              <span className="text-[11px] font-bold text-blue-700 mt-0.5 block">Caja física</span>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100/60 border border-purple-200/80 rounded-2xl p-4 shadow-sm">
              <span className="text-[10px] font-black uppercase text-purple-800 tracking-wider block mb-1">Bancos / Digital</span>
              <span className="text-lg sm:text-xl font-black text-purple-950 block">{formatMoney(kpis.totalDigital)}</span>
              <span className="text-[11px] font-bold text-purple-700 mt-0.5 block">Nequi / Tarjeta / Otros</span>
            </div>

            <div className="bg-gradient-to-br from-amber-50 to-amber-100/60 border border-amber-200/80 rounded-2xl p-4 shadow-sm">
              <span className="text-[10px] font-black uppercase text-amber-800 tracking-wider block mb-1">Ticket Promedio</span>
              <span className="text-lg sm:text-xl font-black text-amber-950 block">{formatMoney(kpis.ticketPromedio)}</span>
              <span className="text-[11px] font-bold text-amber-700 mt-0.5 block">Por compra pagada</span>
            </div>

            <div className="bg-gradient-to-br from-gray-50 to-gray-100/80 border border-gray-200/80 rounded-2xl p-4 shadow-sm col-span-2 sm:col-span-1">
              <span className="text-[10px] font-black uppercase text-gray-700 tracking-wider block mb-1">Total Registros</span>
              <span className="text-lg sm:text-xl font-black text-gray-900 block">{kpis.countTotal}</span>
              <span className="text-[11px] font-bold text-gray-500 mt-0.5 block">
                {kpis.countSuspendidas > 0 ? `${kpis.countSuspendidas} en espera` : 'Todas finalizadas'}
              </span>
            </div>
          </div>

          {/* Barra de Filtros, Búsqueda y Ordenamiento */}
          <div className="bg-gray-50/80 border border-gray-200/70 rounded-3xl p-4 sm:p-5 space-y-4">
            {/* Fila 1: Búsqueda y Filtros Rápidos de Fecha */}
            <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
              {/* Buscador de Texto */}
              <div className="relative flex-1">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                <input
                  type="text"
                  placeholder="Buscar por ticket (#1788...), cliente, producto o cajero..."
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                  className="w-full pl-10 pr-4 py-2.5 bg-white rounded-2xl border border-gray-200 text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-500/40 shadow-sm"
                />
                {searchTerm && (
                  <button
                    onClick={() => { setSearchTerm(''); setCurrentPage(1); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 hover:text-gray-700"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Botones de Fecha Rápidos */}
              <div className="flex flex-wrap items-center gap-1.5 bg-white p-1.5 rounded-2xl border border-gray-200 shadow-sm">
                {[
                  { id: 'TODAS', label: 'Todas' },
                  { id: 'HOY', label: 'Hoy' },
                  { id: 'AYER', label: 'Ayer' },
                  { id: '7_DIAS', label: '7 Días' },
                  { id: 'MES', label: 'Este Mes' },
                  { id: 'CUSTOM', label: 'Específica 📅' },
                ].map(b => (
                  <button
                    key={b.id}
                    onClick={() => {
                      setDateFilterMode(b.id);
                      setCurrentPage(1);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                      dateFilterMode === b.id
                        ? 'bg-chunky-dark text-white shadow-sm'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>

              {/* Selector de Fecha Personalizada */}
              {dateFilterMode === 'CUSTOM' && (
                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => { setCustomDate(e.target.value); setCurrentPage(1); }}
                  className="py-2 px-3 bg-white rounded-2xl border border-gray-200 text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-500/40 shadow-sm"
                />
              )}
            </div>

            {/* Fila 2: Filtro por Método, Estado y Ordenamiento */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-200/60 text-xs">
              <div className="flex flex-wrap items-center gap-3">
                {/* Método de Pago */}
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-gray-500">Pago:</span>
                  <select
                    value={selectedPaymentMethod}
                    onChange={(e) => { setSelectedPaymentMethod(e.target.value); setCurrentPage(1); }}
                    className="bg-white border border-gray-200 rounded-xl px-2.5 py-1.5 font-bold text-gray-700 shadow-sm focus:outline-none"
                  >
                    <option value="ALL">Todos los métodos</option>
                    {availablePaymentMethods.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                {/* Estado */}
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-gray-500">Estado:</span>
                  <select
                    value={selectedStatus}
                    onChange={(e) => { setSelectedStatus(e.target.value); setCurrentPage(1); }}
                    className="bg-white border border-gray-200 rounded-xl px-2.5 py-1.5 font-bold text-gray-700 shadow-sm focus:outline-none"
                  >
                    <option value="ALL">Todos los estados</option>
                    <option value="PAID">✅ Pagadas</option>
                    <option value="SUSPENDED">⏸️ En Espera</option>
                  </select>
                </div>

                {/* Ordenar Por */}
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-gray-500">Ordenar:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="bg-white border border-gray-200 rounded-xl px-2.5 py-1.5 font-bold text-gray-700 shadow-sm focus:outline-none"
                  >
                    <option value="DATE_DESC">⏱️ Fecha: Más recientes primero</option>
                    <option value="DATE_ASC">⏱️ Fecha: Más antiguos primero</option>
                    <option value="AMOUNT_DESC">💲 Monto: Mayor a Menor</option>
                    <option value="AMOUNT_ASC">💲 Monto: Menor a Mayor</option>
                    <option value="TICKET_DESC">🧾 Nº Ticket (Descendente)</option>
                  </select>
                </div>
              </div>

              {/* Filas por Página */}
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-500">Mostrar:</span>
                <select
                  value={rowsPerPage}
                  onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                  className="bg-white border border-gray-200 rounded-xl px-2.5 py-1.5 font-bold text-gray-700 shadow-sm focus:outline-none"
                >
                  <option value={25}>25 filas</option>
                  <option value={50}>50 filas</option>
                  <option value={100}>100 filas</option>
                  <option value={0}>Todas ({filteredSales.length})</option>
                </select>
              </div>
            </div>
          </div>

          {/* Tabla de Ventas Responsiva con Scroll Horizontal Suave */}
          <div className="w-full overflow-x-auto rounded-3xl border border-gray-200/80 shadow-sm bg-white" style={{ scrollbarWidth: 'thin' }}>
            <table className="w-full text-left text-xs whitespace-nowrap min-w-[860px]">
              <thead className="bg-gray-50/90 text-gray-500 font-black border-b border-gray-200 text-[10.5px] uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-3 w-10 text-center">#</th>
                  <th className="py-3 px-4">Fecha & Hora</th>
                  <th className="py-3 px-4">Ticket</th>
                  <th className="py-3 px-4">Cliente / Info</th>
                  <th className="py-3 px-4">Modo Pago</th>
                  <th className="py-3 px-4">Ítems Resumen</th>
                  <th className="py-3 px-4 text-right">Descuento</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4 text-center">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-bold text-gray-700">
                {paginatedSales.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-gray-400">
                      <p className="text-4xl mb-2">🔍</p>
                      <p className="font-bold">No se encontraron ventas para los filtros seleccionados.</p>
                      {(searchTerm || dateFilterMode !== 'TODAS' || selectedPaymentMethod !== 'ALL' || selectedStatus !== 'ALL') && (
                        <button
                          onClick={() => {
                            setSearchTerm('');
                            setDateFilterMode('TODAS');
                            setSelectedPaymentMethod('ALL');
                            setSelectedStatus('ALL');
                            setCurrentPage(1);
                          }}
                          className="mt-3 text-xs text-amber-600 underline font-black"
                        >
                          Limpiar todos los filtros
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  paginatedSales.map((sale, idx) => {
                    const isExpanded = expandedSaleId === sale.id;
                    const cust = customers.find(c => c.id === sale.customerId);
                    const customerName = sale.customerName || cust?.name || (sale.customerId ? 'Cliente' : 'Venta General');
                    const itemsDesc = (sale.items || []).map(i => `${i.qty}x ${i.name}`).join(', ');
                    const globalIdx = (currentPage - 1) * (rowsPerPage || 0) + idx + 1;

                    return (
                      <React.Fragment key={sale.id}>
                        <tr
                          onClick={() => setExpandedSaleId(isExpanded ? null : sale.id)}
                          className={`hover:bg-amber-50/40 transition-colors cursor-pointer ${isExpanded ? 'bg-amber-50/50' : ''}`}
                        >
                          {/* Número */}
                          <td className="py-3.5 px-3 text-center text-gray-400 font-medium text-[11px]">
                            {globalIdx}
                          </td>

                          {/* Fecha */}
                          <td className="py-3.5 px-4 text-gray-600">
                            <div className="font-black text-gray-900 text-xs">
                              {new Date(sale.timestamp || sale.createdAt || 0).toLocaleDateString('es-CO')}
                            </div>
                            <div className="text-[10.5px] text-gray-400 font-semibold">
                              {new Date(sale.timestamp || sale.createdAt || 0).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </div>
                          </td>

                          {/* Ticket */}
                          <td className="py-3.5 px-4 font-black text-gray-900">
                            <div className="flex items-center gap-1.5">
                              <span>#{String(sale.id).replace('SALE-', '').slice(-8)}</span>
                              {sale.editHistory && sale.editHistory.length > 0 && (
                                <span className="bg-blue-100 text-blue-700 text-[9px] font-black px-1.5 py-0.5 rounded-full border border-blue-200" title="Venta modificada">
                                  ✏️ Editada
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Cliente */}
                          <td className="py-3.5 px-4 font-bold text-gray-800">
                            <div>{customerName}</div>
                            {sale.userName && (
                              <div className="text-[10px] text-gray-400 font-semibold">Cajero: {sale.userName}</div>
                            )}
                          </td>

                          {/* Modo de Pago */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5">
                              <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black tracking-wider ${
                                String(sale.paymentMethod || '').toUpperCase() === 'EFECTIVO'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-purple-50 text-purple-700 border border-purple-200'
                              }`}>
                                {sale.paymentMethod || 'EFECTIVO'}
                              </span>
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                sale.status === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 'bg-orange-100 text-orange-800'
                              }`}>
                                {sale.status === 'PAID' ? 'PAGADO' : 'EN ESPERA'}
                              </span>
                            </div>
                          </td>

                          {/* Resumen de Ítems */}
                          <td className="py-3.5 px-4 max-w-[220px] truncate text-gray-600 font-medium" title={itemsDesc}>
                            {itemsDesc || '—'}
                          </td>

                          {/* Descuento */}
                          <td className="py-3.5 px-4 text-right text-orange-500 font-bold">
                            {sale.discountAmount > 0 ? `-${formatMoney(sale.discountAmount)}` : '—'}
                          </td>

                          {/* Total */}
                          <td className="py-3.5 px-4 text-right font-black text-gray-950 text-sm">
                            {formatMoney(sale.total)}
                          </td>

                          {/* Botón Detalle */}
                          <td className="py-3.5 px-4 text-center">
                            <span className={`inline-block transition-transform duration-200 text-gray-400 font-bold text-xs ${isExpanded ? 'rotate-180 text-amber-600' : ''}`}>
                              ▼
                            </span>
                          </td>
                        </tr>

                        {/* Fila Expandida con Detalle de Productos y Cambios */}
                        {isExpanded && (
                          <tr className="bg-gray-50/70 border-b border-gray-200">
                            <td colSpan={9} className="p-4 sm:p-5 space-y-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Lista de Productos */}
                                <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm">
                                  <h6 className="font-black text-gray-900 text-xs uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                                    <span>🛒</span> Productos Vendidos ({sale.items?.length || 0})
                                  </h6>
                                  <div className="space-y-1.5">
                                    {(sale.items || []).map((item, iIdx) => (
                                      <div key={iIdx} className="flex justify-between items-center text-xs py-1 border-b border-gray-50 last:border-0 font-bold">
                                        <span className="text-gray-800">
                                          <span className="text-amber-600 font-black mr-1.5">{item.qty}x</span>
                                          {item.name}
                                        </span>
                                        <div className="text-right">
                                          <span className="text-gray-400 text-[10.5px] font-normal mr-2">({formatMoney(item.price)} c/u)</span>
                                          <span className="text-gray-900 font-black">{formatMoney((item.price || 0) * (item.qty || 1))}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {/* Metadatos de la Venta y Auditoría */}
                                <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm space-y-2.5 text-xs font-bold">
                                  <h6 className="font-black text-gray-900 text-xs uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                                    <span>📋</span> Auditoría y Registro
                                  </h6>
                                  <div className="flex justify-between text-gray-600">
                                    <span>ID Completo:</span>
                                    <span className="font-mono text-gray-900">{sale.id}</span>
                                  </div>
                                  {sale.shiftId && (
                                    <div className="flex justify-between text-gray-600">
                                      <span>Turno Z Asociado:</span>
                                      <span className="text-amber-700 font-black">{sale.shiftId}</span>
                                    </div>
                                  )}
                                  {sale.registerName && (
                                    <div className="flex justify-between text-gray-600">
                                      <span>Caja Registradora:</span>
                                      <span className="text-gray-900 font-black">{sale.registerName}</span>
                                    </div>
                                  )}
                                  {sale.subtotal !== undefined && sale.subtotal !== sale.total && (
                                    <div className="flex justify-between text-gray-600">
                                      <span>Subtotal sin descuento:</span>
                                      <span className="text-gray-800">{formatMoney(sale.subtotal)}</span>
                                    </div>
                                  )}

                                  {/* Historial de Edición */}
                                  {sale.editHistory && sale.editHistory.length > 0 && (
                                    <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
                                      <span className="text-[10px] uppercase tracking-wider text-blue-700 font-black block">Historial de Modificaciones:</span>
                                      {sale.editHistory.map((edit, eIdx) => (
                                        <div key={eIdx} className="bg-blue-50/60 border border-blue-200/80 rounded-xl p-2 text-[10.5px] text-blue-900">
                                          <div className="font-black">✏️ Edición #{eIdx + 1} - {new Date(edit.editedAt).toLocaleString('es-CO')}</div>
                                          <div className="font-semibold text-blue-700 mt-0.5">{formatEditHistory(edit)}</div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Controles de Paginación */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-2">
              <span className="text-xs font-bold text-gray-500">
                Mostrando página <span className="text-gray-900 font-black">{currentPage}</span> de <span className="text-gray-900 font-black">{totalPages}</span> ({filteredSales.length} ventas encontradas)
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  className="px-3.5 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition-all"
                >
                  « Anterior
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum = currentPage;
                  if (totalPages <= 5) pageNum = i + 1;
                  else if (currentPage <= 3) pageNum = i + 1;
                  else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                  else pageNum = currentPage - 2 + i;

                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-8 h-8 rounded-xl text-xs font-black transition-all ${
                        currentPage === pageNum
                          ? 'bg-chunky-dark text-white shadow-sm'
                          : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  className="px-3.5 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition-all"
                >
                  Siguiente »
                </button>
              </div>
            </div>
          )}
        </div>
    </div>
  );
}

// ─── Panel: Recetas y Botones Fritado ──────────────────────────────────────────
function FritadoConfigPanel() {
  const { fritadoRecipes, inventory, productionPoints, addFritadoRecipe, updateFritadoRecipe, deleteFritadoRecipe } = useInventoryStore();
  
  const [editingId, setEditingId] = useState(null);
  const [draftPresets, setDraftPresets] = useState([]);
  
  const [showAdd, setShowAdd] = useState(false);
  const [newRecipe, setNewRecipe] = useState({ crudoId: '', fritoId: '', presets: [10, 20, 50, 100, 200], productionPointIds: [] });

  const allProducts = (inventory || []).filter(i => i.type !== 'INSUMO');
  // Helper: etiqueta un item con su tipo para que sea distinguible en dropdowns
  const itemLabel = (p) => {
    const badge = p.type === 'CRUDO' ? '🧊 CRUDO' : p.type === 'FRITO' ? '🔥 FRITO' : p.type === 'BEBIDA' ? '🥤 BEBIDA' : p.type === 'PRODUCTO' ? '📦 PRODUCTO' : `🏷️ ${p.type}`;
    return `${p.name}  [${badge}]  (${p.qty ?? 0} ${p.unit || 'ud'})`;
  };

  const handleStartEdit = (recipe) => {
    setEditingId(recipe.id);
    setDraftPresets([...(recipe.presets || [10,20,50,100,200])]);
  };

  const handleSaveEdit = (recipeId) => {
    updateFritadoRecipe(recipeId, { presets: draftPresets.map(Number) });
    setEditingId(null);
  };

  const toggleFryKitchen = (recipeId, kitchenId, currentKitchenIds) => {
    const list = currentKitchenIds || [];
    const newList = list.includes(kitchenId) ? list.filter(id => id !== kitchenId) : [...list, kitchenId];
    updateFritadoRecipe(recipeId, { fryKitchenIds: newList });
  };

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
        <div>
          <h3 className="font-black text-chunky-dark text-lg">Configuración de Fritado</h3>
          <p className="text-sm font-bold text-gray-400">Vincula productos crudos con fritos, configúralos por puesto y edita sus botones rápidos.</p>
        </div>
        <button className="bg-chunky-main text-white font-black py-2 px-6 rounded-full shadow-sm hover:bg-chunky-secondary transition-colors" onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? 'Cancelar' : '+ Nueva Receta Fritado'}
        </button>
      </div>

      {showAdd && (
        <div className="bg-yellow-50 rounded-2xl p-6 border-2 border-yellow-200 mb-6 flex flex-wrap gap-4 items-end animate-fade-in">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-bold text-gray-400 block mb-1">🧊 Producto Origen (el que entra crudo)</label>
            <select className="w-full bg-white border-2 border-gray-200 rounded-xl px-3 py-2 font-bold text-chunky-dark outline-none focus:border-chunky-main" value={newRecipe.crudoId} onChange={(e) => setNewRecipe({...newRecipe, crudoId: e.target.value})}>
              <option value="">Seleccionar origen...</option>
              {allProducts.map(p => <option key={p.id} value={p.id}>{itemLabel(p)}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-bold text-gray-400 block mb-1">🔥 Producto Destino (el que sale frito)</label>
            <select className="w-full bg-white border-2 border-gray-200 rounded-xl px-3 py-2 font-bold text-chunky-dark outline-none focus:border-chunky-main" value={newRecipe.fritoId} onChange={(e) => setNewRecipe({...newRecipe, fritoId: e.target.value})}>
              <option value="">Seleccionar destino...</option>
              {allProducts.map(p => <option key={p.id} value={p.id}>{itemLabel(p)}</option>)}
            </select>
          </div>
          <button className="bg-green-500 text-white font-black py-2 px-6 rounded-xl hover:bg-green-600 disabled:opacity-50 transition-colors w-full md:w-auto mt-2 md:mt-0" 
            disabled={!newRecipe.crudoId || !newRecipe.fritoId}
            onClick={() => { addFritadoRecipe(newRecipe); setShowAdd(false); setNewRecipe({ crudoId: '', fritoId: '', presets: [10, 20, 50, 100, 200], productionPointIds: [] }); }}>
            Guardar
          </button>
        </div>
      )}

      <div className="space-y-4">
        {(fritadoRecipes || []).map(recipe => {
          const isEditing = editingId === recipe.id;
          const crudo = inventory.find(i => i.id === recipe.crudoId);
          const frito = inventory.find(i => i.id === recipe.fritoId);
          const presets = recipe.presets || [10, 20, 50, 100, 200];

          return (
            <div key={recipe.id} className="border border-gray-100 rounded-3xl p-5 hover:border-gray-200 bg-white transition-colors shadow-sm">
              <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-5">
                <div className="flex items-center gap-2 md:gap-4 flex-wrap">
                  <div className="bg-gray-50 px-4 py-2 rounded-xl text-center border-2 border-gray-100 flex-1 min-w-[120px]">
                    <span className="text-[10px] text-gray-400 font-bold block uppercase">Crudo (Descontado)</span>
                    <span className="font-black text-chunky-dark text-md md:text-lg">{crudo?.name || 'Desconocido'}</span>
                  </div>
                  <span className="text-gray-300 text-xl font-bold">➡️</span>
                  <div className="bg-yellow-50 px-4 py-2 rounded-xl text-center border-2 border-yellow-200 flex-1 min-w-[120px]">
                    <span className="text-[10px] text-yellow-600 font-bold block uppercase">Frito (Sumado)</span>
                    <span className="font-black text-chunky-dark text-md md:text-lg">{frito?.name || 'Desconocido'}</span>
                  </div>
                </div>
                
                <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors shrink-0" onClick={() => deleteFritadoRecipe(recipe.id)} title="Eliminar receta">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"/><path d="m19 6-.867 14.142A2 2 0 0 1 16.138 22H7.862a2 2 0 0 1-1.995-1.858L5 6m5 0V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1-1v2"/></svg>
                </button>
              </div>

              {/* Fritado Line Assignments */}
              <div className="mb-4">
                <span className="font-bold text-xs text-gray-400 uppercase tracking-wide block mb-2">Asignado a las cocinas de fritado:</span>
                <div className="flex flex-wrap gap-2">
                  {(useInventoryStore.getState().fryKitchens || []).map(fk => (
                    <button
                      key={fk.id}
                      onClick={() => toggleFryKitchen(recipe.id, fk.id, recipe.fryKitchenIds || [])}
                      className={`px-3 py-1.5 rounded-full text-[11px] font-bold border-2 transition-all
                        ${(recipe.fryKitchenIds || []).length === 0 || (recipe.fryKitchenIds || []).includes(fk.id)
                          ? 'bg-chunky-dark text-white border-chunky-dark'
                          : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'}`}
                    >
                      {(recipe.fryKitchenIds || []).length === 0 ? `✓ ${fk.name}` : ((recipe.fryKitchenIds || []).includes(fk.id) ? `✓ ${fk.name}` : `+ ${fk.name}`)}
                    </button>
                  ))}
                </div>
                {(recipe.fryKitchenIds || []).length === 0 && <p className="text-[10px] items-center italic text-gray-400 mt-1">Al no seleccionar ninguna, el sistema asume que la receta está disponible en <span className="font-bold">todas</span> las cocinas de fritado.</p>}
              </div>

              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                <div className="flex justify-between items-center mb-3">
                  <span className="font-bold text-sm text-gray-500">Botones de Producción Rápida</span>
                  {!isEditing ? (
                    <button className="text-xs font-bold text-chunky-main hover:text-chunky-secondary flex items-center gap-1" onClick={() => handleStartEdit(recipe)}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                      Editar botones
                    </button>
                  ) : (
                    <div className="flex gap-2">
                       <button className="text-xs font-bold text-white bg-green-500 px-3 py-1.5 rounded-full hover:bg-green-600 shadow-sm" onClick={() => handleSaveEdit(recipe.id)}>Guardar</button>
                       <button className="text-xs font-bold text-gray-500 hover:text-gray-700 bg-white border border-gray-200 px-3 py-1.5 rounded-full shadow-sm" onClick={() => setEditingId(null)}>Cancelar</button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-5 gap-2 md:gap-3">
                  {(isEditing ? draftPresets : presets).map((val, idx) => (
                    <div key={idx} className="flex flex-col items-center gap-1">
                      <label className="text-[10px] font-bold text-gray-400">Btn {idx + 1}</label>
                      {isEditing ? (
                        <input type="number" min="1" className="w-full text-center font-black text-chunky-dark text-sm md:text-md border-2 border-chunky-main rounded-xl py-2 outline-none focus:border-chunky-secondary" value={draftPresets[idx] || ''} onChange={e => { const copy = [...draftPresets]; copy[idx] = e.target.value; setDraftPresets(copy); }} />
                      ) : (
                        <div className="w-full bg-white border-2 border-gray-200 hover:border-chunky-main hover:bg-yellow-50 transition-colors rounded-xl py-2 flex items-center justify-center shadow-sm">
                          <span className="font-black text-chunky-dark text-sm md:text-md">{val}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
        {(fritadoRecipes || []).length === 0 && (
          <div className="text-center py-10">
            <p className="text-gray-400 font-bold">No hay recetas de fritado configuradas.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Vista Principal de Administrador ────────────────────────────────────────
// ─── Hook: Monitoreo de almacenamiento Supabase ──────────────────────────────
function useDbSize() {
  const [dbInfo, setDbInfo] = useState(null);
  useEffect(() => {
    const check = async () => {
      try {
        const { data, error } = await supabase.rpc('get_db_size');
        if (!error && data) {
          const bytes = data.size_bytes || 0;
          const limitBytes = 500 * 1024 * 1024; // 500 MB (plan gratuito)
          const pct = Math.round((bytes / limitBytes) * 100);
          setDbInfo({ bytes, pretty: data.size_pretty, pct, limit: '500 MB' });
        }
      } catch (_) {}
    };
    check();
    const interval = setInterval(check, 5 * 60 * 1000); // Revisar cada 5 min
    return () => clearInterval(interval);
  }, []);
  return dbInfo;
}

// ─── Panel de Nómina para Admin ───────────────────────────────────────────────
function NominaAdminPanel({ fmtMoney }) {
  const payrollRecords = usePayrollStore(s => s.payrollRecords);
  const { updatePayrollRow, deletePayrollRecord, deletePayrollRow } = usePayrollStore.getState();
  const fmt = fmtMoney || ((v) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v || 0));

  if (payrollRecords.length === 0) {
    return (
      <div className="text-center py-16">
        <span className="text-6xl block mb-4">👥</span>
        <p className="font-black text-gray-400 text-lg">No hay registros de nómina aún</p>
        <p className="text-gray-300 font-bold text-sm mt-1">Los registros aparecerán aquí cuando se guarden desde el módulo de Nómina</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-black text-chunky-dark text-xl">👥 Nómina y Pago a Personal</h3>
          <p className="text-xs text-gray-400 font-bold mt-0.5">Edita directamente cualquier celda — los cambios se sincronizan automáticamente</p>
        </div>
        <span className="bg-violet-100 text-violet-700 text-xs font-black px-3 py-1.5 rounded-full">{payrollRecords.length} período(s)</span>
      </div>

      {[...payrollRecords].sort((a,b) => b.periodo.localeCompare(a.periodo)).map((rec) => {
        const totalRec = rec.filas.reduce((s,f) => s + (Number(f.nomina)||0) + (Number(f.extras)||0) + (Number(f.vacaciones)||0) + (Number(f.liquidacion)||0), 0);
        return (
          <div key={rec.id} className="border border-violet-100 rounded-2xl overflow-hidden shadow-sm">
            {/* Header del período */}
            <div className="bg-gradient-to-r from-violet-50 to-purple-50 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center text-xl">📅</div>
                <div>
                  <p className="font-black text-violet-800">{rec.periodo}</p>
                  <p className="text-xs font-bold text-violet-400">{rec.filas.length} empleados · Creado por {rec.creadoPor || '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-xs font-bold text-violet-400">Total período</p>
                  <p className="font-black text-violet-700 text-lg">{fmt(totalRec)}</p>
                </div>
                <button
                  onClick={() => { if (window.confirm(`¿Eliminar la nómina de ${rec.periodo}?`)) deletePayrollRecord(rec.id); }}
                  className="w-8 h-8 rounded-full bg-red-50 text-red-400 hover:bg-red-100 flex items-center justify-center transition-colors"
                  title="Eliminar período"
                >✕</button>
              </div>
            </div>

            {/* Tabla editable */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm whitespace-nowrap">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase text-left">Empleado</th>
                    <th className="py-3 px-4 text-[10px] font-bold text-emerald-500 uppercase text-right">Nómina</th>
                    <th className="py-3 px-4 text-[10px] font-bold text-blue-500 uppercase text-right">Extras</th>
                    <th className="py-3 px-4 text-[10px] font-bold text-amber-500 uppercase text-right">Vacaciones</th>
                    <th className="py-3 px-4 text-[10px] font-bold text-red-500 uppercase text-right">Liquidación</th>
                    <th className="py-3 px-4 text-[10px] font-bold text-violet-600 uppercase text-right">Total</th>
                    <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase">Observaciones</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rec.filas.map((fila, filaIdx) => {
                    const totalFila = (Number(fila.nomina)||0)+(Number(fila.extras)||0)+(Number(fila.vacaciones)||0)+(Number(fila.liquidacion)||0);
                    const filaKey = fila.id || `idx-${filaIdx}`;
                    const EditCell = ({ campo, color }) => (
                      <td className="py-2 px-2 text-right">
                        <input
                          type="number" min="0"
                          className={`w-24 text-right font-bold text-sm border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-200 transition-all ${color}`}
                          defaultValue={fila[campo] || ''}
                          onBlur={(e) => updatePayrollRow(rec.id, filaKey, { [campo]: Number(e.target.value)||0 })}
                        />
                      </td>
                    );
                    return (
                      <tr key={filaKey} className="hover:bg-violet-50/30 transition-colors">
                        <td className="py-2 px-4">
                          <input
                            type="text"
                            className="font-bold text-sm border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-200 w-40 transition-all"
                            defaultValue={fila.empleadoNombre || fila.nombre || ''}
                            onBlur={(e) => updatePayrollRow(rec.id, filaKey, { empleadoNombre: e.target.value })}
                          />
                        </td>
                        <EditCell campo="nomina"      color="text-emerald-700" />
                        <EditCell campo="extras"      color="text-blue-700" />
                        <EditCell campo="vacaciones"  color="text-amber-700" />
                        <EditCell campo="liquidacion" color="text-red-700" />
                        <td className="py-2 px-4 text-right font-black text-violet-700">{fmt(totalFila)}</td>
                        <td className="py-2 px-4">
                          <input
                            type="text"
                            className="font-bold text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-violet-400 w-36 text-gray-500 transition-all"
                            defaultValue={fila.observacion || fila.notas || ''}
                            onBlur={(e) => updatePayrollRow(rec.id, filaKey, { observacion: e.target.value })}
                          />
                        </td>
                        <td className="py-2 px-2">
                          <button
                            onClick={() => deletePayrollRow(rec.id, filaKey)}
                            className="w-7 h-7 rounded-full bg-red-50 text-red-400 hover:bg-red-100 flex items-center justify-center transition-colors text-sm font-black"
                            title="Eliminar empleado"
                          >✕</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Fila de totales */}
                <tfoot>
                  <tr className="bg-violet-50 border-t-2 border-violet-200">
                    <td className="py-3 px-4 font-black text-violet-700 text-xs uppercase tracking-wider">TOTAL</td>
                    {['nomina','extras','vacaciones','liquidacion'].map(campo => (
                      <td key={campo} className="py-3 px-4 text-right font-black text-violet-800">
                        {fmt(rec.filas.reduce((s,f) => s+(Number(f[campo])||0), 0))}
                      </td>
                    ))}
                    <td className="py-3 px-4 text-right font-black text-violet-900 text-base">{fmt(totalRec)}</td>
                    <td />
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function AdminView() {
  const signOut = useAuthStore((s) => s.signOut);
  const navigate = useNavigate();
  const { inventory } = useInventoryStore();
  const [activeTab, setActiveTab] = useState('BODEGAS');
  const [showBiometricsModal, setShowBiometricsModal] = useState(false);
  const dbInfo = useDbSize();
  const scrollContainerRef = React.useRef(null);

  const TABS_BY_CATEGORY = {
    INVENTARIO: [
      { id: 'BODEGAS',    label: '📦 Bodegas'    },
      { id: 'PRODUCCION', label: '🏭 Producción'  },
      { id: 'COCINAS_FRITADO', label: '🍳 Cocinas Fritado' },
      { id: 'INVENTARIO', label: '📋 Inventario'  },
      { id: 'ITEM_TYPES', label: '🏷️ Tipos de Ítem' },
      { id: 'POS_INVENTORY', label: '⚙️ Inventario Modular' },
    ],
    POS: [
      { id: 'POS_CONFIG',     label: '⚙️ Hardware & Pagos' },
      { id: 'POS_FEED',       label: '🎨 Menú & Feed POS' },
      { id: 'POS_OLACLICK',   label: '🔌 Integración OlaClick' },
      { id: 'POS_REWARDS',    label: '🎁 Premios & Gamificación' },
      { id: 'POS_CARPETAS',   label: '🗂️ Carpetas POS' },
      { id: 'POS_ITEM_TYPES', label: '🏷️ Tipos de Ítem' },
      { id: 'POS_HISTORY',    label: '🧾 Historial POS' },
      { id: 'POS_CIERRES',    label: '📊 Historial Cierres Z' },
      { id: 'CONTRATAS',      label: '🤝 Contratas' },
      { id: 'TICKET_CONFIG',  label: '🧾 Diseño Tickets' },
    ],
    FLOTA: [
      { id: 'INVENTARIO_FLOTA', label: '📊 Inventario en Ruta' },
      { id: 'VEHICULOS',  label: '🛵 Triciclos & Vehículos' },
      { id: 'PRECIOS',    label: '🛺 Productos Triciclos' },
      { id: 'CIERRES',    label: '💰 Cierres Finanzas' },
      { id: 'GEOCERCAS',  label: '🛡️ Geocercas & Pedidos' },
      { id: 'CHAT_AUDIT', label: '💬 Auditoría Chat & Radio' },
    ],
    FINANZAS: [
      { id: 'INGRESOS',   label: '💰 Ingresos' },
      { id: 'EGRESOS',    label: '💸 Egresos' },
      { id: 'FUENTES_ING',label: '💵 Fuentes de Ingreso' },
      { id: 'PROVEEDORES',label: '🤝 Proveedores (Gastos)' },
      { id: 'NOMINA',     label: '👥 Nómina' },
    ],
    SISTEMA: [
      { id: 'SEDES',            label: '🏢 Sedes y Sucursales' },
      { id: 'BIOMETRICOS',      label: '⏱️ Biométricos (ISAPI)' },
      { id: 'TAREAS',           label: '📋 Tareas & Supervisión' },
      { id: 'PERMISOS_MANAGER', label: '🔑 Permisos Gerentes' },
      { id: 'USUARIOS',         label: '👥 Usuarios del Sistema' },
      { id: 'REPORTES',         label: '📊 Reportes' },
      { id: 'RESET_GENERAL',    label: '🗑️ Reset General' },
    ]
  };

  const CATEGORIES = [
    { id: 'INVENTARIO', label: '📦 Inv. & Prod.', color: 'bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100' },
    { id: 'POS',        label: '💵 Punto de Venta', color: 'bg-green-50 text-green-600 border-green-100 hover:bg-green-100' },
    { id: 'FLOTA',      label: '🛵 Triciclos & Flota', color: 'bg-orange-50 text-orange-600 border-orange-100 hover:bg-orange-100' },
    { id: 'FINANZAS',   label: '💰 Finanzas', color: 'bg-purple-50 text-purple-600 border-purple-100 hover:bg-purple-100' },
    { id: 'SISTEMA',    label: '⚙️ Sistema', color: 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-200' },
  ];

  const [activeCategory, setActiveCategory] = useState('INVENTARIO');

  const lowStockCount = inventory.filter((i) => i.qty <= i.alert).length;

  return (
    <div className="min-h-screen p-3 sm:p-4 md:p-8 flex flex-col items-center" style={{ background: 'var(--color-bg)' }}>
      <header className="bg-white rounded-[24px] sm:rounded-[32px] p-4 sm:p-6 mb-4 sm:mb-6 flex flex-col md:flex-row gap-3 md:gap-0 justify-between items-start md:items-center shadow-sm w-full max-w-[1400px]">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-chunky-dark leading-none">Admin</h1>
          <p className="text-xs sm:text-sm font-bold text-gray-400 mt-1">Panel de Control · Frita Mejor</p>
          {lowStockCount > 0 && (
            <span className="inline-block mt-2 bg-red-50 text-red-500 text-xs font-bold px-3 py-1 rounded-full">
              ⚠️ {lowStockCount} ítem{lowStockCount > 1 ? 's' : ''} bajo en stock
            </span>
          )}
          {/* Banner de almacenamiento Supabase */}
          {dbInfo && (
            <div className={`mt-2 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold ${
              dbInfo.pct >= 85 ? 'bg-red-50 text-red-600 border border-red-200' :
              dbInfo.pct >= 70 ? 'bg-amber-50 text-amber-600 border border-amber-200' :
              'bg-emerald-50 text-emerald-600 border border-emerald-200'
            }`}>
              <div style={{ width: 60, height: 6, borderRadius: 3, background: '#e5e7eb', overflow: 'hidden' }}>
                <div style={{
                  width: `${Math.min(dbInfo.pct, 100)}%`,
                  height: '100%',
                  borderRadius: 3,
                  background: dbInfo.pct >= 85 ? '#ef4444' : dbInfo.pct >= 70 ? '#f59e0b' : '#22c55e',
                  transition: 'width 0.5s ease'
                }} />
              </div>
              <span>💾 {dbInfo.pretty} / {dbInfo.limit} ({dbInfo.pct}%)</span>
              {dbInfo.pct >= 85 && <span className="animate-pulse">⚠️ ¡Casi lleno!</span>}
              {dbInfo.pct >= 70 && dbInfo.pct < 85 && <span>📢 Vigilar</span>}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 bg-amber-400 hover:bg-amber-500 text-gray-900 font-black text-sm px-4 py-2.5 rounded-full shadow-sm transition-all active:scale-95"
            title="Ir al Dashboard"
          >
            📊 Dashboard
          </button>
          <Button variant="outline" className="w-10 h-10 sm:w-12 sm:h-12 !min-w-0 !p-0 rounded-full flex items-center justify-center text-gray-400 border-gray-100 hover:bg-red-50" onClick={signOut} title="Cerrar sesión">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
          </Button>
        </div>
      </header>

      {/* Contenedor de Categorías */}
      <div className="w-full max-w-[1400px] mb-3 sm:mb-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => {
              setActiveCategory(cat.id);
              setActiveTab(TABS_BY_CATEGORY[cat.id][0].id); // Seleccionar el primer tab de la categoría
            }}
            className={`py-3 sm:py-4 px-3 sm:px-6 rounded-[18px] sm:rounded-[24px] border-2 transition-all font-black text-xs sm:text-lg flex items-center justify-center gap-1 sm:gap-3
              ${activeCategory === cat.id 
                ? 'bg-chunky-main border-chunky-main text-white shadow-md' 
                : `${cat.color} border-transparent opacity-70`}`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Tabs con Scroll */}
      <div className="relative w-full max-w-[1400px] mb-4 sm:mb-6 flex items-center bg-white rounded-full p-1.5 sm:p-2 shadow-sm border border-gray-100" style={{ overflow: 'visible' }}>
        <button 
          onClick={() => { if (scrollContainerRef.current) scrollContainerRef.current.scrollBy({ left: -200, behavior: 'smooth' }); }}
          className="z-10 w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center bg-gray-50 rounded-full text-gray-500 hover:bg-gray-200 transition-colors mx-0.5 sm:mx-1"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="15 18 9 12 15 6"/></svg>
        </button>

        <div 
          ref={scrollContainerRef}
          className="flex flex-1 mx-1 sm:mx-2 scroll-smooth items-center py-1"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', overflowX: 'auto', overflowY: 'visible' }}
        >
          <style>{`div::-webkit-scrollbar { display: none; }`}</style>
          <div className="flex gap-1.5 sm:gap-2 w-max" style={{ overflow: 'visible' }}>
            {TABS_BY_CATEGORY[activeCategory].map((tab) => (
              <button
                key={tab.id}
                className={`px-3 sm:px-5 py-2 sm:py-2.5 rounded-full font-bold text-xs sm:text-sm transition-colors whitespace-nowrap active:scale-95
                  ${activeTab === tab.id ? 'bg-chunky-dark text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100 hover:text-chunky-dark'}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <button 
          onClick={() => { if (scrollContainerRef.current) scrollContainerRef.current.scrollBy({ left: 200, behavior: 'smooth' }); }}
          className="z-10 w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center bg-gray-50 rounded-full text-gray-500 hover:bg-gray-200 transition-colors mx-0.5 sm:mx-1"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>

      {/* Contenido */}
      <div className="bg-white rounded-[28px] sm:rounded-[40px] p-4 sm:p-6 md:p-8 shadow-sm w-full max-w-[1400px] min-h-[400px] animate-fade-in">
        {activeTab === 'BODEGAS'    && <WarehousesPanel />}
        {activeTab === 'PRODUCCION' && <ProductionPointsPanel />}
        {activeTab === 'COCINAS_FRITADO' && <FryKitchensPanel />}
        {activeTab === 'PRODUCTOS'  && <ProductsPresetsPanel />}
        {activeTab === 'FRITADO'    && <FritadoConfigPanel />}
        {activeTab === 'INVENTARIO' && <InventoryPanel branchId={null} onOpenItemTypes={() => setActiveTab('ITEM_TYPES')} />}
        {(activeTab === 'ITEM_TYPES' || activeTab === 'POS_ITEM_TYPES') && <ItemTypesPanel />}
        {activeTab === 'USUARIOS'      && <AdminUsersTab />}
        { activeTab === 'RESET_GENERAL' && <ResetGeneralPanel /> }
        {activeTab === 'REPORTES'   && <ReportsPanel />}
        { activeTab === 'POS_CONFIG' && <PosConfigPanel /> }
        { activeTab === 'POS_FEED' && <PosFeedConfigPanel /> }
        { activeTab === 'POS_INVENTORY' && <PosInventoryConfigPanel /> }
        { activeTab === 'POS_OLACLICK' && <OlaClickConfigPanel /> }
        { activeTab === 'POS_REWARDS' && <LuckyRewardsConfigPanel /> }
        { activeTab === 'POS_HISTORY' && <PosHistoryPanel /> }
        { activeTab === 'POS_CIERRES' && <AdminFinancesTab mode="POS" /> }

        { activeTab === 'CONTRATAS' && <AdminContratasTab /> }
        { activeTab === 'TICKET_CONFIG' && <AdminTicketConfigTab /> }
        { activeTab === 'POS_CARPETAS' && <PosCategoriesPanel /> }
        { activeTab === 'CIERRES' && <AdminFinancesTab mode="VENDEDOR" /> }

        { activeTab === 'INGRESOS' && <AdminIncomesExpensesTab defaultTab="ingresos" /> }
        { activeTab === 'EGRESOS'  && <AdminIncomesExpensesTab defaultTab="gastos" /> }
        { activeTab === 'PRECIOS' && <AdminPricesTab /> }

        { activeTab === 'INVENTARIO_FLOTA' && <AdminVehicleInventoryTab /> }
        { activeTab === 'VEHICULOS' && <AdminVehiclesTab /> }
        { activeTab === 'GEOCERCAS' && <AdminGeofencesTab /> }
        { activeTab === 'CHAT_AUDIT' && <AdminChatAuditTab /> }
        { activeTab === 'FUENTES_ING' && <AdminIncomeSourcesTab /> }
        { activeTab === 'PROVEEDORES' && <AdminSuppliersTab /> }
        { activeTab === 'NOMINA' && <NominaAdminPanel /> }

        {/* Nuevas pestañas multisede */}
        { activeTab === 'SEDES' && <GlobalSettingsPanel /> }
        { activeTab === 'BIOMETRICOS' && <AdminTerminalsTab /> }
        { activeTab === 'TAREAS' && <AdminTasksConfigPanel /> }
        { activeTab === 'PERMISOS_MANAGER' && <PermissionsPanel /> }
      </div>

      {showBiometricsModal && (
        <AdminEmployeeBiometricsModal onClose={() => setShowBiometricsModal(false)} />
      )}
    </div>
  );
}
