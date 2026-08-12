import { google } from 'googleapis';

// Google Sheets configuration from environment variables
const SPREADSHEET_ID = getSpreadsheetId(process.env.GOOGLE_SPREADSHEET_ID);
const TIMETABLE_SHEETS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

function getSpreadsheetId(value: string | undefined): string {
  if (!value) {
    throw new Error('GOOGLE_SPREADSHEET_ID is not set');
  }

  const trimmedValue = value.trim();
  const match = trimmedValue.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match?.[1] ?? trimmedValue;
}

function getPrivateKey(value: string | undefined): string {
  const privateKey = value?.replace(/\\n/g, '\n').trim();

  if (!privateKey || privateKey.includes('YOUR_PRIVATE_KEY_HERE')) {
    throw new Error('GOOGLE_PRIVATE_KEY is not configured with a valid service account key');
  }

  return privateKey;
}

// Get Google Sheets client
function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      type: 'service_account',
      project_id: process.env.GOOGLE_PROJECT_ID,
      private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
      private_key: getPrivateKey(process.env.GOOGLE_PRIVATE_KEY),
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      client_id: process.env.GOOGLE_CLIENT_ID,
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  return google.sheets({ version: 'v4', auth });
}

// Cache for spreadsheet data
let cachedSpreadsheet: any = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

// Fetch spreadsheet with caching
export async function fetchSpreadsheet() {
  const now = Date.now();
  
  // Return cached if still valid
  if (cachedSpreadsheet && (now - cacheTimestamp) < CACHE_DURATION) {
    console.log('Using cached spreadsheet data');
    return cachedSpreadsheet;
  }

  console.log('Fetching fresh spreadsheet data...');
  const sheets = getSheetsClient();
  
  try {
    const ranges = TIMETABLE_SHEETS.map(sheet => `${sheet}!A1:AN100`);
    
    const response = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
      ranges,
      includeGridData: true,
    });

    cachedSpreadsheet = response.data;
    cacheTimestamp = now;
    
    return cachedSpreadsheet;
  } catch (error) {
    console.error('Error fetching spreadsheet:', error);
    throw error;
  }
}

// Helper functions for cell data access
export function getFormattedValue(cell: any): string | null {
  if (!cell) return null;
  return cell.formattedValue || null;
}

export function getBackgroundColor(cell: any): string {
  if (!cell?.effectiveFormat?.backgroundColor) return '';
  
  const bg = cell.effectiveFormat.backgroundColor;
  const r = bg.red ?? 0;
  const g = bg.green ?? 0;
  const b = bg.blue ?? 0;
  
  return `${r.toFixed(2)}${g.toFixed(2)}${b.toFixed(2)}`;
}

// Extract batch colors from spreadsheet
export function extractBatchColors(spreadsheet: any): { [color: string]: string } {
  const batchColors: { [color: string]: string } = {};
  
  spreadsheet.sheets?.forEach((sheet: any) => {
    const sheetName = sheet.properties?.title;
    if (!TIMETABLE_SHEETS.includes(sheetName)) return;

    const gridData = sheet.data?.[0]?.rowData;
    if (!gridData) return;

    // Check first 4 rows for batch color headers
    for (let rowIdx = 0; rowIdx < Math.min(4, gridData.length); rowIdx++) {
      const rowData = gridData[rowIdx]?.values || [];
      
      rowData.forEach((cell: any) => {
        const value = getFormattedValue(cell);
        const cellColor = getBackgroundColor(cell);
        
        if (value && value.includes('BS') && cellColor && cellColor !== '1.001.001.00') {
          batchColors[cellColor] = value.trim();
        }
      });
    }
  });

  return batchColors;
}

export { TIMETABLE_SHEETS };
