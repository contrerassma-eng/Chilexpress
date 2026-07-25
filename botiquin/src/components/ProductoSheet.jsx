import { useState } from 'react';
import Sheet from './Sheet.jsx';
import { expiryLabel, expiryState, fmtExpiry } from '../lib/format.js';

/** Detalle de un producto: corregir nombre, arreglar cantidades, borrarlo. */
export default function ProductoSheet({ item, onClose, onRenombrar, onAjustar, onBorrar }) {
  const [nombre, setNombre] = useState(item.name);
  const cambioNombre = nombre.trim() && nombre.trim() !== item.name;

  function borrar() {
    if (confirm(`¿Sacar "${item.name}" del botiquín? Se borra su historial de stock.`)) {
      onBorrar(item);
      onClose();
    }
  }

  return (
    <Sheet titulo={item.name} subtitulo={item.barcode} onClose={onClose}>
      <label>
        Nombre
        <div className="fila">
          <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          {cambioNombre && (
            <button className="btn" onClick={() => { onRenombrar(item.barcode, nombre.trim()); onClose(); }}>
              Guardar
            </button>
          )}
        </div>
      </label>

      <h3 className="titulillo">Lotes por vencimiento</h3>
      {item.lotes.length === 0 ? (
        <p className="pista">Sin stock. Queda guardado para que reconozcas el código la próxima vez.</p>
      ) : (
        <div className="lotes">
          {item.lotes.map((l) => (
            <div key={l.expiry || 'sin'} className="lote">
              <span className={`punto punto--${expiryState(l.expiry)}`} />
              <span className="lote__fecha">
                {fmtExpiry(l.expiry)}
                <small>{expiryLabel(l.expiry)}</small>
              </span>
              <div className="cantidad cantidad--chica">
                <button type="button" onClick={() => onAjustar(item, l.expiry, l.qty - 1)} aria-label="Menos">−</button>
                <span>{l.qty}</span>
                <button type="button" onClick={() => onAjustar(item, l.expiry, l.qty + 1)} aria-label="Mas">+</button>
              </div>
              <button className="btn btn--enlace btn--peligro-suave" onClick={() => onAjustar(item, l.expiry, 0)}>
                Botar
              </button>
            </div>
          ))}
        </div>
      )}

      <button className="btn btn--peligro" onClick={borrar}>Eliminar del botiquín</button>
    </Sheet>
  );
}
