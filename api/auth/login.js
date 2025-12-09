// api/auth/login.js (ESM)
import { google } from "googleapis";
import crypto from "crypto";
import { signSession } from "../_lib/session.js";

const SHEET_ID = process.env.SHEET_ID;
const SA_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const SA_KEY   = (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");

const TAB = "Cadastro";
const COL_EMAIL = "F";
const COL_HASH  = "AC";

function sha256(t){ return crypto.createHash("sha256").update(t,"utf8").digest("hex"); }

async function getSheetsClient() {
  const auth = new google.auth.JWT({
    email: SA_EMAIL,
    key: SA_KEY,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  await auth.authorize();
  return google.sheets({ version: "v4", auth });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok:false, message:"Method Not Allowed" }); return;
  }
  try {
    const { email, senha } = (await req.json?.()) || req.body || {};
    const e = String(email||"").trim().toLowerCase();
    const p = String(senha||"");

    if (!e || !p) { res.status(400).json({ ok:false, message:"E-mail e senha são obrigatórios." }); return; }
    if (!SHEET_ID || !SA_EMAIL || !SA_KEY) { res.status(500).json({ ok:false, message:"Credenciais do Google ausentes." }); return; }

    const sheets = await getSheetsClient();

    // localizar linha do e-mail
    const emailsResp = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${TAB}!${COL_EMAIL}:${COL_EMAIL}`,
      majorDimension: "COLUMNS",
    });
    const col = emailsResp.data.values?.[0] || [];
    let rowIndex = -1;
    for (let i=1;i<col.length;i++){
      if (String(col[i]||"").trim().toLowerCase() === e){ rowIndex = i+1; break; }
    }
    if (rowIndex < 2) { res.status(404).json({ ok:false, message:"E-mail não encontrado." }); return; }

    // ler hash
    const hashResp = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${TAB}!${COL_HASH}${rowIndex}:${COL_HASH}${rowIndex}`,
    });
    const hashPlanilha = String(hashResp.data.values?.[0]?.[0] || "").trim();
    if (!hashPlanilha) { res.status(400).json({ ok:false, message:"Usuário sem senha cadastrada." }); return; }

    // comparar
    if (sha256(p) !== hashPlanilha) {
      res.status(401).json({ ok:false, message:"Senha incorreta." }); return;
    }

    // criar sessão (12h)
    const token = signSession({ email: e, exp: Date.now() + 12*60*60*1000 });
    res.setHeader("Set-Cookie",
      `tufds_session=${token}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${12*60*60}`);

    res.status(200).json({ ok:true, message:"Autenticado." });
  } catch (err) {
    console.error("Erro no login:", err);
    res.status(500).json({ ok:false, message: err?.message || String(err) });
  }
}
