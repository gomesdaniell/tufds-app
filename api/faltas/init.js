// /api/faltas/init.js
import { readRange } from '../../lib/sheets.js';

const DEFAULT_MOTIVOS = [
  'Saúde',
  'Trabalho',
  'Viagem',
  'Estudo',
  'Família',
  'Compromisso religioso',
  'Força maior',
  'Outros',
];

// normaliza para comparar cabeçalho
function norm(s) {
  return String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // tira acentos
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// encontra índice da coluna por candidatos (match exato ou "includes")
function findColIndex(headerArr, candidates) {
  const H = headerArr.map(norm);
  const C = candidates.map(norm);
  for (let i = 0; i < H.length; i++) {
    for (let j = 0; j < C.length; j++) {
      if (H[i] === C[j] || H[i].includes(C[j])) return i;
    }
  }
  return -1;
}

// decide se o status indica ativo
function isAtivo(value) {
  const v = norm(value);
  return (
    v === '' || v === 'sim' || v === 'ativo' || v === 'ativo(a)' ||
    v === 'true' || v === '1'
  );
}

// yyyy-mm-dd no fuso de Manaus
function todayISOInManaus() {
  // pega componentes no TZ desejado
  const fmt = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Manaus',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = fmt.formatToParts(new Date());
  const get = (t) => parts.find(p => p.type === t)?.value;
  const dd = get('day');
  const mm = get('month');
  const yyyy = get('year');
  return `${yyyy}-${mm}-${dd}`;
}

export default async function handler(req, res) {
  try {
    // --- 1) Lê a aba Cadastro
    const rows = await readRange('Cadastro!A1:AG');
    if (!rows.length) {
      return res.status(200).json({ ok: true, nomes: [], motivos: DEFAULT_MOTIVOS, hojeISO: todayISOInManaus() });
    }

    const header = rows[0].map(h => String(h || '').trim());
    const iNome = findColIndex(header, [
      'nome completo (favor preencher sem abreviacoes)',
      'nome completo (favor preencher sem abreviações)',
      'nome completo',
      'nome',
    ]);
    const iAtivo = findColIndex(header, [
      'ativo?',
      'ativo',
      'status',
      'situacao',
      'situação',
    ]);

    // fallback: se não achar a coluna de nome, devolve vazio com dica
    if (iNome < 0) {
      console.warn('[faltas/init] Coluna de NOME não encontrada. Header lido:', header);
      return res.status(200).json({
        ok: true,
        nomes: [],
        motivos: DEFAULT_MOTIVOS,
        hojeISO: todayISOInManaus(),
        hint: 'Coluna de nome não encontrada. Confira o cabeçalho da aba Cadastro.'
      });
    }

    // monta lista de nomes; filtra por ativo somente se a coluna existir
    let nomes = rows.slice(1)
      .map(r => ({
        nome: String(r[iNome] || '').trim(),
        ativo: iAtivo >= 0 ? r[iAtivo] : '',
      }))
      .filter(o => o.nome) // só nomes não vazios
      .filter(o => (iAtivo >= 0 ? isAtivo(o.ativo) : true)) // aplica filtro se existir
      .map(o => o.nome);

    // remove duplicados e ordena alfabeticamente PT-BR
    nomes = Array.from(new Set(nomes)).sort((a, b) => a.localeCompare(b, 'pt-BR'));

    // --- 2) Lê motivos da aba Configurações (opcional)
    let motivos = DEFAULT_MOTIVOS.slice();
    try {
      const cfg = await readRange('Configurações!A1:B');
      if (cfg.length > 1) {
        const iKey = 0, iVal = 1;
        // procura por MOTIVOS_FALTA na col A (case-insensitive)
        const row = cfg.slice(1).find(r => String(r[iKey] || '').trim().toUpperCase() === 'MOTIVOS_FALTA');
        if (row && row[iVal]) {
          const raw = String(row[iVal]);
          const list = raw.split(/[;,]/).map(s => s.trim()).filter(Boolean);
          if (list.length) motivos = list;
        }
      }
    } catch (e) {
      // se der erro, mantemos o default sem quebrar o init
      console.warn('[faltas/init] Não foi possível ler Configurações!A:B. Usando motivos padrão.', e?.message);
    }

    return res.status(200).json({
      ok: true,
      nomes,
      motivos,
      hojeISO: todayISOInManaus(),
    });
  } catch (e) {
    console.error('[faltas/init] Erro:', e);
    return res.status(500).json({ ok: false, message: 'Falha ao carregar nomes/motivos.' });
  }
}
