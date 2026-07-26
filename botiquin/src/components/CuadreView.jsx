import { descargarCsv, marcaDeTiempo } from '../lib/csv.js';
import { fmtDateTime, fmtExpiry } from '../lib/format.js';
import { zonaDe } from '../lib/zonas.js';

/**
 * El descuadre: lo contado contra lo registrado. Es la pantalla que decide,
 * porque al confirmar el stock queda igual a lo contado.
 */
export default function CuadreView({ cuadre, zona, iniciado, onConfirmar, onSeguir, onCancelar }) {
  const alcance = zona === 'todas' ? 'toda la casa' : zonaDe(zona).nombre;

  function exportar() {
    descargarCsv(
      `descuadre_${marcaDeTiempo()}.csv`,
      ['Producto', 'Codigo', 'Zona', 'Vence', 'Registrado', 'Contado', 'Diferencia'],
      cuadre.lineas.map((l) => [
        l.name, l.barcode, zonaDe(l.zona).nombre, l.expiry || 'sin fecha',
        l.antes, l.contado, l.contado - l.antes
      ])
    );
  }

  return (
    <div className="cuadre">
      <header className="cuadre__cabecera">
        <div>
          <h2>Resultado del inventario</h2>
          <p className="pista">
            {alcance} · iniciado {fmtDateTime(iniciado)} · {cuadre.contados} línea(s) contadas
          </p>
        </div>
        <button className="sheet__cerrar" onClick={onSeguir} aria-label="Volver a contar">×</button>
      </header>

      <div className="marcadores">
        <div className="marcador">
          <strong>{cuadre.diferencias.length}</strong>
          <span>con diferencia</span>
        </div>
        <div className="marcador marcador--sobra">
          <strong>+{cuadre.sobras}</strong>
          <span>de más</span>
        </div>
        <div className="marcador marcador--falta">
          <strong>−{cuadre.faltantes}</strong>
          <span>de menos</span>
        </div>
      </div>

      {cuadre.cuadra ? (
        <p className="vacio">Todo cuadra: lo contado coincide con lo registrado.</p>
      ) : (
        <ul className="difs">
          {cuadre.diferencias.map((l) => {
            const d = l.contado - l.antes;
            return (
              <li key={`${l.barcode}|${l.expiry}`} className={d > 0 ? 'dif dif--sobra' : 'dif dif--falta'}>
                <span className="dif__texto">
                  <strong>{zonaDe(l.zona).icono} {l.name}</strong>
                  <small>{fmtExpiry(l.expiry)}</small>
                </span>
                <span className="dif__numeros">
                  <span className="dif__antes">{l.antes}</span>
                  <span aria-hidden="true">→</span>
                  <span className="dif__contado">{l.contado}</span>
                </span>
                <span className="dif__delta">{d > 0 ? `+${d}` : d}</span>
              </li>
            );
          })}
        </ul>
      )}

      <div className="cuadre__acciones">
        <button className="btn btn--principal btn--grande" onClick={onConfirmar}>
          Aplicar: el conteo pasa a ser el stock
        </button>
        <button className="btn" onClick={onSeguir}>Seguir contando</button>
        <button className="btn btn--enlace" onClick={exportar}>Exportar CSV</button>
        <button className="btn btn--enlace btn--peligro-suave" onClick={onCancelar}>
          Descartar este inventario
        </button>
      </div>
    </div>
  );
}
