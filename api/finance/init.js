// api/finance/init.js
import { google } from "googleapis";

const SHEET_ID = process.env.SHEET_ID || process.env.PLANILHA_ID_FIN;
const SA_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const SA_KEY = (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");

const TAB_CATEGORIAS = "Categorias";
const TAB_CADASTRO = "Cadastro";
const TZ = "America/Manaus";

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
  try {
    const sheets = await getSheetsClient();

    // 🟢 CATEGORIAS
    const catResp = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${TAB_CATEGORIAS}!A2:A`,
    });
    const categorias = (catResp.data.values || [])
      .map(r => String(r[0]).trim())
      .filter(v => v);

    // 🟢 NOMES (coluna “Nome completo” e “Ativo?”)
    const cadResp = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${TAB_CADASTRO}!A:Z`,
    });

    const rows = cadResp.data.values || [];
    const header = rows[0]?.map(h => h.trim().toLowerCase()) || [];
    const iNome = header.findIndex(h => h.includes("nome completo"));
    const iAtivo = header.findIndex(h => h.includes("ativo"));

    let nomes = [];
    if (iNome >= 0 && iAtivo >= 0) {
      nomes = rows
        .slice(1)
        .filter(r => String(r[iAtivo] || "").toLowerCase().includes("sim"))
        .map(r => r[iNome])
        .filter(v => v && v.trim() !== "")
        .sort((a, b) => a.localeCompare(b, "pt-BR"));
    }

    const hojeISO = new Date().toISOString().slice(0, 10);
    res.status(200).json({ ok: true, categorias, nomes, hojeISO });
  } catch (err) {
    console.error("Erro no init:", err);
    res.status(500).json({ ok: false, message: err.message });
  }
}
