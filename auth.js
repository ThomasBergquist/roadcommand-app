/* ═══════════════════════════════════════════════════════════════
   RoadCommand — auth.js
   Supabase authentication: login, signup, session restore
   Replace SUPABASE_URL and SUPABASE_ANON_KEY with your project values
   from: https://app.supabase.com → Project Settings → API
   ═══════════════════════════════════════════════════════════════ */

const SUPABASE_URL      = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

// Init Supabase client
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let _authMode = 'signin'; // 'signin' or 'signup'

// ── Toggle between Sign In / Sign Up ────────────────────────────
function toggleAuthMode() {
  _authMode = _authMode === 'signin' ? 'signup' : 'signin';
  const title  = document.getElementById('auth-title');
  const btn    = document.getElementById('auth-submit-btn');
  const toggle = document.getElementById('auth-toggle');
  const badge  = document.getElementById('auth-badge');
  if (_authMode === 'signup') {
    title.textContent  = 'Create Your Account';
    btn.textContent    = 'Start Free 30-Day Beta';
    toggle.innerHTML   = 'Already have an account? <a onclick="toggleAuthMode()">Sign in</a>';
    badge.style.display = 'block';
  } else {
    title.textContent  = 'Sign In';
    btn.textContent    = 'Sign In';
    toggle.innerHTML   = 'No account? <a onclick="toggleAuthMode()">Sign up free</a>';
    badge.style.display = 'none';
  }
  clearAuthError();
}

// ── Show / Clear Error ───────────────────────────────────────────
function showAuthError(msg) {
  const el = document.getElementById('auth-error');
  el.textContent = msg;
  el.classList.add('show');
}

function clearAuthError() {
  const el = document.getElementById('auth-error');
  el.textContent = '';
  el.classList.remove('show');
}

// ── Handle Submit ────────────────────────────────────────────────
async function authSubmit() {
  clearAuthError();
  const email    = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const btn      = document.getElementById('auth-submit-btn');

  if (!email || !password) { showAuthError('Email and password are required.'); return; }

  btn.textContent = 'Please wait...';
  btn.disabled    = true;

  try {
    let result;
    if (_authMode === 'signup') {
      result = await _supabase.auth.signUp({ email, password });
      if (result.error) throw result.error;
      // After signup Supabase may require email confirm depending on your settings
      if (result.data.session) {
        // Auto-confirmed — go straight to app
        handleSession(result.data.session);
      } else {
        showAuthError('Check your email to confirm your account, then sign in.');
        btn.textContent = 'Sign Up Free';
        btn.disabled    = false;
      }
    } else {
      result = await _supabase.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      handleSession(result.data.session);
    }
  } catch (err) {
    let msg = err.message || 'Something went wrong. Try again.';
    if (msg.toLowerCase().includes('invalid login')) msg = 'Incorrect email or password.';
    if (msg.toLowerCase().includes('already registered')) msg = 'That email is already registered. Sign in instead.';
    showAuthError(msg);
    btn.textContent = _authMode === 'signup' ? 'Sign Up Free' : 'Sign In';
    btn.disabled    = false;
  }
}

// ── Handle Session ───────────────────────────────────────────────
function handleSession(session) {
  if (!session) return;
  const user      = session.user;
  const firstName = extractFirstName(user);
  // Call into app.js
  onAuthReady(firstName, user.id, user.email);
}

function extractFirstName(user) {
  // Try full_name from metadata first, fall back to email prefix
  const meta = user.user_metadata || {};
  if (meta.full_name) return meta.full_name.split(' ')[0];
  if (meta.first_name) return meta.first_name;
  if (user.email) return user.email.split('@')[0];
  return 'Driver';
}

// ── Sign Out ─────────────────────────────────────────────────────
async function signOut() {
  await _supabase.auth.signOut();
  // Reload the page to go back to auth screen
  window.location.reload();
}

// ── Restore Session on Page Load ─────────────────────────────────
(async function restoreSession() {
  const { data } = await _supabase.auth.getSession();
  if (data.session) {
    handleSession(data.session);
  }
  // Also listen for auth state changes (token refresh etc.)
  _supabase.auth.onAuthStateChange((_event, session) => {
    if (session) handleSession(session);
  });
})();

// ── Enter key on auth inputs ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  ['auth-email', 'auth-password'].forEach(function(id) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') authSubmit();
    });
  });
});
