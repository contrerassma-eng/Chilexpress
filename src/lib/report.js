import { STATUS } from '../state/store.jsx';
import { fmtDateForFile } from './format.js';

export function computeReport({ packages, responsable, startedAt, closedAt }) {
  const pkgs = packages || [];

  const entregados = pkgs.filter((p) => p.status === STATUS.ENTREGADO);
  const recibidos = pkgs.filter((p) => p.status === STATUS.RECIBIDO);
  const esperados = pkgs.filter((p) => p.status === STATUS.ESPERADO);

  // Entregas hechas dentro de la ventana del turno.
  const entregadosTurno = entregados.filter(
    (p) => p.deliveredAt && (!startedAt || p.deliveredAt >= startedAt)
  );

  return {
    responsable: responsable || '-',
    startedAt: startedAt || null,
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

export function buildReport(state, closedAt) {
  return computeReport({
    packages: Object.values(state.packages),
    responsable: state.shift?.responsable || '-',
    startedAt: state.shift?.startedAt || null,
    closedAt
  });
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
