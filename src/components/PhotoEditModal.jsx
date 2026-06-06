import { useState } from 'react';
import { fileToCompressedDataURL } from '../lib/image.js';
import { uploadUserPhoto } from '../lib/backend.js';
import { invalidateProductImage } from '../lib/productImage.js';

// Modal para subir/actualizar la foto de un producto (compartida por su EAN).
export default function PhotoEditModal({ barcode, name, onClose, onSaved }) {
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function onPick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      const dataUrl = await fileToCompressedDataURL(file, { maxSide: 600, quality: 0.7 });
      setPreview(dataUrl);
    } catch {
      setError('No se pudo procesar la imagen.');
    }
  }

  async function save() {
    if (!preview) return;
    setBusy(true);
    setError('');
    try {
      await uploadUserPhoto(barcode, preview, name);
      invalidateProductImage(barcode);
      onSaved?.(preview);
      onClose();
    } catch {
      setError('No se pudo guardar la foto. Revisa tu conexión.');
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal photo-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Foto del producto</h2>
        <p className="muted modal-sub">{name} · ⠿ {barcode}</p>

        <div className="photo-modal__preview">
          {preview
            ? <img src={preview} alt="" />
            : <span className="muted">Saca o elige una foto del producto</span>}
        </div>

        <label className="file-label">
          📷 Tomar / elegir foto
          <input type="file" accept="image/*" capture="environment" onChange={onPick} />
        </label>

        {error && <p className="err-msg">{error}</p>}

        <div className="import-foot">
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={busy}>Cancelar</button>
          <button type="button" className="btn btn--primary" onClick={save} disabled={!preview || busy}>
            {busy ? 'Guardando…' : 'Guardar foto'}
          </button>
        </div>
      </div>
    </div>
  );
}
