// /api/getDoacoesCatalogo.js
import { google } from 'googleapis';

const SHEET_NAME = 'Doacoes_Necessidades'; // aba correta com o catálogo de doações

function getSheetId() {
  return process.env.GOOGLE_SHEETS_ID || process.env.SHEET_ID;
}

function getAuth() {
  const clientEmail = process.env.GOOGLE_SERVICE_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    throw new Error('Missing GOOGLE_PRIVATE_KEY or GOOGLE_SERVICE_EMAIL');
  }

  privateKey = privateKey.replace(/\\n/g, '\n');

  return new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
}

export default async function handler(req, res) {
  try {
    const spreadsheetId = getSheetId();
    if (!spreadsheetId) {
      throw new Error('Missing GOOGLE_SHEETS_ID or SHEET_ID');
    }

    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${SHEET_NAME}!A:D`, // ajuste conforme as colunas que existem
    });

    const rows = response.data.values || [];
    if (rows.length < 2) {
      return res.status(200).json({ catalogo: [] });
    }

    // supondo cabeçalho: ID_ITEM | DESCRICAO | CATEGORIA | UNIDADE (exemplo)
    const headers = rows[0].map(h => h.trim());
    const data = rows.slice(1).map(r => {
      const obj = {};
      headers.forEach((key, i) => obj[key] = r[i] || '');
      return {
        idItem: obj.ID_ITEM || obj.Id || obj.id || '',
        descricao: obj.DESCRICAO || obj.Descricao || '',
        categoria: obj.CATEGORIA || obj.Categoria || '',
        unidade: obj.UNIDADE || obj.Unidade || '',
      };
    });

    res.status(200).json({ catalogo: data });
  } catch (err) {
    console.error('getDoacoesCatalogo error:', err.message);
    res.status(500).json({ error: err.message });
  }
}
