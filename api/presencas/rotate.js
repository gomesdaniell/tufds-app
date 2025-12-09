// api/presencas/rotate.js
const { getDoc } = require('../_lib/sheets');

const ABA_CONFIG = 'Configurações';
const KEY_CODIGO = 'CODIGO_GIRA_ATUAL';
const KEY_TS     = 'CODIGO_GIRA_TS';

function gerarCodigo(n=6){
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s=''; for(let i=0;i<n;i++) s += chars.charAt(Math.floor(Math.random()*chars.length));
  return s;
}

module.exports = async (req, res) => {
  try {
    const doc = await getDoc();
    let shCfg = doc.sheetsByTitle[ABA_CONFIG];
    if (!shCfg) {
      shCfg = await doc.addSheet({ title: ABA_CONFIG, headerValues: ['Chave','Valor'] });
    } else {
      await shCfg.loadHeaderRow();
    }
    const rows = await shCfg.getRows();

    // procura linhas das chaves, cria se não existir
    const findRow = (key) => rows.find(r => String(r['Chave']||'').trim() === key);

    const codigo = gerarCodigo(6);
    const ts     = Date.now();

    let rCodigo = findRow(KEY_CODIGO);
    if (!rCodigo) rCodigo = await shCfg.addRow({ Chave: KEY_CODIGO, Valor: codigo }); else { rCodigo['Valor'] = codigo; await rCodigo.save(); }

    let rTs = findRow(KEY_TS);
    if (!rTs) rTs = await shCfg.addRow({ Chave: KEY_TS, Valor: ts }); else { rTs['Valor'] = ts; await rTs.save(); }

    res.status(200).json({ ok:true, codigo, ts });
  } catch (err) {
    res.status(500).json({ ok:false, message: err.message || String(err) });
  }
};
