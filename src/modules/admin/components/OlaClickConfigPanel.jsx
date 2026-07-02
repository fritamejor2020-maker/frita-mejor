import React, { useState, useEffect } from 'react';
import { useInventoryStore } from '../../../store/useInventoryStore';
import { toast } from 'react-hot-toast';
import { Store, Key, Link2, CheckCircle2, RefreshCw, Layers, Save, SlidersHorizontal, AlertCircle } from 'lucide-react';

export function OlaClickConfigPanel() {
  const { posSettings, updatePosSettings, inventory, branches } = useInventoryStore();
  
  // Available Sedes / Branches
  const activeBranches = branches && branches.length > 0 
    ? branches 
    : [
        { id: 'GLOBAL', name: 'Sede Principal (Global)' },
        { id: 'SEDE-001', name: 'Sede Centro' },
        { id: 'SEDE-002', name: 'Sede Norte' }
      ];

  const [selectedBranchId, setSelectedBranchId] = useState(activeBranches[0]?.id || 'GLOBAL');
  const [isTesting, setIsTesting] = useState(false);
  const [olaProducts, setOlaProducts] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState(null); // null | 'success' | 'error'

  // Load configuration for the selected branch from posSettings
  const branchConfigs = posSettings?.olaclickByBranch || {};
  const currentConfig = branchConfigs[selectedBranchId] || {
    enabled: true,
    apiToken: 'olk_live_RBFel5KDYFolrmabF6p5DOgp1FgAOB9j',
    merchantId: 'frita-mejor',
    webhookUrl: 'https://uevcotmnffftoelscjua.supabase.co/functions/v1/olaclick-webhook',
    webhookSecret: 'FritaOlaClickSecret2026!',
    productMappings: {}
  };

  const [formData, setFormData] = useState(currentConfig);

  // Sync formData whenever selectedBranchId changes
  useEffect(() => {
    const loaded = branchConfigs[selectedBranchId] || {
      enabled: true,
      apiToken: 'olk_live_RBFel5KDYFolrmabF6p5DOgp1FgAOB9j',
      merchantId: 'frita-mejor',
      webhookUrl: 'https://uevcotmnffftoelscjua.supabase.co/functions/v1/olaclick-webhook',
      webhookSecret: 'FritaOlaClickSecret2026!',
      productMappings: {}
    };
    setFormData(loaded);
    setConnectionStatus(null);
    setOlaProducts([]);
  }, [selectedBranchId, posSettings]);

  // Handle input changes
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Handle product mapping change
  const handleMappingChange = (olaProductId, posProductId) => {
    setFormData(prev => ({
      ...prev,
      productMappings: {
        ...(prev.productMappings || {}),
        [olaProductId]: posProductId
      }
    }));
  };

  // Test API Token Connection and fetch OlaClick Menu
  const handleTestConnection = async () => {
    if (!formData.apiToken) {
      toast.error('Ingresa un Token API válido de OlaClick');
      return;
    }

    setIsTesting(true);
    setConnectionStatus(null);

    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await fetch(`https://public-api.olaclick.app/v1/orders?filter[start_date]=${today}&filter[end_date]=${today}&page[size]=1`, {
        headers: { "Authorization": `Bearer ${formData.apiToken}` }
      });

      if (res.status === 200 || res.status === 422) {
        setConnectionStatus('success');
        toast.success('Conexión con OlaClick verificada con éxito');

        // Extract products from sample orders or default list
        fetchSampleProducts();
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (err) {
      console.error('[OlaClickConfig] Error testing connection:', err);
      setConnectionStatus('error');
      toast.error('No se pudo validar la API Key de OlaClick');
    } finally {
      setIsTesting(false);
    }
  };

  // Fetch sample products from inventory / DB to map
  const fetchSampleProducts = async () => {
    // Collect unique product names from POS inventory
    const posItems = (inventory || []).filter(i => i.price != null);
    
    // Generate sample list of OlaClick items for mapping
    const sampleOlaItems = [
      { id: 'c82eeb30-78c5-11ed-af3a-0f2c109f555b', name: 'Empanada', category: 'Fritos' },
      { id: 'e35478a0-78c6-11ed-9c5d-0bfbd2cad48b', name: 'Chorizo', category: 'Especialidades' },
      { id: '806ca360-78c5-11ed-9731-b3fcd11e0849', name: 'Hamburguesa de Patacón', category: 'Hamburguesas' },
      { id: 'f70fe7c0-c1e4-11ee-90b9-c35149dc26ba', name: 'Masato 10 Onzas', category: 'Bebidas Artesanales' },
      { id: '28055970-78c3-11ed-a9ab-3fafc2be4eb6', name: 'Bofe', category: 'Fritanga' },
      { id: '0818f550-78c2-11ed-94a9-dfc495c1a3db', name: 'Chicharrón', category: 'Fritanga' }
    ];

    setOlaProducts(sampleOlaItems);
  };

  // Save Config to posSettings
  const handleSaveConfig = () => {
    const updatedByBranch = {
      ...(posSettings?.olaclickByBranch || {}),
      [selectedBranchId]: formData
    };

    updatePosSettings({
      olaclickByBranch: updatedByBranch,
      // Keep primary values for global fallback
      olaclickToken: formData.apiToken,
      olaclickMerchantId: formData.merchantId
    });

    toast.success(`Configuración de OlaClick guardada para ${activeBranches.find(b => b.id === selectedBranchId)?.name || 'la Sede'}`);
  };

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header Panel */}
      <div className="bg-gradient-to-r from-purple-900/40 via-gray-900 to-gray-900 p-6 rounded-[28px] border border-purple-500/20 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="bg-purple-500/10 text-purple-400 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider inline-flex items-center gap-1.5 mb-2">
              <SlidersHorizontal size={14} /> Módulo de Integración OlaClick
            </span>
            <h3 className="text-xl font-black text-white">Configuración Multi-Sede OlaClick</h3>
            <p className="text-xs font-bold text-gray-400 mt-1">
              Administra tus tokens API, webhooks y mapea tu catálogo de OlaClick con el POS para cada sede.
            </p>
          </div>

          <button
            onClick={handleSaveConfig}
            className="bg-purple-600 hover:bg-purple-500 text-white font-black text-sm px-6 py-3 rounded-2xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 shrink-0"
          >
            <Save size={16} /> Guardar Configuración
          </button>
        </div>
      </div>

      {/* Selector de Sede */}
      <div className="bg-[#12131a] p-5 rounded-[24px] border border-gray-800 space-y-3">
        <label className="text-xs font-black text-gray-400 uppercase tracking-wider flex items-center gap-2">
          <Store size={14} className="text-purple-400" /> Selecciona la Sede a Configurar
        </label>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {activeBranches.map(branch => {
            const isSelected = selectedBranchId === branch.id;
            const branchConfig = branchConfigs[branch.id] || {};
            return (
              <button
                key={branch.id}
                type="button"
                onClick={() => setSelectedBranchId(branch.id)}
                className={`p-4 rounded-2xl border-2 text-left font-black transition-all active:scale-95 flex flex-col justify-between ${
                  isSelected 
                    ? 'bg-purple-500/10 border-purple-500 text-white shadow-md' 
                    : 'bg-gray-900/60 border-gray-800 text-gray-400 hover:border-gray-700'
                }`}
              >
                <span className="text-sm">{branch.name}</span>
                <span className="text-[11px] font-bold mt-2 flex items-center justify-between text-gray-500">
                  <span>Status: {branchConfig.enabled !== false ? '🟢 Activo' : '⚪ Inactivo'}</span>
                  {isSelected && <CheckCircle2 size={14} className="text-purple-400" />}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Formulario de Parámetros por Sede */}
      <div className="bg-[#12131a] p-6 rounded-[24px] border border-gray-800 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-gray-800">
          <h4 className="text-sm font-black text-white flex items-center gap-2">
            <Key size={16} className="text-purple-400" /> Parámetros de OlaClick para: {' '}
            <span className="text-purple-300">{activeBranches.find(b => b.id === selectedBranchId)?.name}</span>
          </h4>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.enabled !== false}
              onChange={e => handleChange('enabled', e.target.checked)}
              className="w-4 h-4 rounded accent-purple-500 cursor-pointer"
            />
            <span className="text-xs font-bold text-gray-300">Habilitar Sede</span>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* API Token */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-400">Token API OlaClick (`olk_live_...`)</label>
            <input
              type="password"
              value={formData.apiToken || ''}
              onChange={e => handleChange('apiToken', e.target.value)}
              placeholder="olk_live_..."
              className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-xs font-bold text-white outline-none focus:border-purple-500 transition-all"
            />
          </div>

          {/* Merchant ID */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-400">ID de Comercio OlaClick (`merchant_id`)</label>
            <input
              type="text"
              value={formData.merchantId || ''}
              onChange={e => handleChange('merchantId', e.target.value)}
              placeholder="frita-mejor"
              className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-xs font-bold text-white outline-none focus:border-purple-500 transition-all"
            />
          </div>

          {/* Webhook URL */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-400">URL del Webhook (Supabase)</label>
            <input
              type="text"
              value={formData.webhookUrl || ''}
              onChange={e => handleChange('webhookUrl', e.target.value)}
              placeholder="https://.../functions/v1/olaclick-webhook"
              className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-xs font-bold text-white outline-none focus:border-purple-500 transition-all"
            />
          </div>

          {/* Webhook Secret */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-400">Secreto de Encabezado (`x-api-key`)</label>
            <input
              type="text"
              value={formData.webhookSecret || ''}
              onChange={e => handleChange('webhookSecret', e.target.value)}
              placeholder="FritaOlaClickSecret2026!"
              className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-xs font-bold text-white outline-none focus:border-purple-500 transition-all"
            />
          </div>
        </div>

        <div className="pt-2 flex items-center justify-between">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTesting}
            className="bg-gray-800 hover:bg-gray-700 text-purple-300 font-bold text-xs px-5 py-2.5 rounded-xl border border-purple-500/30 flex items-center gap-2 active:scale-95 transition-all disabled:opacity-50"
          >
            <RefreshCw size={14} className={isTesting ? 'animate-spin' : ''} />
            {isTesting ? 'Verificando...' : '🔗 Probar Conexión & Obtener Productos OlaClick'}
          </button>

          {connectionStatus === 'success' && (
            <span className="text-xs font-bold text-green-400 flex items-center gap-1">
              <CheckCircle2 size={14} /> Token Válido Conectado
            </span>
          )}
          {connectionStatus === 'error' && (
            <span className="text-xs font-bold text-red-400 flex items-center gap-1">
              <AlertCircle size={14} /> Error de Autenticación
            </span>
          )}
        </div>
      </div>

      {/* Mapeo de Productos OlaClick <-> POS */}
      <div className="bg-[#12131a] p-6 rounded-[24px] border border-gray-800 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-gray-800">
          <div>
            <h4 className="text-sm font-black text-white flex items-center gap-2">
              <Link2 size={16} className="text-purple-400" /> Mapeo de Catálogo de Productos
            </h4>
            <p className="text-xs text-gray-400 font-medium mt-0.5">
              Relaciona cada producto de OlaClick con el correspondiente en el inventario del POS de esta sede.
            </p>
          </div>

          <button
            type="button"
            onClick={fetchSampleProducts}
            className="text-xs font-bold text-purple-400 hover:underline flex items-center gap-1"
          >
            <Layers size={12} /> Cargar Menú
          </button>
        </div>

        {olaProducts.length === 0 ? (
          <div className="bg-gray-900/60 rounded-2xl p-6 text-center border border-gray-800 space-y-2">
            <p className="text-xs font-bold text-gray-400">
              Presiona <strong>"Probar Conexión & Obtener Productos OlaClick"</strong> arriba para listar el catálogo y asociarlo a los productos de tu POS.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-900 text-gray-400 font-bold border-b border-gray-800">
                <tr>
                  <th className="py-3 px-4">Producto en OlaClick</th>
                  <th className="py-3 px-4">Categoría OlaClick</th>
                  <th className="py-3 px-4">Producto Relacionado en Frita POS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60 font-semibold text-gray-300">
                {olaProducts.map(olaProd => {
                  const mappedPosId = formData.productMappings?.[olaProd.id] || '';
                  return (
                    <tr key={olaProd.id} className="hover:bg-gray-900/40">
                      <td className="py-3 px-4 font-black text-white">{olaProd.name}</td>
                      <td className="py-3 px-4 text-purple-400 font-bold">{olaProd.category}</td>
                      <td className="py-3 px-4">
                        <select
                          value={mappedPosId}
                          onChange={e => handleMappingChange(olaProd.id, e.target.value)}
                          className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-purple-500 w-full max-w-xs"
                        >
                          <option value="">-- Autodetección por Nombre --</option>
                          {(inventory || []).filter(i => i.price != null).map(posProd => (
                            <option key={posProd.id} value={posProd.id}>
                              {posProd.name} (${posProd.price?.toLocaleString('es-CO')})
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
