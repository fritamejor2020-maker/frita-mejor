import React from 'react';
import { X, DollarSign, Clock, AlertTriangle, ShieldCheck } from 'lucide-react';
import { EmployeeWeeklyPayroll } from '../hooks/useAttendanceData';

interface WeeklyPayrollModalProps {
  payrollList: EmployeeWeeklyPayroll[];
  selectedEmployee?: EmployeeWeeklyPayroll;
  onClose: () => void;
}

export function WeeklyPayrollModal({ payrollList, selectedEmployee, onClose }: WeeklyPayrollModalProps) {
  const displayList = selectedEmployee ? [selectedEmployee] : payrollList;

  const totalPayrollAmount = displayList.reduce((acc, curr) => acc + curr.totalPay, 0);
  const totalRegularHours = displayList.reduce((acc, curr) => acc + curr.regularHours, 0);
  const totalOvertimeHours = displayList.reduce((acc, curr) => acc + curr.overtimeHours, 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-gray-100 max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-100 shrink-0">
          <div>
            <h3 className="font-black text-lg text-gray-900 flex items-center gap-2">
              <DollarSign className="text-amber-500" size={20} />
              Liquidación de Nómina Semanal
            </h3>
            <p className="text-xs font-bold text-gray-400">
              Desglose de horas cumplidas, descuentos por tardanza/falta y total a pagar.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 cursor-pointer">
            <X size={20} />
          </button>
        </div>

        {/* Resumen Superior */}
        <div className="grid grid-cols-3 gap-3 my-4 shrink-0">
          <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-3 text-center">
            <span className="text-[10px] font-black text-amber-800 uppercase block">TOTAL A PAGAR</span>
            <span className="text-xl font-black text-amber-950">${totalPayrollAmount.toLocaleString('es-CO')}</span>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-3 text-center">
            <span className="text-[10px] font-black text-gray-500 uppercase block">HORAS ORDINARIAS</span>
            <span className="text-lg font-black text-gray-800">{totalRegularHours.toFixed(1)} h</span>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-center">
            <span className="text-[10px] font-black text-emerald-700 uppercase block">HORAS EXTRAS</span>
            <span className="text-lg font-black text-emerald-800">{totalOvertimeHours.toFixed(1)} h</span>
          </div>
        </div>

        {/* Tabla de Empleados */}
        <div className="flex-1 overflow-y-auto min-h-0 space-y-3 pr-1">
          {displayList.map((emp) => (
            <div key={emp.employeeId} className="bg-gray-50/70 rounded-2xl p-4 border border-gray-200 space-y-3">
              {/* Empleado header */}
              <div className="flex items-center justify-between border-b border-gray-200/80 pb-2">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center font-black text-xs text-white shadow-sm"
                    style={{ backgroundColor: emp.avatarColor }}
                  >
                    {emp.initials}
                  </div>
                  <div>
                    <h4 className="font-black text-sm text-gray-900">{emp.fullName}</h4>
                    <span className="text-[10px] font-bold text-gray-400">
                      ID #{emp.employeeNo} • Meta Semanal: {emp.weeklyTargetHours}h
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs text-gray-400 block font-bold">Pago Total</span>
                  <span className="text-base font-black text-emerald-600">
                    ${emp.totalPay.toLocaleString('es-CO')}
                  </span>
                </div>
              </div>

              {/* Métricas de horas */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-bold bg-white p-2.5 rounded-xl border border-gray-200">
                <div>
                  <span className="text-gray-400 block text-[9px]">BRUTO TRABAJADO</span>
                  <span className="text-gray-800 font-black">{emp.grossHours} h</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[9px]">DESCUENTO TARDANZAS</span>
                  <span className="text-amber-600 font-black">-{emp.deductedTardinessHours} h</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[9px]">DESCUENTO MARCAS</span>
                  <span className="text-red-500 font-black">-{emp.deductedMissingMarksHours} h</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[9px]">NETO TRABAJADO</span>
                  <span className="text-emerald-600 font-black">{emp.netHoursWorked} h</span>
                </div>
              </div>

              {/* Cálculo financiero */}
              <div className="grid grid-cols-2 gap-2 text-xs font-bold pt-1">
                <div className="bg-gray-100/80 rounded-xl p-2 flex justify-between items-center">
                  <span>Ordinarias ({emp.regularHours}h x ${emp.baseHourlyRate.toLocaleString('es-CO')}):</span>
                  <span className="font-black text-gray-900">${emp.regularPay.toLocaleString('es-CO')}</span>
                </div>
                <div className="bg-emerald-100/60 rounded-xl p-2 flex justify-between items-center text-emerald-900">
                  <span>Extras ({emp.overtimeHours}h x ${emp.overtimeHourlyRate.toLocaleString('es-CO')}):</span>
                  <span className="font-black">${emp.overtimePay.toLocaleString('es-CO')}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-gray-100 shrink-0 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-gray-900 hover:bg-gray-800 text-white font-black text-xs rounded-xl cursor-pointer transition-all"
          >
            Cerrar Nómina
          </button>
        </div>
      </div>
    </div>
  );
}
