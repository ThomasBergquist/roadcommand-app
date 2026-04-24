/* ═══════════════════════════════════════════════════════════════
   RoadCommand — auth.js
   Supabase authentication + profile management
   ═══════════════════════════════════════════════════════════════ */

const SUPABASE_URL      = 'https://kaxspubuhzpqgbomvcmo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtheHNwdWJ1aHpwcWdib212Y21vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5ODU4NzgsImV4cCI6MjA5MjU2MTg3OH0._5mvIKv2ZhtDRzT2yLf8NeDH8VseqKy47g9nXczXndM';

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let _authMode    = 'signin';
let _currentUser = null;

// ── Toggle Sign In / Sign Up ─────────────────────────────────────
function toggleAuthMode() {
  _authMode = _authMode === 'signin' ? 'signup' : 'signin';
  const title  = document.getElementById('auth-title');
  const btn    = document.getElementById('auth-submit-btn');
  const toggle = document.getElementById('auth-toggle');
  const badge  = document.getElementById('auth-badge');
  if (_authMode === 'signup') {
    title.textContent   = 'Create Your Account';
    btn.textContent     = 'Sign Up Free';
    toggle.innerHTML    = 'Already have an account? <a onclick="toggleAuthMode()">Sign in</a>';
    badge.style.display = 'block';
  } else {
    title.textContent   = 'Sign In';
    btn.textContent     = 'Sign In';
    toggle.innerHTML    = 'No account? <a onclick="toggleAuthMode()">Sign up free</a>';
    badge.style.display = 'none';
  }
  clearAuthError();
}

// ── Error helpers ────────────────────────────────────────────────
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

// ── Auth Submit ──────────────────────────────────────────────────
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
      if (result.data.session) {
        _currentUser = result.data.session.user;
        showProfileSetup();
      } else {
        showAuthError('Check your email to confirm your account, then sign in.');
        btn.textContent = 'Sign Up Free';
        btn.disabled    = false;
      }
    } else {
      result = await _supabase.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      _currentUser = result.data.session.user;
      await loadProfileAndEnter();
    }
  } catch (err) {
    let msg = err.message || 'Something went wrong. Try again.';
    if (msg.toLowerCase().includes('invalid login'))      msg = 'Incorrect email or password.';
    if (msg.toLowerCase().includes('already registered')) msg = 'That email is already registered. Sign in instead.';
    showAuthError(msg);
    btn.textContent = _authMode === 'signup' ? 'Sign Up Free' : 'Sign In';
    btn.disabled    = false;
  }
}

// ── Profile Setup Screen ─────────────────────────────────────────
function showProfileSetup() {
  document.getElementById('auth-screen').classList.remove('active');
  document.getElementById('profile-setup-screen').classList.add('active');
}

async function saveProfile() {
  const firstName   = document.getElementById('profile-firstname').value.trim();
  const codriver    = document.getElementById('profile-codriver').value.trim();
  const truckYear   = document.getElementById('profile-year').value.trim();
  const truckModel  = document.getElementById('profile-model').value.trim();
  const btn         = document.getElementById('profile-save-btn');

  if (!firstName) { alert('First name is required.'); return; }

  btn.textContent = 'Saving...';
  btn.disabled    = true;

  try {
    const { error } = await _supabase.from('profiles').insert({
      user_id:     _currentUser.id,
      first_name:  firstName,
      codriver:    codriver,
      truck_year:  truckYear,
      truck_model: truckModel
    });
    if (error) throw error;
    enterApp({ first_name: firstName, codriver, truck_year: truckYear, truck_model: truckModel });
  } catch (err) {
    alert('Error saving profile. Please try again.');
    btn.textContent = 'Save and Enter RoadCommand';
    btn.disabled    = false;
  }
}

// ── Load Profile Then Enter App ──────────────────────────────────
async function loadProfileAndEnter() {
  try {
    const { data, error } = await _supabase
      .from('profiles')
      .select('*')
      .eq('user_id', _currentUser.id)
      .single();

    if (error || !data) {
      // No profile yet — show setup screen
      showProfileSetup();
      return;
    }
    enterApp(data);
  } catch (err) {
    // If anything fails just enter with email prefix
    enterApp({ first_name: _currentUser.email.split('@')[0] });
  }
}

// ── Enter App ────────────────────────────────────────────────────
function enterApp(profile) {
  // Store globally for app.js to use
  window._rcUserFirstName = profile.first_name || 'Driver';
  window._rcUserCodriver  = profile.codriver   || '';
  window._rcTruckYear     = profile.truck_year  || '';
  window._rcTruckModel    = profile.truck_model || '';
  window._rcUserId        = _currentUser.id;
  window._rcUserEmail     = _currentUser.email;

  // Hide auth/profile screens
  document.getElementById('auth-screen').classList.remove('active');
  document.getElementById('profile-setup-screen').classList.remove('active');

  // Show app
  document.querySelector('.app-header').style.display = '';
  document.getElementById('main-app').style.display   = '';
  document.getElementById('bottom-nav').style.display = '';

  // Call app.js init
  onAuthReady(profile.first_name, _currentUser.id, _currentUser.email);
}

// ── Sign Out ─────────────────────────────────────────────────────
async function signOut() {
  await _supabase.auth.signOut();
  window.location.reload();
}

// ── Restore Session ──────────────────────────────────────────────
(async function restoreSession() {
  const { data } = await _supabase.auth.getSession();
  if (data.session) {
    _currentUser = data.session.user;
    await loadProfileAndEnter();
  }
  _supabase.auth.onAuthStateChange(async (_event, session) => {
    if (session && !_currentUser) {
      _currentUser = session.user;
      await loadProfileAndEnter();
    }
  });
})();

// ── Enter key support ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  ['auth-email', 'auth-password'].forEach(function(id) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') authSubmit();
    });
  });
});
