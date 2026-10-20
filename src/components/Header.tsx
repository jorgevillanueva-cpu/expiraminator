import React from 'react';
import { Database, RefreshCw, Zap } from 'lucide-react';
import { ExpiraminatorLogo } from './ExpiraminatorLogo';

interface HeaderProps {
  terminalCount: number;
  activeTab: 'reconciliation' | 'terminals';
  setActiveTab: (tab: 'reconciliation' | 'terminals') => void;
  isLoadingTerminals: boolean;
  onRefreshTerminals: () => void;
  realtimeStatus?: {
    isLive: boolean;
    matchedCount: number;
    expiredWithChargeCount: number;
  };
}

export const Header: React.FC<HeaderProps> = ({
  terminalCount,
  activeTab,
  setActiveTab,
  isLoadingTerminals,
  onRefreshTerminals,
  realtimeStatus,
}) => {
  return (
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur-md sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Brand with Logo */}
        <div className="flex items-center gap-3.5">
          <ExpiraminatorLogo size={42} />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold tracking-tight text-slate-900 font-mono">
                EXPIRAMINATOR
              </h1>
              <span className="px-2 py-0.5 text-[11px] font-bold bg-rose-50 text-rose-600 border border-rose-200 rounded-full">
                Cotejo en Tiempo Real
              </span>
              {realtimeStatus?.isLive && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  En Vivo
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Cotejo y Cruce de Transacciones (SPIN), Órdenes Generadas y Detección de Posibles Expiradas con Cobro
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-3 flex-wrap">

          {/* Nav Tabs */}
          <div className="bg-slate-100 p-1 rounded-xl border border-slate-200 flex items-center gap-1 text-xs">
            <button
              onClick={() => setActiveTab('reconciliation')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                activeTab === 'reconciliation'
                  ? 'bg-white text-rose-600 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              Cotejador & Cruce
            </button>
            <button
              onClick={() => setActiveTab('terminals')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                activeTab === 'terminals'
                  ? 'bg-white text-rose-600 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              Base de Terminales {terminalCount > 0 ? `(${terminalCount})` : ''}
            </button>
          </div>

          <button
            onClick={onRefreshTerminals}
            disabled={isLoadingTerminals}
            className="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 shadow-2xs transition"
            title="Recargar base de terminales"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingTerminals ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
    </header>
  );
};
