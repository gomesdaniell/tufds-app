// /api/getCalendarioEventos.js
import { google } from 'googleapis';

const ABA_CALENDARIO = 'Calendário'; // nome exato da sua aba

function normalizeHeader(s='') {
  return String(s)
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/\s+/g,' ').trim();
}
function findColIndex(header, candidates) {
  const H = header.map(normalizeHeader);
  const C = candidates.map(normalizeHeader);
  for (let i=0;i<H.length;i++){
    for (let j=0;j<C.length;j++){
      if (H[i]===C[j] || H[i].includes(C[j])) return i;
    }
  }
  return -1;
}
function parseDataBR(raw){
  if(!raw) return null;
  if(raw instanceof Date) return raw;
  const p = String(raw).trim().split('/');
  if(p.length!==3) return null;
  const [dd,mm,aa] = p.map(Number);
  if(!dd||!mm||!aa) return null;
  return new Date(aa, mm-1, dd);
}
function pad(n){ return String(n).padStart(2,'0'); }

async function authSheets() {
  const jwt = new google.auth.JWT(
    process.env.GOOGLE_SERVICE_EMAIL,
    undefined,
    (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    ['https://www.googleapis.com/auth/spreadsheets.readonly']
  );
  await jwt.authorize();
  return google.sheets({ version: 'v4', auth: jwt });
}

export default async function handler(req, res) {
  try {
    const sheets = await authSheets();
    const range = `'${ABA_CALENDARIO}'!A:Z`;

    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range
    });

    const rows = data.values || [];
    if (rows.length < 2) return res.status(200).json({ eventos: [] });

    const header = rows[0];
    const ixData    = findColIndex(header, ['data']);
    const ixDiaSem  = findColIndex(header, ['dia da semana','dia semana']);
    const ixSemana  = findColIndex(header, ['semana']);
    const ixFeriado = findColIndex(header, ['feriado/comemoração','feriado']);
    const ixTipoLn  = findColIndex(header, ['tipolinha','tipo']);
    const ixAtiv    = findColIndex(header, ['atividade']);
    const ixLinha   = findColIndex(header, ['linha']);

    const eventos = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const dt  = parseDataBR(row[ixData]);
      if (!dt) continue;

      const tipoLinha = String(row[ixTipoLn] || '').trim().toLowerCase();
      if (tipoLinha !== 'gira') continue;

      const atividade = String(row[ixAtiv] || '').trim();
      if (atividade.toLowerCase() === 'desenvolvimento') continue;

      const dia = pad(dt.getDate()), mes = pad(dt.getMonth()+1), ano = dt.getFullYear();

      eventos.push({
        dataStr   : `${dia}/${mes}/${ano}`,
        iso       : `${ano}-${mes}-${dia}`,
        diaSemana : ixDiaSem  >=0 ? row[ixDiaSem]  : '',
        semana    : ixSemana  >=0 ? row[ixSemana]  : '',
        feriado   : ixFeriado >=0 ? row[ixFeriado] : '',
        tipoLinha : 'Gira',
        atividade,
        linha     : ixLinha   >=0 ? row[ixLinha]   : '',
        mes,
        ano,
        mesAnoKey : `${ano}-${mes}`
      });
    }

    eventos.sort((a,b)=> a.iso.localeCompare(b.iso));
    res.status(200).json({ eventos });
  } catch (err) {
    console.error('getCalendarioEventos ERROR', err);
    res.status(500).json({ error: String(err?.message || err) });
  }
}
