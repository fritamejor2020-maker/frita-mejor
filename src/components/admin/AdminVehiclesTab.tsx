import React, { useState } from 'react';
import { useVehicleStore } from '../../store/useVehicleStore';
import { Edit2, Trash2, Check, X, Truck, ShoppingCart, Store, Eye, EyeOff } from 'lucide-react';

// ── Icono + color por tipo de punto ───────────────────────────────────────────
const typeConfig: Record<string, { icon: React.ReactNode; color: string; badge: string; placeholder: string; abbr: string }> = {
  Triciclo: {
    icon: <Truck size={22} className="text-orange-500" strokeWidth={2.5} />,
    color: 'bg-orange-50 border-orange-100 hover:border-orange-300',
    badge: 'bg-orange-100 text-orange-600 border-orange-200',
    placeholder: 'Ej. T7',
    abbr: 'T',
  },
  Carrito: {
    icon: <ShoppingCart size={22} className="text-blue-500" strokeWidth={2.5} />,
    color: 'bg-blue-50 border-blue-100 hover:border-blue-300',
    badge: 'bg-blue-100 text-blue-600 border-blue-200',
    placeholder: 'Ej. C4',
    abbr: 'C',
  },
  Local: {
    icon: <Store size={22} className="text-emerald-500" strokeWidth={2.5} />,
    color: 'bg-emerald-50 border-emerald-100 hover:border-emerald-300',
    badge: 'bg-emerald-100 text-emerald-600 border-emerald-200',
    placeholder: 'Ej. L4',
    abbr: 'L',
  },
};

