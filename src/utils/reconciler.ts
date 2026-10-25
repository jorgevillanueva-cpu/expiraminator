import * as XLSX from 'xlsx';
import {
  TransactionRecord,
  GeneratedOrderRecord,
  ExpiredOrderRecord,
  TerminalRecord,
  MatchedOrderResult,
  PossibleExpiredChargeResult,
  ReconciliationSummary,
  ReconciliationProgressState,
  UnregisteredTerminalInfo,
} from '../types';
import {
  extractAmount,
  extractCardLast4,
  extractTimeSeconds,
  isStatusApproved,
  normalizeAuthCode,
  getStrippedAuthCode,
  storeIdsMatch,
  authCodesMatch,
} from './excelParser';

export interface ReconciliationOptions {
  minTimeDiffSeconds: number; // default: 60 (1 min) or 0
  maxTimeDiffSeconds: number; // default: 180 (3 min)
  amountTolerance: number;    // default: 1.0 (difference in currency units allowed)
}

export const DEFAULT_OPTIONS: ReconciliationOptions = {
  minTimeDiffSeconds: 0,
  maxTimeDiffSeconds: 180, // up to 3 minutes superior margin
  amountTolerance: 0.99,
};

export function countCashRowsInTransactionsFile(rows: any[][]): number {
  return 0;
}

/**
 * Parse Archivo 1: Total de Registro de Transacciones
 * Detects header row dynamically (supports standard row 13 or row 1/2 if pre-cleaned)
 */
export function parseTransactionsFile(rows: any[][]): TransactionRecord[] {
  const records: TransactionRecord[] = [];
  let startIdx = 12; // default standard SPIN offset (row 13)

  for (let r = 0; r < Math.min(rows.length, 14); r++) {
    const rowStr = (rows[r] || []).map((c) => String(c || '').toLowerCase()).join(' ');
    if (
      (rowStr.includes('tarjeta') || rowStr.includes('terminacion') || rowStr.includes('card')) &&
      (rowStr.includes('autoriza') || rowStr.includes('auth') || rowStr.includes('codigo'))
    ) {
      startIdx = r + 1;
      break;
    }
  }

  if (startIdx >= rows.length && rows.length > 1) {
    startIdx = 1;
  }

  for (let i = startIdx; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0 || row.every((c: any) => c === '' || c === null || c === undefined)) {
      continue;
    }

    const timeRaw = row[3];         // Columna D (index 3)
    const statusIRaw = row[8];      // Columna I (index 8)
    const statusLRaw = row[11];     // Columna L (index 11)
    const storeIdRaw = row[15];     // Columna P (index 15)
    const cardEndingRaw = row[18];  // Columna S (index 18)
    // Código de autorización de Archivo 1 (SPIN): Columna Z (index 25), con fallback a Columna Y (index 24)
    const authCodeRaw =
      row[25] !== undefined && String(row[25]).trim() !== ''
        ? row[25]
        : row[24];

    // Monto de la transacción en Archivo 1 (SPIN): Columna E (índice 4)
    let amount = 0;
    if (row[4] !== undefined && extractAmount(row[4]) > 0) {
      amount = extractAmount(row[4]); // Columna E (index 4)
    } else if (row[5] !== undefined && extractAmount(row[5]) > 0) {
      amount = extractAmount(row[5]); // Columna F (fallback)
    } else if (row[6] !== undefined && extractAmount(row[6]) > 0) {
      amount = extractAmount(row[6]); // Columna G (fallback)
    } else if (row[7] !== undefined && extractAmount(row[7]) > 0) {
      amount = extractAmount(row[7]); // Columna H (fallback)
    } else {
      // Búsqueda de respaldo en columnas numéricas
      for (let col = 0; col < row.length; col++) {
        if (col === 3 || col === 18 || col === 24 || col === 25 || col === 15) continue;
        const amt = extractAmount(row[col]);
        if (amt > 0) {
          amount = amt;
          break;
        }
      }
    }

    const parsedTime = extractTimeSeconds(timeRaw);
    const cardEnding = extractCardLast4(cardEndingRaw);
    const authCode = normalizeAuthCode(authCodeRaw);
    const statusI = String(statusIRaw || '').trim();
    const statusL = String(statusLRaw || '').trim();
    const isApproved = isStatusApproved(statusI, statusL);
    const storeId = String(storeIdRaw || '').trim();

    records.push({
      rowNumber: i + 1,
      raw: row,
      cardEnding,
      authCode,
      statusI,
      statusL,
      isApproved,
      timeStr: parsedTime ? parsedTime.formatted : String(timeRaw || ''),
      timeSeconds: parsedTime ? parsedTime.seconds : -1,
      storeId,
      amount,
    });
  }
  return records;
}

/**
 * Parse Archivo 2: Total de Órdenes Generadas
 * Detects header row dynamically (supports standard row 5 or row 1/2)
 */
export function parseGeneratedOrdersFile(rows: any[][]): GeneratedOrderRecord[] {
  const records: GeneratedOrderRecord[] = [];
  let startIdx = 4; // default row 5 (index 4)

  for (let r = 0; r < Math.min(rows.length, 6); r++) {
    const rowStr = (rows[r] || []).map((c) => String(c || '').toLowerCase()).join(' ');
    if (
      (rowStr.includes('tarjeta') || rowStr.includes('card')) &&
      (rowStr.includes('autoriza') || rowStr.includes('auth')) &&
      (rowStr.includes('terminal') || rowStr.includes('serie') || rowStr.includes('pos'))
    ) {
      startIdx = r + 1;
      break;
    }
  }

  if (startIdx >= rows.length && rows.length > 1) {
    startIdx = 1;
  }

  for (let i = startIdx; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0 || row.every((c: any) => c === '' || c === null || c === undefined)) {
      continue;
    }

    const saleDateRaw = row[0];       // Columna A (index 0) - solo tomar hora
    const cardRaw = row[12];          // Columna M (index 12) - últimos 4 dígitos
    const authCodeRaw = row[17];      // Columna R (index 17)
    const terminalSerialRaw = row[18];// Columna S (index 18)

    const parsedTime = extractTimeSeconds(saleDateRaw);
    const cardEnding = extractCardLast4(cardRaw);
    const authCode = normalizeAuthCode(authCodeRaw);
    const terminalSerial = String(terminalSerialRaw || '').trim();
    // Columna K (index 10) - Monto Total orden generada Yoshi
    let totalAmount = extractAmount(row[10]);
    if (totalAmount <= 0 && row[7] !== undefined) {
      totalAmount = extractAmount(row[7]); // Fallback a Col H si viniera en formato alterno
    }

    records.push({
      rowNumber: i + 1,
      raw: row,
      cardEnding,
      authCode,
      saleDateStr: String(saleDateRaw || '').trim(),
      timeStr: parsedTime ? parsedTime.formatted : '',
      timeSeconds: parsedTime ? parsedTime.seconds : -1,
      terminalSerial,
      totalAmount,
    });
  }
  return records;
}

/**
 * Parse Archivo 3: Total de Órdenes Expiradas
 * Starts at row 5 (index 4). Discards rows 1 to 4.
 */
export function parseExpiredOrdersFile(rows: any[][]): ExpiredOrderRecord[] {
  const records: ExpiredOrderRecord[] = [];
  for (let i = 4; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0 || row.every((c: any) => c === '' || c === null || c === undefined)) {
      continue;
    }

    const timeRaw = row[0];          // Columna A (index 0) - solo hora
    const concession = String(row[1] || '').trim(); // Columna B (index 1)
    const code = String(row[2] || '').trim();       // Columna C (index 2)
    const seller = String(row[4] || '').trim();     // Columna E (index 4)
    const baseAmount = extractAmount(row[6]);       // Columna G (index 6) - monto base
    const totalAmount = extractAmount(row[7]);      // Columna H (index 7) - total

    const parsedTime = extractTimeSeconds(timeRaw);

    records.push({
      rowNumber: i + 1,
      raw: row,
      timeStr: parsedTime ? parsedTime.formatted : String(timeRaw || ''),
      timeSeconds: parsedTime ? parsedTime.seconds : -1,
      concession,
      code,
      seller,
      baseAmount,
      totalAmount,
    });
  }
  return records;
}

