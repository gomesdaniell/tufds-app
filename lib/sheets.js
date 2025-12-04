// lib/sheets.js
import { google } from 'googleapis';

export async function getSheetsClient(scopes = ['https://www.googleapis.com/auth/spreadsheets']) {
  const creds = JSON.parse(process.env.GOOGLE_CREDENTIALS);
  const auth = new google.auth.JWT(
    creds.client_email, null, creds.private_key, scopes
  );
  const sheets = google.sheets({ version: 'v4', auth });
  const drive = google.drive({ version: 'v3', auth });
  return { sheets, drive, spreadsheetId: process.env.SHEET_ID };
}

export async function readRange(range) {
  const { sheets, spreadsheetId } = await getSheetsClient(['https://www.googleapis.com/auth/spreadsheets.readonly']);
  const r = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  return r.data.values || [];
}

export async function writeRange(range, values, valueInputOption = 'USER_ENTERED') {
  const { sheets, spreadsheetId } = await getSheetsClient();
  return (await sheets.spreadsheets.values.update({
    spreadsheetId, range, valueInputOption, requestBody: { values }
  })).data;
}

export async function appendRows(range, values, valueInputOption = 'USER_ENTERED') {
  const { sheets, spreadsheetId } = await getSheetsClient();
  return (await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption,
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values }
  })).data;
}

// Garante que a aba exista; se não existir, cria com cabeçalho opcional
export async function ensureSheet(sheetTitle, headerRow = null) {
  const { sheets, spreadsheetId } = await getSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const exists = meta.data.sheets?.some(s => s.properties?.title === sheetTitle);

  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: sheetTitle } } }] }
    });
    if (headerRow && headerRow.length) {
      await writeRange(`${sheetTitle}!A1:${colLetter(headerRow.length)}1`, [headerRow]);
    }
  }
}

// util: número -> letra de coluna (1->A, 27->AA)
function colLetter(n) {
  let s = '';
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

