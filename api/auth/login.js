import crypto from "crypto";
import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ ok: false, message: "Método inválido" });

  try {
    const { email, senha } = req.body;
    if (!email || !senha)
      return res.status(400).json({ ok: false, message: "E-mail e senha são obrigatórios." });

    // Autenticação com o Google
    const serviceAccountAuth = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const doc = new GoogleSpreadsheet(process.env.PLANILHA_ID, serviceAccountAuth);
    await doc.loadInfo();

    const sheet = doc.sheetsByTitle["Cadastro"];
    const rows = await sheet.getRows();

    // Localiza usuário pelo e-mail (coluna F)
    const userRow = rows.find(r => String(r["E-mail"]).trim().toLowerCase() === email.toLowerCase());
    if (!userRow)
      return res.status(404).json({ ok: false, message: "E-mail não encontrado." });

    // Obtém o hash armazenado (coluna AC)
    const senhaHashPlanilha = String(userRow["SENHA_HASH"] || "").trim();
    if (!senhaHashPlanilha)
      return res.status(400).json({ ok: false, message: "Usuário sem senha cadastrada." });

    // Gera hash da senha digitada
    const senhaDigitadaHash = crypto.createHash("sha256").update(senha).digest("hex");

    // Compara os hashes
    if (senhaDigitadaHash !== senhaHashPlanilha) {
      return res.status(401).json({ ok: false, message: "Senha incorreta." });
    }

    // Login bem-sucedido
    res.json({ ok: true, message: "Autenticado com sucesso." });
  } catch (err) {
    console.error("Erro no login:", err);
    res.status(500).json({ ok: false, message: "Erro interno: " + err.message });
  }
}
