export interface TerminalRecord {
  id: string;
  serialNumber: string; // Columna C
  storeId: string;      // Columna D
  updatedAt?: string;
  notes?: string;
}

export interface TransactionRecord {
  rowNumber: number;
  raw: any[];
  cardEnding: string;       // Columna S (index 18)
  authCode: string;         // Columna Y (index 24)
  statusI: string;          // Columna I (index 8)
  statusL: string;          // Columna L (index 11)
  isApproved: boolean;      // Estatus I y L iguales y aprobadas
  timeStr: string;          // Columna D (index 3)
  timeSeconds: number;      // Seconds from midnight
  storeId: string;          // Columna P (index 15)
  amount: number;           // Monto de la transacción
}

export interface GeneratedOrderRecord {
  rowNumber: number;
  raw: any[];
  cardEnding: string;       // Columna M (index 12) - últimos 4 dígitos
  authCode: string;         // Columna R (index 17)
  saleDateStr: string;      // Columna A (index 0) - sólo hora
  timeStr: string;
  timeSeconds: number;
  terminalSerial: string;   // Columna S (index 18)
  totalAmount: number;      // Columna H (index 7) - monto total órdenes Yoshi
}

export interface ExpiredOrderRecord {
  rowNumber: number;
  raw: any[];
  timeStr: string;          // Columna A (index 0) - sólo hora
  timeSeconds: number;
  concession: string;       // Columna B (index 1)
  code: string;             // Columna C (index 2)
  seller: string;           // Columna E (index 4)
  baseAmount: number;       // Columna G (index 6) - monto base anterior
  totalAmount: number;      // Columna H (index 7) - monto base / total Col H
}

export interface MatchedOrderResult {
  id: string;
  transaction: TransactionRecord;
  generatedOrder: GeneratedOrderRecord;
  timeDiffSeconds: number;
  timeDiffMinutesFormatted: string;
  matchedStoreId: string;
  isLatestMatch?: boolean;
}

export interface PossibleExpiredChargeResult {
  id: string;
  transaction: TransactionRecord;
  expiredOrder: ExpiredOrderRecord;
  marginType: 'total_exact' | 'plus_5' | 'plus_10' | 'plus_15' | 'plus_20' | 'base_exact' | 'sin_coincidencia';
  marginLabel: string;
  calculatedExpectedAmount: number;
  timeDiffSeconds: number;
  timeDiffFormatted: string;
  // Report columns explicitly mandated:
  horaArchivo1: string;
  horaArchivo3: string;
  montoArchivo1: number;       // Archivo 1 SPIN Col E: Monto Cobrado
  montoArchivo2Total: number;  // Archivo 2 Órdenes Yoshi Col H: Monto Total
  montoArchivo3Total: number;  // Archivo 3 Expiradas Col H: Monto Base / Total
  montoArchivo3Base: number;   // Archivo 3 Expiradas Col G (si existe)
  storeIdArchivo1: string;
  concesionArchivo3: string;
  codigoArchivo3: string;
  vendedorArchivo3: string;
  terminacionTarjetaArchivo1: string;
  codigoAutorizacionArchivo1: string;
  estatusIArchivo1: string;
  estatusLArchivo1: string;
  isLatestMatch?: boolean;
}

export interface ReconciliationSummary {
  file1TotalRows: number;
  file1ValidRows: number;
  file1ApprovedRows: number;
  file1FilteredByStoreIdRows: number;
  file2TotalRows: number;
  file2ValidRows: number;
  file2DistinctTerminals: number;
  activeMappedStoreIds: number;
  file3TotalRows: number;
  file3ValidRows: number;
  matchedWithOrdersCount: number;
  unmatchedApprovedCount: number;
  possibleExpiredWithChargeCount: number;
  timestamp: string;
}

export interface ReconciliationProgressState {
  isStreaming: boolean;
  phase: 'idle' | 'filtering' | 'matching_orders' | 'matching_expired' | 'completed';
  phaseDescription: string;
  progressPercent: number;
  totalTransactionsToProcess: number;
  currentProcessedIndex: number;
  matchedCountLive: number;
  expiredMatchesCountLive: number;
  lastMatchedMessage?: string;
  currentBatchItemText?: string;
  isPaused?: boolean;
  currentInspectedTx?: {
    rowNumber: number;
    cardEnding: string;
    authCode: string;
    timeStr: string;
    storeId: string;
    amount: number;
  };
}

export interface FileDataState {
  file1Name: string | null;
  file2Name: string | null;
  file3Name: string | null;
  file1Data: any[][] | null;
  file2Data: any[][] | null;
  file3Data: any[][] | null;
}
