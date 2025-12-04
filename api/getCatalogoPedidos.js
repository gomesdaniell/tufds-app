// api/getCatalogoPedidos.js
import { getSheets, SHEET_ID } from './_googleClient.js';
import { findColIndex, parseNumberBR } from './_utils.js';

const ABA_PRECOS_PEDIDOS = 'Preco_Velas';

export default async function handler(req, res) {
  try {
    if (!SHEET_ID) throw new Error('Missing GOOGLE_SHEETS_ID');

    const sheets = await getSheets();
    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${ABA_PRECOS_PEDIDOS}!A1:Z1000`,
    });

    const values = data.values || [];
    if (values.length < 2) return res.status(200).json({ catalogo: [] });

    const header = values[0];
    const rows = values.slice(1);

    const ixId    = findColIndex(header, ['id', 'código', 'codigo']);
    const ixCat   = findColIndex(header, ['categoria']);
    const ixDesc  = findColIndex(header, ['descrição', 'descricao', 'item', 'produto']);
    const ixPreco = findColIndex(header, ['preço', 'preco', 'preço (r$)', 'preco (r$)', 'valor']);
    const ixUnid  = findColIndex(header, ['unidade', 'unid']);
    const ixAtivo = findColIndex(header, ['ativo?', 'ativo']);

    const out = [];

    rows.forEach((row, i) => {
      const ativoRaw = ixAtivo >= 0 ? String(row[ixAtivo] || '').trim().toUpperCase() : 'SIM';
      if (!['SIM','S','YES','TRUE','1'].includes(ativoRaw)) return;

      const id    = ixId   >= 0 ? String(row[ixId]   || '').trim() : String(i + 1);
      const cat   = ixCat  >= 0 ? String(row[ixCat]  || '').trim() : '';
      const desc  = ixDesc >= 0 ? String(row[ixDesc] || '').trim() : '';
      const unid  = ixUnid >= 0 ? String(row[ixUnid] || '').trim() : '';
      let preco   = ixPreco>= 0 ? parseNumberBR(row[ixPreco]) : 0;

      if (!desc) return;

      out.push({ idItem: id, categoria: cat, descricao: desc, unidade: unid, preco });
    });

    // ordena por categoria + descrição
    out.sort((a,b) => {
      const c = (a.categoria||'').localeCompare(b.categoria||'', 'pt-BR');
      return c !== 0 ? c : a.descricao.localeCompare(b.descricao, 'pt-BR');
    });

    return res.status(200).json({ catalogo: out });
  } catch (err) {
    console.error('getCatalogoPedidos error:', err);
    return res.status(500).json({ error: 'CATALOGO_FAILED', message: err.message });
  }
}
