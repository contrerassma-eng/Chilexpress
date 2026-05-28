import { useRef, useState } from 'react';
import BarcodeScanner from './BarcodeScanner.jsx';
import ScanFeedback from './ScanFeedback.jsx';
import { STATUS } from '../state/store.jsx';
import { nowIso } from '../lib/format.js';

const STABLE_NEEDED = 2;     // misma lectura N veces seguidas antes de aceptar
const COOLDOWN_MS = 1500;    // pausa tras registrar, para no leer en rafaga

// Solo aceptamos de la camara codigos numericos de 8 a 14 digitos.
function isScannable(code) {
  return /^\d{8,14}$/.test(code);
}

export default function ScannerPanel({ state, dispatch, mode, setMode }) {
  const [cameraOn, setCameraOn] = useState(false);
  const [confirmMode, setConfirmMode] = useState(true);
  const [pending, setPending] = useState(null);
  const [flash, setFlash] = useState(null);
  const [manual, setManual] = useState('');
  const stable = useRef({ code: '', count: 0 });
  const cooldownUntil = useRef(0);
  const flashSeq = useRef(0);

  function beep() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = 880;
      g.gain.value = 0.05;
      o.start();
      setTimeout(() => { o.stop(); ctx.close(); }, 110);
    } catch { /* sin sonido si no se permite */ }
  }

  function showFlash(code, dup) {
    flashSeq.current += 1;
    setFlash({ key: flashSeq.current, code, mode, dup });
    window.clearTimeout(showFlash._t);
    showFlash._t = window.setTimeout(() => setFlash(null), 1100);
  }

  function commit(code) {
    const existing = state.packages[code];
    const alreadyTarget =
      (mode === 'entrega' && existing?.status === STATUS.ENTREGADO) ||
      (mode === 'recepcion' && existing && existing.status !== STATUS.ESPERADO);

    if (!alreadyTarget) {
      dispatch({ type: 'SCAN', code, mode, at: nowIso() });
      beep();
      if (navigator.vibrate) navigator.vibrate(40);
    }
    showFlash(code, alreadyTarget);
    cooldownUntil.current = Date.now() + COOLDOWN_MS;
    stable.current = { code: '', count: 0 };
    setPending(null);
  }

  function onDetected(raw) {
    if (pending) return; // esperando que el usuario confirme/descarte
    const code = String(raw || '').trim();
    if (!isScannable(code)) return;
    const now = Date.now();
    if (now < cooldownUntil.current) return;

    if (stable.current.code === code) stable.current.count += 1;
    else stable.current = { code, count: 1 };
    if (stable.current.count < STABLE_NEEDED) return;

    if (confirmMode) {
      setPending(code);
      stable.current = { code: '', count: 0 };
    } else {
      commit(code);
    }
  }

  function discardPending() {
    setPending(null);
    stable.current = { code: '', count: 0 };
    cooldownUntil.current = Date.now() + 500;
  }

  function submitManual(e) {
    e.preventDefault();
    const code = manual.trim();
    if (!code) return;
    commit(code);
    setManual('');
  }

  const modeLabel = mode === 'entrega' ? 'entregado' : 'recibido';

  return (
    <section className="panel scanner-panel">
      <div className="mode-toggle" role="tablist" aria-label="Modo de escaneo">
        <button
          role="tab"
          aria-selected={mode === 'recepcion'}
          className={mode === 'recepcion' ? 'mode-btn mode-btn--recepcion active' : 'mode-btn'}
          onClick={() => setMode('recepcion')}
        >
          Recepcion
          <span className="mode-btn__hint">marca amarillo</span>
        </button>
        <button
          role="tab"
          aria-selected={mode === 'entrega'}
          className={mode === 'entrega' ? 'mode-btn mode-btn--entrega active' : 'mode-btn'}
          onClick={() => setMode('entrega')}
        >
          Entrega
          <span className="mode-btn__hint">marca verde</span>
        </button>
      </div>

      {cameraOn ? (
        <div className="scanner-wrap">
          <BarcodeScanner active={cameraOn} onScan={onDetected} onError={() => {}} />
          <ScanFeedback flash={flash} />

          {pending && (
            <div className={`pending-bar pending-bar--${mode}`}>
              <div className="pending-bar__info">
                <span className="pending-bar__label">Detectado</span>
                <span className="pending-bar__code">{pending}</span>
              </div>
              <div className="pending-bar__actions">
                <button className="btn btn--ghost btn--sm" onClick={discardPending}>Descartar</button>
                <button className="btn btn--primary" onClick={() => commit(pending)}>
                  Marcar {modeLabel}
                </button>
              </div>
            </div>
          )}

          <label className="confirm-toggle">
            <input
              type="checkbox"
              checked={confirmMode}
              onChange={(e) => { setConfirmMode(e.target.checked); discardPending(); }}
            />
            Confirmar cada lectura (evita leer de mas)
          </label>

          <button className="btn btn--ghost camera-off" onClick={() => { setCameraOn(false); discardPending(); }}>
            Cerrar camara
          </button>
        </div>
      ) : (
        <button className="btn btn--primary btn--big" onClick={() => setCameraOn(true)}>
          Abrir camara para escanear
        </button>
      )}

      <form className="manual-entry" onSubmit={submitManual}>
        <input
          type="text"
          inputMode="numeric"
          placeholder="Ingresar codigo a mano"
          value={manual}
          onChange={(e) => setManual(e.target.value)}
        />
        <button className="btn" type="submit">Marcar</button>
      </form>
    </section>
  );
}
