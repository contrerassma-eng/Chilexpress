import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { almacen } from '../lib/storage.js';
import { api } from '../lib/api.js';
import { planConsumo, project, resumen } from '../lib/inventory.js';
import { claveLinea } from '../lib/conteo.js';
import { nowIso, uid } from '../lib/format.js';

/**
 * Estado de la app.
 *
 * La verdad vive en D1, pero la pantalla se dibuja con la ultima foto que bajo
 * del servidor mas los movimientos que siguen en la cola del telefono. Asi
 * agregar o sacar un remedio se ve al instante y, si no hay señal, queda
 * pendiente hasta que vuelva.
 */

const REFRESCO_MS = 60000;

function initState() {
  return {
    pin: almacen.pin(),
    who: almacen.who(),
    snapshot: almacen.snapshot(),
    outbox: almacen.outbox(),
    inventario: almacen.inventario(),   // conteo en curso, si lo hay
    actas: almacen.actas(),             // inventarios cerrados sin subir
    sync: 'idle',          // idle | sincronizando | ok | sin-conexion | error
    error: '',
    pinInvalido: false,
    ultimaSync: null
  };
}

function reducer(state, action) {
  switch (action.type) {
    case 'PIN':
      return { ...state, pin: action.pin, pinInvalido: false, error: '' };

    case 'QUIEN':
      return { ...state, who: action.who };

    case 'ENCOLAR':
      return { ...state, outbox: [...state.outbox, ...action.movimientos] };

    case 'SYNC_INICIO':
      return { ...state, sync: 'sincronizando', error: '' };

    case 'INICIAR_INVENTARIO':
      return { ...state, inventario: action.inventario };

    case 'CONTAR': {
      if (!state.inventario) return state;
      const conteo = { ...state.inventario.conteo, [action.clave]: action.linea };
      return { ...state, inventario: { ...state.inventario, conteo } };
    }

    case 'BORRAR_LINEA': {
      if (!state.inventario) return state;
      const conteo = { ...state.inventario.conteo };
      delete conteo[action.clave];
      return { ...state, inventario: { ...state.inventario, conteo } };
    }

    case 'CANCELAR_INVENTARIO':
      return { ...state, inventario: null };

    case 'CERRAR_INVENTARIO':
      return {
        ...state,
        inventario: null,
        outbox: [...state.outbox, ...action.movimientos],
        actas: [...state.actas, action.acta]
      };

    case 'SYNC_OK': {
      const aplicados = new Set(action.aplicados || []);
      const guardadas = new Set(action.actas || []);
      return {
        ...state,
        snapshot: action.snapshot,
        actas: state.actas.filter((a) => !guardadas.has(a.id)),
        outbox: state.outbox.filter((m) => !aplicados.has(m.id)),
        sync: 'ok',
        error: '',
        pinInvalido: false,
        ultimaSync: nowIso()
      };
    }

    case 'SYNC_FALLA':
      return {
        ...state,
        sync: action.status === 0 ? 'sin-conexion' : 'error',
        error: action.error,
        pinInvalido: action.status === 401
      };

    case 'SALIR':
      return { ...initState(), pin: '', snapshot: { products: [], lots: [] }, outbox: [] };

    default:
      return state;
  }
}

