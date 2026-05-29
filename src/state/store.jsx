import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import { saveState } from '../lib/storage.js';
import { backend, REMOTE } from '../lib/backend.js';

// Estado: lista plana de registros de precio. La comparacion y el ranking se
// derivan en tiempo de render (ver lib/pricing.js). El origen de los datos
// (remoto o local) lo resuelve lib/backend.js.
const initialState = {
  entries: [],
  selectedCity: null,
  loading: true,
  error: null
};

function reducer(state, action) {
  switch (action.type) {
    case 'HYDRATE':
      return { ...state, entries: action.entries, loading: false, error: null };

    case 'LOAD_ERROR':
      return { ...state, loading: false, error: action.error };

    case 'SELECT_CITY':
      return { ...state, selectedCity: action.cityKey || null };

    case 'PREPEND': {
      if (!action.entries || action.entries.length === 0) return state;
      const selectedCity = state.selectedCity || action.entries[0].cityKey;
      return { ...state, entries: [...action.entries, ...state.entries], selectedCity };
    }

    case 'REMOVE_ENTRY':
      return { ...state, entries: state.entries.filter((e) => e.id !== action.id) };

    case 'CLEAR_ALL':
      return { ...state, entries: [] };

    default:
      return state;
  }
}

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Carga inicial desde el backend (remoto o local).
  useEffect(() => {
    let alive = true;
    backend
      .list()
      .then((entries) => { if (alive) dispatch({ type: 'HYDRATE', entries }); })
      .catch((err) => { if (alive) dispatch({ type: 'LOAD_ERROR', error: String(err.message || err) }); });
    return () => { alive = false; };
  }, []);

  // En modo local, persistimos cada cambio en el dispositivo. En remoto, la
  // fuente de verdad es el Worker; igual cacheamos para arranque offline.
  useEffect(() => {
    if (!state.loading) saveState({ entries: state.entries });
  }, [state.entries, state.loading]);

  const actions = useMemo(() => ({
    async addEntries(items) {
      const created = await backend.add(items);
      dispatch({ type: 'PREPEND', entries: created });
      return created;
    },
    removeEntry(id) {
      dispatch({ type: 'REMOVE_ENTRY', id });
      backend.remove(id).catch(() => {});
    },
    clearAll() {
      dispatch({ type: 'CLEAR_ALL' });
      backend.clear().catch(() => {});
    },
    selectCity(cityKey) {
      dispatch({ type: 'SELECT_CITY', cityKey });
    }
  }), []);

  const value = useMemo(() => ({ state, remote: REMOTE, ...actions }), [state, actions]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore debe usarse dentro de StoreProvider');
  return ctx;
}
