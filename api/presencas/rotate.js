// /api/presencas/rotate.js
import { setCodigoAtual, gerarCodigo } from '../_lib/sheets.js';

export default async function handler(_req, res){
  try{
    const novo = gerarCodigo(6);
    const st = await setCodigoAtual(novo);
    res.json({ ok:true, ...st });
  }catch(e){
    res.status(500).json({ ok:false, message: e.message || String(e) });
  }
}
