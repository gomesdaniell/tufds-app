// /api/faltas/init.js
import { readRange } from '../../lib/sheets.js';

const SHEET_ID = '1a1Vu39CcTHtSGU9PUtuyRy76QqIpisM8LUn7Lq4qFx0';
const ABA_CADASTRO = 'Cadastro';
const ABA_CONFIG = 'Configurações';
const TIMEZONE = 'America/Manaus';

function normaliza(s) {
  return String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

function findColIndex(header, candidates) {
  const H = header.map(normaliza);
  const C = candidates.map(normaliza);
  for (let i = 0; i < H.length; i++)
    for (let j = 0; j < C.length; j++)
      if (H[i] === C[j] || H[i].includes(C[j])) return i;
  return -1;
}

export default async function handler(req, res) {
  try {
    const cadastro = await readRange(`${ABA_CADASTRO}!A1:Z`);
    const header = cadastro[0];
    const iNome = findColIndex(header, ['nome completo', 'nome completo (favor preencher sem abreviações)', 'nome']);
    const iAtivo = findColIndex(header, ['ativo?', 'status', 'situação']);

    let nomes = cadastro.slice(1)
      .map(r => [r[iNome], (r[iAtivo] || '').toString().toLowerCase()])
      .filter(([n, st]) => n && ['ativo', 'sim', 'ativo(a)'].includes(st))
      .map(([n]) => String(n).trim())
      .filter((v, i, a) => a.indexOf(v) === i)
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));

    // Lê motivos da aba Configurações (col A = MOTIVOS_FALTA, col B = lista separada por vírgula)
    let motivos = ['Saúde', 'Trabalho', 'Viagem', 'Estudo', 'Família', 'Compromisso religioso', 'Força maior', 'Outros'];
    const cfg = await readRange(`${ABA_CONFIG}!A1:B`);
    const linha = cfg.find(r => String(r[0]).trim().toUpperCase() === 'MOTIVOS_FALTA');
    if (linha && linha[1]) {
      const lista = String(linha[1]).split(/[;,]/).map(s => s.trim()).filter(Boolean);
      if (lista.length) motivos = lista;
    }

    const hojeISO = new Date().toLocaleDateString('fr-CA', { timeZone: TIMEZONE }).replace(/\//g, '-');

    res.status(200).json({ ok: true, nomes, motivos, hojeISO });
  } catch (err) {
    console.error('Erro init faltas', err);
    res.status(500).json({ ok: false, message: 'Erro ao carregar dados iniciais.' });
  }
}
