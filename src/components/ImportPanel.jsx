import { useMemo, useState } from 'react';
import { parseCodes, readFileAsText } from '../lib/parseCodes.js';

export default function ImportPanel({ dispatch, onClose }) {
  const [text, setText] = useState('');
  const [done, setDone] = useState(null);

  const codes = useMemo(() => parseCodes(text), [text]);

  async function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const content = await readFileAsText(file);
    setText((prev) => (prev ? prev + '\n' : '') + content);
  }

  function doImport() {
    if (codes.length === 0) return;
    dispatch({ type: 'IMPORT', codes });
    setDone(codes.length);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Importar lista de Chile Express</h2>
        <p className="muted">
          Pega los codigos (sirve la hoja oficio a dos columnas, separados por espacios, comas o saltos de linea)
          o sube un archivo .csv / .txt. Detectamos los codigos automaticamente.
        </p>
        <label className="file-label">
          Subir archivo
          <input type="file" accept=".csv,.txt,text/*" onChange={onFile} />
        </label>
        <textarea
          className="import-text"
          placeholder={'12345678  87654321\n23456789  98765432\n...'}
          value={text}
          onChange={(e) => { setText(e.target.value); setDone(null); }}
        />
        <div className="import-foot">
          <span className="muted">{codes.length} codigos detectados</span>
          <div className="row-gap">
            <button className="btn btn--ghost" onClick={onClose}>Cerrar</button>
            <button className="btn btn--primary" disabled={codes.length === 0} onClick={doImport}>
              Importar
            </button>
          </div>
        </div>
        {done != null && <p className="ok-msg">Listo: {done} codigos agregados a la lista.</p>}
      </div>
    </div>
  );
}
