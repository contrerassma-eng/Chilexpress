import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { DecodeHintType, BarcodeFormat } from '@zxing/library';

// Formatos 1D habituales para etiquetas de paqueteria (codigos de 7-8 digitos
// suelen ser Code 128 / Code 39 / ITF, pero dejamos un set amplio).
const hints = new Map();
hints.set(DecodeHintType.POSSIBLE_FORMATS, [
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.CODE_93,
  BarcodeFormat.ITF,
  BarcodeFormat.CODABAR,
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.QR_CODE
]);
hints.set(DecodeHintType.TRY_HARDER, true);

export default function BarcodeScanner({ onScan, onError, active = true }) {
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const onScanRef = useRef(onScan);
  const [status, setStatus] = useState('init');

  useEffect(() => { onScanRef.current = onScan; }, [onScan]);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const reader = new BrowserMultiFormatReader(hints);
    setStatus('init');

    reader
      .decodeFromConstraints(
        { video: { facingMode: { ideal: 'environment' } } },
        videoRef.current,
        (result, err, controls) => {
          if (controls) controlsRef.current = controls;
          if (cancelled) return;
          if (result) {
            setStatus('reading');
            onScanRef.current?.(result.getText(), result);
          }
        }
      )
      .then((controls) => {
        controlsRef.current = controls;
        if (cancelled) controls.stop();
        else setStatus('ready');
      })
      .catch((e) => {
        setStatus('error');
        onError?.(e);
      });

    return () => {
      cancelled = true;
      try { controlsRef.current?.stop(); } catch { /* noop */ }
    };
  }, [active, onError]);

  return (
    <div className="scanner-frame">
      <video ref={videoRef} className="scanner-video" muted playsInline autoPlay />
      <div className="scanner-reticle" />
      {status === 'init' && <div className="scanner-hint">Iniciando camara&hellip;</div>}
      {status === 'error' && (
        <div className="scanner-hint scanner-hint--err">
          No se pudo abrir la camara. Revisa permisos y usa HTTPS.
        </div>
      )}
    </div>
  );
}
