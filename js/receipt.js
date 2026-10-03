// Itemized receipt for a payout (or a draft of the next one). Pure: takes
// lines, returns a standalone HTML document to print or save as PDF.
export const KIND_LABELS = {
  base: 'Base pay', lead: 'Booked appointments', demo_show: 'Qualified demos',
  close_bonus: 'Close bonuses', reimbursement: 'Reimbursements', bonus: 'Bonuses', adjustment: 'Adjustments',
};
const KIND_ORDER = Object.keys(KIND_LABELS);

const money = (n) => `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const escHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export function groupByKind(items) {
  return KIND_ORDER.map((kind) => {
    const lines = items.filter((i) => i.kind === kind);
    return { kind, label: KIND_LABELS[kind], lines, total: lines.reduce((s, i) => s + Number(i.amount), 0) };
  }).filter((g) => g.lines.length);
}

export function receiptHtml({ payeeName, period, paidOn, method, reference, items, draft }) {
  const groups = groupByKind(items);
  const total = items.reduce((s, i) => s + Number(i.amount), 0);
  const row = (i) => `<tr><td>${fmtDate(i.earned_on)}</td><td>${escHtml(i.description)}${i.orig_amount ? ` <span class="m">(${i.orig_currency} ${Number(i.orig_amount).toFixed(2)} @ ${i.fx_rate})</span>` : ''}</td><td class="r">${money(i.amount)}</td></tr>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escHtml(payeeName)} — ${escHtml(period)} payout</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111827;max-width:760px;margin:32px auto;padding:0 16px;font-size:13px}
  h1{font-size:20px;margin:0}.m{color:#6b7280}.r{text-align:right;white-space:nowrap}
  .meta{display:grid;grid-template-columns:max-content 1fr;gap:4px 16px;margin:16px 0 24px}
  .sum td{padding:6px 0;border-bottom:1px solid #e5e7eb}.sum .t td{font-weight:700;font-size:15px;border-bottom:none;padding-top:10px}
  table{width:100%;border-collapse:collapse}h2{font-size:13px;margin:24px 0 6px;display:flex;justify-content:space-between}
  .items td{padding:4px 0;border-bottom:1px solid #f3f4f6;vertical-align:top}.items td:first-child{width:96px;color:#6b7280}
  .draft{background:#fef3c7;color:#92400e;padding:6px 10px;border-radius:6px;display:inline-block;margin-top:8px}
  @media print{.noprint{display:none}}
</style></head><body>
<h1>${escHtml(payeeName)} — ${escHtml(period)}</h1>
<div class="m">The Headline Theory · contractor payment</div>
${draft ? '<div class="draft">Draft — not yet paid</div>' : ''}
<div class="meta">
  ${paidOn ? `<span class="m">Paid on</span><span>${fmtDate(paidOn)}</span>` : ''}
  ${method ? `<span class="m">Method</span><span>${escHtml(method)}</span>` : ''}
  ${reference ? `<span class="m">Reference</span><span>${escHtml(reference)}</span>` : ''}
</div>
<table class="sum">
  ${groups.map((g) => `<tr><td>${g.label}${g.kind === 'lead' ? ` <span class="m">(${g.lines.length} × ${money(g.lines[0].amount)})</span>` : g.lines.length > 1 ? ` <span class="m">(${g.lines.length})</span>` : ''}</td><td class="r">${money(g.total)}</td></tr>`).join('')}
  <tr class="t"><td>Total</td><td class="r">${money(total)}</td></tr>
</table>
${groups.map((g) => `<h2><span>${g.label}</span><span>${money(g.total)}</span></h2><table class="items">${g.lines.map(row).join('')}</table>`).join('')}
<p class="noprint" style="margin-top:28px"><button onclick="print()">Print / save as PDF</button></p>
</body></html>`;
}
