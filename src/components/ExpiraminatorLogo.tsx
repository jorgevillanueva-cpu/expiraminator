import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
}

export const ExpiraminatorLogo: React.FC<LogoProps> = ({ className = '', size = 46 }) => {
  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 rounded-2xl overflow-hidden shadow-xs border border-teal-500/40 bg-[#3AA8B0] transition-transform hover:scale-105 duration-200 ${className}`}
      style={{ width: size, height: size }}
    >
      <img
        src="/imagen2.svg"
        alt="Agent P Logo"
        className="w-full h-full object-cover"
        width={size}
        height={size}
      />
    </div>
  );
};
