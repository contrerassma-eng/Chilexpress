import { useMemo, useState } from 'react';
import { expiryResumen } from '../lib/format.js';

const FILTROS = [
  { id: 'todos', texto: 'Todos' },
  { id: 'pronto', texto: 'Por vencer' },
  { id: 'vencido', texto: 'Vencidos' },
  { id: 'agotado', texto: 'Agotados' }
];

export default function InventarioView({ items, totales, onAbrir }) {
  const [q, setQ] = useState('');
  const [filtro, setFiltro] = useState('todos');

  const cuentas = {
    todos: totales.conStock,
    pronto: totales.porVencer,
    vencido: totales.vencidos,
    agotado: totales.agotados
  };

  const lista = useMemo(() => {
    const texto = q.trim().toLowerCase();
    return items.filter((i) => {
      // "Todos" muestra lo que hay en el mueble; los agotados tienen su propia pestaña.
      const pasaFiltro = filtro === 'todos' ? i.estado !== 'agotado' : i.estado === filtro;
      if (!pasaFiltro) return false;
      if (!texto) return true;
      return i.name.toLowerCase().includes(texto) || i.barcode.toLowerCase().includes(texto);
    });
  }, [items, q, filtro]);

  return (
    <section className="inventario">
      <input
        className="buscador"
        type="search"
        placeholder="Buscar remedio"
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

      {lista.length === 0 ? (
        <p className="vacio">
          {items.length === 0
            ? 'El botiquín está vacío. Escanea la primera caja en modo Compra.'
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
                    {item.estado === 'agotado' ? 'sin stock' : expiryResumen(item.proximo)}
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
