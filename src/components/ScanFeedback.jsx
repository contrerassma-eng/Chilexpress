// Tic flotante semitransparente que confirma la lectura sin tapar la camara.
export default function ScanFeedback({ flash }) {
  if (!flash) return null;
  const cls = flash.dup
    ? 'scan-flash scan-flash--dup'
    : flash.mode === 'entrega'
      ? 'scan-flash scan-flash--entrega'
      : 'scan-flash scan-flash--recepcion';
  return (
    <div className={cls} key={flash.key} aria-live="polite">
      <div className="scan-flash__check">{flash.dup ? '!' : '✓'}</div>
      <div className="scan-flash__code">{flash.code}</div>
      <div className="scan-flash__label">
        {flash.dup ? 'Ya leido' : flash.mode === 'entrega' ? 'Entregado' : 'Recibido'}
      </div>
    </div>
  );
}
