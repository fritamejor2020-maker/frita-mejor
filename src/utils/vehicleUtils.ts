import { useVehicleStore } from '../store/useVehicleStore';

export const matchVehicleId = (sPointId: string | null | undefined, targetId: string | null | undefined): boolean => {
  if (!sPointId || !targetId) return false;
  const cleanS = String(sPointId).toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanT = String(targetId).toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!cleanS || !cleanT) return false;
  if (cleanS === cleanT) return true;
  if (cleanS.includes(cleanT) || cleanT.includes(cleanS)) return true;

  try {
    const vehicles = useVehicleStore.getState().vehicles || [];
    const targetVeh = vehicles.find((v: any) => {
      const vId = (v.id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const vAbbr = (v.abbreviation || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const vName = (v.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return cleanT === vId || cleanT === vAbbr || cleanT === vName;
    });

    if (targetVeh) {
      const vAbbr = (targetVeh.abbreviation || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const vName = (targetVeh.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const vId = (targetVeh.id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (cleanS === vAbbr || cleanS === vName || cleanS === vId) return true;
    }
  } catch (_) {}

  return false;
};
