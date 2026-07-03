import React, { useState, useEffect } from 'react';
import { useInventoryStore } from '../../../store/useInventoryStore';
import toast from 'react-hot-toast';
import { Gift, Sliders, DollarSign, Clock, Percent, Award, CheckCircle2, Save, Sparkles } from 'lucide-react';

export function LuckyRewardsConfigPanel() {
  const { posSettings, updatePosSettings, branches, posRegisters } = useInventoryStore();

  const activeBranches = branches && branches.length > 0 
    ? branches 
    : [
        { id: 'GLOBAL', name: 'Sede Principal (Global)' },
        { id: 'SEDE-001', name: 'Sede Centro' },
        { id: 'SEDE-002', name: 'Sede Norte' }
      ];

  const [selectedBranchId, setSelectedBranchId] = useState(activeBranches[0]?.id || 'GLOBAL');
  const [selectedRegisterId, setSelectedRegisterId] = useState('ALL');

  // Filtrar cajas registradoras por sede seleccionada si aplica
  const branchRegisters = posRegisters && posRegisters.length > 0
    ? posRegisters.filter(r => r.branchId === selectedBranchId || selectedBranchId === 'GLOBAL')
    : [];

  const defaultHourlyDist = {
    '06-10': 15,
    '10-12': 8,
    '12-14': 10,
    '14-16': 7,
    '16-19': 45,
    '19-21': 15
  };

  const currentConfigs = posSettings?.luckyRewardsConfig || {};
  const currentBranchConfig = currentConfigs[selectedBranchId] || {};
  const currentRegisterConfig = currentBranchConfig[selectedRegisterId] || {
    enabled: false,
    dailyPrizes: 100,
    minPurchaseAmount: 15000,
    prizeType: 'RASPA_Y_GANA', // 'RASPA_Y_GANA' | 'DISCOUNT'
    discountPercentage: 10,
    hourlyDistribution: { ...defaultHourlyDist }
  };

  const [formData, setFormData] = useState(currentRegisterConfig);

  useEffect(() => {
    const loaded = currentConfigs[selectedBranchId]?.[selectedRegisterId] || {
      enabled: false,
      dailyPrizes: 100,
      minPurchaseAmount: 15000,
      prizeType: 'RASPA_Y_GANA',
      discountPercentage: 10,
      hourlyDistribution: { ...defaultHourlyDist }
    };
    setFormData(loaded);
  }, [selectedBranchId, selectedRegisterId, posSettings]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleHourlyChange = (slot, val) => {
    const num = parseInt(val, 10) || 0;
    setFormData(prev => ({
      ...prev,
      hourlyDistribution: {
        ...(prev.hourlyDistribution || defaultHourlyDist),
        [slot]: num
      }
    }));
  };

  const handleSave = async () => {
    const updated = {
      ...(posSettings?.luckyRewardsConfig || {}),
      [selectedBranchId]: {
        ...(posSettings?.luckyRewardsConfig?.[selectedBranchId] || {}),
        [selectedRegisterId]: formData
      }
    };

    try {
      await updatePosSettings({ luckyRewardsConfig: updated });
      toast.success('Configuración de Premios y Gamificación guardada con éxito', {
        icon: '🎁'
      });
    } catch (err) {
      console.error('[LuckyRewardsConfig] Error al guardar:', err);
      toast.error('No se pudo guardar la configuración');
    }
  };

  const totalPercentage = Object.values(formData.hourlyDistribution || defaultHourlyDist).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      {/* Selector de Sede y Caja */}
      <div className="bg-[#181a23] p-5 rounded-3xl border border-gray-800 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center text-2xl shadow-inner border border-amber-500/20">
            🎁
          </div>
          <div>
            <h3 className="text-base font-black text-white flex items-center gap-2">
              Campana de la Suerte & Premiación Aleatoria
              <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30">
                PROMO
              </span>
            </h3>
            <p className="text-xs text-gray-400 font-semibold">
              Configura dinámica de premios y descuentos aleatorios por sede y caja
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Seleccionar Sede */}
          <div>
            <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Sede</label>
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="bg-[#12131a] text-white font-bold text-xs px-3 py-2 rounded-xl border border-gray-800 focus:border-amber-500 outline-none"
            >
              {activeBranches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          {/* Seleccionar Caja */}
          <div>
            <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Caja Registradora</label>
            <select
              value={selectedRegisterId}
              onChange={(e) => setSelectedRegisterId(e.target.value)}
              className="bg-[#12131a] text-white font-bold text-xs px-3 py-2 rounded-xl border border-gray-800 focus:border-amber-500 outline-none"
            >
              <option value="ALL">Todas las cajas (Por Defecto)</option>
              {branchRegisters.map((r) => (
                <option key={r.id} value={r.id}>{r.name || `Caja ${r.id}`}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Formulario Principal de Configuración */}
      <div className="bg-[#181a23] p-6 rounded-3xl border border-gray-800 shadow-xl space-y-6">
        
        {/* Switch Principal Activar */}
        <div className="flex items-center justify-between p-4 bg-[#12131a] rounded-2xl border border-gray-800">
          <div className="flex items-center gap-3">
            <Sparkles className={formData.enabled ? "text-amber-400 animate-pulse" : "text-gray-500"} size={22} />
            <div>
              <p className="text-sm font-black text-white">Activar Dinámica en esta Caja</p>
              <p className="text-xs text-gray-400">Los clientes calificados participarán aleatoriamente al cobrar en caja</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              checked={formData.enabled} 
              onChange={(e) => handleChange('enabled', e.target.checked)}
              className="sr-only peer" 
            />
            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          
          {/* 1. Monto Mínimo de Compra */}
          <div className="bg-[#12131a] p-4 rounded-2xl border border-gray-800 space-y-2">
            <label className="text-xs font-black text-gray-300 flex items-center gap-1.5">
              <DollarSign size={16} className="text-green-400" />
              Monto Mínimo para Participar ($)
            </label>
            <p className="text-[11px] text-gray-500">Ventas menores a este valor no participan.</p>
            <input
              type="number"
              value={formData.minPurchaseAmount}
              onChange={(e) => handleChange('minPurchaseAmount', parseInt(e.target.value, 10) || 0)}
              className="w-full bg-[#181a23] text-white font-black text-sm px-3 py-2.5 rounded-xl border border-gray-800 focus:border-amber-500 outline-none"
              placeholder="15000"
            />
          </div>

          {/* 2. Total Premios Diarios */}
          <div className="bg-[#12131a] p-4 rounded-2xl border border-gray-800 space-y-2">
            <label className="text-xs font-black text-gray-300 flex items-center gap-1.5">
              <Award size={16} className="text-amber-400" />
              Premios Totales por Día
            </label>
            <p className="text-[11px] text-gray-500">Cuota a repartir a lo largo de la jornada.</p>
            <input
              type="number"
              value={formData.dailyPrizes}
              onChange={(e) => handleChange('dailyPrizes', parseInt(e.target.value, 10) || 0)}
              className="w-full bg-[#181a23] text-white font-black text-sm px-3 py-2.5 rounded-xl border border-gray-800 focus:border-amber-500 outline-none"
              placeholder="100"
            />
          </div>

          {/* 3. Modalidad de Premio */}
          <div className="bg-[#12131a] p-4 rounded-2xl border border-gray-800 space-y-2">
            <label className="text-xs font-black text-gray-300 flex items-center gap-1.5">
              <Gift size={16} className="text-purple-400" />
              Modalidad de Premio
            </label>
            <p className="text-[11px] text-gray-500">¿Qué obtiene el cliente al ganar?</p>
            <select
              value={formData.prizeType}
              onChange={(e) => handleChange('prizeType', e.target.value)}
              className="w-full bg-[#181a23] text-white font-black text-xs px-3 py-2.5 rounded-xl border border-gray-800 focus:border-amber-500 outline-none"
            >
              <option value="RASPA_Y_GANA">🎟️ Tarjeta Raspa y Gana (Entregar en Físico)</option>
              <option value="DISCOUNT">🏷️ Descuento Inmediato en la Venta</option>
            </select>
          </div>

        </div>

        {/* Si la modalidad es Descuento Inmediato */}
        {formData.prizeType === 'DISCOUNT' && (
          <div className="bg-purple-500/10 border border-purple-500/20 p-4 rounded-2xl flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black text-purple-300 flex items-center gap-1">
                <Percent size={14} /> Porcentaje de Descuento Ganado
              </p>
              <p className="text-[11px] text-purple-400/80">Descuento automático que se aplicará al total de la cuenta del ganador.</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="100"
                value={formData.discountPercentage}
                onChange={(e) => handleChange('discountPercentage', parseInt(e.target.value, 10) || 0)}
                className="w-20 bg-[#12131a] text-white text-center font-black text-sm px-3 py-2 rounded-xl border border-purple-500/30 outline-none"
              />
              <span className="text-white font-black text-sm">%</span>
            </div>
          </div>
        )}

        {/* Distribución Horaria Ponderada */}
        <div className="bg-[#12131a] p-5 rounded-2xl border border-gray-800 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2 border-b border-gray-800 pb-3">
            <div>
              <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                <Clock size={16} className="text-amber-400" />
                Distribución de Premios por Franja Horaria (%)
              </h4>
              <p className="text-[11px] text-gray-400">Porcentaje de premios asignados a cada bloque del día (debe sumar 100%)</p>
            </div>
            <div className={`text-xs font-black px-3 py-1 rounded-full ${totalPercentage === 100 ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
              Suma Total: {totalPercentage}%
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { slot: '06-10', label: '6am - 10am', hint: 'Mañana' },
              { slot: '10-12', label: '10am - 12pm', hint: 'Pre-almuerzo' },
              { slot: '12-14', label: '12pm - 2pm', hint: 'Almuerzo' },
              { slot: '14-16', label: '2pm - 4pm', hint: 'Tarde' },
              { slot: '16-19', label: '4pm - 7pm', hint: 'Pico Máximo' },
              { slot: '19-21', label: '7pm - 9pm', hint: 'Cierre' }
            ].map(({ slot, label, hint }) => {
              const val = formData.hourlyDistribution?.[slot] ?? defaultHourlyDist[slot];
              const prizesForSlot = Math.round((formData.dailyPrizes * val) / 100);

              return (
                <div key={slot} className="bg-[#181a23] p-3 rounded-xl border border-gray-800/80 space-y-1.5 text-center">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">{label}</span>
                  <p className="text-[9px] text-amber-400/80 font-bold italic">{hint}</p>
                  <div className="flex items-center justify-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={val}
                      onChange={(e) => handleHourlyChange(slot, e.target.value)}
                      className="w-14 bg-[#12131a] text-white text-center font-black text-xs px-2 py-1.5 rounded-lg border border-gray-700 focus:border-amber-500 outline-none"
                    />
                    <span className="text-gray-400 font-bold text-xs">%</span>
                  </div>
                  <span className="text-[10px] text-gray-500 font-extrabold block">
                    ~{prizesForSlot} premios
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Botón Guardar */}
        <div className="pt-2 flex justify-end">
          <button
            onClick={handleSave}
            className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-gray-950 font-black text-xs px-6 py-3 rounded-xl shadow-lg transition-all active:scale-95 flex items-center gap-2"
          >
            <Save size={16} /> Guardar Configuración de Premios
          </button>
        </div>

      </div>
    </div>
  );
}
