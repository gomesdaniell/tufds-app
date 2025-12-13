import { google } from "googleapis";

export const SHEET_ID = process.env.SHEET_ID || process.env.PLANILHA_ID_FIN;
const SA_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const SA_KEY   = (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
export const TAB = "Rifas";
export const TZ  = "America/Manaus";

export async function sheets() {
  if (!SHEET_ID) throw new Error("SHEET_ID ausente.");
  const auth = new google.auth.JWT({
    email: SA_EMAIL,
    key: SA_KEY,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  await auth.authorize();
  return google.sheets({ version: "v4", auth });
}

export async function ensureHeader(s) {
  const r = await s.spreadsheets.values.get({
    spreadsheetId: SHEET_ID, range: `${TAB}!A1:G1`
  }).catch(()=>null);

  if (!r || !r.data || !r.data.values || !r.data.values.length) {
    await s.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${TAB}!A1:G1`,
      valueInputOption: "RAW",
      requestBody: { values: [[
        "RIFA_ID","RIFA_NOME","NUMERO","COMPRADOR","DATA_CARIMBO","STATUS","PAGO"
      ]] }
    });
  }
}

export function nowBR() {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ, dateStyle: "short", timeStyle: "medium"
  }).format(new Date());
}
