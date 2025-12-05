// /api/getDoacoesCatalogo.js
import { google } from 'googleapis';

const SHEET_NAME = 'Doacoes_Necessidades'; // aba do catálogo de doações

function getSheetId() {
  return process.env.GOOGLE_SHEETS_ID || process.env.SHEET_ID;
}

function getAuth() {
  const clientEmail = process.env.GOOGLE_SERVICE_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    throw new Error('Missing GOOGLE_PRIVATE_KEY or GOOGLE_SERVICE_EMAIL');
  }

  // quando a key vem pelo Vercel, as quebras de linha chegam como "\n"
  privateKey = privateKey.replace(/\\n/g, '\n');

  return new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
}

function norm(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

export default async function handler(req, res) {
  try {
    const spreadsheetId = getSheetId();
    if (!spreadsheetId) throw new Error('Missing GOOGLE_SHEETS_ID or SHEET_ID');

    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // A:G cobre todas as colunas mencionadas
    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${SHEET_NAME}!A:G`,
    });

    const rows = data.values || [];
    if (rows.length < 2) {
      return res.status(200).json({ catalogo: [] });
    }

    const header = rows[0];
    const map = {};
    header.forEach((h, i) => (map[norm(h)] = i));

    // índices seguros pelos nomes reais da sua aba
    const ixId     = map[norm('ID_ITEM')];
    const ixCat    = map[norm('CATEGORIA')];
    const ixDesc   = map[norm('DESCRICAO')];
    const ixQtdNec = map[norm('QTD_NECESSARIA')];
    const ixUnid   = map[norm('UNIDADE')];
    const ixPrazo  = map[norm('PRAZO')];
    const ixAtivo  = map[norm('ATIVO?')];

    const out = [];

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i] || [];

      // filtro ATIVO?
      const ativoVal = ixAtivo != null ? String(r[ixAtivo] || '').toUpperCase().trim() : 'SIM';
      const isAtivo = ['SIM', 'S', 'YES', 'TRUE', '1'].includes(ativoVal);
      if (!isAtivo) continue;

      const id    = ixId    != null ? String(r[ixId]    || '').trim() : '';
      const cat   = ixCat   != null ? String(r[ixCat]   || '').trim() : '';
      const desc  = ixDesc  != null ? String(r[ixDesc]  || '').trim() : '';
      const unid  = ixUnid  != null ? String(r[ixUnid]  || '').trim() : '';
      const prazo = ixPrazo != null ? String(r[ixPrazo] || '').trim() : '';

      let qtdNec = 0;
      if (ixQtdNec != null) {
        const raw = String(r[ixQtdNec] || '').replace(/\./g, '').replace(',', '.');
        const n = Number(raw);
        qtdNec = Number.isFinite(n) ? n : 0;
      }

      if (!desc) continue;

      out.push({
        idItem: id,
        descricao: desc,
        categoria: cat,
        unidade: unid,
        qtdNecessaria: qtdNec,
        prazo,
      });
    }

    // ordena por categoria, depois descrição
    out.sort((a, b) => {
      const c = (a.categoria || '').localeCompare(b.categoria || '', 'pt-BR');
      if (c !== 0) return c;
      return (a.descricao || '').localeCompare(b.descricao || '', 'pt-BR');
    });

    return res.status(200).json({ catalogo: out });
  } catch (err) {
    console.error('getDoacoesCatalogo error:', err);
    return res.status(500).json({ error: 'DOACOES_CATALOGO_FAILED', message: err.message });
  }
}

