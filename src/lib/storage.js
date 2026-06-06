// Persistencia local (offline). Por ahora todo vive en el dispositivo; cuando
// migremos a un backend compartido, este modulo es el unico punto a cambiar.
const KEY = 'cx_precios_v1';

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    // localStorage lleno o no disponible: no rompemos la app.
    console.warn('No se pudo guardar el estado local', e);
  }
}
