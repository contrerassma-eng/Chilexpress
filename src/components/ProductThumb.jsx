import { useEffect, useState } from 'react';
import { fetchProductImage } from '../lib/productImage.js';

// Miniatura de un producto a partir de su codigo de barra. Busca la foto en
// Open Food Facts (cacheada). Si no hay codigo o no hay foto, muestra un
// placeholder con la inicial del producto.
export default function ProductThumb({ barcode, name }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    let alive = true;
    setUrl(null);
    if (barcode) {
      fetchProductImage(barcode).then((r) => {
        if (alive && r?.url) setUrl(r.url);
      });
    }
    return () => { alive = false; };
  }, [barcode]);

  if (url) {
    return <img className="pthumb" src={url} alt={name || ''} loading="lazy" />;
  }
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';
  return <span className="pthumb pthumb--ph" aria-hidden="true">{initial}</span>;
}
