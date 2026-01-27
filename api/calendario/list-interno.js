// /api/calendario/list-interno.js
import { readRange } from '../../lib/sheets.js';

function norm(s='') {
  return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/\s+/g,' ').trim();
}

function findColIndex(header, candidates) {
  const H = header.map(norm);
  const C = candidates.map(norm);
  for (let i=0;i<H.length;i++) {
    for (let j=0;j<C.length;j++) {
      if (H[i]===C[j] || H[i].includes(C[j])) return i;
    }
  }
  return -1;
}

function pad2(n){ return String(n).padStart(2,'0'); }

/**
 * Lê uma data como "data pura" (sem fuso).
 * - Se vier string DD/MM/AAAA -> usa direto
 * - Se vier Date (Sheets) -> usa UTC getters (evita cair pro dia anterior)
 */
function parseDateParts(raw) {
  if (!raw) return null;

  // Date vindo do Sheets
  if (raw instanceof Date) {
    const y = raw.getUTCFullYear();
    const m = raw.getUTCMonth() + 1;
    const d = raw.getUTCDate();
    return { y, m, d };
  }

  // String BR
  const s = String(raw).trim();
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;

  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = Number(m[3]);
  return { y, m: mo, d };
}

function safeStr(v){ return String(v ?? '').trim(); }

export default async function handler(req, res) {
  try {
    const rows = await readRange('Calendário!A1:AZ');
    if (!rows.length) return res.status(200).json({ ok:true, eventos:[] });

    const header = rows[0].map(h => String(h).trim());

    const ixData    = findColIndex(header, ['data']);
    const ixDiaSem  = findColIndex(header, ['dia da semana','dia semana']);
    const ixSemana  = findColIndex(header, ['semana']);
    const ixFeriado = findColIndex(header, ['feriado/comemoração','feriado','comemoracao','comemoração']);
    const ixTipoLn  = findColIndex(header, ['tipolinha','tipo linha','tipo']);
    const ixAtiv    = findColIndex(header, ['atividade','evento']);
    const ixLinha   = findColIndex(header, ['linha']);

    const eventos = [];

    for (let i=1;i<rows.length;i++) {
      const r = rows[i];

      const parts = parseDateParts(r[ixData]);
      if (!parts) continue;

      const tipoLinhaRaw = ixTipoLn >= 0 ? safeStr(r[ixTipoLn]) : '';
      const atividade = ixAtiv >= 0 ? safeStr(r[ixAtiv]) : '';
      const feriado   = ixFeriado >= 0 ? safeStr(r[ixFeriado]) : '';
      const linha     = ixLinha >= 0 ? safeStr(r[ixLinha]) : '';

      // ✅ filtro amplo (interno)
      const hasSomething = !!atividade || !!feriado || !!linha || !!tipoLinhaRaw;
      if (!hasSomething) continue;

      const iso = `${parts.y}-${pad2(parts.m)}-${pad2(parts.d)}`;
      const dataStr = `${pad2(parts.d)}/${pad2(parts.m)}/${parts.y}`;

      const mes = iso.slice(5,7), ano = iso.slice(0,4);

      // categoria
      const tipoNorm = norm(tipoLinhaRaw);
      let categoria = 'Evento';
      if (tipoNorm.includes('gira')) categoria = 'Gira';
      else if (feriado) categoria = 'Feriado/Comemoração';
      else if (atividade) categoria = 'Atividade';
      else if (tipoLinhaRaw) categoria = tipoLinhaRaw;

      // título
      const titulo =
        atividade ||
        feriado ||
        (tipoLinhaRaw && linha ? `${tipoLinhaRaw} – ${linha}` : '') ||
        tipoLinhaRaw ||
        linha ||
        'Evento';

      eventos.push({
        dataStr,
        iso,
        titulo,

        categoria,
        tipoLinha: tipoLinhaRaw || categoria,

        diaSemana: ixDiaSem>=0 ? safeStr(r[ixDiaSem]) : '',
        semana:    ixSemana>=0 ? safeStr(r[ixSemana]) : '',
        feriado,
        atividade,
        linha,

        mes,
        ano,
        mesAnoKey: `${ano}-${mes}`
      });
    }

    eventos.sort((a,b)=> a.iso.localeCompare(b.iso));
    return res.status(200).json({ ok:true, eventos });

  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok:false, error:String(e) });
  }
}
