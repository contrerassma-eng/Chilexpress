/**
 * Inventario fisico.
 *
 * Contar es declarar la verdad: lo que se cuenta manda sobre lo registrado.
 * Un producto que estaba en el sistema y no aparecio en el conteo queda en
 * cero, porque no estaba en el mueble.
 *
 * El alcance puede ser una zona o la casa entera; nunca se tocan productos
 * fuera del alcance.
 */

export const claveLinea = (barcode, expiry) => `${barcode}|${expiry || ''}`;

/** Cruza lo contado con lo registrado y arma el descuadre completo. */
export function cuadrar({ items = [], byBarcode, conteo = {}, zona = 'todas' }) {
  const enAlcance = (z) => zona === 'todas' || z === zona;
  const lineas = [];
  const contadas = new Set();

  for (const l of Object.values(conteo)) {
    const item = byBarcode?.get(l.barcode);
    const lote = item?.lotes.find((x) => (x.expiry || '') === (l.expiry || ''));
    contadas.add(claveLinea(l.barcode, l.expiry));
    lineas.push({
      barcode: l.barcode,
      name: item?.name || l.name || l.barcode,
      zona: item?.zona || l.zona || '',
      expiry: l.expiry || '',
      antes: lote?.qty || 0,
      contado: Math.max(0, Math.trunc(l.contado) || 0)
    });
  }

  // Lo que el sistema tenia y nadie conto: no estaba, se va a cero.
  for (const item of items) {
    if (!enAlcance(item.zona)) continue;
    for (const lote of item.lotes) {
      if (contadas.has(claveLinea(item.barcode, lote.expiry))) continue;
      lineas.push({
        barcode: item.barcode,
        name: item.name,
        zona: item.zona,
        expiry: lote.expiry || '',
        antes: lote.qty,
        contado: 0
      });
    }
  }

  lineas.sort((a, b) =>
    a.name.localeCompare(b.name, 'es') || (a.expiry || '').localeCompare(b.expiry || ''));

  const diferencias = lineas.filter((l) => l.contado !== l.antes);
  let sobras = 0;
  let faltantes = 0;
  for (const l of diferencias) {
    const d = l.contado - l.antes;
    if (d > 0) sobras += d;
    else faltantes += -d;
  }

  return {
    lineas,
    diferencias,
    sobras,
    faltantes,
    contados: Object.keys(conteo).length,
    cuadra: diferencias.length === 0
  };
}
