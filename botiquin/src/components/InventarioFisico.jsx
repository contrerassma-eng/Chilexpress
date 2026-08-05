import { claveLinea } from '../lib/conteo.js';
import { fmtDateTime, fmtExpiry } from '../lib/format.js';
import { zonaDe } from '../lib/zonas.js';

/**
 * Panel del inventario fisico dentro de la pantalla de escaneo.
 *
 * Sin conteo abierto explica y ofrece empezar; con uno abierto muestra lo que
 * se lleva contado y el boton de terminar.
 */
export default function InventarioFisico({ inventario, zona, onIniciar, onTerminar, onBorrar }) {
  const alcance = zona === 'todas' ? 'toda la casa' : zonaDe(zona).nombre;

  if (!inventario) {
    return (
      <section className="panel-inv">
        <h2>Inventario físico</h2>
        <p className="pista">
          Cuenta lo que hay de verdad en el mueble. Lo que anotes reemplaza lo registrado:
          si un producto no aparece en el conteo, queda en cero.
        </p>
        <button className="btn btn--principal btn--grande" onClick={() => onIniciar(zona)}>
          Comenzar inventario de {alcance}
        </button>
        <p className="pista">
          Puedes contar en varias sentadas: queda guardado en el teléfono hasta que lo termines.
        </p>
      </section>
    );
  }

  const lineas = Object.values(inventario.conteo);
  const suAlcance = inventario.zona === 'todas' ? 'toda la casa' : zonaDe(inventario.zona).nombre;

  return (
    <section className="panel-inv">
      <div className="panel-inv__estado">
        <div>
          <strong>Contando {suAlcance}</strong>
          <small>desde {fmtDateTime(inventario.iniciado)} · {lineas.length} línea(s)</small>
        </div>
        <button className="btn btn--principal" onClick={onTerminar}>Terminar</button>
      </div>

      {lineas.length === 0 ? (
        <p className="pista">Escanea el primer producto para anotarlo.</p>
      ) : (
        <ul className="contadas">
          {[...lineas].reverse().map((l) => (
            <li key={claveLinea(l.barcode, l.expiry)}>
              <span className="contadas__qty">{l.contado}</span>
              <span className="contadas__texto">
                <strong>{l.name}</strong>
                <small>{fmtExpiry(l.expiry)}</small>
              </span>
              <button
                className="btn btn--enlace btn--peligro-suave"
                onClick={() => onBorrar(claveLinea(l.barcode, l.expiry))}
                aria-label={`Quitar ${l.name}`}
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
