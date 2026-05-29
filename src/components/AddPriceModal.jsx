import { useState } from 'react';
import { SUPERMERCADOS, CIUDADES, UNIDADES } from '../lib/catalog.js';
import { fileToCompressedDataURL } from '../lib/image.js';

// Una fila de producto dentro de la boleta.
function emptyItem() {
  return { product: '', unit: 'un', price: '' };
}

export default function AddPriceModal({ defaultCity, onClose, onSave }) {
  const [city, setCity] = useState(defaultCity || '');
  const [supermarket, setSupermarket] = useState('');
  const [photo, setPhoto] = useState(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [items, setItems] = useState([emptyItem()]);
  const [error, setError] = useState('');

  async function onPhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoBusy(true);
    setError('');
    try {
      const dataUrl = await fileToCompressedDataURL(file);
      setPhoto(dataUrl);
    } catch {
      setError('No se pudo procesar la foto. Puedes registrar los precios igual.');
    } finally {
      setPhotoBusy(false);
    }
  }

  function setItem(i, patch) {
    setItems((list) => list.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  function addRow() {
    setItems((list) => [...list, emptyItem()]);
  }
  function removeRow(i) {
    setItems((list) => (list.length === 1 ? list : list.filter((_, idx) => idx !== i)));
  }

  function submit(e) {
    e.preventDefault();
    setError('');
    if (!city.trim()) return setError('Indica la ciudad.');
    if (!supermarket.trim()) return setError('Indica el supermercado.');
    const valid = items
      .map((it) => ({
        product: it.product.trim(),
        unit: it.unit.trim(),
        price: Number(String(it.price).replace(/[^\d]/g, '')),
        supermarket: supermarket.trim(),
        city: city.trim(),
        photo
      }))
      .filter((it) => it.product && it.price > 0);
    if (valid.length === 0) return setError('Agrega al menos un producto con precio.');
    onSave(valid);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Subir boleta / precios</h2>
        <p className="muted modal-sub">
          Sube la foto de tu boleta como respaldo y registra los precios. Pronto
          el procesamiento con IA leera la boleta por ti.
        </p>

        <form onSubmit={submit}>
          {/* Foto de la boleta */}
          <label className="file-label">
            {photoBusy ? 'Procesando foto…' : photo ? 'Cambiar foto de boleta' : '📷 Foto de la boleta (opcional)'}
            <input type="file" accept="image/*" capture="environment" onChange={onPhoto} />
          </label>
          {photo && (
            <div className="boleta-preview">
              <img src={photo} alt="Boleta" />
              <button type="button" className="btn btn--sm btn--ghost" onClick={() => setPhoto(null)}>
                Quitar foto
              </button>
            </div>
          )}

          {/* Ciudad y supermercado (compartidos por toda la boleta) */}
          <div className="form-grid">
            <div>
              <label className="field-label">Ciudad</label>
              <input
                list="ciudades"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Ej: Santiago"
                autoFocus={!defaultCity}
              />
            </div>
            <div>
              <label className="field-label">Supermercado</label>
              <input
                list="supermercados"
                value={supermarket}
                onChange={(e) => setSupermarket(e.target.value)}
                placeholder="Ej: Jumbo"
              />
            </div>
          </div>

          {/* Items */}
          <label className="field-label">Productos</label>
          <div className="items">
            {items.map((it, i) => (
              <div className="item-row" key={i}>
                <input
                  className="item-prod"
                  value={it.product}
                  onChange={(e) => setItem(i, { product: e.target.value })}
                  placeholder="Producto (ej: Leche entera 1L)"
                />
                <input
                  className="item-unit"
                  list="unidades"
                  value={it.unit}
                  onChange={(e) => setItem(i, { unit: e.target.value })}
                  placeholder="un"
                />
                <input
                  className="item-price"
                  inputMode="numeric"
                  value={it.price}
                  onChange={(e) => setItem(i, { price: e.target.value })}
                  placeholder="$"
                />
                <button
                  type="button"
                  className="item-del"
                  onClick={() => removeRow(i)}
                  aria-label="Quitar producto"
                  disabled={items.length === 1}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="btn btn--sm add-row" onClick={addRow}>
            + Agregar otro producto
          </button>

          {error && <p className="err-msg">{error}</p>}

          <div className="import-foot">
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn--primary">
              Guardar precios
            </button>
          </div>
        </form>

        {/* Sugerencias compartidas */}
        <datalist id="ciudades">
          {CIUDADES.map((c) => <option key={c} value={c} />)}
        </datalist>
        <datalist id="supermercados">
          {SUPERMERCADOS.map((s) => <option key={s} value={s} />)}
        </datalist>
        <datalist id="unidades">
          {UNIDADES.map((u) => <option key={u} value={u} />)}
        </datalist>
      </div>
    </div>
  );
}
