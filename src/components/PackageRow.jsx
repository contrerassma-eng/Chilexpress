import { useState } from 'react';
import { STATUS } from '../state/store.jsx';
import { fmtTime } from '../lib/format.js';

export default function PackageRow({ pkg, dispatch }) {
  const [open, setOpen] = useState(false);
  const entregado = pkg.status === STATUS.ENTREGADO;

  return (
    <li className={`pkg pkg--${pkg.status}`}>
      <button className="pkg__main" onClick={() => setOpen((o) => !o)}>
        <span className="pkg__check" aria-hidden="true">{entregado ? '✓' : ''}</span>
        <span className="pkg__code">{pkg.code}</span>
        <span className="pkg__meta">
          {pkg.status === STATUS.ENTREGADO && `entregado ${fmtTime(pkg.deliveredAt)}`}
          {pkg.status === STATUS.RECIBIDO && `recibido ${fmtTime(pkg.arrivedAt)}`}
          {pkg.status === STATUS.ESPERADO && 'sin llegar'}
        </span>
      </button>
      {open && (
        <div className="pkg__actions">
          <button onClick={() => { dispatch({ type: 'SET_STATUS', code: pkg.code, status: STATUS.RECIBIDO }); setOpen(false); }}>
            Recibido
          </button>
          <button onClick={() => { dispatch({ type: 'SET_STATUS', code: pkg.code, status: STATUS.ENTREGADO }); setOpen(false); }}>
            Entregado
          </button>
          <button onClick={() => { dispatch({ type: 'SET_STATUS', code: pkg.code, status: STATUS.ESPERADO }); setOpen(false); }}>
            Sin llegar
          </button>
          <button className="danger" onClick={() => { dispatch({ type: 'REMOVE', code: pkg.code }); setOpen(false); }}>
            Quitar
          </button>
        </div>
      )}
    </li>
  );
}
