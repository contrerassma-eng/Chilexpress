/** Selector de cantidad con botones grandes, para usarlo con una mano. */
export default function Cantidad({ valor, onChange, min = 1, max = 999 }) {
  const fijar = (n) => onChange(Math.min(max, Math.max(min, n)));

  return (
    <div className="cantidad">
      <button type="button" onClick={() => fijar(valor - 1)} aria-label="Menos" disabled={valor <= min}>−</button>
      <input
        type="number"
        inputMode="numeric"
        value={valor}
        min={min}
        max={max}
        onChange={(e) => fijar(Number(e.target.value) || min)}
        aria-label="Cantidad"
      />
      <button type="button" onClick={() => fijar(valor + 1)} aria-label="Mas" disabled={valor >= max}>+</button>
    </div>
  );
}
