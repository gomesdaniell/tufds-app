// /api/presencas/init.js
import { google } from 'googleapis';

const {
  GOOGLE_SERVICE_ACCOUNT_EMAIL,
  GOOGLE_PRIVATE_KEY,
  PLANILHA_ID,                 // "1a1Vu39CcTHtSGU9PUtuyRy76QqIpisM8LUn7Lq4qFx0"
  ABA_CADASTRO = 'Cadastro'
} = process.env;

function norm(str){
  return String(str || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/\s+/g,' ').trim();
}

export default async function handler(req, res){
  try{
    if (req.method !== 'GET') return res.status(405).json({ ok:false, message:'Method not allowed' });
    if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY) {
      return res.status(500).json({ ok:false, message:'Credenciais do Google ausentes' });
    }
    if (!PLANILHA_ID) {
      return res.status(500).json({ ok:false, message:'PLANILHA_ID ausente' });
    }

    const auth = new google.auth.JWT(
      GOOGLE_SERVICE_ACCOUNT_EMAIL,
      null,
      GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      ['https://www.googleapis.com/auth/spreadsheets']
    );
    const sheets = google.sheets({ version:'v4', auth });

    // Lê tudo da aba Cadastro
    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId: PLANILHA_ID,
      range: `${ABA_CADASTRO}!A:Z`
    });

    const values = data.values || [];
    if (values.length < 2) {
      return res.status(200).json({ ok:true, nomes: [] });
    }

    const header = values[0].map(h => String(h).trim());
    const idxNome = header.findIndex(h => norm(h) === 'nome completo' || norm(h).includes('nome completo (favor preencher sem abreviacoes)') || norm(h) === 'nome');
    const idxAtivo = header.findIndex(h => ['ativo?','ativo','status','situacao','situação'].includes(norm(h)));

    let nomes = values.slice(1).map(r => {
      const nome = (idxNome >= 0 ? String(r[idxNome] || '').trim() : '').trim();
      const st   = (idxAtivo >= 0 ? String(r[idxAtivo] || '').trim().toLowerCase() : '');
      const ativo = !idxAtivo >= 0 ? true : (st === 'sim' || st === 'ativo' || st === 'ativo(a)');
      return { nome, ativo };
    }).filter(x => x.nome && x.ativo)
      .map(x => x.nome);

    // remove duplicados e ordena pt-BR
    nomes = [...new Set(nomes)].sort((a,b)=>a.localeCompare(b,'pt-BR'));

    return res.status(200).json({ ok:true, nomes });
  }catch(err){
    console.error(err);
    return res.status(500).json({ ok:false, message: err.message || 'Erro ao carregar nomes' });
  }
}
