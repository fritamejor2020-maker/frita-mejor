import React, { useState } from 'react';
import { useIncomeConfigStore } from '../../store/useIncomeConfigStore';

export function AdminIncomeSourcesTab() {
  const { hierarchy, addLocation, removeLocation, addShift, removeShift, addTimeSlot, removeTimeSlot } = useIncomeConfigStore();

  const [newLocation, setNewLocation] = useState('');
  const [newShifts, setNewShifts] = useState<{ [location: string]: string }>({});
  const [newTimeSlots, setNewTimeSlots] = useState<{ [locationShift: string]: string }>({});

  const handleAddLocation = () => {
    if (newLocation.trim()) {
      addLocation(newLocation.trim());
      setNewLocation('');
    }
  };

  const handleAddShift = (location: string) => {
    const shift = newShifts[location];
    if (shift && shift.trim()) {
      addShift(location, shift.trim());
      setNewShifts({ ...newShifts, [location]: '' });
    }
  };

  const handleAddTimeSlot = (location: string, shift: string) => {
    const key = `${location}-${shift}`;
    const timeSlot = newTimeSlots[key];
    if (timeSlot && timeSlot.trim()) {
      addTimeSlot(location, shift, timeSlot.trim());
      setNewTimeSlots({ ...newTimeSlots, [key]: '' });
    }
  };

  return (
    <div className="space-y-8">
      
      {/* HEADER SECTION */}
      <div className="bg-[#1e1f26] rounded-[24px] border border-gray-800 p-6">
        <h3 className="text-xl font-black text-white mb-2">Configuración de Orígenes de Ingreso</h3>
        <p className="text-xs font-bold text-gray-400 mb-6 max-w-2xl">
          Aquí puedes definir las ubicaciones principales (ej. Local, Contratas), las jornadas habilitadas para cada una (ej. AM, PM) y finalmente los horarios específicos. <br/><br/>
          <span className="text-amber-500">Nota Especial:</span> La categoría <b>Triciclo</b> tiene un comportamiento dinámico tipo tabla. Puedes configurar sus jornadas aquí, pero los horarios específicos provendrán de la lista de Vehículos.
        </p>

        {/* Add New Location */}
        <div className="flex gap-4">
          <input 
            type="text" 
            placeholder="Nueva Ubicación General (ej. Venta Planta)"
            value={newLocation}
            onChange={(e) => setNewLocation(e.target.value)}
            className="flex-1 bg-[#0c0d11] border border-gray-700 rounded-xl py-3 px-4 text-white font-bold focus:border-[#FFB700] outline-none max-w-sm"
          />
          <button 
            onClick={handleAddLocation}
            className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black transition-colors"
          >
            Añadir Ubicación
          </button>
        </div>
      </div>

      {/* RENDER HIERARCHY */}
      <div className="space-y-6">
        {Object.entries(hierarchy).map(([location, shifts]: [string, any]) => (
          <div key={location} className="bg-[#1e1f26] rounded-[24px] border border-gray-700/50 overflow-hidden">
            
            {/* Location Header */}
            <div className="bg-gray-800/40 p-4 border-b border-gray-700/50 flex justify-between items-center">
              <h4 className="text-xl font-black text-[#FFB700] uppercase tracking-wider">{location}</h4>
              <button 
                onClick={() => {
                  if (confirm(`¿Eliminar ubicación ${location} y todas sus jornadas?`)) {
                    removeLocation(location);
                  }
                }}
                className="text-red-400 hover:text-red-300 font-bold text-sm bg-red-900/30 px-3 py-1.5 rounded-lg"
              >
                Eliminar Ubicación
              </button>
            </div>

            {/* Shifts Body */}
            <div className="p-6">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                 {Object.entries(shifts).map(([shift, timeSlots]: [string, any]) => (
                    <div key={shift} className="bg-[#16171d] rounded-2xl border border-gray-800 p-5 relative">
                      
                      {/* Shift Header */}
                      <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-800/60">
                         <span className="text-gray-200 font-bold text-lg">{shift}</span>
                         <button 
                           onClick={() => removeShift(location, shift)}
                           className="text-gray-500 hover:text-red-400 font-bold text-xs"
                         >
                           Quitar Jornada
                         </button>
                      </div>

                      {/* Time Slots Area */}
                      {location !== 'Triciclo' ? (
                        <div className="space-y-3">
                           <div className="flex flex-wrap gap-2 mb-4">
                             {timeSlots.map((ts: string, idx: number) => (
                               <div key={idx} className="bg-blue-900/30 border border-blue-800 text-blue-300 font-bold text-xs px-3 py-1.5 rounded-full flex items-center gap-2">
                                 <span>{ts}</span>
                                 <button onClick={() => removeTimeSlot(location, shift, ts)} className="hover:text-white rounded-full bg-blue-900 p-0.5">
                                   <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                 </button>
                               </div>
                             ))}
                             {timeSlots.length === 0 && <span className="text-gray-600 text-xs font-bold">Sin horarios definidos</span>}
                           </div>

                           {/* Add Time Slot Form */}
                           <div className="flex gap-2">
                             <input 
                               type="text" 
                               placeholder="Ej. 10-12 pm"
                               value={newTimeSlots[`${location}-${shift}`] || ''}
                               onChange={(e) => setNewTimeSlots({ ...newTimeSlots, [`${location}-${shift}`]: e.target.value })}
                               className="flex-1 bg-[#0c0d11] border border-gray-800 rounded-lg py-1.5 px-3 text-sm text-gray-300 font-bold outline-none focus:border-blue-500"
                             />
                             <button
                               onClick={() => handleAddTimeSlot(location, shift)}
                               className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-bold text-xs"
                             >
                               Añadir
                             </button>
                           </div>
                        </div>
                      ) : (
                        <div className="bg-amber-900/10 border border-amber-900/20 p-4 rounded-xl text-center">
                          <p className="text-amber-500/80 text-xs font-bold mb-1">Carga Dinámica de Triciclos</p>
                          <p className="text-gray-500 text-[10px] font-bold">Los botones de elegir T1, T2 de esta jornada se cargarán mágicamente desde la configuración de Vehículos.</p>
                        </div>
                      )}
                    </div>
                 ))}
                 
                 {/* Add new Shift block */}
                 <div className="bg-[#16171d] rounded-2xl border border-dashed border-gray-700 p-5 flex flex-col justify-center items-center gap-3">
                   <span className="text-gray-500 font-bold text-sm">Nueva Jornada</span>
                   <div className="flex gap-2 w-full max-w-[200px]">
                      <input 
                         type="text" 
                         placeholder="Ej. AM, PM..."
                         value={newShifts[location] || ''}
                         onChange={(e) => setNewShifts({ ...newShifts, [location]: e.target.value })}
                         className="flex-1 min-w-0 bg-[#0c0d11] border border-gray-800 rounded-lg py-1.5 px-3 text-sm text-gray-300 font-bold outline-none text-center focus:border-green-500"
                       />
                       <button
                         onClick={() => handleAddShift(location)}
                         className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-green-400 font-black text-xs"
                       >
                         +
                       </button>
                   </div>
                 </div>

              </div>
            </div>

          </div>
        ))}
      </div>

    </div>
  );
}
