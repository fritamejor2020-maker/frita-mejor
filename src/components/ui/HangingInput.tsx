import React from 'react';

interface HangingInputProps {
  label: string;
  type?: string;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  className?: string;
}

export const HangingInput = ({ label, type = "text", value, onChange, placeholder = "", className = "" }: HangingInputProps) => {
  return (
    <div className={`relative mt-6 mb-4 ${className}`}>
      {/* Etiqueta flotante estilo pestaña */}
      <label className="absolute -top-4 left-0 bg-frita-red text-white text-xs font-bold px-3 py-1 rounded-t-lg z-10 shadow-sm">
        {label}
      </label>
      
      {/* Input con borde asimétrico (esquina superior izquierda plana por la pestaña) */}
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full bg-white border-2 border-gray-200 outline-none focus:border-frita-orange text-gray-800 rounded-b-xl rounded-tr-xl p-4 pt-5 shadow-sm transition-colors font-medium"
      />
    </div>
  );
};
