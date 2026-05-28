import { fmtDateTime, fmtTime } from '../lib/format.js';
import { reportCsv, downloadFile, fileStamp } from '../lib/report.js';

// Visor de reporte a pantalla completa. Imprime directo con window.print(),
// que en celular ofrece "Guardar como PDF" / compartir. Mas confiable que
// descargar un .html (iOS Safari no maneja bien la descarga de blobs).
export default function ReportView({ payload, onClose }) {
  const { report, signature, csvState } = payload;
  const t = report.totals;

  function downloadCsv() {
    downloadFile(`paquetes_${fileStamp(report.closedAt)}.csv`, reportCsv(csvState), 'text/csv;charset=utf-8');
  }

  return (
    <div className="report-overlay">
      <div className="report-bar no-print">
        <button className="btn btn--ghost" onClick={onClose}>Listo</button>
        <div className="row-gap">
          <button className="btn" onClick={downloadCsv}>CSV</button>
          <button className="btn btn--primary" onClick={() => window.print()}>Guardar / Imprimir PDF</button>
        </div>
      </div>

      <div className="report-doc" id="report-doc">
        <h1>Reporte de turno — Chile Express</h1>
        <div className="report-meta">
          <div><b>Responsable:</b> {report.responsable}</div>
          <div><b>Inicio turno:</b> {fmtDateTime(report.startedAt)}</div>
          <div><b>Cierre turno:</b> {fmtDateTime(report.closedAt)}</div>
        </div>

        <div className="report-cards">
          <div className="rc"><span className="rc__n">{t.total}</span><span className="rc__l">Total en lista</span></div>
          <div className="rc"><span className="rc__n amber">{t.recibidos}</span><span className="rc__l">Recibidos pendientes</span></div>
          <div className="rc"><span className="rc__n green">{t.entregados}</span><span className="rc__l">Entregados (total)</span></div>
          <div className="rc"><span className="rc__n green">{t.entregadosTurno}</span><span className="rc__l">Entregados en el turno</span></div>
          <div className="rc"><span className="rc__n">{t.sinLlegar}</span><span className="rc__l">Sin llegar</span></div>
        </div>

        <h2>Entregados durante el turno ({report.entregadosTurno.length})</h2>
        <table className="report-table">
          <thead><tr><th>#</th><th>Codigo</th><th>Hora entrega</th></tr></thead>
          <tbody>
            {report.entregadosTurno.length === 0 ? (
              <tr><td colSpan={3}>Sin entregas registradas.</td></tr>
            ) : (
              report.entregadosTurno.map((p, i) => (
                <tr key={p.code}><td>{i + 1}</td><td>{p.code}</td><td>{fmtTime(p.deliveredAt)}</td></tr>
              ))
            )}
          </tbody>
        </table>

        <h2>Recibidos pendientes de entrega ({report.pendientes.length})</h2>
        <table className="report-table">
          <thead><tr><th>Codigo</th><th>Hora recepcion</th></tr></thead>
          <tbody>
            {report.pendientes.length === 0 ? (
              <tr><td colSpan={2}>Ninguno.</td></tr>
            ) : (
              report.pendientes.map((p) => (
                <tr key={p.code}><td>{p.code}</td><td>{fmtTime(p.arrivedAt)}</td></tr>
              ))
            )}
          </tbody>
        </table>

        <h2>En lista sin llegar ({report.sinLlegar.length})</h2>
        <table className="report-table">
          <thead><tr><th>Codigo</th></tr></thead>
          <tbody>
            {report.sinLlegar.length === 0 ? (
              <tr><td>Ninguno.</td></tr>
            ) : (
              report.sinLlegar.map((p) => <tr key={p.code}><td>{p.code}</td></tr>)
            )}
          </tbody>
        </table>

        <div className="report-sign">
          <h2>Firma responsable de turno</h2>
          {signature ? (
            <img className="report-sign__img" src={signature} alt="firma" />
          ) : (
            <p>(Sin firma)</p>
          )}
          <div className="report-sign__line">______________________________<br />{report.responsable}</div>
        </div>
      </div>
    </div>
  );
}
