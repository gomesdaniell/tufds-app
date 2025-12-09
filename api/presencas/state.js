// /api/presencas/state.js
import { getCodigoAtual } from '../_lib/sheets.js';

export default async function handler(req, res) {
  try {
    const st = await getCodigoAtual();
    res.json({ ok:true, codigo: st.codigo || '', ts: st.ts || 0 });
  } catch (e) {
    res.status(500).json({ ok:false, message: e.message || String(e) });
  }
}
