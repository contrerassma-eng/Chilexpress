// API del comparador de precios sobre Cloudflare Workers + D1.
//
// Despliegue (una sola vez, gratis, no requiere R2):
//   npx wrangler deploy
// El binding "DB" y el database_id ya estan configurados en wrangler.toml.
//
// Rutas:
//   GET    /health            -> { ok }
//   GET    /entries[?city=]   -> { entries: [...] }   (orden: mas reciente primero)
//   POST   /entries           -> { entries: [creados] }   body: { items: [...] }
//   DELETE /entries/:id       -> { ok }
//   DELETE /entries           -> { ok }   (borra todo)

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors }
  });
}

// Misma normalizacion que el frontend (src/lib/catalog.js) para agrupar igual.
function normalize(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function uid() {
  return `e_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// Deja solo digitos del codigo de barra (EAN/UPC, 8..14). '' si no es valido.
function normalizeBarcode(code) {
  const digits = String(code || '').replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 14 ? digits : '';
}

// Fila de D1 (snake_case) -> entry del frontend (camelCase).
function rowToEntry(r) {
  return {
    id: r.id,
    barcode: r.barcode || '',
    product: r.product,
    productKey: r.product_key,
    unit: r.unit,
    supermarket: r.supermarket,
    supermarketKey: r.supermarket_key,
    city: r.city,
    cityKey: r.city_key,
    price: r.price,
    photo: r.photo_data || null,
    contributor: r.contributor || null,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  };
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/$/, '') || '/';

    try {
      if (path === '/' || path === '/health') {
        return json({
          ok: true,
          service: 'superdelta',
          descripcion: 'API del comparador de precios de supermercado. Esta es la API, no la app.',
          endpoints: {
            'GET /entries?city=': 'precios (opcional: filtrar por ciudad)',
            'POST /entries': 'agregar precios { items: [...] }',
            'DELETE /entries/:id': 'borrar un precio',
            'DELETE /entries': 'borrar todo'
          }
        });
      }

      if (path === '/entries' && req.method === 'GET') {
        const city = url.searchParams.get('city');
        let sql = 'SELECT * FROM entries';
        const binds = [];
        if (city) {
          sql += ' WHERE city_key = ?';
          binds.push(normalize(city));
        }
        sql += ' ORDER BY updated_at DESC';
        const { results } = await env.DB.prepare(sql).bind(...binds).all();
        return json({ entries: results.map(rowToEntry) });
      }

      if (path === '/entries' && req.method === 'POST') {
        const body = await req.json();
        const items = Array.isArray(body.items) ? body.items : [];
        const now = new Date().toISOString();
        const created = [];
        const stmts = [];
        const insert = env.DB.prepare(
          `INSERT INTO entries
             (id, barcode, product, product_key, unit, supermarket, supermarket_key,
              city, city_key, price, photo_data, contributor, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
        );
        for (const it of items) {
          const e = {
            id: uid(),
            barcode: normalizeBarcode(it.barcode),
            product: String(it.product || '').trim(),
            product_key: normalize(it.product),
            unit: String(it.unit || '').trim(),
            supermarket: String(it.supermarket || '').trim(),
            supermarket_key: normalize(it.supermarket),
            city: String(it.city || '').trim(),
            city_key: normalize(it.city),
            price: Math.round(Number(it.price)) || 0,
            photo_data: it.photo || null,
            contributor: it.contributor || null,
            created_at: now,
            updated_at: now
          };
          if (!e.product_key || !e.supermarket_key || !e.city_key || !e.price) continue;
          stmts.push(insert.bind(
            e.id, e.barcode, e.product, e.product_key, e.unit, e.supermarket, e.supermarket_key,
            e.city, e.city_key, e.price, e.photo_data, e.contributor, e.created_at, e.updated_at
          ));
          created.push(rowToEntry(e));
        }
        if (stmts.length) await env.DB.batch(stmts);
        return json({ entries: created }, 201);
      }

      const m = path.match(/^\/entries\/([^/]+)$/);
      if (m && req.method === 'DELETE') {
        await env.DB.prepare('DELETE FROM entries WHERE id = ?')
          .bind(decodeURIComponent(m[1])).run();
        return json({ ok: true });
      }

      if (path === '/entries' && req.method === 'DELETE') {
        await env.DB.prepare('DELETE FROM entries').run();
        return json({ ok: true });
      }

      return json({ error: 'not found' }, 404);
    } catch (err) {
      return json({ error: String(err && err.message ? err.message : err) }, 500);
    }
  }
};
