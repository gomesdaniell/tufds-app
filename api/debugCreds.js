// api/debugCreds.js
export default async function handler(req, res) {
  try {
    const fromJson = !!process.env.GOOGLE_CREDENTIALS;
    const hasEmail = !!process.env.GOOGLE_CLIENT_EMAIL;
    const hasKey   = !!process.env.GOOGLE_PRIVATE_KEY;
    const sheetId  = process.env.SHEETS_SPREADSHEET_ID || process.env.SHEET_ID || null;

    let pkInfo = null;
    if (hasKey) {
      const pk = String(process.env.GOOGLE_PRIVATE_KEY);
      pkInfo = {
        length: pk.length,
        startsWith: pk.slice(0, 31),
        endsWith: pk.slice(-31),
        containsEscapedNewlines: /\\n/.test(pk),
      };
    }

    res.status(200).json({
      ok: true,
      sourceBeingUsed: fromJson ? 'GOOGLE_CREDENTIALS' : 'SEPARATED_ENVS',
      hasGOOGLE_CREDENTIALS: fromJson,
      hasGOOGLE_CLIENT_EMAIL: hasEmail,
      hasGOOGLE_PRIVATE_KEY: hasKey,
      hasSheetId: !!sheetId,
      sheetIdSample: sheetId ? `${sheetId.slice(0,6)}…${sheetId.slice(-6)}` : null,
      privateKeyMeta: pkInfo,
      note: 'Se sourceBeingUsed for GOOGLE_CREDENTIALS, remova/renomeie GOOGLE_CREDENTIALS para usar as variáveis separadas.',
    });
  } catch (e) {
    res.status(500).json({ ok:false, error: String(e) });
  }
}
