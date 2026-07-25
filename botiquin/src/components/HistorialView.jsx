import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { fmtDateTime, fmtExpiry } from '../lib/format.js';

const ETIQUETA = {
  compra: { texto: 'Compra', signo: '+', clase: 'mov--compra' },
  consumo: { texto: 'Consumo', signo: '−', clase: 'mov--consumo' },
  descarte: { texto: 'Botado', signo: '−', clase: 'mov--descarte' },
  ajuste: { texto: 'Ajuste', signo: '=', clase: 'mov--ajuste' },
  nombre: { texto: 'Renombrado', signo: '', clase: 'mov--ajuste' },
  borrar: { texto: 'Eliminado', signo: '', clase: 'mov--descarte' }
};

/** Bitacora del servidor. Necesita conexion: es el registro comun de la casa. */
export default function HistorialView({ pin, pendientes }) {
  const [movs, setMovs] = useState([]);
  const [estado, setEstado] = useState('cargando');

  useEffect(() => {
    let vivo = true;
    setEstado('cargando');
    api.movements(pin, 80)
      .then((d) => { if (vivo) { setMovs(d.movements || []); setEstado('ok'); } })
      .catch(() => { if (vivo) setEstado('error'); });
    return () => { vivo = false; };
  }, [pin]);

  return (
    <section className="historial">
      {pendientes > 0 && (
        <p className="alerta">{pendientes} movimiento(s) todavía sin subir. Aparecerán cuando vuelva la señal.</p>
      )}

      {estado === 'cargando' && <p className="pista">Cargando…</p>}
      {estado === 'error' && <p className="alerta alerta--error">No se pudo leer el historial. Revisa la conexión.</p>}

      {estado === 'ok' && movs.length === 0 && <p className="vacio">Todavía no hay movimientos.</p>}

      <ul className="movs">
        {movs.map((m) => {
          const et = ETIQUETA[m.kind] || { texto: m.kind, signo: '', clase: '' };
          return (
            <li key={m.id} className={`mov ${et.clase}`}>
              <span className="mov__signo">{et.signo}{et.signo && m.qty}</span>
              <span className="mov__texto">
                <strong>{m.name || m.barcode}</strong>
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
    </section>
  );
}
