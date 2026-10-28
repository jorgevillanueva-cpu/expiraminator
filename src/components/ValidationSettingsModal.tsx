import React from 'react';
import {
  SlidersHorizontal,
  ShieldCheck,
  ShieldAlert,
  RotateCcw,
  X,
  Building,
  CreditCard,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Zap,
} from 'lucide-react';
import {
  ReconciliationValidationConfig,
  DEFAULT_VALIDATION_CONFIG,
} from '../types';
import {
  getEffectiveValidations,
  ReconciliationOptions,
  DEFAULT_OPTIONS,
} from '../utils/reconciler';

interface ValidationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  options: ReconciliationOptions;
  onOptionsChange: (newOptions: ReconciliationOptions) => void;
}

interface ValidationItemDef {
  key: keyof ReconciliationValidationConfig;
  title: string;
  badge: string;
  description: string;
  category: 'store_terminal' | 'file2_clean' | 'card_match' | 'expired_match';
}

const VALIDATION_ITEMS: ValidationItemDef[] = [
  // 1. Store ID & Terminal
  {
    key: 'filterByStoreId',
    category: 'store_terminal',
    title: 'Filtrar Archivo 1 por Store IDs de Terminales Activas',
    badge: 'Paso Previo • Archivo 1 Col P',
    description:
      'Filtra las transacciones bancarias SPIN (Col P) para incluir exclusivamente las que correspondan a Store IDs de terminales activas detectadas en Archivo 2 y registradas en el catálogo.',
  },
  {
    key: 'matchStoreIdA1A2',
    category: 'store_terminal',
    title: 'Cotejar Store ID entre Transacción y Orden Yoshi (A1 vs A2)',
    badge: 'Paso 1 • Tienda Física',
    description:
      'Verifica que la terminal física de la orden de venta (Archivo 2 Col S) y la transacción bancaria (Archivo 1 Col P) pertenezcan al mismo Store ID, evitando cruces entre sucursales distintas.',
  },
  {
    key: 'matchTerminalOrStoreA1A3',
    category: 'store_terminal',
    title: 'Cotejar Terminal Física o Store ID en Aprobadas vs Expiradas',
    badge: 'Paso 3 • Expiradas',
    description:
      'Exige que la transacción aprobada restante y la orden expirada correspondan a la misma terminal física o al mismo Store ID confirmado antes de marcar un cobro huérfano.',
  },
  {
    key: 'requireTerminalForExpired',
    category: 'store_terminal',
    title: 'Exigir Terminal Asignada en Órdenes Expiradas',
    badge: 'Cobros con Tarjeta',
    description:
      'Descarta órdenes expiradas que no tengan terminal asignada (por ejemplo, si el cajero solo cobró en efectivo con "-" en Col S). Evita falsos positivos en concesiones que no usan terminal POS.',
  },

  // 2. Archivo 2 & Asignación
  {
    key: 'excludeCashAndEmptyTerminal',
    category: 'file2_clean',
    title: 'Excluir Cobros en Efectivo o con Terminal Vacía en Archivo 2',
    badge: 'Higiene Archivo 2',
    description:
      'Descarta del procesamiento los renglones de Archivo 2 con forma de pago "Efectivo" o con la Columna S vacía / "-", ya que no corresponden a terminales bancarias.',
  },
  {
    key: 'assignTerminalFromA2ToA3',
    category: 'file2_clean',
    title: 'Cruce Previo de Concesión y Vendedor (A3 vs A2) para Asignar Terminal',
    badge: 'Cruce Previo A3 vs A2',
    description:
      'Compara Concesión (A3 Col B vs A2 Col D) y Vendedor (A3 Col E vs A2 Col F). Al coincidir ambos, transfiere automáticamente el número de terminal física de Archivo 2 Col S a Archivo 3.',
  },

  // 3. Transacciones Bancarias (A1 vs A2)
  {
    key: 'matchCardEnding',
    category: 'card_match',
    title: 'Cotejar Terminación de Tarjeta (Últimos 4 Dígitos)',
    badge: 'Paso 1 • A1 Col S vs A2 Col M',
    description:
      'Verifica que los últimos 4 dígitos de la tarjeta bancaria coincidan exactamente entre la transacción SPIN y la orden de venta generada.',
  },
  {
    key: 'matchAuthCode',
    category: 'card_match',
    title: 'Cotejar Código de Autorización Bancaria',
    badge: 'Paso 1 • A1 Col Z vs A2 Col R',
    description:
      'Compara el código de autorización bancaria (normalizando ceros a la izquierda y formatos numéricos) entre SPIN y Yoshi.',
  },
  {
    key: 'matchTimeWindowA1A2',
    category: 'card_match',
    title: 'Cotejar Ventana de Tiempo (1 a 3 Minutos) en Órdenes Generadas',
    badge: 'Paso 1 • Tolerancia de Hora',
    description:
      'Valida que la hora de cobro bancario (Archivo 1 Col D) ocurra dentro de la ventana de tiempo configurada respecto a la orden generada (Archivo 2 Col A).',
  },
  {
    key: 'matchAmountA1A2',
    category: 'card_match',
    title: 'Cotejar Monto Cobrado vs Monto de la Orden (A1 Col E vs A2 Col K)',
    badge: 'Paso 1 • Exactitud de Monto',
    description:
      'Compara que el monto total de la orden generada en Yoshi coincida exactamente con el cargo bancario de la transacción en SPIN, evitando cruces erróneos entre tarjetas con misma terminación.',
  },

  // 4. Órdenes Expiradas
  {
    key: 'matchTimeWindowA1A3',
    category: 'expired_match',
    title: 'Cotejar Ventana de Tiempo (+1 a 3 Minutos) en Órdenes Expiradas',
    badge: 'Paso 3 • A1 Col D vs A3 Col A',
    description:
      'Verifica que la hora de la transacción bancaria aprobada restante ocurra entre 1 y 3 minutos después de la hora registrada en la orden expirada.',
  },
  {
    key: 'matchAmountA1A3',
    category: 'expired_match',
    title: 'Cotejar Coincidencia de Monto en Órdenes Expiradas',
    badge: 'Paso 3 • Monto Cobrado vs A3',
    description:
      'Evalúa que el monto cobrado de la transacción bancaria coincida con el monto total (Col H) o monto base (Col G) de la orden expirada (dentro de la tolerancia de centavos).',
  },
  {
    key: 'enableTipIncrements',
    category: 'expired_match',
    title: 'Evaluar Incrementos del 5% al 20% por Posible Propina',
    badge: 'Paso 3 • Propinas +5% a +20%',
    description:
      'Permite evaluar si el cobro de la transacción incluye propina (+5%, +10%, +15%, +20%) sobre el monto de la orden expirada. Si se desactiva, solo se evalúa monto exacto.',
  },
];

