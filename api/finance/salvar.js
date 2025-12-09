// api/finance/salvar.js
import { google } from 'googleapis';

const SHEET_ID_FIN = process.env.SHEET_ID_FIN;
const SA_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const SA_KEY = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
const TAB_LANC = 'Lançamentos';
const TZ = 'America/Manaus';

function parseValor(str) {
  if (!str) return 0;
  return Number(String(str).replace(/\./g, '').replace(',', '.')) || 0;
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
  if (req.method !== 'POST')
    return res.status(405).json({ ok:false, message:'Método inválido' });

  try {
    const payload = (await req.json?.()) || req.body || {};
    const { dataMovimento, tipo, categoria, descricao, valor, nomeAssociado, formaPagamento } = payload;

    if (!dataMovimento || !tipo || !categoria || !descricao)
      throw new Error('Campos obrigatórios ausentes.');
    const valorNum = parseValor(valor);
    if (valorNum <= 0) throw new Error('Informe um valor válido (> 0).');

    const sheets = await getSheetsClient();

    const dt = new Date(`${dataMovimento}T00:00:00-04:00`);
    const carimbo = new Date().toLocaleString('pt-BR', { timeZone: TZ });
    const mesRef = dt.toLocaleDateString('pt-BR', { month:'2-digit', timeZone:TZ });
    const anoRef = dt.getFullYear();
    const mesNum = dt.getMonth() + 1;
    const sinal = tipo.toLowerCase() === 'receita' ? 1 : -1;
    const valorAssinado = valorNum * sinal;

    const row = [
      carimbo,
      dt.toLocaleDateString('pt-BR', { timeZone: TZ }),
      mesRef,
      anoRef,
      tipo,
      categoria,
      descricao,
      valorNum,
      nomeAssociado || '',
      formaPagamento || '',
      anoRef,
      mesNum,
      sinal,
      valorAssinado,
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID_FIN,
      range: `${TAB_LANC}!A:N`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [row] },
    });

    res.status(200).json({ ok:true, msg:'Lançamento registrado com sucesso!' });
  } catch (err) {
    console.error('Erro salvar fin:', err);
    res.status(500).json({ ok:false, message: err.message });
  }
}
