// api/rifa/comprar.js
import { google } from 'googleapis';

const SHEET_ID = process.env.SHEET_ID;
const SA_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const SA_KEY   = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

function sheetsClient() {
  const auth = new google.auth.JWT({
    email: SA_EMAIL,
    key: SA_KEY,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok:false, message:'Method Not Allowed' });
  }
  try {
    const { numero, nome } = req.body || {};
    const n = Number(numero || 0);
    const buyer = String(nome || '').trim();
    if (!n || !buyer) return res.status(400).json({ ok:false, message:'Dados inválidos.' });

    if (!SHEET_ID || !SA_EMAIL || !SA_KEY) {
      return res.status(500).json({ ok:false, message:'Credenciais/Sheet ausentes.' });
    }

    const sheets = sheetsClient();

    // Lê linha do número n => A(n+1) é o número (pois header é linha 1)
    const rowIndex = n + 1;
    const read = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `Rifa!A${rowIndex}:C${rowIndex}`,
    });
    const row = read.data.values?.[0] || [];
    const exists = Number(row?.[0]) === n;
    if (!exists) return res.status(400).json({ ok:false, message:'Número inexistente.' });
    const jaTem = (row?.[1] || '').trim();
    if (jaTem) return res.status(400).json({ ok:false, message:'Número já vendido.' });

    const carimbo = new Date().toISOString();

    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `Rifa!B${rowIndex}:C${rowIndex}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[buyer, carimbo]] }
    });

    res.json({ ok:true });
  } catch (e) {
    res.status(500).json({ ok:false, message:e.message });
  }
}
