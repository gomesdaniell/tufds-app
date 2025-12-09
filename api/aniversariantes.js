// api/aniversariantes.js
import { google } from 'googleapis';

const SHEET_ID = '1a1Vu39CcTHtSGU9PUtuyRy76QqIpisM8LUn7Lq4qFx0';
const RANGE = 'Cadastro!A:Z'; // ajuste se sua aba tiver mais colunas
const TIMEZONE = 'America/Manaus';

export default async function handler(req, res) {
  try {
    const mesParam = Number(req.query.mes || 0);
    const hoje = new Date();
    const mesAtual = hoje.getMonth() + 1;
    const mesAlvo = mesParam >= 1 && mesParam <= 12 ? mesParam : mesAtual;

    // autenticação do Google Sheets (usando variáveis do Vercel)
    const auth = new google.auth.GoogleAuth({
      credentials: {
        type: 'service_account',
        project_id: process.env.GOOGLE_PROJECT_ID,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: RANGE,
    });

    const rows = resp.data.values || [];
    if (rows.length < 2)
      return res.status(200).json({ mesNumero: mesAlvo, mesNome: getMesNomePt(mesAlvo), aniversariantes: [] });

    const header = rows[0].map(h => h.trim().toLowerCase());
    const iNome = header.findIndex(h => h.includes('nome'));
    const iNasc = header.findIndex(h => h.includes('nascimento'));
    const iAtivo = header.findIndex(h => h.includes('ativo'));

    const lista = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row[iNome] || !row[iNasc]) continue;

      const ativo = iAtivo >= 0 ? String(row[iAtivo] || '').toLowerCase() : 'sim';
      if (ativo && !['sim', 'ativo', ''].includes(ativo)) continue;

      let dt;
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(row[iNasc])) {
        const [d, m, y] = row[iNasc].split('/').map(Number);
        dt = new Date(y, m - 1, d);
      }

      if (!dt || isNaN(dt)) continue;
      if (dt.getMonth() + 1 !== mesAlvo) continue;

      const dia = dt.getDate();
      const data = dt.toLocaleDateString('pt-BR', { timeZone: TIMEZONE }).slice(0, 5);

      lista.push({ nome: row[iNome], data, dia });
    }

    lista.sort((a, b) => a.dia - b.dia || a.nome.localeCompare(b.nome, 'pt-BR'));
    res.status(200).json({ mesNumero: mesAlvo, mesNome: getMesNomePt(mesAlvo), aniversariantes: lista });
  } catch (err) {
    console.error('Erro API aniversariantes', err);
    res.status(500).json({ error: 'Erro ao buscar aniversariantes.' });
  }
}

function getMesNomePt(n) {
  const nomes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  return nomes[n - 1] || '';
}