export const ValidationSettingsModal: React.FC<ValidationSettingsModalProps> = ({
  isOpen,
  onClose,
  options,
  onOptionsChange,
}) => {
  if (!isOpen) return null;

  const currentValidations = getEffectiveValidations(options);

  const disabledCount = Object.keys(DEFAULT_VALIDATION_CONFIG).filter(
    (k) => currentValidations[k as keyof ReconciliationValidationConfig] === false
  ).length;

  const handleToggle = (key: keyof ReconciliationValidationConfig) => {
    const updatedVal: ReconciliationValidationConfig = {
      ...currentValidations,
      [key]: !currentValidations[key],
    };
    onOptionsChange({
      ...options,
      enableTipIncrements: updatedVal.enableTipIncrements,
      validations: updatedVal,
    });
  };

  const handleEnableAll = () => {
    onOptionsChange({
      ...options,
      enableTipIncrements: true,
      validations: { ...DEFAULT_VALIDATION_CONFIG },
    });
  };

  const handleDisableStoreIdAndTerminals = () => {
    onOptionsChange({
      ...options,
      validations: {
        ...currentValidations,
        filterByStoreId: false,
        matchStoreIdA1A2: false,
        matchTerminalOrStoreA1A3: false,
        requireTerminalForExpired: false,
      },
    });
  };

  const handleDisableAll = () => {
    const allDisabled: ReconciliationValidationConfig = {
      filterByStoreId: false,
      matchStoreIdA1A2: false,
      matchTerminalOrStoreA1A3: false,
      requireTerminalForExpired: false,
      excludeCashAndEmptyTerminal: false,
      assignTerminalFromA2ToA3: false,
      matchCardEnding: false,
      matchAuthCode: false,
      matchTimeWindowA1A2: false,
      matchAmountA1A2: false,
      matchTimeWindowA1A3: false,
      matchAmountA1A3: false,
      enableTipIncrements: false,
    };
    onOptionsChange({
      ...options,
      enableTipIncrements: false,
      validations: allDisabled,
    });
  };

  const handleResetDefaults = () => {
    onOptionsChange(DEFAULT_OPTIONS);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto animate-fadeIn">
        
        {/* Top Header */}
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-400/40 flex items-center justify-center text-rose-400">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-tight">
                  Reglas y Validaciones de Cotejo
                </h2>
                {disabledCount === 0 ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <ShieldCheck className="w-3 h-3" />
                    Todas Activas (12/12)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    <ShieldAlert className="w-3 h-3" />
                    {disabledCount} validaciones desactivadas
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Activa o desactiva libremente cualquier comparación (Store ID, terminales, tarjeta, autorización, tiempos y montos).
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Action Presets Bar */}
        <div className="bg-slate-100/80 border-b border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-mono text-slate-600 font-bold">
            Atajos rápidos:
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleEnableAll}
              className="px-3 py-1.5 rounded-xl font-bold bg-white text-slate-700 hover:text-emerald-700 hover:bg-emerald-50 border border-slate-200 transition shadow-2xs"
            >
              ✓ Activar Todas (Estricto)
            </button>
            <button
              type="button"
              onClick={handleDisableStoreIdAndTerminals}
              className="px-3 py-1.5 rounded-xl font-bold bg-white text-slate-700 hover:text-indigo-700 hover:bg-indigo-50 border border-slate-200 transition shadow-2xs"
              title="Quitar cotejos de ID Store y terminales físicas, manteniendo validación de tarjeta y autorización"
            >
              ⊘ Quitar Validación Store ID y Terminal
            </button>
            <button
              type="button"
              onClick={handleDisableAll}
              className="px-3 py-1.5 rounded-xl font-bold bg-white text-slate-700 hover:text-rose-700 hover:bg-rose-50 border border-slate-200 transition shadow-2xs"
            >
              ⊘ Desactivar Todas (Cruce Libre)
            </button>
            <button
              type="button"
              onClick={handleResetDefaults}
              className="px-3 py-1.5 rounded-xl font-bold bg-white text-slate-500 hover:text-slate-900 border border-slate-200 transition shadow-2xs flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              Restablecer
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50 text-slate-900">
          
          {/* Warning banner when any validation is disabled */}
          {disabledCount > 0 && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-extrabold text-amber-900">
                  Modo de Cotejo Personalizado ({disabledCount} reglas desactivadas)
                </p>
                <p className="text-amber-700 mt-0.5 leading-relaxed font-medium">
                  Al quitar validaciones como el Store ID o la verificación de terminal física, el sistema cotejará
                  los registros de forma más flexible o abierta. Los resultados en pantalla se recalculan al instante.
                </p>
              </div>
            </div>
          )}

          {/* Section 1: Tolerancias Numéricas */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
              <Clock className="w-4 h-4 text-slate-700" />
              <h3 className="text-sm font-extrabold text-slate-900">
                1. Tolerancias Numéricas (Tiempo y Centavos)
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                <label className="block text-slate-700 font-mono font-bold mb-1">
                  Margen superior de tiempo (min):
                </label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={Math.round(options.maxTimeDiffSeconds / 60)}
                  onChange={(e) =>
                    onOptionsChange({
                      ...options,
                      maxTimeDiffSeconds: Math.max(1, parseInt(e.target.value, 10) || 3) * 60,
                    })
                  }
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-slate-900 font-mono font-bold shadow-2xs"
                />
                <span className="text-[11px] text-slate-500 block mt-1">
                  Regla estándar: 1 a 3 minutos ({options.maxTimeDiffSeconds}s)
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                <label className="block text-slate-700 font-mono font-bold mb-1">
                  Margen mínimo de tiempo (seg):
                </label>
                <input
                  type="number"
                  min={0}
                  max={300}
                  value={options.minTimeDiffSeconds}
                  onChange={(e) =>
                    onOptionsChange({
                      ...options,
                      minTimeDiffSeconds: Math.max(0, parseInt(e.target.value, 10) || 0),
                    })
                  }
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-slate-900 font-mono font-bold shadow-2xs"
                />
                <span className="text-[11px] text-slate-500 block mt-1">
                  0s permite coincidencia simultánea
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                <label className="block text-slate-700 font-mono font-bold mb-1">
                  Tolerancia de centavos en monto ($):
                </label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  max={10}
                  value={options.amountTolerance}
                  onChange={(e) =>
                    onOptionsChange({
                      ...options,
                      amountTolerance: parseFloat(e.target.value) || 0.99,
                    })
                  }
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-slate-900 font-mono font-bold shadow-2xs"
                />
                <span className="text-[11px] text-slate-500 block mt-1">
                  Tolerancia para comparar aumentos de propina
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Validaciones de Store ID y Terminales */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
              <Building className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-extrabold text-slate-900">
                2. Validaciones de Identificación (Store ID y Terminal Física)
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {VALIDATION_ITEMS.filter((item) => item.category === 'store_terminal').map((item) => {
                const isActive = currentValidations[item.key];
                return (
                  <div
                    key={item.key}
                    onClick={() => handleToggle(item.key)}
                    className={`p-4 rounded-2xl border transition cursor-pointer select-none flex flex-col justify-between ${
                      isActive
                        ? 'bg-slate-50/80 border-slate-200 hover:border-indigo-300'
                        : 'bg-rose-50/40 border-rose-200 hover:border-rose-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span
                          className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold border ${
                            isActive
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              : 'bg-slate-100 text-slate-500 border-slate-200'
                          }`}
                        >
                          {item.badge}
                        </span>
                        <div className="relative inline-flex items-center shrink-0">
                          <input
                            type="checkbox"
                            checked={isActive}
                            onChange={() => {}}
                            className="sr-only peer"
                          />
                          <div className="w-10 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                        </div>
                      </div>

                      <h4 className="text-xs font-bold text-slate-900 leading-snug">
                        {item.title}
                      </h4>
                      <p className="text-[11px] text-slate-500 font-medium leading-relaxed mt-1">
                        {item.description}
                      </p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono">
                      <span className={isActive ? 'text-emerald-700 font-bold' : 'text-rose-600 font-bold'}>
                        {isActive ? '✓ Validación Activada' : '⊘ Validación Omitida'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 3: Higiene de Archivo 2 & Cruce Previo A3 */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <h3 className="text-sm font-extrabold text-slate-900">
                3. Filtros de Archivo 2 (Órdenes Yoshi) y Cruce Previo
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {VALIDATION_ITEMS.filter((item) => item.category === 'file2_clean').map((item) => {
                const isActive = currentValidations[item.key];
                return (
                  <div
                    key={item.key}
                    onClick={() => handleToggle(item.key)}
                    className={`p-4 rounded-2xl border transition cursor-pointer select-none flex flex-col justify-between ${
                      isActive
                        ? 'bg-slate-50/80 border-slate-200 hover:border-purple-300'
                        : 'bg-rose-50/40 border-rose-200 hover:border-rose-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span
                          className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold border ${
                            isActive
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : 'bg-slate-100 text-slate-500 border-slate-200'
                          }`}
                        >
                          {item.badge}
                        </span>
                        <div className="relative inline-flex items-center shrink-0">
                          <input
                            type="checkbox"
                            checked={isActive}
                            onChange={() => {}}
                            className="sr-only peer"
                          />
                          <div className="w-10 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                        </div>
                      </div>

                      <h4 className="text-xs font-bold text-slate-900 leading-snug">
                        {item.title}
                      </h4>
                      <p className="text-[11px] text-slate-500 font-medium leading-relaxed mt-1">
                        {item.description}
                      </p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono">
                      <span className={isActive ? 'text-emerald-700 font-bold' : 'text-rose-600 font-bold'}>
                        {isActive ? '✓ Validación Activada' : '⊘ Validación Omitida'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 4: Validaciones de Transacciones Bancarias (Paso 1: A1 vs A2) */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
              <CreditCard className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-extrabold text-slate-900">
                4. Validaciones de Transacción Bancaria (Paso 1: A1 vs A2)
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {VALIDATION_ITEMS.filter((item) => item.category === 'card_match').map((item) => {
                const isActive = currentValidations[item.key];
                return (
                  <div
                    key={item.key}
                    onClick={() => handleToggle(item.key)}
                    className={`p-4 rounded-2xl border transition cursor-pointer select-none flex flex-col justify-between ${
                      isActive
                        ? 'bg-slate-50/80 border-slate-200 hover:border-emerald-300'
                        : 'bg-rose-50/40 border-rose-200 hover:border-rose-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span
                          className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold border ${
                            isActive
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-100 text-slate-500 border-slate-200'
                          }`}
                        >
                          {item.badge}
                        </span>
                        <div className="relative inline-flex items-center shrink-0">
                          <input
                            type="checkbox"
                            checked={isActive}
                            onChange={() => {}}
                            className="sr-only peer"
                          />
                          <div className="w-10 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                        </div>
                      </div>

                      <h4 className="text-xs font-bold text-slate-900 leading-snug">
                        {item.title}
                      </h4>
                      <p className="text-[11px] text-slate-500 font-medium leading-relaxed mt-1">
                        {item.description}
                      </p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono">
                      <span className={isActive ? 'text-emerald-700 font-bold' : 'text-rose-600 font-bold'}>
                        {isActive ? '✓ Activada' : '⊘ Omitida'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 5: Validaciones de Órdenes Expiradas (Paso 3: A1 vs A3) */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
              <Zap className="w-4 h-4 text-rose-600" />
              <h3 className="text-sm font-extrabold text-slate-900">
                5. Validaciones de Detección de Expiradas (Paso 3: Aprobadas Restantes vs A3)
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {VALIDATION_ITEMS.filter((item) => item.category === 'expired_match').map((item) => {
                const isActive = currentValidations[item.key];
                return (
                  <div
                    key={item.key}
                    onClick={() => handleToggle(item.key)}
                    className={`p-4 rounded-2xl border transition cursor-pointer select-none flex flex-col justify-between ${
                      isActive
                        ? 'bg-slate-50/80 border-slate-200 hover:border-rose-300'
                        : 'bg-rose-50/40 border-rose-200 hover:border-rose-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span
                          className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold border ${
                            isActive
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-slate-100 text-slate-500 border-slate-200'
                          }`}
                        >
                          {item.badge}
                        </span>
                        <div className="relative inline-flex items-center shrink-0">
                          <input
                            type="checkbox"
                            checked={isActive}
                            onChange={() => {}}
                            className="sr-only peer"
                          />
                          <div className="w-10 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                        </div>
                      </div>

                      <h4 className="text-xs font-bold text-slate-900 leading-snug">
                        {item.title}
                      </h4>
                      <p className="text-[11px] text-slate-500 font-medium leading-relaxed mt-1">
                        {item.description}
                      </p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono">
                      <span className={isActive ? 'text-emerald-700 font-bold' : 'text-rose-600 font-bold'}>
                        {isActive ? '✓ Activada' : '⊘ Omitida'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500 font-medium hidden sm:block">
            {disabledCount === 0 ? (
              <span className="text-emerald-700 font-bold font-mono">
                ✓ Todas las comparaciones están activas (Modo Estricto).
              </span>
            ) : (
              <span className="text-amber-700 font-bold font-mono">
                ⚠️ Hay {disabledCount} validaciones desactivadas. El cálculo se ajustará en vivo.
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition ml-auto"
          >
            Guardar y Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
