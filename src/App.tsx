import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  SlidersHorizontal,
  AlertCircle,
  Database,
  Zap,
  Trash2,
  Eye,
} from 'lucide-react';
import { Header } from './components/Header';
import { FileUploaderCard } from './components/FileUploaderCard';
import { TerminalManagerView } from './components/TerminalManagerView';
import { ResultsDisplay } from './components/ResultsDisplay';
import {
  TerminalRecord,
  TransactionRecord,
  GeneratedOrderRecord,
  ExpiredOrderRecord,
  MatchedOrderResult,
  PossibleExpiredChargeResult,
  ReconciliationSummary,
  ReconciliationProgressState,
  UnregisteredTerminalInfo,
  ReconciliationValidationConfig,
  DEFAULT_VALIDATION_CONFIG,
} from './types';
import {
  getStoredTerminals,
  batchSaveTerminals,
  saveSingleTerminal,
  SAMPLE_TERMINALS,
} from './services/terminalService';
import { UnregisteredTerminalsAlert } from './components/UnregisteredTerminalsAlert';
import { ValidationSettingsModal } from './components/ValidationSettingsModal';
import { testConnection } from './firebase';
import {
  parseTransactionsFile,
  parseGeneratedOrdersFile,
  parseExpiredOrdersFile,
  performReconciliation,
  countCashRowsInTransactionsFile,
  DEFAULT_OPTIONS,
  ReconciliationOptions,
  getEffectiveValidations,
} from './utils/reconciler';

