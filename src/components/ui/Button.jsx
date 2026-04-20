import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Utility for Chunky UI classes */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function Button({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  className, 
  ...props 
}) {
  const variants = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    main: 'btn-main',
    danger: 'bg-red-600 text-white border-red-800 focus:ring-red-300',
    outline: 'bg-white text-chunky-dark hover:bg-gray-100',
  };

  const sizes = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-lg',
    lg: 'px-8 py-5 text-2xl',
    huge: 'px-10 py-8 text-4xl w-full',
  };

  return (
    <button 
      className={cn('btn-chunky', variants[variant], sizes[size], className)}
      {...props}
    >
      {children}
    </button>
  );
}
