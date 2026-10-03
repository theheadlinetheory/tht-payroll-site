// Data access for the payroll ledger. Every amount comes from ledger_items;
// the browser never computes pay and never reads the CRM.
import { sbPayroll } from './supabase.js?v=1a289eb';

export const PAYEE = 'Ioannis';
const ITEM_COLS = 'id,position,kind,source_id,description,amount,orig_amount,orig_currency,fx_rate,receipt_path,earned_on,payout_id,reverses_item_id,created_by,created_at';

function must({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}

// Pulls new leads, demos, closes and base lines from the CRM. Idempotent.
export async function syncFromCrm() {
  const { data, error } = await sbPayroll.functions.invoke('ledger-sync', { body: {} });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function loadUnpaid() {
  return must(await sbPayroll.from('ledger_items').select(ITEM_COLS)
    .eq('payee', PAYEE).is('payout_id', null).is('voided_at', null).order('earned_on'));
}

export async function loadPayouts() {
  return must(await sbPayroll.from('payouts').select('*').eq('payee', PAYEE).order('paid_on', { ascending: false }));
}

export async function loadPayoutItems(payoutId) {
  return must(await sbPayroll.from('ledger_items').select(ITEM_COLS).eq('payout_id', payoutId).order('earned_on'));
}

// Atomic on the server: refuses if the unpaid total moved since the screen loaded.
export async function recordPayout({ cutoff, expected, paidOn, method, reference, period, notes }) {
  return must(await sbPayroll.rpc('record_payout', {
    p_payee: PAYEE, p_cutoff: cutoff, p_expected: expected, p_paid_on: paidOn,
    p_method: method, p_reference: reference, p_period: period, p_notes: notes || null,
  }));
}

export async function uploadReceipt(file) {
  const path = `${PAYEE}/${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`;
  must(await sbPayroll.storage.from('receipts').upload(path, file));
  return path;
}

export async function receiptUrl(path) {
  return must(await sbPayroll.storage.from('receipts').createSignedUrl(path, 300)).signedUrl;
}

export async function addManualItem(item) {
  return must(await sbPayroll.from('ledger_items').insert({ payee: PAYEE, ...item }).select().single());
}

// Only unpaid lines can be voided; the database refuses anything else.
export async function voidItem(id, reason) {
  must(await sbPayroll.from('ledger_items').update({ voided_at: new Date().toISOString(), void_reason: reason }).eq('id', id));
}
