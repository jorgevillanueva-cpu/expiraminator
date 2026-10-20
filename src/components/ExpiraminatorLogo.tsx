import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
}

export const ExpiraminatorLogo: React.FC<LogoProps> = ({ className = '', size = 46 }) => {
  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 rounded-2xl overflow-hidden shadow-xs border border-slate-200 bg-white transition-transform hover:scale-105 duration-200 ${className}`}
      style={{ width: size, height: size }}
    >
      <img
        src="/imagen2.svg"
        alt="Expiraminator Logo - Doofenshmirtz"
        className="w-full h-full object-contain p-0.5"
        width={size}
        height={size}
      />
    </div>
  );
};