const Ctx = createContext(null);

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, initState);
  const ref = useRef(state);
  ref.current = state;
  const enCurso = useRef(false);

  // Persistimos cada pedazo por separado para no reescribir todo en cada tecla.
  useEffect(() => { almacen.setPin(state.pin); }, [state.pin]);
  useEffect(() => { almacen.setWho(state.who); }, [state.who]);
  useEffect(() => { almacen.setSnapshot(state.snapshot); }, [state.snapshot]);
  useEffect(() => { almacen.setOutbox(state.outbox); }, [state.outbox]);
  useEffect(() => { almacen.setInventario(state.inventario); }, [state.inventario]);
  useEffect(() => { almacen.setActas(state.actas); }, [state.actas]);

  const sincronizar = useCallback(async () => {
    // El PIN puede ir vacio: si el Worker no tiene uno configurado, deja pasar.
    const { pin, outbox, who, actas } = ref.current;
    if (enCurso.current) return;
    enCurso.current = true;
    dispatch({ type: 'SYNC_INICIO' });
    try {
      const enviando = outbox.slice(0, 200);
      const enviandoActas = actas.slice(0, 10);
      if (enviando.length || enviandoActas.length) {
        const data = await api.sync(pin, enviando, who, enviandoActas);
        dispatch({
          type: 'SYNC_OK',
          snapshot: data.state,
          aplicados: data.applied || [],
          actas: data.stocktakes || []
        });
      } else {
        const data = await api.state(pin);
        dispatch({ type: 'SYNC_OK', snapshot: data, aplicados: [] });
      }
    } catch (e) {
      dispatch({ type: 'SYNC_FALLA', error: e.message || 'Error', status: e.status });
    } finally {
      enCurso.current = false;
    }
  }, []);

  // Sube la cola apenas cambie algo, al volver la señal y al reabrir la app.
  useEffect(() => {
    sincronizar();

    const alVolver = () => sincronizar();
    const alMostrar = () => { if (document.visibilityState === 'visible') sincronizar(); };
    window.addEventListener('online', alVolver);
    document.addEventListener('visibilitychange', alMostrar);
    const timer = window.setInterval(alMostrar, REFRESCO_MS);

    return () => {
      window.removeEventListener('online', alVolver);
      document.removeEventListener('visibilitychange', alMostrar);
      window.clearInterval(timer);
    };
  }, [state.pin, state.outbox.length, state.actas.length, sincronizar]);

  const { items, byBarcode } = useMemo(
    () => project(state.snapshot, state.outbox),
    [state.snapshot, state.outbox]
  );

  const totales = useMemo(() => resumen(items), [items]);

  const acciones = useMemo(() => {
    const encolar = (...movimientos) => dispatch({ type: 'ENCOLAR', movimientos });
    // zona vacia = "no tocar la ficha del producto". Solo la mandan las
    // acciones que de verdad deciden donde vive el producto.
    const base = (extra) => ({
      id: uid(),
      at: nowIso(),
      who: ref.current.who || '',
      expiry: '',
      name: '',
      zona: '',
      qty: 1,
      ...extra
    });

    return {
      comprar: ({ barcode, name, expiry, qty, note, zona }) =>
        encolar(base({ kind: 'compra', barcode, name, zona, expiry: expiry || '', qty: Math.max(1, qty || 1), note })),

      // Descuenta empezando por el lote que vence primero (FEFO).
      consumir: (item, cantidad, kind = 'consumo') => {
        const { plan } = planConsumo(item, cantidad);
        if (!plan.length) return 0;
        encolar(...plan.map((p) => base({ kind, barcode: item.barcode, name: item.name, expiry: p.expiry, qty: p.qty })));
        return plan.reduce((s, p) => s + p.qty, 0);
      },

      // Saca una cantidad de un lote puntual (desde el detalle del producto).
      consumirLote: (item, expiry, cantidad, kind = 'consumo') =>
        encolar(base({ kind, barcode: item.barcode, name: item.name, expiry: expiry || '', qty: Math.max(1, cantidad || 1) })),

      ajustar: (item, expiry, cantidad) =>
        encolar(base({ kind: 'ajuste', barcode: item.barcode, name: item.name, expiry: expiry || '', qty: Math.max(0, cantidad) })),

      // Sirve para corregir el nombre, para mover el producto de zona, o ambas.
      renombrar: (barcode, name, zona) =>
        encolar(base({ kind: 'nombre', barcode, name, zona, qty: 0 })),

      /**
       * Le pone su codigo de barras a un producto que se habia guardado sin el
       * (o con otro). Se resuelve con los movimientos que ya existen: se pasa
       * el stock lote por lote al codigo nuevo y se borra la ficha vieja, asi
       * funciona igual sin señal y sin logica nueva en el servidor.
       */
      vincular: (item, nuevoBarcode) => {
        const movimientos = item.lotes.map((l) =>
          base({
            kind: 'compra',
            barcode: nuevoBarcode,
            name: item.name,
            zona: item.zona,
            expiry: l.expiry,
            qty: l.qty
          })
        );
        // Sin stock no hay lotes que mover, pero el nombre y la zona se conservan.
        if (!movimientos.length) {
          movimientos.push(base({ kind: 'nombre', barcode: nuevoBarcode, name: item.name, zona: item.zona, qty: 0 }));
        }
        movimientos.push(base({ kind: 'borrar', barcode: item.barcode, name: item.name, qty: 0 }));
        encolar(...movimientos);
      },

      borrar: (item) =>
        encolar(base({ kind: 'borrar', barcode: item.barcode, name: item.name, qty: 0 })),

      // --- Inventario fisico ---

      iniciarInventario: (zona) =>
        dispatch({
          type: 'INICIAR_INVENTARIO',
          inventario: { id: uid(), zona: zona || 'todas', iniciado: nowIso(), conteo: {} }
        }),

      contar: (linea) =>
        dispatch({ type: 'CONTAR', clave: claveLinea(linea.barcode, linea.expiry), linea }),

      borrarLinea: (clave) => dispatch({ type: 'BORRAR_LINEA', clave }),

      cancelarInventario: () => dispatch({ type: 'CANCELAR_INVENTARIO' }),

      /**
       * Cierra el conteo: deja el stock igual a lo contado y guarda el acta con
       * la fecha y todas las diferencias. Los ajustes viajan como movimientos
       * normales, asi que se puede cerrar sin señal.
       */
      cerrarInventario: (cuadre) => {
        const inv = ref.current.inventario;
        if (!inv) return;
        const movimientos = cuadre.diferencias.map((l) =>
          base({ kind: 'ajuste', barcode: l.barcode, name: l.name, zona: l.zona, expiry: l.expiry, qty: l.contado })
        );
        const acta = {
          id: inv.id,
          zona: inv.zona === 'todas' ? '' : inv.zona,
          started_at: inv.iniciado,
          closed_at: nowIso(),
          who: ref.current.who || '',
          lines: cuadre.lineas.map((l) => ({
            barcode: l.barcode,
            name: l.name,
            zona: l.zona,
            expiry: l.expiry,
            antes: l.antes,
            contado: l.contado
          }))
        };
        dispatch({ type: 'CERRAR_INVENTARIO', movimientos, acta });
      },

      setPin: (pin) => dispatch({ type: 'PIN', pin }),
      setQuien: (who) => dispatch({ type: 'QUIEN', who }),
      salir: () => { almacen.borrarTodo(); dispatch({ type: 'SALIR' }); },
      sincronizar
    };
  }, [sincronizar]);

  const value = useMemo(
    () => ({
      state,
      items,
      byBarcode,
      totales,
      inventario: state.inventario,
      pendientes: state.outbox.length + state.actas.length,
      ...acciones
    }),
    [state, items, byBarcode, totales, acciones]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBotiquin() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useBotiquin debe usarse dentro de StoreProvider');
  return ctx;
}
