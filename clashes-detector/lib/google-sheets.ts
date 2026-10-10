import { google } from 'googleapis';

// Google Sheets configuration from environment variables with fallbacks
const DEFAULT_SPREADSHEET_ID = '1vlTuotLw34fedME3gNQj09cZw-todVomxAiu5P1wZ6Q';
const DEFAULT_PROJECT_ID = 'time-table-project-450013';
const DEFAULT_PRIVATE_KEY_ID = 'd1f3b8e418b1fc204c80a7a00cfd2b55a8695017';
const DEFAULT_CLIENT_EMAIL = 'timetable-bot-876@time-table-project-450013.iam.gserviceaccount.com';
const DEFAULT_CLIENT_ID = '108757805364038870086';
const DEFAULT_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQC7Gp4+xHPlQPJL
G3VGg2r4WHosjiheeADEZiLw5hyBSYva9TxfIS+gWEICCQTCc4dhCyBH/Ukb7Okw
wpvUVRjYlWp/zbYTXFDx1tGquxC/WHk8b2CsNUi/2682HbpBmlSpJqaYuxbbMSsI
7U0e2R6oxbVIygSSxxG7x2H5E6lrQLjPCOGTgPdCyHpjj4NmjAA7beonefTB3nXM
MxMjNldfrhJ3V9MC/mMFOtWJaj6beYvIxId6m+9iuBogdzHkYmhMymZ1JP5I4GO7
iVrbYB2IsjJTsnl/x4rXEd748Fg3xlgh+QpUkCkOG9j3KH9b9LukMM852o+IAJ3S
Ob6ctbHFAgMBAAECggEAJloO7MvE+82DvLx8nf8LGqu8I0ziXnbXpWpQKDPqzN9/
8NpKzS8WvZXJtfQWSyt2KQCoVclHxpcZt3p0iaIFzUNXSKooc7B9EQ1Y/deJV8dx
Vl94H+RuLJGBySRvzMmvJ9r51B2pUjWyXgqSP8v+elbIUYrDRDjU3DpCzVTn6clJ
ObH1LWViHEDyvBxVRYK1N+DdpLRJaisfw8hJsm7xvHO6Gc2XW27y3/gYCl4PgsYx
dUFCtZaCJSSdO9nqcEVWZK2yBP4m5iRwR/KWOvrg/yxy+n5IkLtZQ5ED69edpA5V
Hyr8XuC8ZQZ9UwDQm/WwZGqLnUclPdRq8ScUbxIe8QKBgQDf20Yd1Swu76wNV8GI
AZZbfS+l8FlB9b+5Y2jZqh3jeVEI7kG7wotrJSwpEVwsgATb3zQ+Ffpm/tKkNMMF
VBL1wQimqdK/Bf/fm5Q+os4GamtTTlFyylNXeV/cBgRTalzwsJqRh+RovPAPJ2s1
4T2SKj5h3XHqS+Llk3IdLqQELQKBgQDV+FwKituGFJp/JiPOhLy51mCKLmHI53TT
lZAe3//u0YQVbSejnUnFYr17XDh0mJuRdeTckmkv0hjZiA2ByrbbMjxUGbfD0xLb
MCr2InZwdKmaC7+fi1l2x/rC334oC3OnPFAQbYShw5S6R8G3MaB32HhWyDB0vFPT
j9ZvpB9q+QKBgEo7CBE0cyZNS5xREVfsTtOfu4EnJjH9L8pl8IrdInQf8oMnnpyI
cnrhJLepjgsjmHjglw5Pc21b6rWQ2WqW6oKbtCawAbZeYu7fRFVQ30i5WUWSnueV
t/U1xlfLlvuiNZeKuHaxvUgN/vzHcYG4YxZo8664I+Ixr9e5AQo0QScxAoGAILN0
XagbJMLBWe1aS5W9wikhV/z+tNWq5StWe2GAm98pcJzeEgNX4vLUQqY1epxYKkL6
VzuJF+XkJlrEtbFlgNqMnc3QZ/06RIV4C2X48/bgdMqW3qtNYPnvORkvDq+xXT26
fsg+HPrnIBEXaggLnkVXHuw5e53MseipvSY4JwECgYBAhy/9OXmC8ADXjaRtdgLr
Gqr8WisuwQQRCmlaku9OJpKky9/2uI1mvwMXMExWXfq4yZDopw6qSm8PSv5Xs2Ft
5W+YEsOEiqh0pu/QfTd1Dh7GNnbWEERl3RBj6EyUGxINwdL+TcwDDfpLlF3q0nls
TCFebCl7qM0DA8AujtR9Ag==
-----END PRIVATE KEY-----`;

const SPREADSHEET_ID = getSpreadsheetId(process.env.GOOGLE_SPREADSHEET_ID);
const TIMETABLE_SHEETS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

function getSpreadsheetId(value: string | undefined): string {
  const target = value?.trim() || DEFAULT_SPREADSHEET_ID;
  const match = target.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match?.[1] ?? target;
}

function getPrivateKey(value: string | undefined): string {
  let privateKey = (value || DEFAULT_PRIVATE_KEY).trim();

  // Strip wrapping quotes if provided in env
  if ((privateKey.startsWith('"') && privateKey.endsWith('"')) ||
      (privateKey.startsWith("'") && privateKey.endsWith("'"))) {
    privateKey = privateKey.slice(1, -1);
  }

  privateKey = privateKey.replace(/\\n/g, '\n').trim();

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
      project_id: process.env.GOOGLE_PROJECT_ID || DEFAULT_PROJECT_ID,
      private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID || DEFAULT_PRIVATE_KEY_ID,
      private_key: getPrivateKey(process.env.GOOGLE_PRIVATE_KEY),
      client_email: process.env.GOOGLE_CLIENT_EMAIL || DEFAULT_CLIENT_EMAIL,
      client_id: process.env.GOOGLE_CLIENT_ID || DEFAULT_CLIENT_ID,
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
