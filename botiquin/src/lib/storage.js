// Copia local para que la app abra al instante y funcione sin señal.

const KEYS = {
  pin: 'botiquin_pin',
  who: 'botiquin_who',
  zona: 'botiquin_zona',
  snapshot: 'botiquin_snapshot_v1',
  outbox: 'botiquin_outbox_v1'
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('No se pudo guardar en el telefono', e);
  }
}

export const almacen = {
  pin: () => read(KEYS.pin, ''),
  setPin: (v) => write(KEYS.pin, v),
  who: () => read(KEYS.who, ''),
  setWho: (v) => write(KEYS.who, v),
  zona: () => read(KEYS.zona, ''),
  setZona: (v) => write(KEYS.zona, v),
  snapshot: () => read(KEYS.snapshot, { products: [], lots: [] }),
  setSnapshot: (v) => write(KEYS.snapshot, v),
  outbox: () => read(KEYS.outbox, []),
  setOutbox: (v) => write(KEYS.outbox, v),
  borrarTodo: () => {
    for (const k of Object.values(KEYS)) {
      try { localStorage.removeItem(k); } catch { /* noop */ }
    }
  }
};
