/**
 * API del botiquin sobre Cloudflare Workers + D1.
 *
 * Todo el estado real vive aca; los telefonos guardan una copia local y una
 * cola de movimientos pendientes. Como el id de cada movimiento lo genera el
 * telefono, reenviar la cola despues de estar sin señal nunca duplica stock.
 *
 * Rutas (piden la cabecera X-Pin solo si hay PIN configurado):
 *   GET  /api/ping       -> dice si el PIN sirve (o si no hace falta)
 *   GET  /api/state      -> inventario completo (productos + lotes)
 *   GET  /api/movements  -> ultimos movimientos
 *   POST /api/sync       -> aplica una tanda de movimientos
 *
 * Todo cambio (comprar, consumir, renombrar, borrar) es un movimiento, asi que
 * todo se puede hacer sin señal y se sube despues.
 */

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store'
};

// compra/consumo/descarte mueven stock; ajuste lo fija; nombre y borrar tocan
// solo la ficha del producto.
const KINDS = new Set(['compra', 'consumo', 'descarte', 'ajuste', 'nombre', 'borrar']);
const KINDS_SIN_CANTIDAD = new Set(['ajuste', 'nombre', 'borrar']);

// Zonas de la casa. Cualquier otra cosa se ignora y el producto queda donde estaba.
const ZONAS = new Set(['botiquin', 'despensa', 'refrigerador', 'aseo']);

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

// Comparacion en tiempo constante para no filtrar el PIN por timing.
function sameSecret(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ba = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  if (ba.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ba.length; i++) diff |= ba[i] ^ bb[i];
  return diff === 0;
}

function str(v, max = 200) {
  return String(v ?? '').trim().slice(0, max);
}

