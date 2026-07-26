import { useCallback, useEffect, useRef, useState } from 'react';
import { validarCodigo } from '../lib/codes.js';

/**
 * Lector de codigos de barras.
 *
 * Abrimos la camara nosotros y corremos un solo bucle de decodificacion, sin
 * importar que motor decodifique: el nativo del navegador (Android, rapido y
 * bueno con DataMatrix) o ZXing (iPhone, que no tiene el nativo).
 *
 * Lo que hace que lea codigos malos, borrosos o mal enfocados:
 *
 *  - Pide 1080p. Por defecto los navegadores entregan 640x480, donde un EAN-13
 *    a un tercio del ancho deja ~2 pixeles por barra: demasiado poco.
 *  - Decodifica SOLO el recorte de la mira, escalado. Asi el ajuste de
 *    contraste se calcula sobre el codigo y no sobre todo el estante, y de paso
 *    cuesta mucho menos CPU.
 *  - Enfoque, exposicion y balance continuos, zoom suave y toque para enfocar
 *    donde el equipo lo permita (Android; iOS no expone ninguno).
 *  - Si el codigo esta vertical, cada dos intentos prueba con la mira girada.
 *
 * Y lo que hace que sea rapido SIN perder precision: verificamos el digito
 * verificador. Si cuadra, aceptamos con una sola lectura en vez de dos. Si no
 * cuadra, se descarta aunque se repita: una lectura mala de un codigo dañado
 * tiende a repetirse igual, asi que "leerlo dos veces" nunca fue garantia.
 */

const FORMATOS_NATIVOS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'data_matrix'];

const INTERVALO_MS = 120;          // ~8 intentos por segundo
const ESPERA_MS = 1200;            // pausa tras aceptar, para no leer en rafaga
const LECTURAS_SIN_VERIFICADOR = 2;
const RESPALDO_MS = 6000;          // si el motor no da señales, sumamos el otro
const ANCHO_OBJETIVO = 1280;

// Recorte de la mira. Horizontal para el codigo normal, vertical para el girado.
const MIRA = { ancho: 0.86, alto: 0.4 };

const CONSTRAINTS = {
  video: {
    facingMode: { ideal: 'environment' },
    width: { min: 640, ideal: 1920 },
    height: { min: 480, ideal: 1080 },
    frameRate: { ideal: 30 }
  }
};

// Las constraints de `advanced` que el equipo no soporta se ignoran solas,
// asi que se pueden pedir todas sin miedo.
async function afinarCamara(track) {
  const caps = track.getCapabilities?.() ?? {};
  const advanced = [];
  if (caps.focusMode?.includes('continuous')) advanced.push({ focusMode: 'continuous' });
  if (caps.exposureMode?.includes('continuous')) advanced.push({ exposureMode: 'continuous' });
  if (caps.whiteBalanceMode?.includes('continuous')) advanced.push({ whiteBalanceMode: 'continuous' });
  // Un zoom suave acerca el codigo sin tener que pegar el telefono al envase,
  // que es donde el enfoque automatico se pierde.
  if (caps.zoom) {
    const z = Math.min(caps.zoom.max ?? 1, Math.max(caps.zoom.min ?? 1, 1.7));
    advanced.push({ zoom: z });
  }
  if (!advanced.length) return;
  try { await track.applyConstraints({ advanced }); } catch { /* el equipo no deja */ }
}

async function enfocarEn(track, x, y) {
  const caps = track?.getCapabilities?.() ?? {};
  if (!('pointsOfInterest' in caps)) return;
  try {
    await track.applyConstraints({
      advanced: [{
        pointsOfInterest: [{ x, y }],
        ...(caps.focusMode?.includes('single-shot') ? { focusMode: 'single-shot' } : {})
      }]
    });
  } catch { /* sin enfoque manual */ }
}

// ZXing pesa medio mega: solo se descarga si de verdad hace falta.
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
  const reader = new BrowserMultiFormatReader(hints);
  // decodeFromCanvas es sincrono y lanza excepcion cuando no encuentra nada.
  return (lienzo) => {
    try { return reader.decodeFromCanvas(lienzo).getText(); } catch { return ''; }
  };
}

