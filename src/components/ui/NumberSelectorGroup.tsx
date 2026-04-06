import React, { useState, useRef, useEffect } from 'react';

interface NumberSelectorGroupProps {
  presets: number[];
  value: number;
  onChange: (val: number) => void;
  allowManual?: boolean;
}

export function NumberSelectorGroup({ presets, value, onChange, allowManual = true }: NumberSelectorGroupProps) {
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

  return (
    <div className="flex gap-2 items-center pr-2 flex-wrap">
      {presets.map(qty => {
        const isActive = value === qty;
        return (
          <button
            key={qty}
            onClick={() => {
              onChange(isActive ? 0 : qty); // Toggle zero si vuelven a hacer clic
              setIsManualOpen(false);
            }}
            className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 font-black text-sm sm:text-base flex items-center justify-center transition-all duration-300 active:scale-90 shadow-sm hover:shadow-chunky-lg hover:-translate-y-0.5
              ${isActive 
                ? 'bg-[#FFB700] text-white border-[#FFB700]' 
                : 'bg-transparent border-[#FF4040] text-[#FF4040] hover:bg-red-50'
              }`}
          >
            {qty}
          </button>
        );
      })}

      {allowManual && (
        <div className="relative">
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
              className="w-14 h-10 sm:w-16 sm:h-12 rounded-full border-2 border-[#FFB700] bg-yellow-50 text-center font-black text-gray-800 outline-none focus:border-[#FFB700] shadow-inner text-sm sm:text-base animate-slide-in-right"
              placeholder="..."
            />
          ) : (
            <button
              onClick={() => setIsManualOpen(true)}
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white border-2 border-gray-200 text-gray-400 font-bold flex items-center justify-center hover:bg-gray-50 hover:border-gray-300 hover:text-gray-600 transition-colors shadow-sm"
            >
              ...
            </button>
          )}
        </div>
      )}
    </div>
  );
}
