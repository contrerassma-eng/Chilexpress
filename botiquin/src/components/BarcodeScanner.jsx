import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Lector de codigos.
 *
 * Usa el detector nativo del navegador cuando existe (Android/Chrome: mas
 * rapido y lee DataMatrix sin sudar) y cae a ZXing cuando no (iPhone/Safari).
 * ZXing pesa medio mega, asi que se descarga solo si hace falta.
 *
 * Nos quedamos con los formatos que traen las cajas de remedios y descartamos
 * el resto: Code-39 y compañia generan lecturas basura. Ademas exigimos leer
 * el mismo codigo dos veces seguidas antes de darlo por bueno.
 */

const FORMATOS_NATIVOS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'data_matrix'];

async function cargarZxing() {
  const [{ BrowserMultiFormatReader }, { DecodeHintType, BarcodeFormat }] = await Promise.all([
    import('@zxing/browser'),
    import('@zxing/library')
  ]);
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
    BarcodeFormat.CODE_128,
    BarcodeFormat.DATA_MATRIX
  ]);
  hints.set(DecodeHintType.TRY_HARDER, true);
  return new BrowserMultiFormatReader(hints);
}

const LECTURAS_ESTABLES = 2;
const ESPERA_MS = 1200;
const INTERVALO_NATIVO_MS = 200;

export default function BarcodeScanner({ onScan, onError, active = true }) {
  const videoRef = useRef(null);
  const onScanRef = useRef(onScan);
  const detenerRef = useRef(null);
  const estable = useRef({ code: '', veces: 0 });
  const esperaHasta = useRef(0);
  const [estado, setEstado] = useState('init');
  const [linterna, setLinterna] = useState({ disponible: false, encendida: false });

  useEffect(() => { onScanRef.current = onScan; }, [onScan]);

  const recibir = useCallback((texto) => {
    const code = String(texto || '').trim();
    if (!code) return;
    if (Date.now() < esperaHasta.current) return;

    if (estable.current.code === code) estable.current.veces += 1;
    else estable.current = { code, veces: 1 };
    if (estable.current.veces < LECTURAS_ESTABLES) return;

    esperaHasta.current = Date.now() + ESPERA_MS;
    estable.current = { code: '', veces: 0 };
    onScanRef.current?.(code);
  }, []);

  useEffect(() => {
    if (!active) return undefined;
    let cancelado = false;
    setEstado('init');
    estable.current = { code: '', veces: 0 };

    // La linterna ayuda harto dentro del mueble del baño.
    function revisarLinterna() {
      const track = videoRef.current?.srcObject?.getVideoTracks?.()[0];
      const capacidades = track?.getCapabilities?.();
      if (capacidades && 'torch' in capacidades) setLinterna({ disponible: true, encendida: false });
    }

    async function nativo() {
      const soportados = await window.BarcodeDetector.getSupportedFormats();
      const formats = FORMATOS_NATIVOS.filter((f) => soportados.includes(f));
      if (!formats.length) throw new Error('sin formatos utiles');

      const detector = new window.BarcodeDetector({ formats });
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } }
      });
      if (cancelado) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const video = videoRef.current;
      video.srcObject = stream;
      await video.play();
      revisarLinterna();
      setEstado('listo');

      let timer = 0;
      const mirar = async () => {
        if (cancelado) return;
        try {
          const codigos = await detector.detect(video);
          if (codigos?.length) recibir(codigos[0].rawValue);
        } catch { /* cuadro perdido: seguimos */ }
        timer = window.setTimeout(mirar, INTERVALO_NATIVO_MS);
      };
      mirar();

      detenerRef.current = () => {
        window.clearTimeout(timer);
        stream.getTracks().forEach((t) => t.stop());
        video.srcObject = null;
      };
    }

    async function zxing() {
      const reader = await cargarZxing();
      if (cancelado) return;
      const controls = await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: 'environment' } } },
        videoRef.current,
        (result) => { if (!cancelado && result) recibir(result.getText()); }
      );
      if (cancelado) { controls.stop(); return; }
      revisarLinterna();
      setEstado('listo');
      detenerRef.current = () => { try { controls.stop(); } catch { /* noop */ } };
    }

    const motor = window.BarcodeDetector ? nativo() : zxing();
    motor.catch(async (e) => {
      // Si el detector nativo falla igual intentamos con ZXing antes de rendirnos.
      if (cancelado) return;
      if (window.BarcodeDetector) {
        try {
          await zxing();
          return;
        } catch (e2) {
          onError?.(e2);
        }
      } else {
        onError?.(e);
      }
      if (!cancelado) setEstado('error');
    });

    return () => {
      cancelado = true;
      try { detenerRef.current?.(); } catch { /* noop */ }
      detenerRef.current = null;
      setLinterna({ disponible: false, encendida: false });
    };
  }, [active, onError, recibir]);

  async function alternarLinterna() {
    const track = videoRef.current?.srcObject?.getVideoTracks?.()[0];
    if (!track) return;
    const encendida = !linterna.encendida;
    try {
      await track.applyConstraints({ advanced: [{ torch: encendida }] });
      setLinterna((l) => ({ ...l, encendida }));
    } catch { /* el equipo no deja */ }
  }

  return (
    <div className="scanner">
      <video ref={videoRef} className="scanner__video" muted playsInline autoPlay />
      <div className="scanner__mira" />
      {estado === 'init' && <p className="scanner__aviso">Abriendo camara…</p>}
      {estado === 'error' && (
        <p className="scanner__aviso scanner__aviso--error">
          No se pudo abrir la camara. Revisa los permisos del navegador.
        </p>
      )}
      {linterna.disponible && estado === 'listo' && (
        <button type="button" className="scanner__linterna" onClick={alternarLinterna}>
          {linterna.encendida ? 'Apagar luz' : 'Encender luz'}
        </button>
      )}
    </div>
  );
}
