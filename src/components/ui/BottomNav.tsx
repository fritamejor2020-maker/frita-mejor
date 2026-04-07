import React from 'react';

/**
 * BottomNav: Barra de navegación inferior con animaciones mejoradas
 */

interface TabItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

interface BottomNavProps {
  activeTab: string;
  onTabSelect: (id: string) => void;
  tabs: TabItem[];
}

export const BottomNav = ({ activeTab, onTabSelect, tabs }: BottomNavProps) => {
  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 w-[90%] sm:w-11/12 max-w-md bg-white/95 backdrop-blur-sm rounded-[40px] shadow-[0_12px_40px_-8px_rgba(0,0,0,0.18)] px-4 py-2.5 flex justify-between items-center z-50">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabSelect(tab.id)}
            style={{ transition: 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1), background-color 0.2s ease, box-shadow 0.2s ease' }}
            className={`flex flex-col items-center justify-center w-16 h-14 rounded-[20px] ${
              isActive
                ? 'bg-[#FFB700] text-white shadow-[0_6px_20px_-4px_rgba(255,183,0,0.5)] -translate-y-2 scale-105'
                : 'text-gray-300 bg-transparent hover:text-gray-400 hover:bg-gray-50'
            }`}
          >
            <span
              style={{ transition: 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1)' }}
              className={`mb-0.5 ${isActive ? 'scale-110' : 'scale-100'}`}
            >
              {tab.icon}
            </span>
            <span
              style={{ transition: 'opacity 0.2s ease, color 0.2s ease' }}
              className={`text-[10px] uppercase tracking-widest font-black ${isActive ? 'text-white opacity-100' : 'text-gray-300 opacity-70'}`}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};
