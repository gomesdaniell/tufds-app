// /api/salvarDoacaoCompromisso.js
import { google } from 'googleapis';

const SHEET_NAME = 'Doacoes_Compromisso'; // aba de destino

function getSheetId() {
  // usa GOOGLE_SHEETS_ID se existir; senão SHEET_ID (fallback)
  return process.env.GOOGLE_SHEETS_ID || process.env.SHEET_ID;
}

function getAuth() {
  const clientEmail = process.env.GOOGLE_SERVICE_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    throw new Error('Missing GOOGLE_PRIVATE_KEY or GOOGLE_SERVICE_EMAIL');
  }
  // corrige \n
  privateKey = privateKey.replace(/\\n/g, '\n');

  return new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { nome, contato, itens } = req.body || {};
    if (!nome || !contato || !Array.isArray(itens) || !itens.length) {
      return res.status(400).json({ error: 'Parâmetros inválidos' });
    }

    const spreadsheetId = getSheetId();
    if (!spreadsheetId) {
      return res.status(500).json({ error: 'Missing GOOGLE_SHEETS_ID (ou SHEET_ID)' });
    }

    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    const timestamp = new Date().toISOString();
    const values = itens.map(it => ([
      timestamp,              // TIMESTAMP
      nome,                   // NOME
      contato,                // CONTATO
      String(it.idItem || ''),// ID_ITEM
      String(it.descricao || ''), // DESCRICAO_ITEM
      Number(it.qtd || 0),    // QTD_COMPROMETIDA
      'PENDENTE'              // STATUS
    ]));

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${SHEET_NAME}!A:G`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values },
    });

    return res.status(200).json({ ok: true, rows: values.length });
  } catch (err) {
    console.error('salvarDoacaoCompromisso error:', err?.message || err);
    const msg = err?.response?.data?.error?.message || err?.message || 'Erro interno';
    return res.status(500).json({ error: msg });
  }
}
