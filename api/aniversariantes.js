// /api/aniversariantes.js
import { readRange } from '../lib/sheets.js'; // ajuste o caminho se seu lib estiver em outra pasta

const TIMEZONE = 'America/Manaus';
const SHEET_TAB = 'Cadastro';

// util: normaliza texto
function norm(s) {
  return String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/\s+/g, ' ')
    .trim();
}

// tenta achar índice de coluna por nomes candidatos (com e sem acento)
function findColIndex(header, candidates) {
  const H = header.map(norm);
  const C = candidates.map(norm);
  for (let i = 0; i < H.length; i++) {
    for (let j = 0; j < C.length; j++) {
      if (H[i] === C[j] || H[i].includes(C[j])) return i;
    }
  }
  return -1;
}

// mês atual em Manaus (1-12)
function getCurrentMonthManaus() {
  const now = new Date();
  // cria um "agora" convertido para Manaus
  const manaosNow = new Date(
    new Date(now.toLocaleString('en-US', { timeZone: TIMEZONE })).getTime()
  );
  return manaosNow.getMonth() + 1;
}

function mesNomePt(m) {
  const nomes = [
    'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
    'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
  ];
  return nomes[(m - 1) | 0] || '';
}

// formata dd/MM em Manaus
function formatDDMMManaus(dt) {
  // dt aqui já vem “fixado” no meio-dia UTC, então não sofrerá shift
  return dt.toLocaleDateString('pt-BR', { timeZone: TIMEZONE }).slice(0, 5);
}

// parseia "dd/MM/yyyy" criando uma data “fixa” (meio-dia UTC) para evitar shift de fuso
function parseDDMMYYYY_toSafeUTC(text) {
  const s = String(text || '').trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const d = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const y = parseInt(m[3], 10);
  if (!d || !mo || !y) return null;

  // meio-dia UTC => em Manaus (~08:00/09:00 conforme DST inexistente), evitando retroceder 1 dia
  return new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
}

function isAtivo(value) {
  // Considera ativo quando vazio ou "sim"/"ativo", e inativo quando "não/nao", "inativo", "desligado", "n", "false", "0"
  const v = norm(value);
  if (!v) return true;
  if (['sim', 'ativo', 'true', '1'].includes(v)) return true;
  if (['nao', 'não', 'inativo', 'desligado', 'n', 'false', '0'].includes(v)) return false;
  // fallback: se não reconheceu, considera ativo
  return true;
}

export default async function handler(req, res) {
  try {
    // lê parâmetro mes (1-12)
    let mesAlvo = 0;
    if (req.query && req.query.mes) {
      const m = parseInt(req.query.mes, 10);
      if (m >= 1 && m <= 12) mesAlvo = m;
    }
    if (!mesAlvo) mesAlvo = getCurrentMonthManaus();

    // lê cabeçalho + dados da aba Cadastro
    // AD é “grande o bastante” para cobrir suas colunas até SENHA_HASH; ajuste se necessário.
    const rows = await readRange(`${SHEET_TAB}!A1:AD`);
    if (!rows || !rows.length) {
      return res.status(200).json({
        ok: true,
        mesNumero: mesAlvo,
        mesNome: mesNomePt(mesAlvo),
        aniversariantes: []
      });
    }

    const header = rows[0].map(h => String(h || '').trim());

    const ixNome = findColIndex(header, [
      'nome completo',
      'nome',
      'nome completo (favor preencher sem abreviações)',
    ]);
    const ixNasc = findColIndex(header, [
      'data de nascimento',
      'nascimento',
      'dt nascimento',
      'data nascimento'
    ]);
    const ixAtivo = findColIndex(header, [
      'ativo?',
      'ativo',
      'status'
    ]);

    if (ixNome < 0 || ixNasc < 0) {
      return res.status(200).json({
        ok: false,
        message: 'Colunas de Nome ou Data de Nascimento não encontradas na aba Cadastro.'
      });
    }

    const lista = [];

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];

      if (ixAtivo >= 0) {
        if (!isAtivo(r[ixAtivo])) continue;
      }

      const nome = String(r[ixNome] || '').trim();
      if (!nome) continue;

      const nascTxt = r[ixNasc];
      if (!nascTxt) continue;

      // Sempre esperamos texto "dd/MM/yyyy" vindo do Google Sheets API (values.get)
      const dt = parseDDMMYYYY_toSafeUTC(nascTxt);
      if (!dt || isNaN(dt.getTime())) continue;

      const mes = dt.getUTCMonth() + 1; // usamos UTCMonth porque criamos Date.UTC
      if (mes !== mesAlvo) continue;

      const dataStr = formatDDMMManaus(dt);
      const diaNum = parseInt(dataStr.slice(0, 2), 10) || dt.getUTCDate();

      lista.push({ nome, data: dataStr, dia: diaNum });
    }

    // ordena por dia, depois por nome
    lista.sort((a, b) => a.dia - b.dia || a.nome.localeCompare(b.nome, 'pt-BR'));

    return res.status(200).json({
      ok: true,
      mesNumero: mesAlvo,
      mesNome: mesNomePt(mesAlvo),
      aniversariantes: lista
    });
  } catch (err) {
    console.error('Erro /api/aniversariantes.js:', err);
    return res.status(500).json({ ok: false, message: 'Erro ao obter aniversariantes.' });
  }
}
