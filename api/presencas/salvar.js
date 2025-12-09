// api/presencas/salvar.js
const { getDoc } = require('../_lib/sheets');

const ABA_PRESENCAS = 'Presencas';
const ABA_CONFIG    = 'Configurações';
const KEY_CODIGO    = 'CODIGO_GIRA_ATUAL';
const TZ            = process.env.TZ_MANAUS || 'America/Manaus';

function fmtDateBR(d){
  const pad = n => String(n).padStart(2,'0');
  return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return res.status(405).json({ ok:false, message:'Method not allowed' });

    const { nome, codigo, observacao } = req.body || {};
    if (!nome)   return res.status(400).json({ ok:false, message:'Selecione o nome' });
    if (!codigo) return res.status(400).json({ ok:false, message:'Informe o código da gira' });

    const doc = await getDoc();

    // lê código atual
    const shCfg = doc.sheetsByTitle[ABA_CONFIG];
    if (!shCfg) throw new Error('Aba Configurações não encontrada');
    await shCfg.loadHeaderRow();
    const rowsCfg = await shCfg.getRows();
    const rCodigo = rowsCfg.find(r => String(r['Chave']||'').trim() === KEY_CODIGO);
    const codigoAtual = rCodigo ? String(rCodigo['Valor']||'').trim() : '';
    if (!codigoAtual) throw new Error('Nenhum código ativo. Aguarde o dirigente iniciar.');
    if (String(codigo).trim().toUpperCase() !== codigoAtual.toUpperCase()) {
      throw new Error('Código incorreto. Verifique o código exibido.');
    }

    // grava presença
    let shOut = doc.sheetsByTitle[ABA_PRESENCAS];
    if (!shOut) {
      shOut = await doc.addSheet({ title: ABA_PRESENCAS, headerValues: ['DataHora','Nome','CodigoGira','Observacao'] });
    }

    const agora = new Date(); // timezone será apenas para formatação
    await shOut.addRow({
      DataHora: fmtDateBR(agora),
      Nome: nome,
      CodigoGira: String(codigo).trim().toUpperCase(),
      Observacao: String(observacao||'').trim()
    });

    res.status(200).json({ ok:true, msg:'Presença registrada' });
  } catch (err) {
    res.status(500).json({ ok:false, message: err.message || String(err) });
  }
};
