// api/fin/dados.js
import { readRange } from '../../lib/sheets.js';

const ABA_CAD  = 'Cadastro';
const ABA_LANC = 'Lançamentos';

// CADASTRO (0-based)
const IDX_CAD_NOME      = 1;
const IDX_CAD_VAL_MENS1 = 11;
const IDX_CAD_ATIVO     = 12;
const IDX_CAD_VAL_MENS2 = 20;
const IDX_CAD_CLASSIF   = 26;

// LANÇAMENTOS (0-based)
const IDX_L_MES_REF   = 2;
const IDX_L_ANO_REF   = 3;
const IDX_L_TIPO      = 4;
const IDX_L_CAT       = 5;
const IDX_L_VALOR_RS  = 7;
const IDX_L_FORMA     = 9;  // não usado, mas mantido
const IDX_L_ANO       = 10;
const IDX_L_MES       = 11;
const IDX_L_SINAL     = 12;

function norm(s) { return String(s || '').trim().toLowerCase(); }

function parseNumber(v) {
  if (v === null || v === '' || typeof v === 'undefined') return 0;
  if (typeof v === 'number') return v;
  let s = String(v).trim();
  if (!s) return 0;
  s = s.replace(/R\$/gi, '').replace(/\s/g, '');
  const temPonto = s.includes('.');
  const temVirg  = s.includes(',');
  if (temPonto && temVirg) {
    if (s.indexOf(',') > s.indexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
  } else if (temVirg && !temPonto) {
    s = s.replace(/\./g, '').replace(',', '.');
  }
  const n = Number(s);
  return isNaN(n) ? 0 : n;
}

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
    const ano = Number(req.query.ano);
    const mes = Number(req.query.mes);
    if (!ano || !mes) {
      return res.status(400).json({ ok: false, message: 'Parâmetros ano/mes obrigatórios.' });
    }

    // lê tudo de uma vez (performance razoável)
    const cadVals  = await readRange(`${ABA_CAD}!A1:AG`);
    const lancVals = await readRange(`${ABA_LANC}!A1:O`);

    if (!cadVals.length || !lancVals.length) {
      return res.status(500).json({ ok: false, message: 'Abas vazias ou inacessíveis.' });
    }

    // 1) Mensalidades previstas (pagantes ativos)
    let mensalPrevista = 0;
    if (cadVals.length > 1) {
      for (let i = 1; i < cadVals.length; i++) {
        const row = cadVals[i];
        const nome = String(row[IDX_CAD_NOME] || '').trim();
        if (!nome) continue;

        const ativoRaw = norm(row[IDX_CAD_ATIVO]);
        const inativo = ['nao','não','n','inativo','inativa','desligado','desligada'].includes(ativoRaw);
        if (inativo) continue;

        const val2 = parseNumber(row[IDX_CAD_VAL_MENS2]);
        const val1 = parseNumber(row[IDX_CAD_VAL_MENS1]);
        const mensalidade = val2 || val1 || 0;

        const classifNorm = norm(row[IDX_CAD_CLASSIF]);
        const isIsento = classifNorm.includes('isento') || mensalidade === 0;
        if (isIsento) continue;

        mensalPrevista += mensalidade;
      }
    }

    // 2) Receitas/Despesas e mensalidades recebidas no mês/ano
    let receitasMes = 0, despesasMes = 0, mensalRecebidaMes = 0;
    const recCategorias = {};
    const despCategorias = {};

    if (lancVals.length > 1) {
      for (let i = 1; i < lancVals.length; i++) {
        const r = lancVals[i];

        let anoRef = r[IDX_L_ANO_REF];
        if (!anoRef && anoRef !== 0) anoRef = r[IDX_L_ANO];
        const a = Number(anoRef);
        if (!a || a !== ano) continue;

        let mesRef = r[IDX_L_MES_REF];
        if (!mesRef && mesRef !== 0) mesRef = r[IDX_L_MES];
        const m = mesToNumber(mesRef);
        if (!m || m !== mes) continue;

        let valor = parseNumber(r[IDX_L_VALOR_RS]);
        if (!valor) continue;

        const tipoNorm = norm(r[IDX_L_TIPO]);
        const cat      = String(r[IDX_L_CAT] || '').trim() || 'Sem categoria';
        const catNorm  = norm(cat);
        const sinal    = Number(r[IDX_L_SINAL] || 0);

        const ehReceita = tipoNorm.includes('receita') || sinal > 0;
        const ehDespesa = tipoNorm.includes('despesa') || sinal < 0;

        if (ehReceita) {
          receitasMes += valor;
          recCategorias[cat] = (recCategorias[cat] || 0) + valor;
        } else if (ehDespesa) {
          despesasMes += valor;
          despCategorias[cat] = (despCategorias[cat] || 0) + valor;
        }

        const ehMensalidade = tipoNorm.includes('mensal') || catNorm.includes('mensal');
        if (ehMensalidade && ehReceita) mensalRecebidaMes += valor;
      }
    }

    const saldoMes = receitasMes - despesasMes;
    const inadValor = Math.max(0, mensalPrevista - mensalRecebidaMes);
    const adimplencia = mensalPrevista > 0 ? (mensalRecebidaMes / mensalPrevista) * 100 : 100;

    const receitasCat = Object.keys(recCategorias)
      .sort((a,b)=>recCategorias[b]-recCategorias[a])
      .map(c => ({ categoria: c, valor: recCategorias[c] }));

    const despesasCat = Object.keys(despCategorias)
      .sort((a,b)=>despCategorias[b]-despCategorias[a])
      .map(c => ({ categoria: c, valor: despCategorias[c] }));

    return res.status(200).json({
      ok: true,
      receitas: receitasMes,
      despesas: despesasMes,
      saldoMes,
      mensalidadesPrev: mensalPrevista,
      mensalidadesPagas: mensalRecebidaMes,
      mensalidadesAbertas: inadValor,
      adimplencia,
      receitasCat,
      despesasCat
    });
  } catch (e) {
    console.error('fin/dados erro:', e);
    return res.status(500).json({ ok: false, message: 'Falha ao calcular dados.' });
  }
}
