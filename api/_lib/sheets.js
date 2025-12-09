// /api/_lib/sheets.js
import { google } from 'googleapis';

const scopes = ['https://www.googleapis.com/auth/spreadsheets'];

export async function getSheetsClient() {
  const jwt = new google.auth.JWT(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    null,
    (process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '').replace(/\\n/g, '\n'),
    scopes
  );
  await jwt.authorize();
  const sheets = google.sheets({ version: 'v4', auth: jwt });
  return sheets;
}

export async function getCadastroAtivos() {
  const sheets = await getSheetsClient();
  const spreadsheetId = process.env.GSHEET_ID;
  const aba = process.env.GSHEET_ABA_CADASTRO || 'Cadastro';
  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId, range: `${aba}!A:Z`,
  });
  const values = data.values || [];
  if (values.length < 2) return [];

  const header = values[0].map(h => String(h || '').trim());
  const norm = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/\s+/g,' ').trim();

  const iNome = header.findIndex(h =>
    ['nome completo (favor preencher sem abreviações)', 'nome completo', 'nome']
      .map(norm).includes(norm(h))
  );
  const iAtivo = header.findIndex(h =>
    ['ativo?', 'status', 'situação', 'situacao'].map(norm).includes(norm(h))
  );

  if (iNome < 0) return [];
  const ativos = values.slice(1).map(r => {
    const nome = String(r[iNome] || '').trim();
    const st = String((iAtivo >= 0 ? r[iAtivo] : '') || '').trim().toLowerCase();
    const ok = !iAtivo || st === 'sim' || st === 'ativo' || st === 'ativo(a)';
    return { nome, ok };
  }).filter(x => x.nome && x.ok).map(x => x.nome);

  // únicos + ordenados
  return Array.from(new Set(ativos)).sort((a,b)=>a.localeCompare(b,'pt-BR'));
}

export async function getCodigoAtual() {
  const sheets = await getSheetsClient();
  const spreadsheetId = process.env.GSHEET_ID;
  const aba = process.env.GSHEET_ABA_CONFIG || 'Configurações';
  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId, range: `${aba}!A:B`,
  });
  const rows = data.values || [];
  let codigo = '', ts = 0;
  for (const r of rows.slice(1)) {
    const k = String(r[0] || '').trim().toUpperCase();
    const v = String(r[1] || '').trim();
    if (k === 'CODIGO_GIRA_ATUAL') codigo = v;
    if (k === 'CODIGO_GIRA_TS') ts = Number(v) || 0;
  }
  return { codigo, ts };
}

export async function setCodigoAtual(novoCodigo) {
  const sheets = await getSheetsClient();
  const spreadsheetId = process.env.GSHEET_ID;
  const aba = process.env.GSHEET_ABA_CONFIG || 'Configurações';

  const ts = Date.now();
  // Estratégia simples: sobrescrever dois pares chave/valor nas duas primeiras linhas
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${aba}!A1:B2`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [
        ['CODIGO_GIRA_ATUAL', novoCodigo],
        ['CODIGO_GIRA_TS', String(ts)],
      ]
    }
  });
  return { codigo: novoCodigo, ts };
}

export async function appendPresenca({ nome, codigo, observacao }) {
  const sheets = await getSheetsClient();
  const spreadsheetId = process.env.GSHEET_ID;
  const aba = process.env.GSHEET_ABA_PRESENCAS || 'Presencas';

  const dataHora = new Intl.DateTimeFormat('pt-BR', {
    timeZone: process.env.TZ_MANAUS || 'America/Manaus',
    year:'numeric', month:'2-digit', day:'2-digit',
    hour:'2-digit', minute:'2-digit', second:'2-digit'
  }).format(new Date());

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${aba}!A:D`,
    valueInputOption: 'RAW',
    requestBody: { values: [[dataHora, nome, codigo, observacao]] }
  });

  return true;
}

export function gerarCodigo(n = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s=''; for (let i=0;i<n;i++) s += chars[Math.floor(Math.random()*chars.length)];
  return s;
}
