// SDR ROI math for the CFO Hub (Lars + Aidan, 2026-11-23): what each SDR makes the company per
// dial. Pure and import-free; tested by js/sdr-roi-math.test.mjs (node js/sdr-roi-math.test.mjs).
//
// Inputs: `days` / `leads` from the fulfillment `sdr-roi-report` fn (CRM cold_calls + billed
// cold-call lead_tracker rows), and ledger_items from this site's payroll DB for the SDR's pay.
// Cost = the commission the ledger pays on each billed lead + the SDR's base for the period.
// Ioannis's base is NOT counted: it pays his other roles (acquisition, discovery calls).

export const BASE_PAYEES = ['Marcell'];      // SDR-only payees whose base is an SDR cost
const NOT_SDRS = new Set(['Aidan']);         // dials from a founder's seat aren't an SDR's

const DAY_MS = 864e5;
const utc = (iso) => Date.parse(iso + 'T00:00:00Z');
const isoOf = (ms) => new Date(ms).toISOString().slice(0, 10);
const addDays = (iso, n) => isoOf(utc(iso) + n * DAY_MS);
const daysBetween = (a, b) => Math.round((utc(b) - utc(a)) / DAY_MS) + 1; // inclusive
const ratio = (a, b) => (b ? a / b : null);

export function periodRange(iso, p) {
  if (p === 'week') {
    const from = addDays(iso, -((new Date(utc(iso)).getUTCDay() + 6) % 7));
    return { from, to: addDays(from, 6) };
  }
  const from = iso.slice(0, 8) + '01';
  const next = new Date(utc(from)); next.setUTCMonth(next.getUTCMonth() + 1);
  return { from, to: addDays(isoOf(next.getTime()), -1) };
}

export function shiftPeriod(iso, p, dir) {
  if (p === 'week') return addDays(iso, 7 * dir);
  const d = new Date(utc(iso.slice(0, 8) + '01')); d.setUTCMonth(d.getUTCMonth() + dir);
  return isoOf(d.getTime());
}

/** Net ledger pay per lead id (source_id): live 'lead' lines plus any adjustment that reverses one. */
export function leadCosts(items) {
  const byItemId = new Map();
  const out = new Map();
  for (const it of items) {
    if (it.kind !== 'lead' || it.voided_at || !it.source_id) continue;
    byItemId.set(it.id, it.source_id);
    out.set(it.source_id, (out.get(it.source_id) || 0) + Number(it.amount));
  }
  for (const it of items) {
    if (it.kind !== 'adjustment' || it.voided_at || it.reverses_item_id == null) continue;
    const src = byItemId.get(it.reverses_item_id);
    if (src) out.set(src, out.get(src) + Number(it.amount));
  }
  return out;
}

/** A payee's base pay falling in [from, min(to, today)]: each monthly base line, pro-rated by the days of its
 *  month in range. Days after `today` haven't been worked yet, so they carry no base (the ledger writes the
 *  current month's base line on day 1). */
export function baseCost(items, payee, from, to, today = '9999-12-31') {
  if (today < to) to = today;
  let total = 0;
  for (const it of items) {
    if (it.kind !== 'base' || it.voided_at || it.payee !== payee) continue;
    const { from: mFrom, to: mTo } = periodRange(it.earned_on, 'month');
    const a = from > mFrom ? from : mFrom, b = to < mTo ? to : mTo;
    if (a > b) continue;
    total += Number(it.amount) * daysBetween(a, b) / daysBetween(mFrom, mTo);
  }
  return Math.round(total * 100) / 100;
}

/** One row per SDR with activity in [from, to]. baseOf(setter) → base cost for the range. */
export function sdrRoi({ days, leads, costByLead, baseOf, from, to }) {
  const inRange = (d) => d >= from && d <= to;
  const rows = new Map();
  const row = (setter) => {
    if (!rows.has(setter)) rows.set(setter, { setter, dials: 0, connects: 0, meetings: 0, billed: 0, revenue: 0, commission: 0, unpaidLeads: 0 });
    return rows.get(setter);
  };
  for (const d of days) {
    if (NOT_SDRS.has(d.setter) || !inRange(d.day)) continue;
    const r = row(d.setter);
    r.dials += d.dials; r.connects += d.connects; r.meetings += d.meetings;
  }
  for (const l of leads) {
    if (NOT_SDRS.has(l.setter) || !inRange(l.day)) continue;
    const r = row(l.setter);
    r.billed++; r.revenue += l.price;
    if (costByLead.has(l.id)) r.commission += costByLead.get(l.id); else r.unpaidLeads++;
  }
  return [...rows.values()].sort((a, b) => a.setter.localeCompare(b.setter)).map((r) => {
    const base = baseOf(r.setter);
    const cost = r.commission + base;
    const profit = r.revenue - cost;
    return {
      ...r, base, cost, profit,
      unbilled: Math.max(0, r.meetings - r.billed),
      revenuePerDial: ratio(r.revenue, r.dials), costPerDial: ratio(cost, r.dials), profitPerDial: ratio(profit, r.dials),
      costPerMeeting: ratio(cost, r.meetings),
    };
  });
}
