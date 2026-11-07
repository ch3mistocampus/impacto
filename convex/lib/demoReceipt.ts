/**
 * Synthetic receipt image (SVG) for demo seed data. Clearly labelled as fictional; no real
 * supplier, tax id, person or address. Rendered by <img>, so no scripts ever run.
 */

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function fmt(n: number) {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export type DemoReceiptLine = { label: string; qty?: number; amount?: number };

export function demoReceiptSvg(opts: {
  supplier: string;
  region?: string;
  number: string;
  dateLabel: string;
  lines: DemoReceiptLine[];
  total?: number;
  currency?: string;
}): string {
  const W = 360;
  const rowH = 22;
  const top = 150;
  const H = top + opts.lines.length * rowH + 150;
  const rows = opts.lines
    .map((l, i) => {
      const y = top + i * rowH;
      return `<text x="20" y="${y}" class="m">${esc(l.qty !== undefined ? `${l.qty} × ${l.label}` : l.label)}</text>${
        l.amount !== undefined ? `<text x="${W - 20}" y="${y}" class="m" text-anchor="end">${fmt(l.amount)}</text>` : ""
      }`;
    })
    .join("");
  const totalY = top + opts.lines.length * rowH + 16;
  // Slightly rotated paper on a dark table, like a phone photo of a receipt.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="${H + 60}" viewBox="0 0 480 ${H + 60}">
<style>.m{font-family:'Courier New',Courier,monospace;font-size:13px;fill:#222}.b{font-weight:700}.s{font-family:Helvetica,Arial,sans-serif;font-size:11px;fill:#666}</style>
<rect width="480" height="${H + 60}" fill="#3d3a36"/>
<g transform="translate(60 30) rotate(-1.5 ${W / 2} ${H / 2})">
<rect x="4" y="6" width="${W}" height="${H}" fill="#000" opacity=".25"/>
<rect width="${W}" height="${H}" fill="#fbf8f1"/>
<text x="${W / 2}" y="34" class="m b" text-anchor="middle" font-size="15">${esc(opts.supplier.toUpperCase())}</text>
${opts.region ? `<text x="${W / 2}" y="54" class="m" text-anchor="middle">${esc(opts.region)}</text>` : ""}
<text x="${W / 2}" y="74" class="s" text-anchor="middle">NIT 000.000.000-0 (ficticio / fictional)</text>
<line x1="20" y1="90" x2="${W - 20}" y2="90" stroke="#999" stroke-dasharray="4 3"/>
<text x="20" y="112" class="m">FACTURA DE VENTA ${esc(opts.number)}</text>
<text x="20" y="130" class="m">${esc(opts.dateLabel)}</text>
${rows}
<line x1="20" y1="${totalY - 10}" x2="${W - 20}" y2="${totalY - 10}" stroke="#999" stroke-dasharray="4 3"/>
${opts.total !== undefined ? `<text x="20" y="${totalY + 10}" class="m b">TOTAL ${esc(opts.currency ?? "")}</text><text x="${W - 20}" y="${totalY + 10}" class="m b" text-anchor="end">${fmt(opts.total)}</text>` : ""}
<text x="${W / 2}" y="${totalY + 50}" class="m" text-anchor="middle">PAGADO · PAID</text>
<rect x="${W / 2 - 95}" y="${totalY + 66}" width="190" height="34" fill="none" stroke="#b33" stroke-width="2" transform="rotate(-4 ${W / 2} ${totalY + 83})"/>
<text x="${W / 2}" y="${totalY + 88}" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="13" font-weight="700" fill="#b33" transform="rotate(-4 ${W / 2} ${totalY + 83})">RECIBO DE DEMOSTRACIÓN</text>
</g>
<text x="12" y="${H + 50}" font-family="Helvetica,Arial,sans-serif" font-size="12" fill="#ddd">Synthetic demo receipt · datos ficticios</text>
</svg>`;
}
