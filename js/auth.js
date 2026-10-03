// Google OAuth with a hard email allowlist.
//
// The allowlist is the whole point of this app's existence: compensation must
// not be visible to contractors who have access to the CRM. A session that is
// not on the list is signed out immediately and never reaches payroll markup.
import { sbPayroll } from './supabase.js?v=1a289eb';
import { ALLOWED_EMAILS, ALLOWED_DOMAIN } from './config.js?v=1a289eb';

let _email = '';

export function currentEmail() { return _email; }

export async function signOut() {
  await sbPayroll.auth.signOut();
  _email = '';
  location.reload();
}

function screen(inner) {
  document.getElementById('app').innerHTML = `
    <div style="min-height:70vh;display:flex;align-items:center;justify-content:center">
      <div style="text-align:center;max-width:420px">${inner}</div>
    </div>`;
}

function renderSignIn(message) {
  screen(`
    <h1 style="font-size:22px;margin:0 0 6px">THT Payroll</h1>
    <p style="color:#6b7280;font-size:13px;margin:0 0 20px">Private. Authorized accounts only.</p>
    ${message ? `<p id="login-error" style="color:#dc2626;font-size:13px;margin:0 0 14px">${message}</p>` : ''}
    <div style="display:flex;gap:6px;justify-content:center">
      <input id="magic-email" type="email" placeholder="you@theheadlinetheory.com" value="aidan@theheadlinetheory.com"
             style="flex:1;max-width:250px;padding:10px;border:1px solid #d1d5db;border-radius:8px;font-size:13px">
      <button id="magic-btn" style="padding:10px 16px;border:none;border-radius:8px;background:#111827;color:#fff;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap">
        Email me a link
      </button>
    </div>
    <p style="color:#9ca3af;font-size:11px;margin:10px 0 22px">Use this. Works without any Google Console setup.</p>
    <button id="signin-btn" style="padding:8px 16px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;font-size:12px;color:#9ca3af;cursor:pointer">
      Sign in with Google
    </button>
    <p style="color:#d97706;font-size:11px;margin:8px 0 0">Google returns redirect_uri_mismatch until this URI is added in Google Cloud Console:<br>
      <code style="font-size:10px;color:#6b7280">https://uakqchqaplkrowaraufx.supabase.co/auth/v1/callback</code></p>`);

  document.getElementById('signin-btn').onclick = async () => {
    const { error } = await sbPayroll.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + window.location.pathname,
        queryParams: { hd: ALLOWED_DOMAIN, prompt: 'select_account' },
      },
    });
    if (error) renderSignIn(error.message || 'Google sign-in failed');
  };

  // Fallback path: a magic link needs no Google Cloud Console configuration.
  // The allowlist below still gates access — this widens how you prove who you
  // are, never who is allowed in.
  document.getElementById('magic-btn').onclick = async () => {
    const email = (document.getElementById('magic-email').value || '').trim().toLowerCase();
    if (!ALLOWED_EMAILS.includes(email)) {
      renderSignIn(`${email || 'That address'} is not authorized for payroll.`);
      return;
    }
    const { error } = await sbPayroll.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + window.location.pathname },
    });
    if (error) { renderSignIn(error.message || 'Could not send sign-in link'); return; }
    screen(`<h1 style="font-size:20px;margin:0 0 8px">Check your email</h1>
            <p style="color:#6b7280;font-size:13px">A sign-in link is on its way to ${email}.</p>`);
  };
}

export async function initAuth(onReady) {
  const { data } = await sbPayroll.auth.getSession();
  const email = data?.session?.user?.email || '';

  if (!email) { renderSignIn(''); return; }

  if (!ALLOWED_EMAILS.includes(email.toLowerCase())) {
    // Sign out BEFORE rendering anything — never leak payroll to a stray account.
    await sbPayroll.auth.signOut();
    _email = '';
    renderSignIn(`${email} is not authorized for payroll.`);
    return;
  }

  _email = email;
  onReady(email);
}
