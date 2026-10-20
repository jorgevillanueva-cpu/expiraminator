import React, { useState } from 'react';
import {
  Download,
  AlertTriangle,
  CheckCircle,
  Clock,
  Search,
  Building,
  Eye,
  Zap,
  Trash2,
  CheckCircle2,
  HelpCircle,
  CreditCard,
  Hash,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import {
  MatchedOrderResult,
  PossibleExpiredChargeResult,
  ReconciliationSummary,
  TransactionRecord,
  ReconciliationProgressState,
} from '../types';
import {
  exportPossibleExpiredChargesToExcel,
  exportUnmatchedApprovedToExcel,
} from '../utils/reconciler';

interface ResultsDisplayProps {
  summary: ReconciliationSummary;
  matchedWithOrders: MatchedOrderResult[];
  unmatchedApproved: TransactionRecord[];
  possibleExpiredCharges: PossibleExpiredChargeResult[];
  activeStoreIdsMap: Map<string, string>;
  onReset: () => void;
  isRealTimeActive?: boolean;
  progressState?: ReconciliationProgressState;
}

export const ResultsDisplay: React.FC<ResultsDisplayProps> = ({
  summary,
  matchedWithOrders,
  unmatchedApproved,
  possibleExpiredCharges,
  activeStoreIdsMap,
  onReset,
  isRealTimeActive = true,
  progressState,
}) => {
  const [subTab, setSubTab] = useState<'matched_orders' | 'unmatched_approved' | 'expired_charges' | 'terminals_mapped'>('matched_orders');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMargin, setFilterMargin] = useState<string>('all');
  const [selectedItem, setSelectedItem] = useState<PossibleExpiredChargeResult | null>(null);
  const [showExplanationModal, setShowExplanationModal] = useState(false);

  const handleDownloadExcel = () => {
    exportPossibleExpiredChargesToExcel(possibleExpiredCharges, 'POSIBLES EXPIRADAS CON COBRO');
  };

  const handleDownloadUnmatchedExcel = () => {
    exportUnmatchedApprovedToExcel(unmatchedApproved, expiredMatchesByTxRow, 'APROBADAS RESTANTES');
  };

  // Map of tx rowNumbers that matched as possible expired charges for quick lookup
  const expiredMatchesByTxRow = React.useMemo(() => {
    const map = new Map<number, PossibleExpiredChargeResult>();
    possibleExpiredCharges.forEach((p) => {
      map.set(p.transaction.rowNumber, p);
    });
    return map;
  }, [possibleExpiredCharges]);

  // Open item detail in modal (supports both matched expired and unmatched approved)
  const handleSelectUnmatched = (tx: TransactionRecord) => {
    const match = expiredMatchesByTxRow.get(tx.rowNumber);
    if (match) {
      setSelectedItem(match);
    } else {
      setSelectedItem({
        id: `unmatched_tx_${tx.rowNumber}`,
        transaction: tx,
        expiredOrder: {
          rowNumber: 0,
          raw: [],
          timeStr: '—',
          timeSeconds: 0,
          concession: 'Sin orden registrada en Archivo 3',
          code: '—',
          seller: '—',
          baseAmount: 0,
          totalAmount: 0,
        },
        marginType: 'sin_coincidencia',
        marginLabel: 'Sin Coincidencia en A3',
        calculatedExpectedAmount: tx.amount,
        timeDiffSeconds: 0,
        timeDiffFormatted: '—',
        horaArchivo1: tx.timeStr,
        horaArchivo3: '— (Sin orden expirada)',
        montoArchivo1: tx.amount,
        montoArchivo3Total: 0,
        montoArchivo3Base: 0,
        storeIdArchivo1: tx.storeId,
        concesionArchivo3: 'Sin orden en Archivo 3',
        codigoArchivo3: '—',
        vendedorArchivo3: '—',
        terminacionTarjetaArchivo1: tx.cardEnding,
        codigoAutorizacionArchivo1: tx.authCode,
        estatusIArchivo1: tx.statusI,
        estatusLArchivo1: tx.statusL,
      });
    }
  };

  // Filter matched orders
  const filteredMatchedOrders = matchedWithOrders.filter((item) => {
    return (
      item.transaction.cardEnding.includes(searchQuery) ||
      item.transaction.authCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.transaction.storeId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.generatedOrder.terminalSerial.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  // Filter unmatched approved transactions (exact same filtering power)
  const filteredUnmatchedApproved = unmatchedApproved.filter((tx) => {
    const expiredMatch = expiredMatchesByTxRow.get(tx.rowNumber);
    const searchLower = searchQuery.toLowerCase();

    const matchesSearch =
      tx.cardEnding.includes(searchQuery) ||
      tx.authCode.toLowerCase().includes(searchLower) ||
      tx.storeId.toLowerCase().includes(searchLower) ||
      tx.timeStr.includes(searchQuery) ||
      (expiredMatch && (
        expiredMatch.concesionArchivo3.toLowerCase().includes(searchLower) ||
        expiredMatch.codigoArchivo3.toLowerCase().includes(searchLower) ||
        expiredMatch.vendedorArchivo3.toLowerCase().includes(searchLower) ||
        expiredMatch.marginLabel.toLowerCase().includes(searchLower)
      ));

    let matchesFilter = true;
    if (filterMargin === 'with_expired') {
      matchesFilter = !!expiredMatch;
    } else if (filterMargin === 'without_expired') {
      matchesFilter = !expiredMatch;
    } else if (filterMargin !== 'all') {
      matchesFilter = expiredMatch ? expiredMatch.marginType === filterMargin : false;
    }

    return matchesSearch && matchesFilter;
  });

  // Filter possible expired charges
  const filteredExpiredCharges = possibleExpiredCharges.filter((item) => {
    const matchesSearch =
      item.concesionArchivo3.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.codigoArchivo3.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.vendedorArchivo3.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.storeIdArchivo1.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.terminacionTarjetaArchivo1.includes(searchQuery) ||
      item.codigoAutorizacionArchivo1.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesMargin = filterMargin === 'all' || item.marginType === filterMargin;

    return matchesSearch && matchesMargin;
  });

  return (
    <div className="space-y-6">
      {/* Real-time Status Banner (Fast and clean) */}
      <div className="bg-white border border-emerald-200 rounded-3xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shadow-xs">
        <div className="flex items-center gap-3 text-emerald-900 font-medium">
          <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="font-bold text-slate-900 text-sm">
              Cotejo Realizado Rápido en Tiempo Real
            </p>
            <p className="text-slate-500 text-xs">
              Se procesaron <strong className="text-slate-800 font-mono">{summary.file1TotalRows}</strong> transacciones: <strong className="text-emerald-700 font-mono">{matchedWithOrders.length}</strong> coincidentes en pantalla, <strong className="text-amber-700 font-mono">{unmatchedApproved.length}</strong> aprobadas restantes y <strong className="text-rose-700 font-mono">{possibleExpiredCharges.length}</strong> posibles expiradas con cobro.
            </p>
          </div>
        </div>

        <button
          onClick={onReset}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-rose-700 hover:text-white bg-rose-50 hover:bg-rose-600 border border-rose-200 hover:border-rose-600 shadow-2xs transition group shrink-0"
          title="Eliminar los 3 archivos cargados y reiniciar todas las coincidencias"
        >
          <Trash2 className="w-3.5 h-3.5 text-rose-600 group-hover:text-white transition" />
          <span>Limpiar Todo</span>
        </button>
      </div>

      {/* KPI Cards Row (White Theme - Clickable to switch tabs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Metric 1: Transacciones SPIN */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <p className="text-[11px] uppercase font-mono tracking-wider text-slate-500 font-bold">
            Transacciones (SPIN)
          </p>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-black font-mono text-slate-900">
              {summary.file1TotalRows.toLocaleString()}
            </span>
            <span className="text-xs text-emerald-700 font-mono font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
              {summary.file1ApprovedRows} aprobadas
            </span>
          </div>
          <p className="text-[10.5px] text-slate-500 mt-1 font-medium">
            {summary.file1FilteredByStoreIdRows} en Stores activos
          </p>
        </div>

        {/* Metric 2: Órdenes Detallado */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <p className="text-[11px] uppercase font-mono tracking-wider text-slate-500 font-bold">
            Órdenes (Detallado)
          </p>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-black font-mono text-slate-900">
              {summary.file2TotalRows.toLocaleString()}
            </span>
            <span className="text-xs text-indigo-700 font-mono font-bold bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
              {summary.file2DistinctTerminals} terminales
            </span>
          </div>
          <p className="text-[10.5px] text-slate-500 mt-1 font-medium">
            {summary.activeMappedStoreIds} Store IDs enlazados
          </p>
        </div>

        {/* Metric 3: Coincidentes en Pantalla (Clickable) */}
        <button
          onClick={() => setSubTab('matched_orders')}
          className={`text-left bg-white border-2 rounded-2xl p-4 shadow-xs transition-all ${
            subTab === 'matched_orders'
              ? 'border-emerald-500 ring-2 ring-emerald-200'
              : 'border-emerald-200 hover:border-emerald-400'
          }`}
        >
          <p className="text-[11px] uppercase font-mono tracking-wider text-emerald-700 font-bold flex items-center justify-between">
            <span>Coincidentes (A1 vs A2)</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          </p>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-3xl font-black font-mono text-emerald-700">
              {matchedWithOrders.length.toLocaleString()}
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-bold font-mono">
              En Pantalla
            </span>
          </div>
          <p className="text-[10.5px] text-emerald-600 mt-1 font-medium">
            Tarjeta, Aut. y Hora (+1 a 3 min)
          </p>
        </button>

        {/* Metric 4: Aprobadas Restantes (Clickable - User requested!) */}
        <button
          onClick={() => setSubTab('unmatched_approved')}
          className={`text-left bg-white border-2 rounded-2xl p-4 shadow-xs transition-all ${
            subTab === 'unmatched_approved'
              ? 'border-amber-500 ring-2 ring-amber-200'
              : 'border-amber-200 hover:border-amber-400'
          }`}
        >
          <p className="text-[11px] uppercase font-mono tracking-wider text-amber-700 font-bold flex items-center justify-between">
            <span>Aprobadas Restantes</span>
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
          </p>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-3xl font-black font-mono text-amber-600">
              {unmatchedApproved.length.toLocaleString()}
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-800 font-bold font-mono">
              Ver Detalle
            </span>
          </div>
          <p className="text-[10.5px] text-amber-700 mt-1 font-medium">
            Sin orden generada en A2
          </p>
        </button>

        {/* Metric 5: Posibles Expiradas con Cobro (Clickable) */}
        <button
          onClick={() => setSubTab('expired_charges')}
          className={`text-left bg-white border-2 rounded-2xl p-4 shadow-xs transition-all ${
            subTab === 'expired_charges'
              ? 'border-rose-500 ring-2 ring-rose-200'
              : 'border-rose-300 hover:border-rose-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] uppercase font-mono tracking-wider text-rose-700 font-bold">
              Posibles Expiradas
            </p>
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-3xl font-black font-mono text-rose-600">
              {possibleExpiredCharges.length.toLocaleString()}
            </span>
            <span className="px-2 py-0.5 rounded-md text-[10px] bg-rose-600 text-white font-extrabold tracking-wide shadow-2xs">
              CON COBRO
            </span>
          </div>
          <p className="text-[10.5px] text-rose-700/80 mt-1 font-semibold">
            Descargar reporte (.xlsx)
          </p>
        </button>
      </div>

      {/* Tabs and Action Bar */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/60">
          {/* Sub Navigation (4 Tabs) */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200 self-start flex-wrap">
            {/* Tab 1: Coincidentes en Pantalla */}
            <button
              onClick={() => {
                setSubTab('matched_orders');
                setSearchQuery('');
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                subTab === 'matched_orders'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Coincidentes en Pantalla</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                  subTab === 'matched_orders' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {matchedWithOrders.length}
              </span>
            </button>

            {/* Tab 2: Aprobadas Restantes (NEW) */}
            <button
              onClick={() => {
                setSubTab('unmatched_approved');
                setSearchQuery('');
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                subTab === 'unmatched_approved'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Aprobadas Restantes</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                  subTab === 'unmatched_approved' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {unmatchedApproved.length}
              </span>
            </button>

            {/* Tab 3: Posibles Expiradas con Cobro */}
            <button
              onClick={() => {
                setSubTab('expired_charges');
                setSearchQuery('');
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                subTab === 'expired_charges'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Posibles Expiradas con Cobro</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                  subTab === 'expired_charges' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {possibleExpiredCharges.length}
              </span>
            </button>

            {/* Tab 4: Cruce de Terminales */}
            <button
              onClick={() => setSubTab('terminals_mapped')}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition ${
                subTab === 'terminals_mapped'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building className="w-3.5 h-3.5" />
              <span>Cruce de Terminales ({activeStoreIdsMap.size})</span>
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3">
            {subTab === 'unmatched_approved' && (
              <button
                onClick={handleDownloadUnmatchedExcel}
                disabled={unmatchedApproved.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm transition disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span>Descargar APROBADAS RESTANTES (.xlsx)</span>
              </button>
            )}

            {subTab === 'expired_charges' && (
              <button
                onClick={handleDownloadExcel}
                disabled={possibleExpiredCharges.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm transition disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span>Descargar POSIBLES EXPIRADAS CON COBRO (.xlsx)</span>
              </button>
            )}

            <button
              onClick={() => setShowExplanationModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 shadow-2xs transition"
              title="Explicación del flujo de cotejo y qué son las aprobadas restantes"
            >
              <HelpCircle className="w-4 h-4 text-indigo-600" />
              <span>¿Qué son las Aprobadas Restantes?</span>
            </button>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="p-3.5 bg-white border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="relative w-full sm:w-80">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={
                subTab === 'expired_charges'
                  ? 'Buscar por Concesión, Vendedor, Tarjeta, Store ID...'
                  : subTab === 'unmatched_approved'
                  ? 'Buscar por Concesión, Vendedor, Tarjeta, Store ID, Autorización...'
                  : 'Buscar por Tarjeta, Autorización, Terminal...'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition"
            />
          </div>

          {subTab === 'unmatched_approved' && (
            <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
              <span className="text-slate-500 text-[11px] font-semibold">Filtro de coincidencia / margen:</span>
              <select
                value={filterMargin}
                onChange={(e) => setFilterMargin(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 font-medium focus:outline-none focus:border-amber-500"
              >
                <option value="all">Todas ({unmatchedApproved.length})</option>
                <option value="with_expired">Con orden expirada coincidente ({possibleExpiredCharges.length})</option>
                <option value="without_expired">Sin orden expirada coincidente ({Math.max(0, unmatchedApproved.length - possibleExpiredCharges.length)})</option>
                <option value="plus_5">+5% sobre Monto Base</option>
                <option value="plus_10">+10% sobre Monto Base</option>
                <option value="plus_15">+15% sobre Monto Base</option>
                <option value="plus_20">+20% sobre Monto Base</option>
                <option value="total_exact">Total Exacto (Col H)</option>
                <option value="base_exact">Monto Base Exacto (Col H)</option>
              </select>
            </div>
          )}

          {subTab === 'expired_charges' && (
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="text-slate-500 text-[11px] font-semibold">Margen de aumento:</span>
              <select
                value={filterMargin}
                onChange={(e) => setFilterMargin(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 font-medium focus:outline-none focus:border-rose-500"
              >
                <option value="all">Todos los aumentos (+5%, +10%, +15%, +20%, Total)</option>
                <option value="plus_5">+5% sobre Monto Base</option>
                <option value="plus_10">+10% sobre Monto Base</option>
                <option value="plus_15">+15% sobre Monto Base</option>
                <option value="plus_20">+20% sobre Monto Base</option>
                <option value="total_exact">Total Exacto (Col H)</option>
                <option value="base_exact">Monto Base Exacto (Col H)</option>
              </select>
            </div>
          )}
        </div>

        {/* SUBTAB 1: TRANSACCIONES COINCIDENTES EN PANTALLA */}
        {subTab === 'matched_orders' && (
          <div>
            <div className="p-3.5 bg-emerald-50/70 border-b border-emerald-100 text-emerald-900 text-xs flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>Visualización en Pantalla:</strong> Registros coincidentes de Transacciones (SPIN) vs Órdenes (Excel detallado pagos) con estatus Aprobadas en Columnas I y L.
                </span>
              </div>
              <span className="font-mono font-bold bg-white px-2.5 py-1 rounded-lg border border-emerald-200 text-emerald-700 shadow-2xs">
                {matchedWithOrders.length} coincidentes
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-mono tracking-wider border-b border-slate-200 text-[10px] font-bold">
                  <tr>
                    <th className="py-3 px-3">#</th>
                    <th className="py-3 px-3">
                      <div>Tarjeta SPIN (Col S)</div>
                      <div className="text-slate-400">vs Detallado (Col M)</div>
                    </th>
                    <th className="py-3 px-3">
                      <div>Código Aut. SPIN (Col Y)</div>
                      <div className="text-slate-400">vs Detallado (Col R)</div>
                    </th>
                    <th className="py-3 px-3">
                      <div>Hora SPIN (Col D)</div>
                      <div className="text-slate-400">vs Venta Detallado (Col A)</div>
                    </th>
                    <th className="py-3 px-3">Margen (+1 a +3 min)</th>
                    <th className="py-3 px-3">Store ID (Col P)</th>
                    <th className="py-3 px-3">Terminal (Col S)</th>
                    <th className="py-3 px-3">Estatus (Cols I y L)</th>
                    <th className="py-3 px-3 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {filteredMatchedOrders.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-500 font-sans">
                        <CheckCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        <p className="font-bold text-slate-700">No hay coincidencias en este filtro.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredMatchedOrders.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-3 text-slate-400">{idx + 1}</td>
                        <td className="py-3 px-3">
                          <span className="font-bold text-emerald-700">
                            ****{item.transaction.cardEnding}
                          </span>{' '}
                          <span className="text-slate-400 text-[11px]">= ****{item.generatedOrder.cardEnding}</span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="text-slate-900 font-bold">{item.transaction.authCode}</span>{' '}
                          <span className="text-slate-400 text-[11px]">= {item.generatedOrder.authCode}</span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="text-slate-900 font-semibold">{item.transaction.timeStr}</div>
                          <div className="text-slate-500 text-[11px]">
                            {item.generatedOrder.timeStr || item.generatedOrder.saleDateStr}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
                            {item.timeDiffMinutesFormatted}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-indigo-700 font-bold">{item.transaction.storeId}</td>
                        <td className="py-3 px-3 text-slate-700 font-medium">
                          {item.generatedOrder.terminalSerial}
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                            Aprobadas (I & L)
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                            ✓ Coincidente
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SUBTAB 2: APROBADAS RESTANTES (MISMO FORMATO QUE POSIBLES EXPIRADAS CON COBRO) */}
        {subTab === 'unmatched_approved' && (
          <div>
            {/* Header info */}
            <div className="p-3.5 bg-amber-50/70 border-b border-amber-200 text-amber-950 text-xs flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Aprobadas Restantes (Sin Orden en A2):</strong> Transacciones de SPIN (Archivo 1) con estatus Aprobadas (Cols I y L) de terminales activas que no generaron orden de venta en Archivo 2, cotejadas con Archivo 3 (Expiradas).
                </span>
              </div>
              <span className="font-mono font-bold bg-white px-2.5 py-1 rounded-lg border border-amber-300 text-amber-800 shadow-2xs">
                {unmatchedApproved.length} transacciones
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-mono tracking-wider border-b border-slate-200 text-[10px] font-bold">
                  <tr>
                    <th className="py-3 px-3">#</th>
                    <th className="py-3 px-3">
                      <div>Hora A1 (D)</div>
                      <div className="text-slate-400">Hora A3 (A)</div>
                    </th>
                    <th className="py-3 px-3">Dif. Tiempo</th>
                    <th className="py-3 px-3">
                      <div>Monto A1 (E)</div>
                      <div className="text-slate-400">Monto A3 (H)</div>
                    </th>
                    <th className="py-3 px-3">Margen Detectado</th>
                    <th className="py-3 px-3">Store ID (P)</th>
                    <th className="py-3 px-3">Concesión (B)</th>
                    <th className="py-3 px-3">Código (C)</th>
                    <th className="py-3 px-3">Vendedor (E)</th>
                    <th className="py-3 px-3">Tarjeta (S)</th>
                    <th className="py-3 px-3">Código Aut. (Y)</th>
                    <th className="py-3 px-3">Estatus (I / L)</th>
                    <th className="py-3 px-3 text-right">Ver</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {filteredUnmatchedApproved.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="py-12 text-center text-slate-500 font-sans">
                        <CheckCircle className="w-10 h-10 mx-auto mb-2 text-emerald-500" />
                        <p className="font-bold text-slate-800">No hay transacciones aprobadas restantes</p>
                        <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                          {unmatchedApproved.length > 0
                            ? 'Ninguna transacción coincide con el filtro de búsqueda seleccionado.'
                            : 'Todas las transacciones aprobadas de terminales activas tuvieron orden generada coincidente en el Archivo 2.'}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredUnmatchedApproved.map((tx, idx) => {
                      const expiredMatch = expiredMatchesByTxRow.get(tx.rowNumber);
                      return (
                        <tr
                          key={`unmatched_${tx.rowNumber}_${idx}`}
                          className={`hover:bg-amber-50/50 transition cursor-pointer ${
                            expiredMatch ? 'bg-rose-50/40' : ''
                          }`}
                          onClick={() => handleSelectUnmatched(tx)}
                        >
                          <td className="py-3 px-3 text-slate-400">{idx + 1}</td>
                          <td className="py-3 px-3">
                            <div className="text-amber-800 font-bold">{tx.timeStr}</div>
                            <div className="text-slate-500 text-[11px]">
                              {expiredMatch ? expiredMatch.horaArchivo3 : '— (Sin orden)'}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            {expiredMatch ? (
                              <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-semibold">
                                {expiredMatch.timeDiffFormatted}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-mono text-[11px]">—</span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <div className="text-slate-900 font-bold text-sm">
                              ${tx.amount.toFixed(2)}
                            </div>
                            <div className="text-slate-500 text-[11px]">
                              {expiredMatch
                                ? `Tot: $${expiredMatch.montoArchivo3Total.toFixed(2)} | Base: $${expiredMatch.montoArchivo3Base.toFixed(2)}`
                                : '—'}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            {expiredMatch ? (
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10.5px] font-bold tracking-wide border ${
                                  expiredMatch.marginType.startsWith('plus')
                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                    : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                }`}
                              >
                                {expiredMatch.marginLabel}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md text-[10.5px] font-semibold tracking-wide border bg-slate-50 text-slate-600 border-slate-200">
                                Sin Coincidencia en A3
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-emerald-700 font-bold">{tx.storeId}</td>
                          <td className="py-3 px-3 font-sans text-slate-800 font-medium max-w-[150px] truncate">
                            {expiredMatch ? expiredMatch.concesionArchivo3 : '—'}
                          </td>
                          <td className="py-3 px-3 text-indigo-700 font-semibold">
                            {expiredMatch ? expiredMatch.codigoArchivo3 : '—'}
                          </td>
                          <td className="py-3 px-3 font-sans text-slate-700 max-w-[140px] truncate">
                            {expiredMatch ? expiredMatch.vendedorArchivo3 : '—'}
                          </td>
                          <td className="py-3 px-3 text-slate-900 font-bold">****{tx.cardEnding}</td>
                          <td className="py-3 px-3 text-slate-700">{tx.authCode}</td>
                          <td className="py-3 px-3">
                            <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                              {tx.statusI} / {tx.statusL}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectUnmatched(tx);
                              }}
                              className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700"
                              title="Ver detalle completo de transacción y orden"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SUBTAB 3: POSIBLES EXPIRADAS CON COBRO */}
        {subTab === 'expired_charges' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-mono tracking-wider border-b border-slate-200 text-[10px] font-bold">
                <tr>
                  <th className="py-3 px-3">#</th>
                  <th className="py-3 px-3">
                    <div>Hora A1 (D)</div>
                    <div className="text-slate-400">Hora A3 (A)</div>
                  </th>
                  <th className="py-3 px-3">Dif. Tiempo</th>
                  <th className="py-3 px-3">
                    <div>Monto A1 (E)</div>
                    <div className="text-slate-400">Monto A3 (H)</div>
                  </th>
                  <th className="py-3 px-3">Margen Detectado</th>
                  <th className="py-3 px-3">Store ID (P)</th>
                  <th className="py-3 px-3">Concesión (B)</th>
                  <th className="py-3 px-3">Código (C)</th>
                  <th className="py-3 px-3">Vendedor (E)</th>
                  <th className="py-3 px-3">Tarjeta (S)</th>
                  <th className="py-3 px-3">Código Aut. (Y)</th>
                  <th className="py-3 px-3">Estatus (I / L)</th>
                  <th className="py-3 px-3 text-right">Ver</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {filteredExpiredCharges.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="py-12 text-center text-slate-500 font-sans">
                      <CheckCircle className="w-10 h-10 mx-auto mb-2 text-emerald-500" />
                      <p className="font-bold text-slate-800">
                        No se detectaron posibles expiradas con cobro
                      </p>
                      <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                        {possibleExpiredCharges.length > 0
                          ? 'Ninguna orden coincide con el filtro de búsqueda seleccionado.'
                          : 'Todas las transacciones restantes aprobadas no registraron correspondencia de hora y montos con las órdenes expiradas.'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredExpiredCharges.map((item, idx) => (
                    <tr
                      key={item.id}
                      className="hover:bg-rose-50/40 transition cursor-pointer"
                      onClick={() => setSelectedItem(item)}
                    >
                      <td className="py-3 px-3 text-slate-400">{idx + 1}</td>
                      <td className="py-3 px-3">
                        <div className="text-rose-600 font-bold">{item.horaArchivo1}</div>
                        <div className="text-slate-500 text-[11px]">{item.horaArchivo3}</div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-semibold">
                          {item.timeDiffFormatted}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="text-slate-900 font-bold text-sm">
                          ${item.montoArchivo1.toFixed(2)}
                        </div>
                        <div className="text-slate-500 text-[11px]">
                          Tot: ${item.montoArchivo3Total.toFixed(2)} | Base: ${item.montoArchivo3Base.toFixed(2)}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10.5px] font-bold tracking-wide border ${
                            item.marginType.startsWith('plus')
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                          }`}
                        >
                          {item.marginLabel}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-emerald-700 font-bold">{item.storeIdArchivo1}</td>
                      <td className="py-3 px-3 font-sans text-slate-800 font-medium max-w-[150px] truncate">
                        {item.concesionArchivo3}
                      </td>
                      <td className="py-3 px-3 text-indigo-700 font-semibold">{item.codigoArchivo3}</td>
                      <td className="py-3 px-3 font-sans text-slate-700 max-w-[140px] truncate">
                        {item.vendedorArchivo3}
                      </td>
                      <td className="py-3 px-3 text-slate-900 font-bold">****{item.terminacionTarjetaArchivo1}</td>
                      <td className="py-3 px-3 text-slate-700">{item.codigoAutorizacionArchivo1}</td>
                      <td className="py-3 px-3">
                        <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                          {item.estatusIArchivo1}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedItem(item);
                          }}
                          className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* SUBTAB 4: CRUCE DE TERMINALES */}
        {subTab === 'terminals_mapped' && (
          <div className="p-6 bg-white">
            <h4 className="text-sm font-bold text-slate-900 mb-2">
              Cadena de Mapeo de Terminales Activas
            </h4>
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              El flujo de resolución toma las terminales que tuvieron ventas registradas en el{' '}
              <strong className="text-slate-900">Archivo 2 [Excel detallado pagos] (Columna S)</strong>, las busca en la{' '}
              <strong className="text-indigo-600">Columna C</strong> de la base de datos de terminales en
              Firebase, obtiene el <strong className="text-indigo-600">ID Store (Columna D)</strong> y con eso
              filtra las transacciones del <strong className="text-slate-900">Archivo 1 [SPIN] (Columna P)</strong>.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from(activeStoreIdsMap.entries()).map(([serial, storeId]) => (
                <div
                  key={serial}
                  className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between shadow-2xs"
                >
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-mono font-semibold">
                      Terminal en Archivo 2 (Col S):
                    </span>
                    <p className="text-xs font-mono font-bold text-slate-900">{serial}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-indigo-600 uppercase font-mono font-semibold">
                      Store ID Mapeado (Col P):
                    </span>
                    <p className="text-xs font-mono font-bold text-emerald-700">{storeId}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Explanation Modal */}
      {showExplanationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-xl p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    ¿Qué son las Aprobadas Restantes?
                  </h3>
                  <p className="text-xs text-slate-500">Definición y rol dentro del flujo de Expiraminator</p>
                </div>
              </div>
              <button
                onClick={() => setShowExplanationModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
              <p>
                En el <strong>Paso 1</strong>, el sistema toma las transacciones de <strong>SPIN (Archivo 1)</strong> que corresponden a terminales activas y que tienen estatus <strong>Aprobada</strong> tanto en la <strong>Columna I</strong> como en la <strong>Columna L</strong>.
              </p>
              <p>
                En el <strong>Paso 2</strong>, esas transacciones aprobadas se cotejan contra las <strong>Órdenes Generadas (Archivo 2)</strong> evaluando:
              </p>
              <ul className="list-disc pl-5 space-y-1 font-mono text-[11.5px] text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <li>Terminación de tarjeta: Archivo 1 Col S == Archivo 2 Col M</li>
                <li>Código de autorización: Archivo 1 Col Y == Archivo 2 Col R</li>
                <li>Hora: Archivo 1 Col D vs Archivo 2 Col A con margen superior de 1 a 3 minutos</li>
              </ul>
              <p>
                Las transacciones que <strong>coinciden</strong> se muestran en la pantalla como órdenes exitosamente cobradas con venta registrada.
              </p>
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-amber-950 font-medium space-y-1">
                <span className="font-bold block text-amber-900">
                  Las Aprobadas Restantes:
                </span>
                <p>
                  Son las transacciones aprobadas que <strong>NO tuvieron coincidencia en el Archivo 2</strong>. Es decir, el banco cobró el dinero a la tarjeta del cliente, pero en el sistema de ventas <strong>no se generó ninguna orden</strong> (quedaron huérfanas).
                </p>
              </div>
              <p>
                Por ello, en el <strong>Paso 3</strong>, estas <strong>Aprobadas Restantes</strong> se cotejan contra las <strong>Órdenes Expiradas (Archivo 3)</strong> para detectar si el cobro correspondió a una orden que el sistema canceló o expiró pero cuyo cargo bancario sí pasó.
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowExplanationModal(false)}
                className="px-4 py-2 rounded-xl text-xs bg-slate-900 hover:bg-slate-800 text-white font-bold transition shadow-xs"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal for Expired Charge */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase font-mono border ${
                    selectedItem.marginType === 'sin_coincidencia'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}
                >
                  {selectedItem.marginType === 'sin_coincidencia'
                    ? 'Aprobada Restante (Sin Orden en A2)'
                    : 'Posible Expirada con Cobro'}
                </span>
                <h3 className="text-lg font-extrabold text-slate-900 mt-1">
                  {selectedItem.concesionArchivo3 !== '—' && selectedItem.codigoArchivo3 !== '—'
                    ? `${selectedItem.concesionArchivo3} (${selectedItem.codigoArchivo3})`
                    : `Transacción SPIN ****${selectedItem.terminacionTarjetaArchivo1} (Aut: ${selectedItem.codigoAutorizacionArchivo1})`}
                </h3>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 text-[10px] uppercase font-mono font-bold">Hora Archivo 1 (D)</span>
                <p className="text-sm font-bold text-slate-900 font-mono">{selectedItem.horaArchivo1}</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 text-[10px] uppercase font-mono font-bold">Hora Archivo 3 (A)</span>
                <p className="text-sm font-bold text-slate-900 font-mono">{selectedItem.horaArchivo3}</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 text-[10px] uppercase font-mono font-bold">Diferencia de Tiempo</span>
                <p className="text-sm font-bold text-amber-600 font-mono">{selectedItem.timeDiffFormatted}</p>
              </div>

              <div className="p-3 rounded-xl bg-rose-50/50 border border-rose-200">
                <span className="text-rose-700 text-[10px] uppercase font-mono font-bold">Monto Cobrado (E)</span>
                <p className="text-base font-black text-rose-600 font-mono">
                  ${selectedItem.montoArchivo1.toFixed(2)}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 text-[10px] uppercase font-mono font-bold">Monto Base (Col H)</span>
                <p className="text-sm font-bold text-slate-900 font-mono">
                  ${selectedItem.montoArchivo3Base.toFixed(2)}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 text-[10px] uppercase font-mono font-bold">Monto Total (Col H)</span>
                <p className="text-sm font-bold text-slate-900 font-mono">
                  ${selectedItem.montoArchivo3Total.toFixed(2)}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 text-[10px] uppercase font-mono font-bold">Aumento Detectado</span>
                <p className="text-xs font-bold text-emerald-700 font-mono">{selectedItem.marginLabel}</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 text-[10px] uppercase font-mono font-bold">Store ID (Col P)</span>
                <p className="text-xs font-bold text-indigo-700 font-mono">{selectedItem.storeIdArchivo1}</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 text-[10px] uppercase font-mono font-bold">Terminación Tarjeta</span>
                <p className="text-xs font-bold text-slate-900 font-mono">
                  ****{selectedItem.terminacionTarjetaArchivo1}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 text-[10px] uppercase font-mono font-bold">Código Autorización</span>
                <p className="text-xs font-bold text-slate-900 font-mono">
                  {selectedItem.codigoAutorizacionArchivo1}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 text-[10px] uppercase font-mono font-bold">Vendedor Asignado</span>
                <p className="text-xs font-semibold text-slate-800 font-sans">{selectedItem.vendedorArchivo3}</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 text-[10px] uppercase font-mono font-bold">Estatus I & L</span>
                <p className="text-xs font-bold text-emerald-700 font-mono">
                  {selectedItem.estatusIArchivo1} / {selectedItem.estatusLArchivo1}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <span className="text-[11px] text-slate-400 font-mono">
                Renglón A1 (SPIN) #{selectedItem.transaction.rowNumber}
                {selectedItem.expiredOrder.rowNumber > 0
                  ? ` • Renglón A3 (Expiradas) #${selectedItem.expiredOrder.rowNumber}`
                  : ' • Sin orden expirada en A3'}
              </span>
              <button
                onClick={() => setSelectedItem(null)}
                className="px-4 py-2 rounded-xl text-xs bg-slate-900 hover:bg-slate-800 text-white font-bold transition shadow-xs"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
