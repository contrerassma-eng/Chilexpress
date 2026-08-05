import { listaZonas } from '../lib/zonas.js';

/** Fila de zonas de la casa. Con `todas` agrega la opcion de ver todo junto. */
export default function SelectorZona({ zona, onZona, totales, todas = false }) {
  return (
    <nav className="zonas" aria-label="Zonas de la casa">
      {todas && (
        <button
          className={`zona ${zona === 'todas' ? 'zona--activa' : ''}`}
          onClick={() => onZona('todas')}
        >
          <span className="zona__icono" aria-hidden="true">🏠</span>
          <span className="zona__nombre">Todas</span>
        </button>
      )}
      {listaZonas.map((z) => {
        const cuenta = totales?.porZona?.[z.id];
        const alertas = (cuenta?.vencidos || 0) + (cuenta?.porVencer || 0);
        return (
          <button
            key={z.id}
            className={`zona ${zona === z.id ? 'zona--activa' : ''}`}
            onClick={() => onZona(z.id)}
          >
            <span className="zona__icono" aria-hidden="true">{z.icono}</span>
            <span className="zona__nombre">{z.nombre}</span>
            {alertas > 0 && (
              <span className={`zona__alerta ${cuenta.vencidos > 0 ? 'zona__alerta--malo' : ''}`}>
                {alertas}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