async function cargarNativo() {
  const soportados = await window.BarcodeDetector.getSupportedFormats();
  const formats = FORMATOS_NATIVOS.filter((f) => soportados.includes(f));
  if (!formats.length) throw new Error('sin formatos utiles');
  const detector = new window.BarcodeDetector({ formats });
  return async (lienzo) => {
    const codigos = await detector.detect(lienzo);
    return codigos?.[0]?.rawValue || '';
  };
}

export default function BarcodeScanner({ onScan, onError, active = true }) {
  const videoRef = useRef(null);
  const onScanRef = useRef(onScan);
  const trackRef = useRef(null);
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

    const verificado = validarCodigo(code);

    // Trae verificador y no cuadra: lectura mala, no insistimos.
    if (verificado === false) {
      estable.current = { code: '', veces: 0 };
      return;
    }

    // Sin verificador que comprobar (Code-128, DataMatrix): pedimos repeticion.
    if (verificado === null) {
      if (estable.current.code === code) estable.current.veces += 1;
      else estable.current = { code, veces: 1 };
      if (estable.current.veces < LECTURAS_SIN_VERIFICADOR) return;
    }

    esperaHasta.current = Date.now() + ESPERA_MS;
    estable.current = { code: '', veces: 0 };
    onScanRef.current?.(code);
  }, []);

  useEffect(() => {
    if (!active) return undefined;

    let cancelado = false;
    let stream = null;
    let pararLoop = null;
    let temporizadorRespaldo = 0;
    let decodificarRespaldo = null;
    let huboLectura = false;

    const lienzo = document.createElement('canvas');
    const ctx = lienzo.getContext('2d', { willReadFrequently: true });
    const girado = document.createElement('canvas');
    const ctxGirado = girado.getContext('2d', { willReadFrequently: true });

    setEstado('init');
    estable.current = { code: '', veces: 0 };

    // Recorta la mira y la escala. Girada cuando toca probar codigos verticales.
    function pintarMira(video, girar) {
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!vw || !vh) return null;

      const anchoRel = girar ? MIRA.alto : MIRA.ancho;
      const altoRel = girar ? MIRA.ancho : MIRA.alto;
      const sw = Math.round(vw * anchoRel);
      const sh = Math.round(vh * altoRel);
      const sx = Math.round((vw - sw) / 2);
      const sy = Math.round((vh - sh) / 2);

      // Ampliar solo si la fuente es chica: mas pixeles por barra reduce el
      // error al medir anchos, pero ampliar 1080p no aporta y cuesta CPU.
      const escala = Math.min(2, Math.max(1, ANCHO_OBJETIVO / sw));
      lienzo.width = Math.round(sw * escala);
      lienzo.height = Math.round(sh * escala);

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      // Gris + contraste por GPU: casi gratis y rescata codigos lavados.
      ctx.filter = 'grayscale(1) contrast(1.3)';
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, lienzo.width, lienzo.height);
      ctx.filter = 'none';

      if (!girar) return lienzo;

      girado.width = lienzo.height;
      girado.height = lienzo.width;
      ctxGirado.setTransform(0, 1, -1, 0, lienzo.height, 0);
      ctxGirado.drawImage(lienzo, 0, 0);
      ctxGirado.setTransform(1, 0, 0, 1, 0, 0);
      return girado;
    }

    function arrancarLoop(video, decodificar) {
      let detenido = false;
      let ultimo = 0;
      let idFrame = 0;
      let idTimer = 0;
      let fallos = 0;
      let ciclo = 0;
      const usaFrames = typeof video.requestVideoFrameCallback === 'function';

      const paso = async (marca) => {
        if (detenido || cancelado) return;
        const ahora = marca ?? performance.now();
        if (ahora - ultimo >= INTERVALO_MS) {
          ultimo = ahora;
          // Tras varios fallos seguidos alternamos con la mira girada.
          const girar = fallos >= 6 && ciclo++ % 2 === 1;
          const cuadro = pintarMira(video, girar);
          if (cuadro) {
            let texto = await Promise.resolve(decodificar(cuadro)).catch(() => '');
            // El motor de respaldo entra solo cuando el principal no da nada.
            if (!texto && decodificarRespaldo) {
              texto = await Promise.resolve(decodificarRespaldo(cuadro)).catch(() => '');
            }
            if (texto) {
              huboLectura = true;
              fallos = 0;
              recibir(texto);
            } else {
              fallos += 1;
            }
          }
        }
        if (detenido || cancelado) return;
        if (usaFrames) idFrame = video.requestVideoFrameCallback(paso);
        else idTimer = window.setTimeout(() => paso(performance.now()), INTERVALO_MS);
      };

      paso(performance.now());

      return () => {
        detenido = true;
        if (usaFrames && idFrame) video.cancelVideoFrameCallback?.(idFrame);
        window.clearTimeout(idTimer);
      };
    }

    async function iniciar() {
      stream = await navigator.mediaDevices.getUserMedia(CONSTRAINTS);
      if (cancelado) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const video = videoRef.current;
      video.srcObject = stream;
      await video.play();

      const track = stream.getVideoTracks()[0];
      trackRef.current = track;
      await afinarCamara(track);
      if (track.getCapabilities?.() && 'torch' in track.getCapabilities()) {
        setLinterna({ disponible: true, encendida: false });
      }

      const nativo = Boolean(window.BarcodeDetector);
      const decodificar = nativo ? await cargarNativo() : await cargarZxing();
      if (cancelado) return;
      setEstado('listo');
      pararLoop = arrancarLoop(video, decodificar);

      // El detector nativo puede existir y no estar operativo (Android sin la
      // libreria de Play Services descargada): responde vacio para siempre y
      // sin error. Si no leyo nada en un rato, sumamos el otro motor en vez de
      // cambiarlo, para no penalizar a quien simplemente no ha apuntado aun.
      temporizadorRespaldo = window.setTimeout(async () => {
        if (cancelado || huboLectura) return;
        try {
          decodificarRespaldo = nativo ? await cargarZxing() : await cargarNativo();
        } catch { /* nos quedamos con el que hay */ }
      }, RESPALDO_MS);
    }

    iniciar().catch((e) => {
      if (cancelado) return;
      onError?.(e);
      setEstado('error');
    });

    return () => {
      cancelado = true;
      window.clearTimeout(temporizadorRespaldo);
      try { pararLoop?.(); } catch { /* noop */ }
      try { stream?.getTracks().forEach((t) => t.stop()); } catch { /* noop */ }
      if (videoRef.current) videoRef.current.srcObject = null;
      trackRef.current = null;
      detenerRef.current = null;
      setLinterna({ disponible: false, encendida: false });
    };
  }, [active, onError, recibir]);

  async function alternarLinterna() {
    const track = trackRef.current;
    if (!track) return;
    const encendida = !linterna.encendida;
    try {
      await track.applyConstraints({ advanced: [{ torch: encendida }] });
      setLinterna((l) => ({ ...l, encendida }));
    } catch { /* el equipo no deja */ }
  }

  function tocarParaEnfocar(e) {
    const caja = e.currentTarget.getBoundingClientRect();
    enfocarEn(trackRef.current, (e.clientX - caja.left) / caja.width, (e.clientY - caja.top) / caja.height);
  }

  return (
    <div className="scanner">
      <video
        ref={videoRef}
        className="scanner__video"
        muted
        playsInline
        autoPlay
        onClick={tocarParaEnfocar}
      />
      <div className="scanner__mira" />
      {estado === 'init' && <p className="scanner__aviso">Abriendo cámara…</p>}
      {estado === 'listo' && <p className="scanner__aviso">Pon el código dentro del recuadro · toca para enfocar</p>}
      {estado === 'error' && (
        <p className="scanner__aviso scanner__aviso--error">
          No se pudo abrir la cámara. Revisa los permisos del navegador.
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
