import { useEffect } from 'react';

/** Panel que sube desde abajo. Se cierra con el fondo, la X o la tecla Escape. */
export default function Sheet({ titulo, subtitulo, onClose, children, footer }) {
  useEffect(() => {
    const alTeclear = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [onClose]);

  return (
    <div className="sheet-fondo" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <header className="sheet__cabecera">
          <div>
            <h2>{titulo}</h2>
            {subtitulo && <p className="sheet__sub">{subtitulo}</p>}
          </div>
          <button type="button" className="sheet__cerrar" onClick={onClose} aria-label="Cerrar">×</button>
        </header>
        <div className="sheet__cuerpo">{children}</div>
        {footer && <footer className="sheet__pie">{footer}</footer>}
      </div>
    </div>
  );
}
