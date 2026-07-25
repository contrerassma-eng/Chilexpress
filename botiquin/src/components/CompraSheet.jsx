import { useState } from 'react';
import Sheet from './Sheet.jsx';
import Cantidad from './Cantidad.jsx';
import Vencimiento from './Vencimiento.jsx';
import { fmtExpiry } from '../lib/format.js';

/**
 * Alta de stock. Si el codigo ya se escaneo antes, el nombre viene puesto y
 * solo hay que confirmar cantidad y vencimiento.
 */
export default function CompraSheet({ barcode, item, expiryInicial = '', avisoConsumo = false, onGuardar, onClose }) {
  const [nombre, setNombre] = useState(item?.name || '');
  const [cantidad, setCantidad] = useState(1);
  const [expiry, setExpiry] = useState(expiryInicial);

  const puedeGuardar = nombre.trim().length > 0;

  function guardar(e) {
    e.preventDefault();
    if (!puedeGuardar) return;
    onGuardar({ barcode, name: nombre.trim(), qty: cantidad, expiry });
  }

  return (
    <Sheet
      titulo={item ? 'Agregar stock' : 'Producto nuevo'}
      subtitulo={barcode}
      onClose={onClose}
      footer={
        <button className="btn btn--principal btn--grande" onClick={guardar} disabled={!puedeGuardar}>
          Agregar {cantidad} al botiquín
        </button>
      }
    >
      {avisoConsumo && (
        <p className="alerta">Este código no estaba en el botiquín. Guárdalo primero y después podrás consumirlo.</p>
      )}

      <form onSubmit={guardar}>
        <label>
          Nombre del remedio
          <input
            type="text"
            value={nombre}
            autoFocus={!item}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Paracetamol 500 mg"
          />
        </label>

        <label>
          Cantidad que entra
          <Cantidad valor={cantidad} onChange={setCantidad} />
        </label>

        <label>
          Vence
          {expiryInicial && <span className="opcional"> — leída del código</span>}
        </label>
        <Vencimiento value={expiry} onChange={setExpiry} />

        {item && item.lotes.length > 0 && (
          <div className="ya-tienes">
            <p className="pista">Ya tienes {item.total} en el botiquín:</p>
            <div className="chips">
              {item.lotes.map((l) => (
                <button
                  key={l.expiry || 'sin'}
                  type="button"
                  className={`chip ${expiry === l.expiry ? 'chip--activo' : ''}`}
                  onClick={() => setExpiry(l.expiry)}
                >
                  {l.qty} · {fmtExpiry(l.expiry)}
                </button>
              ))}
            </div>
            <p className="pista">Toca una fecha para sumar a ese mismo lote.</p>
          </div>
        )}
      </form>
    </Sheet>
  );
}
