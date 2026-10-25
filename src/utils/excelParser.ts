import * as XLSX from 'xlsx';

export interface ParsedSheetData {
  fileName: string;
  rows: any[][];
}

/**
 * Safely parse a workbook while suppressing non-fatal SheetJS decompression warnings
 */
export function safeReadWorkbook(
  data: any,
  options: XLSX.ParsingOptions = { type: 'array', cellDates: true }
): XLSX.WorkBook {
  const originalError = console.error;
  const originalWarn = console.warn;
  try {
    console.error = (...args: any[]) => {
      const msg = typeof args[0] === 'string' ? args[0] : '';
      if (msg.includes('Bad uncompressed size') || msg.includes('Bad compressed size')) {
        return; // Suppress non-fatal SheetJS internal zip warning
      }
      originalError.apply(console, args);
    };
    console.warn = (...args: any[]) => {
      const msg = typeof args[0] === 'string' ? args[0] : '';
      if (msg.includes('Bad uncompressed size') || msg.includes('Bad compressed size')) {
        return;
      }
      originalWarn.apply(console, args);
    };
    return XLSX.read(data, options);
  } finally {
    console.error = originalError;
    console.warn = originalWarn;
  }
}

/**
 * Reads an Excel file (.xlsx, .xls, .csv) and returns 2D array of rows
 */
export async function readExcelFile(file: File): Promise<ParsedSheetData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = safeReadWorkbook(data, { type: 'array', cellDates: true });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // header: 1 produces a 2D array [ [colA, colB, colC...], ... ]
        const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          raw: false,
          defval: '',
        });

        resolve({
          fileName: file.name,
          rows: rawRows,
        });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Extracts time in seconds from midnight (0 .. 86399) and a formatted HH:mm:ss string
 * Handles Date objects, strings like "14:35:22", "2026-10-19 14:35:22", AM/PM, or Excel decimal / date serials
 */
