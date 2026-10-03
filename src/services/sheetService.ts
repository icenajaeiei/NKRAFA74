import { Student } from '../types';

export const SPREADSHEET_ID = '18FY5wDufedEcoxnjlHpLh1XV4IMcWsdicncDZ4W8Ui8';
export const SPREADSHEET_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit?usp=sharing`;

const SHEET_CACHE_KEY = 'v1_google_sheet_clubs_cache';
const SHEET_LAST_SYNC_KEY = 'v1_google_sheet_last_sync_time';

export interface SheetRow {
  rawFirst: string;
  rawLast: string;
  clubs: string[];
  cleanFirst: string;
  cleanLast: string;
  fullName: string;
}

export interface SheetSyncResult {
  success: boolean;
  timestamp: string;
  totalRows: number;
  matchedStudents: number;
  clubsFound: string[];
  error?: string;
}

/**
 * Remove zero-width chars, honorifics (นนอ., นอน., นาย, etc.), and spaces
 */
export function cleanThaiName(name: string): string {
  if (!name) return '';
  return name
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // remove zero-width spaces
    .replace(/^(นนอ\.|นอน\.|นอ\.|นาย|\s)+/g, '') // remove ranks/titles
    .replace(/\s+/g, '') // remove inner whitespace
    .trim();
}

/**
 * Split multiple clubs from a cell string (handles comma, slash, plus, semicolon, newline, etc.)
 */
export function splitMultipleClubs(clubString: string): string[] {
  if (!clubString) return [];
  // Split by comma, slash, plus, semicolon, or newline
  return clubString
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .split(/[,/+;\n\r]+/)
    .map(c => c.trim())
    .filter(c => c.length > 0);
}

/**
 * Parse CSV text from Google Sheet
 */
export function parseSheetCSV(csvText: string): SheetRow[] {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  const rows: SheetRow[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip header line if detected
    if (i === 0 && (line.includes('ชื่อ') || line.includes('นามสกุล') || line.includes('ชมรม'))) {
      continue;
    }

    // Match quoted CSV values or comma separated
    const quotedMatch = line.match(/^"([^"]*)","([^"]*)","([^"]*)"/);
    let rawFirst = '';
    let rawLast = '';
    let rawClub = '';

    if (quotedMatch) {
      rawFirst = quotedMatch[1] || '';
      rawLast = quotedMatch[2] || '';
      rawClub = quotedMatch[3] || '';
    } else {
      // Split by comma
      const parts = line.split(',').map(p => p.replace(/^"|"$/g, '').trim());
      if (parts.length >= 3) {
        rawFirst = parts[0];
        rawLast = parts[1];
        // Combine remaining parts in case clubs had unquoted commas
        rawClub = parts.slice(2).join(',');
      }
    }

    const cleanFirst = cleanThaiName(rawFirst);
    const cleanLast = cleanThaiName(rawLast);
    const clubs = splitMultipleClubs(rawClub);

    if (cleanFirst && clubs.length > 0) {
      rows.push({
        rawFirst,
        rawLast,
        clubs,
        cleanFirst,
        cleanLast,
        fullName: cleanFirst + cleanLast
      });
    }
  }

  return rows;
}

/**
 * Fetch raw CSV from Google Spreadsheet with cache busting
 */
export async function fetchGoogleSheetCSV(): Promise<string> {
  const cacheBuster = Date.now();
  // gviz/tq endpoint natively supports CORS origin reflection
  const gvizUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&_t=${cacheBuster}`;

  try {
    const res = await fetch(gvizUrl, {
      method: 'GET',
      headers: {
        'Accept': 'text/csv,text/plain,*/*'
      }
    });

    if (!res.ok) {
      throw new Error(`Google Sheets responded with HTTP ${res.status}`);
    }

    const text = await res.text();
    return text;
  } catch (err) {
    // Secondary fallback: standard export format
    const exportUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&_t=${cacheBuster}`;
    const fallbackRes = await fetch(exportUrl);
    if (!fallbackRes.ok) {
      throw new Error(`Fallback failed with HTTP ${fallbackRes.status}`);
    }
    return await fallbackRes.text();
  }
}

/**
 * Apply sheet rows to students list, supporting multiple clubs per student
 * (both in the same cell separated by delimiter, and across multiple rows)
 */
export function applySheetToStudents(students: Student[], rows: SheetRow[]): {
  updatedStudents: Student[];
  matchedCount: number;
  clubsFound: string[];
} {
  // Collect all unique clubs found across all rows
  const allClubsSet = new Set<string>();
  rows.forEach(r => {
    r.clubs.forEach(c => allClubsSet.add(c));
  });
  const uniqueClubs = Array.from(allClubsSet).filter(Boolean);

  let matchedCount = 0;

  // Build map of clean student name -> all matching rows (can be multiple rows per student)
  const updatedStudents = students.map(student => {
    const cleanStudentName = cleanThaiName(student.name);

    // Find all matching rows for this student
    const matchedRows = rows.filter(r => {
      if (cleanStudentName === r.fullName) return true;
      if (r.cleanFirst && r.cleanLast) {
        return cleanStudentName.includes(r.cleanFirst) && cleanStudentName.includes(r.cleanLast);
      }
      return cleanStudentName === r.cleanFirst;
    });

    if (matchedRows.length > 0) {
      // Merge all clubs from all matched rows and deduplicate
      const studentClubsSet = new Set<string>();
      matchedRows.forEach(r => {
        r.clubs.forEach(c => studentClubsSet.add(c));
      });
      const finalClubs = Array.from(studentClubsSet);

      if (finalClubs.length > 0) {
        matchedCount++;
        return {
          ...student,
          clubs: finalClubs
        };
      }
    }

    return {
      ...student,
      clubs: []
    };
  });

  return {
    updatedStudents,
    matchedCount,
    clubsFound: uniqueClubs
  };
}

/**
 * Save sync cache to localStorage
 */
export function saveSheetCache(csv: string): void {
  try {
    localStorage.setItem(SHEET_CACHE_KEY, csv);
    localStorage.setItem(SHEET_LAST_SYNC_KEY, new Date().toISOString());
  } catch (e) {
    console.error('Error saving sheet cache:', e);
  }
}

export function getSheetCache(): { csv: string | null; lastSync: string | null } {
  try {
    return {
      csv: localStorage.getItem(SHEET_CACHE_KEY),
      lastSync: localStorage.getItem(SHEET_LAST_SYNC_KEY)
    };
  } catch {
    return { csv: null, lastSync: null };
  }
}
