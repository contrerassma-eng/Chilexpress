import { expiryState } from './format.js';
import { ZONA_POR_DEFECTO, esZona, listaZonas, zonaDe } from './zonas.js';

/**
 * Proyeccion del inventario: parte de la foto que mando el servidor y le aplica
 * encima los movimientos que todavia no salen del telefono. Es la misma logica
 * que corre en el Worker, para que la pantalla muestre el resultado al toque
 * aunque no haya señal.
 */

const key = (barcode, expiry) => `${barcode}|${expiry || ''}`;

function applyMovement(products, lots, m) {
  const barcode = m.barcode;
  if (!barcode) return;

  if (m.kind === 'borrar') {
    products.delete(barcode);
    for (const [k, l] of [...lots]) if (l.barcode === barcode) lots.delete(k);
    return;
  }

  if (!products.has(barcode)) {
    products.set(barcode, {
      barcode,
      name: m.name || barcode,
      note: m.note || '',
      zona: esZona(m.zona) ? m.zona : ZONA_POR_DEFECTO
    });
  } else {
    // Un movimiento sin nombre o sin zona (consumo, ajuste) no pisa la ficha.
    const antes = products.get(barcode);
    if (m.name || esZona(m.zona)) {
      products.set(barcode, {
        ...antes,
        name: m.name || antes.name,
        zona: esZona(m.zona) ? m.zona : antes.zona
      });
    }
  }

  if (m.kind === 'nombre') return;

  const k = key(barcode, m.expiry);
  const actual = lots.get(k)?.qty || 0;

  let siguiente = actual;
  if (m.kind === 'compra') siguiente = actual + m.qty;
  else if (m.kind === 'ajuste') siguiente = Math.max(0, m.qty);
  else siguiente = Math.max(0, actual - m.qty); // consumo / descarte

  if (siguiente > 0) lots.set(k, { barcode, expiry: m.expiry || '', qty: siguiente });
  else lots.delete(k);
}

/** Ordena lotes por vencimiento: primero el que caduca antes, sin fecha al final. */
export function ordenarLotes(lotes) {
  return [...lotes].sort((a, b) => {
    if (!a.expiry && !b.expiry) return 0;
    if (!a.expiry) return 1;
    if (!b.expiry) return -1;
    return a.expiry.localeCompare(b.expiry);
  });
}

export function project(snapshot, outbox = []) {
  const products = new Map();
  const lots = new Map();

  for (const p of snapshot?.products || []) products.set(p.barcode, p);
  for (const l of snapshot?.lots || []) {
    if (l.qty > 0) lots.set(key(l.barcode, l.expiry), { barcode: l.barcode, expiry: l.expiry || '', qty: l.qty });
  }
  for (const m of outbox) applyMovement(products, lots, m);

  const porProducto = new Map();
  for (const l of lots.values()) {
    if (!porProducto.has(l.barcode)) porProducto.set(l.barcode, []);
    porProducto.get(l.barcode).push(l);
  }

  const items = [];
  for (const p of products.values()) {
    const lotes = ordenarLotes(porProducto.get(p.barcode) || []);
    const total = lotes.reduce((s, l) => s + l.qty, 0);
    const conFecha = lotes.find((l) => l.expiry);
    const zona = esZona(p.zona) ? p.zona : ZONA_POR_DEFECTO;
    items.push({
      barcode: p.barcode,
      name: p.name || p.barcode,
      note: p.note || '',
      zona,
      aviso: zonaDe(zona).aviso,
      lotes,
      total,
      proximo: conFecha?.expiry || '',
      estado: total === 0 ? 'agotado' : expiryState(conFecha?.expiry || '', zonaDe(zona).aviso)
    });
  }

  items.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const byBarcode = new Map(items.map((i) => [i.barcode, i]));
  return { items, byBarcode };
}

/**
 * Reparte un consumo entre los lotes que vencen primero (FEFO): si sacas 3 y el
 * lote proximo a vencer tiene 2, saca esos 2 y 1 del siguiente.
 */
export function planConsumo(item, cantidad) {
  const plan = [];
  let falta = Math.max(0, Math.trunc(cantidad));
  for (const lote of item?.lotes || []) {
    if (falta <= 0) break;
    const toma = Math.min(lote.qty, falta);
    if (toma > 0) {
      plan.push({ expiry: lote.expiry, qty: toma });
      falta -= toma;
    }
  }
  return { plan, faltante: falta };
}

function contar(items) {
  let vencidos = 0;
  let porVencer = 0;
  let agotados = 0;
  for (const i of items) {
    if (i.estado === 'agotado') agotados += 1;
    else if (i.estado === 'vencido') vencidos += 1;
    else if (i.estado === 'pronto') porVencer += 1;
  }
  return { vencidos, porVencer, agotados, total: items.length, conStock: items.length - agotados };
}

/** Totales de toda la casa y de cada zona por separado. */
export function resumen(items) {
  const porZona = {};
  for (const zona of listaZonas) {
    porZona[zona.id] = contar(items.filter((i) => i.zona === zona.id));
  }
  return { ...contar(items), porZona };
}