function posInt(v) {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function nonNegInt(v) {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

// Aceptamos solo 'YYYY-MM-DD'; cualquier otra cosa se guarda como sin fecha.
function expiryOf(v) {
  const s = str(v, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

function isoOf(v) {
  const s = str(v, 40);
  return s && !Number.isNaN(Date.parse(s)) ? s : new Date().toISOString();
}

async function readState(env) {
  const [products, lots] = await env.DB.batch([
    env.DB.prepare('SELECT barcode, name, note, zona, created_at, updated_at FROM products ORDER BY name'),
    env.DB.prepare('SELECT id, barcode, expiry, qty, updated_at FROM lots WHERE qty > 0')
  ]);
  return {
    products: products.results ?? [],
    lots: lots.results ?? [],
    serverTime: new Date().toISOString()
  };
}

/**
 * Aplica movimientos nuevos. Los que ya estaban en la tabla se ignoran, asi el
 * telefono puede reintentar la misma tanda sin miedo.
 */
async function applyMovements(env, raw, who) {
  const appliedAt = new Date().toISOString();

  const movements = [];
  for (const m of raw) {
    const id = str(m?.id, 60);
    const kind = str(m?.kind, 20);
    const barcode = str(m?.barcode, 60);
    if (!id || !barcode || !KINDS.has(kind)) continue;
    // En 'ajuste' el 0 es valido (dejar el lote en cero = borrarlo).
    const qty = KINDS_SIN_CANTIDAD.has(kind) ? nonNegInt(m?.qty) : posInt(m?.qty);
    if (!KINDS_SIN_CANTIDAD.has(kind) && qty === 0) continue;
    const zona = str(m?.zona, 20);
    movements.push({
      id,
      kind,
      barcode,
      name: str(m?.name, 120),
      note: str(m?.note, 200),
      zona: ZONAS.has(zona) ? zona : '',
      expiry: expiryOf(m?.expiry),
      qty,
      at: isoOf(m?.at),
      who: str(m?.who || who, 40)
    });
  }

  if (!movements.length) return [];

  const ids = movements.map((m) => m.id);
  const placeholders = ids.map(() => '?').join(',');
  const known = await env.DB
    .prepare(`SELECT id FROM movements WHERE id IN (${placeholders})`)
    .bind(...ids)
    .all();
  const seen = new Set((known.results ?? []).map((r) => r.id));

  const stmts = [];
  const bitacora = (m) =>
    env.DB.prepare(
      `INSERT OR IGNORE INTO movements (id, kind, barcode, name, expiry, qty, at, who, zona, applied_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`
    ).bind(m.id, m.kind, m.barcode, m.name, m.expiry, m.qty, m.at, m.who, m.zona, appliedAt);

  for (const m of movements) {
    if (seen.has(m.id)) continue;

    if (m.kind === 'borrar') {
      stmts.push(env.DB.prepare('DELETE FROM lots WHERE barcode = ?1').bind(m.barcode));
      stmts.push(env.DB.prepare('DELETE FROM products WHERE barcode = ?1').bind(m.barcode));
      stmts.push(bitacora(m));
      continue;
    }

    // El producto siempre existe antes de tocar sus lotes. Un movimiento sin
    // nombre o sin zona (consumo, ajuste) nunca debe pisar lo ya guardado; solo
    // si el producto es nuevo cae al codigo como nombre provisorio.
    stmts.push(
      env.DB.prepare(
        `INSERT INTO products (barcode, name, note, zona, created_at, updated_at)
         VALUES (?1, CASE WHEN ?2 <> '' THEN ?2 ELSE ?1 END, ?3,
                 CASE WHEN ?5 <> '' THEN ?5 ELSE 'botiquin' END, ?4, ?4)
         ON CONFLICT(barcode) DO UPDATE SET
           name = CASE WHEN ?2 <> '' THEN ?2 ELSE products.name END,
           note = CASE WHEN ?3 <> '' THEN ?3 ELSE products.note END,
           zona = CASE WHEN ?5 <> '' THEN ?5 ELSE products.zona END,
           updated_at = ?4`
      ).bind(m.barcode, m.name, m.note, appliedAt, m.zona)
    );

    // 'nombre' solo corrige la ficha: no toca stock.
    if (m.kind === 'nombre') {
      stmts.push(bitacora(m));
      continue;
    }

    // Los lotes se identifican por (producto, fecha de caducidad), no por el id
    // que invento el telefono: asi dos telefonos offline convergen al mismo lote.
    const lotId = `${m.barcode}|${m.expiry}`;

    if (m.kind === 'compra') {
      stmts.push(
        env.DB.prepare(
          `INSERT INTO lots (id, barcode, expiry, qty, updated_at)
           VALUES (?1, ?2, ?3, ?4, ?5)
           ON CONFLICT(barcode, expiry) DO UPDATE SET
             qty = lots.qty + excluded.qty,
             updated_at = excluded.updated_at`
        ).bind(lotId, m.barcode, m.expiry, m.qty, appliedAt)
      );
    } else if (m.kind === 'ajuste') {
      stmts.push(
        env.DB.prepare(
          `INSERT INTO lots (id, barcode, expiry, qty, updated_at)
           VALUES (?1, ?2, ?3, ?4, ?5)
           ON CONFLICT(barcode, expiry) DO UPDATE SET
             qty = excluded.qty,
             updated_at = excluded.updated_at`
        ).bind(lotId, m.barcode, m.expiry, m.qty, appliedAt)
      );
    } else {
      // consumo / descarte: nunca dejamos stock negativo.
      stmts.push(
        env.DB.prepare(
          `UPDATE lots SET qty = MAX(0, qty - ?1), updated_at = ?2
           WHERE barcode = ?3 AND expiry = ?4`
        ).bind(m.qty, appliedAt, m.barcode, m.expiry)
      );
    }

    // Un lote en cero deja de ocupar espacio; el producto queda para recordar
    // el nombre la proxima vez que se escanee.
    stmts.push(
      env.DB.prepare('DELETE FROM lots WHERE barcode = ?1 AND expiry = ?2 AND qty <= 0')
        .bind(m.barcode, m.expiry)
    );

    stmts.push(bitacora(m));
  }

  if (stmts.length) await env.DB.batch(stmts);
  return ids;
}

async function handle(request, env, url) {
  const path = url.pathname;

  if (path === '/api/ping') {
    return json({ ok: true, serverTime: new Date().toISOString() });
  }

  if (path === '/api/state' && request.method === 'GET') {
    return json(await readState(env));
  }

  if (path === '/api/movements' && request.method === 'GET') {
    const limit = Math.min(Math.max(nonNegInt(url.searchParams.get('limit')) || 60, 1), 300);
    const { results } = await env.DB
      .prepare('SELECT id, kind, barcode, name, expiry, qty, at, who, zona FROM movements ORDER BY at DESC LIMIT ?1')
      .bind(limit)
      .all();
    return json({ movements: results ?? [] });
  }

  if (path === '/api/sync' && request.method === 'POST') {
    const body = await request.json().catch(() => null);
    const list = Array.isArray(body?.movements) ? body.movements.slice(0, 200) : [];
    const applied = await applyMovements(env, list, str(body?.who, 40));
    return json({ applied, state: await readState(env) });
  }

  return json({ error: 'ruta desconocida' }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (!url.pathname.startsWith('/api/')) {
      return env.ASSETS.fetch(request);
    }

    // El PIN es opcional. Si el secreto HOUSEHOLD_PIN esta configurado se exige
    // en cada peticion; si no esta, el botiquin queda abierto a quien tenga la
    // direccion. Para volver a cerrarlo basta con crear el secreto:
    //   npx wrangler secret put HOUSEHOLD_PIN
    if (env.HOUSEHOLD_PIN && !sameSecret(request.headers.get('x-pin') || '', env.HOUSEHOLD_PIN)) {
      return json({ error: 'PIN incorrecto' }, 401);
    }

    try {
      return await handle(request, env, url);
    } catch (err) {
      console.error('api error', err);
      return json({ error: 'Error en el servidor', detail: String(err?.message || err) }, 500);
    }
  }
};
