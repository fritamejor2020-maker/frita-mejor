import React from 'react';
import { EmployeeWeeklyPayroll } from '../hooks/useAttendanceData';

interface EmployeeStickyPanelProps {
  payrollList: EmployeeWeeklyPayroll[];
  onSelectEmployee: (emp: EmployeeWeeklyPayroll) => void;
  onManageEmployees?: () => void;
}

export function EmployeeStickyPanel({ payrollList, onSelectEmployee, onManageEmployees }: EmployeeStickyPanelProps) {
  return (
    <div className="w-60 min-w-[240px] max-w-[240px] shrink-0 border-r border-gray-200 bg-white sticky left-0 z-20">
      {/* Header fijo alignment con la cuadrícula */}
      <div className="h-12 border-b border-gray-200 px-3 flex items-center justify-between bg-gray-100 font-black text-xs text-gray-500 uppercase tracking-wider sticky top-0 z-30">
        <span>Personal ({payrollList.length})</span>
        {onManageEmployees && (
          <button
            onClick={onManageEmployees}
            className="text-[10px] font-black bg-amber-400 hover:bg-amber-500 text-gray-950 px-2 py-0.5 rounded-lg cursor-pointer transition-all flex items-center gap-1 shadow-2xs"
            title="Editar o eliminar personas del biométrico y del sistema"
          >
            ⚙️ Editar / Eliminar
          </button>
        )}
      </div>

      {/* Lista vertical de trabajadores */}
      <div className="divide-y divide-gray-100">
        {payrollList.map((emp) => (
          <div
            key={emp.employeeId}
            onClick={() => onSelectEmployee(emp)}
            className={`h-[36px] px-3 flex items-center justify-between transition-all cursor-pointer select-none group hover:bg-amber-50/40 ${
              emp.isPresentNow ? 'bg-emerald-50/80 border-l-4 border-l-emerald-500' : 'bg-white'
            }`}
          >
            {/* Nombre, ID y Estado (Sin círculo de avatar) */}
            <div className="min-w-0 flex-1 flex items-center justify-between gap-2">
              <span className="font-black text-xs text-gray-900 truncate leading-none group-hover:text-amber-700">
                {emp.fullName}
              </span>

              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[10px] font-extrabold text-gray-400">#{emp.employeeNo}</span>
                {emp.isPresentNow ? (
                  <span className="text-[9px] font-black text-emerald-700 bg-emerald-100/90 px-1.5 py-0.5 rounded-md flex items-center gap-1 leading-none">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    En Turno
                  </span>
                ) : (
                  <span className="text-[9px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-md leading-none">
                    {emp.netHoursWorked}h
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}

        {payrollList.length === 0 && (
          <div className="h-32 flex items-center justify-center text-xs text-gray-400 font-bold px-4 text-center">
            No hay trabajadores registrados en esta sede.
          </div>
        )}
      </div>
    </div>
  );
}
