// /api/auth/redefinir.js
import { google } from 'googleapis';

const {
  GOOGLE_SERVICE_ACCOUNT_EMAIL,
  GOOGLE_PRIVATE_KEY,
  PLANILHA_ID,
  ABA_CADASTRO = 'Cadastro'
} = process.env;

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST')
      return res.status(405).json({ ok:false, message:'Method not allowed' });

    const { email, nova } = req.body || {};
    if (!email || !nova)
      return res.status(400).json({ ok:false, message:'E-mail e nova senha são obrigatórios' });

    const auth = new google.auth.JWT(
      GOOGLE_SERVICE_ACCOUNT_EMAIL,
      null,
      GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      ['https://www.googleapis.com/auth/spreadsheets']
    );
    const sheets = google.sheets({ version:'v4', auth });

    // Lê a planilha completa
    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId: PLANILHA_ID,
      range: `${ABA_CADASTRO}!A:Z`
    });
    const values = data.values || [];
    if (values.length < 2)
      return res.status(404).json({ ok:false, message:'Base vazia' });

    const header = values[0].map(h => String(h).trim().toLowerCase());
    const idxEmail = header.findIndex(h => h.includes('email'));
    const idxSenha = header.findIndex(h => h.includes('senha'));

    if (idxEmail < 0 || idxSenha < 0)
      return res.status(400).json({ ok:false, message:'Colunas de e-mail/senha não encontradas' });

    const row = values.findIndex((r,i)=> i>0 && String(r[idxEmail]||'').trim().toLowerCase() === email.toLowerCase());
    if (row < 0)
      return res.status(404).json({ ok:false, message:'E-mail não encontrado no cadastro' });

    // Atualiza a senha na linha correspondente (row começa em 0; somar 1)
    await sheets.spreadsheets.values.update({
      spreadsheetId: PLANILHA_ID,
      range: `${ABA_CADASTRO}!${String.fromCharCode(65+idxSenha)}${row+1}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[nova]] }
    });

    return res.status(200).json({ ok:true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok:false, message:e.message || 'Erro ao redefinir senha' });
  }
}
