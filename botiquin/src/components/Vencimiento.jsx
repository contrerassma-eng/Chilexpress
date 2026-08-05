import { useState } from 'react';
import { endOfMonth, isEndOfMonth, toMonthInput } from '../lib/format.js';

/**
 * Las cajas de remedios traen "VENC 05/2027", asi que el modo por defecto es
 * mes/año y guardamos el ultimo dia de ese mes. Igual se puede poner el dia
 * exacto o declarar que el producto no caduca.
 */
export default function Vencimiento({ value, onChange, modoInicial = 'mes' }) {
  // El modo de partida lo pone la zona: el refrigerador arranca en dia exacto
  // y el aseo en "no caduca". Si ya hay fecha, manda la fecha.
  const [modo, setModo] = useState(() => {
    if (!value) return modoInicial;
    return isEndOfMonth(value) ? 'mes' : 'dia';
  });

  function cambiarModo(nuevo) {
    setModo(nuevo);
    if (nuevo === 'sin') onChange('');
  }

  return (
    <div className="vencimiento">
      <div className="segmentos segmentos--chico">
        <button type="button" className={modo === 'mes' ? 'activo' : ''} onClick={() => cambiarModo('mes')}>Mes / año</button>
        <button type="button" className={modo === 'dia' ? 'activo' : ''} onClick={() => cambiarModo('dia')}>Día exacto</button>
        <button type="button" className={modo === 'sin' ? 'activo' : ''} onClick={() => cambiarModo('sin')}>No caduca</button>
      </div>

      {modo === 'mes' && (
        <input
          type="month"
          value={toMonthInput(value)}
          onChange={(e) => onChange(endOfMonth(e.target.value))}
        />
      )}

      {modo === 'dia' && (
        <input
          type="date"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {modo === 'sin' && <p className="pista">Este producto queda sin fecha de vencimiento.</p>}
    </div>
  );
}
