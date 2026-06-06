import { useState } from 'react';
import { fmtCLP, fmtRelative } from '../lib/format.js';
import ProductThumb from './ProductThumb.jsx';

// Tarjeta de un grupo de comparacion: un producto con su precio vigente en cada
// supermercado, el mas barato destacado y el ahorro potencial.
export default function ProductCard({ comp, rank, onRemoveEntry }) {
  const [open, setOpen] = useState(false);
  const hasDiff = comp.count >= 2 && comp.diff > 0;

  return (
    <li className="pcard">
      <button className="pcard__head" onClick={() => setOpen((o) => !o)}>
        {rank != null && <span className="pcard__rank">{rank}</span>}
        <ProductThumb barcode={comp.barcode} name={comp.product} />
        <div className="pcard__title">
          <strong>{comp.product}</strong>
          <span className="muted">
            {comp.unit ? `por ${comp.unit} · ` : ''}{comp.count} {comp.count === 1 ? 'supermercado' : 'supermercados'}
          </span>
          {comp.barcode && <span className="pcard__ean">⠿ {comp.barcode}</span>}
        </div>
        <div className="pcard__diff">
          {hasDiff ? (
            <>
              <span className="pcard__diff-amount">{fmtCLP(comp.diff)}</span>
              <span className="pcard__diff-pct">+{comp.diffPct}%</span>
            </>
          ) : (
            <span className="muted">sin comparar</span>
          )}
        </div>
      </button>

      {/* Resumen siempre visible: el mas barato */}
      <div className="pcard__best">
        <span className="tag tag--green">Mas barato</span>
        <strong>{comp.cheapest.supermarket}</strong>
        <span className="pcard__best-price">{fmtCLP(comp.cheapest.price)}</span>
        <span className="muted">· {fmtRelative(comp.cheapest.updatedAt)}</span>
      </div>

      {open && (
        <ul className="pcard__rows">
          {comp.prices.map((p, i) => (
            <li key={p.id} className={i === 0 ? 'prow prow--best' : 'prow'}>
              <span className="prow__store">
                {p.supermarket}
                {comp.barcode && p.product && p.product !== comp.product && (
                  <small className="prow__alias"> · {p.product}</small>
                )}
              </span>
              <span className="prow__price">{fmtCLP(p.price)}</span>
              {i !== 0 && comp.min > 0 && (
                <span className="prow__delta">+{fmtCLP(p.price - comp.min)}</span>
              )}
              <span className="prow__date muted">{fmtRelative(p.updatedAt)}</span>
              {onRemoveEntry && (
                <button
                  className="prow__del"
                  aria-label="Eliminar este precio"
                  onClick={() => onRemoveEntry(p.id)}
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
