import { createContext, useContext, useEffect, useReducer } from 'react';
import { loadState, saveState } from '../lib/storage.js';
import { nowIso } from '../lib/format.js';

export const STATUS = {
  ESPERADO: 'esperado',   // en la lista/manifiesto, aun no llega
  RECIBIDO: 'recibido',   // llego al local (punto / amarillo)
  ENTREGADO: 'entregado'  // entregado (destacador verde)
};

const initialState = {
  packages: {},   // code -> { code, status, source, arrivedAt, deliveredAt }
  shift: null,    // { responsable, startedAt }
  history: []     // [{ responsable, startedAt, closedAt, totals }]
};

function normalizeCode(code) {
  return String(code || '').trim();
}

function ensurePkg(packages, code, source) {
  if (!packages[code]) {
    packages[code] = { code, status: STATUS.ESPERADO, source: source || 'scan', arrivedAt: null, deliveredAt: null };
  }
  return packages[code];
}

function reducer(state, action) {
  switch (action.type) {
    case 'HYDRATE':
      return { ...initialState, ...action.payload };

    case 'IMPORT': {
      const packages = { ...state.packages };
      for (const raw of action.codes) {
        const code = normalizeCode(raw);
        if (!code) continue;
        if (!packages[code]) {
          packages[code] = { code, status: STATUS.ESPERADO, source: 'csv', arrivedAt: null, deliveredAt: null };
        }
      }
      return { ...state, packages };
    }

    case 'SCAN': {
      const code = normalizeCode(action.code);
      if (!code) return state;
      const at = action.at || nowIso();
      const packages = { ...state.packages };
      const prev = packages[code]
        ? { ...packages[code] }
        : { code, status: STATUS.ESPERADO, source: 'scan', arrivedAt: null, deliveredAt: null };

      if (action.mode === 'entrega') {
        prev.status = STATUS.ENTREGADO;
        prev.deliveredAt = at;
        if (!prev.arrivedAt) prev.arrivedAt = at;
      } else {
        // recepcion
        if (prev.status === STATUS.ESPERADO || !packages[code]) {
          prev.status = STATUS.RECIBIDO;
        }
        if (!prev.arrivedAt) prev.arrivedAt = at;
      }
      packages[code] = prev;
      return { ...state, packages };
    }

    case 'SET_STATUS': {
      const code = normalizeCode(action.code);
      const pkg = state.packages[code];
      if (!pkg) return state;
      const at = nowIso();
      const next = { ...pkg, status: action.status };
      if (action.status === STATUS.ENTREGADO) {
        next.deliveredAt = at;
        if (!next.arrivedAt) next.arrivedAt = at;
      } else if (action.status === STATUS.RECIBIDO) {
        if (!next.arrivedAt) next.arrivedAt = at;
        next.deliveredAt = null;
      } else {
        next.arrivedAt = null;
        next.deliveredAt = null;
      }
      return { ...state, packages: { ...state.packages, [code]: next } };
    }

    case 'REMOVE': {
      const packages = { ...state.packages };
      delete packages[normalizeCode(action.code)];
      return { ...state, packages };
    }

    case 'CLEAR_DELIVERED': {
      const packages = {};
      for (const p of Object.values(state.packages)) {
        if (p.status !== STATUS.ENTREGADO) packages[p.code] = p;
      }
      return { ...state, packages };
    }

    case 'CLEAR_ALL':
      return { ...state, packages: {} };

    case 'START_SHIFT':
      return { ...state, shift: { responsable: action.responsable, startedAt: nowIso() } };

    case 'CLOSE_SHIFT': {
      const closed = {
        responsable: state.shift?.responsable || '-',
        startedAt: state.shift?.startedAt || null,
        closedAt: nowIso(),
        totals: action.totals
      };
      return { ...state, shift: null, history: [closed, ...state.history].slice(0, 60) };
    }

    default:
      return state;
  }
}

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState, (init) => {
    const loaded = loadState();
    return loaded ? { ...init, ...loaded } : init;
  });

  useEffect(() => {
    saveState(state);
  }, [state]);

  return (
    <StoreContext.Provider value={{ state, dispatch }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore debe usarse dentro de StoreProvider');
  return ctx;
}
