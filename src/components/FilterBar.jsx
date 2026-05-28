import { STATUS } from '../state/store.jsx';

const FILTERS = [
  { key: 'todos', label: 'Todos' },
  { key: STATUS.ESPERADO, label: 'Sin llegar' },
  { key: STATUS.RECIBIDO, label: 'Recibidos' },
  { key: STATUS.ENTREGADO, label: 'Entregados' }
];

export default function FilterBar({ filter, setFilter, counts, query, setQuery }) {
  return (
    <div className="filter-bar">
      <div className="chips">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={filter === f.key ? `chip chip--${f.key} active` : `chip chip--${f.key}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
            <span className="chip__count">{counts[f.key] ?? 0}</span>
          </button>
        ))}
      </div>
      <input
        className="search"
        type="search"
        inputMode="numeric"
        placeholder="Buscar codigo&hellip;"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
    </div>
  );
}
