import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSellerSessionStore } from '../store/useSellerSessionStore';
import { useInventoryStore } from '../store/useInventoryStore';
import { useVehicleStore } from '../store/useVehicleStore';
import { useAuthStore } from '../store/useAuthStore';
import { push } from '../lib/syncManager';

import { supabase } from '../lib/supabase';

export const SellerSetupView = () => {
  const { user } = useAuthStore();
  const userBranchId = (user as any)?.branchId ?? null;
  const startShift = useSellerSessionStore((state) => state.startShift);
  const { isSetupComplete: sellerSetupComplete, shiftId: activeShiftId, endShift: clearSession } = useSellerSessionStore();
  const sellerViewEnabled = useVehicleStore((s: any) => s.sellerViewEnabled ?? true);
  const enabledPointTypes = useVehicleStore((s: any) => s.enabledPointTypes ?? { Triciclo: true, Carrito: true, Local: false });
  // remoteShifts: null = cargando, [] = sin turnos, [...] = turnos verificados en Supabase
  // Usamos fetch DIRECTO a Supabase en lugar del store para evitar que el localStorage
  // desactualizado del iPad muestre turnos ya cerrados como "en curso".
  const [remoteShifts, setRemoteShifts] = useState<any[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchAndVerify = async () => {
      try {
        // Fetch directo a Supabase — fuente de verdad real
        const { data } = await supabase
          .from('app_state')
          .select('value')
          .in('key', ['posShifts', 'posShifts_BRANCH-001', 'posShifts_master_history']);

        if (cancelled) return;

        if (data) {
          // Merge con "versión cerrada siempre gana"
          const shiftMap = new Map<string, any>();
          data.forEach((r: any) => {
            (r.value || []).forEach((s: any) => {
              if (!s?.id) return;
              const ex = shiftMap.get(s.id);
              if (!ex || (!ex.closedAt && s.closedAt)) shiftMap.set(s.id, s);
            });
          });

          const today = new Date().toISOString().slice(0, 10);
          let autoClosedCount = 0;

          const verified = Array.from(shiftMap.values()).map((s: any) => {
            if (!s.closedAt) {
              const shiftDate = (s.openedAt || s.fecha || s.date || '').slice(0, 10);
              if (shiftDate && shiftDate < today) {
                autoClosedCount++;
                return { ...s, closedAt: s.openedAt || new Date().toISOString(), _autoClosedStale: true };
              }
            }
            return s;
          });

          // Actualizar el store con la verdad remota
          useInventoryStore.setState({ posShifts: verified });
          setRemoteShifts(verified);

          // Si se auto-cerraron turnos huérfanos, actualizar Supabase
          if (autoClosedCount > 0) {
            const nowIso = new Date().toISOString();
            supabase.from('app_state').upsert([
              { key: 'posShifts', value: verified, updated_at: nowIso },
              { key: 'posShifts_BRANCH-001', value: verified, updated_at: nowIso },
            ]).catch(() => {});
          }

          // Si la sesión activa está cerrada en Supabase, limpiarla
          if (sellerSetupComplete && activeShiftId) {
            const myShift = verified.find((s: any) => s.id === activeShiftId);
            if (myShift?.closedAt) {
              console.log('[SellerSetup] Sesión activa ya cerrada en Supabase. Limpiando...');
              clearSession();
            }
          }
        }
      } catch (e) {
        // En caso de error de red, caer al store local pero marcarlo como cargado
        if (!cancelled) setRemoteShifts(useInventoryStore.getState().posShifts || []);
      }

      // También lanzar loadFromRemote para sincronizar todo el resto del store
      useInventoryStore.getState().loadFromRemote().catch(() => {});
    };

    fetchAndVerify();
    return () => { cancelled = true; };
  }, []);

  // activeOpenShifts: solo basado en datos VERIFICADOS con Supabase (remoteShifts)
  // Mientras carga (remoteShifts === null), devuelve [] para no mostrar banners falsos.
  const { myUserOpenShifts, otherOpenShifts } = useMemo(() => {
    if (remoteShifts === null) return { myUserOpenShifts: [], otherOpenShifts: [] };

    const today = new Date().toISOString().slice(0, 10);
    const currentUserName = String(user?.name || '').trim().toLowerCase();
    const currentUserId = String(user?.id || user?.username || '').trim().toLowerCase();

    const myMineMap = new Map<string, any>();
    const othersMap = new Map<string, any>();

    const isVendorUser = user?.role === 'VENDEDOR' || (user?.access || []).includes('vendedor');

    remoteShifts.forEach((s: any) => {
      if (s.type !== 'VENDEDOR' || s.closedAt) return;
      if (!user) return;

      // Descartar turnos huérfanos de fechas pasadas
      const shiftDate = (s.openedAt || s.fecha || s.date || '').slice(0, 10);
      if (shiftDate && shiftDate < today) return;

      const shiftResp = String(s.responsibleName || '').trim().toLowerCase();
      const shiftUid = String(s.userId || s.createdBy || '').trim().toLowerCase();

      const isMineByName = currentUserName.length > 0 && (shiftResp === currentUserName || shiftResp.includes(currentUserName) || currentUserName.includes(shiftResp));
      const isMineById = currentUserId.length > 0 && shiftUid === currentUserId;
      const isVendorMatch = isVendorUser && (!s.branchId || s.branchId === userBranchId || !userBranchId);

      const vehicleKey = String(s.pointId || s.vehicle || s.id).toLowerCase().replace(/[^a-z0-9]/g, '');

      if (isMineByName || isMineById) {
        const ex = myMineMap.get(vehicleKey);
        // Preservar solo el turno más reciente para el mismo vehículo hoy
        if (!ex || new Date(s.openedAt || 0).getTime() > new Date(ex.openedAt || 0).getTime()) {
          myMineMap.set(vehicleKey, s);
        }
      } else if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN' || user.role === 'MANAGER') {
        const ex = othersMap.get(vehicleKey);
        if (!ex || new Date(s.openedAt || 0).getTime() > new Date(ex.openedAt || 0).getTime()) {
          othersMap.set(vehicleKey, s);
        }
      }
    });

    return {
      myUserOpenShifts: Array.from(myMineMap.values()),
      otherOpenShifts: Array.from(othersMap.values())
    };
  }, [remoteShifts, user, userBranchId]);
  
  const activeOpenShifts = useMemo(() => {
    return [...myUserOpenShifts, ...otherOpenShifts];
  }, [myUserOpenShifts, otherOpenShifts]);
  
  const [pointType, setPointType] = useState('variable');
  const [pointId, setPointId] = useState('');
  const [shift, setShift] = useState('AM');
  const [responsibleName, setResponsibleName] = useState(user?.name || '');

  const allPointTypes = [
    { id: 'variable', label: 'Triciclo', vehicleType: 'Triciclo' },
    { id: 'local',    label: 'Carrito',  vehicleType: 'Carrito'  },
    { id: 'local2',   label: 'Local',    vehicleType: 'Local'    },
  ];

  // Solo mostrar los tipos que el admin habilitó
  const pointTypes = allPointTypes.filter(pt => enabledPointTypes[pt.vehicleType] !== false);

  const vehicles = useVehicleStore((state: any) => state.vehicles);
  const selectedTypeObj = pointTypes.find(pt => pt.id === pointType) ?? pointTypes[0];
  const allPointIds = vehicles
    .filter((v: any) =>
      v.active &&
      v.type === selectedTypeObj?.vehicleType &&
      (userBranchId === null || !v.branchId || v.branchId === userBranchId)
    )
    .map((v: any) => v.abbreviation || v.name);

  // Auto-cambiar jornada a PM si AM ya está cerrado para el vehículo seleccionado
  useEffect(() => {
    if (!pointId || !remoteShifts) return;
    const today = new Date().toISOString().slice(0, 10);
    const cleanPoint = String(pointId).toLowerCase().replace(/[^a-z0-9]/g, '');
    const isAmClosed = remoteShifts.some(
      (s: any) => s.type === 'VENDEDOR' &&
        String(s.pointId || '').toLowerCase().replace(/[^a-z0-9]/g, '') === cleanPoint &&
        s.shift === 'AM' &&
        s.closedAt &&
        (s.openedAt || s.fecha || '').startsWith(today)
    );
    if (isAmClosed && shift === 'AM') {
      setShift('PM');
    }
  }, [pointId, remoteShifts]);

  const navigate = useNavigate();

  // 🚀 SI EL VENDEDOR YA TIENE UN TURNO ABIERTO Y NO HA HECHO CIERRE DE SESIÓN:
  // ENTRAR DE UNA VEZ EN EL TURNO ACTIVO SIN MOSTRAR LA PANTALLA "CONFIGURA TU TURNO"
  useEffect(() => {
    if (sellerSetupComplete && activeShiftId) {
      navigate('/vendedor', { replace: true });
      return;
    }

    if (remoteShifts !== null && myUserOpenShifts && myUserOpenShifts.length > 0) {
      const activeShift = myUserOpenShifts[0];
      startShift({
        id: activeShift.id,
        pointId: activeShift.pointId || activeShift.vehicle,
        shift: activeShift.shift || 'AM',
        pointType: activeShift.pointType || 'variable',
        responsibleName: activeShift.responsibleName || user?.name,
        userId: activeShift.userId || user?.id || (user as any)?.username,
        openedAt: activeShift.openedAt,
        branchId: activeShift.branchId || userBranchId || 'BRANCH-001'
      });
      navigate('/vendedor', { replace: true });
    }
  }, [sellerSetupComplete, activeShiftId, remoteShifts, myUserOpenShifts, navigate, user, startShift, userBranchId]);

  const handleStartShift = async () => {
    const finalResponsibleName = responsibleName.trim() || user?.name || '';
    if (!pointId || !finalResponsibleName) {
      alert("Faltan datos");
      return;
    }

    const { posShifts, addPosShift } = useInventoryStore.getState();
    const shiftsList = remoteShifts || posShifts || [];
    const today = new Date().toISOString().slice(0, 10);
    const effectiveBranchId = userBranchId || 'BRANCH-001';
    const cleanBranch = String(effectiveBranchId).toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanPoint = String(pointId).toLowerCase().replace(/[^a-z0-9]/g, '');

    const currentUserName = String(user?.name || '').trim().toLowerCase();
    const currentUserId = String(user?.id || user?.username || '').trim().toLowerCase();

    // 0. Si el usuario ya tiene un turno ABIERTO activo hoy:
    if (myUserOpenShifts.length > 0) {
      const myShift = myUserOpenShifts[0];
      const samePointAndShift = String(myShift.pointId || '').toLowerCase().replace(/[^a-z0-9]/g, '') === cleanPoint && myShift.shift === shift;
      if (samePointAndShift) {
        startShift({
          id: myShift.id,
          pointId: myShift.pointId,
          shift: myShift.shift,
          pointType: myShift.pointType || pointType,
          responsibleName: myShift.responsibleName || finalResponsibleName,
          openedAt: myShift.openedAt,
          userId: user?.id || user?.username,
          branchId: myShift.branchId || effectiveBranchId,
        });
        navigate('/vendedor');
        return;
      }

      const resumeConfirm = window.confirm(
        `⚠️ Tu usuario "${finalResponsibleName}" ya tiene un turno ABIERTO en el punto "${myShift.pointId}" (Jornada ${myShift.shift}).\n\n¿Deseas REANUDAR tu turno en el punto "${myShift.pointId}"?`
      );

      if (resumeConfirm) {
        startShift({
          id: myShift.id,
          pointId: myShift.pointId,
          shift: myShift.shift,
          pointType: myShift.pointType || pointType,
          responsibleName: myShift.responsibleName || finalResponsibleName,
          openedAt: myShift.openedAt,
          userId: user?.id || user?.username,
          branchId: myShift.branchId || effectiveBranchId,
        });
        navigate('/vendedor');
        return;
      }
    }

    // ── Regla: 1 turno por vehículo por jornada (AM/MD/PM) por sede por día ──
    // 1. Buscar si hay turno ABIERTO para este vehículo + jornada + sede hoy
    const openShift = shiftsList.find(
      (s: any) => s.type === 'VENDEDOR' &&
        String(s.pointId || '').toLowerCase().replace(/[^a-z0-9]/g, '') === cleanPoint &&
        s.shift === shift &&
        (s.branchId === effectiveBranchId || !s.branchId || userBranchId === null) &&
        !s.closedAt &&
        (s.openedAt || s.fecha || '').startsWith(today)
    );

    if (openShift) {
      const shiftResp = String(openShift.responsibleName || '').trim().toLowerCase();
      const shiftUid = String(openShift.userId || openShift.createdBy || '').trim().toLowerCase();

      const isOwner = (currentUserId && shiftUid && shiftUid === currentUserId) ||
                      (currentUserName && shiftResp && shiftResp === currentUserName) ||
                      (user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN' || user?.role === 'MANAGER');

      if (isOwner) {
        // Reanudar turno abierto existente
        startShift({
          id: openShift.id,
          pointId,
          shift: openShift.shift || shift,
          pointType: openShift.pointType || pointType,
          responsibleName: openShift.responsibleName || finalResponsibleName,
          openedAt: openShift.openedAt,
          userId: user?.id || user?.username,
          branchId: openShift.branchId || effectiveBranchId,
        });
        navigate('/vendedor');
        return;
      } else {
        alert(`⚠️ El vehículo/punto "${pointId}" ya tiene un turno abierto en la jornada "${shift}" por el usuario "${openShift.responsibleName || 'otro vendedor'}".\n\nSolo el usuario que abrió este turno puede reanudarlo en cualquier dispositivo.`);
        return;
      }
    }

    // 2. Verificar si el turno para este vehículo + jornada YA fue cerrado hoy
    const closedShift = shiftsList.find(
      (s: any) => s.type === 'VENDEDOR' &&
        String(s.pointId || '').toLowerCase().replace(/[^a-z0-9]/g, '') === cleanPoint &&
        s.shift === shift &&
        (s.branchId === effectiveBranchId || !s.branchId || userBranchId === null) &&
        s.closedAt &&
        (s.openedAt || s.fecha || '').startsWith(today)
    );

    if (closedShift) {
      const closedTime = closedShift.closedAt ? new Date(closedShift.closedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      const allowNew = window.confirm(
        `⚠️ El turno de la jornada "${shift}" para el vehículo "${pointId}" ya fue cerrado hoy${closedTime ? ` a las ${closedTime}` : ''}.\n\n¿Deseas iniciar un NUEVO turno para este vehículo de todas formas?`
      );
      if (!allowNew) return;
    }

    // Crear nuevo turno (no existe uno para este punto+jornada hoy)
    const openedAt = new Date().toISOString();
    const cleanResp = String(finalResponsibleName).toLowerCase().replace(/[^a-z0-9]/g, '');
    const jornadaSlug = String(shift).toLowerCase().replace(/[^a-z0-9]/g, '');
    const uniqueShiftId = `SHIFT-VENDOR-${cleanBranch}-${cleanPoint}-${cleanResp || 'vendor'}-${today}-${jornadaSlug}-${Date.now()}`;

    startShift({
      id: uniqueShiftId,
      pointId,
      shift,
      pointType,
      responsibleName: finalResponsibleName,
      openedAt,
      userId: user?.id || user?.username,
      branchId: effectiveBranchId,
    });
    const newShiftRecord = {
      id: uniqueShiftId,
      openedAt,
      pointId,
      shift,
      branchId: effectiveBranchId,
      pointType,
      responsibleName: finalResponsibleName,
      userId: user?.id || user?.username,
      createdBy: user?.id,
      type: 'VENDEDOR',
      closedAt: null,
    };

    // Auto-cerrar turnos anteriores del mismo vendedor o del mismo vehículo antes de guardar el nuevo
    const nowIso = new Date().toISOString();
    const currentShiftsList = useInventoryStore.getState().posShifts || [];
    const cleanedShifts = currentShiftsList.map((s: any) => {
      if (s.type === 'VENDEDOR' && !s.closedAt) {
        const isSamePoint = String(s.pointId || '').toLowerCase().replace(/[^a-z0-9]/g, '') === cleanPoint;
        const isSameUser = currentUserName && String(s.responsibleName || '').trim().toLowerCase() === currentUserName;
        if (isSamePoint || isSameUser) {
          return { ...s, closedAt: nowIso, _autoClosedOnNewStart: true };
        }
      }
      return s;
    });

    const allShifts = [...cleanedShifts.filter((s: any) => s.id !== uniqueShiftId), newShiftRecord];
    useInventoryStore.setState({ posShifts: allShifts });

    push('posShifts', allShifts, effectiveBranchId).catch(() => {});
    push('posShifts', allShifts, null).catch(() => {});

    // ⚡ Sincronización remota asíncrona en segundo plano (NO bloquea la navegación en iPad)
    supabase
      .from('app_state')
      .select('key, value')
      .in('key', ['posShifts', `posShifts_${effectiveBranchId}`, 'posShifts_BRANCH-001', 'posShifts_master_history'])
      .then(({ data }) => {
        const shiftMap = new Map<string, any>();
        (data || []).forEach((row: any) => {
          (Array.isArray(row.value) ? row.value : []).forEach((s: any) => {
            if (s?.id) shiftMap.set(s.id, s);
          });
        });
        allShifts.forEach((s: any) => {
          if (s?.id) shiftMap.set(s.id, s);
        });
        const mergedList = Array.from(shiftMap.values());
        const nowIso = new Date().toISOString();
        Promise.allSettled([
          supabase.from('app_state').upsert({ key: 'posShifts', value: mergedList, updated_at: nowIso }, { onConflict: 'key' }),
          supabase.from('app_state').upsert({ key: `posShifts_${effectiveBranchId}`, value: mergedList, updated_at: nowIso }, { onConflict: 'key' }),
          supabase.from('app_state').upsert({ key: 'posShifts_BRANCH-001', value: mergedList, updated_at: nowIso }, { onConflict: 'key' }),
          supabase.from('app_state').upsert({ key: 'posShifts_master_history', value: mergedList, updated_at: nowIso }, { onConflict: 'key' }),
        ]).catch(() => {});
      })
      .catch(() => {});

    // Navegar de inmediato sin esperar la red (0ms de latencia)
    navigate('/vendedor');
  };

  // 🔄 Mientras verifica turnos remotos:
  if (remoteShifts === null) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#FFD56B] font-sans">
        <div className="bg-white rounded-[32px] p-8 shadow-sm text-center max-w-xs w-full flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#FF4040] border-t-transparent rounded-full animate-spin"></div>
          <p className="font-black text-gray-800 text-sm">Verificando turno activo...</p>
        </div>
      </div>
    );
  }

  // Vista deshabilitada por el Admin
  if (!sellerViewEnabled) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#FFD56B]">
        <div className="bg-white rounded-[40px] p-10 shadow-sm text-center max-w-sm w-full">
          <span className="text-6xl block mb-4">🔒</span>
          <h1 className="text-2xl font-black text-gray-800 mb-2">Vista Desactivada</h1>
          <p className="text-gray-400 font-bold text-sm">
            El administrador ha desactivado temporalmente el acceso a la vista de Vendedor.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-4 bg-[#FFD56B] font-sans w-full page-enter">
      {/* Volver al login */}
      <button
        onClick={() => navigate('/login')}
        className="absolute top-5 left-5 flex items-center gap-2 bg-white/80 hover:bg-white text-gray-700 font-bold text-sm px-4 py-2 rounded-full shadow-sm transition-all active:scale-95"
      >
        ← Volver
      </button>

      <div className="text-center mb-5 sm:mb-8">
        <h1 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight">¡Hola! 👋</h1>
        <p className="text-amber-900/60 font-black mt-1 sm:mt-2 text-xs sm:text-sm tracking-widest uppercase">CONFIGURA TU TURNO</p>
      </div>

      {/* ── Banner de Turno Activo Existente (Reanudar rápido) ── */}
      {activeOpenShifts.length > 0 && (
        <div className="bg-emerald-600 text-white rounded-[32px] p-6 shadow-xl w-full max-w-lg mb-6 border border-emerald-400 animate-fade-in-up">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl animate-bounce">⚡</span>
            <div>
              <h2 className="font-black text-lg leading-tight">Turno Activo en Curso</h2>
              <p className="text-emerald-100 text-xs font-bold">Existe un turno abierto en el sistema. Puedes reanudarlo para continuar en este dispositivo:</p>
            </div>
          </div>

          <div className="space-y-2.5">
            {activeOpenShifts.map((activeS: any) => {
              const timeStr = activeS.openedAt
                ? new Date(activeS.openedAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true })
                : '';
              return (
                <div key={activeS.id} className="bg-white text-gray-900 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-md">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-base text-gray-900">🛵 Punto {activeS.pointId}</span>
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                        {activeS.shift}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 font-bold truncate">
                      {activeS.responsibleName || 'Vendedor'} {timeStr ? `· Abierto: ${timeStr}` : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      startShift({
                        id: activeS.id,
                        shiftId: activeS.id,
                        pointId: activeS.pointId,
                        shift: activeS.shift || 'AM',
                        pointType: activeS.pointType || 'variable',
                        responsibleName: activeS.responsibleName || user?.name || 'Vendedor',
                        openedAt: activeS.openedAt,
                        userId: activeS.userId || (user as any)?.id || (user as any)?.username,
                        branchId: activeS.branchId || userBranchId || 'BRANCH-001',
                      });
                      navigate('/vendedor');
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-4 py-2.5 rounded-xl shadow transition-all active:scale-95 shrink-0"
                  >
                    Continuar Turno →
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="bg-white rounded-[36px] sm:rounded-[40px] p-6 sm:p-10 shadow-sm border border-white w-full max-w-lg">
        
        {/* Tipo de Punto */}
        <div className="mb-5 sm:mb-8">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-3 sm:mb-4">Tipo de Punto</label>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            {pointTypes.map(pt => (
              <button
                key={pt.id}
                onClick={() => setPointType(pt.id)}
                className={`flex-1 py-3 sm:py-4 rounded-2xl text-sm font-black transition-all ${
                  pointType === pt.id 
                    ? 'bg-[#FFB700] text-white shadow-md active:scale-95' 
                    : 'bg-gray-50 border-2 border-gray-100 text-gray-400 hover:bg-gray-100'
                }`}
              >
                {pt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Selección de ID */}
        <div className="mb-5 sm:mb-8">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-3 sm:mb-4">Código (ID)</label>
          <div className="grid grid-cols-5 gap-2 sm:gap-3">
            {allPointIds.map((id: string) => (
              <button
                key={id}
                onClick={() => setPointId(id)}
                className={`py-3 sm:py-4 rounded-2xl font-black transition-all ${
                  pointId === id 
                    ? 'bg-[#FF4040] text-white shadow-md active:scale-95' 
                    : 'bg-gray-50 border-2 border-gray-100 text-gray-400 hover:bg-gray-100'
                }`}
              >
                {id}
              </button>
            ))}
          </div>
        </div>

        {/* Turno */}
        <div className="mb-5 sm:mb-8">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-3 sm:mb-4">Turno</label>
          <div className="flex gap-2 sm:gap-3">
            {['AM', 'MD', 'PM'].map(t => (
              <button
                key={t}
                onClick={() => setShift(t)}
                className={`flex-1 py-3 sm:py-4 rounded-2xl text-base sm:text-lg font-black transition-all ${
                  shift === t 
                    ? 'bg-[#FFB700] text-white shadow-md active:scale-95' 
                    : 'bg-gray-50 border-2 border-gray-100 text-gray-400 hover:bg-gray-100'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Responsable */}
        <div className="mb-7 sm:mb-10 relative pt-4">
           <div className="absolute top-0 left-6 bg-gray-900 text-white font-black text-[10px] sm:text-xs px-4 py-1 sm:py-1.5 rounded-t-lg tracking-widest">
              RESPONSABLE
           </div>
          <input 
            type="text" 
            placeholder={user?.name ? `${user.name} (Opcional)` : "Tu nombre completo"}
            value={responsibleName}
            onChange={(e) => setResponsibleName(e.target.value)}
            className="w-full bg-white border-2 border-gray-100 rounded-[24px] sm:rounded-[28px] py-4 px-5 sm:py-5 sm:px-6 font-black text-lg sm:text-xl text-gray-800 outline-none focus:border-[#FFB700] shadow-sm transition-colors"
          />
        </div>

        {/* Botón Iniciar */}
        <button 
          onClick={handleStartShift}
          className="w-full bg-[#FF4040] text-white font-black text-lg sm:text-xl py-4 sm:py-6 rounded-[28px] sm:rounded-[32px] shadow-[0_15px_30px_-10px_rgba(255,64,64,0.5)] transition-all active:scale-95"
        >
          INICIAR TURNO
        </button>
      </div>
    </div>
  );
};
