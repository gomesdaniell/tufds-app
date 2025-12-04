// lib/sheets.js
import { google } from 'googleapis';

export async function getSheetsClient(scopes = ['https://www.googleapis.com/auth/spreadsheets']) {
  const creds = JSON.parse(process.env.GOOGLE_CREDENTIALS);
  const auth = new google.auth.JWT(
    creds.client_email,
    null,
    creds.private_key,
    scopes
  );
  const sheets = google.sheets({ version: 'v4', auth });
  return { sheets, spreadsheetId: process.env.SHEET_ID };
}

export async function readRange(range) {
  const { sheets, spreadsheetId } = await getSheetsClient(['https://www.googleapis.com/auth/spreadsheets.readonly']);
  const r = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  return r.data.values || [];
}
