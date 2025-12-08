// lib/sheets.js
import { google } from 'googleapis';

/** Lê credenciais do ambiente (suporta 2 jeitos) e normaliza a private_key */
function getCreds() {
  const json = process.env.GOOGLE_CREDENTIALS;
  if (json && json.trim()) {
    // Pode vir com \n escapado; normalizamos depois da leitura
    const parsed = JSON.parse(json);
    parsed.private_key = String(parsed.private_key || '').replace(/\\n/g, '\n');
    return {
      client_email: parsed.client_email,
      private_key: parsed.private_key,
    };
  }

  // Fallback: variáveis separadas
  const client_email = process.env.GOOGLE_CLIENT_EMAIL;
  let private_key = process.env.GOOGLE_PRIVATE_KEY;
  if (!client_email || !private_key) {
    throw new Error(
      'Credenciais ausentes. Configure GOOGLE_CREDENTIALS (JSON) ou GOOGLE_CLIENT_EMAIL/GOOGLE_PRIVATE_KEY.'
    );
  }
  private_key = private_key.replace(/\\n/g, '\n');

  return { client_email, private_key };
}

/** Cria cliente JWT e services do Google */
async function getSheetsClient(scopes = ['https://www.googleapis.com/auth/spreadsheets']) {
  const { client_email, private_key } = getCreds();

  const auth = new google.auth.JWT({
    email: client_email,
    key: private_key,
    scopes,
  });

  // token endpoint correto (evita libs antigas usarem URL velha)
  auth.gtoken.opts.tokenUrl = 'https://oauth2.googleapis.com/token';

  // força o handshake já aqui (ajuda a diagnosticar invalid_grant cedo)
  await auth.authorize();

  const sheets = google.sheets({ version: 'v4', auth });
  const drive = google.drive({ version: 'v3', auth });

  // aceita SHEETS_SPREADSHEET_ID ou SHEET_ID
  const spreadsheetId =
    process.env.SHEETS_SPREADSHEET_ID || process.env.SHEET_ID;

  if (!spreadsheetId) {
    throw new Error('SHEETS_SPREADSHEET_ID (ou SHEET_ID) não configurado.');
  }

  return { sheets, drive, spreadsheetId };
}

/** ==== Funções utilitárias de acesso ==== */

export async function readRange(range) {
  const { sheets, spreadsheetId } = await getSheetsClient([
    'https://www.googleapis.com/auth/spreadsheets.readonly',
  ]);
  const r = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING',
    majorDimension: 'ROWS',
  });
  return r.data.values || [];
}

export async function writeRange(
  range,
  values,
  valueInputOption = 'USER_ENTERED'
) {
  const { sheets, spreadsheetId } = await getSheetsClient();
  const r = await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption,
    requestBody: { values },
  });
  return r.data;
}

export async function appendRows(
  range,
  values,
  valueInputOption = 'USER_ENTERED'
) {
  const { sheets, spreadsheetId } = await getSheetsClient();
  const r = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption,
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values },
  });
  return r.data;
}

/** Garante que a aba exista; se não existir, cria com cabeçalho opcional */
export async function ensureSheet(sheetTitle, headerRow = null) {
  const { sheets, spreadsheetId } = await getSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const exists = meta.data.sheets?.some(
    (s) => s.properties?.title === sheetTitle
  );

  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: sheetTitle } } }] },
    });
    if (headerRow && headerRow.length) {
      await writeRange(
        `${sheetTitle}!A1:${colLetter(headerRow.length)}1`,
        [headerRow]
      );
    }
  }
}

// util: número -> letra de coluna (1->A, 27->AA)
function colLetter(n) {
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
