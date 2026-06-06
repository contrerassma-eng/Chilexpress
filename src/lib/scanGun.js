// Captura de lector de codigo de barra tipo "pistola" (incluida Bluetooth).
//
// Estas pistolas funcionan como un TECLADO (HID): al escanear, "teclean" muy
// rapido los digitos del codigo y terminan con Enter. No requieren driver ni
// emparejado especial mas alla del Bluetooth del sistema.
//
// Heuristica para distinguir un escaneo de una persona escribiendo:
//   - las teclas llegan MUY rapido (< ~35ms entre golpes)
//   - el codigo termina con Enter
//   - tiene largo de codigo de barra (>= minLength)
//
// Una rafaga de escaneo se detecta desde el 2º golpe rapido; desde ahi
// evitamos que las teclas se escriban en el input enfocado. El 1er caracter
// puede "colarse" en el campo con foco, asi que al completar el escaneo lo
// limpiamos de ese campo. Si el usuario escribe a mano (lento), no interferimos.
//
// Uso: const stop = listenScanGun(code => ...); ... stop();

export function listenScanGun(onScan, opts = {}) {
  const maxGapMs = opts.maxGapMs ?? 35;   // separacion maxima entre teclas
  const minLength = opts.minLength ?? 6;  // largo minimo para considerar codigo

  let buffer = '';
  let lastTime = 0;
  let bursting = false;
  // Campo y caracter que pudo colarse al iniciar la rafaga, para limpiarlo.
  let leakEl = null;
  let leakChar = '';

  // Quita un caracter colado al final del campo enfocado (best-effort, sirve
  // para inputs controlados de React via el setter nativo + evento input).
  function cleanLeak() {
    const el = leakEl;
    const ch = leakChar;
    leakEl = null; leakChar = '';
    if (!el || !ch) return;
    try {
      if ((el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') &&
          typeof el.value === 'string' && el.value.endsWith(ch)) {
        const proto = Object.getPrototypeOf(el);
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        const next = el.value.slice(0, -1);
        if (setter) setter.call(el, next); else el.value = next;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    } catch { /* no critico */ }
  }

  function onKeydown(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    const now = Date.now();
    const gap = now - lastTime;
    lastTime = now;

    if (e.key === 'Enter') {
      const code = buffer.trim();
      const wasBurst = bursting;
      buffer = '';
      bursting = false;
      if (wasBurst && code.length >= minLength) {
        e.preventDefault();
        e.stopPropagation();
        cleanLeak();
        onScan(code);
      }
      return;
    }

    if (e.key.length !== 1) return; // teclas no imprimibles

    if (gap > maxGapMs) {
      // Inicio de secuencia: aun no sabemos si es escaneo. Anotamos el posible
      // caracter colado en el campo enfocado para limpiarlo si resulta escaneo.
      buffer = e.key;
      bursting = false;
      const el = e.target;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
        leakEl = el; leakChar = e.key;
      } else {
        leakEl = null; leakChar = '';
      }
      return;
    }

    // Golpe rapido encadenado: es parte de una rafaga (escaneo).
    buffer += e.key;
    bursting = true;
    e.preventDefault();
    e.stopPropagation();
  }

  window.addEventListener('keydown', onKeydown, true);
  return () => window.removeEventListener('keydown', onKeydown, true);
}
