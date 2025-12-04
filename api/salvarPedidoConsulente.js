// api/salvarPedidoConsulente.js
import { getSheets, SHEET_ID, TZ } from './_googleClient.js';

const ABA_PEDIDOS_REGISTRO = 'Pedidos_Consulentes';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    if (!SHEET_ID) throw new Error('Missing GOOGLE_SHEETS_ID');

    const { nome, cpf, itens } = req.body || {};
    if (!nome || !cpf) throw new Error('Nome e CPF são obrigatórios.');
    if (!Array.isArray(itens) || itens.length === 0) throw new Error('Nenhum item no pedido.');

    const sheets = await getSheets();

    // Garante header (caso a aba não exista)
    try {
      await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: `${ABA_PEDIDOS_REGISTRO}!A1:J1`,
      });
    } catch {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SHEET_ID,
        requestBody: { requests: [{ addSheet: { properties: { title: ABA_PEDIDOS_REGISTRO } } }] }
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `${ABA_PEDIDOS_REGISTRO}!A1:J1`,
        valueInputOption: 'RAW',
        requestBody: { values: [[
          'Timestamp','Nome','CPF','ID Item','Descrição','Qtd','Unidade','Preço Unitário','Total Item','Status'
        ]]}
      });
    }

    const agora = new Date();
    let totalGeral = 0;
    const linhas = itens
      .filter(it => Number(it.qtd) > 0)
      .map(it => {
        const qtd   = Number(it.qtd || 0);
        const preco = Number(it.preco || 0);
        const total = +(qtd * preco).toFixed(2);
        totalGeral += total;
        return [
          agora, nome, cpf,
          it.idItem || '', it.descricao || '',
          qtd, it.unidade || '',
          preco, total,
          'PENDENTE'
        ];
      });

    if (!linhas.length) throw new Error('Nenhum item válido no pedido.');

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${ABA_PEDIDOS_REGISTRO}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: linhas }
    });

    return res.status(200).json({
      ok: true,
      msg: 'Pedido registrado com sucesso.',
      total: +totalGeral.toFixed(2),
      itens: linhas.length
    });
  } catch (err) {
    console.error('salvarPedidoConsulente error:', err);
    return res.status(500).json({ error: 'PEDIDO_FAILED', message: err.message });
  }
}
