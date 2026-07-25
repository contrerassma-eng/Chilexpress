/**
 * Prueba la API real contra la base D1.
 *
 *   npm run dev:api    (en otra consola)
 *   npm run test:api
 *
 * Cada corrida usa codigos e ids propios y borra lo suyo al final, asi que se
 * puede lanzar cuantas veces se quiera, incluso contra la base de verdad:
 *   BASE=https://botiquin.tu-subdominio.workers.dev PIN=xxxx npm run test:api
 */
import assert from 'node:assert/strict';

const BASE = process.env.BASE || 'http://127.0.0.1:8787';
const PIN = process.env.PIN || '123456';

// Marca de esta corrida: los ids de movimiento son unicos para siempre, asi que
// reusarlos entre corridas haria que el servidor los ignorara (y con razon).
const RUN = Date.now().toString(36);
const A = `test-${RUN}-a`;
const B = `test-${RUN}-b`;
const C = `test-${RUN}-c`;
const mid = (n) => `${RUN}-${n}`;

let ok = 0;
const t = async (nombre, fn) => { await fn(); ok += 1; console.log('  ok  ' + nombre); };

const req = (path, { pin = PIN, method = 'GET', body } = {}) =>
  fetch(BASE + path, {
    method,
    headers: { 'x-pin': pin, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });

const sync = (movements, who = 'papa') => req('/api/sync', { method: 'POST', body: { movements, who } });
const enviar = async (...movements) => (await sync(movements)).json();
const stock = (estado, barcode) =>
  (estado.lots || []).filter((l) => l.barcode === barcode).reduce((s, l) => s + l.qty, 0);
const lotes = (estado, barcode) => (estado.lots || []).filter((l) => l.barcode === barcode);
const producto = (estado, barcode) => (estado.products || []).find((p) => p.barcode === barcode);

// El PIN es opcional: depende de si el Worker tiene el secreto HOUSEHOLD_PIN.
// Probamos el comportamiento que corresponde al modo en que este corriendo.
const abierto = (await req('/api/ping', { pin: '' })).status === 200;

console.log(`\nAcceso (el botiquin esta ${abierto ? 'ABIERTO, sin PIN' : 'CERRADO, con PIN'})`);
if (abierto) {
  await t('se entra sin PIN', async () => assert.equal((await req('/api/ping', { pin: '' })).status, 200));
  await t('mandar un PIN cualquiera no estorba', async () => assert.equal((await req('/api/ping', { pin: 'da-igual' })).status, 200));
} else {
  await t('sin PIN -> 401', async () => assert.equal((await req('/api/ping', { pin: '' })).status, 401));
  await t('PIN malo -> 401', async () => assert.equal((await req('/api/ping', { pin: 'no-es' })).status, 401));
  await t('PIN bueno -> 200', async () => assert.equal((await req('/api/ping')).status, 200));
}
await t('ruta inventada -> 404', async () => assert.equal((await req('/api/nada')).status, 404));

console.log('\nCompra');
await t('alta de producto con lote', async () => {
  const { state } = await enviar(
    { id: mid('e1'), kind: 'compra', barcode: A, name: 'Paracetamol 500', expiry: '2027-05-31', qty: 2 }
  );
  assert.equal(producto(state, A).name, 'Paracetamol 500');
  assert.equal(stock(state, A), 2);
});

await t('reenviar la misma cola no duplica stock', async () => {
  const { state } = await enviar(
    { id: mid('e1'), kind: 'compra', barcode: A, name: 'Paracetamol 500', expiry: '2027-05-31', qty: 2 }
  );
  assert.equal(stock(state, A), 2);
});

await t('segunda compra suma al mismo lote y no pisa el nombre', async () => {
  const { state } = await enviar({ id: mid('e2'), kind: 'compra', barcode: A, name: '', expiry: '2027-05-31', qty: 3 });
  assert.equal(stock(state, A), 5);
  assert.equal(producto(state, A).name, 'Paracetamol 500');
});

await t('otra fecha crea otro lote', async () => {
  const { state } = await enviar({ id: mid('e3'), kind: 'compra', barcode: A, name: '', expiry: '2026-01-31', qty: 1 });
  assert.equal(lotes(state, A).length, 2);
  assert.equal(stock(state, A), 6);
});

console.log('\nConsumo');
await t('descuenta del lote indicado y borra el lote vacio', async () => {
  const { state } = await enviar({ id: mid('e4'), kind: 'consumo', barcode: A, name: '', expiry: '2026-01-31', qty: 1 });
  assert.equal(stock(state, A), 5);
  assert.equal(lotes(state, A).length, 1);
});

await t('consumir de mas deja en cero, nunca negativo', async () => {
  const { state } = await enviar({ id: mid('e5'), kind: 'consumo', barcode: A, name: '', expiry: '2027-05-31', qty: 99 });
  assert.equal(stock(state, A), 0);
  assert.ok(producto(state, A), 'el producto queda para recordar el nombre');
});

await t('un lote sin fecha convive con los que si tienen', async () => {
  const { state } = await enviar(
    { id: mid('e6'), kind: 'compra', barcode: B, name: 'Suero fisiologico', expiry: '', qty: 4 },
    { id: mid('e7'), kind: 'compra', barcode: B, name: '', expiry: '2028-12-31', qty: 2 }
  );
  assert.equal(lotes(state, B).length, 2);
  assert.equal(stock(state, B), 6);
});

console.log('\nAjuste, nombre y borrado');
await t('ajuste fija la cantidad exacta', async () => {
  const { state } = await enviar({ id: mid('e8'), kind: 'ajuste', barcode: B, name: '', expiry: '', qty: 1 });
  assert.equal(stock(state, B), 3);
});

await t('ajuste a cero borra el lote', async () => {
  const { state } = await enviar({ id: mid('e9'), kind: 'ajuste', barcode: B, name: '', expiry: '', qty: 0 });
  assert.equal(lotes(state, B).filter((l) => l.expiry === '').length, 0);
});

await t('renombrar no toca el stock', async () => {
  const { state } = await enviar({ id: mid('e10'), kind: 'nombre', barcode: B, name: 'Suero fisiológico 5 ml', qty: 0 });
  assert.equal(producto(state, B).name, 'Suero fisiológico 5 ml');
  assert.equal(stock(state, B), 2);
});

console.log('\nValidacion de entrada');
await t('movimiento con tipo raro se ignora', async () => {
  const { state } = await enviar({ id: mid('x1'), kind: 'robar', barcode: A, qty: 5 });
  assert.equal(stock(state, A), 0);
});
await t('cantidad negativa se ignora', async () => {
  const { state } = await enviar({ id: mid('x2'), kind: 'compra', barcode: A, name: '', expiry: '', qty: -5 });
  assert.equal(stock(state, A), 0);
});
await t('fecha con formato invalido cae a "sin fecha"', async () => {
  const { state } = await enviar({ id: mid('x3'), kind: 'compra', barcode: C, name: 'Gasas', expiry: '31/12/2027', qty: 1 });
  assert.equal(lotes(state, C)[0].expiry, '');
});
await t('tanda vacia no rompe', async () => assert.equal((await sync([])).status, 200));

console.log('\nHistorial');
await t('quedan registrados los movimientos de esta corrida', async () => {
  const { movements } = await (await req('/api/movements?limit=300')).json();
  const mios = movements.filter((m) => m.id.startsWith(`${RUN}-`));
  assert.ok(mios.length >= 11, `esperaba >=11, hay ${mios.length}`);
  assert.equal(mios.filter((m) => m.id === mid('e1')).length, 1, 'sin duplicados');
  assert.ok(mios.every((m) => m.who === 'papa'));
});

console.log('\nLa app se sirve desde el mismo Worker');
await t('la raiz devuelve index.html', async () => {
  const r = await fetch(BASE + '/');
  assert.equal(r.status, 200);
  assert.ok((await r.text()).includes('<div id="root">'));
});
await t('una ruta cualquiera devuelve la app (SPA)', async () => {
  const r = await fetch(BASE + '/inventario');
  assert.equal(r.status, 200);
  assert.ok((await r.text()).includes('<div id="root">'));
});
await t('el manifest de la PWA existe', async () => {
  const r = await fetch(BASE + '/manifest.webmanifest');
  const m = await r.json();
  assert.equal(r.status, 200);
  assert.equal(m.display, 'standalone');
  assert.ok(m.icons.some((i) => i.purpose === 'maskable'));
});

console.log('\nLimpieza');
await t('borrar saca producto y lotes de la base', async () => {
  const { state } = await enviar(
    { id: mid('z1'), kind: 'borrar', barcode: A, name: '', qty: 0 },
    { id: mid('z2'), kind: 'borrar', barcode: B, name: '', qty: 0 },
    { id: mid('z3'), kind: 'borrar', barcode: C, name: '', qty: 0 }
  );
  for (const barcode of [A, B, C]) {
    assert.equal(producto(state, barcode), undefined);
    assert.equal(lotes(state, barcode).length, 0);
  }
});

console.log(`\n${ok} pruebas de API OK\n`);
