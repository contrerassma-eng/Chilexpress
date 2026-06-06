// Busca la foto de un producto por su codigo de barra (EAN) en Open Food Facts,
// una base de datos abierta y gratuita. Cachea el resultado en localStorage
// para no repetir la llamada (incluye los "no encontrado" para no reintentar
// en cada render).
//
// No requiere API key. Devuelve la URL de la imagen o null.

const CACHE_KEY = 'cx_product_img_v1';
const OFF = 'https://world.openfoodfacts.org/api/v2/product';

let cache = null;
function loadCache() {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(CACHE_KEY)) || {};
  } catch {
    cache = {};
  }
  return cache;
}
function saveCache() {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* localStorage lleno: no es critico */
  }
}

// Peticiones en vuelo, para no disparar dos veces el mismo barcode a la vez.
const inflight = new Map();

// Devuelve { url, name } | null. `name` es el nombre oficial del producto en
// OFF (puede servir para enriquecer el dato), `url` la miniatura frontal.
export async function fetchProductImage(barcode) {
  const code = String(barcode || '').replace(/\D/g, '');
  if (code.length < 8) return null;

  const c = loadCache();
  if (Object.prototype.hasOwnProperty.call(c, code)) {
    return c[code]; // puede ser null (cacheamos el "no hay")
  }
  if (inflight.has(code)) return inflight.get(code);

  const p = (async () => {
    try {
      const res = await fetch(
        `${OFF}/${code}.json?fields=product_name,image_front_small_url`,
        { headers: { Accept: 'application/json' } }
      );
      if (!res.ok) throw new Error(`OFF ${res.status}`);
      const data = await res.json();
      const prod = data && data.status === 1 ? data.product : null;
      const url = prod?.image_front_small_url || null;
      const result = url ? { url, name: prod?.product_name || '' } : null;
      c[code] = result;
      saveCache();
      return result;
    } catch {
      // Error de red: NO lo cacheamos (para reintentar luego), devolvemos null.
      return null;
    } finally {
      inflight.delete(code);
    }
  })();

  inflight.set(code, p);
  return p;
}
