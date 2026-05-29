import { createContext, useContext, useEffect, useReducer } from 'react';
import { loadState, saveState } from '../lib/storage.js';
import { makeEntry } from '../lib/pricing.js';
import { normalize } from '../lib/catalog.js';

// Estado: lista plana de registros de precio. La comparacion y el ranking se
// derivan en tiempo de render (ver lib/pricing.js).
const initialState = {
  entries: [],          // [entry] (ver lib/pricing.js)
  contributor: null,    // nombre opcional de quien sube (solo informativo)
  selectedCity: null    // cityKey seleccionada en el filtro
};

function reducer(state, action) {
  switch (action.type) {
    case 'HYDRATE':
      return { ...initialState, ...action.payload };

    case 'SET_CONTRIBUTOR':
      return { ...state, contributor: action.name || null };

    case 'SELECT_CITY':
      return { ...state, selectedCity: action.cityKey || null };

    // Agrega uno o varios registros (varios = items de una misma boleta).
    case 'ADD_ENTRIES': {
      const entries = action.items
        .map((it) => makeEntry(it))
        .filter((e) => e.productKey && e.supermarketKey && e.cityKey && e.price > 0);
      if (entries.length === 0) return state;
      // Si subimos por primera vez datos de una ciudad, la dejamos seleccionada.
      const selectedCity = state.selectedCity || entries[0].cityKey;
      return { ...state, entries: [...entries, ...state.entries], selectedCity };
    }

    case 'UPDATE_ENTRY': {
      const { id, patch } = action;
      return {
        ...state,
        entries: state.entries.map((e) => {
          if (e.id !== id) return e;
          const merged = { ...e, ...patch, updatedAt: new Date().toISOString() };
          // Reconstruye las claves derivadas si cambio el texto.
          if (patch.product !== undefined) merged.productKey = normalize(merged.product);
          if (patch.supermarket !== undefined) merged.supermarketKey = normalize(merged.supermarket);
          if (patch.city !== undefined) merged.cityKey = normalize(merged.city);
          if (patch.price !== undefined) merged.price = Number(merged.price) || 0;
          return merged;
        })
      };
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
