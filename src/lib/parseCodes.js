// El archivo de Chile Express trae codigos puros (sin encabezados), dispuestos
// en dos columnas dentro de una hoja oficio. Tambien se puede pegar texto libre.
// Extraemos las secuencias de digitos que parezcan codigos de barra.
const CODE_RE = /\d{6,18}/g;

export function parseCodes(text) {
  if (!text) return [];
  const found = text.match(CODE_RE) || [];
  const seen = new Set();
  const out = [];
  for (const raw of found) {
    const code = raw.trim();
    if (!seen.has(code)) {
      seen.add(code);
      out.push(code);
    }
  }
  return out;
}

export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
