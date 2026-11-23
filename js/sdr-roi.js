// ═══════════════════════════════════════════════════════════
// SDR ROI — CFO Hub view (founders only): what each SDR makes us per dial (Lars + Aidan,
// 2026-11-23, from the Leevi call: "dollars per dial" is the number to manage SDRs on).
// Activity + billed leads: fulfillment `sdr-roi-report` fn (founder-gated server-side).
// Pay: this site's payroll ledger. Math: sdr-roi-math.js. $/hour waits on hours from the
// SDR's EOD report (#standard-work-checklist) — shown as coming soon.
// ═══════════════════════════════════════════════════════════
import { sbPayroll as supabase } from './supabase.js?v=cffb16a';
import { state, render } from './cfo-shell.js?v=cffb16a';
import { esc } from './utils.js?v=cffb16a';
import { periodRange, shiftPeriod, leadCosts, baseCost, sdrRoi, BASE_PAYEES } from './sdr-roi-math.js?v=cffb16a';

const FN_URL = 'https://zrmobsgcfcloufajemxj.supabase.co/functions/v1/sdr-roi-report';
const LEDGER_COLS = 'id,payee,kind,source_id,amount,earned_on,voided_at,reverses_item_id';
const PAGE = 1000;
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

async function fetchReport(){
  const { data: { session } } = await supabase.auth.getSession();
  if(!session) throw new Error('Your session expired. Reload the page and sign in again.');
  const resp = await fetch(FN_URL, { method:'POST', body:'{}',
    headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer '+session.access_token } });
  const data = await resp.json().catch(()=>({ error:'sdr-roi-report returned a non-JSON response ('+resp.status+')' }));
  if(!resp.ok || data.error) throw new Error(data.error || ('sdr-roi-report failed ('+resp.status+')'));
  return data;
}

// Every lead / base / adjustment line, past PostgREST's 1000-row cap.
async function fetchLedger(){
  const rows = [];
  for(let from = 0; ; from += PAGE){
    const { data, error } = await supabase.from('ledger_items').select(LEDGER_COLS)
      .in('kind', ['lead','base','adjustment']).order('id').range(from, from + PAGE - 1);
    if(error) throw new Error(error.message);
    rows.push(...(data || []));
    if((data || []).length < PAGE) return rows;
  }
}

function load(){
  if(state.sdrRoiLoading || state.sdrRoi) return;
  state.sdrRoiLoading = true; state.sdrRoiError = null;
  Promise.all([fetchReport(), fetchLedger()])
    .then(([report, ledger]) => { state.sdrRoi = { report, ledger, costByLead: leadCosts(ledger) }; })
    .catch(err => { state.sdrRoiError = err.message || String(err); })
    .finally(() => { state.sdrRoiLoading = false; render(); });
}

const usd = (n, d = 0) => n == null ? '—' : (n < 0 ? '−$' : '$') + Math.abs(n).toLocaleString('en-US',{ minimumFractionDigits:d, maximumFractionDigits:d });
const int = n => Number(n || 0).toLocaleString('en-US');
const pct = (a, b) => b ? Math.round(100 * a / b) + '%' : '—';
const fmtDay = iso => { const [,m,d] = iso.split('-'); return MONTHS[Number(m)-1]+' '+Number(d); };
const periodLabel = (p, { from, to }) => p === 'month' ? MONTHS[Number(from.slice(5,7))-1]+' '+from.slice(0,4) : 'Week of '+fmtDay(from)+' – '+fmtDay(to);
const todayIso = () => { const d = new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); };

// [label, value(row), emphasis?] — output first, then money, then the per-dial headline.
const METRICS = [
  ['Dials', r => int(r.dials)],
  ['Connects', r => `${int(r.connects)} <span style="color:var(--text-muted)">(${pct(r.connects, r.dials)})</span>`],
  ['Meetings booked', r => int(r.meetings)],
  ['  billed (pay-per-meeting)', r => int(r.billed)],
  ['  retainer / not billed', r => int(r.unbilled)],
  ['Revenue billed', r => usd(r.revenue)],
  ['SDR cost', r => `${usd(r.cost)} <span style="color:var(--text-muted)">(${usd(r.commission)} commission${r.base ? ' + '+usd(r.base)+' base' : ''})</span>`],
  ['Profit', r => `<span style="color:${r.profit < 0 ? '#dc2626' : '#15803d'}">${usd(r.profit)}</span>`],
  ['Revenue per dial', r => usd(r.revenuePerDial, 2)],
  ['Cost per dial', r => usd(r.costPerDial, 2)],
  ['Cost per meeting', r => usd(r.costPerMeeting, 2)],
  ['Profit per dial', r => `<span style="font-size:18px;font-weight:800;color:${r.profitPerDial == null ? '#9ca3af' : r.profitPerDial < 0 ? '#dc2626' : '#15803d'}">${usd(r.profitPerDial, 2)}</span>`, true],
  ['Profit per hour', () => '<span style="color:#cbd5e1" title="Needs hours from the SDR EOD report">Coming soon</span>'],
];

function table(rows){
  const th = 'padding:8px 12px;text-align:right;font-size:12px;font-weight:700';
  const td = 'padding:7px 12px;text-align:right;font-size:13px;border-top:1px solid var(--border)';
  return `<div style="background:#fff;border:1px solid var(--border);border-radius:10px;overflow-x:auto"><table style="width:100%;border-collapse:collapse">
    <tr><th style="${th};text-align:left"></th>${rows.map(r => `<th style="${th}">${esc(r.setter)}</th>`).join('')}</tr>
    ${METRICS.map(([label, val, strong]) => `<tr${strong ? ' style="background:#f0fdf4"' : ''}>
      <td style="${td};text-align:left;color:var(--text-muted);white-space:pre;${strong ? 'font-weight:700;color:#111827' : ''}">${esc(label)}</td>
      ${rows.map(r => `<td style="${td}">${val(r)}</td>`).join('')}</tr>`).join('')}
  </table></div>`;
}

export function renderSdrRoiTab(){
  load();
  const p = state.sdrRoiPeriod === 'week' ? 'week' : 'month';
  const anchor = state.sdrRoiAnchor || todayIso();
  const range = periodRange(anchor, p);
  const btn = (on, label, onclick) => `<button onclick="${onclick}" style="font-size:12px;font-weight:600;padding:5px 12px;border-radius:999px;border:1px solid var(--border);cursor:pointer;background:${on?'#111827':'#fff'};color:${on?'#fff':'#374151'}">${label}</button>`;
  let html = `<div style="padding:0 20px 24px;max-width:960px">
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px">
      ${btn(p==='week','Week',"sdrRoiPeriod('week')")}${btn(p==='month','Month',"sdrRoiPeriod('month')")}
      <span style="width:6px"></span>${btn(false,'‹','sdrRoiShift(-1)')}
      <span style="font-size:13px;font-weight:600;min-width:170px;text-align:center">${esc(periodLabel(p, range))}</span>${btn(false,'›','sdrRoiShift(1)')}
    </div>
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:12px">What each SDR makes us every time they click dial. Meetings and revenue count on the day booked.</div>`;
  if(state.sdrRoiError) return html + `<div style="color:#dc2626;font-size:13px">Couldn't load SDR ROI: ${esc(state.sdrRoiError)} <button class="btn btn-ghost" onclick="sdrRoiReload()">Retry</button></div></div>`;
  if(!state.sdrRoi) return html + `<div style="color:var(--text-muted);font-size:13px">Loading…</div></div>`;
  const { report, ledger, costByLead } = state.sdrRoi;
  const rows = sdrRoi({ days: report.days, leads: report.leads, costByLead, from: range.from, to: range.to,
    baseOf: s => BASE_PAYEES.includes(s) ? baseCost(ledger, s, range.from, range.to, todayIso()) : 0 });
  html += rows.length ? table(rows) : `<div style="color:var(--text-muted);font-size:13px">No SDR dials or bookings in this period.</div>`;
  const unpaid = rows.reduce((n, r) => n + r.unpaidLeads, 0);
  html += `<div style="font-size:11px;color:var(--text-muted);margin-top:8px;line-height:1.6">
    Revenue = the price of each billed cold-call meeting in the Lead Tracker (called back and removed disputes excluded; retainer meetings bill nothing per meeting, so they're counted, not priced).
    Cost = the commission the payroll ledger pays on those meetings, plus base for SDR-only roles (${esc(BASE_PAYEES.join(', '))}; a week gets its share of the month). Ioannis's base isn't counted: it pays his other roles.
    ${unpaid ? `<b style="color:#b45309">${unpaid} billed meeting${unpaid===1?' has':'s have'} no ledger line yet, so ${unpaid===1?'its':'their'} commission isn't in cost.</b>` : ''}
    Data from ${esc(report.floor)} · updated ${esc(new Date(report.generated_at).toLocaleString())}.</div></div>`;
  return html;
}

window.sdrRoiPeriod = (v) => { state.sdrRoiPeriod = v; render(); };
window.sdrRoiShift = (d) => { const p = state.sdrRoiPeriod === 'week' ? 'week' : 'month'; state.sdrRoiAnchor = shiftPeriod(state.sdrRoiAnchor || todayIso(), p, d); render(); };
window.sdrRoiReload = () => { state.sdrRoi = null; state.sdrRoiError = null; render(); };
