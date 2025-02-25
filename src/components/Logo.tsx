import React from 'react';

export const Logo: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`flex items-center ${className}`}>
    <span className="text-2xl tracking-tight">
      <span className="font-extrabold text-white">HORTI</span>
      <span className="font-bold text-blue-400">Blue</span>
    </span>
  </div>
);