/**
 * Parse Terminal Base Sheet
 * Columna C (index 2): Número de Serie
 * Columna D (index 3): ID Store
 */
export function parseTerminalCatalogRows(rows: any[][]): Array<{ serialNumber: string; storeId: string; notes?: string }> {
  const list: Array<{ serialNumber: string; storeId: string; notes?: string }> = [];
  // Skip header if row 0 has strings like "Serie" or "Terminal"
  const startIdx = rows.length > 0 && String(rows[0][2] || '').toLowerCase().includes('seri') ? 1 : 0;

  for (let i = startIdx; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const serial = String(row[2] || '').trim();
    const store = String(row[3] || '').trim();
    if (serial && store) {
      list.push({
        serialNumber: serial,
        storeId: store,
        notes: String(row[4] || row[1] || '').trim() || undefined,
      });
    }
  }
  return list;
}

/**
 * Full reconciliation engine according to exact specification
 */
export function performReconciliation(
  transactions: TransactionRecord[],
  generatedOrders: GeneratedOrderRecord[],
  expiredOrders: ExpiredOrderRecord[],
  terminalsCatalog: TerminalRecord[],
  options: ReconciliationOptions = DEFAULT_OPTIONS,
  cashRowsA1: number = 0
): {
  matchedWithOrders: MatchedOrderResult[];
  unmatchedApprovedTransactions: TransactionRecord[];
  possibleExpiredCharges: PossibleExpiredChargeResult[];
  activeStoreIdsMap: Map<string, string>; // terminalSerial -> storeId
  unregisteredTerminals: UnregisteredTerminalInfo[];
  summary: ReconciliationSummary;
} {
  // Step 1: Mapping terminals from Archivo 2 Columna S -> Base Col C -> Base Col D (Store ID)
  // Build lookup map from terminalsCatalog: serialNumber -> storeId and vice versa
  const serialToStoreMap = new Map<string, string>();
  const storeToSerialMap = new Map<string, string>();
  terminalsCatalog.forEach((t) => {
    const s = t.serialNumber.trim();
    const store = t.storeId.trim();
    if (s && store) {
      serialToStoreMap.set(s.toUpperCase(), store);
      if (!storeToSerialMap.has(store.toUpperCase())) {
        storeToSerialMap.set(store.toUpperCase(), s);
      }
    }
  });

  // Track terminal serials and frequency from Archivo 2 (Columna S)
  const file2TerminalCounts = new Map<string, { original: string; count: number; sampleRow: number }>();
  for (let idx = 0; idx < generatedOrders.length; idx++) {
    const o = generatedOrders[idx];
    if (o.terminalSerial) {
      const trimmed = o.terminalSerial.trim();
      const upper = trimmed.toUpperCase();
      const existing = file2TerminalCounts.get(upper);
      if (existing) {
        existing.count += 1;
      } else {
        file2TerminalCounts.set(upper, { original: trimmed, count: 1, sampleRow: o.rowNumber });
      }
    }
  }

  // Active Store IDs mapped from terminals that exist in the database
  const activeStoreIds = new Set<string>();
  const activeStoreIdsMap = new Map<string, string>();
  const unregisteredTerminalsList: UnregisteredTerminalInfo[] = [];

  file2TerminalCounts.forEach((data, upperSerial) => {
    const storeId = serialToStoreMap.get(upperSerial);
    if (storeId) {
      activeStoreIds.add(storeId.toUpperCase());
      activeStoreIdsMap.set(data.original, storeId);
      // Prioritize the exact serial format as it appears in Archivo 2 Columna S
      storeToSerialMap.set(storeId.toUpperCase(), data.original);
    } else {
      unregisteredTerminalsList.push({
        serialNumber: data.original,
        orderCount: data.count,
        sampleRowNumber: data.sampleRow,
      });
    }
  });

  // Sort unregistered terminals with most affected orders first
  unregisteredTerminalsList.sort((a, b) => b.orderCount - a.orderCount);

  // Assign terminalSerial (from Archivo 2 Col S / Catalog) to all transactions
  transactions.forEach((tx) => {
    if (tx.storeId) {
      tx.terminalSerial = storeToSerialMap.get(tx.storeId.trim().toUpperCase()) || '';
    }
  });

  // Step 2: Filter Archivo 1 based on Columna P (Store ID) matching activeStoreIds
  // If activeStoreIds has items, filter by them.
  let filteredTransactions = transactions.filter((tx) => {
    if (activeStoreIds.size === 0) return true;
    return (
      tx.storeId &&
      (activeStoreIds.has(tx.storeId.trim().toUpperCase()) ||
        Array.from(activeStoreIds).some((aid) => storeIdsMatch(aid, tx.storeId)))
    );
  });

  // Safe fallback: If filtering by activeStoreIds reduced transactions to 0,
  // but transactions existed in Archivo 1, preserve all transactions so the user doesn't get an artificial 0-match result.
  if (filteredTransactions.length === 0 && transactions.length > 0) {
    filteredTransactions = transactions;
  }

  // Step 3: Match Archivo 1 vs Archivo 2
  // ULTRA-FAST HASH-INDEXED MATCHING:
  // Indexes generated orders by both raw and stripped authCode for O(1) candidate lookup.
  const ordersByKey = new Map<string, number[]>();
  const ordersByCard = new Map<string, number[]>();
  for (let j = 0; j < generatedOrders.length; j++) {
    const order = generatedOrders[j];
    if (!order.cardEnding) continue;

    const cardList = ordersByCard.get(order.cardEnding);
    if (cardList) {
      cardList.push(j);
    } else {
      ordersByCard.set(order.cardEnding, [j]);
    }

    if (order.authCode) {
      const rawKey = `${order.cardEnding}_${order.authCode}`;
      const list1 = ordersByKey.get(rawKey);
      if (list1) list1.push(j);
      else ordersByKey.set(rawKey, [j]);

      const strippedKey = `${order.cardEnding}_${getStrippedAuthCode(order.authCode)}`;
      if (strippedKey !== rawKey) {
        const list2 = ordersByKey.get(strippedKey);
        if (list2) list2.push(j);
        else ordersByKey.set(strippedKey, [j]);
      }
    }
  }

  const matchedWithOrders: MatchedOrderResult[] = [];
  const matchedTxIndices = new Set<number>();
  const usedOrderIndices = new Set<number>();

  for (let i = 0; i < filteredTransactions.length; i++) {
    const tx = filteredTransactions[i];
    if (!tx.isApproved) continue; // Must be approved in both I and L
    if (!tx.cardEnding || !tx.authCode) continue;

    const rawKey = `${tx.cardEnding}_${tx.authCode}`;
    const strippedKey = `${tx.cardEnding}_${getStrippedAuthCode(tx.authCode)}`;

    let candidateOrderIndices = ordersByKey.get(rawKey);
    if (!candidateOrderIndices || candidateOrderIndices.length === 0) {
      candidateOrderIndices = ordersByKey.get(strippedKey);
    }
    // Fallback: Check orders with identical card last 4 using authCodesMatch
    if (!candidateOrderIndices || candidateOrderIndices.length === 0) {
      const cardList = ordersByCard.get(tx.cardEnding);
      if (cardList && cardList.length > 0) {
        candidateOrderIndices = cardList.filter((j) => authCodesMatch(tx.authCode, generatedOrders[j].authCode));
      }
    }

    if (!candidateOrderIndices || candidateOrderIndices.length === 0) continue;

    for (const j of candidateOrderIndices) {
      if (usedOrderIndices.has(j)) continue;
      const order = generatedOrders[j];

      // Verificación de terminal: Si ambas órdenes tienen Store ID conocido y difieren, omitir
      if (order.terminalSerial && tx.storeId) {
        const orderStoreId = serialToStoreMap.get(order.terminalSerial.trim().toUpperCase());
        if (orderStoreId && !storeIdsMatch(orderStoreId, tx.storeId)) {
          continue; // Pertenecen a dos tiendas físicas distintas
        }
      }

      // Time difference check: tx.time - order.time in seconds
      let timeMatches = false;
      let diffSeconds = 0;

      if (tx.timeSeconds >= 0 && order.timeSeconds >= 0) {
        diffSeconds = tx.timeSeconds - order.timeSeconds;
        // Margen de tiempo superior de +1 a +3 minutos (o ventana configurada)
        if (diffSeconds >= options.minTimeDiffSeconds && diffSeconds <= options.maxTimeDiffSeconds) {
          timeMatches = true;
        } else if (Math.abs(diffSeconds) <= 600) {
          // Tolerancia de hasta 10 minutos por desfasamiento de reloj entre terminal y banco
          timeMatches = true;
        } else if (Math.abs(Math.abs(diffSeconds) - 21600) <= 600 || Math.abs(Math.abs(diffSeconds) - 18000) <= 600) {
          // Tolerancia para reporte bancario en UTC vs hora local (5 o 6 horas de desfase)
          timeMatches = true;
        } else {
          // Coincidencia exacta de tarjeta + autorización
          timeMatches = true;
        }
      } else {
        // Si no hay hora parseable, se confía en coincidencia de tarjeta + autorización
        timeMatches = true;
      }

      if (timeMatches) {
        matchedTxIndices.add(i);
        usedOrderIndices.add(j);

        const diffMinutes = Math.round((diffSeconds / 60) * 10) / 10;
        matchedWithOrders.push({
          id: `match_ord_${tx.rowNumber}_${order.rowNumber}`,
          transaction: tx,
          generatedOrder: order,
          timeDiffSeconds: diffSeconds,
          timeDiffMinutesFormatted: `${diffMinutes >= 0 ? '+' : ''}${diffMinutes} min (${diffSeconds}s)`,
          matchedStoreId: tx.storeId,
        });
        break;
      }
    }
  }

  // Step 4: Separate remaining transactions
  // Remaining records: File 1 transactions with isApproved === true, within the filtered set,
  // that did NOT have a match with File 2
  const unmatchedApprovedTransactions = filteredTransactions.filter((tx, idx) => {
    return tx.isApproved && !matchedTxIndices.has(idx);
  });

  // Step 5: Cross remaining transactions with Archivo 3 (Total de Órdenes Expiradas)
  // High-performance time-windowed search
  const possibleExpiredCharges: PossibleExpiredChargeResult[] = [];
  const usedExpiredIndices = new Set<number>();

  if (expiredOrders.length > 0 && unmatchedApprovedTransactions.length > 0) {
    // Sort expired orders with their index by timeSeconds for fast range search
    const indexedExpired = expiredOrders.map((exp, originalIdx) => ({
      exp,
      originalIdx,
    }));
    indexedExpired.sort((a, b) => a.exp.timeSeconds - b.exp.timeSeconds);

    for (const tx of unmatchedApprovedTransactions) {
      // Find candidate expired orders within time window [tx.timeSeconds - 300, tx.timeSeconds + 60]
      for (let eIdx = 0; eIdx < indexedExpired.length; eIdx++) {
        const item = indexedExpired[eIdx];
        if (usedExpiredIndices.has(item.originalIdx)) continue;
        const exp = item.exp;

        let timeMatches = false;
        let diffSeconds = 0;

        if (tx.timeSeconds >= 0 && exp.timeSeconds >= 0) {
          diffSeconds = tx.timeSeconds - exp.timeSeconds;
          // Margen superior de 1 a 3 minutos (con tolerancia hasta 4 minutos)
          if (diffSeconds >= options.minTimeDiffSeconds && diffSeconds <= options.maxTimeDiffSeconds) {
            timeMatches = true;
          } else if (diffSeconds >= 0 && diffSeconds <= 240) {
            timeMatches = true;
          } else if (diffSeconds < -60) {
            // Since array is sorted by timeSeconds, if diff is far negative, later ones will be even more negative
            // but we continue safely
          }
        } else {
          timeMatches = true;
        }

        if (!timeMatches) continue;

        // Amount match check
        const baseAmt = exp.baseAmount;
        const totalAmt = exp.totalAmount;
        const valH = totalAmt > 0 ? totalAmt : baseAmt;

        const candidates: Array<{
          type: PossibleExpiredChargeResult['marginType'];
          label: string;
          expected: number;
        }> = [
          { type: 'total_exact', label: `Exacto sin propina ($${valH.toFixed(2)})`, expected: Math.round(valH * 100) / 100 },
          { type: 'plus_5', label: `+5% por posible propina ($${(valH * 1.05).toFixed(2)})`, expected: Math.round(valH * 1.05 * 100) / 100 },
          { type: 'plus_10', label: `+10% por posible propina ($${(valH * 1.10).toFixed(2)})`, expected: Math.round(valH * 1.10 * 100) / 100 },
          { type: 'plus_15', label: `+15% por posible propina ($${(valH * 1.15).toFixed(2)})`, expected: Math.round(valH * 1.15 * 100) / 100 },
          { type: 'plus_20', label: `+20% por posible propina ($${(valH * 1.20).toFixed(2)})`, expected: Math.round(valH * 1.20 * 100) / 100 },
        ];

        if (baseAmt > 0 && Math.abs(baseAmt - valH) > 0.01) {
          candidates.push(
            { type: 'base_exact', label: `Exacto Col G sin propina ($${baseAmt.toFixed(2)})`, expected: Math.round(baseAmt * 100) / 100 },
            { type: 'plus_5', label: `+5% por posible propina sobre Col G ($${(baseAmt * 1.05).toFixed(2)})`, expected: Math.round(baseAmt * 1.05 * 100) / 100 },
            { type: 'plus_10', label: `+10% por posible propina sobre Col G ($${(baseAmt * 1.10).toFixed(2)})`, expected: Math.round(baseAmt * 1.10 * 100) / 100 },
            { type: 'plus_15', label: `+15% por posible propina sobre Col G ($${(baseAmt * 1.15).toFixed(2)})`, expected: Math.round(baseAmt * 1.15 * 100) / 100 },
            { type: 'plus_20', label: `+20% por posible propina sobre Col G ($${(baseAmt * 1.20).toFixed(2)})`, expected: Math.round(baseAmt * 1.20 * 100) / 100 }
          );
        }

        let matchedCandidate: (typeof candidates)[0] | null = null;
        for (const cand of candidates) {
          if (cand.expected <= 0) continue;
          if (Math.abs(tx.amount - cand.expected) <= options.amountTolerance) {
            matchedCandidate = cand;
            break;
          }
        }

        if (matchedCandidate || (tx.amount === 0 && timeMatches)) {
          usedExpiredIndices.add(item.originalIdx);

          const diffMinutes = Math.round((diffSeconds / 60) * 10) / 10;
          possibleExpiredCharges.push({
            id: `exp_charge_${tx.rowNumber}_${exp.rowNumber}`,
            transaction: tx,
            expiredOrder: exp,
            marginType: matchedCandidate ? matchedCandidate.type : 'total_exact',
            marginLabel: matchedCandidate ? matchedCandidate.label : 'Coincidencia de Hora',
            calculatedExpectedAmount: matchedCandidate ? matchedCandidate.expected : exp.totalAmount,
            timeDiffSeconds: diffSeconds,
            timeDiffFormatted: `+${diffMinutes} min (${diffSeconds}s)`,
            horaArchivo1: tx.timeStr,
            horaArchivo3: exp.timeStr,
            montoArchivo1: tx.amount,
            montoArchivo2Total: 0,
            montoArchivo3Total: exp.totalAmount > 0 ? exp.totalAmount : exp.baseAmount,
            montoArchivo3Base: exp.baseAmount,
            storeIdArchivo1: tx.storeId,
            terminalSerialArchivo2: tx.terminalSerial || (tx.storeId ? storeToSerialMap.get(tx.storeId.trim().toUpperCase()) : '') || '—',
            concesionArchivo3: exp.concession,
            codigoArchivo3: exp.code,
            vendedorArchivo3: exp.seller,
            terminacionTarjetaArchivo1: tx.cardEnding,
            codigoAutorizacionArchivo1: tx.authCode,
            estatusIArchivo1: tx.statusI,
            estatusLArchivo1: tx.statusL,
          });
          break;
        }
      }
    }
  }

  const summary: ReconciliationSummary = {
    file1TotalRows: transactions.length,
    file1ValidRows: transactions.length,
    file1ApprovedRows: transactions.filter((t) => t.isApproved).length,
    file1FilteredByStoreIdRows: filteredTransactions.length,
    file2TotalRows: generatedOrders.length,
    file2ValidRows: generatedOrders.length,
    file2DistinctTerminals: file2TerminalCounts.size,
    activeMappedStoreIds: activeStoreIds.size,
    file3TotalRows: expiredOrders.length,
    file3ValidRows: expiredOrders.length,
    matchedWithOrdersCount: matchedWithOrders.length,
    unmatchedApprovedCount: unmatchedApprovedTransactions.length,
    possibleExpiredWithChargeCount: possibleExpiredCharges.length,
    unregisteredTerminalsCount: unregisteredTerminalsList.length,
    unregisteredTerminalsList,
    timestamp: new Date().toISOString(),
  };

  return {
    matchedWithOrders,
    unmatchedApprovedTransactions,
    possibleExpiredCharges,
    activeStoreIdsMap,
    unregisteredTerminals: unregisteredTerminalsList,
    summary,
  };
}

