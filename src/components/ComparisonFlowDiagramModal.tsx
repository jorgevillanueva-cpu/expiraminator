import React from 'react';
import {
  Database,
  FileSpreadsheet,
  ArrowRight,
  ArrowDown,
  CheckCircle2,
  AlertTriangle,
  Clock,
  CreditCard,
  Hash,
  Percent,
  HelpCircle,
  X,
  Sparkles,
} from 'lucide-react';

interface ComparisonFlowDiagramModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ComparisonFlowDiagramModal: React.FC<ComparisonFlowDiagramModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto animate-fadeIn">
        {/* Header */}
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight">
                Diagrama de Flujo de Comparaciones entre Archivos
              </h2>
              <p className="text-xs text-slate-300">
                Reglas exactas de cruce, extracción de columnas y detección de cobros con posible propina
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Diagram Content */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-8 bg-slate-50 text-slate-900 text-xs">
          
          {/* STEP 0: Terminals Mapping & Verification */}
          <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-mono font-bold flex items-center justify-center text-xs">
                  0
                </span>
                <h3 className="font-extrabold text-sm text-slate-900 uppercase font-mono tracking-wider">
                  Paso 0: Verificación de Terminales en Base de Datos (Firestore)
                </h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono text-[11px] font-bold">
                Mapeo Serie → Store ID
              </span>
            </div>

            <p className="text-slate-600 text-xs leading-relaxed">
              El sistema analiza el <strong>Archivo 2 (Órdenes Generadas)</strong> para extraer todos los números de serie de terminales presentes en la <strong className="text-indigo-600">Columna S</strong>. Luego consulta la base de datos de terminales en Firestore:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-2">
                <div className="flex items-center gap-2 text-emerald-800 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Si la terminal ESTÁ en la Base de Datos:</span>
                </div>
                <div className="text-xs font-mono text-emerald-950 bg-white p-2.5 rounded-xl border border-emerald-200">
                  Serie en Archivo 2 (Col S) ➔ Base Col C ➔ Obtiene Store ID (Col D)
                </div>
                <p className="text-[11px] text-emerald-800">
                  El Store ID se marca como activo para filtrar las transacciones correspondientes en el Archivo 1.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 space-y-2">
                <div className="flex items-center gap-2 text-amber-900 font-bold">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>Si la terminal NO ESTÁ en la Base de Datos:</span>
                </div>
                <div className="text-xs font-mono text-amber-950 bg-white p-2.5 rounded-xl border border-amber-300">
                  ⚠️ ALERTA: Terminal no encontrada en catálogo + Conteo de órdenes
                </div>
                <p className="text-[11px] text-amber-900 font-medium">
                  Se envía mensaje/alerta en pantalla indicando la terminal y se permite registrar su Store ID de inmediato para no dejar órdenes huérfanas.
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <ArrowDown className="w-6 h-6 text-slate-400" />
          </div>

          {/* STEP 1: Archivo 1 Filtering */}
          <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-rose-600 text-white font-mono font-bold flex items-center justify-center text-xs">
                  1
                </span>
                <h3 className="font-extrabold text-sm text-slate-900 uppercase font-mono tracking-wider">
                  Paso 1: Archivo 1 (Transacciones SPIN) - Filtrado y Aprobación
                </h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-mono text-[11px] font-bold">
                Descarta filas 1 al 12 y renglones en efectivo (-)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                <span className="text-[10px] uppercase font-mono font-bold text-slate-400">Regla 1.1</span>
                <p className="font-bold text-slate-900">Store ID (Columna P)</p>
                <p className="text-[11px] text-slate-600">
                  La transacción debe pertenecer a uno de los Store IDs mapeados desde las terminales activas del Archivo 2.
                </p>
              </div>
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                <span className="text-[10px] uppercase font-mono font-bold text-slate-400">Regla 1.2</span>
                <p className="font-bold text-slate-900">Estatus Aprobada (Cols I y L)</p>
                <p className="text-[11px] text-slate-600">
                  Ambas columnas deben coincidir y tener estatus de cobro <strong>Aprobada</strong>.
                </p>
              </div>
              <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 space-y-1">
                <span className="text-[10px] uppercase font-mono font-bold text-amber-700">Regla 1.3 • Efectivo</span>
                <p className="font-bold text-amber-950">Exclusión de Renglones con '-'</p>
                <p className="text-[11px] text-amber-800">
                  Los renglones que tengan un <strong>'-'</strong> no se cuentan como transacciones bancarias, ya que fueron en efectivo.
                </p>
              </div>
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                <span className="text-[10px] uppercase font-mono font-bold text-slate-400">Datos Extraídos</span>
                <p className="font-bold text-slate-900">Hora (D), Monto (E), Tarjeta (S), Aut. (Y)</p>
                <p className="text-[11px] text-slate-600">
                  Campos utilizados como llaves de comparación para el cruce.
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <ArrowDown className="w-6 h-6 text-slate-400" />
          </div>

          {/* STEP 2: Cruce A1 vs A2 */}
          <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-emerald-600 text-white font-mono font-bold flex items-center justify-center text-xs">
                  2
                </span>
                <h3 className="font-extrabold text-sm text-slate-900 uppercase font-mono tracking-wider">
                  Paso 2: Cruce Archivo 1 (SPIN) vs Archivo 2 (Órdenes Generadas Yoshi)
                </h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono text-[11px] font-bold">
                Monto Total en Columna K
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 text-white font-mono text-xs space-y-2">
              <p className="text-emerald-400 font-bold uppercase tracking-wider text-[11px]">
                Condiciones simultáneas de Coincidencia (Hash-Index):
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700">
                  <span className="text-slate-400 text-[10px] block">Tarjeta (4 dígitos):</span>
                  <span className="text-white font-bold">A1 Col S == A2 Col M</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700">
                  <span className="text-slate-400 text-[10px] block">Autorización:</span>
                  <span className="text-white font-bold">A1 Col Y == A2 Col R</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700">
                  <span className="text-slate-400 text-[10px] block">Ventana de Tiempo:</span>
                  <span className="text-white font-bold">A1 Col D vs A2 Col A (+1 a +3 min)</span>
                </div>
              </div>
              <p className="text-slate-400 text-[10.5px] pt-1">
                * Archivo 2 descarta filas 1 al 4 y órdenes en efectivo con '-'. <strong>Monto Total de orden está en Columna K</strong>.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-1.5">
                <span className="px-2 py-0.5 rounded bg-emerald-200 text-emerald-900 font-mono font-bold text-[10px] uppercase">
                  Coincidentes en Pantalla
                </span>
                <p className="font-bold text-slate-900">Cobros Exitosos con Orden Generada</p>
                <p className="text-slate-600 text-xs">
                  La transacción bancaria corresponde exactamente a una orden de venta real registrada en el sistema POS Yoshi.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 space-y-1.5">
                <span className="px-2 py-0.5 rounded bg-amber-200 text-amber-900 font-mono font-bold text-[10px] uppercase">
                  Aprobadas Restantes
                </span>
                <p className="font-bold text-slate-900">Cobros Aprobados SIN Orden en A2</p>
                <p className="text-slate-600 text-xs">
                  El dinero se cobró a la tarjeta en la terminal, pero <strong>no hay orden de venta en el Archivo 2</strong>. Pasan al Paso 3 para ver si la orden expiró.
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <ArrowDown className="w-6 h-6 text-slate-400" />
          </div>

          {/* STEP 3: Cruce con Archivo 3 (Expiradas y Propinas) */}
          <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-rose-600 text-white font-mono font-bold flex items-center justify-center text-xs">
                  3
                </span>
                <h3 className="font-extrabold text-sm text-slate-900 uppercase font-mono tracking-wider">
                  Paso 3: Cruce de Aprobadas Restantes vs Archivo 3 (Órdenes Expiradas)
                </h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-mono text-[11px] font-bold">
                Detección con Posible Propina
              </span>
            </div>

            <p className="text-slate-600 text-xs leading-relaxed">
              Las <strong>Aprobadas Restantes</strong> se cotejan contra las <strong>Órdenes Expiradas (Archivo 3, inicia en fila 5)</strong> evaluando coincidencia de hora (margen superior +1 a +3 min) y el monto cobrado contra la Columna H (o G) considerando los incrementos de <strong>posible propina</strong>:
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 font-mono text-center">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-slate-400 text-[10px] uppercase block">Sin Propina</span>
                <span className="text-slate-900 font-bold text-sm block mt-1">Exacto 0%</span>
                <span className="text-[10px] text-slate-500">Monto A1 == A3 Col H</span>
              </div>
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200">
                <span className="text-rose-600 text-[10px] uppercase font-bold block">+5% Propina</span>
                <span className="text-rose-900 font-bold text-sm block mt-1">Base × 1.05</span>
                <span className="text-[10px] text-rose-700">Propina mínima</span>
              </div>
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200">
                <span className="text-rose-600 text-[10px] uppercase font-bold block">+10% Propina</span>
                <span className="text-rose-900 font-bold text-sm block mt-1">Base × 1.10</span>
                <span className="text-[10px] text-rose-700">Propina habitual</span>
              </div>
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200">
                <span className="text-rose-600 text-[10px] uppercase font-bold block">+15% Propina</span>
                <span className="text-rose-900 font-bold text-sm block mt-1">Base × 1.15</span>
                <span className="text-[10px] text-rose-700">Propina estándar</span>
              </div>
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200">
                <span className="text-rose-600 text-[10px] uppercase font-bold block">+20% Propina</span>
                <span className="text-rose-900 font-bold text-sm block mt-1">Base × 1.20</span>
                <span className="text-[10px] text-rose-700">Propina generosa</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-rose-100/70 border border-rose-300 text-rose-950 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-extrabold text-xs">
                  Hallazgo: Cobro No Correspondiente (Orden Expirada Cobrada al Cliente)
                </p>
                <p className="text-[11.5px] text-rose-900 mt-0.5">
                  Si coincide en hora y monto (exacto o con porcentaje de posible propina), se detecta que el cliente fue cobrado por una orden que expiró en la terminal y nunca se le entregó, o que requiere aclaración con la concesión/vendedor.
                </p>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-mono">
            Expiraminator Engine • Reglas actualizadas (Col K & Posibles Propinas)
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition"
          >
            Cerrar Diagrama
          </button>
        </div>
      </div>
    </div>
  );
};
