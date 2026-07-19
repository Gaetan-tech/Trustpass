import { posterFor } from './poster';

// Génère une maquette de billet en SVG (rendu identique pour l'aperçu et le PNG),
// sans dépendance externe. Le QR est un visuel déterministe (maquette, non scannable).

export interface TicketMockupData {
  eventName: string;
  venue?: string;
  dateLabel?: string;
  holderName?: string;
  category?: string;
  reference: string;
  seed?: string; // graine du dégradé/emoji (défaut : eventName)
  photoDataUrl?: string; // photo de l'événement embarquée (data URI) en fond
}

const W = 900;
const H = 340;

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Découpe un titre en <= maxLines lignes d'au plus ~maxChars caractères.
function wrap(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const candidate = cur ? `${cur} ${w}` : w;
    if (candidate.length > maxChars && cur) {
      lines.push(cur);
      cur = w;
      if (lines.length === maxLines) break;
    } else {
      cur = candidate;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  if (lines.length === 0) lines.push(text.slice(0, maxChars));
  const last = lines[lines.length - 1]!;
  if (last.length > maxChars) lines[lines.length - 1] = `${last.slice(0, maxChars - 1)}…`;
  return lines;
}

// Matrice pseudo-QR déterministe (maquette) avec motifs de repérage aux coins.
function qrMatrix(ref: string, n = 21): boolean[][] {
  const seed = hash(ref) || 1;
  let x = seed;
  const rnd = () => {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    return x / 0x7fffffff;
  };
  const m: boolean[][] = Array.from({ length: n }, () => Array<boolean>(n).fill(false));
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) m[r]![c] = rnd() > 0.5;
  // Motifs de repérage 7x7 aux 3 coins.
  const finder = (or: number, oc: number) => {
    for (let r = 0; r < 7; r++)
      for (let c = 0; c < 7; c++) {
        const edge = r === 0 || r === 6 || c === 0 || c === 6;
        const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        m[or + r]![oc + c] = edge || core;
      }
  };
  finder(0, 0);
  finder(0, n - 7);
  finder(n - 7, 0);
  return m;
}

