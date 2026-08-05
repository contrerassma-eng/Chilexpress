import { useState } from 'react';
import { api } from '../lib/api.js';

/**
 * Puerta de entrada: el PIN del hogar se pide una sola vez y queda guardado en
 * el telefono. El Worker rechaza cualquier peticion que no lo traiga.
 */
export default function PinGate({ onEntrar, aviso }) {
  const [pin, setPin] = useState('');
  const [quien, setQuien] = useState('');
  const [estado, setEstado] = useState('idle');
  const [error, setError] = useState('');

  async function entrar(e) {
    e.preventDefault();
    const limpio = pin.trim();
    if (!limpio) return;
    setEstado('probando');
    setError('');
    try {
      await api.ping(limpio);
      onEntrar(limpio, quien.trim());
    } catch (err) {
      setEstado('idle');
      setError(err.status === 0 ? 'Sin conexion. Intenta de nuevo.' : err.message);
    }
  }

  return (
    <div className="portada">
      <div className="portada__marca" aria-hidden="true">✚</div>
      <h1>Inventario de casa</h1>
      <p className="portada__bajada">
        Botiquín, despensa, refrigerador y aseo: escanea, suma lo que compras y descuenta lo que ocupas.
      </p>

      {aviso && <p className="alerta">{aviso}</p>}

      <form className="portada__form" onSubmit={entrar}>
        <label>
          PIN del hogar
          <input
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="••••••"
          />
        </label>
        <label>
          Tu nombre <span className="opcional">(opcional, para el historial)</span>
          <input
            type="text"
            value={quien}
            onChange={(e) => setQuien(e.target.value)}
            placeholder="Mamá, papá, …"
          />
        </label>
        {error && <p className="alerta alerta--error">{error}</p>}
        <button className="btn btn--principal btn--grande" type="submit" disabled={estado === 'probando' || !pin.trim()}>
          {estado === 'probando' ? 'Comprobando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
