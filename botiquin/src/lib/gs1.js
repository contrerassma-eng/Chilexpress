/**
 * Lectura de codigos GS1 (DataMatrix / QR de las cajas de remedios).
 *
 * Las cajas nuevas traen un DataMatrix con el GTIN, la fecha de caducidad y el
 * lote codificados como "element string". Si logramos leerlo, la app rellena
 * sola la fecha de vencimiento y el usuario solo escribe el nombre.
 *
 * Ejemplo: 010775006000019417270531102ABC123
 *          01 -> GTIN 07750060000194
 *          17 -> caducidad 27-05-31
 *          10 -> lote 2ABC123 (variable, termina en FNC1 o fin de cadena)
 */

const GS = '\x1d'; // FNC1 / group separator

// Largo fijo del dato para los AI que nos interesan.
const FIXED = {
  '00': 18, '01': 14, '02': 14,
  '11': 6, '12': 6, '13': 6, '15': 6, '16': 6, '17': 6,
  '20': 2
};

function stripSymbology(raw) {
  // ]d2 DataMatrix GS1, ]C1 Code128 GS1, ]Q3 QR GS1, ]e0 databar
  return raw.replace(/^\](?:d2|C1|Q3|e0|E0)/i, '');
}

export function looksLikeGs1(raw) {
  const s = String(raw || '');
  if (/^\](?:d2|C1|Q3|e0|E0)/i.test(s)) return true;
  if (s.includes(GS)) return true;
  // "01" + GTIN de 14 digitos = 16 caracteres; un EAN-13 nunca llega a ese largo.
  return s.length >= 16 && /^01\d{14}/.test(s);
}

// 'YYMMDD' -> 'YYYY-MM-DD'. Dia 00 significa "fin de mes" segun GS1.
export function gs1DateToIso(yymmdd) {
  if (!/^\d{6}$/.test(yymmdd)) return '';
  const yy = Number(yymmdd.slice(0, 2));
  const mm = Number(yymmdd.slice(2, 4));
  let dd = Number(yymmdd.slice(4, 6));
  if (mm < 1 || mm > 12) return '';
  // Regla GS1: 00-50 es 20xx, 51-99 es 19xx.
  const year = yy <= 50 ? 2000 + yy : 1900 + yy;
  if (dd === 0) dd = new Date(year, mm, 0).getDate();
  return `${year}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

/**
 * Devuelve { gtin, expiry, lote, serie } o null si no es un codigo GS1 valido.
 */
export function parseGs1(raw) {
  const s = stripSymbology(String(raw || ''));
  if (!looksLikeGs1(raw)) return null;

  const out = {};
  let i = 0;
  let guard = 0;

  while (i < s.length && guard++ < 40) {
    if (s[i] === GS) { i += 1; continue; }
    const ai2 = s.slice(i, i + 2);
    if (!/^\d{2}$/.test(ai2)) break;

    const largo = FIXED[ai2];
    if (largo) {
      const dato = s.slice(i + 2, i + 2 + largo);
      if (dato.length < largo) break;
      if (ai2 === '01') out.gtin = dato;
      else if (ai2 === '17') out.expiry = gs1DateToIso(dato);
      else if (ai2 === '11') out.fabricacion = gs1DateToIso(dato);
      i += 2 + largo;
      continue;
    }

    // AI de largo variable: el dato llega hasta el FNC1 o hasta el final.
    const fin = s.indexOf(GS, i + 2);
    const dato = fin === -1 ? s.slice(i + 2) : s.slice(i + 2, fin);
    if (ai2 === '10') out.lote = dato;
    else if (ai2 === '21') out.serie = dato;
    i = fin === -1 ? s.length : fin + 1;
  }

  return out.gtin || out.expiry ? out : null;
}
