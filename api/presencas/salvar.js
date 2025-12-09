// api/presencas/salvar.js
import { getSheetsClient, ensureSheet, appendRows } from '../../lib/sheets.js';

const TZ = 'America/Manaus';
// Mesmas coordenadas usadas no front (para gravar a distância no registro)
const LAT_TERREIRO = -3.072586021397572;
const LON_TERREIRO = -60.042981419063146;

function toRad(g){ return g * Math.PI / 180; }
function distanciaEmMetros(lat1, lon1, lat2, lon2){
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat/2)**2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon/2)**2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

export default async function handler(req, res){
  try{
    if (req.method !== 'POST') {
      return res.status(405).json({ ok:false, message:'Método não permitido' });
    }

    const { nome, observacao, lat, lon } = req.body || {};
    if (!nome) return res.status(400).json({ ok:false, message:'Informe o nome.' });

    // não obrigamos lat/lon no backend (cliente já bloqueia); mas gravamos se veio
    const latNum = (lat==null ? null : Number(lat));
    const lonNum = (lon==null ? null : Number(lon));
    let dist = null;
    if (!Number.isNaN(latNum) && !Number.isNaN(lonNum) && latNum !== null && lonNum !== null){
      dist = distanciaEmMetros(latNum, lonNum, LAT_TERREIRO, LON_TERREIRO);
    }

    // garante aba e cabeçalho
    await ensureSheet('Presencas', ['DataHora', 'Nome', 'Latitude', 'Longitude', 'Distancia_m', 'Observacao']);

    // Data/hora Manaus (formato dd/MM/yyyy HH:mm:ss)
    const now = new Date();
    const dataHora = new Intl.DateTimeFormat('pt-BR', {
      timeZone: TZ, year:'numeric', month:'2-digit', day:'2-digit',
      hour:'2-digit', minute:'2-digit', second:'2-digit'
    }).format(now).replace(',', '');

    await appendRows('Presencas!A1', [[
      dataHora,
      String(nome || ''),
      latNum==null ? '' : latNum,
      lonNum==null ? '' : lonNum,
      dist==null ? '' : Math.round(dist),
      String(observacao || '')
    ]]);

    return res.status(200).json({ ok:true });
  }catch(err){
    console.error('presencas/salvar erro:', err);
    return res.status(500).json({ ok:false, message: err.message || String(err) });
  }
}
