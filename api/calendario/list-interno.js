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

function parseDataBR(raw) {
  if (!raw) return null;
  if (raw instanceof Date) return raw;
  const s = String(raw).trim();
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const dd = Number(m[1]), mm = Number(m[2]), aa = Number(m[3]);
  return new Date(aa, mm-1, dd);
}

function fmtDate(dt, tz='America/Manaus') {
  const dd = new Intl.DateTimeFormat('pt-BR',{timeZone:tz,day:'2-digit'}).format(dt);
  const mm = new Intl.DateTimeFormat('pt-BR',{timeZone:tz,month:'2-digit'}).format(dt);
  const aa = new Intl.DateTimeFormat('pt-BR',{timeZone:tz,year:'numeric'}).format(dt);
  return { dataStr: `${dd}/${mm}/${aa}`, iso: `${aa}-${mm}-${dd}` };
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

    const TZ = 'America/Manaus';
    const eventos = [];

    for (let i=1;i<rows.length;i++) {
      const r = rows[i];

      // ✅ SEMPRE precisa ter data
      const dt = parseDataBR(r[ixData]);
      if (!dt) continue;

      const tipoLinhaRaw = ixTipoLn >= 0 ? safeStr(r[ixTipoLn]) : '';
      const atividade = ixAtiv >= 0 ? safeStr(r[ixAtiv]) : '';
      const feriado   = ixFeriado >= 0 ? safeStr(r[ixFeriado]) : '';
      const linha     = ixLinha >= 0 ? safeStr(r[ixLinha]) : '';

      // ✅ FILTRO INTERNO (mais amplo):
      // entra qualquer coisa que tiver data e algum conteúdo de evento.
      const hasSomething = !!atividade || !!feriado || !!linha || !!tipoLinhaRaw;
      if (!hasSomething) continue;

      const { dataStr, iso } = fmtDate(dt, TZ);
      const mes = iso.slice(5,7), ano = iso.slice(0,4);

      // categoria amigável pro front (tag)
      const tipoNorm = norm(tipoLinhaRaw);
      let categoria = 'Evento';
      if (tipoNorm === 'gira' || tipoNorm.includes('gira')) categoria = 'Gira';
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
