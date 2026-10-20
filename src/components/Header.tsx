import React from 'react';
import { Database, RefreshCw, Zap } from 'lucide-react';
import { ExpiraminatorLogo } from './ExpiraminatorLogo';

interface HeaderProps {
  terminalCount: number;
  activeTab: 'reconciliation' | 'terminals' | 'samples';
  setActiveTab: (tab: 'reconciliation' | 'terminals' | 'samples') => void;
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
                Expiraminator
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

        {/* Navigation Tabs & Firebase Status */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Base Terminals Status Pill */}
          <button
            onClick={() => setActiveTab('terminals')}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              activeTab === 'terminals'
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
            }`}
            title="Ver catálogo de terminales en Firebase Firestore"
          >
            <Database className="w-3.5 h-3.5 text-indigo-500 group-hover:text-white" />
            <span>Terminales en Firebase:</span>
            <span className="px-1.5 py-0.2 bg-white text-indigo-700 rounded font-mono font-bold shadow-2xs border border-indigo-100">
              {isLoadingTerminals ? '...' : terminalCount}
            </span>
          </button>

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
              Base de Terminales
            </button>
            <button
              onClick={() => setActiveTab('samples')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                activeTab === 'samples'
                  ? 'bg-white text-rose-600 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              Plantillas de Prueba
            </button>
          </div>

          <button
            onClick={onRefreshTerminals}
            disabled={isLoadingTerminals}
            className="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 shadow-2xs transition"
            title="Recargar terminales desde Firestore"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingTerminals ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
    </header>
  );
};
