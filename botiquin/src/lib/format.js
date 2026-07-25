// Utilidades de fecha y texto. Todo en horario local del telefono.

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

// Cuantos dias antes de caducar mostramos la alerta ambar.
export const DIAS_AVISO = 60;

export function nowIso() {
  return new Date().toISOString();
}

export function uid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function todayIso() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

// 'YYYY-MM' -> ultimo dia de ese mes. Un remedio marcado "VENC 05/2027" sirve
// hasta el final de mayo, asi que esa es la fecha que guardamos.
export function endOfMonth(ym) {
  const [y, m] = String(ym || '').split('-').map(Number);
  if (!y || !m) return '';
  const last = new Date(y, m, 0).getDate();
  return `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
}

export function isEndOfMonth(expiry) {
  if (!expiry) return false;
  const [y, m, d] = expiry.split('-').map(Number);
  if (!y || !m || !d) return false;
  return d === new Date(y, m, 0).getDate();
}

export function toMonthInput(expiry) {
  return expiry ? expiry.slice(0, 7) : '';
}

// Las cajas traen "05/2027"; si la fecha es exacta la mostramos completa.
export function fmtExpiry(expiry) {
  if (!expiry) return 'sin fecha';
  const [y, m, d] = expiry.split('-').map(Number);
  if (!y || !m) return expiry;
  const mes = MESES[m - 1] || m;
  return isEndOfMonth(expiry) ? `${mes} ${y}` : `${d} ${mes} ${y}`;
}

export function daysUntil(expiry) {
  if (!expiry) return null;
  const [y, m, d] = expiry.split('-').map(Number);
  if (!y || !m || !d) return null;
  const target = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}

// 'vencido' | 'pronto' | 'ok' | 'sin-fecha'
export function expiryState(expiry) {
  const dias = daysUntil(expiry);
  if (dias === null) return 'sin-fecha';
  if (dias < 0) return 'vencido';
  if (dias <= DIAS_AVISO) return 'pronto';
  return 'ok';
}

export function expiryLabel(expiry) {
  const dias = daysUntil(expiry);
  if (dias === null) return 'sin fecha';
  if (dias < 0) return `vencido hace ${Math.abs(dias)} d`;
  if (dias === 0) return 'vence hoy';
  if (dias <= DIAS_AVISO) return `vence en ${dias} d`;
  return fmtExpiry(expiry);
}

// Linea que resume el vencimiento en la lista, sin repetir la fecha dos veces.
export function expiryResumen(expiry) {
  const estado = expiryState(expiry);
  if (estado === 'sin-fecha') return 'sin fecha de vencimiento';
  if (estado === 'vencido') return `${expiryLabel(expiry)} · ${fmtExpiry(expiry)}`;
  if (estado === 'pronto') return `${expiryLabel(expiry)} · ${fmtExpiry(expiry)}`;
  return `vence ${fmtExpiry(expiry)}`;
}

export function fmtDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const fecha = `${d.getDate()} ${MESES[d.getMonth()]}`;
  const hora = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${fecha} ${hora}`;
}
