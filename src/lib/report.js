import { STATUS } from '../state/store.jsx';
import { fmtDateTime, fmtTime, fmtDateForFile } from './format.js';

export function buildReport(state, closedAt) {
  const shift = state.shift;
  const pkgs = Object.values(state.packages);
  const startedAt = shift?.startedAt || null;

  const entregados = pkgs.filter((p) => p.status === STATUS.ENTREGADO);
  const recibidos = pkgs.filter((p) => p.status === STATUS.RECIBIDO);
  const esperados = pkgs.filter((p) => p.status === STATUS.ESPERADO);

  // Entregas hechas dentro de la ventana del turno actual.
  const entregadosTurno = entregados.filter(
    (p) => p.deliveredAt && (!startedAt || p.deliveredAt >= startedAt)
  );

  return {
    responsable: shift?.responsable || '-',
    startedAt,
    closedAt,
    totals: {
      total: pkgs.length,
      esperados: esperados.length,
      recibidos: recibidos.length,
      entregados: entregados.length,
      entregadosTurno: entregadosTurno.length,
      pendientesEntrega: recibidos.length,
      sinLlegar: esperados.length
    },
    entregadosTurno: entregadosTurno.sort((a, b) => (a.deliveredAt < b.deliveredAt ? -1 : 1)),
    pendientes: recibidos.sort((a, b) => (a.code < b.code ? -1 : 1)),
    sinLlegar: esperados.sort((a, b) => (a.code < b.code ? -1 : 1))
  };
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

export function reportHtml(report, signatureDataUrl) {
  const t = report.totals;
  const rowsEntrega = report.entregadosTurno
    .map((p, i) => `<tr><td>${i + 1}</td><td>${esc(p.code)}</td><td>${fmtTime(p.deliveredAt)}</td></tr>`)
    .join('');
  const rowsPend = report.pendientes
    .map((p) => `<tr><td>${esc(p.code)}</td><td>${fmtTime(p.arrivedAt)}</td></tr>`)
    .join('');
  const rowsSinLlegar = report.sinLlegar.map((p) => `<tr><td>${esc(p.code)}</td></tr>`).join('');

  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Reporte de turno - Chile Express</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;margin:24px;color:#111;max-width:760px}
  h1{font-size:20px;margin:0 0 4px} h2{font-size:15px;margin:22px 0 8px;border-bottom:1px solid #ddd;padding-bottom:4px}
  .meta{font-size:13px;color:#444;line-height:1.6}
  .grid{display:flex;flex-wrap:wrap;gap:10px;margin:14px 0}
  .card{flex:1;min-width:120px;border:1px solid #e5e7eb;border-radius:10px;padding:10px 12px}
  .card .n{font-size:24px;font-weight:700} .card .l{font-size:12px;color:#666}
  .green{color:#16a34a} .amber{color:#b45309}
  table{width:100%;border-collapse:collapse;font-size:13px} th,td{border:1px solid #e5e7eb;padding:5px 8px;text-align:left}
  th{background:#f8fafc}
  .firma{margin-top:28px} .firma img{border:1px solid #ccc;border-radius:8px;max-width:340px;background:#fff}
  .sign-line{margin-top:8px;font-size:13px}
  @media print{button{display:none}}
  button{margin:0 0 16px;padding:10px 16px;border:0;border-radius:8px;background:#e2231a;color:#fff;font-size:14px;cursor:pointer}
</style></head><body>
<button onclick="window.print()">Imprimir / Guardar PDF</button>
<h1>Reporte de turno &mdash; Chile Express</h1>
<div class="meta">
  <div><b>Responsable:</b> ${esc(report.responsable)}</div>
  <div><b>Inicio turno:</b> ${fmtDateTime(report.startedAt)}</div>
  <div><b>Cierre turno:</b> ${fmtDateTime(report.closedAt)}</div>
</div>
<div class="grid">
  <div class="card"><div class="n">${t.total}</div><div class="l">Total en lista</div></div>
  <div class="card"><div class="n amber">${t.recibidos}</div><div class="l">Recibidos pendientes</div></div>
  <div class="card"><div class="n green">${t.entregados}</div><div class="l">Entregados (total)</div></div>
  <div class="card"><div class="n green">${t.entregadosTurno}</div><div class="l">Entregados en el turno</div></div>
  <div class="card"><div class="n">${t.sinLlegar}</div><div class="l">Sin llegar</div></div>
</div>
<h2>Entregados durante el turno (${report.entregadosTurno.length})</h2>
<table><thead><tr><th>#</th><th>Codigo</th><th>Hora entrega</th></tr></thead>
<tbody>${rowsEntrega || '<tr><td colspan="3">Sin entregas registradas.</td></tr>'}</tbody></table>
<h2>Recibidos pendientes de entrega (${report.pendientes.length})</h2>
<table><thead><tr><th>Codigo</th><th>Hora recepcion</th></tr></thead>
<tbody>${rowsPend || '<tr><td colspan="2">Ninguno.</td></tr>'}</tbody></table>
<h2>En lista sin llegar (${report.sinLlegar.length})</h2>
<table><thead><tr><th>Codigo</th></tr></thead>
<tbody>${rowsSinLlegar || '<tr><td>Ninguno.</td></tr>'}</tbody></table>
<div class="firma">
  <h2>Firma responsable de turno</h2>
  ${signatureDataUrl ? `<img src="${signatureDataUrl}" alt="firma"/>` : '<p>(Sin firma)</p>'}
  <div class="sign-line">______________________________<br>${esc(report.responsable)}</div>
</div>
</body></html>`;
}

export function reportCsv(state) {
  const rows = [['codigo', 'estado', 'origen', 'recepcion', 'entrega']];
  for (const p of Object.values(state.packages)) {
    rows.push([p.code, p.status, p.source || '', p.arrivedAt || '', p.deliveredAt || '']);
  }
  return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
}

export function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function fileStamp(iso) {
  return fmtDateForFile(iso);
}