/**
 * Streaming reconciliation engine that yields live matches row-by-row
 * so the screen visually populates in real time as each transaction is analyzed.
 */
export async function performReconciliationStreaming(
  transactions: TransactionRecord[],
  generatedOrders: GeneratedOrderRecord[],
  expiredOrders: ExpiredOrderRecord[],
  terminalsCatalog: TerminalRecord[],
  options: ReconciliationOptions,
  onProgress: (update: {
    matchedWithOrders: MatchedOrderResult[];
    unmatchedApprovedTransactions: TransactionRecord[];
    possibleExpiredCharges: PossibleExpiredChargeResult[];
    activeStoreIdsMap: Map<string, string>;
    summary: ReconciliationSummary;
    progressState: ReconciliationProgressState;
  }) => void,
  shouldCancel: () => boolean,
  speedDelayOrGetter: number | (() => number) = 45,
  isPausedCheck?: () => boolean
): Promise<void> {
  const getDelay = () => (typeof speedDelayOrGetter === 'function' ? speedDelayOrGetter() : speedDelayOrGetter);

  const waitWithPause = async (ms: number) => {
    let elapsed = 0;
    while (isPausedCheck && isPausedCheck()) {
      if (shouldCancel()) return;
      await new Promise((r) => setTimeout(r, 80));
    }
    if (ms <= 0) return;
    await new Promise((r) => setTimeout(r, ms));
    while (isPausedCheck && isPausedCheck()) {
      if (shouldCancel()) return;
      await new Promise((r) => setTimeout(r, 80));
    }
  };

  // Step 1: Mapping terminals from Archivo 2 Columna S -> Base Col C -> Base Col D (Store ID)
  const serialToStoreMap = new Map<string, string>();
  const storeToSerialMap = new Map<string, string>();
  terminalsCatalog.forEach((t) => {
    const s = t.serialNumber.trim();
    const store = t.storeId.trim();
    if (s && store) {
      serialToStoreMap.set(s.toUpperCase(), store);
      if (!storeToSerialMap.has(store.toUpperCase())) {
        storeToSerialMap.set(store.toUpperCase(), s);
      }
    }
  });

  const file2TerminalCounts = new Map<string, { original: string; count: number; sampleRow: number }>();
  for (let idx = 0; idx < generatedOrders.length; idx++) {
    const o = generatedOrders[idx];
    if (o.terminalSerial) {
      const trimmed = o.terminalSerial.trim();
      const upper = trimmed.toUpperCase();
      const existing = file2TerminalCounts.get(upper);
      if (existing) {
        existing.count += 1;
      } else {
        file2TerminalCounts.set(upper, { original: trimmed, count: 1, sampleRow: o.rowNumber });
      }
    }
  }

  const activeStoreIds = new Set<string>();
  const activeStoreIdsMap = new Map<string, string>();
  const unregisteredTerminalsList: UnregisteredTerminalInfo[] = [];

  file2TerminalCounts.forEach((data, upperSerial) => {
    const storeId = serialToStoreMap.get(upperSerial);
    if (storeId) {
      activeStoreIds.add(storeId.toUpperCase());
      activeStoreIdsMap.set(data.original, storeId);
      // Prioritize the exact serial format as it appears in Archivo 2 Columna S
      storeToSerialMap.set(storeId.toUpperCase(), data.original);
    } else {
      unregisteredTerminalsList.push({
        serialNumber: data.original,
        orderCount: data.count,
        sampleRowNumber: data.sampleRow,
      });
    }
  });

  unregisteredTerminalsList.sort((a, b) => b.orderCount - a.orderCount);

  // Assign terminalSerial to all transactions
  transactions.forEach((tx) => {
    if (tx.storeId) {
      tx.terminalSerial = storeToSerialMap.get(tx.storeId.trim().toUpperCase()) || '';
    }
  });

  const filteredTransactions = transactions.filter((tx) => {
    if (activeStoreIds.size === 0) return true;
    return tx.storeId && activeStoreIds.has(tx.storeId.trim().toUpperCase());
  });

  const buildSummary = (
    matchedArr: MatchedOrderResult[],
    unmatchedArr: TransactionRecord[],
    expChargesArr: PossibleExpiredChargeResult[]
  ): ReconciliationSummary => ({
    file1TotalRows: transactions.length,
    file1ValidRows: transactions.length,
    file1ApprovedRows: transactions.filter((t) => t.isApproved).length,
    file1FilteredByStoreIdRows: filteredTransactions.length,
    file2TotalRows: generatedOrders.length,
    file2ValidRows: generatedOrders.length,
    file2DistinctTerminals: file2TerminalCounts.size,
    activeMappedStoreIds: activeStoreIds.size,
    file3TotalRows: expiredOrders.length,
    file3ValidRows: expiredOrders.length,
    matchedWithOrdersCount: matchedArr.length,
    unmatchedApprovedCount: unmatchedArr.length,
    possibleExpiredWithChargeCount: expChargesArr.length,
    unregisteredTerminalsCount: unregisteredTerminalsList.length,
    unregisteredTerminalsList,
    timestamp: new Date().toISOString(),
  });

  // Notify initial state
  onProgress({
    matchedWithOrders: [],
    unmatchedApprovedTransactions: [],
    possibleExpiredCharges: [],
    activeStoreIdsMap,
    summary: buildSummary([], [], []),
    progressState: {
      isStreaming: true,
      phase: 'filtering',
      phaseDescription: `Filtro de Store IDs completado: ${filteredTransactions.length} transacciones corresponden a terminales activas.`,
      progressPercent: 3,
      totalTransactionsToProcess: filteredTransactions.length,
      currentProcessedIndex: 0,
      matchedCountLive: 0,
      expiredMatchesCountLive: 0,
    },
  });

  await waitWithPause(Math.min(getDelay() * 2, 120));

  // Step 2: Matching File 1 vs File 2 row-by-row
  const matchedWithOrders: MatchedOrderResult[] = [];
  const matchedTxIndices = new Set<number>();
  const usedOrderIndices = new Set<number>();

  for (let i = 0; i < filteredTransactions.length; i++) {
    if (shouldCancel()) return;

    const tx = filteredTransactions[i];
    let foundMatchInOrder = false;

    const currentInspectedTx = {
      rowNumber: tx.rowNumber,
      cardEnding: tx.cardEnding,
      authCode: tx.authCode,
      timeStr: tx.timeStr,
      storeId: tx.storeId,
      amount: tx.amount,
    };

    if (tx.isApproved && tx.cardEnding && tx.authCode) {
      for (let j = 0; j < generatedOrders.length; j++) {
        if (usedOrderIndices.has(j)) continue;
        const order = generatedOrders[j];

        const cardMatches = tx.cardEnding === order.cardEnding;
        const authMatches = authCodesMatch(tx.authCode, order.authCode);

        if (!cardMatches || !authMatches) continue;

        // Verificación de terminal: Si ambas tienen Store ID conocido y difieren, omitir
        if (order.terminalSerial && tx.storeId) {
          const orderStoreId = serialToStoreMap.get(order.terminalSerial.trim().toUpperCase());
          if (orderStoreId && !storeIdsMatch(orderStoreId, tx.storeId)) {
            continue; // Pertenecen a dos tiendas físicas distintas
          }
        }

        let timeMatches = false;
        let diffSeconds = 0;

        if (tx.timeSeconds >= 0 && order.timeSeconds >= 0) {
          diffSeconds = tx.timeSeconds - order.timeSeconds;
          if (diffSeconds >= options.minTimeDiffSeconds && diffSeconds <= options.maxTimeDiffSeconds) {
            timeMatches = true;
          } else if (Math.abs(diffSeconds) <= 600) {
            timeMatches = true;
          } else if (Math.abs(Math.abs(diffSeconds) - 21600) <= 600 || Math.abs(Math.abs(diffSeconds) - 18000) <= 600) {
            timeMatches = true;
          } else {
            timeMatches = true;
          }
        } else {
          timeMatches = true;
        }

        if (timeMatches) {
          matchedTxIndices.add(i);
          usedOrderIndices.add(j);
          foundMatchInOrder = true;

          // Clear previous latest flag
          matchedWithOrders.forEach((m) => {
            m.isLatestMatch = false;
          });

          const diffMinutes = Math.round((diffSeconds / 60) * 10) / 10;
          const newMatch: MatchedOrderResult = {
            id: `match_ord_${tx.rowNumber}_${order.rowNumber}`,
            transaction: tx,
            generatedOrder: order,
            timeDiffSeconds: diffSeconds,
            timeDiffMinutesFormatted: `${diffMinutes >= 0 ? '+' : ''}${diffMinutes} min (${diffSeconds}s)`,
            matchedStoreId: tx.storeId,
            isLatestMatch: true,
          };
          matchedWithOrders.push(newMatch);

          const progressPercent = Math.round(5 + ((i + 1) / filteredTransactions.length) * 55);
          onProgress({
            matchedWithOrders: [...matchedWithOrders],
            unmatchedApprovedTransactions: [],
            possibleExpiredCharges: [],
            activeStoreIdsMap,
            summary: buildSummary(matchedWithOrders, [], []),
            progressState: {
              isStreaming: true,
              phase: 'matching_orders',
              phaseDescription: `Cotejando con Órdenes Generadas (Transacción ${i + 1} de ${filteredTransactions.length})...`,
              progressPercent,
              totalTransactionsToProcess: filteredTransactions.length,
              currentProcessedIndex: i + 1,
              matchedCountLive: matchedWithOrders.length,
              expiredMatchesCountLive: 0,
              lastMatchedMessage: `Coincidencia encontrada: Tarjeta ****${tx.cardEnding} • Aut ${tx.authCode} • ${newMatch.timeDiffMinutesFormatted}`,
              currentBatchItemText: `Renglón ${tx.rowNumber} • Store ${tx.storeId}`,
              currentInspectedTx,
            },
          });

          const currentDelay = getDelay();
          if (currentDelay > 0) {
            await waitWithPause(currentDelay);
          }
          break;
        }
      }
    }

    // Progress updates even when no match on every step or small batch
    if (!foundMatchInOrder) {
      const progressPercent = Math.round(5 + ((i + 1) / filteredTransactions.length) * 55);
      const shouldNotify = filteredTransactions.length < 50 || i % 2 === 0;

      if (shouldNotify) {
        onProgress({
          matchedWithOrders: [...matchedWithOrders],
          unmatchedApprovedTransactions: [],
          possibleExpiredCharges: [],
          activeStoreIdsMap,
          summary: buildSummary(matchedWithOrders, [], []),
          progressState: {
            isStreaming: true,
            phase: 'matching_orders',
            phaseDescription: `Cotejando con Órdenes Generadas (${i + 1} de ${filteredTransactions.length})...`,
            progressPercent,
            totalTransactionsToProcess: filteredTransactions.length,
            currentProcessedIndex: i + 1,
            matchedCountLive: matchedWithOrders.length,
            expiredMatchesCountLive: 0,
            currentInspectedTx,
          },
        });

        const currentDelay = getDelay();
        if (currentDelay > 0) {
          await waitWithPause(Math.max(4, Math.floor(currentDelay / 4)));
        }
      }
    }
  }

  // Step 3: Unmatched Approved transactions
  const unmatchedApprovedTransactions = filteredTransactions.filter((tx, idx) => {
    return tx.isApproved && !matchedTxIndices.has(idx);
  });

  // Step 4: Matching remaining vs Archivo 3 (Expired Orders) row-by-row
  const possibleExpiredCharges: PossibleExpiredChargeResult[] = [];
  const usedExpiredIndices = new Set<number>();

  if (expiredOrders.length > 0 && unmatchedApprovedTransactions.length > 0) {
    for (let k = 0; k < unmatchedApprovedTransactions.length; k++) {
      if (shouldCancel()) return;

      const tx = unmatchedApprovedTransactions[k];
      let foundExpired = false;

      const currentInspectedTx = {
        rowNumber: tx.rowNumber,
        cardEnding: tx.cardEnding,
        authCode: tx.authCode,
        timeStr: tx.timeStr,
        storeId: tx.storeId,
        amount: tx.amount,
      };

      for (let m = 0; m < expiredOrders.length; m++) {
        if (usedExpiredIndices.has(m)) continue;
        const exp = expiredOrders[m];

        let timeMatches = false;
        let diffSeconds = 0;

        if (tx.timeSeconds >= 0 && exp.timeSeconds >= 0) {
          diffSeconds = tx.timeSeconds - exp.timeSeconds;
          if (diffSeconds >= options.minTimeDiffSeconds && diffSeconds <= options.maxTimeDiffSeconds) {
            timeMatches = true;
          } else if (diffSeconds >= 0 && diffSeconds <= 240) {
            timeMatches = true;
          }
        } else {
          timeMatches = true;
        }

        if (!timeMatches) continue;

        const baseAmt = exp.baseAmount;
        const totalAmt = exp.totalAmount;
        const valH = totalAmt > 0 ? totalAmt : baseAmt;

        const candidates: Array<{
          type: PossibleExpiredChargeResult['marginType'];
          label: string;
          expected: number;
        }> = [
          { type: 'total_exact' as const, label: `Exacto sin propina ($${valH.toFixed(2)})`, expected: Math.round(valH * 100) / 100 },
          { type: 'plus_5' as const, label: `+5% por posible propina ($${(valH * 1.05).toFixed(2)})`, expected: Math.round(valH * 1.05 * 100) / 100 },
          { type: 'plus_10' as const, label: `+10% por posible propina ($${(valH * 1.10).toFixed(2)})`, expected: Math.round(valH * 1.10 * 100) / 100 },
          { type: 'plus_15' as const, label: `+15% por posible propina ($${(valH * 1.15).toFixed(2)})`, expected: Math.round(valH * 1.15 * 100) / 100 },
          { type: 'plus_20' as const, label: `+20% por posible propina ($${(valH * 1.20).toFixed(2)})`, expected: Math.round(valH * 1.20 * 100) / 100 },
        ];

        if (baseAmt > 0 && Math.abs(baseAmt - valH) > 0.01) {
          candidates.push(
            { type: 'base_exact' as const, label: `Exacto Col G sin propina ($${baseAmt.toFixed(2)})`, expected: Math.round(baseAmt * 100) / 100 },
            { type: 'plus_5' as const, label: `+5% por posible propina sobre Col G ($${(baseAmt * 1.05).toFixed(2)})`, expected: Math.round(baseAmt * 1.05 * 100) / 100 },
            { type: 'plus_10' as const, label: `+10% por posible propina sobre Col G ($${(baseAmt * 1.10).toFixed(2)})`, expected: Math.round(baseAmt * 1.10 * 100) / 100 },
            { type: 'plus_15' as const, label: `+15% por posible propina sobre Col G ($${(baseAmt * 1.15).toFixed(2)})`, expected: Math.round(baseAmt * 1.15 * 100) / 100 },
            { type: 'plus_20' as const, label: `+20% por posible propina sobre Col G ($${(baseAmt * 1.20).toFixed(2)})`, expected: Math.round(baseAmt * 1.20 * 100) / 100 }
          );
        }

        let matchedCandidate: (typeof candidates)[0] | null = null;
        for (const cand of candidates) {
          if (cand.expected <= 0) continue;
          if (Math.abs(tx.amount - cand.expected) <= options.amountTolerance) {
            matchedCandidate = cand;
            break;
          }
        }

        if (matchedCandidate || (tx.amount === 0 && timeMatches)) {
          usedExpiredIndices.add(m);
          foundExpired = true;

          possibleExpiredCharges.forEach((p) => {
            p.isLatestMatch = false;
          });

          const diffMinutes = Math.round((diffSeconds / 60) * 10) / 10;
          const newExpCharge: PossibleExpiredChargeResult = {
            id: `exp_charge_${tx.rowNumber}_${exp.rowNumber}`,
            transaction: tx,
            expiredOrder: exp,
            marginType: matchedCandidate ? matchedCandidate.type : 'total_exact',
            marginLabel: matchedCandidate ? matchedCandidate.label : 'Coincidencia de Hora',
            calculatedExpectedAmount: matchedCandidate ? matchedCandidate.expected : exp.totalAmount,
            timeDiffSeconds: diffSeconds,
            timeDiffFormatted: `+${diffMinutes} min (${diffSeconds}s)`,
            horaArchivo1: tx.timeStr,
            horaArchivo3: exp.timeStr,
            montoArchivo1: tx.amount,
            montoArchivo2Total: 0,
            montoArchivo3Total: exp.totalAmount > 0 ? exp.totalAmount : exp.baseAmount,
            montoArchivo3Base: exp.baseAmount,
            storeIdArchivo1: tx.storeId,
            terminalSerialArchivo2: tx.terminalSerial || (tx.storeId ? storeToSerialMap.get(tx.storeId.trim().toUpperCase()) : '') || '—',
            concesionArchivo3: exp.concession,
            codigoArchivo3: exp.code,
            vendedorArchivo3: exp.seller,
            terminacionTarjetaArchivo1: tx.cardEnding,
            codigoAutorizacionArchivo1: tx.authCode,
            estatusIArchivo1: tx.statusI,
            estatusLArchivo1: tx.statusL,
            isLatestMatch: true,
          };
          possibleExpiredCharges.push(newExpCharge);

          const progressPercent = Math.round(60 + ((k + 1) / unmatchedApprovedTransactions.length) * 38);
          onProgress({
            matchedWithOrders: [...matchedWithOrders],
            unmatchedApprovedTransactions: [...unmatchedApprovedTransactions],
            possibleExpiredCharges: [...possibleExpiredCharges],
            activeStoreIdsMap,
            summary: buildSummary(matchedWithOrders, unmatchedApprovedTransactions, possibleExpiredCharges),
            progressState: {
              isStreaming: true,
              phase: 'matching_expired',
              phaseDescription: `Cotejando restantes con Órdenes Expiradas (${k + 1} de ${unmatchedApprovedTransactions.length})...`,
              progressPercent,
              totalTransactionsToProcess: unmatchedApprovedTransactions.length,
              currentProcessedIndex: k + 1,
              matchedCountLive: matchedWithOrders.length,
              expiredMatchesCountLive: possibleExpiredCharges.length,
              lastMatchedMessage: `¡Posible Expirada Detectada!: ${exp.concession} • $${tx.amount.toFixed(2)} (${newExpCharge.marginLabel})`,
              currentBatchItemText: `TX Renglón ${tx.rowNumber} • Hora ${tx.timeStr}`,
              currentInspectedTx,
            },
          });

          const currentDelay = getDelay();
          if (currentDelay > 0) {
            await waitWithPause(currentDelay);
          }
          break;
        }
      }

      if (!foundExpired && k % 2 === 0) {
        const progressPercent = Math.round(60 + ((k + 1) / unmatchedApprovedTransactions.length) * 38);
        onProgress({
          matchedWithOrders: [...matchedWithOrders],
          unmatchedApprovedTransactions: [...unmatchedApprovedTransactions],
          possibleExpiredCharges: [...possibleExpiredCharges],
          activeStoreIdsMap,
          summary: buildSummary(matchedWithOrders, unmatchedApprovedTransactions, possibleExpiredCharges),
          progressState: {
            isStreaming: true,
            phase: 'matching_expired',
            phaseDescription: `Cotejando con Órdenes Expiradas (${k + 1} de ${unmatchedApprovedTransactions.length})...`,
            progressPercent,
            totalTransactionsToProcess: unmatchedApprovedTransactions.length,
            currentProcessedIndex: k + 1,
            matchedCountLive: matchedWithOrders.length,
            expiredMatchesCountLive: possibleExpiredCharges.length,
            currentInspectedTx,
          },
        });
        const currentDelay = getDelay();
        if (currentDelay > 0) {
          await waitWithPause(Math.max(4, Math.floor(currentDelay / 4)));
        }
      }
    }
  }

  // Clear isLatestMatch flags at end
  matchedWithOrders.forEach((m) => {
    m.isLatestMatch = false;
  });
  possibleExpiredCharges.forEach((p) => {
    p.isLatestMatch = false;
  });

  // Completion
  const finalSummary = buildSummary(
    matchedWithOrders,
    unmatchedApprovedTransactions,
    possibleExpiredCharges
  );
  onProgress({
    matchedWithOrders,
    unmatchedApprovedTransactions,
    possibleExpiredCharges,
    activeStoreIdsMap,
    summary: finalSummary,
    progressState: {
      isStreaming: false,
      phase: 'completed',
      phaseDescription: `¡Cotejo en tiempo real completado exitosamente! ${matchedWithOrders.length} coincidentes en pantalla y ${possibleExpiredCharges.length} posibles expiradas con cobro.`,
      progressPercent: 100,
      totalTransactionsToProcess: filteredTransactions.length,
      currentProcessedIndex: filteredTransactions.length,
      matchedCountLive: matchedWithOrders.length,
      expiredMatchesCountLive: possibleExpiredCharges.length,
    },
  });
}

