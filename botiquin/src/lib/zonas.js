/**
 * Zonas de la casa.
 *
 * No son cuatro listas iguales: cada una avisa con la anticipacion que tiene
 * sentido ahi (la leche del refrigerador no se avisa con dos meses) y pide la
 * fecha como viene impresa en ese tipo de producto.
 *
 *   aviso -> dias antes de caducar en que el item se pone en ambar
 *   fecha -> como parte el selector de vencimiento: 'mes' | 'dia' | 'sin'
 */
export const ZONAS = {
  botiquin: {
    id: 'botiquin',
    nombre: 'Botiquín',
    icono: '💊',
    aviso: 60,
    fecha: 'mes'
  },
  despensa: {
    id: 'despensa',
    nombre: 'Despensa',
    icono: '🥫',
    aviso: 30,
    fecha: 'mes'
  },
  refrigerador: {
    id: 'refrigerador',
    nombre: 'Refrigerador',
    icono: '🧊',
    aviso: 5,
    fecha: 'dia'
  },
  aseo: {
    id: 'aseo',
    nombre: 'Aseo',
    icono: '🧽',
    aviso: 30,
    fecha: 'sin'
  }
};

export const ZONA_POR_DEFECTO = 'botiquin';
export const listaZonas = Object.values(ZONAS);

export function zonaDe(id) {
  return ZONAS[id] || ZONAS[ZONA_POR_DEFECTO];
}

export function esZona(id) {
  return Object.prototype.hasOwnProperty.call(ZONAS, id);
}
