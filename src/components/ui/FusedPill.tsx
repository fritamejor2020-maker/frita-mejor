import React from 'react';

/**
 * FusedPill: Tarjeta horizontal 35% color sólido / 65% blanco
 */
interface FusedPillProps {
  title: string;
  value: string;
  leftColor?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
}

export const FusedPill = ({ title, value, leftColor = 'bg-chunky-main', icon, onClick }: FusedPillProps) => {
  return (
    <div 
      onClick={onClick}
      className={`flex md:min-w-[300px] w-full h-24 mb-4 rounded-xl shadow-md cursor-pointer hover:-translate-y-1 transition-transform`}
    >
      <div className={`w-[35%] ${leftColor} rounded-l-xl text-white flex flex-col items-center justify-center p-2`}>
        {icon && <span className="mb-1 text-2xl">{icon}</span>}
        <span className="text-sm font-bold text-center leading-tight">{title}</span>
      </div>
      <div className="w-[65%] bg-white rounded-r-xl border border-gray-100 flex items-center p-4">
        <span className="text-gray-800 font-semibold text-lg">{value}</span>
      </div>
    </div>
  );
};
