import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import * as XLSX from 'xlsx';
import { Button } from '../../components/ui/Button';
import { useAuthStore, ROLE_ACCESS } from '../../store/useAuthStore';
import { useInventoryStore } from '../../store/useInventoryStore';
import { useFinanceStore } from '../../store/useFinanceStore';
import { useLogisticsStore } from '../../store/useLogisticsStore';
import { AdminFinancesTab, AdminIncomesTab, AdminExpensesTab, ResumenOperativoTab } from '../../components/admin/AdminFinancesTab';
import { AdminIncomesExpensesTab } from '../../components/admin/AdminIncomesExpensesTab';
import { AdminPricesTab } from '../../components/admin/AdminPricesTab';
import { AdminUsersTab } from '../../components/admin/AdminUsersTab';
import { AdminVehiclesTab } from '../../components/admin/AdminVehiclesTab';
import { AdminSuppliersTab } from '../../components/admin/AdminSuppliersTab';
import { ResetGeneralPanel } from '../../components/admin/ResetGeneralPanel';
import { AdminIncomeSourcesTab } from '../../components/admin/AdminIncomeSourcesTab';
import { AdminCustomerDiscountsTab } from '../../components/admin/AdminCustomerDiscountsTab';
import { AdminVehicleInventoryTab } from '../../components/admin/AdminVehicleInventoryTab';
import { formatMoney } from '../../utils/formatUtils';

