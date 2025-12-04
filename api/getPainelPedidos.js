// api/getPainelPedidos.js
import { getSheets, SHEET_ID, TZ } from './_googleClient.js';
import { formatDatePtBr } from './_utils.js';

const ABA_PEDIDOS_REGISTRO = 'Pedidos_Consulentes';

export default async function handler(req, res) {
  try {
    if (!SHEET_ID) throw new Error('Missing GOOGLE_SHEETS_ID');

    const sheets = await getSheets();
    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${ABA_PEDIDOS_REGISTRO}!A2:J`,
    });

    const rows = data.values || [];
    const pedidos = rows.map(l => {
      const ts = l[0] ? new Date(l[0]) : null;
      return {
        timestamp: ts ? formatDatePtBr(ts, TZ) : '',
        nome: l[1] || '',
        cpf: l[2] || '',
        idItem: l[3] || '',
        descricao: l[4] || '',
        qtd: l[5] || '',
        unidade: l[6] || '',
        preco: Number(l[7] || 0),
        totalItem: Number(l[8] || 0),
        status: l[9] || 'PENDENTE'
      };
    });

    return res.status(200).json({ pedidos });
  } catch (err) {
    console.error('getPainelPedidos error:', err);
    return res.status(500).json({ error: 'PAINEL_FAILED', message: err.message });
  }
}
