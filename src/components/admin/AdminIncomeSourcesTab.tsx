import React, { useState } from 'react';
import { useIncomeConfigStore } from '../../store/useIncomeConfigStore';

export function AdminIncomeSourcesTab() {
  const { hierarchy, addLocation, removeLocation, addShift, removeShift, addTimeSlot, removeTimeSlot, toggleDescargues, isDescarguesEnabled } = useIncomeConfigStore();

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
    <div className="space-y-8 flex-1">
      
      {/* HEADER SECTION */}
      <div className="bg-[#FFD56B] rounded-[32px] border border-[#FFD56B] p-6 shadow-sm">
        <h3 className="text-2xl font-black text-gray-900 mb-2">Configuración de Orígenes de Ingreso</h3>
        <p className="text-xs font-bold text-gray-800 mb-6 max-w-2xl opacity-80">
          Aquí puedes definir las ubicaciones principales (ej. Local, Contratas), las jornadas habilitadas para cada una (ej. AM, PM) y finalmente los horarios específicos. <br/><br/>
          <span className="text-frita-red">Nota Especial:</span> La categoría <b className="text-gray-900">Triciclo</b> tiene un comportamiento dinámico. Puedes configurar sus jornadas aquí, pero los horarios específicos provendrán de la lista de Vehículos.
        </p>

        {/* Add New Location */}
        <div className="flex gap-4">
          <input 
            type="text" 
            placeholder="Nueva Ubicación General (ej. Venta Planta)"
            value={newLocation}
            onChange={(e) => setNewLocation(e.target.value)}
            className="flex-1 bg-white border-2 border-white rounded-xl py-3 px-4 text-gray-800 font-bold focus:border-[#FFB700] outline-none max-w-sm shadow-sm transition-colors"
          />
          <button 
            onClick={handleAddLocation}
            className="px-6 py-3 rounded-xl bg-frita-red hover:bg-red-600 text-white font-black transition-colors shadow-sm"
          >
            Añadir Ubicación
          </button>
        </div>
      </div>

      {/* RENDER HIERARCHY */}
      <div className="space-y-6">
        {Object.entries(hierarchy).map(([location, shifts]: [string, any]) => (
          <div key={location} className="bg-white rounded-[32px] border-2 border-gray-100 overflow-hidden shadow-sm">
            
            {/* Location Header */}
            <div className="bg-gray-50 p-5 border-b-2 border-gray-100 flex justify-between items-center">
              <h4 className="text-xl font-black text-gray-800 uppercase tracking-wider">{location}</h4>
              <button 
                onClick={() => {
                  if (confirm(`¿Eliminar ubicación ${location} y todas sus jornadas?`)) {
                    removeLocation(location);
                  }
                }}
                className="text-red-500 hover:text-red-600 font-bold text-sm hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors"
              >
                Eliminar Ubicación
              </button>
            </div>

            {/* Shifts Body */}
            <div className="p-6">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                 {Object.entries(shifts).map(([shift, timeSlots]: [string, any]) => (
                    <div key={shift} className="bg-white rounded-2xl border border-gray-200 p-5 relative shadow-sm">
                      
                      {/* Shift Header */}
                      <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-100">
                         <span className="text-gray-800 font-black text-lg">{shift}</span>
                         <button 
                           onClick={() => removeShift(location, shift)}
                           className="text-gray-400 hover:text-red-500 font-bold text-xs transition-colors"
                         >
                           Quitar Jornada
                         </button>
                      </div>

                      {/* Time Slots Area */}
                      {location !== 'Triciclo' ? (
                        <div className="space-y-3">
                           <div className="flex flex-wrap gap-2 mb-4">
                             {timeSlots.map((ts: string, idx: number) => (
                               <div key={idx} className="bg-[#FFD56B]/30 border border-[#FFD56B]/50 text-[#cc7a00] font-bold text-xs px-3 py-1.5 rounded-full flex items-center gap-2 shadow-sm">
                                 <span>{ts}</span>
                                 <button onClick={() => removeTimeSlot(location, shift, ts)} className="hover:bg-red-400 hover:text-white text-red-500 transition-colors rounded-full p-0.5 ml-1">
                                   <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                 </button>
                               </div>
                             ))}
                             {timeSlots.length === 0 && <span className="text-gray-400 text-xs font-bold bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">Sin horarios definidos</span>}
                           </div>

                           {/* Toggle descargues por franja */}
                           <div className="flex flex-wrap gap-2 pt-1">
                             {timeSlots.map((ts: string, idx: number) => {
                               const enabled = isDescarguesEnabled(location, shift, ts);
                               return (
                                 <button
                                   key={`desc-${idx}`}
                                   onClick={() => toggleDescargues(location, shift, ts)}
                                   title={enabled ? 'Descargues activos — click para desactivar' : 'Descargues inactivos — click para activar'}
                                   className={`flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1 rounded-full border transition-all ${
                                     enabled
                                       ? 'bg-amber-50 border-amber-300 text-amber-600 hover:bg-amber-100'
                                       : 'bg-gray-50 border-gray-200 text-gray-400 hover:border-gray-300'
                                   }`}
                                 >
                                   <span>{ts}</span>
                                   <span>{enabled ? '💵 Desc.' : '○'}</span>
                                 </button>
                               );
                             })}
                             {timeSlots.length > 0 && (
                               <p className="w-full text-[9px] text-gray-400 font-bold mt-0.5">
                                 💡 Click en una franja para activar/desactivar descargues de efectivo
                               </p>
                             )}
                           </div>

                           {/* Add Time Slot Form */}
                           <div className="flex gap-2 bg-gray-50/50 p-2 rounded-xl border border-gray-100">
                             <input 
                               type="text" 
                               placeholder="Ej. 10-12 pm"
                               value={newTimeSlots[`${location}-${shift}`] || ''}
                               onChange={(e) => setNewTimeSlots({ ...newTimeSlots, [`${location}-${shift}`]: e.target.value })}
                               className="flex-1 bg-white border border-gray-200 rounded-lg py-1.5 px-3 text-sm text-gray-800 font-bold outline-none focus:border-[#FFB700] transition-colors"
                             />
                             <button
                               onClick={() => handleAddTimeSlot(location, shift)}
                               className="px-4 py-1.5 rounded-lg bg-[#FFB700] hover:bg-yellow-400 text-gray-900 font-bold text-xs transition-colors shadow-sm"
                             >
                               Añadir
                             </button>
                           </div>
                        </div>
                      ) : (
                        <div className="bg-orange-50 border-2 border-orange-200 p-4 rounded-xl text-center shadow-sm">
                          <p className="text-frita-orange text-xs font-black mb-1 uppercase tracking-wider">Carga Dinámica</p>
                          <p className="text-gray-600 text-[10px] font-bold">Los botones de esta jornada se cargarán automáticamente desde el panel de Flota de Vehículos.</p>
                        </div>
                      )}
                    </div>
                 ))}
                 
                 {/* Add new Shift block */}
                 <div className="bg-gray-50 rounded-2xl border-2 border-dashed border-gray-300 p-5 flex flex-col justify-center items-center gap-3 hover:bg-gray-100 transition-colors">
                   <span className="text-gray-500 font-bold text-sm">Nueva Jornada</span>
                   <div className="flex gap-2 w-full max-w-[200px]">
                      <input 
                         type="text" 
                         placeholder="Ej. AM, PM..."
                         value={newShifts[location] || ''}
                         onChange={(e) => setNewShifts({ ...newShifts, [location]: e.target.value })}
                         className="flex-1 min-w-0 bg-white border border-gray-200 rounded-lg py-1.5 px-3 text-sm text-gray-800 font-bold outline-none text-center focus:border-[#FFB700] transition-colors shadow-sm"
                       />
                       <button
                         onClick={() => handleAddShift(location)}
                         className="px-3 py-1.5 rounded-lg bg-[#FFB700] hover:bg-yellow-400 shadow-sm text-gray-900 font-black text-xs transition-colors"
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