// ── Sección de una categoría ───────────────────────────────────────────────────
function VehicleSection({ type, vehicles, onEdit, onToggleActive, onRemove }: any) {
  const cfg = typeConfig[type];
  const items = vehicles.filter((v: any) => v.type === type);

  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-3 px-1">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${cfg.badge.split(' ').slice(0,1).join(' ')}`}>
          {cfg.icon}
        </div>
        <h4 className="text-lg font-black text-gray-800">{type}s</h4>
        <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${cfg.badge}`}>
          {items.filter((v: any) => v.active).length} activos / {items.length} total
        </span>
      </div>

      {items.length === 0 ? (
        <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl p-6 text-center">
          <p className="text-gray-400 font-bold text-sm">No hay {type.toLowerCase()}s configurados.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((v: any) => (
            <div
              key={v.id}
              className={`bg-white p-4 rounded-2xl border flex flex-col md:flex-row items-start md:items-center justify-between transition-all ${!v.active ? 'opacity-50 bg-gray-50' : cfg.color}`}
            >
              <div className="flex items-center gap-3 mb-3 md:mb-0">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${cfg.badge.split(' ').slice(0,1).join(' ')}`}>
                  {cfg.icon}
                </div>
                <div>
                  <span className={`font-black block text-base ${!v.active ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                    {v.name}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider border ${cfg.badge}`}>
                    CÓDIGO: {v.abbreviation}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 ml-14 md:ml-0">
                <button
                  onClick={() => onToggleActive(v.id, v.active)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all active:scale-95 ${
                    v.active
                      ? 'bg-green-100 text-green-600 border border-green-200 hover:bg-green-200'
                      : 'bg-red-100 text-red-500 border border-red-200 hover:bg-red-200'
                  }`}
                >
                  {v.active ? 'Activo' : 'Inactivo'}
                </button>
                <div className="h-5 w-px bg-gray-200 mx-1 hidden md:block" />
                <button
                  className="bg-gray-50 text-gray-400 hover:text-chunky-main hover:bg-gray-100 p-2 rounded-xl transition-all"
                  onClick={() => onEdit(v)}
                >
                  <Edit2 size={16} strokeWidth={2.5} />
                </button>
                <button
                  className="bg-red-50 text-red-400 hover:text-red-600 hover:bg-red-100 p-2 rounded-xl transition-all"
                  onClick={() => { if (confirm(`¿Eliminar ${v.name}?`)) onRemove(v.id); }}
                >
                  <Trash2 size={16} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Toggle de Vista ────────────────────────────────────────────────────────────
function ViewToggle({ label, emoji, enabled, onToggle }: { label: string; emoji: string; enabled: boolean; onToggle: () => void }) {
  return (
    <div className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${enabled ? 'bg-white border-green-200' : 'bg-gray-50 border-gray-200 opacity-75'}`}>
      <div className="flex items-center gap-3">
        <span className="text-2xl">{emoji}</span>
        <div>
          <p className="font-black text-gray-800 text-sm">{label}</p>
          <p className={`text-xs font-bold ${enabled ? 'text-green-600' : 'text-gray-400'}`}>
            {enabled ? 'Vista activa — los usuarios pueden acceder' : 'Vista desactivada — bloqueada para usuarios'}
          </p>
        </div>
      </div>
      <button
        onClick={onToggle}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl font-black text-sm transition-all active:scale-95 ${
          enabled
            ? 'bg-green-100 text-green-700 hover:bg-green-200'
            : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
        }`}
      >
        {enabled ? <Eye size={16} /> : <EyeOff size={16} />}
        {enabled ? 'Activa' : 'Inactiva'}
      </button>
    </div>
  );
}

// ── Tab Principal ──────────────────────────────────────────────────────────────
export function AdminVehiclesTab() {
  const {
    vehicles,
    addVehicle,
    updateVehicle,
    removeVehicle,
    sellerViewEnabled,
    dejadorViewEnabled,
    toggleSellerView,
    toggleDejadorView,
    enabledPointTypes,
    togglePointType,
  } = useVehicleStore() as any;

  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [name, setName]               = useState('');
  const [abbreviation, setAbbreviation] = useState('');
  const [vehicleType, setVehicleType]   = useState('Triciclo');

  const cfg = typeConfig[vehicleType];

  const handleEdit = (vehicle: any) => {
    setIsEditing(vehicle.id);
    setName(vehicle.name);
    setAbbreviation(vehicle.abbreviation || '');
    setVehicleType(vehicle.type || 'Triciclo');
  };

  const cancelEdit = () => {
    setIsEditing(null);
    setName('');
    setAbbreviation('');
    setVehicleType('Triciclo');
  };

  const handleSave = () => {
    if (!name || !abbreviation) return;
    if (isEditing) {
      updateVehicle(isEditing, { name, abbreviation, type: vehicleType });
      setIsEditing(null);
    } else {
      addVehicle({ name, abbreviation, type: vehicleType });
    }
    setName('');
    setAbbreviation('');
  };

  const toggleActive = (id: string, currentStatus: boolean) => {
    updateVehicle(id, { active: !currentStatus });
  };

  return (
    <div className="flex-1 p-4 space-y-8">

      {/* ── Toggles de Vista ─────────────────────────────────────────────── */}
      <div>
        <h3 className="text-xl font-black text-gray-800 mb-3">Control de Vistas</h3>
        <p className="text-xs font-bold text-gray-400 mb-4">
          Activa o desactiva el acceso de los usuarios a las pantallas de trabajo.
        </p>
        <div className="flex flex-col gap-3">
          <ViewToggle
            label="Vista Vendedor"
            emoji="🧾"
            enabled={sellerViewEnabled ?? true}
            onToggle={toggleSellerView}
          />
          <ViewToggle
            label="Vista Dejador"
            emoji="🚚"
            enabled={dejadorViewEnabled ?? true}
            onToggle={toggleDejadorView}
          />
        </div>

        {/* Tipos de punto visibles en el setup del Vendedor */}
        <div className="mt-5">
          <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">
            Tipos de punto habilitados en el Setup del Vendedor
          </p>
          <div className="flex flex-col gap-2">
            {(['Triciclo', 'Carrito', 'Local'] as const).map((type) => {
              const emojis: Record<string, string> = { Triciclo: '🛵', Carrito: '🛒', Local: '🏪' };
              const on = enabledPointTypes?.[type] ?? (type !== 'Local');
              return (
                <div
                  key={type}
                  className={`flex items-center justify-between px-4 py-3 rounded-2xl border-2 transition-all ${
                    on ? 'bg-white border-amber-200' : 'bg-gray-50 border-gray-200 opacity-60'
                  }`}
                >
                  <span className="font-black text-gray-700 text-sm flex items-center gap-2">
                    <span>{emojis[type]}</span> {type}
                  </span>
                  <button
                    onClick={() => togglePointType(type)}
                    className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all active:scale-95 ${
                      on
                        ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                        : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                    }`}
                  >
                    {on ? 'Visible' : 'Oculto'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <hr className="border-gray-100" />

      {/* ── Formulario ───────────────────────────────────────────────────── */}
      <div className="bg-[#FFD56B] rounded-[32px] p-6 shadow-sm relative overflow-hidden">
        <div className="relative z-10">
          <h3 className="text-2xl font-black text-gray-900 mb-4">
            {isEditing ? 'Editar Punto de Venta' : 'Añadir Nuevo Punto de Venta'}
          </h3>

          {/* Tipo */}
          <div className="flex gap-2 mb-4">
            {(['Triciclo', 'Carrito', 'Local'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setVehicleType(t)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-black transition-all active:scale-95 ${
                  vehicleType === t
                    ? 'bg-gray-900 text-white shadow-md'
                    : 'bg-white/60 text-gray-600 hover:bg-white/80'
                }`}
              >
                {t === 'Triciclo' ? '🛵' : t === 'Carrito' ? '🛒' : '🏪'} {t}
              </button>
            ))}
          </div>

          <div className="flex flex-col md:flex-row gap-4 items-end bg-white/60 backdrop-blur-md p-4 rounded-2xl border-2 border-white/50">
            <div className="flex-1 w-full">
              <label className="text-xs font-bold text-gray-600 uppercase block mb-1">Nombre</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={`Ej. ${vehicleType} Central`}
                className="w-full bg-white border-2 border-white hover:border-[#FFB700] rounded-xl py-3 px-4 text-gray-800 font-bold focus:border-[#FFB700] outline-none transition-colors shadow-sm"
              />
            </div>
            <div className="flex-1 w-full">
              <label className="text-xs font-bold text-gray-600 uppercase block mb-1">Abreviatura (Código)</label>
              <input
                type="text"
                value={abbreviation}
                onChange={(e) => setAbbreviation(e.target.value.toUpperCase())}
                placeholder={cfg.placeholder}
                className="w-full bg-white border-2 border-white hover:border-[#FFB700] rounded-xl py-3 px-4 text-gray-800 font-bold focus:border-[#FFB700] outline-none transition-colors shadow-sm"
              />
            </div>
            <div className="flex gap-2 w-full md:w-auto mt-2 md:mt-0">
              {isEditing && (
                <button onClick={cancelEdit} className="py-3 px-4 rounded-xl bg-gray-400 hover:bg-gray-500 text-white font-black shadow-sm transition-transform active:scale-95 flex items-center gap-2">
                  <X size={20} strokeWidth={3} /> Cancelar
                </button>
              )}
              <button
                onClick={handleSave}
                className="py-3 px-6 rounded-xl bg-frita-red hover:bg-red-500 text-white font-black shadow-sm transition-transform active:scale-95 flex items-center gap-2 flex-1 md:flex-none justify-center"
              >
                <Check size={20} strokeWidth={3} /> {isEditing ? 'Guardar' : 'Añadir'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Listas por tipo ──────────────────────────────────────────────── */}
      <div>
        <div className="flex justify-between items-center mb-5 px-1">
          <h3 className="text-xl font-black text-gray-800">Flota & Puntos de Venta</h3>
          <span className="text-xs font-bold text-gray-400 bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200 hidden md:block">
            💡 Toca el estado para activar / desactivar un punto
          </span>
        </div>

        {(['Triciclo', 'Carrito', 'Local'] as const).map((type) => (
          <VehicleSection
            key={type}
            type={type}
            vehicles={vehicles}
            onEdit={handleEdit}
            onToggleActive={toggleActive}
            onRemove={removeVehicle}
          />
        ))}
      </div>
    </div>
  );
}
