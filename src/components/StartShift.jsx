import { useState } from 'react';

export default function StartShift({ dispatch }) {
  const [name, setName] = useState('');
  return (
    <div className="start-shift">
      <div className="start-card">
        <img src="/icon.svg" alt="" width="64" height="64" />
        <h1>Recepcion y Entrega</h1>
        <p className="muted">Inicia el turno con el nombre del responsable para empezar a escanear.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) dispatch({ type: 'START_SHIFT', responsable: name.trim() });
          }}
        >
          <input
            type="text"
            placeholder="Nombre del responsable"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <button className="btn btn--primary btn--big" type="submit" disabled={!name.trim()}>
            Iniciar turno
          </button>
        </form>
      </div>
    </div>
  );
}
