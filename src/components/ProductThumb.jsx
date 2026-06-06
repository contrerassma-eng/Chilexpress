import { useEffect, useState } from 'react';
import { fetchProductImage } from '../lib/productImage.js';

// Miniatura de un producto a partir de su codigo de barra. Busca primero la
// foto subida por usuarios (compartida) y, si no hay, una referencial de Open
// Food Facts. Sin codigo o sin foto, muestra un placeholder con la inicial.
// Al tocarla, si hay onEdit, permite actualizar la foto.
export default function ProductThumb({ barcode, name, onEdit }) {
  const [img, setImg] = useState(null); // { url, source }

  useEffect(() => {
    let alive = true;
    setImg(null);
    if (barcode) {
      fetchProductImage(barcode).then((r) => {
        if (alive && r?.url) setImg(r);
      });
    }
    return () => { alive = false; };
  }, [barcode]);

  const clickable = !!(onEdit && barcode);
  const cls = 'pthumb' + (clickable ? ' pthumb--btn' : '');

  const inner = img?.url
    ? <img className="pthumb__img" src={img.url} alt={name || ''} loading="lazy" />
    : <span className="pthumb__ph" aria-hidden="true">{(name || '?').trim().charAt(0).toUpperCase() || '?'}</span>;

  if (!clickable) {
    return <span className={cls}>{inner}{img?.source === 'off' && <span className="pthumb__ref" title="Foto referencial">ref</span>}</span>;
  }
  return (
    <button
      type="button"
      className={cls}
      onClick={(e) => { e.stopPropagation(); onEdit(); }}
      title={img ? 'Actualizar foto' : 'Agregar foto'}
    >
      {inner}
      {img?.source === 'off' && <span className="pthumb__ref">ref</span>}
      <span className="pthumb__edit">📷</span>
    </button>
  );
}
