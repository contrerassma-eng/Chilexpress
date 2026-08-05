import { useCallback, useEffect, useRef, useState } from 'react';
import BarcodeScanner from './BarcodeScanner.jsx';
import { decodeScan } from '../lib/codes.js';
import { zonaDe } from '../lib/zonas.js';
import InventarioFisico from './InventarioFisico.jsx';

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
export default function ScanView({
  modo,
  setModo,
  onDetectado,
  pausado,
  zona,
  inventario,
  onIniciarInventario,
  onTerminarInventario,
  onBorrarLinea
}) {
  const [camara, setCamara] = useState(false);
  const [manual, setManual] = useState('');
  const [ilegible, setIlegible] = useState(false);
  const campo = useRef(null);
  // Rafaga en curso de la pistola cuando el foco no estaba en la caja.
  const rafaga = useRef({ texto: '', ultimo: 0 });
  const PAUSA_MS = 400;

  // La pistola escribe como si fuera un teclado y termina con Enter: el cursor
  // tiene que estar SIEMPRE en la caja del codigo. Se vuelve a poner al abrir,
  // al cambiar de modo y cada vez que se cierra una hoja.
  const enfocar = useCallback(() => {
    const el = campo.current;
    if (!el || el.disabled) return;
    // Nunca a mitad de un disparo: mover el foco ahora partiria el codigo en
    // dos, y a un codigo al que le falta el primer digito le sobra cara de
    // valido (7802920423814 sin el 7 pasa por un UPC-A legitimo).
    if (Date.now() - rafaga.current.ultimo < PAUSA_MS) return;
    el.focus({ preventScroll: true });
    el.select();
  }, []);

  useEffect(() => {
    if (pausado) return;
    // Un tick para que el foco gane despues de que React pinte la hoja cerrada.
    const t = window.setTimeout(enfocar, 0);
    return () => window.clearTimeout(t);
  }, [pausado, modo, inventario, camara, enfocar]);

  // `estricto` separa las dos formas de entrar un codigo: la pistola es un
  // lector y se le exige un codigo de verdad, igual que a la camara; lo que se
  // escribe a mano puede ser cualquier cosa, porque lo decidio una persona.
  const enviar = useCallback((texto, { estricto = false } = {}) => {
    const dato = decodeScan(texto, { strict: estricto });
    setManual('');
    if (!dato) {
      setIlegible(true);
      enfocar();
      return;
    }
    setIlegible(false);
    onDetectado(dato);
  }, [onDetectado, enfocar]);

  // Red de seguridad para la pistola: si dispara con el foco en otra parte (el
  // usuario acaba de tocar un boton), las teclas se juntan aca en vez de
  // perderse. Importa porque a un codigo al que le falta el primer digito le
  // sobra cara de valido: 7802920423814 sin el 7 pasa por un UPC-A legitimo.
  // Se reconoce a la pistola por la velocidad: teclea mucho mas rapido que una
  // persona, asi que una pausa larga corta la racha y empieza de nuevo.
  useEffect(() => {
    function alTeclear(e) {
      if (pausado || e.ctrlKey || e.metaKey || e.altKey) return;
      const foco = document.activeElement;
      // Si el cursor ya esta en una caja de texto, que escriba ahi normalmente.
      if (foco && /^(INPUT|TEXTAREA|SELECT)$/.test(foco.tagName)) return;
      if (!campo.current) return;

      const r = rafaga.current;
      const ahora = Date.now();
      if (ahora - r.ultimo > PAUSA_MS) r.texto = '';
      r.ultimo = ahora;

      if (e.key === 'Enter') {
        const leido = r.texto;
        r.texto = '';
        r.ultimo = 0;          // la rafaga termino: el foco ya puede volver
        // Menos de 4 teclas no es un disparo: alguien apreto Enter y ya esta.
        if (leido.length < 4) { enfocar(); return; }
        e.preventDefault();
        enviar(leido, { estricto: true });
        enfocar();
        return;
      }
      if (e.key.length !== 1) return;
      e.preventDefault();
      r.texto += e.key;
    }

    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [pausado, enviar, enfocar]);

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
    enviar(manual);
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
        <button
          role="tab"
          aria-selected={modo === 'inventario'}
          className={modo === 'inventario' ? 'activo activo--inventario' : ''}
          onClick={() => setModo('inventario')}
        >
          <strong>Inventario</strong>
          <span>cuenta lo real</span>
        </button>
      </div>

      {modo === 'inventario' && (
        <InventarioFisico
          inventario={inventario}
          zona={zona}
          onIniciar={onIniciarInventario}
          onTerminar={onTerminarInventario}
          onBorrar={onBorrarLinea}
        />
      )}

      {modo === 'compra' && (
        <p className="pista pista--centro">
          {zona === 'todas'
            ? 'Elegirás la zona al guardar cada producto.'
            : `Lo que agregues entra a ${zonaDe(zona).nombre}.`}
        </p>
      )}

      {/* La caja va primero y con el cursor puesto: es por donde entra la
          pistola, que escribe el codigo y aprieta Enter sola. */}
      {(modo !== 'inventario' || inventario) && (
      <form className="manual" onSubmit={enviarManual}>
        <input
          ref={campo}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
          enterKeyHint="go"
          placeholder="Dispara la pistola o escribe el código"
          value={manual}
          onChange={(e) => setManual(e.target.value)}
        />
        <button className="btn" type="submit" disabled={!manual.trim()}>Ir</button>
      </form>
      )}

      {ilegible && (
        <p className="pista pista--centro">Código no reconocido. Vuelve a dispararlo o escríbelo arriba.</p>
      )}

      {modo === 'inventario' && !inventario ? null : camara ? (
        <>
          <BarcodeScanner active={camara && !pausado} onScan={alLeer} onError={() => {}} />
          <button className="btn btn--suave" onClick={() => setCamara(false)}>Cerrar cámara</button>
        </>
      ) : (
        <button className="btn btn--suave" onClick={() => setCamara(true)}>
          Escanear con la cámara
        </button>
      )}

      {modo === 'compra' && (
        <button className="btn btn--enlace" onClick={() => onDetectado({ barcode: '', expiry: '', fuente: 'sin-codigo' })}>
          Agregar algo sin código de barras
        </button>
      )}
    </section>
  );
}
