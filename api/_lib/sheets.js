// api/_lib/sheets.js
const { GoogleSpreadsheet } = require('google-spreadsheet');

async function getDoc() {
  const sheetId = process.env.PLANILHA_ID;
  if (!sheetId) throw new Error('PLANILHA_ID não definido');

  const client_email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const private_key = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

  if (!client_email || !private_key) {
    throw new Error('Credenciais Google ausentes: defina GOOGLE_SERVICE_ACCOUNT_EMAIL e GOOGLE_PRIVATE_KEY');
  }

  const doc = new GoogleSpreadsheet(sheetId);
  await doc.useServiceAccountAuth({ client_email, private_key });
  await doc.loadInfo(); // carrega metadados
  return doc;
}

module.exports = { getDoc };
