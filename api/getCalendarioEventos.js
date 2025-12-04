// api/getCalendarioEventos.js
import { google } from 'googleapis';

export default async function handler(req, res) {
  try {
    const SHEET_ID = process.env.GOOGLE_SHEETS_ID;
    const SERVICE_EMAIL = process.env.GOOGLE_SERVICE_EMAIL;
    let PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY;

    // Validações claras (mostram qual var faltou)
    if (!SHEET_ID)      return res.status(500).json({ error: 'Missing GOOGLE_SHEETS_ID' });
    if (!SERVICE_EMAIL) return res.status(500).json({ error: 'Missing GOOGLE_SERVICE_EMAIL' });
    if (!PRIVATE_KEY)   return res.status(500).json({ error: 'Missing GOOGLE_PRIVATE_KEY' });

    // Converte "\n" literais para quebras reais
    PRIVATE_KEY = PRIVATE_KEY.replace(/\\n/g, '\n');

    const auth = new google.auth.JWT({
      email: SERVICE_EMAIL,
      key: PRIVATE_KEY,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
    });

    const sheets = google.sheets({ version: 'v4', auth });
    // Leia a aba "Calendário" inteira (ajuste o range conforme seu header)
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Calendário!A:Z'
    });

    const rows = resp.data.values || [];
    if (rows.length < 2) return res.status(200).json({ eventos: [] });

    const header = rows[0].map(h => String(h || '').trim());

    // helpers de localização de colunas (mesma lógica que você já usa)
    const norm = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'')
                     .toLowerCase().replace(/\s+/g,' ').trim();
    const findCol = (cands) => {
      const H = header.map(norm);
      const C = cands.map(norm);
      for (let i = 0; i < H.length; i++) {
        for (let j = 0; j < C.length; j++) {
          if (H[i] === C[j] || H[i].includes(C[j])) return i;
        }
      }
      return -1;
    };

    const ixData    = findCol(['data']);
    const ixDiaSem  = findCol(['dia da semana','dia semana']);
    const ixSemana  = findCol(['semana']);
    const ixFeriado = findCol(['feriado/comemoração','feriado']);
    const ixTipoLn  = findCol(['tipolinha','tipo']);
    const ixAtiv    = findCol(['atividade']);
    const ixLinha   = findCol(['linha']);

    const TZ = 'America/Manaus';
    const parseBR = (s) => {
      if (s instanceof Date) return s;
      const str = String(s || '').trim();
      const p = str.split('/');
      if (p.length !== 3) return null;
      const [dd, mm, yyyy] = p.map(x => parseInt(x, 10));
      if (!dd || !mm || !yyyy) return null;
      return new Date(yyyy, mm - 1, dd);
    };

    const eventos = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const dt = parseBR(r[ixData]);
      if (!dt) continue;

      const tipoLinha = String(r[ixTipoLn] || '').trim().toLowerCase();
      if (tipoLinha !== 'gira') continue;

      const atividade = String(r[ixAtiv] || '').trim();
      if (atividade.toLowerCase() === 'desenvolvimento') continue;

      const pad = (n) => String(n).padStart(2, '0');
      const dia = pad(dt.getDate());
      const mes = pad(dt.getMonth() + 1);
      const ano = String(dt.getFullYear());

      eventos.push({
        dataStr: `${dia}/${mes}/${ano}`,
        iso: `${ano}-${mes}-${dia}`,
        diaSemana: ixDiaSem >= 0 ? r[ixDiaSem] : '',
        semana: ixSemana >= 0 ? r[ixSemana] : '',
        feriado: ixFeriado >= 0 ? r[ixFeriado] : '',
        tipoLinha: 'Gira',
        atividade,
        linha: ixLinha >= 0 ? r[ixLinha] : '',
        mes,
        ano,
        mesAnoKey: `${ano}-${mes}`,
      });
    }

    eventos.sort((a, b) => a.iso.localeCompare(b.iso));
    return res.status(200).json({ eventos });
  } catch (err) {
    // Log útil em dev; na Vercel, aparece nos Logs
    console.error('getCalendarioEventos error:', err);
    return res.status(500).json({ error: String(err && err.message || err) });
  }
}
