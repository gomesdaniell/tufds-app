// api/finance/init.js
import { google } from 'googleapis';

const SHEET_ID_FIN = process.env.SHEET_ID_FIN;
const SA_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const SA_KEY = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

const TAB_CATEGORIAS = 'Categorias';
const TAB_CADASTRO = 'Cadastro';
const TZ = 'America/Manaus';

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
  try {
    const sheets = await getSheetsClient();

    // --- CATEGORIAS (coluna A)
    const catResp = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID_FIN,
      range: `${TAB_CATEGORIAS}!A:A`,
    });
    let categorias = (catResp.data.values || [])
      .map(r => String(r[0] || '').trim())
      .filter((v, i, a) => v && i > 0 && a.indexOf(v) === i);

    if (!categorias.length)
      categorias = ['Mensalidades','Doações','Eventos','Material Ritualístico','Serviços','Manutenção','Outros'];

    // --- NOMES (somente Ativo)
    const cadResp = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID_FIN,
      range: `${TAB_CADASTRO}!A:Z`,
    });
    const data = cadResp.data.values || [];
    const header = (data[0] || []).map(h => h.toLowerCase());
    const iNome = header.findIndex(h => h.includes('nome completo'));
    const iAtivo = header.findIndex(h => h.includes('ativo'));
    const nomes = data.slice(1)
      .filter(r => (r[iAtivo] || '').toLowerCase().includes('sim'))
      .map(r => String(r[iNome] || '').trim())
      .filter(Boolean)
      .sort((a,b)=>a.localeCompare(b,'pt-BR'));

    const hojeISO = new Date().toLocaleDateString('sv-SE', { timeZone: TZ });

    res.status(200).json({ ok:true, categorias, nomes, hojeISO });
  } catch (err) {
    console.error('Erro init fin:', err);
    res.status(500).json({ ok:false, message: err.message });
  }
}
