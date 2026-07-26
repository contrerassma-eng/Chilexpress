/**
 * Exportacion a CSV.
 *
 * Separador punto y coma y BOM al inicio: es lo que abre bien Excel en español
 * sin tener que importar nada a mano.
 */

function campo(valor) {
  const s = String(valor ?? '');
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function armarCsv(cabeceras, filas) {
  const lineas = [cabeceras.map(campo).join(';')];
  for (const fila of filas) lineas.push(fila.map(campo).join(';'));
  return `﻿${lineas.join('\r\n')}\r\n`;
}

export function descargarCsv(nombre, cabeceras, filas) {
  const csv = armarCsv(cabeceras, filas);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Safari necesita que el blob siga vivo un momento tras el click.
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function marcaDeTiempo(iso) {
  const d = iso ? new Date(iso) : new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}
