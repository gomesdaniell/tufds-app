// api/fin/init.js
import { readRange } from '../../lib/sheets.js';

// ajuste se os nomes de abas mudarem
const ABA_LANC = 'Lançamentos';

// colunas 0-based conforme seu script
const IDX_L_ANO_REF = 3;  // "Ano Referência"
const IDX_L_ANO     = 10; // "Ano"
const IDX_L_MES_REF = 2;  // "Mês Referência"
const IDX_L_MES     = 11; // "Mês"

function mesToNumber(m) {
  if (m == null) return null;
  const s = String(m).trim().toLowerCase();
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    return n >= 1 && n <= 12 ? n : null;
  }
  const mapa = {
    'jan':1,'janeiro':1,'fev':2,'fevereiro':2,'mar':3,'marco':3,'março':3,
    'abr':4,'abril':4,'mai':5,'maio':5,'jun':6,'junho':6,'jul':7,'julho':7,
    'ago':8,'agosto':8,'set':9,'setembro':9,'out':10,'outubro':10,
    'nov':11,'novembro':11,'dez':12,'dezembro':12
  };
  return mapa[s] || null;
}

export default async function handler(req, res) {
  try {
    const linhas = await readRange(`${ABA_LANC}!A1:O`); // pega cabeçalho + algumas colunas
    const anosSet = new Set();

    if (linhas.length > 1) {
      for (let i = 1; i < linhas.length; i++) {
        const r = linhas[i];
        // ano
        let anoRef = r[IDX_L_ANO_REF];
        if (!anoRef && anoRef !== 0) anoRef = r[IDX_L_ANO];
        const a = Number(anoRef);
        if (!isNaN(a) && a > 2000 && a < 2100) anosSet.add(a);

        // força parse de mês (não precisa guardar – só valida)
        let mesRef = r[IDX_L_MES_REF];
        if (!mesRef && mesRef !== 0) mesRef = r[IDX_L_MES];
        mesToNumber(mesRef); // apenas valida
      }
    }

    const hoje = new Date();
    const anoAtual = hoje.getFullYear();
    const mesAtual = hoje.getMonth() + 1;

    if (!anosSet.size) anosSet.add(anoAtual);
    const anos = Array.from(anosSet).sort((a, b) => a - b);

    const meses = [
      'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
      'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
    ];

    return res.status(200).json({ ok: true, anos, meses, anoAtual, mesAtual });
  } catch (e) {
    console.error('fin/init erro:', e);
    return res.status(500).json({ ok: false, message: 'Falha ao carregar init.' });
  }
}
