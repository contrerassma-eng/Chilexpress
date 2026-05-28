// Icono embebido como data URI para que la version de un solo archivo (HTML
// local) no dependa de assets externos.
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
<rect width="512" height="512" rx="96" fill="#e2231a"/>
<g fill="#ffffff">
<rect x="118" y="150" width="14" height="160"/><rect x="142" y="150" width="8" height="160"/>
<rect x="160" y="150" width="20" height="160"/><rect x="190" y="150" width="8" height="160"/>
<rect x="208" y="150" width="14" height="160"/><rect x="232" y="150" width="8" height="160"/>
<rect x="250" y="150" width="22" height="160"/><rect x="282" y="150" width="8" height="160"/>
<rect x="300" y="150" width="14" height="160"/><rect x="324" y="150" width="20" height="160"/>
<rect x="354" y="150" width="8" height="160"/><rect x="372" y="150" width="22" height="160"/>
</g>
<g transform="translate(300 330)"><circle cx="48" cy="48" r="64" fill="#16a34a"/>
<path d="M 20 50 L 40 70 L 78 28" fill="none" stroke="#ffffff" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/></g>
</svg>`;

export const ICON_DATA_URI = `data:image/svg+xml,${encodeURIComponent(SVG)}`;
