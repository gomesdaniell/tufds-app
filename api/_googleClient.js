// api/_googleClient.js
import { google } from 'googleapis';

export function getJwt(scopes = [
  'https://www.googleapis.com/auth/spreadsheets'
]) {
  const email = process.env.GOOGLE_SERVICE_EMAIL;
  let key = process.env.GOOGLE_PRIVATE_KEY;

  if (!email || !key) {
    throw new Error('Missing GOOGLE_PRIVATE_KEY or GOOGLE_SERVICE_EMAIL');
  }
  // Vercel guarda a chave com \n; converte para quebras reais
  key = key.replace(/\\n/g, '\n');

  return new google.auth.JWT({
    email,
    key,
    scopes,
  });
}

export async function getSheets() {
  const auth = getJwt();
  return google.sheets({ version: 'v4', auth });
}

export const SHEET_ID = process.env.GOOGLE_SHEETS_ID || process.env.SHEET_ID; // compatibilidade
export const TZ = 'America/Manaus';
