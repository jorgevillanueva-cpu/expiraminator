import React, { useState } from 'react';
import { AlertTriangle, Plus, Database, CheckCircle2, ChevronRight, ArrowRight } from 'lucide-react';
import { UnregisteredTerminalInfo } from '../types';

interface UnregisteredTerminalsAlertProps {
  unregisteredTerminals: UnregisteredTerminalInfo[];
  onRegisterSingle: (serialNumber: string, storeId: string) => Promise<void>;
  onRegisterBatch: (items: Array<{ serialNumber: string; storeId: string }>) => Promise<void>;
  onGoToTerminalsTab?: () => void;
}

export const UnregisteredTerminalsAlert: React.FC<UnregisteredTerminalsAlertProps> = ({
  unregisteredTerminals,
  onRegisterSingle,
  onRegisterBatch,
  onGoToTerminalsTab,
}) => {
  const [storeIdInputs, setStoreIdInputs] = useState<Record<string, string>>({});
  const [defaultStoreId, setDefaultStoreId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [saveErrorMsg, setSaveErrorMsg] = useState<string | null>(null);
  const [showBatchAssign, setShowBatchAssign] = useState(false);

  if (unregisteredTerminals.length === 0) return null;

  const totalAffectedOrders = unregisteredTerminals.reduce((acc, t) => acc + t.orderCount, 0);

  const handleInputChange = (serial: string, value: string) => {
    setStoreIdInputs((prev) => ({ ...prev, [serial]: value }));
  };

  const handleSaveOne = async (serial: string) => {
    const storeId = (storeIdInputs[serial] || '').trim();
    if (!storeId) {
      setSaveErrorMsg(`Por favor ingresa un Store ID para la terminal ${serial}`);
      return;
    }
    setSaveErrorMsg(null);
    setIsSaving(true);
    try {
      await onRegisterSingle(serial, storeId);
      setSaveSuccessMsg(`Terminal ${serial} registrada exitosamente con Store ID: ${storeId}`);
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch (err: any) {
      setSaveErrorMsg(err.message || 'Error al guardar la terminal');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAllWithDefault = async () => {
    const cleanDefault = defaultStoreId.trim();
    if (!cleanDefault) {
      setSaveErrorMsg('Ingresa un Store ID general para asignar a las terminales');
      return;
    }
    setSaveErrorMsg(null);
    setIsSaving(true);
    try {
      const items = unregisteredTerminals.map((t) => ({
        serialNumber: t.serialNumber,
        storeId: (storeIdInputs[t.serialNumber] || cleanDefault).trim(),
      }));
      await onRegisterBatch(items);
      setSaveSuccessMsg(`¡${items.length} terminales registradas y sincronizadas en la base de datos!`);
      setTimeout(() => setSaveSuccessMsg(null), 5000);
    } catch (err: any) {
      setSaveErrorMsg(err.message || 'Error al registrar las terminales');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-amber-50/90 border-2 border-amber-400 rounded-3xl p-5 shadow-sm space-y-4 transition-all">
      {/* Alert Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-amber-200 pb-3.5">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm animate-bounce-short">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-black text-amber-950 text-base">
                ¡Atención! {unregisteredTerminals.length} Terminal{unregisteredTerminals.length > 1 ? 'es' : ''} No Aparece{unregisteredTerminals.length > 1 ? 'n' : ''} en la Base de Datos
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-200 text-amber-900 border border-amber-300">
                {totalAffectedOrders} órdenes afectadas
              </span>
            </div>
            <p className="text-xs text-amber-800 font-medium mt-0.5">
              El Archivo 2 contiene terminales que no están dadas de alta en el catálogo. Sus órdenes no pueden enlazarse a un Store ID y no se cotejarán con el Archivo 1 hasta que se registren.
            </p>
          </div>
        </div>

        {onGoToTerminalsTab && (
          <button
            onClick={onGoToTerminalsTab}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition shrink-0"
          >
            <Database className="w-3.5 h-3.5" />
            <span>Ver Catálogo Completo</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {saveSuccessMsg && (
        <div className="flex items-center gap-2 p-3 bg-emerald-100 border border-emerald-300 rounded-xl text-emerald-900 text-xs font-bold animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {saveErrorMsg && (
        <div className="flex items-center gap-2 p-3 bg-rose-100 border border-rose-300 rounded-xl text-rose-900 text-xs font-bold animate-fadeIn">
          <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />
          <span>{saveErrorMsg}</span>
        </div>
      )}

      {/* Terminal Cards / Fast Register List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-xs font-extrabold text-amber-950 uppercase tracking-wide">
            Terminales detectadas en Archivo 2 sin registro:
          </p>

          <button
            type="button"
            onClick={() => setShowBatchAssign(!showBatchAssign)}
            className="text-xs font-bold text-amber-900 hover:text-amber-950 underline decoration-amber-400"
          >
            {showBatchAssign ? 'Ocultar asignación masiva' : 'Asignar mismo Store ID a todas'}
          </button>
        </div>

        {showBatchAssign && (
          <div className="p-3 bg-white/80 rounded-2xl border border-amber-200 flex flex-col sm:flex-row items-center gap-2 text-xs">
            <span className="font-bold text-slate-700 whitespace-nowrap">Asignar Store ID a todas:</span>
            <input
              type="text"
              placeholder="Ej. STR-010"
              value={defaultStoreId}
              onChange={(e) => setDefaultStoreId(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-mono text-xs focus:outline-none focus:border-amber-500 w-full sm:w-44"
            />
            <button
              onClick={handleSaveAllWithDefault}
              disabled={isSaving || !defaultStoreId.trim()}
              className="w-full sm:w-auto px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-xs shadow-xs transition flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Registrar Todas en Base de Datos</span>
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-64 overflow-y-auto pr-1">
          {unregisteredTerminals.map((item) => (
            <div
              key={item.serialNumber}
              className="p-3 rounded-2xl bg-white border border-amber-300 shadow-2xs flex flex-col justify-between gap-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">
                    Serie en Archivo 2 (Col S):
                  </span>
                  <p className="font-mono font-black text-slate-900 text-xs">
                    {item.serialNumber}
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-100 text-amber-900 border border-amber-200 whitespace-nowrap">
                  {item.orderCount} orden{item.orderCount > 1 ? 'es' : ''}
                </span>
              </div>

              <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100">
                <input
                  type="text"
                  placeholder="ID Store (Col D)"
                  value={storeIdInputs[item.serialNumber] ?? ''}
                  onChange={(e) => handleInputChange(item.serialNumber, e.target.value)}
                  className="w-full px-2.5 py-1 text-xs font-mono rounded-lg border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:border-amber-500 text-slate-900 placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => handleSaveOne(item.serialNumber)}
                  disabled={isSaving || !storeIdInputs[item.serialNumber]?.trim()}
                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs transition shrink-0 shadow-2xs"
                  title="Guardar en base de datos Firestore"
                >
                  Guardar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
