import { useState } from 'react';
import { SUPERMERCADOS, CIUDADES, UNIDADES } from '../lib/catalog.js';
import { fileToCompressedDataURL } from '../lib/image.js';
import { ocrImage } from '../lib/ocr.js';
import { parseReceipt } from '../lib/receiptParser.js';

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
  const [saving, setSaving] = useState(false);
  // Estado del escaneo OCR: idle | reading | done
  const [scan, setScan] = useState({ status: 'idle', progress: 0, found: 0 });

  // Lee la foto, corre OCR + parser y prellena los campos (todo editable).
  async function onPhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoBusy(true);
    setError('');
    setScan({ status: 'idle', progress: 0, found: 0 });
    let dataUrl = null;
    try {
      dataUrl = await fileToCompressedDataURL(file);
      setPhoto(dataUrl);
    } catch {
      setError('No se pudo procesar la foto. Puedes registrar los precios igual.');
      setPhotoBusy(false);
      return;
    }
    setPhotoBusy(false);

    // Escaneo OCR sobre la imagen ya comprimida.
    setScan({ status: 'reading', progress: 0, found: 0 });
    try {
      const text = await ocrImage(dataUrl, (p) =>
        setScan((s) => ({ ...s, progress: Math.round(p * 100) }))
      );
      const parsed = parseReceipt(text);
      // Prellenamos solo los campos vacios para no pisar lo que el usuario ya
      // haya escrito a mano.
      if (parsed.supermarket && !supermarket.trim()) setSupermarket(parsed.supermarket);
      if (parsed.city && !city.trim()) setCity(parsed.city);
      if (parsed.items.length > 0) {
        setItems(parsed.items.map((it) => ({
          product: it.product,
          unit: it.unit || 'un',
          price: String(it.price || '')
        })));
      }
      setScan({ status: 'done', progress: 100, found: parsed.items.length });
    } catch {
      setScan({ status: 'idle', progress: 0, found: 0 });
      setError('No se pudo leer la boleta automaticamente. Ingresa los precios a mano.');
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

  async function submit(e) {
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
    setSaving(true);
    try {
      await onSave(valid);
    } catch {
      setError('No se pudieron guardar los precios. Revisa tu conexion e intenta de nuevo.');
      setSaving(false);
    }
  }

  const scanning = scan.status === 'reading';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Subir boleta / precios</h2>
        <p className="muted modal-sub">
          Saca una foto de tu boleta: la app la lee y rellena los precios por ti.
          Revisa y corrige lo que haga falta antes de guardar.
        </p>

        <form onSubmit={submit}>
          {/* Foto de la boleta + OCR */}
          <label className="file-label">
            {photoBusy
              ? 'Procesando foto…'
              : photo
                ? '📷 Volver a escanear boleta'
                : '📷 Escanear boleta con la cámara'}
            <input type="file" accept="image/*" capture="environment" onChange={onPhoto} disabled={scanning} />
          </label>

          {scanning && (
            <div className="scan-status">
              <div className="scan-bar"><span style={{ width: `${scan.progress}%` }} /></div>
              <span className="muted">Leyendo boleta… {scan.progress}%</span>
            </div>
          )}
          {scan.status === 'done' && (
            <p className="ok-msg">
              {scan.found > 0
                ? `Leí ${scan.found} ${scan.found === 1 ? 'producto' : 'productos'}. Revisa y corrige si hace falta.`
                : 'No pude detectar productos automáticamente. Ingrésalos a mano.'}
            </p>
          )}

          {photo && (
            <div className="boleta-preview">
              <img src={photo} alt="Boleta" />
              <button type="button" className="btn btn--sm btn--ghost" onClick={() => { setPhoto(null); setScan({ status: 'idle', progress: 0, found: 0 }); }}>
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
            <button type="button" className="btn btn--ghost" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="btn btn--primary" disabled={saving || scanning}>
              {saving ? 'Guardando…' : 'Guardar precios'}
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
