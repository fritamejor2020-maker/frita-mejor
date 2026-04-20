import React, { useState, useEffect } from 'react';

interface MoneyInputProps {
  value: string | number;
  onChange: (rawValue: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  disabled?: boolean;
}

/**
 * MoneyInput
 * Muestra el número con puntos de miles (formato COP) mientras el usuario escribe.
 * El `onChange` devuelve el valor sin formato (solo dígitos) para manejar el estado.
 */
export const MoneyInput: React.FC<MoneyInputProps> = ({
  value,
  onChange,
  placeholder = '$ 0',
  className = '',
  autoFocus = false,
  onKeyDown,
  disabled = false,
}) => {
  // Formatea un número raw a string con puntos de miles
  const formatDisplay = (raw: string): string => {
    const digits = raw.replace(/\D/g, '');
    if (!digits) return '';
    return parseInt(digits, 10).toLocaleString('es-CO');
  };

  const [display, setDisplay] = useState(formatDisplay(String(value)));

  // Sincronizar si el valor externo cambia (ej: al limpiar el form)
  useEffect(() => {
    setDisplay(formatDisplay(String(value)));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, ''); // solo dígitos
    setDisplay(formatDisplay(raw));
    onChange(raw); // devuelve el número puro al componente padre
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      value={display}
      onChange={handleChange}
      placeholder={placeholder}
      className={className}
      autoFocus={autoFocus}
      onKeyDown={onKeyDown}
      disabled={disabled}
    />
  );
};
