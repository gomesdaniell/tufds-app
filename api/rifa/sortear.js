// api/rifa/sortear.js
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
    if (!SHEET_ID || !SA_EMAIL || !SA_KEY) {
      return res.status(500).json({ ok:false, message:'Credenciais/Sheet ausentes.' });
    }
    const sheets = sheetsClient();

    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Rifa!A2:C',
    });

    const rows = resp.data.values || [];
    const itens = rows
      .filter(r => r[0])
      .map(r => ({ numero:Number(r[0]), nome:(r[1]||'').trim() || null }));

    if (itens.length === 0) {
      return res.status(400).json({ ok:false, message:'Rifa vazia.' });
    }

    const livres   = itens.filter(i=>!i.nome);
    const vendidos = itens.filter(i=>i.nome);

    if (livres.length > 0) {
      return res.status(400).json({ ok:false, message:'Ainda há números livres. Venda todos para sortear.' });
    }
    if (vendidos.length === 0) {
      return res.status(400).json({ ok:false, message:'Nenhum número vendido.' });
    }

    const ix = Math.floor(Math.random()*vendidos.length);
    const vencedor = vendidos[ix];

    res.json({ ok:true, vencedor });
  } catch (e) {
    res.status(500).json({ ok:false, message:e.message });
  }
}
