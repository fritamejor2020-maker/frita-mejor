import React, { useEffect, useState } from 'react';
import { cn } from './Button';

export function Toast({ 
  message, 
  actionLabel, 
  onAction, 
  duration = 4000, 
  onClose,
  visible 
}) {
  const [timeLeft, setTimeLeft] = useState(duration / 1000);

  useEffect(() => {
    if (!visible) return;

    setTimeLeft(duration / 1000);
    
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onClose && onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [visible, duration, onClose]);

  if (!visible) return null;

  return (
    <div className={cn(
      "fixed bottom-6 left-1/2 -translate-x-1/2 z-50",
      "w-11/12 max-w-md bg-chunky-dark text-white rounded-2xl",
      "p-4 shadow-[0_10px_25px_-5px_rgba(0,0,0,0.5)] border-4 border-black",
      "flex items-center justify-between font-bold animate-slide-up"
    )}>
      <div className="flex flex-col">
        <span className="text-lg">{message}</span>
        {actionLabel && (
          <span className="text-gray-400 text-sm">{timeLeft}s restantes...</span>
        )}
      </div>

      {actionLabel && onAction && (
        <button 
          onClick={() => {
            onAction();
            onClose && onClose();
          }}
          className="ml-4 px-4 py-2 bg-chunky-main text-chunky-dark rounded-xl border-2 border-black font-black uppercase tracking-wider active:scale-95 transition-transform"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
