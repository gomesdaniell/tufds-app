// api/rifa/init.js
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
  try {
    if (!SHEET_ID || !SA_EMAIL || !SA_KEY) {
      return res.status(500).json({ ok:false, message:'Credenciais/Sheet ausentes.' });
    }
    const sheets = sheetsClient();

    // Garante a aba e o header
    try {
      await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: 'Rifa!A1:C1',
      });
    } catch {
      // cria cabeçalho
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: 'Rifa!A1:C1',
        valueInputOption: 'RAW',
        requestBody: { values: [['Numero','Nome','DataHora']] }
      });
    }

    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Rifa!A2:C',
    });

    const rows = resp.data.values || [];
    const itens = rows
      .filter(r => r[0])
      .map(r => ({
        numero: Number(r[0]),
        nome: (r[1] || '').trim() || null,
      }))
      .sort((a,b)=>a.numero-b.numero);

    res.json({
      ok: true,
      total: itens.length,
      itens
    });
  } catch (e) {
    res.status(500).json({ ok:false, message:e.message });
  }
}
