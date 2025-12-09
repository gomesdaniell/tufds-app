// /api/faltas/salvar.js
import { appendRow } from '../../lib/sheets.js';

const SHEET_ID = '1a1Vu39CcTHtSGU9PUtuyRy76QqIpisM8LUn7Lq4qFx0';
const ABA_SAIDA = 'Faltas_Registros';
const TIMEZONE = 'America/Manaus';

function gerarCodigo() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 7; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return 'ABS-' + s;
}

export default async function handler(req, res) {
  try {
    const { nome, dataAusencia, motivos = [], observacao } = req.body || {};

    if (!nome) throw new Error('Selecione o nome.');
    if (!dataAusencia) throw new Error('Informe a data da ausência.');
    if (!observacao || observacao.trim().length < 30) {
      throw new Error('Observação precisa ter, no mínimo, 30 caracteres.');
    }

    const registroID = gerarCodigo();
    const agora = new Date().toLocaleString('pt-BR', { timeZone: TIMEZONE });
    const dataBR = new Date(dataAusencia + 'T00:00:00').toLocaleDateString('pt-BR', { timeZone: TIMEZONE });

    await appendRow(SHEET_ID, ABA_SAIDA, [
      agora,
      registroID,
      nome,
      dataBR,
      motivos.join(', '),
      '',
      observacao
    ]);

    res.status(200).json({ ok: true, registroID });
  } catch (err) {
    console.error('Erro salvar falta', err);
    res.status(400).json({ ok: false, message: err.message || 'Erro ao registrar falta.' });
  }
}
