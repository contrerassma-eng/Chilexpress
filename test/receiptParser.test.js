import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseReceipt,
  parseCLP,
  detectChain,
  detectCity,
  detectDate
} from '../src/lib/receiptParser.js';

// Texto aproximado a lo que entrega el OCR de la boleta Unimarc de ejemplo,
// con el ruido tipico (titulos torcidos, caracteres sueltos).
const SAMPLE = `UNIMARC NOI
R.U.T.81.537
RENDIC HERMANOS S.A
Casa Matriz: CERRO EL PLOMO 5680 7-11
LAS CONDES-SANTIAGO
Giro: GRANDES ESTABLECIMIENTOS (VENTA DE ALIMENTOS)
HIPERMERCADOS
Sucursal: Luis Cruz Martinez 1314
Fecha Emision: 29/05/2026  Hora: 09:03  Trans: 26473
Local: 512  Caja: 81   Boleta Electronica: 2311234336
                                                  VALOR
CODIGO        DESC.ARTICULO
              CANT./UNIDAD/PRECIO UNITARIO
7801620011611 NECTAR WATTS PET 1                  $1990
7802000014574 CHIS POP SAB T FRU                  $2090
90042         BOLLO INTEGRAL GRA                  $1734
0,58 x 1 KG $2990 c/u
TOTAL                                             $5814
Desglose del Total:
Neto                                              $4886
IVA                                               $928
DETALLE DE PAGOS
TARJETA                                           $5814
TOTAL PAGOS                                       $5814
Total items: 3
Total articulos vendidos: 3`;

test('parseCLP entiende formato chileno', () => {
  assert.equal(parseCLP('$1.990'), 1990);
  assert.equal(parseCLP('2.090'), 2090);
  assert.equal(parseCLP('$1734'), 1734);
  assert.equal(parseCLP('$5.814'), 5814);
  assert.equal(parseCLP('abc'), null);
});

test('detecta cadena, ciudad y fecha', () => {
  assert.equal(detectChain(SAMPLE), 'Unimarc');
  assert.equal(detectCity(SAMPLE), 'Las Condes');
  assert.equal(detectDate(SAMPLE), '2026-05-29');
});

test('extrae los 3 productos y descarta totales/encabezado', () => {
  const r = parseReceipt(SAMPLE);
  assert.equal(r.supermarket, 'Unimarc');
  assert.equal(r.items.length, 3, `esperaba 3 productos, obtuve ${r.items.length}: ${JSON.stringify(r.items)}`);

  const [nectar, chis, bollo] = r.items;
  assert.match(nectar.product, /NECTAR WATTS/);
  assert.equal(nectar.price, 1990);

  assert.match(chis.product, /CHIS POP/);
  assert.equal(chis.price, 2090);

  // El bollo es por kilo: usa el precio unitario por kg ($2990), no el cobrado.
  assert.match(bollo.product, /BOLLO INTEGRAL/);
  assert.equal(bollo.unit, 'kg');
  assert.equal(bollo.price, 2990);
});

test('no confunde TOTAL/NETO/IVA con productos', () => {
  const r = parseReceipt(SAMPLE);
  const texts = r.items.map((i) => i.product.toUpperCase()).join(' | ');
  assert.doesNotMatch(texts, /TOTAL|NETO|IVA|TARJETA|PAGOS/);
});
