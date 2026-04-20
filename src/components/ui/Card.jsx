import React from 'react';
import { cn } from './Button';

export function Card({ children, className, ...props }) {
  return (
    <div className={cn('card-chunky p-6', className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className, ...props }) {
  return (
    <div className={cn('mb-4 pb-4 border-b-4 border-chunky-dark', className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className, ...props }) {
  return (
    <h3 className={cn('text-2xl font-black uppercase tracking-tight', className)} {...props}>
      {children}
    </h3>
  );
}

export function CardContent({ children, className, ...props }) {
  return (
    <div className={cn('', className)} {...props}>
      {children}
    </div>
  );
}
