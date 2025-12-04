// /api/getCatalogoDoacoes.js
import { google } from 'googleapis';

const {
  GOOGLE_SERVICE_EMAIL,
  GOOGLE_PRIVATE_KEY,
  GOOGLE_SHEETS_ID,
  DOACOES_TAB
} = process.env;

function bad(res, code, message) {
  res.status(code).json({ error: 'DOACOES_CATALOGO_ERROR', message });
}

export default async function handler(req, res) {
  if (!GOOGLE_SERVICE_EMAIL || !GOOGLE_PRIVATE_KEY) {
    return bad(res, 400, 'Missing GOOGLE_SERVICE_EMAIL or GOOGLE_PRIVATE_KEY.');
  }
  if (!GOOGLE_SHEETS_ID) {
    return bad(res, 400, 'Missing GOOGLE_SHEETS_ID.');
  }

  try {
    const jwt = new google.auth.JWT({
      email: GOOGLE_SERVICE_EMAIL,
      key: GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth: jwt });

    const tab = DOACOES_TAB || 'Doacoes_Catalogo';
    const range = `${tab}!A:Z`;

    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId: GOOGLE_SHEETS_ID,
      range
    });

    const rows = data?.values || [];
    if (rows.length < 2) return res.status(200).json({ catalogo: [] });

    const header = rows[0].map(h => String(h || '').trim());

    const ix = (alts) => {
      const idx = header.findIndex(h =>
        alts.some(a => h.toLowerCase() === a.toLowerCase())
      );
      return idx;
    };

    const ixId    = ix(['id','código','codigo']);
    const ixCat   = ix(['categoria']);
    const ixDesc  = ix(['descrição','descricao','item','produto','nome']);
    const ixUnid  = ix(['unidade','unid']);
    const ixPreco = ix(['preço','preco','preco (r$)','preço (r$)','valor','valor sugerido']);

    const out = [];

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r] || [];

      const id   = ixId    >= 0 ? String(row[ixId]    || '').trim() : String(r);
      const cat  = ixCat   >= 0 ? String(row[ixCat]   || '').trim() : '';
      const desc = ixDesc  >= 0 ? String(row[ixDesc]  || '').trim() : '';
      const unid = ixUnid  >= 0 ? String(row[ixUnid]  || '').trim() : '';
      let preco  = ixPreco >= 0 ? row[ixPreco] : 0;

      // normaliza preço (aceita "12,34", "R$ 12,34", etc.)
      if (typeof preco === 'string') {
        preco = preco.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}\b)/g,'').replace(',', '.');
      }
      preco = Number(preco) || 0;

      if (!desc) continue;

      out.push({
        idItem: id,
        categoria: cat,
        descricao: desc,
        unidade: unid,
        valor: preco
      });
    }

    // ordenação padrão
    out.sort((a,b)=>{
      const c = (a.categoria||'').localeCompare(b.categoria||'', 'pt-BR');
      return c !== 0 ? c : a.descricao.localeCompare(b.descricao, 'pt-BR');
    });

    res.status(200).json({ catalogo: out });
  } catch (err) {
    console.error('DOACOES_CATALOGO_ERROR', err?.message || err);
    bad(res, 500, err?.message || 'Failed to load donations catalog.');
  }
}
