// Logica de comparacion de precios.
//
// Modelo de un registro (entry):
//   { id, barcode, product, productKey, unit, supermarket, supermarketKey,
//     city, cityKey, price (number, CLP), photo (dataURL|null),
//     createdAt, updatedAt }
//
// Reglas:
// - Para cada producto, en cada supermercado, vale el precio con la fecha de
//   actualizacion MAS reciente (el ultimo dato que subio alguien).
// - Un "grupo de comparacion" junta el mismo producto dentro de una ciudad,
//   con el precio vigente de cada supermercado. El criterio de "mismo producto"
//   es el CODIGO DE BARRA (EAN) si existe -- asi un Jumbo y un Lider comparan el
//   mismo producto aunque cada boleta escriba el nombre distinto. Si no hay
//   codigo, cae a nombre + unidad.
// - El ranking ordena los grupos por la mayor diferencia entre el supermercado
//   mas caro y el mas barato (ahorro potencial).

import { normalize } from './catalog.js';

// Deja solo digitos del codigo de barra (EAN/UPC). '' si no hay codigo valido.
export function normalizeBarcode(code) {
  const digits = String(code || '').replace(/\D/g, '');
  // EAN-8/12/13/14 tienen 8..14 digitos; ignoramos basura mas corta/larga.
  return digits.length >= 8 && digits.length <= 14 ? digits : '';
}

export function makeEntry({ barcode, product, unit, supermarket, city, price, photo }) {
  const now = new Date().toISOString();
  return {
    id: (crypto?.randomUUID?.() || `e_${Date.now()}_${Math.random().toString(36).slice(2)}`),
    barcode: normalizeBarcode(barcode),
    product: String(product || '').trim(),
    productKey: normalize(product),
    unit: String(unit || '').trim(),
    supermarket: String(supermarket || '').trim(),
    supermarketKey: normalize(supermarket),
    city: String(city || '').trim(),
    cityKey: normalize(city),
    price: Number(price) || 0,
    photo: photo || null,
    createdAt: now,
    updatedAt: now
  };
}

// Clave que identifica "el mismo producto comparable":
//   - si hay codigo de barra -> "ean:<codigo>" (match exacto entre supermercados)
//   - si no -> nombre + unidad (como fallback)
function groupKey(entry) {
  const bc = normalizeBarcode(entry.barcode);
  if (bc) return `ean:${bc}`;
  return entry.unit ? `${entry.productKey}|${entry.unit.toLowerCase()}` : entry.productKey;
}

// Lista de ciudades presentes en los datos, con cuantos registros tiene cada una.
export function citiesFromEntries(entries) {
  const map = new Map();
  for (const e of entries) {
    if (!e.cityKey) continue;
    const cur = map.get(e.cityKey);
    if (cur) cur.count += 1;
    else map.set(e.cityKey, { key: e.cityKey, name: e.city, count: 1 });
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

// Para un conjunto de entries (ya filtrado por ciudad), arma los grupos de
// comparacion. Devuelve un arreglo de:
//   { key, product, unit, prices:[{supermarket, price, updatedAt, photo, id}],
//     cheapest, dearest, min, max, diff, diffPct, count }
// donde `prices` ya trae solo el precio vigente (mas reciente) por supermercado.
export function buildComparisons(entries) {
  const groups = new Map();

  for (const e of entries) {
    if (!e.productKey || !e.supermarketKey || !e.price) continue;
    const gk = groupKey(e);
    let g = groups.get(gk);
    if (!g) {
      g = { key: gk, barcode: normalizeBarcode(e.barcode), product: e.product, unit: e.unit, bySuper: new Map() };
      groups.set(gk, g);
    }
    // Nos quedamos con el registro mas reciente por supermercado.
    const prev = g.bySuper.get(e.supermarketKey);
    if (!prev || new Date(e.updatedAt) > new Date(prev.updatedAt)) {
      g.bySuper.set(e.supermarketKey, e);
    }
  }

  const result = [];
  for (const g of groups.values()) {
    const prices = [...g.bySuper.values()]
      .map((e) => ({
        supermarket: e.supermarket,
        supermarketKey: e.supermarketKey,
        product: e.product,
        price: e.price,
        updatedAt: e.updatedAt,
        photo: e.photo,
        id: e.id
      }))
      .sort((a, b) => a.price - b.price);

    if (prices.length === 0) continue;

    const min = prices[0].price;
    const max = prices[prices.length - 1].price;
    const diff = max - min;
    const diffPct = min > 0 ? Math.round((diff / min) * 100) : 0;

    result.push({
      key: g.key,
      barcode: g.barcode,
      product: g.product,
      unit: g.unit,
      prices,
      cheapest: prices[0],
      dearest: prices[prices.length - 1],
      min,
      max,
      diff,
      diffPct,
      count: prices.length
    });
  }

  return result;
}

// Ranking por mayor diferencia. Por defecto exige al menos 2 supermercados
// (sin comparacion no hay diferencia que mostrar).
export function rankByDifference(comparisons, { minStores = 2 } = {}) {
  return comparisons
    .filter((c) => c.count >= minStores)
    .sort((a, b) => b.diff - a.diff || b.diffPct - a.diffPct);
}

// Fecha de la ultima actualizacion en un conjunto de entries (para el sello
// "ultima actualizacion" del filtro de ciudad).
export function lastUpdatedAt(entries) {
  let max = null;
  for (const e of entries) {
    if (!max || new Date(e.updatedAt) > new Date(max)) max = e.updatedAt;
  }
  return max;
}
