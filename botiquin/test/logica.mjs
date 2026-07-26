import assert from 'node:assert/strict';
import { parseGs1, gs1DateToIso, looksLikeGs1 } from '../src/lib/gs1.js';
import { decodeScan, normalizeGtin, codigoSinBarras, upceAUpca, upcaAUpce, variantesGtin } from '../src/lib/codes.js';
import { project, planConsumo, resumen } from '../src/lib/inventory.js';
import { endOfMonth, isEndOfMonth, expiryState, fmtExpiry } from '../src/lib/format.js';
import { ZONAS, zonaDe, esZona } from '../src/lib/zonas.js';

let ok = 0;
const t = (nombre, fn) => { fn(); ok += 1; console.log('  ok  ' + nombre); };

console.log('\nGS1 / DataMatrix');
t('element string sin separadores', () => {
  const r = parseGs1('010775006000019417270531102ABC123');
  assert.equal(r.gtin, '07750060000194');
  assert.equal(r.expiry, '2027-05-31');
  assert.equal(r.lote, '2ABC123');
});
t('dia 00 = fin de mes', () => assert.equal(gs1DateToIso('250600'), '2025-06-30'));
t('anio 51-99 es 19xx', () => assert.equal(gs1DateToIso('991231'), '1999-12-31'));
t('lote variable termina en FNC1', () => {
  const r = parseGs1('0107750060000194\x1d10LOTE-1\x1d17280131');
  assert.equal(r.lote, 'LOTE-1');
  assert.equal(r.expiry, '2028-01-31');
});
t('prefijo de simbologia ]d2', () => {
  assert.equal(parseGs1(']d20107750060000194172705311012345').gtin, '07750060000194');
});
t('un EAN-13 no se confunde con GS1', () => {
  assert.equal(looksLikeGs1('7801234567890'), false);
  assert.equal(parseGs1('7801234567890'), null);
});
t('mes invalido se descarta', () => assert.equal(gs1DateToIso('271331'), ''));

console.log('\nNormalizacion de codigos');
t('GTIN-14 con cero -> EAN-13', () => assert.equal(normalizeGtin('07750060000194'), '7750060000194'));
t('UPC-A -> EAN-13', () => assert.equal(normalizeGtin('012345678905'), '0012345678905'));
t('EAN-13 queda igual', () => assert.equal(normalizeGtin('7801234567890'), '7801234567890'));
t('DataMatrix y EAN de la misma caja dan el mismo producto', () => {
  const porDm = decodeScan('010775006000019417270531');
  const porEan = decodeScan('7750060000194');
  assert.equal(porDm.barcode, porEan.barcode);
  assert.equal(porDm.expiry, '2027-05-31');
});
t('camara rechaza basura', () => {
  assert.equal(decodeScan('B1A'), null);
  assert.equal(decodeScan('123'), null);
  assert.equal(decodeScan('AB12345678'), null);
});
t('manual acepta lo que sea', () => assert.equal(decodeScan('caja-x', { strict: false }).barcode, 'CAJA-X'));
t('codigo interno sin tildes', () => assert.equal(codigoSinBarras('Ibuprofeno 400 mg  ñandú'), 'sc-ibuprofeno-400-mg-nandu'));
t('codigo interno se corta a 24', () => assert.ok(codigoSinBarras('a'.repeat(80)).length <= 27));

console.log('\nUPC-E: el mismo envase leido comprimido o expandido');
t('expande segun el digito de modo', () => {
  // Par canonico de manual: modo 1
  assert.equal(upceAUpca('04252614'), '042100005264');
  // Modo 6 (5-9): los ceros van entre el fabricante y el ultimo digito.
  // Es el caso de un producto real guardado comprimido.
  assert.equal(upceAUpca('07322464'), '073224000064');
  // Modo 3: cinco ceros despues de los tres primeros digitos.
  assert.equal(upceAUpca('04210934'), '042100000094');
});
t('comprime de vuelta al mismo codigo', () => {
  assert.ok(upcaAUpce('073224000064').includes('07322464'));
});
t('ida y vuelta para cualquier modo', () => {
  for (const upce of ['07322464', '01230000', '04210934', '05012345', '01234565']) {
    const upca = upceAUpca(upce);
    if (!upca) continue;
    assert.ok(upcaAUpce(upca).includes(upce), `${upce} -> ${upca} no vuelve`);
  }
});
t('un codigo no comprimible no inventa variantes', () => {
  assert.deepEqual(upcaAUpce('012345678905'), []);
  assert.equal(upceAUpca('7801234'), '');   // largo invalido
  assert.equal(upceAUpca('27322464'), '');  // no empieza en 0 ni 1
});
t('las variantes encuentran el producto guardado de otra forma', () => {
  // Asi quedo guardado un producto real: comprimido, 8 digitos.
  const guardado = '07322464';
  // Si otro lector lo entrega expandido, tiene que reconocerlo igual.
  assert.ok(variantesGtin('073224000064').includes(guardado));
  assert.ok(variantesGtin('0073224000064').includes(guardado));
  assert.ok(variantesGtin(guardado).includes('0073224000064'));
});
t('un EAN-13 normal no genera variantes raras', () => {
  const v = variantesGtin('7800063004853');
  assert.deepEqual(v, ['7800063004853']);
});

