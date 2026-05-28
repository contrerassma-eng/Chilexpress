import PackageRow from './PackageRow.jsx';

export default function PackageList({ items, dispatch }) {
  if (items.length === 0) {
    return <p className="empty">No hay codigos para mostrar. Importa la lista o escanea para empezar.</p>;
  }
  return (
    <ul className="pkg-list">
      {items.map((pkg) => (
        <PackageRow key={pkg.code} pkg={pkg} dispatch={dispatch} />
      ))}
    </ul>
  );
}
