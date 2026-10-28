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
  authCode: string;         // Columna Z (index 25)
  statusI: string;          // Columna I (index 8)
  statusL: string;          // Columna L (index 11)
  isApproved: boolean;      // Estatus I y L iguales y aprobadas
  timeStr: string;          // Columna D (index 3)
  timeSeconds: number;      // Seconds from midnight
  storeId: string;          // Columna P (index 15)
  amount: number;           // Monto de la transacción
  terminalSerial?: string;  // No. Serie de la terminal
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
  totalAmount: number;      // Columna K (index 10) - monto total órdenes Yoshi
  concession?: string;      // Columna D (index 3) - Concesión / Área
  seller?: string;          // Columna F (index 5) - Vendedor / Usuario
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
  terminalSerial?: string;  // Asignada desde Archivo 2 Col S al coincidir Col B vs Col D y Col E vs Col F
  storeId?: string;         // Store ID mapeado desde catálogo de terminales
  terminalMatchedFromOrder?: boolean;
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
  montoArchivo2Total: number;  // Archivo 2 Órdenes Yoshi Col K: Monto Total
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
  terminalSerialArchivo2?: string;
  terminalSerialArchivo3?: string;
  storeIdArchivo3?: string;
  terminalMatchConfirmed?: boolean;
  isLatestMatch?: boolean;
}

export interface UnregisteredTerminalInfo {
  serialNumber: string;
  orderCount: number;
  sampleRowNumber: number;
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
  unregisteredTerminalsCount: number;
  unregisteredTerminalsList: UnregisteredTerminalInfo[];
  file1CashRowsExcluded?: number;
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

export interface ReconciliationValidationConfig {
  // 1. Store ID & Terminal
  filterByStoreId: boolean; // Cotejar/Filtrar Archivo 1 por Store IDs de terminales activas
  matchStoreIdA1A2: boolean; // Cotejar Store ID entre Archivo 1 y Archivo 2 en Paso 1
  matchTerminalOrStoreA1A3: boolean; // Cotejar Terminal Física o Store ID entre Aprobadas y Expiradas (Paso 3)
  requireTerminalForExpired: boolean; // Exigir Terminal asignada en Expiradas (ignorar órdenes que fueron solo en efectivo)

  // 2. Archivo 2 (Órdenes Yoshi)
  excludeCashAndEmptyTerminal: boolean; // Excluir ventas en Efectivo o con Columna S vacía en Archivo 2
  assignTerminalFromA2ToA3: boolean; // Cruce previo Concesión (B vs D) y Vendedor (E vs F) para asignar Terminal

  // 3. Transacciones Bancarias (Paso 1: A1 vs A2)
  matchCardEnding: boolean; // Cotejar terminación de tarjeta (últimos 4 dígitos)
  matchAuthCode: boolean; // Cotejar código de autorización bancaria
  matchTimeWindowA1A2: boolean; // Cotejar ventana de tiempo (1 a 3 minutos) en Paso 1
  matchAmountA1A2: boolean; // Cotejar coincidencia de monto en Paso 1 (A1 Col E vs A2 Col K)

  // 4. Órdenes Expiradas (Paso 3: Aprobadas Restantes vs A3)
  matchTimeWindowA1A3: boolean; // Cotejar ventana de tiempo (+1 a 3 minutos) en Órdenes Expiradas
  matchAmountA1A3: boolean; // Cotejar coincidencia de monto
  enableTipIncrements: boolean; // Evaluar incrementos del 5 al 20% por propina
}

export const DEFAULT_VALIDATION_CONFIG: ReconciliationValidationConfig = {
  filterByStoreId: true,
  matchStoreIdA1A2: true,
  matchTerminalOrStoreA1A3: true,
  requireTerminalForExpired: true,
  excludeCashAndEmptyTerminal: true,
  assignTerminalFromA2ToA3: true,
  matchCardEnding: true,
  matchAuthCode: true,
  matchTimeWindowA1A2: true,
  matchAmountA1A2: true,
  matchTimeWindowA1A3: true,
  matchAmountA1A3: true,
  enableTipIncrements: true,
};

export interface FileDataState {
  file1Name: string | null;
  file2Name: string | null;
  file3Name: string | null;
  file1Data: any[][] | null;
  file2Data: any[][] | null;
  file3Data: any[][] | null;
}

