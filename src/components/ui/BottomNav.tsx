import React from 'react';

/**
 * BottomNav: Barra de navegación inferior
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
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] sm:w-11/12 max-w-md bg-white rounded-[40px] shadow-[0_10px_30px_-10px_rgba(0,0,0,0.15)] px-6 py-3 flex justify-between items-center z-50">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabSelect(tab.id)}
            className={`flex flex-col items-center justify-center w-16 h-16 transition-all duration-300 ${
              isActive 
                ? 'bg-[#FFB700] text-white rounded-[20px] shadow-lg -translate-y-2' 
                : 'text-gray-300 bg-transparent hover:text-gray-400'
            }`}
          >
            <span className={`mb-1 ${isActive ? 'scale-110' : ''}`}>{tab.icon}</span>
            <span className={`text-[10px] uppercase tracking-widest font-black ${isActive ? 'text-white' : 'text-gray-300'}`}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};
