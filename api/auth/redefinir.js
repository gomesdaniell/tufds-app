// /api/auth/reset.js
import crypto from "crypto";
import { google } from "googleapis";

const SHEET_ID = process.env.GOOGLE_SHEETS_ID;     // ID da planilha (o mesmo da TUFDS)
const ABA_CADASTRO = "Cadastro";                   // nome da aba

// Colunas fixas que você pediu:
const COL_EMAIL = "F";     // E-mail
const COL_HASH  = "AC";    // SENHA_HASH

function letterToIndex(letter) {
  // 'A' => 1, 'Z' => 26, 'AA' => 27, 'AC' => 29 ...
  let n = 0;
  for (const ch of letter.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n; // 1-based
}

function sha256Hex(str) {
  return crypto.createHash("sha256").update(str, "utf8").digest("hex");
}

async function getSheetsClient() {
  const jwt = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  await jwt.authorize();
  return google.sheets({ version: "v4", auth: jwt });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Method not allowed" });
  }

  try {
    const { email, novaSenha } = req.body || {};
    if (!email || !novaSenha) {
      return res.status(400).json({ ok: false, message: "Informe e-mail e nova senha." });
    }

    const sheets = await getSheetsClient();

    // 1) Buscar toda a coluna F (emails) a partir da linha 2
    const rangeEmails = `${ABA_CADASTRO}!${COL_EMAIL}2:${COL_EMAIL}`;
    const respEmails = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: rangeEmails,
      majorDimension: "COLUMNS",
    });

    const colValues = (respEmails.data.values && respEmails.data.values[0]) || [];
    // Encontrar linha do e-mail (case-insensitive, trim)
    const alvo = String(email).trim().toLowerCase();
    let foundRow = -1; // linha absoluta na planilha (1-based)
    for (let i = 0; i < colValues.length; i++) {
      const cell = String(colValues[i] || "").trim().toLowerCase();
      if (cell === alvo) {
        foundRow = i + 2; // +2 pois começamos em F2
        break;
      }
    }

    if (foundRow < 0) {
      return res.status(404).json({ ok: false, message: "E-mail não encontrado na aba Cadastro." });
    }

    // 2) Gravar o hash da nova senha na coluna AC da mesma linha
    const hash = sha256Hex(novaSenha);
    const rangeDestino = `${ABA_CADASTRO}!${COL_HASH}${foundRow}:${COL_HASH}${foundRow}`;
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: rangeDestino,
      valueInputOption: "RAW",
      requestBody: { values: [[hash]] },
    });

    return res.status(200).json({ ok: true, message: "Senha atualizada com sucesso." });
  } catch (e) {
    console.error("[reset.js] erro:", e);
    return res.status(500).json({ ok: false, message: e?.message || "Falha ao redefinir senha." });
  }
}
