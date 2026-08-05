import { useMemo, useState } from 'react';
import { expiryResumen } from '../lib/format.js';
import { resumen } from '../lib/inventory.js';
import { zonaDe } from '../lib/zonas.js';

const FILTROS = [
  { id: 'todos', texto: 'Todos' },
  { id: 'pronto', texto: 'Por vencer' },
  { id: 'vencido', texto: 'Vencidos' },
  { id: 'agotado', texto: 'Por comprar' }
];

export default function InventarioView({ items, zona, onAbrir }) {
  const [q, setQ] = useState('');
  const [filtro, setFiltro] = useState('todos');

  const deLaZona = useMemo(
    () => (zona === 'todas' ? items : items.filter((i) => i.zona === zona)),
    [items, zona]
  );

  const cuentas = useMemo(() => {
    const r = resumen(deLaZona);
    return { todos: r.conStock, pronto: r.porVencer, vencido: r.vencidos, agotado: r.agotados };
  }, [deLaZona]);

  const lista = useMemo(() => {
    const texto = q.trim().toLowerCase();
    return deLaZona.filter((i) => {
      // "Todos" muestra lo que hay en casa; lo agotado tiene su propia pestaña.
      const pasaFiltro = filtro === 'todos' ? i.estado !== 'agotado' : i.estado === filtro;
      if (!pasaFiltro) return false;
      if (!texto) return true;
      return i.name.toLowerCase().includes(texto) || i.barcode.toLowerCase().includes(texto);
    });
  }, [deLaZona, q, filtro]);

  return (
    <section className="inventario">
      <input
        className="buscador"
        type="search"
        placeholder="Buscar"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <div className="chips chips--filtros">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            className={`chip ${filtro === f.id ? 'chip--activo' : ''}`}
            onClick={() => setFiltro(f.id)}
          >
            {f.texto} <span className="chip__n">{cuentas[f.id] ?? 0}</span>
          </button>
        ))}
      </div>

      {(() => {
        const r = resumen(deLaZona);
        return r.valor && (
          <div className="resumen-valor">
            <span className="resumen-valor__label">Valor total:</span>
            <span className="resumen-valor__monto">${r.valor.toFixed(2)}</span>
          </div>
        );
      })()}

      {lista.length === 0 ? (
        <p className="vacio">
          {deLaZona.length === 0
            ? `Nada guardado todavía${zona === 'todas' ? '' : ` en ${zonaDe(zona).nombre.toLowerCase()}`}. Escanea la primera caja en modo Compra.`
            : 'Nada por acá con ese filtro.'}
        </p>
      ) : (
        <ul className="items">
          {lista.map((item) => (
            <li key={item.barcode}>
              <button className={`item item--${item.estado}`} onClick={() => onAbrir(item)}>
                <span className="item__cantidad">{item.total}</span>
                <span className="item__texto">
                  <strong>{item.name}</strong>
                  <small>
                    {/* Viendo todas las zonas, el icono dice de dónde es cada cosa. */}
                    {zona === 'todas' && `${zonaDe(item.zona).icono} `}
                    {item.estado === 'agotado' ? 'sin stock' : expiryResumen(item.proximo, item.aviso)}
                    {item.lotes.length > 1 && ` · ${item.lotes.length} lotes`}
                  </small>
                </span>
                <span className="item__flecha" aria-hidden="true">›</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