console.log('\nFechas');
t('fin de mes', () => assert.equal(endOfMonth('2027-05'), '2027-05-31'));
t('febrero bisiesto', () => assert.equal(endOfMonth('2028-02'), '2028-02-29'));
t('reconoce fin de mes', () => assert.equal(isEndOfMonth('2027-05-31'), true));
t('vencido / vigente', () => {
  assert.equal(expiryState('2000-01-01'), 'vencido');
  assert.equal(expiryState('2099-01-01'), 'ok');
  assert.equal(expiryState(''), 'sin-fecha');
});
t('formato corto para fin de mes', () => assert.equal(fmtExpiry('2027-05-31'), 'may 2027'));

console.log('\nInventario (snapshot + cola offline)');
const snapshot = {
  products: [
    { barcode: '111', name: 'Paracetamol 500' },
    { barcode: '222', name: 'Ibuprofeno 400' }
  ],
  lots: [
    { barcode: '111', expiry: '2027-05-31', qty: 2 },
    { barcode: '111', expiry: '2026-01-31', qty: 1 },
    { barcode: '222', expiry: '', qty: 5 }
  ]
};

t('proyecta el snapshot y ordena por vencimiento', () => {
  const { byBarcode } = project(snapshot, []);
  const p = byBarcode.get('111');
  assert.equal(p.total, 3);
  assert.equal(p.lotes[0].expiry, '2026-01-31'); // el que vence antes va primero
  assert.equal(p.proximo, '2026-01-31');
});

t('una compra pendiente ya se ve en pantalla', () => {
  const cola = [{ id: 'a', kind: 'compra', barcode: '111', name: 'Paracetamol 500', expiry: '2027-05-31', qty: 4 }];
  assert.equal(project(snapshot, cola).byBarcode.get('111').total, 7);
});

t('producto nuevo desde la cola', () => {
  const cola = [{ id: 'a', kind: 'compra', barcode: '333', name: 'Loratadina', expiry: '', qty: 1 }];
  assert.equal(project(snapshot, cola).byBarcode.get('333').name, 'Loratadina');
});

t('consumo FEFO reparte entre lotes', () => {
  const { byBarcode } = project(snapshot, []);
  const { plan, faltante } = planConsumo(byBarcode.get('111'), 3);
  assert.deepEqual(plan, [{ expiry: '2026-01-31', qty: 1 }, { expiry: '2027-05-31', qty: 2 }]);
  assert.equal(faltante, 0);
});

t('consumo de mas avisa el faltante', () => {
  const { byBarcode } = project(snapshot, []);
  const { plan, faltante } = planConsumo(byBarcode.get('111'), 10);
  assert.equal(plan.reduce((s, p) => s + p.qty, 0), 3);
  assert.equal(faltante, 7);
});

t('el lote en cero desaparece pero el producto queda', () => {
  const cola = [{ id: 'a', kind: 'consumo', barcode: '222', name: '', expiry: '', qty: 5 }];
  const { byBarcode } = project(snapshot, cola);
  assert.equal(byBarcode.get('222').total, 0);
  assert.equal(byBarcode.get('222').lotes.length, 0);
  assert.equal(byBarcode.get('222').estado, 'agotado');
});

t('el stock nunca queda negativo', () => {
  const cola = [{ id: 'a', kind: 'consumo', barcode: '222', name: '', expiry: '', qty: 99 }];
  assert.equal(project(snapshot, cola).byBarcode.get('222').total, 0);
});

t('ajuste fija la cantidad exacta', () => {
  const cola = [{ id: 'a', kind: 'ajuste', barcode: '111', name: '', expiry: '2027-05-31', qty: 9 }];
  assert.equal(project(snapshot, cola).byBarcode.get('111').total, 10); // 9 + 1 del otro lote
});

t('renombrar no toca el stock', () => {
  const cola = [{ id: 'a', kind: 'nombre', barcode: '111', name: 'Paracetamol 500 mg', qty: 0 }];
  const p = project(snapshot, cola).byBarcode.get('111');
  assert.equal(p.name, 'Paracetamol 500 mg');
  assert.equal(p.total, 3);
});

t('borrar saca producto y lotes', () => {
  const cola = [{ id: 'a', kind: 'borrar', barcode: '111', name: '', qty: 0 }];
  assert.equal(project(snapshot, cola).byBarcode.get('111'), undefined);
});

