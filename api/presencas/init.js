// api/presencas/init.js
const { getDoc } = require('../_lib/sheets');

const ABA_CADASTRO = 'Cadastro';
const ABA_CONFIG   = 'Configurações';         // onde guarda CODIGO_GIRA_ATUAL e CODIGO_GIRA_TS
const KEY_CODIGO   = 'CODIGO_GIRA_ATUAL';
const KEY_TS       = 'CODIGO_GIRA_TS';

function norm(s){ return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim(); }

module.exports = async (req, res) => {
  try {
    const doc = await getDoc();

    // Cadastro
    const shCad = doc.sheetsByTitle[ABA_CADASTRO];
    if (!shCad) throw new Error(`Aba não encontrada: ${ABA_CADASTRO}`);
    await shCad.loadHeaderRow();
    const H = shCad.headerValues.map(h=>String(h||'').trim());

    const iNome  = H.findIndex(h => /nome completo/i.test(h));
    const iAtivo = H.findIndex(h => /ativo|\bstatus\b|situa[cç][aã]o/i.test(h));
    if (iNome < 0)  throw new Error('Coluna de Nome não encontrada na aba Cadastro');
    if (iAtivo < 0) throw new Error('Coluna de Ativo/Status não encontrada na aba Cadastro');

    const rows = await shCad.getRows();
    const nomes = rows
      .map(r => [String(r._rawData[iNome]||'').trim(), String(r._rawData[iAtivo]||'').trim().toLowerCase()])
      .filter(([n,st]) => n && ['sim','ativo','ativo(a)'].includes(st))
      .map(([n]) => n)
      .filter((v,i,a)=>v && a.indexOf(v)===i)
      .sort((a,b)=>a.localeCompare(b,'pt-BR'));

    // Configurações (código atual)
    const shCfg = doc.sheetsByTitle[ABA_CONFIG];
    let codigoAtual = '';
    let codigoTs = 0;

    if (shCfg) {
      await shCfg.loadCells({ startRowIndex: 0, endRowIndex: shCfg.rowCount, startColumnIndex: 0, endColumnIndex: shCfg.columnCount });
      // formato esperado: chave na Col A, valor na Col B
      for (let r = 1; r < shCfg.rowCount; r++) {
        const key = String(shCfg.getCell(r, 0).value || '').trim();
        if (!key) continue;
        const val = String(shCfg.getCell(r, 1).value || '').trim();
        if (key === KEY_CODIGO) codigoAtual = val;
        if (key === KEY_TS)     codigoTs    = Number(val || 0);
      }
    }

    res.status(200).json({ ok: true, nomes, codigoAtual, codigoTs });
  } catch (err) {
    res.status(500).json({ ok:false, message: err.message || String(err) });
  }
};
