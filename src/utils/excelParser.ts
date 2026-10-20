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
 * Handles Date objects, strings like "14:35:22", "2026-10-19 14:35:22", AM/PM, or Excel decimal time
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

  // If numeric float (Excel time fraction e.g. 0.5 = 12:00:00)
  if (/^-?\d+(\.\d+)?$/.test(str)) {
    const num = parseFloat(str);
    if (num >= 0 && num < 1) {
      const totalSec = Math.round(num * 86400);
      const hours = Math.floor(totalSec / 3600) % 24;
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

    const totalSec = hours * 3600 + minutes * 60 + seconds;
    const formatted = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
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
  return str.length >= 4 ? str.slice(-4) : str;
}

/**
 * Normalizes authorization code (removes leading/trailing spaces, leading zeroes if alphanumeric)
 */
export function normalizeAuthCode(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val).trim().toUpperCase();
}

/**
 * Checks if status in col I and col L are identical and both denote "Aprobada"
 */
export function isStatusApproved(statusI: any, statusL: any): boolean {
  if (!statusI && !statusL) return false;
  const sI = String(statusI || '').trim().toLowerCase();
  const sL = String(statusL || '').trim().toLowerCase();

  // Normalize accents and plural/singular
  const normalize = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/s$/, ''); // aprobadas -> aprobada

  const nI = normalize(sI);
  const nL = normalize(sL);

  if (nI !== nL) return false;

  const validApprovals = ['aprobada', 'aprobado', 'approved', 'ok', 'exitosa', 'exitoso'];
  return validApprovals.includes(nI);
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
