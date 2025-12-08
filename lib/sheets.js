// lib/sheets.js
import { google } from 'googleapis';

function loadGoogleCreds() {
  // Opção A: JSON inteiro em GOOGLE_CREDENTIALS
  if (process.env.GOOGLE_CREDENTIALS) {
    let json;
    try {
      json = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    } catch (e) {
      throw new Error('GOOGLE_CREDENTIALS não é um JSON válido.');
    }
    const client_email = json.client_email;
    let private_key = json.private_key;

    if (!client_email) throw new Error('GOOGLE_CREDENTIALS.client_email ausente.');
    if (!private_key) throw new Error('GOOGLE_CREDENTIALS.private_key ausente.');

    // substitui \n literais por quebras reais
    private_key = private_key.replace(/\\n/g, '\n');
    return { client_email, private_key };
  }

  // Opção B: variáveis separadas
  const client_email = process.env.GOOGLE_CLIENT_EMAIL;
  let private_key = process.env.GOOGLE_PRIVATE_KEY;

  if (!client_email) throw new Error('GOOGLE_CLIENT_EMAIL não definida.');
  if (!private_key) throw new Error('GOOGLE_PRIVATE_KEY não definida.');

  private_key = private_key.replace(/\\n/g, '\n');
  return { client_email, private_key };
}

export async function getSheetsClient(
  scopes = ['https://www.googleapis.com/auth/spreadsheets']
) {
  if (!Array.isArray(scopes) || scopes.length === 0) {
    throw new Error('Scopes inválidos ao criar o JWT.');
  }

  const { client_email, private_key } = loadGoogleCreds();

  // Forma moderna de instanciar o JWT
  const auth = new google.auth.JWT({
    email: client_email,
    key: private_key,
    scopes,
  });

  // Tenta autorizar já aqui para explanar erros como invalid_grant, etc.
  await auth.authorize();

  const sheets = google.sheets({ version: 'v4', auth });
  const drive  = google.drive({ version: 'v3', auth });

  const spreadsheetId =
    process.env.SHEETS_SPREADSHEET_ID || process.env.SHEET_ID;

  if (!spreadsheetId) {
    throw new Error('Defina SHEETS_SPREADSHEET_ID (ou SHEET_ID) com o ID da planilha.');
  }

  return { sheets, drive, spreadsheetId };
}

export async function readRange(range) {
  const { sheets, spreadsheetId } = await getSheetsClient([
    'https://www.googleapis.com/auth/spreadsheets.readonly',
  ]);
  const r = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  return r.data.values || [];
}

export async function writeRange(range, values, valueInputOption = 'USER_ENTERED') {
  const { sheets, spreadsheetId } = await getSheetsClient();
  return (
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption,
      requestBody: { values },
    })
  ).data;
}

export async function appendRows(range, values, valueInputOption = 'USER_ENTERED') {
  const { sheets, spreadsheetId } = await getSheetsClient();
  return (
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption,
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values },
    })
  ).data;
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
