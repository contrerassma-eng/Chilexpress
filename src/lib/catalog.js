// Catalogos de apoyo para el comparador de precios.
// Son solo sugerencias: la app permite escribir texto libre en todos los campos,
// pero normalizamos para poder agrupar el mismo producto / supermercado / ciudad
// aunque cada usuario lo escriba un poco distinto.

// Supermercados comunes en Chile (sugerencias para el datalist).
export const SUPERMERCADOS = [
  'Jumbo',
  'Lider',
  'Santa Isabel',
  'Tottus',
  'Unimarc',
  'Acuenta',
  'Ekono',
  'Mayorista 10',
  'Alvi',
  'Montserrat',
  'Erbi'
];

// Ciudades / comunas frecuentes (sugerencias para el datalist).
export const CIUDADES = [
  'Santiago',
  'Valparaiso',
  'Vina del Mar',
  'Concepcion',
  'La Serena',
  'Antofagasta',
  'Temuco',
  'Rancagua',
  'Talca',
  'Iquique',
  'Puerto Montt',
  'Arica',
  'Chillan',
  'Calama',
  'Osorno'
];

// Unidades de medida sugeridas para comparar manzanas con manzanas.
export const UNIDADES = ['un', 'kg', 'g', 'L', 'ml', 'pack', 'docena'];

// Quita acentos, espacios repetidos y pasa a minuscula para comparar/agrupar.
export function normalize(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

// "Title Case" suave para mostrar de forma prolija lo que escribio el usuario.
export function titleCase(text) {
  const t = String(text || '').trim().replace(/\s+/g, ' ');
  if (!t) return '';
  return t
    .toLowerCase()
    .split(' ')
    .map((w) => (w.length > 2 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}
