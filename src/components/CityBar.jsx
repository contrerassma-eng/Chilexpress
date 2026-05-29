import { fmtRelative } from '../lib/format.js';

// Filtro de ciudad (chips) + sello de ultima actualizacion de la ciudad activa.
export default function CityBar({ cities, selectedCity, onSelect, lastUpdated }) {
  if (cities.length === 0) return null;
  return (
    <div className="city-bar">
      <div className="chips">
        {cities.map((c) => (
          <button
            key={c.key}
            className={selectedCity === c.key ? 'chip active' : 'chip'}
            onClick={() => onSelect(c.key)}
          >
            {c.name}
            <span className="chip__count">{c.count}</span>
          </button>
        ))}
      </div>
      {lastUpdated && (
        <p className="city-bar__stamp muted">Ultima actualizacion: {fmtRelative(lastUpdated)}</p>
      )}
    </div>
  );
}
