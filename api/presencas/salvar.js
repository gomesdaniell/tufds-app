// /api/presencas/salvar.js
import { appendPresenca, getCodigoAtual } from '../_lib/sheets.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ ok:false, message:'Method not allowed' });
    const { nome, codigo, observacao } = req.body || {};
    if (!nome)   return res.status(400).json({ ok:false, message:'Selecione o nome.' });
    if (!codigo) return res.status(400).json({ ok:false, message:'Informe o código.' });

    const st = await getCodigoAtual();
    if (!st.codigo) return res.status(400).json({ ok:false, message:'Nenhum código ativo. Aguarde iniciar.' });
    if (String(codigo).trim().toUpperCase() !== String(st.codigo).trim().toUpperCase()) {
      return res.status(400).json({ ok:false, message:'Código incorreto.' });
    }

    await appendPresenca({ nome, codigo: String(codigo).trim().toUpperCase(), observacao: String(observacao||'').trim() });
    res.json({ ok:true, message:'Presença registrada.' });
  } catch (e) {
    res.status(500).json({ ok:false, message: e.message || String(e) });
  }
}
