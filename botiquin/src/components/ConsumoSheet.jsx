import { useState } from 'react';
import Sheet from './Sheet.jsx';
import Cantidad from './Cantidad.jsx';
import { planConsumo } from '../lib/inventory.js';
import { expiryLabel, expiryState, fmtExpiry } from '../lib/format.js';
import { zonaDe } from '../lib/zonas.js';

/** Baja de stock. Siempre sale primero lo que vence antes. */
export default function ConsumoSheet({ item, onConsumir, onClose }) {
  const [cantidad, setCantidad] = useState(1);
  const { plan } = planConsumo(item, cantidad);
  const primerLote = item.lotes[0];
  const vencido = expiryState(primerLote?.expiry, item.aviso) === 'vencido';

  return (
    <Sheet
      titulo={item.name}
      subtitulo={`${item.total} en ${zonaDe(item.zona).nombre.toLowerCase()}`}
      onClose={onClose}
      footer={
        <div className="pie-acciones">
          <button className="btn btn--principal btn--grande" onClick={() => onConsumir(cantidad, 'consumo')}>
            Sacar {cantidad}
          </button>
          {vencido && (
            <button className="btn btn--peligro" onClick={() => onConsumir(cantidad, 'descarte')}>
              Botar vencido
            </button>
          )}
        </div>
      }
    >
      <label>
        Cuánto sacas
        <Cantidad valor={cantidad} onChange={setCantidad} max={Math.max(1, item.total)} />
      </label>

      <div className="lotes">
        {item.lotes.map((l) => {
          const enPlan = plan.find((p) => p.expiry === l.expiry);
          return (
            <div key={l.expiry || 'sin'} className={`lote ${enPlan ? 'lote--activo' : ''}`}>
              <span className={`punto punto--${expiryState(l.expiry, item.aviso)}`} />
              <span className="lote__fecha">{fmtExpiry(l.expiry)}</span>
              <span className="lote__aviso">{expiryLabel(l.expiry, item.aviso)}</span>
              <span className="lote__qty">
                {enPlan ? `${l.qty} → ${l.qty - enPlan.qty}` : l.qty}
              </span>
            </div>
          );
        })}
      </div>

      {cantidad > item.total && (
        <p className="alerta">Solo hay {item.total}. Se sacará esa cantidad.</p>
      )}
    </Sheet>
  );
}
