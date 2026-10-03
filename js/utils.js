// Vendored verbatim from the CRM (tht-crm js/utils.js and js/api.js) so this
// app has zero CRM imports. Behaviour must stay identical — a different esc()
// is an XSS difference, not a style choice.

export function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

export function str(v) {
  return v === null || v === undefined ? '' : String(v);
}

export function showToast(msg, type = 'error') {
  let el = document.getElementById('api-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'api-toast';
    document.body.appendChild(el);
  }
  const bg = type === 'error' ? '#dc2626' : type === 'success' ? '#059669' : '#d97706';
  el.style.cssText = `position:fixed;bottom:20px;right:20px;background:${bg};color:#fff;padding:10px 16px;border-radius:8px;font-size:13px;font-weight:600;z-index:99999;box-shadow:0 4px 12px rgba(0,0,0,.3);transition:opacity .3s;opacity:1`;
  el.textContent = msg;
  clearTimeout(el._fadeTimer);
  el._fadeTimer = setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 400); }, 5000);
}
