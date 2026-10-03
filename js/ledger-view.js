// The payroll screen: what is owed, what was paid, and the extras form.
// Pay is never typed — the payout total is the sum of the lines it takes.
import { esc, showToast } from './utils.js?v=1a289eb';
import {
  syncFromCrm, loadUnpaid, loadPayouts, loadPayoutItems, recordPayout,
  addManualItem, uploadReceipt, receiptUrl, voidItem,
} from './ledger-data.js?v=1a289eb';
import { receiptHtml, groupByKind } from './receipt.js?v=1a289eb';

const PAYEE_NAME = 'Ioannis Serafeim';
const MANUAL_KINDS = { reimbursement: 'Reimbursement', bonus: 'Bonus', adjustment: 'Adjustment' };

const money = (n) => `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const sum = (items) => Math.round(items.reduce((s, i) => s + Number(i.amount), 0) * 100) / 100;
const todayIso = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
function lastDayOfPrevMonth() {
  const [y, m] = todayIso().split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 0)).toISOString().slice(0, 10);
}
const view = { loading: true, error: '', unpaid: [], payouts: [], cutoff: lastDayOfPrevMonth(), open: new Set() };
const periodLabel = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const due = () => view.unpaid.filter((i) => i.earned_on <= view.cutoff);
const later = () => view.unpaid.filter((i) => i.earned_on > view.cutoff);

function paint() { document.getElementById('app').innerHTML = renderLedger(); }

export async function refreshLedger({ sync = true } = {}) {
  view.loading = true; paint();
  try {
    if (sync) await syncFromCrm();
    [view.unpaid, view.payouts] = await Promise.all([loadUnpaid(), loadPayouts()]);
    view.error = '';
  } catch (e) {
    view.error = e.message;
  }
  view.loading = false; paint();
}

function openReceipt(opts) {
  const w = window.open('', '_blank');
  w.document.write(receiptHtml({ payeeName: PAYEE_NAME, ...opts }));
  w.document.close();
}

// ─── Render ───
function lineRow(i, { canVoid }) {
  const receipt = i.receipt_path ? ` <a href="#" onclick="ledgerOpenReceiptFile('${i.receipt_path}');return false">receipt</a>` : '';
  const voidBtn = canVoid && !i.source_id && !i.reverses_item_id
    ? ` <button class="btn btn-ghost" style="color:#dc2626;font-size:11px" onclick="ledgerVoid('${i.id}')">void</button>` : '';
  return `<tr><td style="width:100px;color:var(--text-muted)">${i.earned_on}</td><td>${esc(i.description)}${receipt}${voidBtn}</td><td style="text-align:right">${money(i.amount)}</td></tr>`;
}

function groupsTable(items, { canVoid, keyPrefix }) {
  return groupByKind(items).map((g) => {
    const key = `${keyPrefix}:${g.kind}`;
    const isOpen = view.open.has(key);
    return `<tr style="cursor:pointer;background:#f9fafb" onclick="ledgerToggle('${key}')">
        <td colspan="2"><b>${isOpen ? '▾' : '▸'} ${g.label}</b> <span style="color:var(--text-muted)">${g.lines.length} line${g.lines.length > 1 ? 's' : ''}</span></td>
        <td style="text-align:right;font-weight:600">${money(g.total)}</td></tr>
      ${isOpen ? g.lines.map((i) => lineRow(i, { canVoid })).join('') : ''}`;
  }).join('');
}

function renderDue() {
  const items = due();
  const total = sum(items);
  return `<section class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
      <h2 style="margin:0;font-size:16px">Next payout — ${esc(PAYEE_NAME)}</h2>
      <label style="font-size:12px;color:var(--text-muted)">Work up to
        <input type="date" value="${view.cutoff}" onchange="ledgerSetCutoff(this.value)" style="padding:4px 6px;border:1px solid var(--border);border-radius:6px"></label>
    </div>
    <div style="font-size:30px;font-weight:700;color:var(--purple);margin:12px 0">${money(total)}</div>
    ${items.length ? `<table>${groupsTable(items, { canVoid: true, keyPrefix: 'due' })}</table>
      <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">
        <button class="btn" onclick="ledgerDraftReceipt()">Itemized receipt (draft)</button>
        <button class="btn btn-primary" onclick="ledgerShowRecord()">Record payout sent…</button>
      </div>` : '<p style="color:var(--text-muted)">Nothing owed up to this date.</p>'}
    ${later().length ? `<p style="font-size:12px;color:var(--text-muted);margin-top:12px">${later().length} lines (${money(sum(later()))}) earned after ${view.cutoff} wait for the next payout.</p>` : ''}
    <div id="ledger-record"></div>
  </section>`;
}

function renderManualForm() {
  return `<section class="card">
    <h2 style="margin:0 0 10px;font-size:15px">Add reimbursement, bonus or adjustment</h2>
    <div class="grid">
      <label>Type<select id="mi-kind">${Object.entries(MANUAL_KINDS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
      <label>Date incurred<input id="mi-date" type="date" value="${todayIso()}"></label>
      <label style="grid-column:1/-1">Description<input id="mi-desc" placeholder="e.g. Portable monitor — Amazon order 402-…"></label>
      <label>Amount in USD<input id="mi-usd" type="number" step="0.01" placeholder="negative to deduct"></label>
      <label>…or original amount<input id="mi-orig" type="number" step="0.01" oninput="ledgerFx()"></label>
      <label>Currency<input id="mi-cur" placeholder="EUR" maxlength="3" style="text-transform:uppercase"></label>
      <label>Rate to USD<input id="mi-rate" type="number" step="0.000001" oninput="ledgerFx()"></label>
      <label style="grid-column:1/-1">Receipt (optional)<input id="mi-file" type="file" accept="image/*,application/pdf"></label>
    </div>
    <button class="btn btn-primary" style="margin-top:10px" onclick="ledgerAddManual()">Add line</button>
  </section>`;
}

function renderHistory() {
  return `<section class="card">
    <h2 style="margin:0 0 10px;font-size:15px">Payouts sent</h2>
    <table><thead><tr><th>Paid on</th><th>Period</th><th>Reference</th><th style="text-align:right">Amount</th><th></th></tr></thead>
    <tbody>${view.payouts.map((p) => `<tr>
      <td>${p.paid_on}</td><td>${esc(p.period)}</td><td style="color:var(--text-muted)">${esc(p.method)} · ${esc(p.reference || '—')}</td>
      <td style="text-align:right;font-weight:600">${money(p.amount)}</td>
      <td style="text-align:right"><button class="btn btn-ghost" onclick="ledgerPayoutReceipt('${p.id}')">Receipt</button></td></tr>
      ${p.notes ? `<tr><td></td><td colspan="4" style="font-size:11px;color:var(--text-muted);border-top:none">${esc(p.notes)}</td></tr>` : ''}`).join('')}</tbody></table>
    <p style="font-size:11px;color:var(--text-muted);margin-top:8px">Payments before August 2026 are in the legacy employee_payments table.</p>
  </section>`;
}

export function renderLedger() {
  if (view.loading) return '<div style="text-align:center;padding:60px;color:var(--text-muted)">Syncing with the CRM…</div>';
  return `<div style="max-width:860px;margin:0 auto">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <h1 style="margin:0;font-size:20px">Payroll</h1>
      <button class="btn" onclick="ledgerRefresh()">Sync with CRM</button>
    </div>
    ${view.error ? `<div class="card" style="color:#dc2626">${esc(view.error)}</div>` : ''}
    ${renderDue()}${renderManualForm()}${renderHistory()}
  </div>`;
}

// ─── Handlers ───
window.ledgerRefresh = () => refreshLedger();
window.ledgerSetCutoff = (v) => { view.cutoff = v; paint(); };
window.ledgerToggle = (key) => { view.open.has(key) ? view.open.delete(key) : view.open.add(key); paint(); };
window.ledgerDraftReceipt = () => openReceipt({ period: periodLabel(view.cutoff), items: due(), draft: true });

window.ledgerPayoutReceipt = async (id) => {
  const p = view.payouts.find((x) => x.id === id);
  const items = await loadPayoutItems(id);
  if (Math.abs(sum(items) - Number(p.amount)) > 0.005) {
    showToast(`Pre-ledger payout: only ${money(sum(items))} of ${money(p.amount)} is itemized — see its notes`, 'warning');
  }
  openReceipt({ period: p.period, paidOn: p.paid_on, method: p.method, reference: p.reference, items });
};

window.ledgerOpenReceiptFile = async (path) => {
  try { window.open(await receiptUrl(path), '_blank'); } catch (e) { showToast(e.message); }
};

window.ledgerShowRecord = () => {
  const total = sum(due());
  document.getElementById('ledger-record').innerHTML = `<div class="grid" style="margin-top:14px;padding-top:14px;border-top:1px solid var(--border)">
    <label>Paid on<input id="rp-date" type="date" value="${todayIso()}"></label>
    <label>Method<input id="rp-method" value="HT paypal"></label>
    <label>Transaction ID<input id="rp-ref" placeholder="PayPal transaction ID"></label>
    <label>Period<input id="rp-period" value="${periodLabel(view.cutoff)}"></label>
    <label style="grid-column:1/-1">Notes<input id="rp-notes"></label>
    <button class="btn btn-primary" onclick="ledgerRecord(${total})">Record ${money(total)} as paid</button>
  </div>`;
};

window.ledgerRecord = async (expected) => {
  const val = (id) => document.getElementById(id).value.trim();
  if (!val('rp-ref')) { showToast('Add the transaction ID — it ties this record to the transfer'); return; }
  try {
    await recordPayout({ cutoff: view.cutoff, expected, paidOn: val('rp-date'), method: val('rp-method'),
      reference: val('rp-ref'), period: val('rp-period'), notes: val('rp-notes') });
    showToast(`${money(expected)} recorded`, 'success');
    refreshLedger({ sync: false });
  } catch (e) { showToast(e.message); }
};

window.ledgerFx = () => {
  const orig = parseFloat(document.getElementById('mi-orig').value);
  const rate = parseFloat(document.getElementById('mi-rate').value);
  if (orig && rate) document.getElementById('mi-usd').value = (Math.round(orig * rate * 100) / 100).toFixed(2);
};

window.ledgerAddManual = async () => {
  const val = (id) => document.getElementById(id).value.trim();
  const amount = parseFloat(val('mi-usd'));
  if (!val('mi-desc') || !amount) { showToast('Description and amount are required'); return; }
  try {
    const file = document.getElementById('mi-file').files[0];
    await addManualItem({
      kind: val('mi-kind'), description: val('mi-desc'), amount, earned_on: val('mi-date'),
      orig_amount: parseFloat(val('mi-orig')) || null, orig_currency: val('mi-cur').toUpperCase() || null,
      fx_rate: parseFloat(val('mi-rate')) || null, receipt_path: file ? await uploadReceipt(file) : null,
    });
    showToast('Line added', 'success');
    refreshLedger({ sync: false });
  } catch (e) { showToast(e.message); }
};

window.ledgerVoid = async (id) => {
  const reason = prompt('Why is this line being voided?');
  if (!reason) return;
  try { await voidItem(id, reason); refreshLedger({ sync: false }); } catch (e) { showToast(e.message); }
};

