// /api/presencas/salvar.js
import { google } from 'googleapis';

const {
  GOOGLE_SERVICE_ACCOUNT_EMAIL,
  GOOGLE_PRIVATE_KEY,
  PLANILHA_ID,                 // "1a1Vu39CcTHtSGU9PUtuyRy76QqIpisM8LUn7Lq4qFx0"
  ABA_PRESENCAS = 'Presencas',
  TZ_MANAUS = 'America/Manaus'
} = process.env;

function agoraManaus(){
  // carimbo amigável em Manaus
  try{
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: TZ_MANAUS,
      dateStyle: 'short',
      timeStyle: 'medium'
    }).format(new Date());
  }catch{
    // fallback
    return new Date().toISOString();
  }
}

export default async function handler(req, res){
  try{
    if (req.method !== 'POST') return res.status(405).json({ ok:false, message:'Method not allowed' });
    if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY) {
      return res.status(500).json({ ok:false, message:'Credenciais do Google ausentes' });
    }
    if (!PLANILHA_ID) {
      return res.status(500).json({ ok:false, message:'PLANILHA_ID ausente' });
    }

    const { nome } = req.body || {};
    if (!nome) return res.status(400).json({ ok:false, message:'Nome obrigatório' });

    const auth = new google.auth.JWT(
      GOOGLE_SERVICE_ACCOUNT_EMAIL,
      null,
      GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      ['https://www.googleapis.com/auth/spreadsheets']
    );
    const sheets = google.sheets({ version:'v4', auth });

    const timestamp = agoraManaus();

    await sheets.spreadsheets.values.append({
      spreadsheetId: PLANILHA_ID,
      range: `${ABA_PRESENCAS}!A:B`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[ timestamp, nome ]] }
    });

    return res.status(200).json({ ok:true });
  }catch(err){
    console.error(err);
    return res.status(500).json({ ok:false, message: err.message || 'Erro ao salvar presença' });
  }
}
