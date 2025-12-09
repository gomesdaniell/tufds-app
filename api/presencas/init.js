// /api/presencas/init.js
import { getCadastroAtivos, getCodigoAtual } from '../_lib/sheets.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') return res.status(405).json({ ok:false, message:'Method not allowed' });
    const [nomes, st] = await Promise.all([ getCadastroAtivos(), getCodigoAtual() ]);
    res.json({ ok:true, nomes, codigoAtual: st.codigo || '', codigoTs: st.ts || 0 });
  } catch (e) {
    res.status(500).json({ ok:false, message: e.message || String(e) });
  }
}