t('varios movimientos en cadena', () => {
  const cola = [
    { id: 'a', kind: 'compra', barcode: '444', name: 'Amoxicilina', expiry: '2026-03-31', qty: 3 },
    { id: 'b', kind: 'consumo', barcode: '444', name: '', expiry: '2026-03-31', qty: 1 },
    { id: 'c', kind: 'compra', barcode: '444', name: '', expiry: '2026-03-31', qty: 2 }
  ];
  assert.equal(project(snapshot, cola).byBarcode.get('444').total, 4);
});

t('resumen cuenta vencidos, por vencer y agotados', () => {
  const base = {
    products: [{ barcode: 'a', name: 'A' }, { barcode: 'b', name: 'B' }, { barcode: 'c', name: 'C' }],
    lots: [
      { barcode: 'a', expiry: '2000-01-01', qty: 1 },
      { barcode: 'b', expiry: '2099-01-01', qty: 1 }
    ]
  };
  const r = resumen(project(base, []).items);
  assert.equal(r.vencidos, 1);
  assert.equal(r.agotados, 1);
  assert.equal(r.conStock, 2);
});

console.log('\nZonas de la casa');
const enDias = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

t('cada zona avisa con su propia anticipacion', () => {
  const en20dias = enDias(20);
  // 20 dias: en el botiquin todavia esta bien, en el refrigerador ya urge.
  assert.equal(expiryState(en20dias, ZONAS.botiquin.aviso), 'pronto');
  assert.equal(expiryState(en20dias, ZONAS.refrigerador.aviso), 'ok');
  assert.equal(expiryState(enDias(3), ZONAS.refrigerador.aviso), 'pronto');
  assert.equal(expiryState(enDias(3), ZONAS.botiquin.aviso), 'pronto');
});

t('zona desconocida cae al botiquin', () => {
  assert.equal(zonaDe('garaje').id, 'botiquin');
  assert.equal(esZona('despensa'), true);
  assert.equal(esZona('garaje'), false);
});

t('el producto guarda su zona y su umbral', () => {
  const base = { products: [{ barcode: 'l1', name: 'Leche', zona: 'refrigerador' }], lots: [{ barcode: 'l1', expiry: enDias(20), qty: 1 }] };
  const item = project(base, []).byBarcode.get('l1');
  assert.equal(item.zona, 'refrigerador');
  assert.equal(item.aviso, ZONAS.refrigerador.aviso);
  assert.equal(item.estado, 'ok'); // 20 dias es mucho para la leche, pero aun no urge
});

t('lo viejo sin zona queda en el botiquin', () => {
  const base = { products: [{ barcode: 'x', name: 'Aspirina' }], lots: [{ barcode: 'x', expiry: '', qty: 2 }] };
  assert.equal(project(base, []).byBarcode.get('x').zona, 'botiquin');
});

t('una compra pendiente crea el producto en su zona', () => {
  const cola = [{ id: 'a', kind: 'compra', barcode: 'c1', name: 'Cloro', zona: 'aseo', expiry: '', qty: 2 }];
  assert.equal(project({ products: [], lots: [] }, cola).byBarcode.get('c1').zona, 'aseo');
});

t('un consumo sin zona no mueve el producto', () => {
  const base = { products: [{ barcode: 'l1', name: 'Leche', zona: 'refrigerador' }], lots: [{ barcode: 'l1', expiry: '', qty: 3 }] };
  const cola = [{ id: 'a', kind: 'consumo', barcode: 'l1', name: '', zona: '', expiry: '', qty: 1 }];
  const item = project(base, cola).byBarcode.get('l1');
  assert.equal(item.zona, 'refrigerador');
  assert.equal(item.total, 2);
});

t('mover de zona no toca el stock', () => {
  const base = { products: [{ barcode: 'l1', name: 'Leche', zona: 'despensa' }], lots: [{ barcode: 'l1', expiry: '', qty: 3 }] };
  const cola = [{ id: 'a', kind: 'nombre', barcode: 'l1', name: 'Leche entera', zona: 'refrigerador', qty: 0 }];
  const item = project(base, cola).byBarcode.get('l1');
  assert.equal(item.zona, 'refrigerador');
  assert.equal(item.name, 'Leche entera');
  assert.equal(item.total, 3);
});

t('el resumen separa por zona', () => {
  const base = {
    products: [
      { barcode: 'a', name: 'A', zona: 'botiquin' },
      { barcode: 'b', name: 'B', zona: 'despensa' },
      { barcode: 'c', name: 'C', zona: 'despensa' }
    ],
    lots: [
      { barcode: 'a', expiry: '2000-01-01', qty: 1 },
      { barcode: 'b', expiry: '2000-01-01', qty: 1 }
    ]
  };
  const r = resumen(project(base, []).items);
  assert.equal(r.vencidos, 2);
  assert.equal(r.porZona.botiquin.vencidos, 1);
  assert.equal(r.porZona.despensa.vencidos, 1);
  assert.equal(r.porZona.despensa.agotados, 1);
  assert.equal(r.porZona.aseo.total, 0);
});

console.log(`\n${ok} pruebas OK\n`);
