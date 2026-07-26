import { useState } from 'react';
import Sheet from './Sheet.jsx';
import Cantidad from './Cantidad.jsx';
import Vencimiento from './Vencimiento.jsx';
import { fmtExpiry } from '../lib/format.js';
import { ZONA_POR_DEFECTO, listaZonas, zonaDe } from '../lib/zonas.js';

/**
 * Anota lo que hay de verdad de un producto. Ojo: aca la cantidad NO se suma,
 * reemplaza. Es lo que se contó en el mueble.
 */
export default function ContarSheet({ barcode, item, expiryInicial = '', zonaActiva, yaContado, onContar, onClose }) {
  const [zona, setZona] = useState(item?.zona || (zonaActiva !== 'todas' ? zonaActiva : ZONA_POR_DEFECTO));
  const [nombre, setNombre] = useState(item?.name || '');
  const [expiry, setExpiry] = useState(expiryInicial || yaContado?.expiry || '');
  const [cantidad, setCantidad] = useState(yaContado?.contado ?? 1);

  const puedeGuardar = nombre.trim().length > 0;
  const loteExistente = item?.lotes.find((l) => (l.expiry || '') === (expiry || ''));

  function guardar(e) {
    e.preventDefault();
    if (!puedeGuardar) return;
    onContar({ barcode, name: nombre.trim(), zona, expiry, contado: cantidad });
  }

  return (
    <Sheet
      titulo={item ? 'Contar' : 'Producto no registrado'}
      subtitulo={barcode}
      onClose={onClose}
      footer={
        <button className="btn btn--principal btn--grande" onClick={guardar} disabled={!puedeGuardar}>
          Anotar {cantidad}
        </button>
      }
    >
      {!item && (
        <p className="alerta">No estaba en el inventario. Al contarlo queda registrado.</p>
      )}

      <form onSubmit={guardar}>
        <label>
          Nombre
          <input
            type="text"
            value={nombre}
            autoFocus={!item}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre del producto"
          />
        </label>

        {!item && (
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
        )}

        <label>
          Cuántos hay <span className="opcional">— reemplaza lo registrado</span>
          <Cantidad valor={cantidad} onChange={setCantidad} min={0} />
        </label>

        <label>
          Vence <span className="opcional">— opcional</span>
        </label>
        <Vencimiento key={zona} value={expiry} onChange={setExpiry} modoInicial={zonaDe(zona).fecha} />

        {item && item.lotes.length > 0 && (
          <div className="ya-tienes">
            <p className="pista">Registrado hoy: {item.total}</p>
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
            <p className="pista">
              {loteExistente
                ? `Ese lote dice ${loteExistente.qty}.`
                : 'Ese vencimiento no estaba registrado.'}
            </p>
          </div>
        )}
      </form>
    </Sheet>
  );
}
