import { useMemo, useState } from 'react';
import { useStore } from './state/store.jsx';
import {
  buildComparisons,
  rankByDifference,
  citiesFromEntries,
  lastUpdatedAt
} from './lib/pricing.js';
import { normalize } from './lib/catalog.js';
import { ICON_DATA_URI } from './lib/brand.js';
import CityBar from './components/CityBar.jsx';
import ProductCard from './components/ProductCard.jsx';
import AddPriceModal from './components/AddPriceModal.jsx';

export default function App() {
  const { state, remote, addEntries, removeEntry, clearAll, selectCity } = useStore();
  const [showAdd, setShowAdd] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [view, setView] = useState('ranking'); // 'ranking' | 'todos'
  const [query, setQuery] = useState('');

  const cities = useMemo(() => citiesFromEntries(state.entries), [state.entries]);

  // Ciudad activa: la seleccionada si sigue existiendo, si no la primera.
  const activeCity = useMemo(() => {
    if (state.selectedCity && cities.some((c) => c.key === state.selectedCity)) {
      return state.selectedCity;
    }
    return cities[0]?.key || null;
  }, [state.selectedCity, cities]);

  const cityEntries = useMemo(
    () => state.entries.filter((e) => e.cityKey === activeCity),
    [state.entries, activeCity]
  );

  const comparisons = useMemo(() => buildComparisons(cityEntries), [cityEntries]);
  const ranking = useMemo(() => rankByDifference(comparisons), [comparisons]);
  const lastUpdated = useMemo(() => lastUpdatedAt(cityEntries), [cityEntries]);

  const list = useMemo(() => {
    const base = view === 'ranking' ? ranking : [...comparisons].sort((a, b) => b.diff - a.diff);
    const q = normalize(query);
    if (!q) return base;
    return base.filter((c) => c.product && normalize(c.product).includes(q));
  }, [view, ranking, comparisons, query]);

  async function handleSave(items) {
    await addEntries(items);
    setShowAdd(false);
  }

  if (state.loading) {
    return (
      <div className="start-shift">
        <div className="start-card">
          <img src={ICON_DATA_URI} alt="" width="64" height="64" />
          <h1>Precios de Supermercado</h1>
          <p className="muted">Cargando precios…</p>
        </div>
      </div>
    );
  }

  // Primera vez: sin datos -> pantalla de bienvenida.
  if (state.entries.length === 0) {
    return (
      <div className="start-shift">
        <div className="start-card">
          <img src={ICON_DATA_URI} alt="" width="64" height="64" />
          <h1>Precios de Supermercado</h1>
          <p className="muted">
            Compara precios entre supermercados de tu ciudad. Sube la foto de tu
            boleta y registra los precios para empezar.
          </p>
          {state.error && (
            <p className="err-msg">No se pudo conectar al servidor. Revisa tu conexion.</p>
          )}
          <button className="btn btn--primary btn--big" onClick={() => setShowAdd(true)}>
            Subir mi primera boleta
          </button>
        </div>
        {showAdd && (
          <AddPriceModal onClose={() => setShowAdd(false)} onSave={handleSave} />
        )}
      </div>
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar__info">
          <strong>Precios de Supermercado</strong>
          <span className="muted">{remote ? 'Comparador compartido por ciudad' : 'Comparador por ciudad (local)'}</span>
        </div>
        <div className="topbar__actions">
          <button className="btn btn--sm" onClick={() => setShowAdd(true)}>+ Boleta</button>
          <button className="btn btn--sm btn--ghost" aria-label="Menu" onClick={() => setMenuOpen((o) => !o)}>⋮</button>
          {menuOpen && (
            <div className="menu" onClick={() => setMenuOpen(false)}>
              <button
                className="danger"
                onClick={() => { if (confirm('Borrar TODOS los precios guardados?')) clearAll(); }}
              >
                Borrar todos los datos
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="content">
        <CityBar
          cities={cities}
          selectedCity={activeCity}
          onSelect={selectCity}
          lastUpdated={lastUpdated}
        />

        <div className="view-toggle" role="tablist">
          <button
            role="tab"
            aria-selected={view === 'ranking'}
            className={view === 'ranking' ? 'seg active' : 'seg'}
            onClick={() => setView('ranking')}
          >
            Mayores diferencias
          </button>
          <button
            role="tab"
            aria-selected={view === 'todos'}
            className={view === 'todos' ? 'seg active' : 'seg'}
            onClick={() => setView('todos')}
          >
            Todos los productos
          </button>
        </div>

        <input
          className="search"
          type="search"
          placeholder="Buscar producto&hellip;"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        {list.length === 0 ? (
          <p className="empty">
            {view === 'ranking'
              ? 'Aun no hay productos con precios en 2 o mas supermercados de esta ciudad. Sube mas boletas para comparar.'
              : 'No hay productos que coincidan.'}
          </p>
        ) : (
          <ul className="pcard-list">
            {list.map((comp, i) => (
              <ProductCard
                key={comp.key}
                comp={comp}
                rank={view === 'ranking' ? i + 1 : null}
                onRemoveEntry={removeEntry}
              />
            ))}
          </ul>
        )}
      </main>

      {showAdd && (
        <AddPriceModal
          defaultCity={cities.find((c) => c.key === activeCity)?.name || ''}
          onClose={() => setShowAdd(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