// ─── Componente de fila editable genérica ─────────────────────────────────────
function EditableRow({ fields, values, onChange, onSave, onCancel }) {
  return (
    <div className="border-2 border-chunky-main rounded-2xl p-4 bg-yellow-50/30 space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        {fields.map((f) => (
          <div key={f.key} className={`${f.wide ? 'flex-1 min-w-[180px]' : 'w-28'}`}>
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">{f.label}</label>
            {f.options ? (
              <select className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-chunky-main" value={values[f.key] ?? ''} onChange={(e) => onChange(f.key, e.target.value)}>
                {f.options.map((o) => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
              </select>
            ) : (
              <input type={f.type ?? 'text'} className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-chunky-main" value={values[f.key] ?? ''} onChange={(e) => onChange(f.key, e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') onSave(); }} />
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" className="rounded-full text-sm py-2 px-6" onClick={onSave}>Guardar</Button>
        <Button variant="outline" className="rounded-full text-sm py-2 px-4 border-gray-200 text-gray-500" onClick={onCancel}>Cancelar</Button>
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
  const { productionPoints, products, inventory, addProductionPoint, updateProductionPoint, deleteProductionPoint, updateProduct, addProduct } = useInventoryStore();
  const [editId, setEditId] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', location: '' });

  const fields = [
    { key: 'name',     label: 'Nombre',     wide: true },
    { key: 'location', label: 'Sala/Área',  wide: true },
  ];
  const change = (k, v) => setForm((f) => ({ ...f, [k]: v }));

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

      <div className="space-y-3">
        {productionPoints.map((pp) => {
          const assigned = products.filter((p) => p.productionPointIds?.includes(pp.id));
          return editId === pp.id ? (
            <div key={pp.id}>
              <EditableRow fields={fields} values={form} onChange={change}
                onSave={() => { updateProductionPoint(pp.id, form); setEditId(null); }}
                onCancel={() => setEditId(null)} />
            </div>
          ) : (
            <div key={pp.id} className="border border-gray-100 rounded-2xl p-4 hover:border-gray-200 transition-colors">
              <div className="flex flex-wrap items-center gap-4">
                <div className="w-10 h-10 bg-yellow-50 rounded-xl flex items-center justify-center text-xl border border-yellow-100 shrink-0">🏭</div>
                <div className="flex-1 min-w-[140px]">
                  <span className="font-black text-chunky-dark block">{pp.name}</span>
                  <span className="text-gray-400 font-bold text-xs">{pp.location}</span>
                </div>
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${pp.active ? 'bg-green-50 text-green-500' : 'bg-gray-50 text-gray-400'}`}>{pp.active ? 'Activo' : 'Inactivo'}</span>
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

              {/* Productos asignados + selector */}
              <div className="mt-3 pl-14">
                <p className="text-xs font-bold text-gray-400 mb-2">Productos asignados:</p>
                <div className="flex flex-wrap gap-2">
                  {assigned.map((p) => (
                    <span key={p.id} className="bg-yellow-50 border border-yellow-100 text-xs font-bold px-3 py-1 rounded-full text-chunky-dark flex items-center gap-1">
                      {p.name}
                      <button className="text-gray-300 hover:text-red-400 ml-1" onClick={() => updateProduct(p.id, { productionPointIds: p.productionPointIds.filter(id => id !== pp.id) })}>✕</button>
                    </span>
                  ))}
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
                        className="bg-gray-50 border border-gray-200 text-xs font-bold px-3 py-1 rounded-full text-gray-500 outline-none max-w-[160px]"
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
                        <option value="">+ Asignar producto...</option>
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
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Panel: Cocinas de Fritado ────────────────────────────────────────────────
function FryKitchensPanel() {
  const { fryKitchens = [], addFryKitchen, updateFryKitchen, deleteFryKitchen } = useInventoryStore();
  const [editId, setEditId] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', location: '' });

  const fields = [
    { key: 'name',     label: 'Nombre de la Cocina', wide: true },
    { key: 'location', label: 'Ubicación/Zona',  wide: true },
  ];
  const change = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-black text-chunky-dark text-lg">Cocinas de Fritado ({(fryKitchens || []).length})</h3>
        <Button variant="secondary" className="rounded-full text-sm py-2 px-5 shadow-sm" onClick={() => { setShowAdd(true); setEditId(null); setForm({ name: '', location: '' }); }}>
          + Nueva Cocina
        </Button>
      </div>

      {showAdd && (
        <div className="mb-4">
          <EditableRow fields={fields} values={form} onChange={change}
            onSave={() => { addFryKitchen(form); setShowAdd(false); }}
            onCancel={() => setShowAdd(false)} />
        </div>
      )}

      {(fryKitchens || []).map((fk) => {
        const isEditing = editId === fk.id;
        return (
          <div key={fk.id} className="bg-white border border-gray-100 rounded-2xl p-4 mb-3 hover:border-gray-200 transition-colors shadow-sm flex flex-col md:flex-row justify-between md:items-center gap-4">
            <div className="flex-1">
              {isEditing ? (
                <EditableRow fields={fields} values={form} onChange={change}
                  onSave={() => { updateFryKitchen(fk.id, form); setEditId(null); }}
                  onCancel={() => setEditId(null)} />
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <h4 className="font-black text-gray-800 text-lg">🍳 {fk.name}</h4>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${fk.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
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
        );
      })}
    </div>
  );
}

// ─── Panel: Inventario General ────────────────────────────────────────────────
function InventoryPanel() {
  const { inventory, warehouses, posCategories, addInventoryItem, updateInventoryItem, deleteInventoryItem } = useInventoryStore();
  const [editingId, setEditingId] = useState(null);
  const [showAdd,   setShowAdd]   = useState(false);
  const [form,      setForm]      = useState({ name: '', qty: 0, unit: 'kg', tipo: 'INSUMO', estado: 'N/A', alert: 5, warehouseId: '', barcode: '', price: 0, posCategoryId: '', imageUrl: '' });
  const [filterWh,  setFilterWh]  = useState('ALL');

  const fields = [
    { key: 'name',        label: 'Nombre',          wide: true },
    { key: 'barcode',     label: 'Cód. de Barras',   wide: false },
    { key: 'warehouseId', label: 'Bodega',   options: [{ value: '', label: 'General' }, ...warehouses.map((w) => ({ value: w.id, label: w.name }))] },
    { key: 'tipo',        label: 'Tipo',     options: ['INSUMO', 'PRODUCTO'] },
    { key: 'estado',      label: 'Estado',   options: ['N/A', 'CRUDO', 'FRITO'] },
    { key: 'qty',         label: 'Cantidad', type: 'number' },
    { key: 'unit',        label: 'Unidad',   options: ['kg', 'g', 'L', 'mL', 'm', 'unidades', 'piezas'] },
    { key: 'alert',       label: 'Alerta en',type: 'number' },
    { key: 'price',       label: 'Precio ($)',type: 'number' },
    { key: 'posCategoryId', label: 'Carpetas POS', options: [{ value: '', label: 'Ninguna' }, ...(posCategories || []).map((c) => ({ value: c.id, label: c.name }))] },
    { key: 'imageUrl',    label: 'URL de Imagen (POS)', wide: true },
  ];

  // Convierte los dos campos vizuales en el campo 'type' real del item
  const buildType = (tipo, estado) => {
    if (tipo === 'INSUMO') return 'INSUMO';
    if (estado === 'CRUDO') return 'CRUDO';
    if (estado === 'FRITO') return 'FRITO';
    return 'PRODUCTO'; // PRODUCTO + N/A
  };

  // Descompone un 'type' existente en los dos campos visuales
  const decomposeType = (type) => {
    if (type === 'INSUMO')   return { tipo: 'INSUMO',   estado: 'N/A' };
    if (type === 'CRUDO')    return { tipo: 'PRODUCTO', estado: 'CRUDO' };
    if (type === 'FRITO')    return { tipo: 'PRODUCTO', estado: 'FRITO' };
    return                          { tipo: 'PRODUCTO', estado: 'N/A' };  // 'PRODUCTO'
  };

  const change = (k, v) => {
    if (editingId) setForm((f) => ({ ...f, [k]: v }));
    else setForm((f) => ({ ...f, [k]: v }));
  };

  const displayed = filterWh === 'ALL' ? inventory : inventory.filter((i) => i.warehouseId === filterWh);

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <h3 className="font-black text-chunky-dark text-lg">Inventario ({displayed.length} ítems)</h3>
        <div className="flex gap-2 flex-wrap">
          <select className="bg-gray-50 border border-gray-100 rounded-full px-4 py-2 text-sm font-bold text-gray-500 outline-none" value={filterWh} onChange={(e) => setFilterWh(e.target.value)}>
            <option value="ALL">Todas las bodegas</option>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <Button variant="secondary" className="rounded-full text-sm py-2 px-5 shadow-sm" onClick={() => { setShowAdd(true); setEditingId(null); setForm({ name: '', qty: 0, unit: 'kg', tipo: 'INSUMO', estado: 'N/A', alert: 5, warehouseId: '', barcode: '', price: 0, posCategoryId: '', imageUrl: '' }); }}>
            + Agregar ítem
          </Button>
        </div>
      </div>

      {showAdd && (
        <div className="mb-4">
          <EditableRow fields={fields} values={form} onChange={change}
            onSave={() => { if (form.name.trim()) { addInventoryItem({ ...form, qty: parseFloat(form.qty), alert: parseFloat(form.alert), price: parseFloat(form.price), type: buildType(form.tipo, form.estado) }); setShowAdd(false); } }}
            onCancel={() => setShowAdd(false)} />
        </div>
      )}

      <div className="space-y-2">
        {displayed.map((item) => {
          const wh = warehouses.find((w) => w.id === item.warehouseId);
          return editingId === item.id ? (
            <div key={item.id}>
              <EditableRow fields={fields} values={form} onChange={change}
                onSave={() => { updateInventoryItem(item.id, { ...form, qty: parseFloat(form.qty), alert: parseFloat(form.alert), price: parseFloat(form.price), type: buildType(form.tipo, form.estado) }); setEditingId(null); }}
                onCancel={() => setEditingId(null)} />
            </div>
          ) : (
            <div key={item.id} className="border border-gray-100 rounded-2xl p-4 flex flex-wrap items-center gap-3 hover:border-gray-200 transition-colors">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${
                item.type === 'INSUMO' ? 'bg-blue-50 text-blue-400' : 
                item.type === 'PRODUCTO' ? 'bg-green-50 text-green-500' :
                item.type === 'CRUDO' ? 'bg-orange-50 text-orange-500' :
                item.type === 'FRITO' ? 'bg-yellow-50 text-yellow-600' : 'bg-gray-100 text-gray-500'
              }`}>{item.type}</span>
              <div className="flex-1 min-w-[100px]">
                <span className="font-black text-chunky-dark block truncate">{item.name}</span>
                {item.barcode && (
                  <span className="text-[11px] font-bold text-gray-300 flex items-center gap-1 mt-0.5">
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 5v14"/><path d="M8 5v14"/><path d="M12 5v14"/><path d="M17 5v14"/><path d="M21 5v14"/></svg>
                    {item.barcode}
                  </span>
                )}
                {item.price > 0 && <span className="text-[11px] font-bold text-green-500 mt-0.5 block">Precio: {formatMoney(item.price)}</span>}
              </div>
              {wh && <span className="text-xs font-bold bg-gray-50 text-gray-400 px-2 py-0.5 rounded-full shrink-0">{wh.name}</span>}
              <span className={`font-black text-lg ${item.qty <= item.alert ? 'text-red-500' : 'text-chunky-dark'}`}>
                {item.qty}<span className="text-gray-400 font-bold text-xs ml-1">{item.unit}</span>
              </span>
              <div className="flex gap-2 ml-auto">
                <button className="text-gray-300 hover:text-chunky-main" onClick={() => { setEditingId(item.id); setForm({ name: item.name, qty: item.qty, unit: item.unit, ...decomposeType(item.type), alert: item.alert, warehouseId: item.warehouseId ?? '', barcode: item.barcode ?? '', price: item.price ?? 0, posCategoryId: item.posCategoryId ?? '' }); setShowAdd(false); }}>
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
  
  const logLoadHistory = useLogisticsStore(s => s.loadHistory) || [];
  const logCompleted = useLogisticsStore(s => s.completedRequests) || [];

  const [activeReport, setActiveReport] = useState('INVENTARIO');
  const [finSubtab, setFinSubtab] = useState('ingresos');

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
      Estado: s.status === 'PAID' ? 'PAGADO' : 'SUSPENDIDA',
      'Método Pago': s.paymentMethod || '—', Descuento: s.discountAmount || 0,
      Total: s.total || 0, Ítems: (s.items || []).map(i => `${i.name}x${i.qty}`).join(', ') || '—',
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
                      <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase">Estado</th>
                      <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase">Método</th>
                      <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase">Descuento</th>
                      <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {posSales.slice(0, 50).map((sale) => (
                      <tr key={sale.id} className="hover:bg-gray-50/50">
                        <td className="py-3 px-4 font-bold text-gray-600">{fmtDateTime(sale.timestamp)}</td>
                        <td className="py-3 px-4 font-bold text-chunky-dark">{sale.id?.replace('SALE-', '') || '—'}</td>
                        <td className="py-3 px-4"><span className={`text-xs font-bold px-2 py-1 rounded-full ${sale.status === 'PAID' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>{sale.status === 'PAID' ? 'PAGADO' : 'SUSPENDIDA'}</span></td>
                        <td className="py-3 px-4 font-bold text-gray-600">{sale.paymentMethod || '—'}</td>
                        <td className="py-3 px-4 text-orange-500 font-bold">{sale.discountAmount > 0 ? `-${fmtMoney(sale.discountAmount)}` : '—'}</td>
                        <td className="py-3 px-4 text-right font-black text-chunky-dark">{fmtMoney(sale.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {posSales.length > 50 && <p className="text-center text-xs text-gray-400 font-bold py-3">Mostrando 50 de {posSales.length}</p>}
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
        const byType = { INSUMO: 0, PRODUCTO: 0, CRUDO: 0, FRITO: 0 };
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
                    const typeColorMap = { INSUMO: 'bg-blue-50 text-blue-500', PRODUCTO: 'bg-green-50 text-green-500', CRUDO: 'bg-sky-50 text-sky-600', FRITO: 'bg-orange-50 text-orange-500' };
                    const typeIcon = { INSUMO: '📋', PRODUCTO: '📦', CRUDO: '🧊', FRITO: '🔥' };
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
  { value: 'ADMIN',     label: '⚙️ Administrador', color: 'bg-purple-50 text-purple-600' },
];
const USER_MODULE_LABELS = { produccion: '🏭 Producción', bodega: '📦 Bodega', pos: '💵 Caja', admin: '⚙️ Admin', 'vendedor-setup': '🔧 Conf. Vendedor', vendedor: '🚲 Vendedor', dejador: '🛵 Dejador', tracking: '🗺️ Rutas' };
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
  const { products, recipes, productionPoints, inventory, updateProduct, addProduct, deleteProduct } = useInventoryStore();
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

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-5">
        <div>
          <h3 className="font-black text-chunky-dark text-lg">Botones de Cantidad por Producto</h3>
          <p className="text-xs font-bold text-gray-400 mt-1">
            Edita los 5 valores o crea un nuevo botón de producción.
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
            onClick={() => { addProduct({ ...newProd, productionPointIds: [], linePresets: {} }); setShowAdd(false); setNewProd({ name: '', recipeId: '', unit: 'kg', outputInventoryId: '' }); }}>
            Guardar
          </button>
        </div>
      )}

      <div className="space-y-4">
        {products.map((prod) => {
          const recipe   = recipes.find((r) => r.id === prod.recipeId);
          const assignedPts = productionPoints.filter(pp => prod.productionPointIds?.includes(pp.id));

          return (
            <div key={prod.id} className="border border-gray-100 rounded-2xl p-5 hover:border-gray-200 transition-colors">
              <div className="mb-4 flex justify-between items-start">
                <div>
                  <h4 className="font-black text-chunky-dark">{prod.name}</h4>
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

              {assignedPts.length === 0 ? (
                <p className="text-sm font-bold text-gray-400">No asignado a ninguna línea de producción.</p>
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
    { key: 'active',          label: 'Activo',        options: [{ value: true, label: 'Sí' }, { value: false, label: 'No' }] },
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

// ─── Panel: Configuración POS General ──────────────────────────────────────────
function PosConfigPanel() {
  const { posSettings, updatePosSettings } = useInventoryStore();
  
  // Local state to handle array edits cleanly before saving
  const [methods, setMethods] = useState(posSettings?.paymentMethods || [
    { id: '1', name: 'EFECTIVO', openDrawer: true, printReceipt: true }
  ]);
  const [cashDrawerCode, setCashDrawerCode] = useState(posSettings?.cashDrawerCode || '\\x1B\\x70\\x00\\x19\\xFA');
  const [printerName, setPrinterName] = useState(posSettings?.printerName || 'POS-58');
  const [gridSize, setGridSize] = useState(posSettings?.gridSize || 'medium');

  const handleSave = () => {
    updatePosSettings({
      paymentMethods: methods,
      cashDrawerCode,
      printerName,
      gridSize
    });
    alert('Configuración POS guardada correctamente');
  };

  const handleAddMethod = () => {
    setMethods([...methods, { id: Date.now().toString(), name: 'NUEVO PAGO', openDrawer: false, printReceipt: true }]);
  };

  const handleUpdateMethod = (id, field, value) => {
    setMethods(methods.map(m => m.id === id ? { ...m, [field]: value } : m));
  };

  const handleRemoveMethod = (id) => {
    setMethods(methods.filter(m => m.id !== id));
  };

  return (
    <div className="max-w-3xl">
      <h3 className="font-black text-chunky-dark text-lg mb-6">Configuraciones POS (Caja)</h3>
      
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
                  <th className="py-3 px-4 w-1/2">Nombre del Método (ej. EFECTIVO)</th>
                  <th className="py-3 px-4 text-center">¿Abre Cajón?</th>
                  <th className="py-3 px-4 text-center">¿Imprime Ticket?</th>
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
          <input 
            type="text" 
            className="w-full max-w-sm bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 font-bold text-chunky-dark font-mono outline-none focus:border-chunky-main"
            value={cashDrawerCode}
            onChange={(e) => setCashDrawerCode(e.target.value)}
          />
        </div>

        <div>
          <label className="text-sm font-bold text-gray-400 block mb-2">Nombre de Impresora Principal</label>
          <input 
            type="text" 
            className="w-full max-w-sm bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 font-bold text-chunky-dark outline-none focus:border-chunky-main"
            value={printerName}
            onChange={(e) => setPrinterName(e.target.value)}
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

        <Button className="rounded-full text-md py-3 px-8 shadow-sm bg-chunky-secondary hover:opacity-90 mt-4" onClick={handleSave}>
          Guardar Configuraciones
        </Button>
      </div>
    </div>
  );
}

// ─── Panel: Historial POS (Ventas y Cierres Z) ────────────────────────────────
function PosHistoryPanel() {
  const { posShifts, posSales } = useInventoryStore();
  const [activeSubtab, setActiveSubtab] = useState('SHIFTS'); // SHIFTS | SALES

  const formatMoney = (val) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(val);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-black text-chunky-dark text-lg">Historial de Caja</h3>
        <div className="bg-gray-100 rounded-full p-1 inline-flex">
          <button className={`px-4 py-1.5 rounded-full text-sm font-bold ${activeSubtab === 'SHIFTS' ? 'bg-white shadow-sm text-chunky-dark' : 'text-gray-500 hover:text-gray-700'}`} onClick={() => setActiveSubtab('SHIFTS')}>Ver Turnos (Z)</button>
          <button className={`px-4 py-1.5 rounded-full text-sm font-bold ${activeSubtab === 'SALES' ? 'bg-white shadow-sm text-chunky-dark' : 'text-gray-500 hover:text-gray-700'}`} onClick={() => setActiveSubtab('SALES')}>Ver Ventas Totales</button>
        </div>
      </div>

      {activeSubtab === 'SHIFTS' && (
        <div className="space-y-4">
          {(posShifts || []).length === 0 ? (
            <p className="text-center text-gray-400 py-10 font-bold">No hay turnos registrados.</p>
          ) : (
            (posShifts || []).map(shift => (
              <div key={shift.id} className="border border-gray-100 rounded-2xl p-5 hover:border-gray-200 bg-white">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">💰</span>
                    <div>
                      <h4 className="font-black text-chunky-dark">Turno {shift.id.slice(-6)}</h4>
                      <p className="text-xs text-gray-500 font-bold">Cajero: {shift.userName || 'Desconocido'}</p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${shift.closedAt ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-600 animate-pulse'}`}>
                    {shift.closedAt ? 'CERRADO (Reporte Z)' : 'EN CURSO'}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-50">
                  <div>
                    <span className="block text-[10px] text-gray-400 font-bold uppercase">Apertura</span>
                    <span className="font-bold text-sm text-gray-700">{new Date(shift.openedAt).toLocaleString('es-CO')}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-gray-400 font-bold uppercase">Cierre</span>
                    <span className="font-bold text-sm text-gray-700">{shift.closedAt ? new Date(shift.closedAt).toLocaleString('es-CO') : '—'}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-gray-400 font-bold uppercase">Base Inicial</span>
                    <span className="font-black text-sm text-chunky-dark">{formatMoney(shift.initialAmount || 0)}</span>
                  </div>
                  {shift.closedAt && (
                    <div>
                      <span className="block text-[10px] text-gray-400 font-bold uppercase">Conteo Final de Caja</span>
                      <span className="font-black text-sm text-blue-600">{formatMoney(shift.realAmount || 0)}</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeSubtab === 'SALES' && (
        <div className="overflow-x-auto border border-gray-100 rounded-2xl">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 font-bold">
              <tr>
                <th className="py-3 px-4">Fecha</th>
                <th className="py-3 px-4">Ticket</th>
                <th className="py-3 px-4">Estado</th>
                <th className="py-3 px-4">Modo Pago</th>
                <th className="py-3 px-4">Descuento</th>
                <th className="py-3 px-4 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {(posSales || []).length === 0 ? (
                <tr><td colSpan="6" className="text-center text-gray-400 py-10 font-bold">No hay ventas registradas.</td></tr>
              ) : (
                (posSales || []).map(sale => (
                  <tr key={sale.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="py-3 px-4 text-gray-600">{new Date(sale.timestamp).toLocaleString('es-CO')}</td>
                    <td className="py-3 px-4 font-bold text-chunky-dark">{sale.id.replace('SALE-', '')}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${sale.status === 'PAID' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>
                        {sale.status === 'PAID' ? 'PAGADO' : 'SUSPENDIDA'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-gray-600">{sale.paymentMethod || '—'}</td>
                    <td className="py-3 px-4 text-orange-400">{sale.discountAmount > 0 ? `-${formatMoney(sale.discountAmount)}` : '—'}</td>
                    <td className="py-3 px-4 text-right font-black text-chunky-dark">{formatMoney(sale.total)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
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

  const allProducts = (inventory || []).filter(i => ['PRODUCTO', 'FRITO', 'CRUDO', 'INSUMO'].includes(i.type));
  // Helper: etiqueta un item con su tipo para que sea distinguible en dropdowns
  const itemLabel = (p) => {
    const badge = p.type === 'CRUDO' ? '🧊 CRUDO' : p.type === 'FRITO' ? '🔥 FRITO' : p.type === 'PRODUCTO' ? '📦 PRODUCTO' : p.type;
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

export function AdminView() {
  const signOut = useAuthStore((s) => s.signOut);
  const { inventory } = useInventoryStore();
  const [activeTab, setActiveTab] = useState('BODEGAS');
  const dbInfo = useDbSize();
  const scrollContainerRef = React.useRef(null);

  const TABS_BY_CATEGORY = {
    INVENTARIO: [
      { id: 'BODEGAS',    label: '📦 Bodegas'    },
      { id: 'PRODUCCION', label: '🏭 Producción'  },
      { id: 'COCINAS_FRITADO', label: '🍳 Cocinas Fritado' },
      { id: 'PRODUCTOS',  label: '🔢 Botones Prod.' },
      { id: 'FRITADO',    label: '🍳 Recetas Fritado' },
      { id: 'INVENTARIO', label: '📋 Inventario'  },
      { id: 'RECETAS',    label: '🧾 Recetas'     },
      { id: 'REPORTES',   label: '📊 Reportes'    },
    ],
    POS: [
      { id: 'POS_CONFIG',   label: '⚙️ Config Caja'  },
      { id: 'POS_CARPETAS', label: '🗂️ Carpetas POS' },
      { id: 'POS_HISTORY',  label: '🧾 Historial POS'},
      { id: 'CLIENTES',     label: '🤝 Clientes & Descuentos' },
    ],
    FLOTA: [
      { id: 'INVENTARIO_FLOTA', label: '📊 Inventario en Ruta' },
      { id: 'VEHICULOS',  label: '🛵 Triciclos & Vehículos' },
      { id: 'PRECIOS',    label: '🛺 Productos Triciclos' },
      { id: 'CIERRES',    label: '💰 Cierres Finanzas' },
    ],
    FINANZAS: [
      { id: 'INGRESOS',   label: '💰 Ingresos' },
      { id: 'EGRESOS',    label: '💸 Egresos' },
      { id: 'FUENTES_ING',label: '💵 Fuentes de Ingreso' },
      { id: 'PROVEEDORES',label: '🤝 Proveedores (Gastos)' },
    ],
    SISTEMA: [
      { id: 'USUARIOS',      label: '👥 Usuarios del Sistema' },
      { id: 'RESET_GENERAL', label: '🗑️ Reset General' },
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
        <Button variant="outline" className="w-10 h-10 sm:w-12 sm:h-12 !min-w-0 !p-0 rounded-full flex items-center justify-center text-gray-400 border-gray-100 hover:bg-red-50" onClick={signOut} title="Cerrar sesión">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
        </Button>
      </header>

      {/* Contenedor de Categorías */}
      <div className="w-full max-w-[1400px] mb-3 sm:mb-4 flex flex-wrap gap-2 sm:gap-3">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => {
              setActiveCategory(cat.id);
              setActiveTab(TABS_BY_CATEGORY[cat.id][0].id); // Seleccionar el primer tab de la categoría
            }}
            className={`flex-1 min-w-[140px] sm:min-w-[200px] py-3 sm:py-4 px-3 sm:px-6 rounded-[18px] sm:rounded-[24px] border-2 transition-all font-black text-sm sm:text-lg flex items-center justify-center gap-2 sm:gap-3
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
        {activeTab === 'INVENTARIO' && <InventoryPanel />}
        {activeTab === 'RECETAS'    && <RecipesPanel />}
        {activeTab === 'USUARIOS'      && <AdminUsersTab />}
        { activeTab === 'RESET_GENERAL' && <ResetGeneralPanel /> }
        {activeTab === 'REPORTES'   && <ReportsPanel />}
        { activeTab === 'POS_CONFIG' && <div className="space-y-12"><PosConfigPanel /><PosCategoriesPanel /></div> }
        { activeTab === 'POS_HISTORY' && <PosHistoryPanel /> }
        { activeTab === 'CLIENTES'  && <AdminCustomerDiscountsTab /> }
        { activeTab === 'POS_CARPETAS' && <PosCategoriesPanel /> }
        { activeTab === 'CIERRES' && <AdminFinancesTab /> }

        { activeTab === 'INGRESOS' && <AdminIncomesExpensesTab /> }
        { activeTab === 'EGRESOS'  && <AdminIncomesExpensesTab /> }
        { activeTab === 'PRECIOS' && <AdminPricesTab /> }

        { activeTab === 'INVENTARIO_FLOTA' && <AdminVehicleInventoryTab /> }
        { activeTab === 'VEHICULOS' && <AdminVehiclesTab /> }
        { activeTab === 'FUENTES_ING' && <AdminIncomeSourcesTab /> }
        { activeTab === 'PROVEEDORES' && <AdminSuppliersTab /> }
      </div>
    </div>
  );
}
