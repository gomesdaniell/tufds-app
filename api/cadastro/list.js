// api/cadastro/list.js
import { readRange } from '../../lib/sheets.js';

// normaliza cabeçalhos em chaves seguras (sem quebras de linha, acentos, etc.)
function normalizeHeader(h = '') {
  return String(h)
    .replace(/\r?\n+/g, ' ')                  // quebra de linha -> espaço
    .replace(/\s+/g, ' ')                     // espaços múltiplos -> 1
    .trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^A-Za-z0-9]+/g, '_')           // não-alfanumérico -> _
    .replace(/^_+|_+$/g, '');                 // limpa underscores nas pontas
}

export default async function handler(req, res) {
  try {
    // você pode ajustar o intervalo se tiver mais colunas (AZ = 52 colunas)
    const range = 'Cadastro!A1:AZ';
    const rows = await readRange(range);
    if (!rows.length) return res.status(200).json({ ok: true, count: 0, items: [] });

    const [rawHeader, ...data] = rows;
    const header = rawHeader.map(h => h ?? '');
    const keys = header.map(h => normalizeHeader(h));

    // cria os objetos linha a partir do cabeçalho
    let items = data.map(r => {
      const o = {};
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i] || `col_${i+1}`;
        o[key] = r[i] ?? '';
      }
      // opcional: espelha alguns nomes "amigáveis"
      o._original = {}; // guarda cabeçalhos originais caso precise depurar
      for (let i = 0; i < keys.length; i++) o._original[keys[i] || `col_${i+1}`] = header[i];
      return o;
    });

    // filtros opcionais via querystring
    const { ativo, mes, limit } = req.query || {};
    if (ativo) {
      // procura por coluna chamada "Ativo?" (normalizada vira "Ativo")
      const ativoKey = keys.find(k => /^Ativo_?$/.test(k)) || 'Ativo';
      items = items.filter(x => String(x[ativoKey] || '').toLowerCase() === String(ativo).toLowerCase());
    }
    if (mes) {
      // tenta usar colunas com "Mes" ou "Mês"
      const mesKey = keys.find(k => /^Mes$/.test(k)) || keys.find(k => /^Mes_?$/.test(k));
      if (mesKey) items = items.filter(x => String(x[mesKey] || '').toLowerCase() === String(mes).toLowerCase());
    }

    const lim = Number(limit) > 0 ? Number(limit) : items.length;
    return res.status(200).json({ ok: true, count: Math.min(lim, items.length), items: items.slice(0, lim) });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: String(e) });
  }
}
