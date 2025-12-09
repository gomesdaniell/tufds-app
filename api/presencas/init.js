// /api/presencas/init.js
import { google } from 'googleapis';

const PLANILHA_ID = process.env.SHEET_ID || '1a1Vu39CcTHtSGU9PUtuyRy76QqIpisM8LUn7Lq4qFx0';
const ABA_CADASTRO = 'Cadastro';

function normalizar(txt) {
  return String(txt || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

export default async function handler(req, res) {
  try {
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    let key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
    if (!email || !key) {
      return res.status(500).json({ ok:false, message:'Credenciais do Google ausentes' });
    }
    key = key.replace(/\\n/g, '\n');

    const auth = new google.auth.JWT(
      email,
      null,
      key,
      ['https://www.googleapis.com/auth/spreadsheets.readonly']
    );
    const sheets = google.sheets({ version: 'v4', auth });

    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId: PLANILHA_ID,
      range: `${ABA_CADASTRO}!A:Z`
    });

    const values = data.values || [];
    if (values.length < 2) return res.json({ ok:true, nomes:[] });

    const header = values[0].map(String);
    const normHeader = header.map(normalizar);

    const nomeIdx = normHeader.findIndex(h => h.includes('nome completo'));
    const ativoIdx = normHeader.findIndex(h => h.includes('ativo'));

    const nomes = values.slice(1)
      .map(r => [r[nomeIdx] || '', r[ativoIdx] || ''])
      .filter(([n]) => n)
      .filter(([n, a]) => {
        const st = normalizar(a);
        return !st || st === 'sim' || st === 'ativo' || st === 'ativo(a)';
      })
      .map(([n]) => String(n).trim())
      .filter((v, i, arr) => v && arr.indexOf(v) === i)
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));

    return res.json({ ok:true, nomes });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok:false, message:err.message || String(err) });
  }
}
