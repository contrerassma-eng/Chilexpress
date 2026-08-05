import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { descargarCsv, marcaDeTiempo } from '../lib/csv.js';
import { fmtDateTime, fmtExpiry } from '../lib/format.js';
import { ZONAS, zonaDe } from '../lib/zonas.js';

const ETIQUETA = {
  compra: { texto: 'Compra', signo: '+', clase: 'mov--compra' },
  consumo: { texto: 'Consumo', signo: '−', clase: 'mov--consumo' },
  descarte: { texto: 'Botado', signo: '−', clase: 'mov--descarte' },
  ajuste: { texto: 'Ajuste', signo: '=', clase: 'mov--ajuste' },
  nombre: { texto: 'Ficha editada', signo: '', clase: 'mov--ajuste' },
  borrar: { texto: 'Eliminado', signo: '', clase: 'mov--descarte' }
};

function Movimientos({ pin }) {
  const [movs, setMovs] = useState([]);
  const [estado, setEstado] = useState('cargando');

  useEffect(() => {
    let vivo = true;
    setEstado('cargando');
    api.movements(pin, 120)
      .then((d) => { if (vivo) { setMovs(d.movements || []); setEstado('ok'); } })
      .catch(() => { if (vivo) setEstado('error'); });
    return () => { vivo = false; };
  }, [pin]);

  function exportar() {
    descargarCsv(
      `movimientos_${marcaDeTiempo()}.csv`,
      ['Fecha', 'Tipo', 'Producto', 'Codigo', 'Zona', 'Vence', 'Cantidad', 'Quien'],
      movs.map((m) => [
        m.at, ETIQUETA[m.kind]?.texto || m.kind, m.name || m.barcode, m.barcode,
        m.zona ? zonaDe(m.zona).nombre : '', m.expiry || '', m.qty, m.who || ''
      ])
    );
  }

  if (estado === 'cargando') return <p className="pista">Cargando…</p>;
  if (estado === 'error') return <p className="alerta alerta--error">No se pudo leer el historial. Revisa la conexión.</p>;
  if (!movs.length) return <p className="vacio">Todavía no hay movimientos.</p>;

  return (
    <>
      <button className="btn btn--enlace" onClick={exportar}>Exportar movimientos (CSV)</button>
      <ul className="movs">
        {movs.map((m) => {
          const et = ETIQUETA[m.kind] || { texto: m.kind, signo: '', clase: '' };
          return (
            <li key={m.id} className={`mov ${et.clase}`}>
              <span className="mov__signo">{et.signo}{et.signo && m.qty}</span>
              <span className="mov__texto">
                <strong>
                  {ZONAS[m.zona] ? `${ZONAS[m.zona].icono} ` : ''}
                  {m.name || m.barcode}
                </strong>
                <small>
                  {et.texto}
                  {m.expiry ? ` · vence ${fmtExpiry(m.expiry)}` : ''}
                  {m.who ? ` · ${m.who}` : ''}
                </small>
              </span>
              <span className="mov__fecha">{fmtDateTime(m.at)}</span>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function DetalleInventario({ pin, id, onVolver }) {
  const [datos, setDatos] = useState(null);
  const [estado, setEstado] = useState('cargando');

  useEffect(() => {
    let vivo = true;
    api.stocktake(pin, id)
      .then((d) => { if (vivo) { setDatos(d); setEstado('ok'); } })
      .catch(() => { if (vivo) setEstado('error'); });
    return () => { vivo = false; };
  }, [pin, id]);

  function exportar() {
    descargarCsv(
      `inventario_${marcaDeTiempo(datos.stocktake.closed_at)}.csv`,
      ['Producto', 'Codigo', 'Zona', 'Vence', 'Registrado', 'Contado', 'Diferencia'],
      datos.lines.map((l) => [
        l.name, l.barcode, l.zona ? zonaDe(l.zona).nombre : '', l.expiry || 'sin fecha',
        l.antes, l.contado, l.contado - l.antes
      ])
    );
  }

  if (estado === 'cargando') return <p className="pista">Cargando…</p>;
  if (estado === 'error') return <p className="alerta alerta--error">No se pudo leer ese inventario.</p>;

  const { stocktake: inv, lines } = datos;
  const difs = lines.filter((l) => l.antes !== l.contado);

  return (
    <div className="detalle-inv">
      <button className="btn btn--enlace" onClick={onVolver}>‹ Volver</button>
      <h3>{fmtDateTime(inv.closed_at)}</h3>
      <p className="pista">
        {inv.zona ? zonaDe(inv.zona).nombre : 'Toda la casa'} · {inv.contados} línea(s)
        {inv.who ? ` · ${inv.who}` : ''}
      </p>

      <div className="marcadores">
        <div className="marcador"><strong>{difs.length}</strong><span>con diferencia</span></div>
        <div className="marcador marcador--sobra"><strong>+{inv.sobras}</strong><span>de más</span></div>
        <div className="marcador marcador--falta"><strong>−{inv.faltantes}</strong><span>de menos</span></div>
      </div>

      <button className="btn btn--enlace" onClick={exportar}>Exportar este inventario (CSV)</button>

      {difs.length === 0 ? (
        <p className="vacio">Ese día todo cuadraba.</p>
      ) : (
        <ul className="difs">
          {difs.map((l) => {
            const d = l.contado - l.antes;
            return (
              <li key={`${l.barcode}|${l.expiry}`} className={d > 0 ? 'dif dif--sobra' : 'dif dif--falta'}>
                <span className="dif__texto">
                  <strong>{l.zona ? `${zonaDe(l.zona).icono} ` : ''}{l.name}</strong>
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
    </div>
  );
}

function Inventarios({ pin, pendientes }) {
  const [lista, setLista] = useState([]);
  const [estado, setEstado] = useState('cargando');
  const [abierto, setAbierto] = useState(null);

  useEffect(() => {
    let vivo = true;
    api.stocktakes(pin, 40)
      .then((d) => { if (vivo) { setLista(d.stocktakes || []); setEstado('ok'); } })
      .catch(() => { if (vivo) setEstado('error'); });
    return () => { vivo = false; };
  }, [pin, pendientes]);

  if (abierto) return <DetalleInventario pin={pin} id={abierto} onVolver={() => setAbierto(null)} />;
  if (estado === 'cargando') return <p className="pista">Cargando…</p>;
  if (estado === 'error') return <p className="alerta alerta--error">No se pudieron leer los inventarios.</p>;
  if (!lista.length) return <p className="vacio">Todavía no has hecho ningún inventario físico.</p>;

  return (
    <ul className="items">
      {lista.map((inv) => (
        <li key={inv.id}>
          <button className="item" onClick={() => setAbierto(inv.id)}>
            <span className="item__cantidad">{inv.contados}</span>
            <span className="item__texto">
              <strong>{inv.zona ? zonaDe(inv.zona).nombre : 'Toda la casa'}</strong>
              <small>
                {fmtDateTime(inv.closed_at)} · +{inv.sobras} / −{inv.faltantes}
                {inv.who ? ` · ${inv.who}` : ''}
              </small>
            </span>
            <span className="item__flecha" aria-hidden="true">›</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Bitacora del servidor: movimientos e inventarios fisicos. Pide conexion. */
export default function HistorialView({ pin, pendientes }) {
  const [pestana, setPestana] = useState('movimientos');

  return (
    <section className="historial">
      <div className="segmentos segmentos--chico">
        <button className={pestana === 'movimientos' ? 'activo' : ''} onClick={() => setPestana('movimientos')}>
          Movimientos
        </button>
        <button className={pestana === 'inventarios' ? 'activo' : ''} onClick={() => setPestana('inventarios')}>
          Inventarios
        </button>
      </div>

      {pendientes > 0 && (
        <p className="alerta">{pendientes} cambio(s) todavía sin subir. Aparecerán cuando vuelva la señal.</p>
      )}

      {pestana === 'movimientos'
        ? <Movimientos pin={pin} />
        : <Inventarios pin={pin} pendientes={pendientes} />}
    </section>
  );
}
