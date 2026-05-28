import { useRef, useState } from 'react';
import SignaturePad from './SignaturePad.jsx';
import { buildReport, reportHtml, reportCsv, downloadFile, fileStamp } from '../lib/report.js';
import { nowIso } from '../lib/format.js';

export default function CloseShiftDialog({ state, dispatch, onClose }) {
  const sigRef = useRef(null);
  const [err, setErr] = useState('');
  const closedAt = useRef(nowIso()).current;
  const report = buildReport(state, closedAt);
  const t = report.totals;

  function confirm() {
    if (!sigRef.current || sigRef.current.isEmpty()) {
      setErr('Falta la firma del responsable del turno.');
      return;
    }
    const signature = sigRef.current.toDataURL();
    const stamp = fileStamp(closedAt);
    downloadFile(`reporte_turno_${stamp}.html`, reportHtml(report, signature), 'text/html;charset=utf-8');
    downloadFile(`paquetes_${stamp}.csv`, reportCsv(state), 'text/csv;charset=utf-8');
    dispatch({ type: 'CLOSE_SHIFT', totals: t });
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Cerrar turno</h2>
        <p className="muted">Responsable: <b>{report.responsable}</b></p>
        <div className="summary-grid">
          <div className="sum"><span className="sum__n">{t.total}</span><span>Total</span></div>
          <div className="sum"><span className="sum__n amber">{t.recibidos}</span><span>Pendientes</span></div>
          <div className="sum"><span className="sum__n green">{t.entregadosTurno}</span><span>Entregados turno</span></div>
          <div className="sum"><span className="sum__n">{t.sinLlegar}</span><span>Sin llegar</span></div>
        </div>

        <label className="field-label">Firma del responsable</label>
        <SignaturePad ref={sigRef} />
        <button className="btn btn--ghost btn--sm" onClick={() => { sigRef.current?.clear(); setErr(''); }}>
          Limpiar firma
        </button>

        {err && <p className="err-msg">{err}</p>}

        <div className="import-foot">
          <span className="muted">Se descargara el reporte (HTML para PDF) y un CSV.</span>
          <div className="row-gap">
            <button className="btn btn--ghost" onClick={onClose}>Cancelar</button>
            <button className="btn btn--primary" onClick={confirm}>Cerrar y generar reporte</button>
          </div>
        </div>
      </div>
    </div>
  );
}
