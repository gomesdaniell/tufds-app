import { google } from "googleapis";

const SHEET_ID = process.env.SHEET_ID || process.env.PLANILHA_ID_FIN;
const SA_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const SA_KEY   = (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");

const TAB_LANC = "Lançamentos";
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

function parseNumber(str) {
  if (!str) return 0;
  let s = String(str).trim().replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return isNaN(n) ? 0 : n;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, message: "Method Not Allowed" });
    return;
  }

  try {
    const body = await req.json?.() || req.body || {};
    const {
      dataMovimento, tipo, categoria, descricao,
      valor, nomeAssociado, formaPagamento
    } = body;

    if (!SHEET_ID) throw new Error("SHEET_ID não configurado.");
    if (!dataMovimento) throw new Error("Data do movimento ausente.");
    if (!tipo) throw new Error("Tipo obrigatório.");
    if (!categoria) throw new Error("Categoria obrigatória.");
    if (!descricao) throw new Error("Descrição obrigatória.");

    const valorNum = parseNumber(valor);
    if (valorNum <= 0) throw new Error("Valor inválido.");

    const sheets = await getSheetsClient();
    const now = new Date();

    const dt = new Date(`${dataMovimento}T00:00:00`);
    const carimbo = new Intl.DateTimeFormat("pt-BR", {
      timeZone: TZ, dateStyle: "short", timeStyle: "medium"
    }).format(now);

    const dataFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ }).format(dt);
    const mesRef = dt.toLocaleString("pt-BR", { month: "2-digit", timeZone: TZ });
    const anoRef = dt.getFullYear();
    const mesNum = dt.getMonth() + 1;
    const sinal = tipo.toLowerCase() === "receita" ? 1 : -1;
    const valorAssinado = valorNum * sinal;

    const linha = [
      carimbo, dataFmt, mesRef, anoRef, tipo, categoria, descricao,
      valorNum, nomeAssociado || "", formaPagamento || "",
      anoRef, mesNum, sinal, valorAssinado
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: TAB_LANC,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [linha] },
    });

    res.status(200).json({ ok: true, msg: "Lançamento salvo com sucesso!" });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message || String(err) });
  }
}
