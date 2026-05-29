import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  makeEntry,
  buildComparisons,
  rankByDifference,
  citiesFromEntries,
  lastUpdatedAt
} from '../src/lib/pricing.js';

function entryAt(over, iso) {
  const e = makeEntry(over);
  if (iso) { e.createdAt = iso; e.updatedAt = iso; }
  return e;
}

test('agrupa el mismo producto y normaliza nombres/acentos', () => {
  const entries = [
    makeEntry({ product: 'Leche Entera 1L', unit: 'un', supermarket: 'Jumbo', city: 'Santiago', price: 1200 }),
    makeEntry({ product: 'leche entera 1l', unit: 'un', supermarket: 'Líder', city: 'Santiago', price: 990 })
  ];
  const comps = buildComparisons(entries);
  assert.equal(comps.length, 1, 'debe ser un solo grupo de comparacion');
  assert.equal(comps[0].count, 2);
  assert.equal(comps[0].min, 990);
  assert.equal(comps[0].max, 1200);
  assert.equal(comps[0].diff, 210);
  assert.equal(comps[0].cheapest.supermarket, 'Líder');
});

test('usa el precio mas reciente por supermercado', () => {
  const entries = [
    entryAt({ product: 'Pan', supermarket: 'Unimarc', city: 'Talca', price: 2000 }, '2026-05-01T10:00:00Z'),
    entryAt({ product: 'Pan', supermarket: 'Unimarc', city: 'Talca', price: 1500 }, '2026-05-20T10:00:00Z')
  ];
  const comps = buildComparisons(entries);
  assert.equal(comps[0].count, 1, 'mismo supermercado = un solo precio vigente');
  assert.equal(comps[0].cheapest.price, 1500, 'gana el mas reciente, no el mas barato');
});

test('ranking ordena por mayor diferencia y exige 2+ supermercados', () => {
  const entries = [
    makeEntry({ product: 'Arroz 1kg', supermarket: 'Jumbo', city: 'Arica', price: 1500 }),
    makeEntry({ product: 'Arroz 1kg', supermarket: 'Lider', city: 'Arica', price: 1100 }),  // diff 400
    makeEntry({ product: 'Aceite 1L', supermarket: 'Jumbo', city: 'Arica', price: 5000 }),
    makeEntry({ product: 'Aceite 1L', supermarket: 'Tottus', city: 'Arica', price: 3500 }), // diff 1500
    makeEntry({ product: 'Sal', supermarket: 'Jumbo', city: 'Arica', price: 800 })          // un solo super
  ];
  const ranking = rankByDifference(buildComparisons(entries));
  assert.equal(ranking.length, 2, 'el de un solo supermercado no entra al ranking');
  assert.equal(ranking[0].product, 'Aceite 1L', 'mayor diferencia primero');
  assert.equal(ranking[1].product, 'Arroz 1kg');
});

test('separa por unidad de medida distinta', () => {
  const entries = [
    makeEntry({ product: 'Tomate', unit: 'kg', supermarket: 'Jumbo', city: 'Osorno', price: 1200 }),
    makeEntry({ product: 'Tomate', unit: 'un', supermarket: 'Lider', city: 'Osorno', price: 300 })
  ];
  const comps = buildComparisons(entries);
  assert.equal(comps.length, 2, 'kg y un son productos comparables distintos');
});

test('lista ciudades con conteo y ultima actualizacion', () => {
  const entries = [
    entryAt({ product: 'X', supermarket: 'A', city: 'Santiago', price: 100 }, '2026-05-01T00:00:00Z'),
    entryAt({ product: 'Y', supermarket: 'B', city: 'Santiago', price: 200 }, '2026-05-10T00:00:00Z'),
    entryAt({ product: 'Z', supermarket: 'C', city: 'Valparaiso', price: 300 }, '2026-05-05T00:00:00Z')
  ];
  const cities = citiesFromEntries(entries);
  assert.equal(cities.length, 2);
  const stgo = cities.find((c) => c.key === 'santiago');
  assert.equal(stgo.count, 2);
  assert.equal(lastUpdatedAt(entries), '2026-05-10T00:00:00Z');
});
