import { useMemo, useState } from 'react';
import { STATUS } from '../state/store.jsx';
import { fmtDateTime, fmtTime } from '../lib/format.js';

const FILTERS = [
  { key: 'todos', label: 'Todos' },
  { key: STATUS.ESPERADO, label: 'Sin llegar' },
  { key: STATUS.RECIBIDO, label: 'Recibidos' },
  { key: STATUS.ENTREGADO, label: 'Entregados' }
];

function statusMeta(p) {
  if (p.status === STATUS.ENTREGADO) return `entregado ${fmtTime(p.deliveredAt)}`;
  if (p.status === STATUS.RECIBIDO) return `recibido ${fmtTime(p.arrivedAt)}`;
  return 'sin llegar';
}

function ShiftCard({ shift, onOpenReport }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('todos');
  const [query, setQuery] = useState('');
  const pkgs = shift.packages || [];
  const t = shift.totals || {};

  const items = useMemo(() => {
    const q = query.trim();
    let list = pkgs;
    if (filter !== 'todos') list = list.filter((p) => p.status === filter);
    if (q) list = list.filter((p) => p.code.includes(q));
    return list;
  }, [pkgs, filter, query]);

  return (
    <div className="hist-card">
      <button className="hist-card__head" onClick={() => setOpen((o) => !o)}>
        <div className="hist-card__title">
          <strong>{shift.responsable}</strong>
          <span className="muted">{fmtDateTime(shift.closedAt)}</span>
        </div>
        <div className="hist-card__totals">
          <span className="pill green">{t.entregados ?? 0} entreg.</span>
          <span className="pill amber">{t.recibidos ?? 0} recib.</span>
          <span className="pill">{t.sinLlegar ?? 0} sin lleg.</span>
        </div>
      </button>

      {open && (
        <div className="hist-card__body">
          <div className="hist-actions no-print">
            <button className="btn btn--sm btn--primary" onClick={() => onOpenReport(shift)}>Ver reporte</button>
          </div>
          <div className="chips">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                className={filter === f.key ? `chip chip--${f.key} active` : `chip chip--${f.key}`}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <input
            className="search"
            type="search"
            inputMode="numeric"
            placeholder="Buscar codigo en este turno&hellip;"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {items.length === 0 ? (
            <p className="empty">Sin codigos para este filtro.</p>
          ) : (
            <ul className="pkg-list">
              {items.map((p) => (
                <li key={p.code} className={`pkg pkg--${p.status}`}>
                  <div className="pkg__main">
                    <span className="pkg__check">{p.status === STATUS.ENTREGADO ? '✓' : ''}</span>
                    <span className="pkg__code">{p.code}</span>
                    <span className="pkg__meta">{statusMeta(p)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default function HistoryView({ history, onClose, onOpenReport }) {
  return (
    <div className="hist-view">
      <header className="topbar">
        <div className="topbar__info"><strong>Historial de turnos</strong></div>
        <div className="topbar__actions">
          <button className="btn btn--sm btn--ghost" onClick={onClose}>Volver</button>
        </div>
      </header>
      <main className="content">
        {history.length === 0 ? (
          <p className="empty">Aun no hay turnos cerrados.</p>
        ) : (
          history.map((shift) => (
            <ShiftCard key={shift.id || shift.closedAt} shift={shift} onOpenReport={onOpenReport} />
          ))
        )}
      </main>
    </div>
  );
}
