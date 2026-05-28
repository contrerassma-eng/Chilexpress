import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { DecodeHintType, BarcodeFormat } from '@zxing/library';

// Chile Express usa codigos EAN-13 (13 digitos con digito verificador).
// Restringimos a EAN-13 + Code-128 para evitar lecturas basura (Code-39 tipo
// "B1A", EAN-8 de 8 digitos, QR, etc.). El verificador del EAN-13 ya descarta
// la mayoria de las lecturas erroneas.
const hints = new Map();
hints.set(DecodeHintType.POSSIBLE_FORMATS, [
  BarcodeFormat.EAN_13,
  BarcodeFormat.CODE_128
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
