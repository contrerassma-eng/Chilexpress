import { useState } from 'react';
import Sheet from './Sheet.jsx';
import { expiryLabel, expiryState, fmtExpiry } from '../lib/format.js';
import { listaZonas, zonaDe } from '../lib/zonas.js';

/** Detalle: corregir nombre, cambiar de zona, arreglar cantidades, borrarlo. */
export default function ProductoSheet({ item, onClose, onRenombrar, onAjustar, onBorrar }) {
  const [nombre, setNombre] = useState(item.name);
  const [zona, setZona] = useState(item.zona);
  const hayCambios = (nombre.trim() && nombre.trim() !== item.name) || zona !== item.zona;

  function guardarFicha() {
    onRenombrar(item.barcode, nombre.trim() || item.name, zona);
    onClose();
  }

  function borrar() {
    if (confirm(`¿Sacar "${item.name}" del inventario? Se borra su stock.`)) {
      onBorrar(item);
      onClose();
    }
  }

  return (
    <Sheet titulo={item.name} subtitulo={item.barcode} onClose={onClose}>
      <label>
        Nombre
        <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} />
      </label>

      <div>
        <label>Dónde está</label>
        <div className="chips">
          {listaZonas.map((z) => (
            <button
              key={z.id}
              type="button"
              className={`chip ${zona === z.id ? 'chip--activo' : ''}`}
              onClick={() => setZona(z.id)}
            >
              {z.icono} {z.nombre}
            </button>
          ))}
        </div>
      </div>

      {hayCambios && (
        <button className="btn btn--principal" onClick={guardarFicha}>Guardar cambios</button>
      )}

      <h3 className="titulillo">Lotes por vencimiento</h3>
      {item.lotes.length === 0 ? (
        <p className="pista">
          Sin stock. Queda guardado en {zonaDe(item.zona).nombre.toLowerCase()} para reconocer el código
          la próxima vez.
        </p>
      ) : (
        <div className="lotes">
          {item.lotes.map((l) => (
            <div key={l.expiry || 'sin'} className="lote">
              <span className={`punto punto--${expiryState(l.expiry, item.aviso)}`} />
              <span className="lote__fecha">
                {fmtExpiry(l.expiry)}
                <small>{expiryLabel(l.expiry, item.aviso)}</small>
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

      <button className="btn btn--peligro" onClick={borrar}>Eliminar del inventario</button>
    </Sheet>
  );
}
