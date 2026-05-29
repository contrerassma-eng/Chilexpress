// Parser de boletas chilenas a partir del TEXTO crudo del OCR (sin IA).
//
// La idea: las boletas de supermercado en Chile tienen una estructura muy
// regular. Con unas pocas heuristicas robustas extraemos lo que nos importa:
//   - supermercado (cadena conocida, buscada en todo el texto)
//   - ciudad/comuna (linea de direccion)
//   - fecha de emision
//   - lineas de producto: <codigo> <descripcion> ... <valor>
//
// Devuelve { supermarket, city, date, items:[{product, unit, price}], raw }.
// Todo es tentativo: el usuario revisa y corrige en el modal antes de guardar.

// Cadenas conocidas y los alias/errores comunes que suele soltar el OCR.
const CHAINS = [
  { name: 'Unimarc', re: /unimarc|rendic\s+hermanos/i },
  { name: 'Jumbo', re: /jumbo|cencosud/i },
  { name: 'Lider', re: /l[il]der|walmart|hiper\s*l[il]der/i },
  { name: 'Santa Isabel', re: /santa\s*isabel/i },
  { name: 'Tottus', re: /tottus/i },
  { name: 'Acuenta', re: /acuenta|a\s*cuenta/i },
  { name: 'Ekono', re: /ekono/i },
  { name: 'Mayorista 10', re: /mayorista\s*10/i },
  { name: 'Alvi', re: /alvi/i },
  { name: 'Montserrat', re: /mont?serrat/i },
  { name: 'Erbi', re: /erbi/i }
];

// Comunas/ciudades frecuentes para reconocer en la linea de direccion.
const PLACES = [
  'Las Condes', 'Providencia', 'Santiago', 'Maipu', 'La Florida', 'Puente Alto',
  'Nunoa', 'Vitacura', 'San Miguel', 'Penalolen', 'La Reina', 'Macul',
  'Vina del Mar', 'Valparaiso', 'Concepcion', 'La Serena', 'Coquimbo',
  'Antofagasta', 'Temuco', 'Rancagua', 'Talca', 'Iquique', 'Puerto Montt',
  'Arica', 'Chillan', 'Calama', 'Osorno', 'Quilpue', 'Rancagua'
];

// Palabras que delatan lineas que NO son producto (encabezado, totales, etc.).
const STOPWORDS = /\b(total|subtotal|neto|iva|desglose|detalle|pagos?|tarjeta|efectivo|vuelto|cambio|boleta|giro|casa\s*matriz|sucursal|local|caja|fecha|hora|trans|codigo|desc|cant|unidad|precio\s*unitario|valor|items?|articulos?|vendidos?|debito|credito|propina|ahorro|descuento|puntos)\b/i;

// RUT chileno con o sin puntos/guion: "R.U.T.81.537", "RUT 76.123.456-7".
const RUT_LINE = /r\.?\s*u\.?\s*t\.?|\b\d{1,2}\.\d{3}\.\d{3}\s*-\s*[\dkK]\b/i;

