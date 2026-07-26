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
  candidatos = [],
  expiryInicial = '',
  zonaActiva,
  avisoConsumo = false,
  onGuardar,
  onVincular,
  onClose
}) {
  // Un producto que ya existe no se mueve de zona solo: manda la suya.
  const [zona, setZona] = useState(item?.zona || (zonaActiva !== 'todas' ? zonaActiva : ZONA_POR_DEFECTO));
  const [nombre, setNombre] = useState(item?.name || '');
  const [cantidad, setCantidad] = useState(1);
  const [expiry, setExpiry] = useState(expiryInicial);
  const [precioUnit, setPrecioUnit] = useState('');

  const puedeGuardar = nombre.trim().length > 0;

  // Solo cuando el codigo es nuevo: puede que el producto ya este guardado sin
  // codigo (se agregó a mano) o con otro. Mientras no escriba nada mostramos
  // los que no tienen codigo, que son los candidatos naturales.
  const esNuevo = !item && Boolean(barcode);
  const busca = nombre.trim().toLowerCase();
  const sugeridos = !esNuevo
    ? []
    : candidatos
        .filter((c) => (busca ? c.name.toLowerCase().includes(busca) : c.barcode.startsWith('sc-')))
        .slice(0, 6);

  function cambiarZona(nueva) {
    setZona(nueva);
    // Al pasar a una zona que normalmente no caduca, soltamos la fecha para no
    // arrastrar una que ya no aplica. Si vino leida del codigo, se respeta.
    if (zonaDe(nueva).fecha === 'sin' && !expiryInicial) setExpiry('');
  }

  function guardar(e) {
    e.preventDefault();
    if (!puedeGuardar) return;
    const precio = precioUnit.trim() ? Number(precioUnit) : null;
    onGuardar({ barcode, name: nombre.trim(), qty: cantidad, expiry, zona, precio: Number.isFinite(precio) && precio >= 0 ? precio : null });
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
          Precio unitario
          <span className="opcional"> (opcional)</span>
          <input
            type="number"
            value={precioUnit}
            onChange={(e) => setPrecioUnit(e.target.value)}
            placeholder="0"
            step="0.01"
            min="0"
            inputMode="decimal"
          />
        </label>

        <label>
          Vence
          {expiryInicial && <span className="opcional"> — leída del código</span>}
        </label>
        <Vencimiento key={zona} value={expiry} onChange={setExpiry} modoInicial={zonaDe(zona).fecha} />

        {sugeridos.length > 0 && (
          <div className="vincular">
            <p className="pista">
              {busca ? '¿Es alguno de estos que ya tienes?' : '¿Ya lo tienes guardado sin código?'}
            </p>
            <ul className="sugeridos">
              {sugeridos.map((c) => (
                <li key={c.barcode}>
                  <button type="button" onClick={() => onVincular?.(c)}>
                    <span className="sugeridos__texto">
                      <strong>{c.name}</strong>
                      <small>
                        {zonaDe(c.zona).icono} {c.total > 0 ? `${c.total} guardados` : 'sin stock'}
                        {c.barcode.startsWith('sc-') ? ' · sin código' : ` · ${c.barcode}`}
                      </small>
                    </span>
                    <span className="sugeridos__accion">Es este</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="pista">Al elegirlo, este código queda pegado a ese producto y conserva su stock.</p>
          </div>
        )}

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