export default function App() {
  const [activeTab, setActiveTab] = useState<'reconciliation' | 'terminals'>('reconciliation');

  // Terminals from Firebase
  const [terminals, setTerminals] = useState<TerminalRecord[]>([]);
  const [isLoadingTerminals, setIsLoadingTerminals] = useState(true);

  // Files data
  const [file1Name, setFile1Name] = useState<string | null>(null);
  const [file1Rows, setFile1Rows] = useState<any[][] | null>(null);

  const [file2Name, setFile2Name] = useState<string | null>(null);
  const [file2Rows, setFile2Rows] = useState<any[][] | null>(null);

  const [file3Name, setFile3Name] = useState<string | null>(null);
  const [file3Rows, setFile3Rows] = useState<any[][] | null>(null);

  // Options
  const [options, setOptions] = useState<ReconciliationOptions>(DEFAULT_OPTIONS);
  const [showOptionsModal, setShowOptionsModal] = useState(false);

  const effectiveValidations = useMemo(() => getEffectiveValidations(options), [options]);
  const disabledValidationsCount = useMemo(() => {
    return Object.keys(DEFAULT_VALIDATION_CONFIG).filter(
      (k) => effectiveValidations[k as keyof ReconciliationValidationConfig] === false
    ).length;
  }, [effectiveValidations]);

  // Error message
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Computed reconciliation results
  const [matchedWithOrders, setMatchedWithOrders] = useState<MatchedOrderResult[] | null>(null);
  const [unmatchedApproved, setUnmatchedApproved] = useState<TransactionRecord[] | null>(null);
  const [possibleExpiredCharges, setPossibleExpiredCharges] = useState<PossibleExpiredChargeResult[] | null>(null);
  const [activeStoreIdsMap, setActiveStoreIdsMap] = useState<Map<string, string> | null>(null);
  const [unregisteredTerminals, setUnregisteredTerminals] = useState<UnregisteredTerminalInfo[]>([]);
  const [summary, setSummary] = useState<ReconciliationSummary | null>(null);
  const [progressState, setProgressState] = useState<ReconciliationProgressState | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  // Anchor to auto-scroll directly to match screen
  const resultsSectionRef = useRef<HTMLDivElement>(null);

  // Load terminals from Firebase on mount
  const loadTerminalsFromFirebase = async () => {
    setIsLoadingTerminals(true);
    try {
      await testConnection();
      const list = await getStoredTerminals();
      if (list.length === 0) {
        const seeded = await batchSaveTerminals(
          SAMPLE_TERMINALS.map((t) => ({
            serialNumber: t.serialNumber,
            storeId: t.storeId,
            notes: 'Terminal inicial registrada',
          }))
        );
        setTerminals(seeded);
      } else {
        setTerminals(list);
      }
    } catch (err: any) {
      console.warn('Firebase error fetching terminals:', err);
      setTerminals((prev) =>
        prev.length > 0
          ? prev
          : SAMPLE_TERMINALS.map((t, i) => ({
              id: `term_fallback_${i}`,
              serialNumber: t.serialNumber,
              storeId: t.storeId,
              notes: 'Terminal precargada (Modo Local/Respaldo)',
            }))
      );
    } finally {
      setIsLoadingTerminals(false);
    }
  };

  useEffect(() => {
    loadTerminalsFromFirebase();
  }, []);

  // Registration handlers for missing terminals directly to Firebase Firestore
  const handleRegisterSingleTerminal = async (serialNumber: string, storeId: string) => {
    const saved = await saveSingleTerminal({ serialNumber, storeId, notes: 'Registrada desde alerta de cotejo' });
    setTerminals((prev) => {
      const cleanSerial = serialNumber.trim().toUpperCase();
      const filtered = prev.filter((t) => t.serialNumber.trim().toUpperCase() !== cleanSerial);
      return [...filtered, saved];
    });
  };

  const handleRegisterBatchTerminals = async (items: Array<{ serialNumber: string; storeId: string }>) => {
    const saved = await batchSaveTerminals(
      items.map((it) => ({
        serialNumber: it.serialNumber,
        storeId: it.storeId,
        notes: 'Registro masivo desde alerta de cotejo',
      }))
    );
    setTerminals((prev) => {
      const savedMap = new Map(saved.map((s) => [s.serialNumber.trim().toUpperCase(), s]));
      const remaining = prev.filter((p) => !savedMap.has(p.serialNumber.trim().toUpperCase()));
      return [...remaining, ...saved];
    });
  };

  // HIGH-SPEED NON-BLOCKING RECONCILIATION ENGINE
  useEffect(() => {
    if (!file1Rows || !file2Rows) {
      if (!file1Rows && !file2Rows && !file3Rows) {
        setMatchedWithOrders(null);
        setUnmatchedApproved(null);
        setPossibleExpiredCharges(null);
        setActiveStoreIdsMap(null);
        setUnregisteredTerminals([]);
        setSummary(null);
        setProgressState(null);
      }
      return;
    }

    setIsCalculating(true);
    setErrorMessage(null);

    // Asynchronously yield to browser event loop so UI does not freeze or stutter
    const calculationTimer = setTimeout(() => {
      try {
        const cashRowsA1 = file1Rows ? countCashRowsInTransactionsFile(file1Rows) : 0;
        const transactions = parseTransactionsFile(file1Rows);
        const generatedOrders = parseGeneratedOrdersFile(file2Rows, options.validations);
        const expiredOrders = file3Rows ? parseExpiredOrdersFile(file3Rows) : [];

        if (transactions.length === 0 || generatedOrders.length === 0) {
          setIsCalculating(false);
          return;
        }

        const effectiveTerminals =
          terminals.length > 0 ? terminals : SAMPLE_TERMINALS.map((t, i) => ({ id: `t_${i}`, ...t }));

        const results = performReconciliation(
          transactions,
          generatedOrders,
          expiredOrders,
          effectiveTerminals,
          options,
          cashRowsA1
        );

        setMatchedWithOrders(results.matchedWithOrders);
        setUnmatchedApproved(results.unmatchedApprovedTransactions);
        setPossibleExpiredCharges(results.possibleExpiredCharges);
        setActiveStoreIdsMap(results.activeStoreIdsMap);
        setUnregisteredTerminals(results.unregisteredTerminals);
        setSummary(results.summary);
        setProgressState({
          isStreaming: false,
          phase: 'completed',
          phaseDescription: `Cotejo concluido: ${results.matchedWithOrders.length} coincidentes en pantalla, ${results.unmatchedApprovedTransactions.length} aprobadas restantes.`,
          progressPercent: 100,
          totalTransactionsToProcess: results.summary.file1FilteredByStoreIdRows,
          currentProcessedIndex: results.summary.file1FilteredByStoreIdRows,
          matchedCountLive: results.matchedWithOrders.length,
          expiredMatchesCountLive: results.possibleExpiredCharges.length,
        });

        // Smoothly scroll down to matches screen
        setTimeout(() => {
          resultsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      } catch (err: any) {
        console.warn('Reconciliation error:', err);
        setErrorMessage(err.message || 'Error al procesar los archivos');
      } finally {
        setIsCalculating(false);
      }
    }, 15);

    return () => clearTimeout(calculationTimer);
  }, [file1Rows, file2Rows, file3Rows, terminals, options]);

  const handleReset = () => {
    setFile1Name(null);
    setFile1Rows(null);
    setFile2Name(null);
    setFile2Rows(null);
    setFile3Name(null);
    setFile3Rows(null);
    setMatchedWithOrders(null);
    setUnmatchedApproved(null);
    setPossibleExpiredCharges(null);
    setActiveStoreIdsMap(null);
    setUnregisteredTerminals([]);
    setSummary(null);
    setProgressState(null);
    setErrorMessage(null);
  };

  // Live match preview counts for real-time header & pill
  const realtimeStatus = useMemo(() => {
    const isLive = Boolean(file1Rows && file2Rows);
    return {
      isLive,
      matchedCount: matchedWithOrders?.length || 0,
      expiredWithChargeCount: possibleExpiredCharges?.length || 0,
    };
  }, [file1Rows, file2Rows, matchedWithOrders, possibleExpiredCharges]);

  const scrollToResults = () => {
    resultsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <Header
        terminalCount={terminals.length}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isLoadingTerminals={isLoadingTerminals}
        onRefreshTerminals={loadTerminalsFromFirebase}
        realtimeStatus={realtimeStatus}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* TAB 1: RECONCILIATION */}
        {activeTab === 'reconciliation' && (
          <div className="space-y-8">
            {/* Top real-time status bar if files loaded */}
            {realtimeStatus.isLive && (
              <div className="bg-white border border-emerald-200 rounded-3xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
                    <Zap className="w-5 h-5 text-emerald-600 animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm text-slate-900">
                        Cotejo en Tiempo Real Activo
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        Calculado
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Coincidencias de tarjeta, autorización y hora actualizadas automáticamente.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    onClick={scrollToResults}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Ver Pantalla de Coincidencias ({realtimeStatus.matchedCount})</span>
                  </button>

                  <button
                    onClick={handleReset}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-rose-700 hover:text-white bg-rose-50 hover:bg-rose-600 border border-rose-200 hover:border-rose-600 shadow-2xs transition group"
                    title="Eliminar los 3 archivos cargados y reiniciar todas las coincidencias"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600 group-hover:text-white transition" />
                    <span>Limpiar Todo</span>
                  </button>
                </div>
              </div>
            )}

            {/* Hero / Instructions Card (Clean White Theme) */}
            <div className="relative overflow-hidden bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs">
              <div className="relative z-10 max-w-4xl space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-mono font-bold">
                  <span>Cotejo en Tiempo Real</span>
                  <span>•</span>
                  <span>Margen 1 a 3 min & Aumentos 5% a 20%</span>
                </div>

                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  Detección de Posibles Expiradas con Cobro
                </h2>

                <p className="text-sm text-slate-600 leading-relaxed font-medium">
                  Sube los archivos para procesar el cotejo en vivo: filtra transacciones por las
                  terminales activas en el catálogo, coteja en tiempo real contra órdenes generadas y descubre
                  transacciones aprobadas huérfanas que coinciden en hora y monto con órdenes expiradas.
                </p>

                {/* Quick steps summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
                    <span className="font-mono text-indigo-700 font-bold block mb-1">
                      1. Cruce con Terminales
                    </span>
                    <p className="text-slate-600">
                      Toma Col S (Archivo 2), busca en Base de Terminales (Col C) y obtiene ID Store (Col D)
                      para filtrar Archivo 1 (Col P).
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
                    <span className="font-mono text-emerald-700 font-bold block mb-1">
                      2. Cotejo A1 vs A2 (Pantalla)
                    </span>
                    <p className="text-slate-600">
                      Tarjeta (S vs M), Autorización (Z vs R) y Hora (D vs A con margen de 1-3 min). Ambas
                      aprobadas en Cols I y L. Se muestra en pantalla en tiempo real.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
                    <span className="font-mono text-rose-700 font-bold block mb-1">
                      3. Detección Expiradas (Excel)
                    </span>
                    <p className="text-slate-600">
                      Restantes aprobadas vs Archivo 3 por Hora (+1-3 min) y Montos con aumento del 5%, 10%,
                      15% ó 20% sobre Col H. Reporte descargable.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions Row when any file is loaded */}
            {(file1Name || file2Name || file3Name) && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white border border-slate-200 rounded-3xl px-5 py-3.5 shadow-xs">
                <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  <span>
                    Archivos cargados:{' '}
                    <strong className="text-slate-900 font-mono font-bold">
                      {[file1Name, file2Name, file3Name].filter(Boolean).length} de 3
                    </strong>
                  </span>
                  {realtimeStatus.isLive && (
                    <span className="text-emerald-700 font-bold ml-1">
                      • {realtimeStatus.matchedCount} coincidencias calculadas
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {realtimeStatus.isLive && (
                    <button
                      onClick={scrollToResults}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition"
                    >
                      <Eye className="w-3.5 h-3.5 text-slate-600" />
                      <span>Ir a la pantalla de coincidencias</span>
                    </button>
                  )}

                  <button
                    onClick={handleReset}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-rose-700 hover:text-white bg-rose-50 hover:bg-rose-600 border border-rose-200 hover:border-rose-600 transition shadow-2xs group"
                    title="Eliminar los 3 archivos cargados y reiniciar todas las coincidencias"
                  >
                    <Trash2 className="w-4 h-4 text-rose-600 group-hover:text-white transition" />
                    <span>Limpiar Todo (3 archivos y coincidencias)</span>
                  </button>
                </div>
              </div>
            )}

            {/* 3 Uploaders Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* File 1: Archivo 1 SPIN */}
              <FileUploaderCard
                fileNumber={1}
                title="Archivo 1: SPIN (Total de Registro de Transacciones)"
                subtitle="Transacciones bancarias SPIN (excluye ventas en efectivo)"
                discardRuleText="Descarta filas 1 al 12 y descarta renglones en efectivo (con ' - ')"
                columnsSummary={[
                  { col: 'D', name: 'Hora de transacción' },
                  { col: 'E', name: 'Monto de transacción (Cobrado)' },
                  { col: 'I & L', name: 'Estatus (ambas Aprobadas)' },
                  { col: 'P', name: 'Store ID' },
                  { col: 'S', name: 'Terminación tarjeta' },
                  { col: 'Z', name: 'Código autorización' },
                ]}
                fileName={file1Name}
                rowCount={file1Rows ? Math.max(0, file1Rows.length - 12) : 0}
                onFileLoaded={(name, rows) => {
                  setFile1Name(name);
                  setFile1Rows(rows);
                }}
                onClear={() => {
                  setFile1Name(null);
                  setFile1Rows(null);
                }}
              />

              {/* File 2: Archivo 2 Órdenes Yoshi */}
              <FileUploaderCard
                fileNumber={2}
                title="Archivo 2: Órdenes Yoshi (Total de Órdenes Generadas)"
                subtitle="Órdenes de venta del sistema POS Yoshi"
                discardRuleText="Datos a partir del renglón 5 (descarta renglones 1 al 4)"
                columnsSummary={[
                  { col: 'A', name: 'Fecha de venta (solo hora)' },
                  { col: 'K', name: 'Monto Total orden generada' },
                  { col: 'M', name: 'Tarjeta (últimos 4 dígitos)' },
                  { col: 'R', name: 'Código de autorización' },
                  { col: 'S', name: 'Número de terminal' },
                ]}
                fileName={file2Name}
                rowCount={file2Rows ? Math.max(0, file2Rows.length - 4) : 0}
                onFileLoaded={(name, rows) => {
                  setFile2Name(name);
                  setFile2Rows(rows);
                }}
                onClear={() => {
                  setFile2Name(null);
                  setFile2Rows(null);
                }}
              />

              {/* File 3: Archivo 3 Expiradas */}
              <FileUploaderCard
                fileNumber={3}
                title="Archivo 3: Expiradas (Total de Órdenes Expiradas)"
                subtitle="Órdenes expiradas sin completar"
                discardRuleText="Datos a partir del renglón 5 (descarta renglones 1 al 4)"
                columnsSummary={[
                  { col: 'A', name: 'Hora (solo hora)' },
                  { col: 'B', name: 'Concesión' },
                  { col: 'C', name: 'Código de orden' },
                  { col: 'E', name: 'Vendedor asignado' },
                  { col: 'H', name: 'Monto Total / Base (+5%..+20% por posible propina)' },
                ]}
                fileName={file3Name}
                rowCount={file3Rows ? Math.max(0, file3Rows.length - 4) : 0}
                onFileLoaded={(name, rows) => {
                  setFile3Name(name);
                  setFile3Rows(rows);
                }}
                onClear={() => {
                  setFile3Name(null);
                  setFile3Rows(null);
                }}
              />
            </div>

            {/* Database of Terminals Status & Options bar */}
            <div className="p-4 rounded-3xl bg-white border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
              <div className="flex items-center gap-3">
                <span className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                  <Database className="w-5 h-5" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-slate-800 uppercase font-mono tracking-wider">
                      Base de Datos de Terminales:
                    </h4>
                    <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-mono text-xs font-bold border border-indigo-200">
                      {terminals.length} activas
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium">
                    {terminals.length > 0
                      ? 'Conectada y lista para filtrar el Archivo 1 según las terminales presentes en el Archivo 2.'
                      : 'La base está vacía. Ve a "Base de Terminales" para subir tu .xlsx o cargar ejemplos.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={() => setShowOptionsModal(true)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold border flex items-center gap-2 transition ${
                    disabledValidationsCount > 0
                      ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100 shadow-2xs'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                  title="Configurar tolerancias y activar o desactivar cualquiera de las validaciones de cotejo"
                >
                  <SlidersHorizontal className="w-4 h-4 text-slate-500" />
                  <span>Reglas y Validaciones de Cotejo</span>
                  {disabledValidationsCount > 0 ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 text-amber-900">
                      {disabledValidationsCount} descat.
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      12/12 activas
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Calculation in Progress Indicator */}
            {isCalculating && (
              <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs flex items-center justify-between gap-3 font-medium animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin shrink-0" />
                  <span>Procesando cotejo a alta velocidad con indexación hash...</span>
                </div>
                <span className="text-[11px] font-mono text-indigo-700 font-bold bg-white px-2.5 py-1 rounded-lg border border-indigo-200">
                  Modo Ágil Activo
                </span>
              </div>
            )}

            {/* Error Banner */}
            {errorMessage && (
              <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-3 font-medium">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* PANTALLA DE COINCIDENCIAS Y RESULTADOS */}
            {((file1Rows && file2Rows) || summary || (matchedWithOrders && matchedWithOrders.length > 0)) && (
              <div ref={resultsSectionRef} className="scroll-mt-20">
                <ResultsDisplay
                  summary={
                    summary || {
                      file1TotalRows: file1Rows ? Math.max(0, file1Rows.length - 12) : 0,
                      file1ValidRows: 0,
                      file1ApprovedRows: 0,
                      file1FilteredByStoreIdRows: 0,
                      file2TotalRows: file2Rows ? Math.max(0, file2Rows.length - 4) : 0,
                      file2ValidRows: 0,
                      file2DistinctTerminals: 0,
                      activeMappedStoreIds: 0,
                      file3TotalRows: file3Rows ? Math.max(0, file3Rows.length - 4) : 0,
                      file3ValidRows: 0,
                      matchedWithOrdersCount: matchedWithOrders?.length || 0,
                      unmatchedApprovedCount: unmatchedApproved?.length || 0,
                      possibleExpiredWithChargeCount: possibleExpiredCharges?.length || 0,
                      unregisteredTerminalsCount: unregisteredTerminals.length,
                      unregisteredTerminalsList: unregisteredTerminals,
                      timestamp: new Date().toISOString(),
                    }
                  }
                  matchedWithOrders={matchedWithOrders || []}
                  unmatchedApproved={unmatchedApproved || []}
                  possibleExpiredCharges={possibleExpiredCharges || []}
                  activeStoreIdsMap={activeStoreIdsMap || new Map()}
                  unregisteredTerminals={unregisteredTerminals}
                  onRegisterTerminalSingle={handleRegisterSingleTerminal}
                  onRegisterTerminalBatch={handleRegisterBatchTerminals}
                  onGoToTerminalsTab={() => setActiveTab('terminals')}
                  onReset={handleReset}
                  isRealTimeActive={true}
                  progressState={progressState || undefined}
                  onOptionsClick={() => setShowOptionsModal(true)}
                  options={options}
                />
              </div>
            )}
          </div>
        )}

        {/* TAB 2: TERMINALS MANAGER */}
        {activeTab === 'terminals' && (
          <TerminalManagerView
            terminals={terminals}
            onRefresh={loadTerminalsFromFirebase}
            isLoading={isLoadingTerminals}
          />
        )}
      </main>

      {/* Reglas y Validaciones de Cotejo Modal */}
      <ValidationSettingsModal
        isOpen={showOptionsModal}
        onClose={() => setShowOptionsModal(false)}
        options={options}
        onOptionsChange={setOptions}
      />

      {/* Footer (Doofenshmirtz Malvados y Asociados con imagen1) */}
      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-700 font-medium">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-center gap-3.5">
          <img
            src="/imagen1.svg"
            alt="Dr. Heinz Doofenshmirtz"
            className="w-10 h-12 object-contain shrink-0"
          />
          <p className="font-extrabold text-slate-800 text-sm tracking-tight font-mono">
            Expiraminator -Doofenshmirtz Malvados y Asociados Yoshis
          </p>
        </div>
      </footer>
    </div>
  );
}
