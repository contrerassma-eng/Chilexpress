import { useCallback, useState } from 'react';
import BarcodeScanner from './BarcodeScanner.jsx';
import { decodeScan } from '../lib/codes.js';
import { zonaDe } from '../lib/zonas.js';

function pitido() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const vol = ctx.createGain();
    osc.connect(vol);
    vol.connect(ctx.destination);
    osc.frequency.value = 880;
    vol.gain.value = 0.05;
    osc.start();
    setTimeout(() => { osc.stop(); ctx.close(); }, 110);
  } catch { /* sin sonido si el navegador no deja */ }
}

/** Pantalla principal: elegir modo, escanear y caer al formulario que toca. */
export default function ScanView({ modo, setModo, onDetectado, pausado, zona }) {
  const [camara, setCamara] = useState(false);
  const [manual, setManual] = useState('');
  const [ilegible, setIlegible] = useState(false);

  const alLeer = useCallback((texto) => {
    const dato = decodeScan(texto, { strict: true });
    if (!dato) {
      setIlegible(true);
      return;
    }
    setIlegible(false);
    pitido();
    if (navigator.vibrate) navigator.vibrate(40);
    onDetectado(dato);
  }, [onDetectado]);

  function enviarManual(e) {
    e.preventDefault();
    const dato = decodeScan(manual, { strict: false });
    if (!dato) return;
    setManual('');
    onDetectado(dato);
  }

  return (
    <section className="escaneo">
      <div className="segmentos segmentos--modo" role="tablist" aria-label="Modo">
        <button
          role="tab"
          aria-selected={modo === 'compra'}
          className={modo === 'compra' ? 'activo activo--compra' : ''}
          onClick={() => setModo('compra')}
        >
          <strong>Compra</strong>
          <span>suma al stock</span>
        </button>
        <button
          role="tab"
          aria-selected={modo === 'consumo'}
          className={modo === 'consumo' ? 'activo activo--consumo' : ''}
          onClick={() => setModo('consumo')}
        >
          <strong>Consumo</strong>
          <span>saca del stock</span>
        </button>
      </div>

      {modo === 'compra' && (
        <p className="pista pista--centro">
          {zona === 'todas'
            ? 'Elegirás la zona al guardar cada producto.'
            : `Lo que agregues entra a ${zonaDe(zona).nombre}.`}
        </p>
      )}

      {camara ? (
        <>
          <BarcodeScanner active={camara && !pausado} onScan={alLeer} onError={() => {}} />
          {ilegible && <p className="pista pista--centro">Código no reconocido. Acércalo o escríbelo abajo.</p>}
          <button className="btn btn--suave" onClick={() => setCamara(false)}>Cerrar cámara</button>
        </>
      ) : (
        <button className="btn btn--principal btn--grande" onClick={() => setCamara(true)}>
          Escanear código
        </button>
      )}

      <form className="manual" onSubmit={enviarManual}>
        <input
          type="text"
          inputMode="numeric"
          placeholder="O escribe el código"
          value={manual}
          onChange={(e) => setManual(e.target.value)}
        />
        <button className="btn" type="submit" disabled={!manual.trim()}>Ir</button>
      </form>

      {modo === 'compra' && (
        <button className="btn btn--enlace" onClick={() => onDetectado({ barcode: '', expiry: '', fuente: 'sin-codigo' })}>
          Agregar algo sin código de barras
        </button>
      )}
    </section>
  );
}
