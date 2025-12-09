// /api/presencas/init.js
// Retorna { ok: true, nomes: [...] } lendo a aba "Cadastro" da planilha

import { google } from 'googleapis';

const PLANILHA_ID = process.env.SHEET_ID || '1a1Vu39CcTHtSGU9PUtuyRy76QqIpisM8LUn7Lq4qFx0';
const ABA_CADASTRO = 'Cadastro';

function norm(s) {
  return String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

export default async function handler(req, res) {
  try {
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    let privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

    if (!clientEmail || !privateKey) {
      return res.status(500).json({ ok: false, message: 'Faltam variáveis de ambiente do Google Service Account.' });
    }
    // Corrige quebra de linha do PRIVATE KEY salvo no Vercel
    privateKey = privateKey.replace(/\\n/g, '\n');

    const auth = new google.auth.JWT(
      clientEmail,
      null,
      privateKey,
      ['https://www.googleapis.com/auth/spreadsheets.readonly']
    );
    const sheets = google.sheets({ version: 'v4', auth });

    const range = `${ABA_CADASTRO}!A:Z`; // pega o cabeçalho + dados
    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId: PLANILHA_ID,
      range
    });

    const values = data.values || [];
    if (values.length < 2) return res.json({ ok: true, nomes: [] });

    const header = values[0].map(h => String(h).trim());
    const H = header.map(norm);

    // Índices (nome + ativo?)
    const nomeIdx = (() => {
      const candidatos = [
        'nome completo (favor preencher sem abreviacoes)',
        'nome completo',
        'nome'
      ];
      for (let i = 0; i < H.length; i++) {
        for (const c of candidatos) {
          if (H[i] === c || H[i].includes(c)) return i;
        }
      }
      return -1;
    })();

    const ativoIdx = (() => {
      const candidatos = ['ativo?', 'ativo', 'status', 'situacao', 'situação'];
      for (let i = 0; i < H.length; i++) {
        for (const c of candidatos) {
          if (H[i] === c || H[i].includes(c)) return i;
        }
      }
      return -1;
    })();

    if (nomeIdx < 0) {
      return res.status(400).json({ ok: false, message: 'Coluna de nome não encontrada na aba Cadastro.' });
    }

    // Filtra só ativos (se existir coluna "Ativo?")
    const nomesSet = new Set();
    for (let r = 1; r < values.length; r++) {
      const row = values[r] || [];
      const nome = String(row[nomeIdx] || '').trim();
      if (!nome) continue;

      if (ativoIdx >= 0) {
        const st = norm(row[ativoIdx]);
        const isAtivo = !st || st === 'sim' || st === 'ativo' || st === 'ativo(a)';
        if (!isAtivo) continue;
      }
      nomesSet.add(nome);
    }

    const nomes = Array.from(nomesSet).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    return res.json({ ok: true, nomes });
  } catch (err) {
    console.error(err);
    // Evita “Unexpected token … not valid JSON” sempre respondendo JSON
    return res.status(500).json({ ok: false, message: String(err?.message || err) });
  }
}