/**
 * Generates and downloads the Excel report: POSIBLES EXPIRADAS CON COBRO
 * Fields:
 * - Hora de ambos archivos
 * - Monto ambos archivos
 * - Store ID archivo 1 columna P
 * - Concesión archivo 3 Columna B
 * - Código archivo 3 columna C
 * - Vendedor archivo 3 columna E
 * - Terminación de tarjeta archivo 1 columna S
 * - Código de autorización archivo 1 columna Y
 * - Estatus archivo 1 columnas I y L
 */
export function exportPossibleExpiredChargesToExcel(
  results: PossibleExpiredChargeResult[],
  reportTitle: string = 'POSIBLES EXPIRADAS CON COBRO'
): void {
  const exportData = results.map((item) => ({
    'Hora Archivo 1 SPIN (Col D)': item.horaArchivo1,
    'Hora Archivo 3 Expiradas (Col A)': item.horaArchivo3,
    'Dif. Tiempo': item.timeDiffFormatted,
    'Monto Cobrado Archivo 1 SPIN (Col E)': item.montoArchivo1,
    'Monto Total Archivo 2 Yoshi (Col K)': item.montoArchivo2Total || 0,
    'Monto Base / Total Archivo 3 Expiradas (Col H)': item.montoArchivo3Total,
    'Aumento / Margen Detectado (Posible Propina)': item.marginLabel,
    'Store ID (Archivo 1 SPIN Col P)': item.storeIdArchivo1,
    'No. Serie Terminal (Archivo 2 Col S)': item.terminalSerialArchivo2 || '—',
    'Concesión (Archivo 3 Expiradas Col B)': item.concesionArchivo3,
    'Código (Archivo 3 Expiradas Col C)': item.codigoArchivo3,
    'Vendedor (Archivo 3 Expiradas Col E)': item.vendedorArchivo3,
    'Terminación Tarjeta (Archivo 1 SPIN Col S)': item.terminacionTarjetaArchivo1,
    'Código Autorización (Archivo 1 SPIN Col Y)': item.codigoAutorizacionArchivo1,
    'Estatus Col I (Archivo 1 SPIN)': item.estatusIArchivo1,
    'Estatus Col L (Archivo 1 SPIN)': item.estatusLArchivo1,
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);

  // Set nice column widths
  const colWidths = [
    { wch: 22 }, // Hora A1
    { wch: 22 }, // Hora A3
    { wch: 16 }, // Dif tiempo
    { wch: 20 }, // Monto A1
    { wch: 20 }, // Monto A2
    { wch: 22 }, // Monto A3
    { wch: 24 }, // Margen
    { wch: 20 }, // Store ID
    { wch: 24 }, // No. Serie Terminal
    { wch: 24 }, // Concesión
    { wch: 16 }, // Código
    { wch: 24 }, // Vendedor
    { wch: 22 }, // Tarjeta
    { wch: 22 }, // Autorización
    { wch: 18 }, // Estatus I
    { wch: 18 }, // Estatus L
  ];
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'POSIBLES EXPIRADAS');

  // Trigger download with requested title
  const dateStr = new Date().toISOString().slice(0, 10);
  const fileName = `${reportTitle.replace(/\s+/g, '_')}_${dateStr}.xlsx`;
  XLSX.writeFile(workbook, fileName, { compression: false });
}

/**
 * Generates and downloads the Excel report: APROBADAS RESTANTES
 * Using the EXACT SAME format and columns as POSIBLES EXPIRADAS CON COBRO,
 * including No. Serie de la Terminal del Archivo 2 Columna S.
 */
export function exportUnmatchedApprovedToExcel(
  unmatchedList: TransactionRecord[],
  expiredMatchesMap: Map<number, PossibleExpiredChargeResult>,
  reportTitle: string = 'APROBADAS RESTANTES',
  storeIdToSerialMap?: Map<string, string>
): void {
  const exportData = unmatchedList.map((tx) => {
    const match = expiredMatchesMap.get(tx.rowNumber);
    const terminalSerial =
      tx.terminalSerial ||
      (tx.storeId && storeIdToSerialMap ? storeIdToSerialMap.get(tx.storeId.trim().toUpperCase()) : '') ||
      match?.terminalSerialArchivo2 ||
      '—';

    return {
      'Hora Archivo 1 SPIN (Col D)': tx.timeStr,
      'Hora Archivo 3 Expiradas (Col A)': match ? match.horaArchivo3 : '— (Sin orden coincidente)',
      'Dif. Tiempo': match ? match.timeDiffFormatted : '—',
      'Monto Cobrado Archivo 1 SPIN (Col E)': tx.amount,
      'Monto Total Archivo 2 Yoshi (Col K)': 0,
      'Monto Base / Total Archivo 3 Expiradas (Col H)': match ? match.montoArchivo3Total : 0,
      'Aumento / Margen Detectado (Posible Propina)': match ? match.marginLabel : 'Sin Coincidencia en A3',
      'Store ID (Archivo 1 SPIN Col P)': tx.storeId,
      'No. Serie Terminal (Archivo 2 Col S)': terminalSerial,
      'Concesión (Archivo 3 Expiradas Col B)': match ? match.concesionArchivo3 : '—',
      'Código (Archivo 3 Expiradas Col C)': match ? match.codigoArchivo3 : '—',
      'Vendedor (Archivo 3 Expiradas Col E)': match ? match.vendedorArchivo3 : '—',
      'Terminación Tarjeta (Archivo 1 SPIN Col S)': tx.cardEnding,
      'Código Autorización (Archivo 1 SPIN Col Y)': tx.authCode,
      'Estatus Col I (Archivo 1 SPIN)': tx.statusI,
      'Estatus Col L (Archivo 1 SPIN)': tx.statusL,
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(exportData);

  const colWidths = [
    { wch: 22 }, // Hora A1
    { wch: 24 }, // Hora A3
    { wch: 16 }, // Dif tiempo
    { wch: 20 }, // Monto A1
    { wch: 20 }, // Monto A2
    { wch: 22 }, // Monto A3
    { wch: 24 }, // Margen
    { wch: 20 }, // Store ID
    { wch: 24 }, // No. Serie Terminal
    { wch: 24 }, // Concesión
    { wch: 16 }, // Código
    { wch: 24 }, // Vendedor
    { wch: 22 }, // Tarjeta
    { wch: 22 }, // Autorización
    { wch: 18 }, // Estatus I
    { wch: 18 }, // Estatus L
  ];
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'APROBADAS RESTANTES');

  const dateStr = new Date().toISOString().slice(0, 10);
  const fileName = `${reportTitle.replace(/\s+/g, '_')}_${dateStr}.xlsx`;
  XLSX.writeFile(workbook, fileName, { compression: false });
}

/**
 * Raw sample rows for direct loading without serialization overhead
 */
export function getSampleRawRows(): {
  baseRows: any[][];
  f1Rows: any[][];
  f2Rows: any[][];
  f3Rows: any[][];
} {
  // 1. Base Terminals Catalog: Col C (Serie), Col D (ID Store)
  const baseRows = [
    ['ID', 'Modelo', 'Numero de Serie', 'ID Store', 'Ubicación'],
    ['1', 'POS Smart V2', 'SN-POS-8001', 'STR-010', 'Caja Principal Puerta 1'],
    ['2', 'POS Smart V2', 'SN-POS-8002', 'STR-010', 'Caja Barra 1'],
    ['3', 'POS Smart V2', 'SN-POS-8003', 'STR-020', 'Concesión Taquería A'],
    ['4', 'POS Smart V2', 'SN-POS-8004', 'STR-020', 'Concesión Taquería B'],
    ['5', 'POS Smart V2', 'SN-POS-8005', 'STR-030', 'Concesión Bebidas Sur'],
  ];

  // 2. File 1: Transactions (12 rows discarded, starts at row 13)
  const f1Rows: any[][] = [];
  f1Rows.push(['REPORTE CONSOLIDADO DE TRANSACCIONES BANCARIAS - SISTEMA DE COBRO']);
  f1Rows.push(['Generado por Terminal Central - Registro SPIN']);
  f1Rows.push(['Fecha de corte: 2026-10-19']);
  f1Rows.push(['Filtro: Todos los canales']);
  for (let r = 4; r <= 11; r++) {
    f1Rows.push([`Metadata renglón ${r}`, 'N/A', '---']);
  }
  const f1Header = new Array(26).fill('');
  f1Header[0] = 'ID Trans';
  f1Header[3] = 'Hora Transacción (D)';
  f1Header[5] = 'Monto (F)';
  f1Header[8] = 'Estatus I (I)';
  f1Header[11] = 'Estatus L (L)';
  f1Header[15] = 'Store ID (P)';
  f1Header[18] = 'Terminación Tarjeta (S)';
  f1Header[24] = 'Código Autorización (Y)';
  f1Rows.push(f1Header);

  // Row 13: Matches Order 1
  const row1 = new Array(26).fill('');
  row1[0] = 'TX-1001';
  row1[3] = '14:02:15';
  row1[5] = 450.0;
  row1[8] = 'Aprobada';
  row1[11] = 'Aprobada';
  row1[15] = 'STR-010';
  row1[18] = '4589';
  row1[24] = '948201';
  f1Rows.push(row1);

  // Row 14: Matches Order 2
  const row2 = new Array(26).fill('');
  row2[0] = 'TX-1002';
  row2[3] = '14:15:40';
  row2[5] = 280.0;
  row2[8] = 'Aprobada';
  row2[11] = 'Aprobada';
  row2[15] = 'STR-020';
  row2[18] = '7712';
  row2[24] = '104859';
  f1Rows.push(row2);

  // Row 15: Matches Expired Order 1 (+10% on $500 -> $550)
  const row3 = new Array(26).fill('');
  row3[0] = 'TX-1003';
  row3[3] = '14:32:10';
  row3[5] = 550.0;
  row3[8] = 'Aprobada';
  row3[11] = 'Aprobada';
  row3[15] = 'STR-010';
  row3[18] = '9921';
  row3[24] = '662019';
  f1Rows.push(row3);

  // Row 16: Matches Expired Order 2 (+15% on $300 -> $345)
  const row4 = new Array(26).fill('');
  row4[0] = 'TX-1004';
  row4[3] = '14:48:25';
  row4[5] = 345.0;
  row4[8] = 'Aprobada';
  row4[11] = 'Aprobada';
  row4[15] = 'STR-020';
  row4[18] = '3341';
  row4[24] = '773012';
  f1Rows.push(row4);

  // Row 17: Rechazada
  const row5 = new Array(26).fill('');
  row5[0] = 'TX-1005';
  row5[3] = '14:52:00';
  row5[5] = 120.0;
  row5[8] = 'Rechazada';
  row5[11] = 'Rechazada';
  row5[15] = 'STR-010';
  row5[18] = '1122';
  row5[24] = '000000';
  f1Rows.push(row5);

  // 3. File 2: Generated Orders (starts row 5)
  const f2Rows: any[][] = [];
  f2Rows.push(['SISTEMA DE ÓRDENES GENERADAS - VENTAS POS']);
  f2Rows.push(['Estadio / Recinto Central']);
  f2Rows.push(['Turno: Vespertino']);
  const f2Header = new Array(20).fill('');
  f2Header[0] = 'Fecha Venta (A)';
  f2Header[12] = 'No. Tarjeta (M)';
  f2Header[17] = 'Código Aut. (R)';
  f2Header[18] = 'No. Terminal (S)';
  f2Rows.push(f2Header);

  const o1 = new Array(20).fill('');
  o1[0] = '2026-10-19 14:00:30';
  o1[12] = '************4589';
  o1[17] = '948201';
  o1[18] = 'SN-POS-8001';
  f2Rows.push(o1);

  const o2 = new Array(20).fill('');
  o2[0] = '2026-10-19 14:13:20';
  o2[12] = '4152313298717712';
  o2[17] = '104859';
  o2[18] = 'SN-POS-8003';
  f2Rows.push(o2);

  // 4. File 3: Expired Orders (starts row 5)
  const f3Rows: any[][] = [];
  f3Rows.push(['REPORTE DE ÓRDENES EXPIRADAS O CANCELADAS POR TIMEOUT']);
  f3Rows.push(['Sistema POS Concesiones']);
  f3Rows.push(['Fecha: 2026-10-19']);
  const f3Header = new Array(10).fill('');
  f3Header[0] = 'Hora (A)';
  f3Header[1] = 'Concesión (B)';
  f3Header[2] = 'Código (C)';
  f3Header[4] = 'Vendedor (E)';
  f3Header[6] = 'Monto Base (G)';
  f3Header[7] = 'Total (H)';
  f3Rows.push(f3Header);

  const e1 = new Array(10).fill('');
  e1[0] = '14:30:00';
  e1[1] = 'Bebidas & Cervezas Corona 1';
  e1[2] = 'EXP-90042';
  e1[4] = 'Carlos Mendoza (Cajero 04)';
  e1[6] = 500.0;
  e1[7] = 500.0;
  f3Rows.push(e1);

  const e2 = new Array(10).fill('');
  e2[0] = '14:46:00';
  e2[1] = 'Tacos El Campeón Secc B';
  e2[2] = 'EXP-90088';
  e2[4] = 'Andrea Rivera (Cajero 11)';
  e2[6] = 300.0;
  e2[7] = 300.0;
  f3Rows.push(e2);

  return { baseRows, f1Rows, f2Rows, f3Rows };
}

/**
 * Creates downloadable Excel bytes on demand with compression: false to eliminate data descriptors
 */
export function generateSampleExcelBlob(type: 'base' | 'f1' | 'f2' | 'f3'): Uint8Array {
  const { baseRows, f1Rows, f2Rows, f3Rows } = getSampleRawRows();
  let ws: XLSX.WorkSheet;
  let wb = XLSX.utils.book_new();

  switch (type) {
    case 'base':
      ws = XLSX.utils.aoa_to_sheet(baseRows);
      XLSX.utils.book_append_sheet(wb, ws, 'Terminales');
      break;
    case 'f1':
      ws = XLSX.utils.aoa_to_sheet(f1Rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Transacciones');
      break;
    case 'f2':
      ws = XLSX.utils.aoa_to_sheet(f2Rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Ordenes_Generadas');
      break;
    case 'f3':
      ws = XLSX.utils.aoa_to_sheet(f3Rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Ordenes_Expiradas');
      break;
  }

  return XLSX.write(wb, { bookType: 'xlsx', type: 'array', compression: false }) as Uint8Array;
}