function stripAccents(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Convierte un texto de precio chileno a numero entero CLP.
//   "$1.990" -> 1990 ; "2.090" -> 2090 ; "$1734" -> 1734
// En Chile el punto es separador de miles y normalmente no hay decimales.
export function parseCLP(text) {
  if (text == null) return null;
  const cleaned = String(text).replace(/[^\d.,]/g, '');
  if (!cleaned) return null;
  // Quitamos separadores de miles (puntos o comas) y nos quedamos con digitos.
  const digits = cleaned.replace(/[.,]/g, '');
  if (!/^\d+$/.test(digits)) return null;
  const n = parseInt(digits, 10);
  return Number.isFinite(n) ? n : null;
}

export function detectChain(text) {
  for (const c of CHAINS) if (c.re.test(text)) return c.name;
  return '';
}

export function detectCity(text) {
  const flat = stripAccents(text).toLowerCase();
  // Preferimos el lugar mas especifico (comuna) que aparezca.
  let best = '';
  for (const p of PLACES) {
    const needle = stripAccents(p).toLowerCase();
    if (flat.includes(needle) && needle.length > best.length) best = p;
  }
  return best;
}

export function detectDate(text) {
  // dd/mm/yyyy o dd-mm-yyyy (con o sin "Fecha Emision").
  const m = text.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
  if (!m) return '';
  let [, d, mo, y] = m;
  if (y.length === 2) y = '20' + y;
  const iso = `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  const dt = new Date(iso);
  return Number.isNaN(dt.getTime()) ? '' : iso;
}

// Limpia la descripcion de un producto: quita codigo de barra inicial, recorta
// y normaliza espacios. Mantiene el texto tal cual lo imprime la boleta.
function cleanDescription(desc) {
  return desc
    .replace(/^\s*\d{4,}\s+/, '')   // codigo de barra al inicio
    .replace(/\s{2,}/g, ' ')
    .replace(/[*•·]+/g, ' ')
    .trim();
}

// Detecta una linea de "cantidad x unidad precio" tipo:
//   "0,58 x 1 KG $2990 c/u"  ->  { unit: 'kg', unitPrice: 2990 }
function parseQtyLine(line) {
  const m = line.match(/x\s*\d+\s*(kg|g|lt?|ml|un|docena|pack)\b.*?\$?\s*([\d.,]+)/i);
  if (!m) return null;
  const unitRaw = m[1].toLowerCase();
  const unit = unitRaw === 'lt' ? 'L' : unitRaw === 'l' ? 'L' : unitRaw;
  return { unit, unitPrice: parseCLP(m[2]) };
}

// Heuristica de linea de producto: tiene una descripcion con letras y termina
// (o casi) en un valor en pesos. Evita lineas de totales/encabezado.
function parseItemLine(line) {
  const trimmed = line.trim();
  if (trimmed.length < 4) return null;
  if (STOPWORDS.test(trimmed)) return null;
  if (RUT_LINE.test(trimmed)) return null;
  // Las lineas de "cant x unidad precio" son modificadores, no productos.
  if (parseQtyLine(trimmed)) return null;

  // El valor es el ultimo monto con $ o el ultimo numero "grande" de la linea.
  const moneyMatches = [...trimmed.matchAll(/\$?\s*(\d[\d.,]*\d|\d)\b/g)];
  if (moneyMatches.length === 0) return null;
  const last = moneyMatches[moneyMatches.length - 1];
  const price = parseCLP(last[1]);
  if (!price || price < 50) return null; // precios reales de super >= ~$50

  // La descripcion es lo que va antes del valor final.
  let desc = trimmed.slice(0, last.index).trim();
  desc = cleanDescription(desc);

  // Necesitamos al menos algunas letras para considerarlo producto.
  const letters = (desc.match(/[a-zA-ZñÑáéíóúÁÉÍÓÚ]/g) || []).length;
  if (letters < 3) return null;

  return { product: desc, unit: 'un', price };
}

export function parseReceipt(rawText) {
  const text = String(rawText || '');
  const lines = text.split(/\r?\n/);

  const supermarket = detectChain(text);
  const city = detectCity(text);
  const date = detectDate(text);

  const items = [];
  for (let i = 0; i < lines.length; i++) {
    const item = parseItemLine(lines[i]);
    if (!item) continue;
    // Si la linea siguiente trae "cant x unidad precio", afina unidad/precio
    // (caso productos por kilo: el valor de la linea es el cobrado, pero el
    // precio comparable es el unitario por kilo).
    const qty = parseQtyLine(lines[i + 1] || '');
    if (qty) {
      if (qty.unit) item.unit = qty.unit;
      if (qty.unitPrice) item.price = qty.unitPrice;
    }
    items.push(item);
  }

  return { supermarket, city, date, items, raw: text };
}
