// api/auth/reset.js  (ESM)
import { google } from 'googleapis';
import crypto from 'crypto';

const SHEET_ID = process.env.SHEET_ID;                    // ID da planilha
const SA_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const SA_KEY   = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

const TAB = 'Cadastro';           // nome da aba
const COL_EMAIL = 'F';            // Coluna F = e-mail
const COL_HASH  = 'AC';           // Coluna AC = SENHA_HASH

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

async function getSheetsClient() {
  const auth = new google.auth.JWT({
    email: SA_EMAIL,
    key: SA_KEY,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  await auth.authorize();
  return google.sheets({ version: 'v4', auth });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, message: 'Method Not Allowed' });
    return;
  }

  try {
    const { email, novaSenha } = await req.json?.() || req.body || {};
    const e = String(email || '').trim().toLowerCase();
    const pass = String(novaSenha || '');

    if (!e || !pass) {
      res.status(400).json({ ok: false, message: 'E-mail e nova senha são obrigatórios.' });
      return;
    }
    if (!SHEET_ID || !SA_EMAIL || !SA_KEY) {
      res.status(500).json({ ok: false, message: 'Credenciais do Google ausentes.' });
      return;
    }

    const sheets = await getSheetsClient();

    // 1) Ler coluna F (e-mails) inteira
    const emailsResp = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${TAB}!${COL_EMAIL}:${COL_EMAIL}`,
      majorDimension: 'COLUMNS',
    });

    const col = emailsResp.data.values?.[0] || [];
    // col[0] é o cabeçalho; dados começam na linha 2
    let rowIndex = -1;
    for (let i = 1; i < col.length; i++) {
      const val = String(col[i] || '').trim().toLowerCase();
      if (val === e) {
        rowIndex = i + 1; // corrigir para 1-based da planilha
        break;
      }
    }

    if (rowIndex < 2) {
      res.status(404).json({ ok: false, message: 'E-mail não encontrado.' });
      return;
    }

    // 2) Gerar hash e gravar em AC{linha}
    const hash = sha256(pass);
    const writeRange = `${TAB}!${COL_HASH}${rowIndex}:${COL_HASH}${rowIndex}`;
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: writeRange,
      valueInputOption: 'RAW',
      requestBody: { values: [[hash]] },
    });

    res.status(200).json({ ok: true, row: rowIndex });
  } catch (err) {
    res.status(500).json({ ok: false, message: err?.message || String(err) });
  }
}