export function extractTimeSeconds(val: any): { seconds: number; formatted: string } | null {
  if (val === null || val === undefined || val === '') return null;

  // If already a Date
  if (val instanceof Date && !isNaN(val.getTime())) {
    const hours = val.getHours();
    const minutes = val.getMinutes();
    const seconds = val.getSeconds();
    const totalSec = hours * 3600 + minutes * 60 + seconds;
    const formatted = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    return { seconds: totalSec, formatted };
  }

  const str = String(val).trim();

  // If numeric float (Excel time fraction or date serial number)
  if (/^-?\d+(\.\d+)?$/.test(str)) {
    const num = parseFloat(str);
    if (num >= 0) {
      // Excel serial number: fraction is time of day
      const fraction = num >= 1 ? (num - Math.floor(num)) : num;
      const totalSec = Math.round(fraction * 86400) % 86400;
      const hours = Math.floor(totalSec / 3600);
      const minutes = Math.floor((totalSec % 3600) / 60);
      const seconds = totalSec % 60;
      return {
        seconds: totalSec,
        formatted: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
      };
    }
  }

  // Look for time pattern: HH:MM:SS or HH:MM with optional AM/PM
  const match = str.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?/i);
  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const seconds = match[3] ? parseInt(match[3], 10) : 0;
    const meridiem = match[4]?.toLowerCase();

    if (meridiem) {
      if (meridiem.startsWith('p') && hours < 12) hours += 12;
      if (meridiem.startsWith('a') && hours === 12) hours = 0;
    }

    const totalSec = (hours % 24) * 3600 + minutes * 60 + seconds;
    const formatted = `${String(hours % 24).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    return { seconds: totalSec, formatted };
  }

  return null;
}

/**
 * Extracts last 4 digits of a card number
 */
export function extractCardLast4(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val).replace(/\D/g, '');
  if (str.length >= 4) return str.slice(-4);
  if (str.length > 0) return str.padStart(4, '0');
  return '';
}

/**
 * Compares two card numbers by their last 4 digits
 */
export function cardsMatch(a: any, b: any): boolean {
  const cA = extractCardLast4(a);
  const cB = extractCardLast4(b);
  if (!cA || !cB) return false;
  return cA === cB;
}

/**
 * Normalizes authorization code (removes leading/trailing spaces, trailing .0 from float conversions)
 */
export function normalizeAuthCode(val: any): string {
  if (val === null || val === undefined) return '';
  let str = String(val).trim().toUpperCase();
  // Strip trailing .0 if Excel parsed integer as float (e.g. "45921.0")
  str = str.replace(/\.0+$/, '');
  return str;
}

/**
 * Gets a stripped authorization code for resilient index lookup (removes leading zeros and .0)
 */
export function getStrippedAuthCode(val: any): string {
  const norm = normalizeAuthCode(val);
  const stripped = norm.replace(/^0+/, '');
  return stripped || norm;
}

/**
 * Checks whether two authorization codes match, accounting for leading zeros stripped by Excel,
 * floating point '.0' endings, or whitespace.
 */
export function authCodesMatch(a: any, b: any): boolean {
  if (a === null || a === undefined || b === null || b === undefined) return false;
  const sA = normalizeAuthCode(a);
  const sB = normalizeAuthCode(b);
  if (!sA || !sB) return false;
  if (sA === sB) return true;
  // Check without leading zeroes (e.g. '045921' vs '45921')
  const strippedA = sA.replace(/^0+/, '');
  const strippedB = sB.replace(/^0+/, '');
  if (strippedA && strippedA === strippedB) return true;
  return false;
}

/**
 * Checks whether two store IDs match, accounting for leading zeros or case
 */
export function storeIdsMatch(a?: string, b?: string): boolean {
  if (!a || !b) return true; // If one is unspecified, do not block
  const sA = String(a).trim().toUpperCase();
  const sB = String(b).trim().toUpperCase();
  if (sA === sB) return true;
  const strippedA = sA.replace(/^0+/, '');
  const strippedB = sB.replace(/^0+/, '');
  if (strippedA && strippedA === strippedB) return true;
  return false;
}

/**
 * Checks if status denotes an approved transaction.
 * Supports various Spanish and English terms: Aprobada, Aprobado, Liquidada, Exitosa, Capturada, Approved, OK.
 * Rejects if explicitly marked as Rechazada, Cancelada, Declinada, Fallida.
 */
export function isStatusApproved(statusI: any, statusL: any): boolean {
  const isApprovedStr = (val: any): boolean => {
    if (val === null || val === undefined) return false;
    const s = String(val)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
    if (!s) return false;
    return (
      s.includes('aprob') ||
      s.includes('exit') ||
      s.includes('liquid') ||
      s.includes('pagad') ||
      s.includes('captur') ||
      s.includes('complet') ||
      s.includes('ok') ||
      s.includes('appr') ||
      s === '0' ||
      s === '00' ||
      s === 'true' ||
      s === '1'
    );
  };

  const isRejectedStr = (val: any): boolean => {
    if (val === null || val === undefined) return false;
    const s = String(val)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
    if (!s) return false;
    return (
      s.includes('rechaz') ||
      s.includes('declin') ||
      s.includes('cancel') ||
      s.includes('fall') ||
      s.includes('error') ||
      s.includes('denied')
    );
  };

  // If either explicitly indicates rejected/declined, it's not approved
  if (isRejectedStr(statusI) || isRejectedStr(statusL)) return false;

  // If both denote approval: approved!
  if (isApprovedStr(statusI) && isApprovedStr(statusL)) return true;

  // If one is approved and the other is empty or unspecified: approved!
  if (isApprovedStr(statusI) && (!statusL || String(statusL).trim() === '')) return true;
  if (isApprovedStr(statusL) && (!statusI || String(statusI).trim() === '')) return true;

  // If at least one denotes approval: approved!
  if (isApprovedStr(statusI) || isApprovedStr(statusL)) return true;

  // If neither column is populated, default to true so transactions are not dropped
  if (!statusI && !statusL) return true;

  return false;
}

/**
 * Extracts a numeric amount from cell
 */
export function extractAmount(val: any): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const clean = String(val).replace(/[^\d.-]/g, '');
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : parsed;
}
