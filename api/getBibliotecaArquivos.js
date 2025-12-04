// api/getBibliotecaArquivos.js
import { google } from 'googleapis';

const BIB_LIMIT_DEFAULT = 200;

// Mapeia mime para ícone (mesmo do front)
function iconForMime(mime = '') {
  const m = String(mime).toLowerCase();
  if (m.includes('google-apps.document'))    return '📄';
  if (m.includes('google-apps.spreadsheet')) return '📊';
  if (m.includes('google-apps.presentation'))return '📽';
  if (m.includes('application/pdf'))         return '🧾';
  if (m.startsWith('image/'))                return '🖼️';
  if (m.startsWith('video/'))                return '🎞️';
  if (m.startsWith('audio/'))                return '🎧';
  if (m.includes('zip') || m.includes('compressed')) return '🗜️';
  return '📦';
}

function passaFiltroMime(mf, mime='') {
  const m = String(mime).toLowerCase();
  const isDoc   = m.includes('application/vnd.google-apps.document');
  const isSheet = m.includes('application/vnd.google-apps.spreadsheet');
  const isSlide = m.includes('application/vnd.google-apps.presentation');
  const isPdf   = m.includes('application/pdf');
  const isImg   = m.startsWith('image/');
  switch ((mf || 'all').toLowerCase()) {
    case 'docs':   return isDoc;
    case 'sheets': return isSheet;
    case 'slides': return isSlide;
    case 'pdf':    return isPdf;
    case 'img':    return isImg;
    default:       return true;
  }
}

export default async function handler(req, res) {
  try {
    const {
      searchText = '',
      mimeFilter = 'all',
      limit,
      folderId
    } = req.query || {};

    const FOLDER_ID = folderId || process.env.GOOGLE_DRIVE_BIB_FOLDER_ID;
    if (!FOLDER_ID) {
      return res.status(400).json({ error: 'Missing GOOGLE_DRIVE_BIB_FOLDER_ID' });
    }

    const privateKey = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    if (!privateKey || !clientEmail) {
      return res.status(400).json({ error: 'Missing GOOGLE_PRIVATE_KEY or GOOGLE_CLIENT_EMAIL' });
    }

    const jwt = new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });

    const drive = google.drive({ version: 'v3', auth: jwt });

    // Consulta apenas arquivos (sem pastas), não-lixeira, dentro da pasta
    // Suporta Shared Drives
    const pageSize = Math.min(Number(limit) || BIB_LIMIT_DEFAULT, 1000);
    const q = `'${FOLDER_ID}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'`;

    const resp = await drive.files.list({
      q,
      pageSize,
      fields: 'files(id,name,mimeType,modifiedTime,size,webViewLink)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      orderBy: 'name',
    });

    const tz = process.env.TZ_MANAUS_APP || 'America/Manaus';
    const term = String(searchText || '').toLowerCase().trim();

    let files = (resp.data.files || [])
      .filter(f => !term || (f.name || '').toLowerCase().includes(term))
      .filter(f => passaFiltroMime(mimeFilter, f.mimeType))
      .map(f => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        url: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`,
        lastUpdated: f.modifiedTime
          ? new Intl.DateTimeFormat('pt-BR', { timeZone: tz, dateStyle: 'short', timeStyle: 'short' }).format(new Date(f.modifiedTime))
          : '',
        icon: iconForMime(f.mimeType),
        sizeBytes: Number(f.size || 0),
      }));

    // como segurança: ordena por nome (Drive já retorna, mas garantimos)
    files = files.sort((a,b)=> a.name.localeCompare(b.name, 'pt-BR'));

    res.status(200).json({ arquivos: files });
  } catch (err) {
    console.error('getBibliotecaArquivos error:', err);
    res.status(500).json({ error: 'DRIVE_LIST_FAILED', message: err?.message });
  }
}