export function buildTicketSvg(d: TicketMockupData): string {
  const { from, to, emoji } = posterFor(d.seed || d.eventName || 'trustpass');
  const PW = 592; // largeur du panneau gauche (photo)
  const nameLines = wrap(d.eventName || 'Événement', 18, 2);
  const lineH = 38;
  const metaY = 300;
  const nameBottom = metaY - 26; // baseline de la dernière ligne
  const nameSvg = nameLines
    .map(
      (l, i) =>
        `<text x="44" y="${nameBottom - (nameLines.length - 1 - i) * lineH}" class="title">${esc(l)}</text>`,
    )
    .join('');

  // QR
  const n = 21;
  const qr = qrMatrix(d.reference || 'TP');
  const qrSize = 120;
  const cell = qrSize / n;
  const qrX = 690;
  const qrY = 84;
  let qrRects = '';
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++)
      if (qr[r]![c])
        qrRects += `<rect x="${(qrX + c * cell).toFixed(2)}" y="${(qrY + r * cell).toFixed(2)}" width="${cell.toFixed(2)}" height="${cell.toFixed(2)}"/>`;

  // Barres d'égaliseur (accent violet) près du bandeau BILLET.
  const bars = [16, 26, 12, 30, 20]
    .map((h, i) => `<rect x="${152 + i * 10}" y="${58 - h}" width="6" height="${h}" rx="3" fill="#7c3aed"/>`)
    .join('');

  const catChip = d.category
    ? `<g><rect x="620" y="286" rx="10" width="${Math.min(240, 40 + d.category.length * 9)}" height="26" fill="#ede9fe" stroke="#ddd6fe"/><text x="632" y="304" class="chip">${esc(d.category)}</text></g>`
    : '';

  // Fond du panneau gauche : photo embarquée si dispo, sinon dégradé + emoji.
  const leftBg = d.photoDataUrl
    ? `<image href="${d.photoDataUrl}" x="8" y="8" width="${PW}" height="${H - 16}" preserveAspectRatio="xMidYMid slice"/>`
    : `<rect x="8" y="8" width="${PW}" height="${H - 16}" fill="url(#g)"/><text x="300" y="150" text-anchor="middle" class="emoji" opacity="0.85">${emoji}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Poppins, system-ui, sans-serif">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>
    </linearGradient>
    <!-- Voile encre pour lisibilité + soupçon de violet en bas. -->
    <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="rgba(10,10,10,0.05)"/>
      <stop offset="0.45" stop-color="rgba(10,10,10,0.35)"/>
      <stop offset="1" stop-color="rgba(10,10,10,0.9)"/>
    </linearGradient>
    <clipPath id="card"><rect x="8" y="8" width="${W - 16}" height="${H - 16}" rx="24"/></clipPath>
    <style>
      .title{fill:#fff;font-size:34px;font-weight:800}
      .meta{fill:rgba(255,255,255,0.92);font-size:16px;font-weight:500}
      .kicker{fill:#fff;font-size:12px;font-weight:800;letter-spacing:2px}
      .brand{fill:#7c3aed;font-size:16px;font-weight:800;letter-spacing:0.5px}
      .label{fill:#71717a;font-size:11px;font-weight:700;letter-spacing:1.5px}
      .value{fill:#0a0a0a;font-size:18px;font-weight:700}
      .ref{fill:#52525b;font-size:13px;font-family:monospace}
      .chip{fill:#7c3aed;font-size:13px;font-weight:700}
      .emoji{font-size:120px}
    </style>
  </defs>
  <g clip-path="url(#card)">
    <rect x="8" y="8" width="${W - 16}" height="${H - 16}" fill="#ffffff"/>
    <!-- Panneau gauche : photo de l'événement + voile encre -->
    ${leftBg}
    <rect x="8" y="8" width="${PW}" height="${H - 16}" fill="url(#shade)"/>
    <!-- Bandeau BILLET (accent violet) + égaliseur -->
    <rect x="44" y="34" rx="14" width="92" height="28" fill="#7c3aed"/>
    <text x="60" y="53" class="kicker">BILLET</text>
    ${bars}
    ${nameSvg}
    <text x="44" y="${metaY}" class="meta">${esc([d.venue, d.dateLabel].filter(Boolean).join('  ·  ') || 'TrustPass')}</text>
    <!-- Perforation -->
    <line x1="612" y1="24" x2="612" y2="${H - 24}" stroke="#d4d4d8" stroke-width="2" stroke-dasharray="6 7"/>
    <circle cx="612" cy="8" r="14" fill="#ffffff"/>
    <circle cx="612" cy="${H - 8}" r="14" fill="#ffffff"/>
    <!-- Stub droit (blanc, accents violets) -->
    <text x="620" y="52" class="brand">TrustPass</text>
    <text x="620" y="72" class="label">REVENTE VÉRIFIÉE</text>
    <rect x="${qrX - 6}" y="${qrY - 6}" width="${qrSize + 12}" height="${qrSize + 12}" rx="8" fill="#fff" stroke="#e4e4e7"/>
    <g fill="#0a0a0a">${qrRects}</g>
    ${d.holderName ? `<text x="620" y="${qrY + qrSize + 30}" class="label">PORTEUR</text><text x="620" y="${qrY + qrSize + 52}" class="value">${esc(d.holderName)}</text>` : ''}
    ${catChip}
    <text x="620" y="${H - 18}" class="ref">${esc(d.reference || '—')}</text>
  </g>
  <rect x="8" y="8" width="${W - 16}" height="${H - 16}" rx="24" fill="none" stroke="#e4e4e7" stroke-width="1.5"/>
</svg>`;
}

// Rasterise le SVG en PNG (dataURL) via canvas, sans dépendance externe.
export function svgToPngDataUrl(svg: string, scale = 2): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = W * scale;
      canvas.height = H * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('canvas indisponible'));
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, W, H);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('rendu SVG impossible'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
