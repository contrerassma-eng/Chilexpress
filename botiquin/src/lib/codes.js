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
 * UPC-E (8 digitos) -> UPC-A (12).
 *
 * Los codigos cortos de las cajas chicas son un UPC-A comprimido: el ultimo
 * digito de datos dice donde van los ceros que se omitieron. Un mismo envase
 * puede leerse comprimido o expandido segun el lector, y sin esto quedarian
 * como dos productos distintos.
 */
export function upceAUpca(e) {
  if (!/^\d{8}$/.test(e)) return '';
  const sistema = e[0];
  if (sistema !== '0' && sistema !== '1') return '';
  const d = e.slice(1, 7);
  const verificador = e[7];
  const modo = d[5];

  let cuerpo;
  if ('012'.includes(modo)) cuerpo = `${d[0]}${d[1]}${modo}0000${d[2]}${d[3]}${d[4]}`;
  else if (modo === '3') cuerpo = `${d[0]}${d[1]}${d[2]}00000${d[3]}${d[4]}`;
  else if (modo === '4') cuerpo = `${d[0]}${d[1]}${d[2]}${d[3]}00000${d[4]}`;
  else cuerpo = `${d[0]}${d[1]}${d[2]}${d[3]}${d[4]}0000${modo}`;

  return `${sistema}${cuerpo}${verificador}`;
}

/** UPC-A (12) -> UPC-E (8). Devuelve las formas validas, que pueden ser dos. */
export function upcaAUpce(a) {
  if (!/^\d{12}$/.test(a)) return [];
  const sistema = a[0];
  if (sistema !== '0' && sistema !== '1') return [];
  const fab = a.slice(1, 6);
  const prod = a.slice(6, 11);
  const verificador = a[11];
  const formas = [];

  if ('012'.includes(fab[2]) && fab[3] === '0' && fab[4] === '0' && prod.startsWith('00')) {
    formas.push(`${fab[0]}${fab[1]}${prod[2]}${prod[3]}${prod[4]}${fab[2]}`);
  }
  if (fab[3] === '0' && fab[4] === '0' && prod.startsWith('000')) {
    formas.push(`${fab[0]}${fab[1]}${fab[2]}${prod[3]}${prod[4]}3`);
  }
  if (fab[4] === '0' && prod.startsWith('0000')) {
    formas.push(`${fab[0]}${fab[1]}${fab[2]}${fab[3]}${prod[4]}4`);
  }
  if (prod.startsWith('0000') && '56789'.includes(prod[4])) {
    formas.push(`${fab}${prod[4]}`);
  }

  return formas.map((d) => `${sistema}${d}${verificador}`);
}

/**
 * Digito verificador de EAN-13 / EAN-8 / UPC-A.
 *
 * Regla unica: el digito mas a la derecha del cuerpo pesa 3, y de ahi
 * alternando 1,3,1,3... hacia la izquierda.
 */
export function digitoVerificador(codigo) {
  const cuerpo = String(codigo).slice(0, -1);
  let suma = 0;
  for (let i = cuerpo.length - 1; i >= 0; i -= 2) suma += cuerpo.charCodeAt(i) - 48;
  suma *= 3;
  for (let i = cuerpo.length - 2; i >= 0; i -= 2) suma += cuerpo.charCodeAt(i) - 48;
  return (10 - (suma % 10)) % 10;
}

/**
 * true  -> el codigo trae verificador y cuadra (se puede aceptar al toque)
 * false -> trae verificador y NO cuadra (lectura mala, a la basura)
 * null  -> no hay nada que verificar (Code-128 alfanumerico, DataMatrix GS1)
 *
 * Sirve para leer rapido sin perder precision: si el verificador cuadra basta
 * una lectura, y solo cuando no hay como comprobar exigimos repetirla.
 */
export function validarCodigo(code) {
  const s = String(code || '').trim();
  if (!/^\d+$/.test(s)) return null;

  // Un UPC-E se verifica sobre su forma expandida.
  if (s.length === 8 && (s[0] === '0' || s[0] === '1')) {
    const upca = upceAUpca(s);
    if (upca && Number(upca[11]) === digitoVerificador(upca)) return true;
    // Si no cuadra como UPC-E todavia puede ser un EAN-8 legitimo.
  }

  if (s.length !== 8 && s.length !== 12 && s.length !== 13) return null;
  return Number(s[s.length - 1]) === digitoVerificador(s);
}

/**
 * Todas las claves con las que ese mismo producto pudo haberse guardado.
 * Se usa solo para buscar, no para guardar: asi un producto viejo anotado con
 * el codigo comprimido se sigue encontrando al escanearlo expandido.
 */
export function variantesGtin(code) {
  const crudo = String(code || '').trim();
  const normal = normalizeGtin(crudo);
  const claves = new Set([normal, crudo].filter(Boolean));
  const digitos = normal.replace(/\D/g, '');
  if (!digitos) return [...claves];

  let upca = '';
  if (digitos.length === 12) upca = digitos;
  else if (digitos.length === 13 && digitos.startsWith('0')) upca = digitos.slice(1);
  else if (digitos.length === 8) upca = upceAUpca(digitos);

  if (upca) {
    claves.add(upca);
    claves.add(`0${upca}`);
    for (const upce of upcaAUpce(upca)) claves.add(upce);
  }

  return [...claves];
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
