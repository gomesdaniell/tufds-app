// api/auth/login.js  (ESM)
import { google } from 'googleapis';
import crypto from 'crypto';

const SHEET_ID = process.env.SHEET_ID;                    // mesmo ID usado no reset.js
const SA_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const SA_KEY   = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

const TAB = 'Cadastro'; // aba
const COL_EMAIL = 'F';  // Coluna F = e-mail
const COL_HASH  = 'AC'; // Coluna AC = SENHA_HASH

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
    // aceita tanto req.json() (edge) quanto req.body (node)
    const { email, senha } = (await req.json?.()) || req.body || {};
    const e = String(email || '').trim().toLowerCase();
    const p = String(senha || '');

    if (!e || !p) {
      res.status(400).json({ ok: false, message: 'E-mail e senha são obrigatórios.' });
      return;
    }
    if (!SHEET_ID || !SA_EMAIL || !SA_KEY) {
      res.status(500).json({ ok: false, message: 'Credenciais do Google ausentes.' });
      return;
    }

    const sheets = await getSheetsClient();

    // 1) Ler a coluna de e-mails (F)
    const emailsResp = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${TAB}!${COL_EMAIL}:${COL_EMAIL}`,
      majorDimension: 'COLUMNS',
    });

    const col = emailsResp.data.values?.[0] || [];
    // col[0] cabeçalho; dados começam na linha 2
    let rowIndex = -1;
    for (let i = 1; i < col.length; i++) {
      const val = String(col[i] || '').trim().toLowerCase();
      if (val === e) { rowIndex = i + 1; break; } // +1 para índice 1-based da planilha
    }

    if (rowIndex < 2) {
      res.status(404).json({ ok: false, message: 'E-mail não encontrado.' });
      return;
    }

    // 2) Ler o hash na AC{linha}
    const hashResp = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${TAB}!${COL_HASH}${rowIndex}:${COL_HASH}${rowIndex}`,
    });
    const hashPlanilha = String(hashResp.data.values?.[0]?.[0] || '').trim();
    if (!hashPlanilha) {
      res.status(400).json({ ok: false, message: 'Usuário sem senha cadastrada.' });
      return;
    }

    // 3) Comparar o hash
    const hashDigitado = sha256(p);
    if (hashDigitado !== hashPlanilha) {
      res.status(401).json({ ok: false, message: 'Senha incorreta.' });
      return;
    }

    // 4) OK
    res.status(200).json({ ok: true, message: 'Autenticado com sucesso.' });
  } catch (err) {
    console.error('Erro no login:', err);
    res.status(500).json({ ok: false, message: err?.message || String(err) });
  }
}
