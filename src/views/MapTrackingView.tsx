import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Store, Bike } from 'lucide-react';

export const MapTrackingView = () => {
  const [points, setPoints] = useState<any[]>([]);

  useEffect(() => {
    // In a real app, this should subscribe to changes in sales_points if we track live GPS coords
    // For now we fetch static and mock some posX, posY if they don't exist in schema natively yet
    const fetchPoints = async () => {
      const { data } = await supabase.from('sales_points').select('*').eq('status', 'active');
      
      if (data) {
        // Mocking positions for demonstration over the abstract map
        const pointsWithMockedCoords = data.map((p, i) => ({
          ...p,
          posX: p.posX ?? (20 + (i * 15)), // Mocked percentage values (0-100)
          posY: p.posY ?? (30 + (i * 20) % 60)
        }));
        setPoints(pointsWithMockedCoords);
      }
    };
    
    fetchPoints();
  }, []);

  return (
    <div className="relative w-full h-[calc(100vh-80px)] bg-map-pattern overflow-hidden rounded-3xl border border-gray-200 shadow-inner">
      <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm p-4 rounded-2xl shadow-floating z-10 border border-white">
        <h2 className="font-black text-gray-800 text-xl tracking-tight">Radares de Venta</h2>
        <div className="flex gap-4 mt-2 text-sm font-bold text-gray-500">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-frita-red rounded-full"></div> Tiendas
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-frita-orange rounded-full animate-bounce"></div> Triciclos
          </div>
        </div>
      </div>

      {points.map((p) => {
        const isVariable = p.type === 'variable';
        
        return (
          <div 
            key={p.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group cursor-pointer"
            style={{ left: `${p.posX}%`, top: `${p.posY}%` }}
          >
            {/* Tooltip on Hover */}
            <div className="opacity-0 group-hover:opacity-100 transition-opacity mb-2 bg-gray-900 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap z-20 pointer-events-none">
              {p.id} - {p.name}
            </div>
            
            {/* The Map Pin */}
            <div className={`p-3 rounded-full shadow-lg border-2 border-white flex items-center justify-center transition-transform hover:scale-110 ${
              isVariable 
                ? 'bg-frita-orange text-white animate-bounce' // Triciclo
                : 'bg-frita-red text-white' // Fija / Local
            }`}>
              {isVariable ? <Bike size={24} /> : <Store size={24} />}
            </div>
          </div>
        );
      })}
    </div>
  );
};
