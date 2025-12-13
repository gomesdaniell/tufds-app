// api/rifa/configurar.js
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
    const { total } = req.body || {};
    const N = Number(total || 0);
    if (!N || N < 1) return res.status(400).json({ ok:false, message:'Total inválido.' });

    if (!SHEET_ID || !SA_EMAIL || !SA_KEY) {
      return res.status(500).json({ ok:false, message:'Credenciais/Sheet ausentes.' });
    }

    const sheets = sheetsClient();

    // cabeçalho
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: 'Rifa!A1:C1',
      valueInputOption: 'RAW',
      requestBody: { values: [['Numero','Nome','DataHora']] }
    });

    // monta linhas 1..N, limpando nome/data
    const values = Array.from({length:N}, (_,i)=>[i+1,'','']);
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `Rifa!A2:C${N+1}`,
      valueInputOption: 'RAW',
      requestBody: { values }
    });

    // limpa qualquer sobra abaixo
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SHEET_ID,
      range: `Rifa!A${N+2}:C10000`
    });

    res.json({ ok:true, total:N });
  } catch (e) {
    res.status(500).json({ ok:false, message:e.message });
  }
}
