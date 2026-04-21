import React, { useState, useEffect } from 'react';

interface MoneyInputProps {
  value: string | number;
  onChange: (rawValue: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  /** Si true, permite ingresar decimales (ej: 3500,50) */
  allowDecimal?: boolean;
}

/**
 * MoneyInput
 * Muestra el número con puntos de miles (formato COP) mientras el usuario escribe.
 * El `onChange` devuelve el valor sin formato (número como string) para manejar el estado.
 * Con `allowDecimal=true` permite ingresar coma/punto como separador decimal.
 */
export const MoneyInput: React.FC<MoneyInputProps> = ({
  value,
  onChange,
  placeholder = '$ 0',
  className = '',
  autoFocus = false,
  onKeyDown,
  disabled = false,
  allowDecimal = false,
}) => {
  // Formatea un número raw a string con puntos de miles (y coma decimal si aplica)
  const formatDisplay = (raw: string): string => {
    if (!raw) return '';
    if (allowDecimal) {
      // Separar parte entera y decimal
      const normalized = raw.replace(',', '.');
      const [intPart, decPart] = normalized.split('.');
      const intFormatted = parseInt(intPart || '0', 10).toLocaleString('es-CO');
      if (decPart !== undefined) {
        // Mientras escribe la parte decimal, mostrarla tal cual (máx 2 dígitos)
        return `${intFormatted},${decPart.slice(0, 2)}`;
      }
      return intFormatted;
    }
    // Solo enteros
    const digits = raw.replace(/\D/g, '');
    if (!digits) return '';
    return parseInt(digits, 10).toLocaleString('es-CO');
  };

  const [display, setDisplay] = useState(formatDisplay(String(value)));

  // Sincronizar si el valor externo cambia (ej: al limpiar el form)
  useEffect(() => {
    setDisplay(formatDisplay(String(value)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (allowDecimal) {
      const input = e.target.value;
      // Permitir: dígitos, una sola coma o punto (separador decimal), máx 2 decimales
      // Quitamos todo excepto dígitos y el primer separador decimal
      const withoutFormat = input.replace(/\./g, '').replace(',', '.'); // normalizar puntos de miles → quitar, coma decimal → punto
      // Validar formato: opcionalmente dígitos, opcionalmente un punto seguido de máx 2 dígitos
      const match = withoutFormat.match(/^(\d*)([.,]?\d{0,2})$/);
      if (!match) return; // rechazar caracteres inválidos

      const raw = input.replace(/[^0-9,]/g, ''); // guardar internamente con coma decimal
      setDisplay(formatDisplay(raw));
      // Devolver como número puro: "3500,50" → "3500.50" para parseFloat
      const numericStr = raw.replace(',', '.');
      onChange(numericStr);
    } else {
      const raw = e.target.value.replace(/\D/g, ''); // solo dígitos
      setDisplay(formatDisplay(raw));
      onChange(raw);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Bloquear punto cuando allowDecimal=true ya que usamos coma como decimal (es-CO)
    // Convertir punto → coma automáticamente
    if (allowDecimal && e.key === '.') {
      e.preventDefault();
      const syntheticEvent = { target: { value: display + ',' } } as React.ChangeEvent<HTMLInputElement>;
      handleChange(syntheticEvent);
      return;
    }
    onKeyDown?.(e);
  };

  return (
    <input
      type="text"
      inputMode={allowDecimal ? 'decimal' : 'numeric'}
      value={display}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      className={className}
      autoFocus={autoFocus}
      disabled={disabled}
    />
  );
};
