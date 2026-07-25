import { useEffect, useRef, useState } from 'react';
import { useBotiquin } from './state/store.jsx';
import PinGate from './components/PinGate.jsx';
import ScanView from './components/ScanView.jsx';
import InventarioView from './components/InventarioView.jsx';
import HistorialView from './components/HistorialView.jsx';
import CompraSheet from './components/CompraSheet.jsx';
import ConsumoSheet from './components/ConsumoSheet.jsx';
import ProductoSheet from './components/ProductoSheet.jsx';
import { codigoSinBarras } from './lib/codes.js';

const ESTADO_SYNC = {
  idle: { texto: 'conectando', clase: 'espera' },
  sincronizando: { texto: 'sincronizando', clase: 'espera' },
  ok: { texto: 'al día', clase: 'ok' },
  'sin-conexion': { texto: 'sin señal', clase: 'aviso' },
  error: { texto: 'error', clase: 'malo' }
};

export default function App() {
  const b = useBotiquin();
  const [tab, setTab] = useState('escanear');
  const [modo, setModo] = useState('compra');
  const [hoja, setHoja] = useState(null);
  const [flash, setFlash] = useState('');
  const [menu, setMenu] = useState(false);
  const instalador = useRef(null);
  const [sePuedeInstalar, setSePuedeInstalar] = useState(false);
  const temporizador = useRef(0);

  // Android ofrece instalar la app; iOS lo hace desde el menu Compartir.
  useEffect(() => {
    const capturar = (e) => {
      e.preventDefault();
      instalador.current = e;
      setSePuedeInstalar(true);
    };
    window.addEventListener('beforeinstallprompt', capturar);
    return () => window.removeEventListener('beforeinstallprompt', capturar);
  }, []);

  useEffect(() => () => window.clearTimeout(temporizador.current), []);

  function avisar(texto) {
    setFlash(texto);
    window.clearTimeout(temporizador.current);
    temporizador.current = window.setTimeout(() => setFlash(''), 2200);
  }

  // El botiquín entra directo. Solo pedimos PIN si el Worker lo exige, es decir
  // si alguna petición volvió con 401 porque hay un PIN configurado.
  if (b.state.pinInvalido) {
    return (
      <PinGate
        aviso={b.state.pin
          ? 'Ese PIN no es el del hogar. Prueba otra vez.'
          : 'Este botiquín está protegido con un PIN.'}
        onEntrar={(pin, quien) => { b.setPin(pin); b.setQuien(quien); }}
      />
    );
  }

  const itemActivo = hoja ? b.byBarcode.get(hoja.barcode) : null;

  function alDetectar(dato) {
    const item = dato.barcode ? b.byBarcode.get(dato.barcode) : null;
    // En consumo, un codigo desconocido o sin stock se trata como alta nueva.
    if (modo === 'compra' || !item || item.total === 0) {
      setHoja({
        tipo: 'compra',
        barcode: dato.barcode,
        expiry: dato.expiry || '',
        avisoConsumo: modo === 'consumo'
      });
    } else {
      setHoja({ tipo: 'consumo', barcode: dato.barcode });
    }
  }

  function guardarCompra({ barcode, name, qty, expiry }) {
    const codigo = barcode || codigoSinBarras(name);
    b.comprar({ barcode: codigo, name, qty, expiry });
    setHoja(null);
    avisar(`+${qty} ${name}`);
  }

  function consumir(cantidad, kind) {
    if (!itemActivo) return;
    const sacados = b.consumir(itemActivo, cantidad, kind);
    setHoja(null);
    avisar(`${kind === 'descarte' ? 'Botados ' : '−'}${sacados} ${itemActivo.name}`);
  }

  // Sin pantalla de PIN nadie pregunta el nombre, asi que queda a mano en el menu.
  function cambiarQuien() {
    setMenu(false);
    const nombre = prompt('¿Quién usa este teléfono? Aparece en el historial.', b.state.who || '');
    if (nombre !== null) b.setQuien(nombre.trim());
  }

  async function instalar() {
    setMenu(false);
    if (instalador.current) {
      instalador.current.prompt();
      instalador.current = null;
      setSePuedeInstalar(false);
      return;
    }
    alert(
      'Para dejarla como app:\n\n' +
      'iPhone (Safari): botón Compartir → "Agregar a inicio".\n' +
      'Android (Chrome): menú ⋮ → "Agregar a la pantalla principal".'
    );
  }

  const sync = ESTADO_SYNC[b.state.sync] || ESTADO_SYNC.idle;

  return (
    <div className="app">
      <header className="barra">
        <h1>Botiquín</h1>
        <button className={`estado estado--${sync.clase}`} onClick={b.sincronizar} title={b.state.error}>
          {sync.texto}
          {b.pendientes > 0 && <span className="estado__n">{b.pendientes}</span>}
        </button>
        <button className="barra__menu" aria-label="Menú" onClick={() => setMenu((m) => !m)}>⋮</button>
        {menu && (
          <div className="menu" onClick={() => setMenu(false)}>
            <button onClick={instalar}>{sePuedeInstalar ? 'Instalar en el teléfono' : 'Cómo instalarla'}</button>
            <button onClick={() => { setMenu(false); b.sincronizar(); }}>Sincronizar ahora</button>
            <button onClick={cambiarQuien}>
              Quién usa este teléfono{b.state.who ? `: ${b.state.who}` : ''}
            </button>
            <button className="peligro" onClick={() => { if (confirm('¿Borrar los datos guardados en este teléfono? El botiquín no se toca.')) b.salir(); }}>
              Borrar datos de este teléfono
            </button>
          </div>
        )}
      </header>

      {b.totales.vencidos > 0 && tab !== 'inventario' && (
        <button className="banner banner--malo" onClick={() => setTab('inventario')}>
          {b.totales.vencidos} producto(s) vencido(s) en el botiquín
        </button>
      )}

      <main className="contenido">
        {tab === 'escanear' && (
          <ScanView modo={modo} setModo={setModo} onDetectado={alDetectar} pausado={!!hoja} />
        )}
        {tab === 'inventario' && (
          <InventarioView
            items={b.items}
            totales={b.totales}
            onAbrir={(item) => setHoja({ tipo: 'producto', barcode: item.barcode })}
          />
        )}
        {tab === 'historial' && <HistorialView pin={b.state.pin} pendientes={b.pendientes} />}
      </main>

      {flash && <div className="flash">{flash}</div>}

      <nav className="pestanas">
        <button className={tab === 'escanear' ? 'activa' : ''} onClick={() => setTab('escanear')}>Escanear</button>
        <button className={tab === 'inventario' ? 'activa' : ''} onClick={() => setTab('inventario')}>
          Inventario <span className="pestanas__n">{b.totales.conStock}</span>
        </button>
        <button className={tab === 'historial' ? 'activa' : ''} onClick={() => setTab('historial')}>Historial</button>
      </nav>

      {hoja?.tipo === 'compra' && (
        <CompraSheet
          barcode={hoja.barcode}
          item={itemActivo}
          expiryInicial={hoja.expiry}
          avisoConsumo={hoja.avisoConsumo}
          onGuardar={guardarCompra}
          onClose={() => setHoja(null)}
        />
      )}

      {hoja?.tipo === 'consumo' && itemActivo && (
        <ConsumoSheet item={itemActivo} onConsumir={consumir} onClose={() => setHoja(null)} />
      )}

      {hoja?.tipo === 'producto' && itemActivo && (
        <ProductoSheet
          item={itemActivo}
          onClose={() => setHoja(null)}
          onRenombrar={(barcode, nombre) => { b.renombrar(barcode, nombre); avisar('Nombre actualizado'); }}
          onAjustar={(item, expiry, cantidad) => b.ajustar(item, expiry, cantidad)}
          onBorrar={(item) => { b.borrar(item); avisar(`${item.name} eliminado`); }}
        />
      )}
    </div>
  );
}
