// Capa de datos: usa el backend remoto (Cloudflare Worker) si hay una URL de
// API; si no, cae a almacenamiento local (offline, por dispositivo).
//
// Es el UNICO punto que conoce de donde vienen/van los datos. Tanto en modo
// remoto como local, las funciones devuelven entries con la misma forma
// (ver lib/pricing.js) para que el resto de la app no cambie.

import { loadState, saveState } from './storage.js';
import { makeEntry } from './pricing.js';

// URL del Worker de produccion (superdelta). Se puede sobre-escribir con la
// variable de build VITE_API_BASE (p. ej. para apuntar a un Worker de staging).
const DEFAULT_API = 'https://superdelta.contreras-sma.workers.dev';

export const BASE = (import.meta.env.VITE_API_BASE || DEFAULT_API || '').replace(/\/$/, '');
export const REMOTE = !!BASE;

async function jfetch(path, opts = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  if (res.status === 204) return null;
  return res.json();
}

function validEntry(e) {
  return e.productKey && e.supermarketKey && e.cityKey && e.price > 0;
}

const remoteBackend = {
  async list() {
    const data = await jfetch('/entries');
    return data.entries || [];
  },
  async add(items) {
    const data = await jfetch('/entries', { method: 'POST', body: JSON.stringify({ items }) });
    return data.entries || [];
  },
  async remove(id) {
    await jfetch(`/entries/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
  async clear() {
    await jfetch('/entries', { method: 'DELETE' });
  }
};

const localBackend = {
  async list() {
    return loadState()?.entries || [];
  },
  // Crea los entries en el cliente; la persistencia la hace el store (saveState).
  async add(items) {
    return items.map(makeEntry).filter(validEntry);
  },
  async remove() {},
  async clear() {}
};

export const backend = REMOTE ? remoteBackend : localBackend;

// --- Fotos de producto compartidas (por codigo de barra) ---

// Trae las fotos que han subido usuarios para una lista de codigos de barra.
// Devuelve { [barcode]: { photo, name } }. Vacio en modo local.
export async function fetchUserPhotos(codes) {
  if (!REMOTE || !codes || codes.length === 0) return {};
  try {
    const q = codes.join(',');
    const data = await jfetch(`/photos?codes=${encodeURIComponent(q)}`);
    return data.photos || {};
  } catch {
    return {};
  }
}

// Sube/actualiza la foto de un producto (compartida para ese codigo de barra).
export async function uploadUserPhoto(barcode, photo, name) {
  if (!REMOTE) throw new Error('Sin backend remoto');
  const code = String(barcode || '').replace(/\D/g, '');
  if (code.length < 8) throw new Error('Codigo de barra invalido');
  await jfetch(`/photos/${code}`, {
    method: 'PUT',
    body: JSON.stringify({ photo, name: name || '' })
  });
}
