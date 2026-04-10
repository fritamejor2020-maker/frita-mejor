import React, { useState, useRef, useEffect } from 'react';

interface NumberSelectorGroupProps {
  presets: number[];
  value: number;
  onChange: (val: number) => void;
  allowManual?: boolean;
  themeClass?: string;
}

export function NumberSelectorGroup({ presets, value, onChange, allowManual = true, themeClass = 'vendor' }: NumberSelectorGroupProps) {
  const [isManualOpen, setIsManualOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when manual opens
  useEffect(() => {
    if (isManualOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isManualOpen]);

  // Si el valor actual no está en presets y es mayor a 0, tratamos de mantener el input manual abierto si tiene foco, o simplemente mostrar su valor.
  const isCustomValue = value > 0 && !presets.includes(value);

  const getThemeClasses = (isActive: boolean) => {
    if (themeClass === 'carga' || themeClass === 'red') {
      return isActive ? 'bg-red-500 text-white border-red-500' : 'bg-transparent border-red-500 text-red-500 hover:bg-red-50';
    }
    if (themeClass === 'recibir' || themeClass === 'indigo') {
      return isActive ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-transparent border-indigo-600 text-indigo-600 hover:bg-indigo-50';
    }
    if (themeClass === 'amber') {
       return isActive ? 'bg-amber-500 text-white border-amber-500' : 'bg-transparent border-amber-500 text-amber-500 hover:bg-amber-50';
    }
    // vendor defaults (red tones matching image 2)
    return isActive ? 'bg-[#FF4040] text-white border-[#FF4040]' : 'bg-transparent border-[#FF4040] text-[#FF4040] hover:bg-red-50';
  };

  return (
    <div className="flex gap-1.5 sm:gap-2 items-center overflow-x-auto scrollbar-hide flex-nowrap pr-1 py-1 w-full justify-end">
      {presets.map(qty => {
        const isActive = value === qty;
        return (
          <button
            key={qty}
            onClick={() => {
              onChange(isActive ? 0 : qty); // Toggle zero si vuelven a hacer clic
              setIsManualOpen(false);
            }}
            className={`w-9 h-9 sm:w-11 sm:h-11 shrink-0 rounded-full border-[1.5px] font-black text-xs sm:text-base flex items-center justify-center transition-all duration-300 active:scale-90 shadow-sm hover:shadow-chunky-lg hover:-translate-y-0.5 ${getThemeClasses(isActive)}`}
          >
            {qty}
          </button>
        );
      })}

      {allowManual && (
        <div className="relative shrink-0 flex items-center justify-center">
          {isManualOpen || isCustomValue ? (
            <input
              ref={inputRef}
              type="number"
              min="0"
              value={value || ''}
              onChange={(e) => {
                const num = parseInt(e.target.value, 10);
                onChange(isNaN(num) ? 0 : num);
              }}
              onBlur={() => {
                if (!isCustomValue) setIsManualOpen(false);
              }}
              className="w-12 h-9 sm:w-16 sm:h-11 rounded-full border-[1.5px] border-[#FFB700] bg-yellow-50 text-center font-black text-gray-800 outline-none focus:border-[#FFB700] shadow-inner text-xs sm:text-base animate-slide-in-right"
              placeholder="..."
            />
          ) : (
            <button
              onClick={() => setIsManualOpen(true)}
              className="w-9 h-9 sm:w-11 sm:h-11 shrink-0 rounded-full bg-white border-[1.5px] border-gray-200 text-gray-400 font-bold flex items-center justify-center hover:bg-gray-50 hover:border-gray-300 hover:text-gray-600 transition-colors shadow-sm"
            >
              ...
            </button>
          )}
        </div>
      )}
    </div>
  );
}
