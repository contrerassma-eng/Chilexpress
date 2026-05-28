import { useRef, useState } from 'react';
import BarcodeScanner from './BarcodeScanner.jsx';
import ScanFeedback from './ScanFeedback.jsx';
import { STATUS } from '../state/store.jsx';
import { nowIso } from '../lib/format.js';

const DEDUP_MS = 2500;

export default function ScannerPanel({ state, dispatch, mode, setMode }) {
  const [cameraOn, setCameraOn] = useState(false);
  const [flash, setFlash] = useState(null);
  const [manual, setManual] = useState('');
  const lastScan = useRef({ code: '', at: 0 });
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

  function register(rawCode, { fromCamera } = {}) {
    const code = String(rawCode || '').trim();
    if (!code) return;
    const t = Date.now();

    if (fromCamera && lastScan.current.code === code && t - lastScan.current.at < DEDUP_MS) {
      return; // mismo codigo, lectura repetida continua de la camara
    }

    const existing = state.packages[code];
    const alreadyTarget =
      (mode === 'entrega' && existing?.status === STATUS.ENTREGADO) ||
      (mode === 'recepcion' && existing && existing.status !== STATUS.ESPERADO);

    lastScan.current = { code, at: t };

    if (!alreadyTarget) {
      dispatch({ type: 'SCAN', code, mode, at: nowIso() });
      beep();
      if (navigator.vibrate) navigator.vibrate(40);
    }

    flashSeq.current += 1;
    setFlash({ key: flashSeq.current, code, mode, dup: alreadyTarget });
    window.clearTimeout(register._timer);
    register._timer = window.setTimeout(() => setFlash(null), 1100);
  }

  function submitManual(e) {
    e.preventDefault();
    if (!manual.trim()) return;
    register(manual, { fromCamera: false });
    setManual('');
  }

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
          <BarcodeScanner
            active={cameraOn}
            onScan={(code) => register(code, { fromCamera: true })}
            onError={() => {}}
          />
          <ScanFeedback flash={flash} />
          <button className="btn btn--ghost camera-off" onClick={() => setCameraOn(false)}>
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
