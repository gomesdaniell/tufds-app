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

// ===== helpers =====
function norm(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .toLowerCase()
    .replace(/\s+/g, ' ') // substitui tabs, \n etc. por espaço
    .trim();
}

function findColIndex(headerArr, candidates) {
  const H = headerArr.map(norm);
  const C = candidates.map(norm);

  // 1) procura match exato ou substring
  for (let i = 0; i < H.length; i++) {
    for (let j = 0; j < C.length; j++) {
      if (H[i] === C[j] || H[i].includes(C[j])) return i;
    }
  }
  // 2) fallback amplo
  const ixWide = H.findIndex(h => h.startsWith('nome completo'));
  return ixWide;
}

function isAtivo(value) {
  const v = norm(value);
  return (
    v === '' ||
    v === 'sim' ||
    v === 'ativo' ||
    v === 'ativo(a)' ||
    v === 'true' ||
    v === '1'
  );
}

function todayISOInManaus() {
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

// ===== handler =====
export default async function handler(req, res) {
  try {
    const rows = await readRange('Cadastro!A1:AG');
    if (!rows.length) {
      return res.status(200).json({
        ok: true,
        nomes: [],
        motivos: DEFAULT_MOTIVOS,
        hojeISO: todayISOInManaus(),
      });
    }

    const header = rows[0].map(h => String(h || '').trim());

    const iNome = findColIndex(header, [
      'nome completo (favor preencher sem abreviações)',
      'nome completo (favor preencher sem abreviacoes)',
      'nome completo \n(favor preencher sem abreviações)',
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

    // coleta nomes
    let nomes = rows.slice(1)
      .map(r => ({
        nome: String(r[iNome] || '').trim(),
        ativo: iAtivo >= 0 ? r[iAtivo] : '',
      }))
      .filter(o => o.nome)
      .filter(o => (iAtivo >= 0 ? isAtivo(o.ativo) : true))
      .map(o => o.nome);

    nomes = Array.from(new Set(nomes)).sort((a, b) =>
      a.localeCompare(b, 'pt-BR')
    );

    // ===== Lê aba Configurações (motivos personalizados)
    let motivos = DEFAULT_MOTIVOS.slice();
    try {
      const cfg = await readRange('Configurações!A1:B');
      if (cfg.length > 1) {
        const row = cfg
          .slice(1)
          .find(r => String(r[0] || '').trim().toUpperCase() === 'MOTIVOS_FALTA');
        if (row && row[1]) {
          const list = String(row[1])
            .split(/[;,]/)
            .map(s => s.trim())
            .filter(Boolean);
          if (list.length) motivos = list;
        }
      }
    } catch (e) {
      console.warn('[faltas/init] Falha ao ler aba Configurações:', e?.message);
    }

    // ===== debug opcional
    const isDebug = String(req.query?.debug || '') === '1';
    const debug = isDebug
      ? {
          headerRaw: rows[0],
          headerNorm: rows[0].map(norm),
          iNome,
          iAtivo,
        }
      : undefined;

    return res.status(200).json({
      ok: true,
      nomes,
      motivos,
      hojeISO: todayISOInManaus(),
      ...(isDebug ? { debug } : {}),
    });
  } catch (e) {
    console.error('[faltas/init] Erro:', e);
    return res.status(500).json({
      ok: false,
      message: 'Falha ao carregar nomes/motivos.',
      error: e.message,
    });
  }
}
