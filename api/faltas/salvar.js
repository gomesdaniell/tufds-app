// api/faltas/salvar.js
import { getSheetsClient } from '../../lib/sheets.js';

const TZ = 'America/Manaus';
const SAIDA_SHEET = 'Faltas_Registros';

function genId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 7; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return 'ABS-' + s;
}

function toBR(yyyy_mm_dd) {
  // evita problemas de fuso: cria Date em meia-noite local
  const [y, m, d] = String(yyyy_mm_dd).split('-').map(Number);
  if (!y || !m || !d) return '';
  const dt = new Date(Date.UTC(y, m - 1, d, 3, 0, 0)); // pequeno offset para fugir do DLS
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const yy = dt.getUTCFullYear();
  return `${dd}/${mm}/${yy}`;
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, message: 'Método não permitido' });
    }

    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('application/json')) {
      return res.status(400).json({ ok: false, message: 'Content-Type deve ser application/json' });
    }

    const body = req.body || {};
    const nome = String(body?.nome || '').trim();
    const dataAusencia = String(body?.dataAusencia || '').trim(); // yyyy-mm-dd
    const motivosArr = Array.isArray(body?.motivos) ? body.motivos : [];
    const observacao = String(body?.observacao || '').trim();

    if (!nome) return res.status(400).json({ ok: false, message: 'Selecione o nome.' });
    if (!dataAusencia) return res.status(400).json({ ok: false, message: 'Informe a data da ausência.' });
    if (observacao.replace(/\s+/g, ' ').trim().length < 30) {
      return res.status(400).json({ ok: false, message: 'Observação precisa ter, no mínimo, 30 caracteres.' });
    }

    const { sheets, spreadsheetId } = await getSheetsClient();
    // garante a aba de saída
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const exists = meta.data.sheets?.some(s => s.properties?.title === SAIDA_SHEET);

    if (!exists) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: [{ addSheet: { properties: { title: SAIDA_SHEET } } }] }
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${SAIDA_SHEET}!A1:G1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [[
            'DataHora', 'RegistroID', 'Nome', 'DataAusencia', 'Motivos', 'Outros', 'Observacao'
          ]]
        }
      });
    }

    const id = genId();
    const agora = new Date();
    const dataBR = toBR(dataAusencia);
    const motivos = motivosArr.join(', ');

    // append
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${SAIDA_SHEET}!A:G`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [[
          agora.toLocaleString('pt-BR', { timeZone: TZ }),
          id,
          nome,
          dataBR,
          motivos,
          '',            // Outros (se quiser usar depois)
          observacao
        ]]
      }
    });

    return res.status(200).json({ ok: true, id });
  } catch (e) {
    console.error('Erro salvar falta:', e);
    return res.status(500).json({ ok: false, message: 'Falha ao salvar registro.' });
  }
}
