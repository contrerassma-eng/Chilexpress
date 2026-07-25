import { useState } from 'react';
import Sheet from './Sheet.jsx';
import Cantidad from './Cantidad.jsx';
import Vencimiento from './Vencimiento.jsx';
import { fmtExpiry } from '../lib/format.js';
import { ZONA_POR_DEFECTO, listaZonas, zonaDe } from '../lib/zonas.js';

/**
 * Alta de stock. Si el codigo ya se escaneo antes, el nombre y la zona vienen
 * puestos y solo hay que confirmar cantidad y vencimiento.
 */
export default function CompraSheet({
  barcode,
  item,
  expiryInicial = '',
  zonaActiva,
  avisoConsumo = false,
  onGuardar,
  onClose
}) {
  // Un producto que ya existe no se mueve de zona solo: manda la suya.
  const [zona, setZona] = useState(item?.zona || (zonaActiva !== 'todas' ? zonaActiva : ZONA_POR_DEFECTO));
  const [nombre, setNombre] = useState(item?.name || '');
  const [cantidad, setCantidad] = useState(1);
  const [expiry, setExpiry] = useState(expiryInicial);

  const puedeGuardar = nombre.trim().length > 0;

  function cambiarZona(nueva) {
    setZona(nueva);
    // Al pasar a una zona que normalmente no caduca, soltamos la fecha para no
    // arrastrar una que ya no aplica. Si vino leida del codigo, se respeta.
    if (zonaDe(nueva).fecha === 'sin' && !expiryInicial) setExpiry('');
  }

  function guardar(e) {
    e.preventDefault();
    if (!puedeGuardar) return;
    onGuardar({ barcode, name: nombre.trim(), qty: cantidad, expiry, zona });
  }

  return (
    <Sheet
      titulo={item ? 'Agregar stock' : 'Producto nuevo'}
      subtitulo={barcode}
      onClose={onClose}
      footer={
        <button className="btn btn--principal btn--grande" onClick={guardar} disabled={!puedeGuardar}>
          Agregar {cantidad} a {zonaDe(zona).nombre}
        </button>
      }
    >
      {avisoConsumo && (
        <p className="alerta">Este código no estaba en la casa. Guárdalo primero y después podrás consumirlo.</p>
      )}

      <form onSubmit={guardar}>
        <label>
          Nombre
          <input
            type="text"
            value={nombre}
            autoFocus={!item}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Paracetamol 500 mg, Leche descremada, Cloro…"
          />
        </label>

        <div>
          <label>Dónde va</label>
          <div className="chips">
            {listaZonas.map((z) => (
              <button
                key={z.id}
                type="button"
                className={`chip ${zona === z.id ? 'chip--activo' : ''}`}
                onClick={() => cambiarZona(z.id)}
              >
                {z.icono} {z.nombre}
              </button>
            ))}
          </div>
        </div>

        <label>
          Cantidad que entra
          <Cantidad valor={cantidad} onChange={setCantidad} />
        </label>

        <label>
          Vence
          {expiryInicial && <span className="opcional"> — leída del código</span>}
        </label>
        <Vencimiento key={zona} value={expiry} onChange={setExpiry} modoInicial={zonaDe(zona).fecha} />

        {item && item.lotes.length > 0 && (
          <div className="ya-tienes">
            <p className="pista">Ya tienes {item.total}:</p>
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
