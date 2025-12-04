// api/calendario/list.js
import { readRange } from '../../lib/sheets.js';

function norm(s='') {
  return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/\s+/g,' ').trim();
}
function findColIndex(header, candidates) {
  const H = header.map(norm);
  const C = candidates.map(norm);
  for (let i=0;i<H.length;i++) for (let j=0;j<C.length;j++)
    if (H[i]===C[j] || H[i].includes(C[j])) return i;
  return -1;
}
function parseDataBR(raw) {
  if (!raw) return null;
  if (raw instanceof Date) return raw;
  const s = String(raw).trim();
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [_, dd, mm, aa] = m.map(Number);
  return new Date(aa, mm-1, dd);
}
function fmtDate(dt, tz='America/Manaus') {
  const dd = new Intl.DateTimeFormat('pt-BR',{timeZone:tz,day:'2-digit'}).format(dt);
  const mm = new Intl.DateTimeFormat('pt-BR',{timeZone:tz,month:'2-digit'}).format(dt);
  const aa = new Intl.DateTimeFormat('pt-BR',{timeZone:tz,year:'numeric'}).format(dt);
  return { dataStr: `${dd}/${mm}/${aa}`, iso: `${aa}-${mm}-${dd}` };
}

export default async function handler(req, res) {
  try {
    const rows = await readRange('Calendário!A1:AZ');
    if (!rows.length) return res.status(200).json({ ok:true, eventos:[] });

    const header = rows[0].map(h => String(h).trim());
    const ixData    = findColIndex(header, ['data']);
    const ixDiaSem  = findColIndex(header, ['dia da semana','dia semana']);
    const ixSemana  = findColIndex(header, ['semana']);
    const ixFeriado = findColIndex(header, ['feriado/comemoração','feriado']);
    const ixTipoLn  = findColIndex(header, ['tipolinha','tipo']);
    const ixAtiv    = findColIndex(header, ['atividade']);
    const ixLinha   = findColIndex(header, ['linha']);

    const TZ = 'America/Manaus';
    const eventos = [];

    for (let i=1;i<rows.length;i++) {
      const r = rows[i];
      const dt = parseDataBR(r[ixData]);
      if (!dt) continue;

      const tipoLinha = String(r[ixTipoLn]||'').trim().toLowerCase();
      if (tipoLinha !== 'gira') continue;

      const atividade = String(r[ixAtiv]||'').trim();
      if (atividade.toLowerCase() === 'desenvolvimento') continue;

      const { dataStr, iso } = fmtDate(dt, TZ);
      const mes = iso.slice(5,7), ano = iso.slice(0,4);

      eventos.push({
        dataStr, iso,
        diaSemana: ixDiaSem>=0 ? r[ixDiaSem] : '',
        semana:    ixSemana>=0 ? r[ixSemana] : '',
        feriado:   ixFeriado>=0? r[ixFeriado]: '',
        tipoLinha: 'Gira',
        atividade,
        linha:     ixLinha>=0 ? r[ixLinha] : '',
        mes, ano,
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
