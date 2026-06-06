// Resuelve la foto de un producto por su codigo de barra (EAN), combinando:
//   1) fotos que han subido usuarios (backend compartido) -> foto "propia"
//   2) Open Food Facts (base abierta) -> foto "referencial"
// Cachea el resultado en memoria + localStorage para no repetir llamadas.
//
// Devuelve { url, name, source } | null   donde source = 'user' | 'off'.

import { fetchUserPhotos } from './backend.js';

const CACHE_KEY = 'cx_product_img_v2';
const OFF = 'https://world.openfoodfacts.org/api/v2/product';

let cache = null;
function loadCache() {
  if (cache) return cache;
  try { cache = JSON.parse(localStorage.getItem(CACHE_KEY)) || {}; } catch { cache = {}; }
  return cache;
}
function saveCache() {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch { /* lleno */ }
}

function clean(code) {
  return String(code || '').replace(/\D/g, '');
}

// Consulta Open Food Facts para un codigo. { url, name } | null.
async function fromOFF(code) {
  try {
    const res = await fetch(`${OFF}/${code}.json?fields=product_name,image_front_small_url`, {
      headers: { Accept: 'application/json' }
    });
    if (!res.ok) throw new Error(`OFF ${res.status}`);
    const data = await res.json();
    const prod = data && data.status === 1 ? data.product : null;
    const url = prod?.image_front_small_url || null;
    return url ? { url, name: prod?.product_name || '' } : null;
  } catch {
    return null;
  }
}

const inflight = new Map();

// Resuelve la foto de un solo codigo (con cache). source: 'user' | 'off'.
export async function fetchProductImage(barcode) {
  const code = clean(barcode);
  if (code.length < 8) return null;

  const c = loadCache();
  if (Object.prototype.hasOwnProperty.call(c, code)) return c[code];
  if (inflight.has(code)) return inflight.get(code);

  const p = (async () => {
    // 1) foto de usuario (compartida)
    const userPhotos = await fetchUserPhotos([code]);
    const u = userPhotos[code];
    if (u?.photo) {
      const result = { url: u.photo, name: u.name || '', source: 'user' };
      c[code] = result; saveCache();
      return result;
    }
    // 2) referencial (Open Food Facts)
    const off = await fromOFF(code);
    const result = off ? { url: off.url, name: off.name, source: 'off' } : null;
    c[code] = result; saveCache();   // cacheamos tambien el null
    return result;
  })().finally(() => inflight.delete(code));

  inflight.set(code, p);
  return p;
}

// Invalida la cache de un codigo (tras subir una foto nueva).
export function invalidateProductImage(barcode) {
  const code = clean(barcode);
  const c = loadCache();
  if (code in c) { delete c[code]; saveCache(); }
}
