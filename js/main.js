import { initAuth, currentEmail, signOut } from './auth.js?v=3e553a4';
import { refreshLedger } from './ledger-view.js?v=3e553a4';
import { renderCfoTab } from './cfo.js?v=3e553a4';
import { state, setPainter } from './cfo-shell.js?v=3e553a4';
import { esc } from './utils.js?v=3e553a4';

// Pages. `#payroll` (default) is the ledger; `#cfo` is the CFO Hub, with the
// CRM's deep-links kept: #cfo/cac, #cfo/margins, #cfo/overhead.
const CFO_VIEWS = ['overview', 'cac', 'margins', 'overhead'];

function route() {
  const [page, sub] = location.hash.replace('#', '').split('/');
  if (page === 'cfo') {
    if (CFO_VIEWS.includes(sub)) state.cfoView = sub;
    return 'cfo';
  }
  return 'payroll';
}

function paintNav() {
  const page = route();
  const tab = (id, label) => `<a href="#${id}" style="padding:8px 14px;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none;
    background:${page === id ? '#111827' : 'transparent'};color:${page === id ? '#fff' : '#374151'}">${label}</a>`;
  document.getElementById('nav').innerHTML = `
    <div style="max-width:1200px;margin:0 auto;display:flex;align-items:center;gap:6px;padding:10px 20px">
      ${tab('payroll', 'Payroll')}${tab('cfo', 'CFO Hub')}
      <span style="flex:1"></span>
      <span style="font-size:12px;color:var(--text-muted)">${esc(currentEmail())}</span>
      <button class="btn btn-ghost" style="font-size:12px" id="signout-btn">Sign out</button>
    </div>`;
  document.getElementById('signout-btn').onclick = signOut;
}

function paintCfo() {
  document.getElementById('app').innerHTML = renderCfoTab();
}

let lastPage = null;
function show() {
  const page = route();
  paintNav();
  if (page === 'cfo') { setPainter(paintCfo); paintCfo(); }
  else if (page !== lastPage) { setPainter(() => {}); refreshLedger(); }
  lastPage = page;
}

initAuth(() => {
  window.addEventListener('hashchange', show);
  show();
});
