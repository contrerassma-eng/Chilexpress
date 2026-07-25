import { parseGs1 } from './gs1.js';

/**
 * Normaliza el codigo para que la misma caja sea siempre el mismo producto,
 * la leas por su EAN-13, por el UPC-A gringo o por el DataMatrix GS1.
 */
export function normalizeGtin(code) {
  const d = String(code || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.length === 14 && d.startsWith('0')) return d.slice(1); // GTIN-14 -> EAN-13
  if (d.length === 12) return `0${d}`;                          // UPC-A  -> EAN-13
  return d;
}

/**
 * Traduce lo que devolvio la camara a { barcode, expiry, lote }.
 * `strict` (camara) solo acepta codigos crecibles; en carga manual dejamos pasar
 * cualquier cosa que el usuario escriba.
 */
export function decodeScan(raw, { strict = true } = {}) {
  const texto = String(raw || '').trim();
  if (!texto) return null;

  const gs1 = parseGs1(texto);
  if (gs1) {
    const barcode = normalizeGtin(gs1.gtin || '');
    if (!barcode) return null;
    return { barcode, expiry: gs1.expiry || '', lote: gs1.lote || '', fuente: 'gs1' };
  }

  const digitos = texto.replace(/\D/g, '');
  if (/^\d{8,14}$/.test(digitos) && digitos.length === texto.length) {
    return { barcode: normalizeGtin(digitos), expiry: '', lote: '', fuente: 'ean' };
  }

  if (strict) return null;
  return { barcode: texto.toUpperCase().slice(0, 60), expiry: '', lote: '', fuente: 'manual' };
}

// Codigo interno para lo que no tiene codigo de barras (jarabes sueltos, gasas).
export function codigoSinBarras(nombre) {
  const base = String(nombre || 'item')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24);
  return `sc-${base || 'item'}`;
}
