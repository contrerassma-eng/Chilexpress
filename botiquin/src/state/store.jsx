import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { almacen } from '../lib/storage.js';
import { api } from '../lib/api.js';
import { planConsumo, project, resumen } from '../lib/inventory.js';
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

    case 'SYNC_OK': {
      const aplicados = new Set(action.aplicados || []);
      return {
        ...state,
        snapshot: action.snapshot,
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

  const sincronizar = useCallback(async () => {
    const { pin, outbox, who } = ref.current;
    if (!pin || enCurso.current) return;
    enCurso.current = true;
    dispatch({ type: 'SYNC_INICIO' });
    try {
      const enviando = outbox.slice(0, 200);
      if (enviando.length) {
        const data = await api.sync(pin, enviando, who);
        dispatch({ type: 'SYNC_OK', snapshot: data.state, aplicados: data.applied || [] });
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
    if (!state.pin) return undefined;
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
  }, [state.pin, state.outbox.length, sincronizar]);

  const { items, byBarcode } = useMemo(
    () => project(state.snapshot, state.outbox),
    [state.snapshot, state.outbox]
  );

  const totales = useMemo(() => resumen(items), [items]);

  const acciones = useMemo(() => {
    const encolar = (...movimientos) => dispatch({ type: 'ENCOLAR', movimientos });
    const base = (extra) => ({
      id: uid(),
      at: nowIso(),
      who: ref.current.who || '',
      expiry: '',
      name: '',
      qty: 1,
      ...extra
    });

    return {
      comprar: ({ barcode, name, expiry, qty, note }) =>
        encolar(base({ kind: 'compra', barcode, name, expiry: expiry || '', qty: Math.max(1, qty || 1), note })),

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

      renombrar: (barcode, name) =>
        encolar(base({ kind: 'nombre', barcode, name, qty: 0 })),

      borrar: (item) =>
        encolar(base({ kind: 'borrar', barcode: item.barcode, name: item.name, qty: 0 })),

      setPin: (pin) => dispatch({ type: 'PIN', pin }),
      setQuien: (who) => dispatch({ type: 'QUIEN', who }),
      salir: () => { almacen.borrarTodo(); dispatch({ type: 'SALIR' }); },
      sincronizar
    };
  }, [sincronizar]);

  const value = useMemo(
    () => ({ state, items, byBarcode, totales, pendientes: state.outbox.length, ...acciones }),
    [state, items, byBarcode, totales, acciones]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBotiquin() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useBotiquin debe usarse dentro de StoreProvider');
  return ctx;
}
