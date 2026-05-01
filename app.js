/* RoadCommand — app.js */

// ── DISCLAIMER CONSTANTS ─────────────────────────────────────
var AI_DISCLAIMER = '<div class="ai-disclaimer">Estimates only. Verify rates and costs independently before booking.</div>';
var HOS_DISCLAIMER = '<div class="ai-disclaimer">Always verify your actual hours with your ELD before accepting a load.</div>';
var AI_SCRIPT_DISCLAIMER = '<div class="ai-disclaimer">AI-generated script. Use as a starting point — adjust for your situation and market conditions.</div>';

// ── MORE DRAWER ───────────────────────────────────────────────
function toggleMoreDrawer(e) {
  if (e) e.stopPropagation();
  var drawer = document.getElementById('more-drawer');
  var overlay = document.getElementById('more-overlay');
  var moreBtn = document.getElementById('more-nav-btn');
  if (!drawer) return;
  var isOpen = drawer.classList.contains('open');
  drawer.classList.toggle('open', !isOpen);
  if (overlay) overlay.classList.toggle('open', !isOpen);
  if (moreBtn) moreBtn.classList.toggle('active', !isOpen);
}

function closeMoreDrawer() {
  var drawer = document.getElementById('more-drawer');
  var overlay = document.getElementById('more-overlay');
  var moreBtn = document.getElementById('more-nav-btn');
  if (drawer) drawer.classList.remove('open');
  if (overlay) overlay.classList.remove('open');
  if (moreBtn) moreBtn.classList.remove('active');
}

// ══════════════════════════════════════════════════════════════
// AUTH & SUPABASE INTEGRATION
// ══════════════════════════════════════════════════════════════
function onAuthReady(firstName, userId, email) {
  window._rcUserFirstName = firstName || 'Driver';
  window._rcUserId        = userId;
  window._supabaseReady   = true;
  window._rcUserEmail     = email;
  window._rcSessionStart  = Date.now();
  track('session_started', { region: currentRegion || 'unknown' });
  window.addEventListener('beforeunload', function() {
    var duration = Math.round((Date.now() - window._rcSessionStart) / 1000);
    track('session_ended', { duration_seconds: duration });
  });

  var truckModel = window._rcTruckYear && window._rcTruckModel
    ? window._rcTruckYear + ' ' + window._rcTruckModel
    : 'RoadCommand';
  var driverName = window._rcUserFirstName || '';
  if (window._rcUserCodriver) driverName += ' & ' + window._rcUserCodriver;

  var headerModel = document.getElementById('header-truck-model');
  var headerName  = document.getElementById('header-truck-name');
  if (headerModel) headerModel.textContent = truckModel;
  if (headerName)  headerName.textContent  = driverName;

  var nameEl     = document.getElementById('set-name');
  var codriverEl = document.getElementById('set-codriver');
  var yearEl     = document.getElementById('set-year');
  var modelEl    = document.getElementById('set-model');
  if (nameEl     && !nameEl.value)     nameEl.value     = window._rcUserFirstName || '';
  if (codriverEl && !codriverEl.value) codriverEl.value = window._rcUserCodriver  || '';
  if (yearEl     && !yearEl.value)     yearEl.value     = window._rcTruckYear     || '';
  if (modelEl    && !modelEl.value)    modelEl.value    = window._rcTruckModel    || '';

  renderStates(stateData);
  injectProfitBars();
  loadSavedPreferences();
  renderMaint();
  refreshWeather();
  setTimeout(startGPS, 500);
  setTimeout(checkFirstTime, 700);
  setTimeout(loadBrokers, 800);
  setTimeout(loadInvoices, 1000);
  setTimeout(loadMaintItems, 1200);
}

function submitFeedback() {
  var type = document.getElementById('feedback-type') ? document.getElementById('feedback-type').value : 'general';
  var msg  = document.getElementById('feedback-msg')  ? document.getElementById('feedback-msg').value.trim() : '';
  if (!msg) { alert('Please describe your feedback before submitting.'); return; }
  var subject = encodeURIComponent('[RoadCommand ' + type + '] Feedback');
  var body    = encodeURIComponent(msg + '\n\n— ' + (window._rcUserEmail || 'user'));
  window.location.href = 'mailto:admin@roadcommand.co?subject=' + subject + '&body=' + body;
  document.getElementById('feedback-msg').value = '';
  alert('Thanks! Your feedback is on its way.');
}

let stateData = [
  { code:'WA', name:'Washington', volume:47, rpm:2.18, trend:'up', maxVol:47 },
  { code:'OR', name:'Oregon',     volume:38, rpm:2.11, trend:'up', maxVol:47 },
  { code:'ID', name:'Idaho',      volume:29, rpm:2.05, trend:'flat', maxVol:47 },
  { code:'CA', name:'California', volume:24, rpm:2.31, trend:'up', maxVol:47 },
  { code:'UT', name:'Utah',       volume:21, rpm:2.08, trend:'flat', maxVol:47 },
  { code:'MT', name:'Montana',    volume:14, rpm:1.98, trend:'down', maxVol:47 },
  { code:'NV', name:'Nevada',     volume:12, rpm:2.14, trend:'flat', maxVol:47 },
  { code:'CO', name:'Colorado',   volume:9,  rpm:2.22, trend:'up', maxVol:47 },
];

function renderStates(data) {
  const list = document.getElementById('state-list');
  if (!list) return;
  if (!data || !data.length) {
    list.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🗺️</div><div class="empty-state-msg">No state data yet.<br>Log a load to start tracking volume by state.</div></div>';
    return;
  }
  const maxVol = Math.max(...data.map(s => s.volume));
  list.innerHTML = data.map((s, i) => {
    const pct = Math.round((s.volume / maxVol) * 100);
    const barColor = i === 0 ? '' : i === 1 ? '' : pct < 40 ? ' red' : pct < 65 ? ' amber' : '';
    const rowClass = i === 0 ? 'top-state' : i <= 2 ? 'mid-state' : '';
    const rankClass = i === 0 ? 'rank-1' : i <= 2 ? 'rank-2' : '';
    const trendClass = s.trend === 'up' ? 'trend-up' : s.trend === 'down' ? 'trend-down' : 'trend-flat';
    const trendLabel = s.trend === 'up' ? '↑ Rising' : s.trend === 'down' ? '↓ Falling' : '→ Flat';
    return `
      <div class="state-row ${rowClass}">
        <div class="state-top-line">
          <div>
            <span class="state-name">${s.name}</span>
            <span style="color:#b8c8b8;font-size:.8rem;margin-left:.5rem;">${s.code}</span>
          </div>
          <div style="display:flex;align-items:center;gap:.5rem;">
            <span class="state-trend ${trendClass}">${trendLabel}</span>
            <span class="state-rank ${rankClass}">#${i+1}</span>
          </div>
        </div>
        <div class="state-bar-wrap"><div class="state-bar${barColor}" style="width:${pct}%"></div></div>
        <div class="state-stats">
          <div class="state-stat">Loads: <strong>${s.volume}</strong></div>
          <div class="state-stat">Avg RPM: <strong>$${s.rpm.toFixed(2)}</strong></div>
          <div class="state-stat">Freight: <strong>${pct >= 70 ? '🟢 Hot' : pct >= 40 ? '🟡 Moderate' : '🔴 Slow'}</strong></div>
        </div>
      </div>`;
  }).join('');
}

function sortStates(by, btn) {
  document.querySelectorAll('.state-filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  let sorted = [...stateData];
  if (by === 'volume') sorted.sort((a,b) => b.volume - a.volume);
  if (by === 'rpm') sorted.sort((a,b) => b.rpm - a.rpm);
  if (by === 'trend') sorted = sorted.filter(s => s.trend === 'up').concat(sorted.filter(s => s.trend !== 'up'));
  renderStates(sorted);
}

function addStateData() {
  const code = document.getElementById('new-state-code').value;
  const volume = parseInt(document.getElementById('new-state-volume').value);
  const rpm = parseFloat(document.getElementById('new-state-rpm').value);
  const trend = document.getElementById('new-state-trend').value;
  if (!code || !volume || !rpm) { alert('Please fill in all fields.'); return; }
  const names = {WA:'Washington',OR:'Oregon',ID:'Idaho',MT:'Montana',WY:'Wyoming',UT:'Utah',NV:'Nevada',CA:'California',CO:'Colorado',AZ:'Arizona',NM:'New Mexico',TX:'Texas',OK:'Oklahoma',KS:'Kansas',NE:'Nebraska',SD:'South Dakota',ND:'North Dakota',MN:'Minnesota'};
  const existing = stateData.findIndex(s => s.code === code);
  if (existing >= 0) {
    stateData[existing].volume = volume;
    stateData[existing].rpm = rpm;
    stateData[existing].trend = trend;
  } else {
    stateData.push({ code, name: names[code] || code, volume, rpm, trend });
  }
  stateData.sort((a,b) => b.volume - a.volume);
  renderStates(stateData);
  document.getElementById('new-state-code').value = '';
  document.getElementById('new-state-volume').value = '';
  document.getElementById('new-state-rpm').value = '';
}

function callBroker(phone, name) {
  const clean = phone.replace(/[^0-9+]/g,'');
  if (confirm('Call ' + name + '?\n' + phone)) {
    window.location.href = 'tel:' + clean;
  }
}

function showScreen(id, btn) {
  closeMoreDrawer();
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  var screen = document.getElementById('screen-' + id);
  if (screen) screen.classList.add('active');
  if (btn) btn.classList.add('active');
  var drawerScreens = ['negotiate','tools','states','params','log','maint','settings','fmcsa'];
  if (drawerScreens.indexOf(id) >= 0) {
    var moreBtn = document.getElementById('more-nav-btn');
    if (moreBtn) moreBtn.classList.add('active');
  }
  // Re-render loads when navigating to dash or loads screen
  if (id === 'dash' || id === 'loads') {
    if (_liveLoadsCache && _liveLoadsCache.length > 0) {
      setTimeout(function() { renderLiveLoadCards(_liveLoadsCache, defaults.minRpm || 2.00); }, 100);
    } else {
      setTimeout(function() { fetchTruckstopLoads(false); }, 100);
    }
  }
  track('tab_opened', { tab: id });
}

function goToSettings() { showScreen('settings', null); }

function watchLoad(btn) {
  const card = btn.closest('.load-card');
  const tag = card.querySelector('.load-tag');
  tag.className = 'load-tag tag-watch'; tag.textContent = 'Watching';
  card.className = 'load-card watch';
}

function skipLoad(btn) {
  const card = btn.closest('.load-card');
  card.style.opacity = '0.3';
  setTimeout(() => card.remove(), 300);
}

function showAddLoad() {
  const f = document.getElementById('add-load-form');
  f.style.display = f.style.display === 'none' ? 'block' : 'none';
}
function saveLoad() { alert('Load saved!'); document.getElementById('add-load-form').style.display = 'none'; }
function showAddRun() {
  const f = document.getElementById('add-run-form');
  f.style.display = f.style.display === 'none' ? 'block' : 'none';
}
function saveRun() { alert('Run logged!'); document.getElementById('add-run-form').style.display = 'none'; }

function calcLoad(rate, miles) {
  showScreen('calc', null);
  document.getElementById('calc-rate').value = rate;
  document.getElementById('calc-miles').value = miles;
  calculateProfit();
}

function calculateProfit() {
  const rate = parseFloat(document.getElementById('calc-rate').value) || 0;
  const miles = parseFloat(document.getElementById('calc-miles').value) || 0;
  const fuelPrice = parseFloat(document.getElementById('calc-fuel').value) || 4.25;
  const mpg = parseFloat(document.getElementById('calc-mpg').value) || 6.5;
  const dead = parseFloat(document.getElementById('calc-dead').value) || 0;
  const brokerPct = parseFloat(document.getElementById('calc-broker').value) || 0;
  const other = parseFloat(document.getElementById('calc-other').value) || 0;
  if (!rate || !miles) { document.getElementById('calc-result').style.display = 'none'; return; }
  const totalMiles = miles + dead;
  const fuelCost = (totalMiles / mpg) * fuelPrice;
  const brokerFee = rate * (brokerPct / 100);
  const net = rate - fuelCost - brokerFee - other;
  const rpm = rate / miles;
  const npm = net / totalMiles;
  const fmt = n => '$' + Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,',');
  document.getElementById('r-gross').textContent = fmt(rate);
  document.getElementById('r-broker').textContent = brokerFee > 0 ? '-' + fmt(brokerFee) : '$0.00';
  document.getElementById('r-fuel').textContent = '-' + fmt(fuelCost);
  document.getElementById('r-other').textContent = other > 0 ? '-' + fmt(other) : '$0.00';
  document.getElementById('r-net').textContent = (net < 0 ? '-' : '') + fmt(net);
  document.getElementById('r-rpm').textContent = fmt(rpm) + '/mi';
  document.getElementById('r-npm').textContent = (npm < 0 ? '-' : '') + fmt(npm) + '/mi';
  let verdict, color;
  var minR = defaults.minRpm || 2.00;
  if (rpm >= minR && rpm >= 2.3)  { verdict = '✅ Strong'; color = 'var(--green)'; }
  else if (rpm >= minR)           { verdict = '⚠️ Acceptable'; color = 'var(--amber)'; }
  else                            { verdict = '❌ Skip — Below Your Minimum'; color = 'var(--red)'; }
  document.getElementById('r-verdict').textContent = verdict;
  document.getElementById('r-verdict').style.color = color;
  document.getElementById('r-total-row').className = net >= 0 ? 'calc-row total' : 'calc-row total loss';
  document.getElementById('calc-result').style.display = 'block';
  var calcResult = document.getElementById('calc-result');
  if (calcResult && !calcResult.querySelector('.ai-disclaimer')) {
    calcResult.insertAdjacentHTML('beforeend', AI_DISCLAIMER);
  }
}

function saveParams() {
  var minRpm    = parseFloat(document.getElementById('p-rpm')       && document.getElementById('p-rpm').value)       || 2.00;
  var minGross  = parseFloat(document.getElementById('p-gross')     && document.getElementById('p-gross').value)     || 0;
  var minMiles  = parseFloat(document.getElementById('p-minmi')     && document.getElementById('p-minmi').value)     || 0;
  var maxMiles  = parseFloat(document.getElementById('p-maxmi')     && document.getElementById('p-maxmi').value)     || 9999;
  var maxDead   = parseFloat(document.getElementById('p-maxdead')   && document.getElementById('p-maxdead').value)   || 150;
  var maxWeight = parseFloat(document.getElementById('p-maxweight') && document.getElementById('p-maxweight').value) || 48000;
  var equipType = document.getElementById('p-equipment') ? document.getElementById('p-equipment').value : 'V';
  var loadType  = document.getElementById('p-loadtype')  ? document.getElementById('p-loadtype').value  : 'All';
  var homeBase     = document.getElementById('p-home')    ? document.getElementById('p-home').value.trim()    : '';
  var originStates = document.getElementById('p-origins') ? document.getElementById('p-origins').value.trim() : 'WA';
  var destStates   = document.getElementById('p-dests')   ? document.getElementById('p-dests').value.trim()   : '';
  var fuel = parseFloat(document.getElementById('calc-fuel') && document.getElementById('calc-fuel').value) || 4.25;
  var mpg  = parseFloat(document.getElementById('calc-mpg')  && document.getElementById('calc-mpg').value)  || 6.5;

  // Update defaults
  defaults.minRpm      = minRpm;
  defaults.minGross    = minGross;
  defaults.minMiles    = minMiles;
  defaults.maxMiles    = maxMiles;
  defaults.maxDeadhead = maxDead;
  defaults.maxWeight   = maxWeight;
  defaults.fuelPrice   = fuel;
  defaults.mpg         = mpg;
  window._rcEquipmentType = equipType;
  window._rcLoadType = loadType;

  // Sync Settings screen RPM field
  var settingsRpm = document.getElementById('set-minrpm');
  if (settingsRpm) settingsRpm.value = minRpm;

  // Save to localStorage
  try {
    localStorage.setItem('rc-params', JSON.stringify({
      minRpm, minGross, minMiles, maxMiles, maxDead, maxWeight,
      equipType, loadType, homeBase, originStates, destStates, fuel, mpg,
    }));
  } catch(e) {}

  // Save to Supabase
  savePreferencesToSupabase();

  // Update alert prefs for push notifications
  if (window._rcUserId) saveLoadAlertPrefs();

  injectProfitBars();
  fetchTruckstopLoads(true);
  alert('Parameters saved!');
}

function filterLoads(type) {
  document.querySelectorAll('[id^=filter-]').forEach(b => b.className = 'btn btn-outline btn-sm');
  document.getElementById('filter-' + type).className = 'btn btn-green btn-sm';
}

const defaults = { fuelPrice: 4.25, mpg: 6.5, emptyMpg: 8.0, deadhead: 0, brokerPct: 0, minRpm: 2.00, minGross: 1500, minMiles: 500, maxMiles: 2000, maxDeadhead: 150 };

// ── ANALYTICS ────────────────────────────────────────────────
function track(eventName, properties) {
  if (!window._rcUserId || !window._supabaseReady) return;
  try {
    window._supabase.from('events').insert({
      user_id:    window._rcUserId,
      event_name: eventName,
      properties: properties || {}
    }).then(() => {});
  } catch(e) {}
}

function autoProfit(rate, miles) {
  const totalMiles = miles + defaults.deadhead;
  const fuelCost = (totalMiles / defaults.mpg) * defaults.fuelPrice;
  const brokerFee = rate * (defaults.brokerPct / 100);
  const net = rate - fuelCost - brokerFee;
  const rpm = rate / miles;
  let tier, verdictText;
  var minR = defaults.minRpm || 2.00;
  if (rpm >= minR && rpm >= 2.3) { tier = 'strong'; verdictText = '✅ Strong'; }
  else if (rpm >= minR)          { tier = 'ok';     verdictText = '⚠️ Acceptable'; }
  else                           { tier = 'weak';   verdictText = '❌ Below Minimum'; }
  const fmt = n => '$' + Math.abs(n).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return { net, rpm, tier, verdictText, fuelCost, fmt };
}

function injectProfitBars() {
  document.querySelectorAll('.load-card[data-rate]').forEach(card => {
    const rate  = parseFloat(card.dataset.rate);
    const miles = parseFloat(card.dataset.miles);
    if (!rate || !miles) return;
    const { net, rpm, tier, verdictText, fuelCost, fmt } = autoProfit(rate, miles);
    const existing = card.querySelector('.load-profit');
    if (existing) existing.remove();
    const bar = document.createElement('div');
    bar.className = 'load-profit ' + tier;
    bar.innerHTML =
      '<div class="profit-left">' +
        '<div class="profit-net ' + tier + '">' + (net >= 0 ? '' : '-') + fmt(net) + ' net</div>' +
        '<div class="profit-detail">After fuel ' + fmt(fuelCost) + ' · ' + fmt(rate / miles) + '/mi loaded</div>' +
      '</div>';
    const actions = card.querySelector('.load-actions');
    card.insertBefore(bar, actions);
  });
}

// ══════════════════════════════════════════════════════════════
// HOS — PERSISTENT AVAILABLE HOURS (Change 1)
// ══════════════════════════════════════════════════════════════

function saveHOSHours() {
  var input = document.getElementById('dash-hos-hours');
  if (!input) return;
  var hrs = parseFloat(input.value);
  if (isNaN(hrs) || hrs < 0 || hrs > 11) { alert('Enter your available driving hours (0 to 11).'); return; }
  window._hosAvailable = hrs;
  try { localStorage.setItem('rc-hos-hours', hrs); } catch(e) {}
  document.querySelectorAll('.load-expand-panel.open').forEach(function(p) {
    var pid = p.id, r = parseInt(p.dataset.rate || 0), m = parseInt(p.dataset.miles || 0);
    if (r && m) recalcPanel(pid, r, m);
  });
  var btn = document.getElementById('hos-save-btn');
  if (btn) { btn.textContent = '✓ Saved'; setTimeout(function() { btn.textContent = 'Save'; }, 1500); }
}

function loadSavedHOS() {
  try {
    var saved = localStorage.getItem('rc-hos-hours');
    if (saved) {
      window._hosAvailable = parseFloat(saved);
      var input = document.getElementById('dash-hos-hours');
      if (input) input.value = window._hosAvailable;
    }
  } catch(e) {}
}

function calcHOSVerdict(miles) {
  var hosAvail = window._hosAvailable;
  if (!hosAvail || hosAvail <= 0) return '';
  var speed = parseFloat((document.getElementById('set-speed') && document.getElementById('set-speed').value) || 55);
  var driveTime = miles / speed;
  var breakNeeded = driveTime > 8 ? 0.5 : 0;
  var totalNeeded = driveTime + breakNeeded;
  var buffer = hosAvail - totalNeeded;
  if (buffer >= 0) {
    return '<div class="hos-inline ' + (buffer < 1 ? 'warn' : 'ok') + '">' +
      '⏱️ HOS: ' + driveTime.toFixed(1) + 'h drive · ' +
      (buffer < 1 ? '⚠️ Tight (' + buffer.toFixed(1) + 'h buffer)' : '✅ Legal (' + buffer.toFixed(1) + 'h to spare)') +
      '</div>';
  } else {
    return '<div class="hos-inline danger">' +
      '⏱️ HOS: ❌ Short ' + Math.abs(buffer).toFixed(1) + 'h — reset or negotiate later pickup' +
      '</div>';
  }
}

// ══════════════════════════════════════════════════════════════
// BROKER BADGE — auto-inject on expand (Change 2)
// ══════════════════════════════════════════════════════════════

function getBrokerBadgeHTML(brokerName) {
  if (!brokerName) return '';
  var q = brokerName.toLowerCase().trim();
  var match = null;
  var keys = Object.keys(BROKER_DB);
  for (var k = 0; k < keys.length; k++) {
    if (q.indexOf(keys[k]) >= 0 || keys[k].indexOf(q) >= 0) { match = BROKER_DB[keys[k]]; break; }
  }
  if (!match) return '<span class="broker-badge unknown">? Not in DB</span>';
  var scoreColor = match.score.indexOf('A') === 0 ? 'green' : match.score.indexOf('B') === 0 ? 'amber' : 'red';
  var daysColor  = match.days <= 28 ? 'green' : match.days <= 35 ? 'amber' : 'red';
  return '<span class="broker-badge score-' + scoreColor + '">' + match.score + '</span>' +
         '<span class="broker-badge days-' + daysColor + '">' + match.days + 'd pay</span>';
}

// ══════════════════════════════════════════════════════════════
// TUTORIAL SYSTEM
// ══════════════════════════════════════════════════════════════
const TUTORIAL_STEPS = [
  { icon: '👋', title: 'Welcome, ' + (window._rcUserFirstName || 'Driver'), desc: 'RoadCommand is your personal dispatcher — built by a trucker, for truckers. Every feature eliminates a cost or puts more money in your pocket.', tip: '<strong>This tutorial walks you through every feature.</strong> Takes about 3 minutes. Re-run it anytime from Settings.' },
  { icon: '📊', title: 'Dashboard', desc: 'Your command center. Live GPS location, real diesel price for your region, weekly revenue and RPM stats, estimated fuel cost, and hot loads — all updating automatically.', tip: '<strong>Set your available HOS hours on the dashboard</strong> — every load card will auto-show whether you can legally run it.' },
  { icon: '⛽', title: 'Crowdsourced Fuel Prices', desc: 'Every time you fuel up, tap the diesel box on the dashboard and enter what you paid. Your report is averaged with other RoadCommand drivers within 100 miles.', tip: '<strong>The more drivers report, the more accurate it gets.</strong>' },
  { icon: '🚛', title: 'Loads Tab', desc: 'All your loads — Hot, Watching, and Booked. Broker credit score and HOS verdict show automatically when you expand a card.', tip: '<strong>Everything you need to say yes or no is in the expand panel.</strong>' },
  { icon: '🤝', title: 'Dispatcher Tab', desc: 'Broker Scorecard, Rate Coach, and Get Script in one. Enter load details and tap Get Script — market rate, counter-offer, and word-for-word script all at once.', tip: '<strong>Use Get Script before every negotiation call.</strong>' },
  { icon: '🏦', title: 'Broker Vault', desc: 'Your permanent broker network. Add every broker you work with. Every invoice links to their profile.', tip: '<strong>Upload Rate Confirmations and BOLs</strong> directly to each invoice.' },
  { icon: '💵', title: 'Money Tab', desc: 'Your full invoice tracker. Outstanding and overdue totals at the top. Every invoice color-coded.', tip: '<strong>Log invoices the day you deliver.</strong> Mark Paid to move them out of your active view.' },
  { icon: '🔧', title: 'Maintenance Tab', desc: 'Track every service item on your truck. Cost per mile feeds directly into profit calculations.', tip: '<strong>Your real maintenance cost per mile</strong> is used in every profit calculation.' },
  { icon: '⚙️', title: 'Settings Tab', desc: 'Set your loaded MPG and empty MPG separately. Adjust text size and display mode. Access all additional tools from the More menu.', tip: '<strong>Set Empty MPG accurately.</strong> It affects deadhead fuel cost calculations.' },
];

let currentStep = 0;

function renderTutorialStep(step) {
  const s = TUTORIAL_STEPS[step];
  const total = TUTORIAL_STEPS.length;
  document.getElementById('t-step-count').textContent = 'Step ' + (step+1) + ' of ' + total;
  document.getElementById('t-body').innerHTML =
    '<div class="tutorial-icon">' + s.icon + '</div>' +
    '<div class="tutorial-screen-title">' + s.title + '</div>' +
    '<div class="tutorial-desc">' + s.desc + '</div>' +
    '<div class="tutorial-tip">' + s.tip + '</div>';
  const dotsEl = document.getElementById('t-dots');
  dotsEl.innerHTML = TUTORIAL_STEPS.map((_,i) => '<div class="t-dot ' + (i===step?'active':'') + '"></div>').join('');
  const nextBtn = document.getElementById('t-next-btn');
  nextBtn.textContent = step === total-1 ? 'Lets Go! 🚛' : 'Tap anywhere →';
  var backBtn = document.getElementById('t-back-btn');
  if (backBtn) backBtn.style.display = step === 0 ? 'none' : 'inline-block';
}

function nextTutorialStep() {
  if (currentStep < TUTORIAL_STEPS.length - 1) { currentStep++; renderTutorialStep(currentStep); }
  else skipTutorial();
}
function prevTutorialStep() {
  if (currentStep > 0) { currentStep--; renderTutorialStep(currentStep); }
}
function skipTutorial() {
  document.getElementById('tutorial-overlay').style.display = 'none';
  try { localStorage.setItem('rc-tutorialdone-v8', '1'); } catch(e) {}
}
function startTutorial() {
  currentStep = 0; renderTutorialStep(0);
  document.getElementById('tutorial-overlay').style.display = 'flex';
}
function checkFirstTime() {
  try { if (!localStorage.getItem('rc-tutorialdone-v8')) setTimeout(startTutorial, 800); }
  catch(e) { setTimeout(startTutorial, 800); }
}

// ══════════════════════════════════════════════════════════════
// TOOL HELP SYSTEM
// ══════════════════════════════════════════════════════════════
const HELP_CONTENT = {
  loads:    { title: '🚛 How to Use the Loads Tab', steps: ['Tap any load card to see full details including broker badge and HOS verdict.','Tap 📞 Call to dial the broker directly.','Tap 👁 Watch to save a load you are considering.','Tap ✕ Skip to remove a load from your view.','The colored profit bar shows estimated net after fuel automatically.','Tap + Add Load Manually to enter any load from Truckstop or DAT.'] },
  broker:   { title: '🏦 How to Use Broker Scorecard', steps: ['Type the broker name in the search box.','Tap Check to see credit rating, average days to pay, and red flags.','Green flags mean reliable. Amber means caution. Red means high risk.','Always get a signed rate confirmation before loading for unknown brokers.'] },
  negotiate:{ title: '📈 How to Use the Dispatcher', steps: ['Select origin and destination state.','Enter the broker offer and miles.','Tap Get Script to get market rate data AND a word-for-word phone script in one step.','Use it on the phone — most brokers have $100 to $200 flex on spot loads.'] },
  invoice:  { title: '💵 How to Use Invoice Tracker', steps: ['After delivering, enter broker name, amount, and reference number.','Select payment terms and add broker phone number.','Tap Add Invoice — it appears color-coded by status.','When payment arrives tap Mark Paid — it moves to Paid This Month.'] },
  calc:     { title: '💰 How to Use Profit Calculator', steps: ['Enter the gross rate and total miles.','Fuel price and MPG are pre-filled from Settings.','Enter deadhead miles if applicable.','Results update instantly. Green = strong. Red = below minimum.'] },
};

function showHelp(toolId) {
  const h = HELP_CONTENT[toolId];
  if (!h) return;
  document.getElementById('help-modal-title-text').textContent = h.title;
  document.getElementById('help-modal-body').innerHTML = h.steps.map((s,i) =>
    '<div class="help-step"><div class="help-step-num">' + (i+1) + '</div><div>' + s + '</div></div>'
  ).join('');
  document.getElementById('help-modal-overlay').classList.remove('hidden');
}
function closeHelpModal(e) {
  if (!e || e.target === document.getElementById('help-modal-overlay')) document.getElementById('help-modal-overlay').classList.add('hidden');
}

// ══════════════════════════════════════════════════════════════
// SETTINGS
// ══════════════════════════════════════════════════════════════
function setTextSize(size, btn) {
  ['text-normal','text-large','text-xlarge','text-xxlarge'].forEach(function(c) { document.body.classList.remove(c); });
  document.body.classList.add('text-' + size);
  document.querySelectorAll('.text-size-btn').forEach(function(b) { b.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  try { localStorage.setItem('rc-textsize', size); } catch(e) {}
}

function setScheme(scheme, btn) {
  document.body.classList.remove('high-contrast', 'night-mode');
  if (scheme === 'contrast') document.body.classList.add('high-contrast');
  if (scheme === 'night')    document.body.classList.add('night-mode');
  document.querySelectorAll('.scheme-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  try { localStorage.setItem('rc-scheme', scheme); } catch(e) {}
}

function saveTruckInfo() {
  const name     = document.getElementById('set-name').value.trim();
  const codriver = document.getElementById('set-codriver').value.trim();
  const year     = document.getElementById('set-year').value.trim();
  const model    = document.getElementById('set-model').value.trim();
  const truckEl = document.querySelector('.header-truck');
  if (truckEl) truckEl.innerHTML = '<strong>' + year + ' ' + model + '</strong>' + name + (codriver ? ' & ' + codriver : '');
  try { localStorage.setItem('rc-truck', JSON.stringify({ name, codriver, year, model })); } catch(e) {}
  alert('Truck info saved!');
}

function saveFuelDefaults() {
  const mpg      = parseFloat(document.getElementById('set-mpg').value) || 6.5;
  const emptyMpg = parseFloat(document.getElementById('set-empty-mpg') ? document.getElementById('set-empty-mpg').value : 8.0) || 8.0;
  const fuel     = parseFloat(document.getElementById('set-fuel').value) || 4.25;
  const minrpm   = parseFloat(document.getElementById('set-minrpm').value) || 2.00;
  const speed    = parseFloat(document.getElementById('set-speed').value) || 55;
  defaults.mpg       = mpg;
  defaults.emptyMpg  = emptyMpg;
  defaults.fuelPrice = fuel;
  defaults.minRpm    = minrpm;
  const cf = document.getElementById('calc-fuel');
  const cm = document.getElementById('calc-mpg');
  if (cf) cf.value = fuel.toFixed(2);
  if (cm) cm.value = mpg.toFixed(1);
  injectProfitBars();
  try { localStorage.setItem('rc-defaults', JSON.stringify({ mpg, emptyMpg, fuel, minrpm, speed })); } catch(e) {}
  alert('Fuel defaults saved! Profit bars updated.');
}

function loadSavedPreferences() {
  try {
    const size = localStorage.getItem('rc-textsize');
    if (size) { const btn = document.getElementById('size-' + size); if (btn) setTextSize(size, btn); }
    const scheme = localStorage.getItem('rc-scheme');
    if (scheme) { const btn = document.getElementById('scheme-' + scheme); if (btn) setScheme(scheme, btn); }
    const savedDefaults = localStorage.getItem('rc-defaults');
    if (savedDefaults) {
      const d = JSON.parse(savedDefaults);
      if (d.mpg)     { defaults.mpg = d.mpg; var mpgEl = document.getElementById('set-mpg'); if (mpgEl) mpgEl.value = d.mpg; }
      if (d.emptyMpg){ defaults.emptyMpg = d.emptyMpg; var emEl = document.getElementById('set-empty-mpg'); if (emEl) emEl.value = d.emptyMpg; }
      if (d.fuel)    { defaults.fuelPrice = d.fuel; var sfEl = document.getElementById('set-fuel'); if (sfEl) sfEl.value = d.fuel; }
      if (d.speed)   { var spEl = document.getElementById('set-speed'); if (spEl) spEl.value = d.speed; }
      if (d.minrpm)  { defaults.minRpm = d.minrpm; var mrEl = document.getElementById('set-minrpm'); if (mrEl) mrEl.value = d.minrpm; }
    }
    // Load parameters from localStorage
    const savedParams = localStorage.getItem('rc-params');
    if (savedParams) {
      const p = JSON.parse(savedParams);
      if (p.minRpm !== undefined)    { defaults.minRpm      = p.minRpm;    var el = document.getElementById('p-rpm');       if (el) el.value = p.minRpm;    var el2 = document.getElementById('set-minrpm'); if (el2) el2.value = p.minRpm; }
      if (p.minGross !== undefined)   { defaults.minGross    = p.minGross;   var el = document.getElementById('p-gross');     if (el) el.value = p.minGross; }
      if (p.minMiles !== undefined)   { defaults.minMiles    = p.minMiles;   var el = document.getElementById('p-minmi');     if (el) el.value = p.minMiles; }
      if (p.maxMiles !== undefined)   { defaults.maxMiles    = p.maxMiles;   var el = document.getElementById('p-maxmi');     if (el) el.value = p.maxMiles; }
      if (p.maxDead !== undefined)    { defaults.maxDeadhead = p.maxDead;    var el = document.getElementById('p-maxdead');   if (el) el.value = p.maxDead; }
      if (p.maxWeight !== undefined)  { defaults.maxWeight   = p.maxWeight;  var el = document.getElementById('p-maxweight'); if (el) el.value = p.maxWeight; }
      if (p.equipType)  { window._rcEquipmentType = p.equipType; var el = document.getElementById('p-equipment'); if (el) el.value = p.equipType; }
      if (p.loadType)   { window._rcLoadType = p.loadType; var el = document.getElementById('p-loadtype');  if (el) el.value = p.loadType; }
      if (p.homeBase)   { var el = document.getElementById('p-home');      if (el) el.value = p.homeBase; }
      if (p.originStates) { var el = document.getElementById('p-origins'); if (el) el.value = p.originStates; }
      if (p.destStates)   { var el = document.getElementById('p-dests');   if (el) el.value = p.destStates; }
      if (p.fuel !== undefined) { defaults.fuelPrice = p.fuel; var el = document.getElementById('calc-fuel'); if (el) el.value = p.fuel; var el2 = document.getElementById('set-fuel'); if (el2) el2.value = p.fuel; }
      if (p.mpg !== undefined)  { defaults.mpg = p.mpg;   var el = document.getElementById('calc-mpg');  if (el) el.value = p.mpg;  var el2 = document.getElementById('set-mpg');  if (el2) el2.value = p.mpg; }
    }
    const truck = localStorage.getItem('rc-truck');
    if (truck) {
      const t = JSON.parse(truck);
      if (t.name)     document.getElementById('set-name').value = t.name;
      if (t.codriver) document.getElementById('set-codriver').value = t.codriver;
      if (t.year)     document.getElementById('set-year').value = t.year;
      if (t.model)    document.getElementById('set-model').value = t.model;
      const truckEl = document.querySelector('.header-truck');
      if (truckEl && t.year && t.model) truckEl.innerHTML = '<strong>' + t.year + ' ' + t.model + '</strong>' + t.name + (t.codriver ? ' & ' + t.codriver : '');
    }
  } catch(e) {}
  loadSavedHOS();
}

async function savePreferencesToSupabase() {
  if (!window._rcUserId || !window._supabaseReady) return;
  try {
    await _supabase.from('user_preferences').upsert({
      user_id:       window._rcUserId,
      min_rpm:       defaults.minRpm       || 2.00,
      min_gross:     defaults.minGross     || 1500,
      min_miles:     defaults.minMiles     || 500,
      max_miles:     defaults.maxMiles     || 2000,
      max_deadhead:  defaults.maxDeadhead  || 150,
      mpg:           defaults.mpg          || 6.5,
      empty_mpg:     defaults.emptyMpg     || 8.0,
      fuel_price:    defaults.fuelPrice    || 4.25,
      equipment_type: window._rcEquipmentType || 'V',
      updated_at:    new Date().toISOString(),
    }, { onConflict: 'user_id' });
  } catch(err) { console.error('Error saving preferences:', err); }
}

async function loadPreferencesFromSupabase() {
  if (!window._rcUserId || !window._supabaseReady) return;
  try {
    var { data, error } = await _supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', window._rcUserId)
      .maybeSingle();
    if (error || !data) return;

    // Apply to defaults
    if (data.min_rpm)      defaults.minRpm      = parseFloat(data.min_rpm);
    if (data.min_gross)    defaults.minGross    = parseFloat(data.min_gross);
    if (data.min_miles)    defaults.minMiles    = parseInt(data.min_miles);
    if (data.max_miles)    defaults.maxMiles    = parseInt(data.max_miles);
    if (data.max_deadhead) defaults.maxDeadhead = parseInt(data.max_deadhead);
    if (data.mpg)          defaults.mpg         = parseFloat(data.mpg);
    if (data.empty_mpg)    defaults.emptyMpg    = parseFloat(data.empty_mpg);
    if (data.fuel_price)   defaults.fuelPrice   = parseFloat(data.fuel_price);
    if (data.equipment_type) window._rcEquipmentType = data.equipment_type;

    // Update UI fields
    var fields = {
      'p-rpm':       data.min_rpm,
      'set-minrpm':  data.min_rpm,
      'p-gross':     data.min_gross,
      'p-minmi':     data.min_miles,
      'p-maxmi':     data.max_miles,
      'p-maxdead':   data.max_deadhead,
      'set-mpg':     data.mpg,
      'set-empty-mpg': data.empty_mpg,
      'set-fuel':    data.fuel_price,
      'calc-fuel':   data.fuel_price,
      'calc-mpg':    data.mpg,
    };
    Object.keys(fields).forEach(function(id) {
      var el = document.getElementById(id);
      if (el && fields[id]) el.value = fields[id];
    });

    // Also save to localStorage as backup
    try {
      localStorage.setItem('rc-params', JSON.stringify({
        minrpm:   data.min_rpm,
        minGross: data.min_gross,
        minMiles: data.min_miles,
        maxMiles: data.max_miles,
        maxDead:  data.max_deadhead,
        fuel:     data.fuel_price,
        mpg:      data.mpg,
      }));
    } catch(e) {}

    console.log('Preferences loaded from Supabase');
  } catch(err) { console.error('Error loading preferences:', err); }
}



document.addEventListener('DOMContentLoaded', function() {
  var nav = document.getElementById('bottom-nav');
  if (nav) nav.addEventListener('scroll', function() { var hint = document.getElementById('swipe-hint'); if (hint) hint.style.display = 'none'; }, { once: true });
});

// ══════════════════════════════════════════════════════════════
// BROKER DATABASE
// ══════════════════════════════════════════════════════════════
var BROKER_DB = {
  "ch robinson":   { score:"A+", days:22, flags:[{t:"good",i:"✅",m:"Pays consistently on time"},{t:"good",i:"✅",m:"Top credit rating"},{t:"warn",i:"⚠️",m:"Large volume broker — negotiate hard"}], rec:"Solid broker. Book with confidence. Push for $0.15 to $0.25 above first offer." },
  "echo global":   { score:"A",  days:27, flags:[{t:"good",i:"✅",m:"Good payment history"},{t:"warn",i:"⚠️",m:"Low first offers on competitive lanes"}], rec:"Reliable. Counter at 10 percent above their initial offer." },
  "coyote":        { score:"A",  days:25, flags:[{t:"good",i:"✅",m:"Strong credit rating"},{t:"good",i:"✅",m:"24/7 availability"}], rec:"Good broker. Fair rates. Push back once on spot loads." },
  "xpo":           { score:"B+", days:31, flags:[{t:"warn",i:"⚠️",m:"Occasional delays at month end"},{t:"good",i:"✅",m:"High load volume"}], rec:"Acceptable. Get rate confirmation in writing before loading." },
  "convoy":        { score:"B",  days:35, flags:[{t:"warn",i:"⚠️",m:"Payment can run 30 to 45 days"},{t:"warn",i:"⚠️",m:"App based — limited personal service"}], rec:"Use for backhauls only. Factor payment terms into your rate." },
  "uber freight":  { score:"B",  days:33, flags:[{t:"warn",i:"⚠️",m:"Digital broker — rate usually firm"},{t:"good",i:"✅",m:"Fast booking"}], rec:"Rate is usually firm. Good for quick backhauls." },
  "total quality": { score:"A",  days:24, flags:[{t:"good",i:"✅",m:"Fast payment"},{t:"good",i:"✅",m:"Good to work with"}], rec:"Reliable broker. Accept or push lightly." },
  "j.b. hunt":     { score:"A+", days:20, flags:[{t:"good",i:"✅",m:"Excellent payment history"},{t:"good",i:"✅",m:"Large stable company"}], rec:"Very reliable. Strong rates on dedicated lanes." },
  "landstar":      { score:"A+", days:21, flags:[{t:"good",i:"✅",m:"Top tier credit"},{t:"good",i:"✅",m:"Agent based — negotiate with agent directly"}], rec:"Push the agent for an extra 5 to 10 percent. They have flexibility." },
};

function lookupBroker() {
  var q = document.getElementById("broker-search").value.trim().toLowerCase();
  var result = document.getElementById("broker-result");
  if (!q) return;
  var match = null;
  var keys = Object.keys(BROKER_DB);
  for (var k = 0; k < keys.length; k++) {
    if (q.indexOf(keys[k]) >= 0 || keys[k].indexOf(q) >= 0) { match = BROKER_DB[keys[k]]; break; }
  }
  if (!match) {
    match = { score:"N/A", days:"?", flags:[{t:"warn",i:"⚠️",m:"Broker not in database — verify on Truckstop"},{t:"warn",i:"⚠️",m:"Check credit score before loading"},{t:"warn",i:"⚠️",m:"Get signed rate confirmation before accepting"}], rec:"Unknown broker. Check their Truckstop credit rating. Always get payment terms in writing." };
  }
  var scoreColor = match.score.indexOf("A") === 0 ? "var(--green)" : match.score.indexOf("B") === 0 ? "var(--amber)" : "var(--red)";
  var daysColor  = match.days <= 28 ? "var(--green)" : match.days <= 35 ? "var(--amber)" : "var(--red)";
  document.getElementById("b-score").textContent = match.score;
  document.getElementById("b-score").style.color = scoreColor;
  document.getElementById("b-days").textContent = match.days;
  document.getElementById("b-days").style.color = daysColor;
  document.getElementById("broker-flags").innerHTML = match.flags.map(function(f) { return '<div class="broker-flag"><span class="flag-icon">' + f.i + '</span><span class="flag-' + f.t + '">' + f.m + '</span></div>'; }).join("");
  document.getElementById("broker-rec").textContent = "💡 " + match.rec;
  result.style.display = "block";
}

var LANE_RATES = {
  "WA-CA":2.45,"WA-OR":1.95,"WA-ID":2.05,"WA-UT":2.25,"WA-NV":2.35,"WA-TX":2.55,"WA-CO":2.35,"WA-AZ":2.40,"WA-MT":2.10,
  "OR-CA":2.30,"OR-ID":2.00,"OR-WA":1.95,"OR-UT":2.20,"OR-TX":2.50,"OR-CO":2.30,
  "ID-WA":2.05,"ID-OR":2.00,"ID-UT":2.10,"ID-CA":2.40,"ID-TX":2.48,"ID-MT":2.00,"ID-CO":2.20,
  "UT-WA":2.25,"UT-CA":2.38,"UT-TX":2.30,"UT-NV":2.12,"UT-ID":2.10,"UT-CO":2.05,"UT-AZ":2.15,
  "CA-WA":2.20,"CA-OR":2.15,"CA-NV":1.90,"CA-AZ":1.95,"CA-UT":2.05,"CA-TX":2.35,
  "TX-WA":2.60,"TX-CA":2.40,"TX-UT":2.25,"TX-OK":1.85,"TX-NM":1.90,"TX-CO":2.20,"TX-KS":1.95,
  "NV-CA":1.85,"NV-WA":2.30,"NV-UT":2.05,"NV-AZ":1.95,
  "MT-WA":2.15,"MT-ID":2.00,"MT-UT":2.20,"MT-CO":2.25,"MT-WY":2.10,
  "CO-WA":2.35,"CO-CA":2.42,"CO-TX":2.20,"CO-UT":2.05,"CO-KS":2.00,"CO-NM":2.05,
  "AZ-CA":2.00,"AZ-NV":1.90,"AZ-UT":2.10,"AZ-TX":2.25,"AZ-NM":2.00,
  "NM-TX":1.90,"NM-CO":2.05,"NM-AZ":2.00,"NM-CA":2.20,
  "WY-WA":2.20,"WY-UT":2.05,"WY-CO":2.10,"WY-MT":2.10,
  "OK-TX":1.85,"OK-KS":1.80,"OK-CO":2.00,
  "KS-TX":1.90,"KS-CO":2.00,"KS-OK":1.80,
};

// ══════════════════════════════════════════════════════════════
// GET SCRIPT — merged Rate Coach + AI Script (Change 3)
// ══════════════════════════════════════════════════════════════
var _aiScriptGenerating = false;

async function getScript() {
  if (_aiScriptGenerating) return;
  var origin  = document.getElementById("neg-origin").value;
  var dest    = document.getElementById("neg-dest").value;
  var offer   = parseFloat(document.getElementById("neg-offer").value);
  var miles   = parseFloat(document.getElementById("neg-miles").value);
  var broker  = document.getElementById("neg-broker-name") ? document.getElementById("neg-broker-name").value.trim() : "";
  if (!origin || !dest || !offer || !miles) { alert("Fill in origin, destination, offer, and miles first."); return; }
  track('negotiation_script_requested', { origin: origin, dest: dest, offer: offer, miles: miles, broker: broker });

  var key = origin + "-" + dest, revKey = dest + "-" + origin;
  var marketRpm = LANE_RATES[key] || LANE_RATES[revKey] || 2.15;
  var marketTotal = Math.round(marketRpm * miles);
  var offerRpm = offer / miles;
  var counterRpm = Math.max(marketRpm, offerRpm + 0.15);
  var counterTotal = Math.round(counterRpm * miles);
  var gap = marketTotal - offer;
  var diff = offerRpm - marketRpm;
  var assessment;
  if (diff >= 0.15)       { assessment = "✅ Strong Offer — Above Market"; }
  else if (diff >= -0.10) { assessment = "⚠️ At Market — Push Back Once"; }
  else                    { assessment = "❌ Below Market — Hold Firm"; }

  var brokerInfo = "", brokerRec = "";
  if (broker) {
    var bKey = broker.toLowerCase(), bData = null, keys = Object.keys(BROKER_DB);
    for (var k = 0; k < keys.length; k++) { if (bKey.indexOf(keys[k]) >= 0 || keys[k].indexOf(bKey) >= 0) { bData = BROKER_DB[keys[k]]; break; } }
    if (bData) {
      brokerInfo = "Broker credit score: " + bData.score + ". Average days to pay: " + bData.days + " days. Notes: " + bData.flags.map(function(f) { return f.m; }).join(", ") + ".";
      brokerRec  = bData.rec;
    }
  }

  var output = document.getElementById("neg-script-output");
  if (!output) return;

  var scoreColor = diff >= 0.15 ? "var(--green)" : diff >= -0.10 ? "var(--amber)" : "var(--red)";
  output.innerHTML =
    '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:4px;padding:.8rem;margin-bottom:.8rem;">' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.6rem;margin-bottom:.6rem;">' +
        '<div class="metric" style="padding:.6rem;"><div class="metric-val" style="font-size:1.1rem;">$' + marketRpm.toFixed(2) + '/mi</div><div class="metric-label">Market Rate</div></div>' +
        '<div class="metric" style="padding:.6rem;"><div class="metric-val amber" style="font-size:1.1rem;">$' + offerRpm.toFixed(2) + '/mi</div><div class="metric-label">Offer RPM</div></div>' +
        '<div class="metric" style="padding:.6rem;"><div class="metric-val" style="font-size:1.1rem;color:var(--green);">$' + counterTotal.toLocaleString() + '</div><div class="metric-label">Counter At</div></div>' +
      '</div>' +
      '<div style="font-size:.82rem;font-weight:bold;color:' + scoreColor + ';margin-bottom:.3rem;">' + assessment + '</div>' +
      (brokerRec ? '<div style="font-size:.78rem;color:#b8c8b8;font-style:italic;">💡 ' + brokerRec + '</div>' : '') +
    '</div>' +
    '<div id="neg-ai-output"><div style="color:var(--green);font-size:.85rem;padding:.5rem 0;">🤖 Building your script...</div></div>';
  output.style.display = "block";
  _aiScriptGenerating = true;

  var prompt = "You are an expert freight broker negotiation coach helping an owner-operator trucker get the best rate. Generate a word-for-word phone script for this situation:\n\nLoad details:\n- Origin: " + origin + "\n- Destination: " + dest + "\n- Miles: " + miles + "\n- Broker offer: $" + offer + " ($" + offerRpm.toFixed(2) + "/mile)\n- Market rate for this lane: $" + marketTotal + " ($" + marketRpm.toFixed(2) + "/mile)\n- Gap: $" + Math.abs(gap) + " " + (gap > 0 ? "below market" : "above market") + (broker ? "\n- Broker name: " + broker : "") + (brokerInfo ? "\n- " + brokerInfo : "") + "\n\nGenerate a confident, natural-sounding phone script that:\n1. Acknowledges the offer professionally\n2. Uses market data as leverage\n3. Makes a specific counter-offer at market rate\n4. Includes a psychological close\n5. Has a fallback position if they push back\n\nFormat as: [Opening] then [Counter] then [Close] then [If they push back]. Keep it conversational, confident, and under 150 words total.";

  var aiOutputEl = document.getElementById("neg-ai-output");
  try {
    var aiWorkerUrl = window._rcAIWorker, aiEndpoint = aiWorkerUrl || "https://api.anthropic.com/v1/messages";
    var aiHeaders = aiWorkerUrl ? { "Content-Type": "application/json" } : { "Content-Type": "application/json", "x-api-key": window._rcAnthropicKey || "", "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" };
    var response = await fetch(aiEndpoint, { method: "POST", headers: aiHeaders, body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 400, messages: [{ role: "user", content: prompt }] }) });
    var data = await response.json();
    if (data.content && data.content[0] && data.content[0].text) {
      aiOutputEl.innerHTML =
        '<div style="background:var(--surface2);border:1px solid var(--green-border);border-radius:4px;padding:1rem;">' +
          '<div style="font-size:.7rem;color:var(--green);text-transform:uppercase;letter-spacing:.1em;margin-bottom:.6rem;">🤖 Word-for-Word Script</div>' +
          '<div style="font-size:.88rem;line-height:1.8;color:var(--text);white-space:pre-wrap;">' + data.content[0].text + '</div>' +
          AI_SCRIPT_DISCLAIMER +
          '<div style="margin-top:.8rem;display:flex;gap:.5rem;"><button class="btn btn-sm btn-outline" onclick="copyNegScript()">📋 Copy</button><button class="btn btn-sm btn-outline" onclick="getScript()">🔄 Regenerate</button></div>' +
        '</div>';
    } else if (data.error) throw new Error(data.error.message || "API error");
  } catch(err) {
    var fallbackScript = buildFallbackScript(origin, dest, offer, miles, broker, marketRpm, marketTotal, gap);
    aiOutputEl.innerHTML =
      '<div style="background:var(--surface2);border:1px solid var(--amber-dim);border-radius:4px;padding:1rem;">' +
        '<div style="font-size:.7rem;color:var(--amber);text-transform:uppercase;letter-spacing:.1em;margin-bottom:.6rem;">📋 Negotiation Script</div>' +
        '<div style="font-size:.88rem;line-height:1.8;color:var(--text);white-space:pre-wrap;">' + fallbackScript + '</div>' +
        AI_SCRIPT_DISCLAIMER +
        '<div style="margin-top:.8rem;"><button class="btn btn-sm btn-outline" onclick="copyNegScript()">📋 Copy</button></div>' +
      '</div>';
  }
  _aiScriptGenerating = false;
}

// Alias — keeps any old references working
async function generateNegScript() { return getScript(); }

function buildFallbackScript(origin, dest, offer, miles, broker, marketRpm, marketTotal, gap) {
  var brokerName = broker || "there", counterTotal = marketTotal, softCounter = Math.round(marketTotal * 0.97);
  if (gap <= 0) return "Hey " + brokerName + ", I appreciate you reaching out on this one. Your offer of $" + offer.toLocaleString() + " on the " + origin + " to " + dest + " lane looks solid — that is right at market for me. Let me get my paperwork in order and we can get this booked. Send over the rate con and I will sign it today.";
  else if (gap <= 100) return "Hey " + brokerName + ", thanks for thinking of me on this " + origin + " to " + dest + " load. I am looking at your offer of $" + offer.toLocaleString() + " — I am just a little short of where I need to be. Market on this lane is running $" + marketRpm.toFixed(2) + " a mile right now. If you can get me to $" + counterTotal.toLocaleString() + " I can have wheels rolling today. Can you make that work?\n\nIf they push back: I can meet you at $" + softCounter.toLocaleString() + " but that is my floor on this one.";
  else return "Hey " + brokerName + ", I appreciate the call on this " + origin + " to " + dest + " load. I have to be honest — $" + offer.toLocaleString() + " is pretty far from where the market is sitting right now. I am seeing $" + marketRpm.toFixed(2) + " a mile on this lane consistently, which puts us at $" + counterTotal.toLocaleString() + ". That is what I need to make this work.\n\nIf they push back: My absolute floor is $" + softCounter.toLocaleString() + " — below that I am better off waiting for the next load. What can you do?\n\nIf they still push back: I appreciate your time. Let me know if your market changes — I would love to work with you on the next one.";
}

function copyNegScript() {
  var output = document.getElementById("neg-script-output"); if (!output) return;
  var text = output.querySelector("div[style*='pre-wrap']"); if (!text) return;
  navigator.clipboard.writeText(text.textContent).then(function() { alert("Script copied to clipboard!"); }).catch(function() { var range = document.createRange(); range.selectNodeContents(text); window.getSelection().removeAllRanges(); window.getSelection().addRange(range); });
}

var NEARBY_LOADS = {
  "salt lake city":[{route:"Salt Lake City, UT → Las Vegas, NV",miles:421,rate:1050,rpm:2.49},{route:"Salt Lake City, UT → Boise, ID",miles:340,rate:820,rpm:2.41},{route:"Salt Lake City, UT → Denver, CO",miles:525,rate:1155,rpm:2.20},{route:"Salt Lake City, UT → Phoenix, AZ",miles:673,rate:1413,rpm:2.10}],
  "portland":[{route:"Portland, OR → Seattle, WA",miles:178,rate:445,rpm:2.50},{route:"Portland, OR → Boise, ID",miles:428,rate:1005,rpm:2.35},{route:"Portland, OR → Sacramento, CA",miles:580,rate:1392,rpm:2.40}],
  "boise":[{route:"Boise, ID → Moses Lake, WA",miles:302,rate:695,rpm:2.30},{route:"Boise, ID → Salt Lake City, UT",miles:340,rate:782,rpm:2.30},{route:"Boise, ID → Portland, OR",miles:428,rate:940,rpm:2.20}],
  "pasco":[{route:"Pasco, WA → Moses Lake, WA",miles:82,rate:205,rpm:2.50},{route:"Pasco, WA → Spokane, WA",miles:143,rate:350,rpm:2.45},{route:"Pasco, WA → Portland, OR",miles:215,rate:505,rpm:2.35}],
  "spokane":[{route:"Spokane, WA → Moses Lake, WA",miles:100,rate:250,rpm:2.50},{route:"Spokane, WA → Portland, OR",miles:350,rate:805,rpm:2.30},{route:"Spokane, WA → Boise, ID",miles:305,rate:700,rpm:2.30}],
  "las vegas":[{route:"Las Vegas, NV → Los Angeles, CA",miles:270,rate:620,rpm:2.30},{route:"Las Vegas, NV → Salt Lake City, UT",miles:421,rate:970,rpm:2.30},{route:"Las Vegas, NV → Phoenix, AZ",miles:297,rate:680,rpm:2.29}],
  "denver":[{route:"Denver, CO → Salt Lake City, UT",miles:525,rate:1155,rpm:2.20},{route:"Denver, CO → Albuquerque, NM",miles:450,rate:990,rpm:2.20},{route:"Denver, CO → Kansas City, MO",miles:600,rate:1320,rpm:2.20}],
  "default":[{route:"Nearby → Moses Lake, WA",miles:200,rate:480,rpm:2.40},{route:"Nearby → Spokane, WA",miles:250,rate:575,rpm:2.30},{route:"Nearby → Portland, OR",miles:350,rate:805,rpm:2.30}]
};

// ══════════════════════════════════════════════════════════════
// EXPAND LOAD PANEL — with auto HOS, broker badge, Route Intel
// ══════════════════════════════════════════════════════════════
function toggleExpand(panelId) {
  var panel = document.getElementById(panelId);
  var arrow = document.getElementById("arrow_" + panelId);
  if (!panel) return;
  var isOpen = panel.classList.contains("open");
  document.querySelectorAll(".load-expand-panel.open").forEach(function(p) { p.classList.remove("open"); });
  document.querySelectorAll(".expand-arrow.open").forEach(function(a) { a.classList.remove("open"); });
  if (!isOpen) {
    panel.classList.add("open");
    if (arrow) arrow.classList.add("open");
    var rate  = parseInt(panel.dataset.rate  || 0);
    var miles = parseInt(panel.dataset.miles || 0);
    if (rate && miles) recalcPanel(panelId, rate, miles);
  }
}

function recalcPanel(panelId, rate, miles) {
  var fuelPrice = (window._df && window._df.fuelPrice) ? window._df.fuelPrice : defaults.fuelPrice;
  var mpg       = (window._df && window._df.mpg)       ? window._df.mpg       : defaults.mpg;
  var emptyMpg  = defaults.emptyMpg || 8.0;
  var panel = document.getElementById(panelId);
  var pickupCity = panel ? (panel.dataset.pickup || "") : "";
  var broker     = panel ? (panel.dataset.broker || "") : "";
  var dest       = panel ? (panel.dataset.dest   || "") : "";
  var deadMiles = 0;
  if (pickupCity && window._gpsLat) deadMiles = getDeadheadMiles(pickupCity);
  if (!deadMiles) { var dhInput = document.getElementById("drop-dead"); deadMiles = dhInput ? (parseFloat(dhInput.value) || 0) : 0; }
  var totalMiles = miles + deadMiles;
  var loadedFuel = Math.round((miles / mpg) * fuelPrice);
  var deadFuel   = Math.round((deadMiles / emptyMpg) * fuelPrice);
  var fuelCost   = loadedFuel + deadFuel;
  var net        = rate - fuelCost;
  var npm        = (net / totalMiles).toFixed(2);
  var rpm        = (rate / miles).toFixed(2);
  var tier, verdictText;
  var minR = defaults.minRpm || 2.00;
  if (parseFloat(rpm) >= minR && parseFloat(rpm) >= 2.30)  { tier = "strong"; verdictText = "✅ Strong"; }
  else if (parseFloat(rpm) >= minR)                         { tier = "ok";     verdictText = "⚠️ Acceptable"; }
  else                                                       { tier = "weak";   verdictText = "❌ Below Minimum"; }
  var fuelEl = document.getElementById("fuel_" + panelId);
  if (fuelEl) {
    if (deadMiles > 0) {
      fuelEl.textContent = '-$' + fuelCost.toLocaleString();
      fuelEl.title = 'Loaded fuel: $' + loadedFuel + ' · Deadhead fuel: $' + deadFuel + ' (' + deadMiles + ' mi empty)';
      // Show breakdown below
      var fuelBreakdown = fuelEl.nextElementSibling;
      if (!fuelBreakdown || !fuelBreakdown.classList.contains('fuel-breakdown')) {
        fuelBreakdown = document.createElement('div');
        fuelBreakdown.className = 'fuel-breakdown';
        fuelBreakdown.style.cssText = 'font-size:.68rem;color:#b8c8b8;margin-top:.1rem;';
        fuelEl.parentNode.appendChild(fuelBreakdown);
      }
      fuelBreakdown.textContent = '$' + loadedFuel + ' loaded + $' + deadFuel + ' DH';
    } else {
      fuelEl.textContent = '-$' + fuelCost.toLocaleString();
      var fuelBreakdown = fuelEl.nextElementSibling;
      if (fuelBreakdown && fuelBreakdown.classList.contains('fuel-breakdown')) fuelBreakdown.remove();
    }
  }
  var netEl = document.getElementById("net_" + panelId);
  if (netEl) { netEl.textContent = (net >= 0 ? "$" : "-$") + Math.abs(net).toLocaleString(); netEl.className = "expand-val " + (net >= 0 ? "green" : "red"); }
  var npmEl = document.getElementById("npm_" + panelId);
  if (npmEl) { npmEl.textContent = "$" + npm + "/mi"; npmEl.className = "expand-val " + (parseFloat(npm) >= 1.50 ? "green" : "amber"); }
  var verdictEl = document.getElementById("verdict_" + panelId);
  if (verdictEl) {
    verdictEl.textContent = verdictText;
    verdictEl.className = "expand-verdict " + tier;
    if (!verdictEl.nextElementSibling || !verdictEl.nextElementSibling.classList.contains('ai-disclaimer')) {
      verdictEl.insertAdjacentHTML('afterend', AI_DISCLAIMER);
    }
  }

  // ── AUTO: Broker badge (Change 2) ──────────────────────────
  var brokerBadgeEl = document.getElementById("broker-badge_" + panelId);
  if (brokerBadgeEl && broker) {
    brokerBadgeEl.innerHTML = getBrokerBadgeHTML(broker);
  }

  // ── AUTO: HOS verdict (Change 1) ───────────────────────────
  var hosEl = document.getElementById("hos_" + panelId);
  if (hosEl) {
    hosEl.innerHTML = calcHOSVerdict(miles);
  }

  checkDeadhead(panelId, rate, miles);

  // ── Route Intel button (Change 4) — inject once if dest set
  if (!document.getElementById('route-intel-btn_' + panelId) && dest) {
    var insertTarget = verdictEl ? verdictEl : (panel ? panel.querySelector('.expand-notes') : null);
    if (insertTarget) {
      var riDiv = document.createElement('div');
      riDiv.style.cssText = 'margin-top:.5rem;';
      riDiv.innerHTML =
        '<button class="btn btn-sm btn-outline route-intel-card-btn" ' +
          'id="route-intel-btn_' + panelId + '" ' +
          'data-dest="' + dest + '" data-panel="' + panelId + '" ' +
          'style="font-size:.75rem;color:#7ab8ff;border-color:rgba(122,184,255,.35);">' +
          '🗺️ Route Intel — ' + dest +
        '</button>' +
        '<div id="route-intel-result_' + panelId + '" style="display:none;margin-top:.4rem;"></div>';
      var disclaimer = verdictEl ? verdictEl.nextElementSibling : null;
      var insertAfter = (disclaimer && disclaimer.classList && disclaimer.classList.contains('ai-disclaimer')) ? disclaimer : insertTarget;
      if (insertAfter.parentNode) {
        insertAfter.parentNode.insertBefore(riDiv, insertAfter.nextSibling);
      }
    }
  }

  // ── AI Decide button ────────────────────────────────────────
  if (window._rcAIWorker || window._rcAnthropicKey) {
    var ve = document.getElementById('verdict_' + panelId);
    var aiBtn = document.getElementById('ai-decide-' + panelId);
    if (ve && !aiBtn) {
      var p2 = document.getElementById(panelId);
      var pickup2 = p2 ? (p2.dataset.pickup || '') : '';
      var broker2 = p2 ? (p2.dataset.broker || '') : '';
      var aiDiv = document.createElement('div');
      aiDiv.style.cssText = 'margin-top:.5rem;display:flex;gap:.5rem;flex-wrap:wrap;align-items:center;';
      var aiBtnEl = document.createElement('button');
      aiBtnEl.className = 'btn btn-sm ai-decide-btn';
      aiBtnEl.id = 'ai-decide-' + panelId;
      aiBtnEl.style.cssText = 'background:var(--green-dim);border:1px solid var(--green-border);color:var(--green);font-size:.75rem;';
      aiBtnEl.textContent = '🤖 AI Decision';
      aiBtnEl.dataset.panelId = panelId;
      aiBtnEl.dataset.rate = rate;
      aiBtnEl.dataset.miles = miles;
      aiBtnEl.dataset.broker = broker2 || '';
      aiBtnEl.dataset.pickup = pickup2 || '';
      var aiResult = document.createElement('div');
      aiResult.id = 'ai-decide-result-' + panelId;
      aiResult.style.cssText = 'display:none;flex:1;min-width:100%;';
      aiDiv.appendChild(aiBtnEl);
      aiDiv.appendChild(aiResult);
      var notesEl = panel ? panel.querySelector('.expand-notes') : null;
      if (notesEl) panel.insertBefore(aiDiv, notesEl);
      else if (panel) panel.appendChild(aiDiv);
    }
  }
}

function bookLoad(btn, origin, dest, rate, miles, broker, phone) {
  // Mark card as booked immediately
  var card = btn.closest(".load-card");
  if (card) {
    card.className = card.className.replace(/hot|watch/, "booked");
    card.querySelectorAll(".load-tag").forEach(function(t) { t.className = "load-tag tag-booked"; t.textContent = "Booked"; });
  }

  // Show actual pay confirmation modal
  showBookConfirmModal(origin, dest, rate, miles, broker, phone);
}

function showBookConfirmModal(origin, dest, rate, miles, broker, phone) {
  // Remove any existing modal
  var existing = document.getElementById('book-confirm-modal');
  if (existing) existing.remove();

  var rpm     = miles > 0 ? (rate / miles).toFixed(2) : '0.00';
  var fuelEst = Math.round((miles / (defaults.mpg || 6.5)) * (defaults.fuelPrice || 4.25));
  var netEst  = rate - fuelEst;
  var today   = new Date().toISOString().split('T')[0];

  var modal = document.createElement('div');
  modal.id  = 'book-confirm-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:950;display:flex;align-items:flex-end;padding:1rem;';
  modal.innerHTML =
    '<div style="background:var(--surface);border:1px solid var(--green-border);border-radius:8px;width:100%;max-width:480px;margin:0 auto;padding:1.5rem;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">' +
        '<div style="font-size:1rem;font-weight:bold;color:var(--green);">✓ Confirm Booking</div>' +
        '<button onclick="document.getElementById(\'book-confirm-modal\').remove()" style="background:none;border:none;color:#b8c8b8;font-size:1.2rem;cursor:pointer;">✕</button>' +
      '</div>' +
      '<div style="background:var(--surface2);border-radius:4px;padding:.8rem;margin-bottom:1rem;font-size:.85rem;">' +
        '<div style="font-weight:bold;color:var(--text);margin-bottom:.3rem;">' + origin + ' → ' + dest + '</div>' +
        '<div style="color:#b8c8b8;">' + broker + ' · ' + miles + ' mi · $' + rpm + '/mi</div>' +
      '</div>' +
      '<div style="margin-bottom:1rem;">' +
        '<label class="form-label">Actual Pay — did you negotiate a better rate?</label>' +
        '<input class="form-input" id="book-actual-pay" type="number" value="' + rate + '" style="font-size:1.3rem;text-align:center;font-weight:bold;">' +
        '<div style="display:flex;justify-content:space-between;margin-top:.4rem;font-size:.75rem;color:#b8c8b8;">' +
          '<span>Posted: $' + rate.toLocaleString() + '</span>' +
          '<span>Est. net: $' + netEst.toLocaleString() + '</span>' +
          '<span>Fuel est: $' + fuelEst.toLocaleString() + '</span>' +
        '</div>' +
      '</div>' +
      '<div style="margin-bottom:1rem;">' +
        '<label class="form-label">Payment Terms</label>' +
        '<select class="form-select" id="book-terms">' +
          '<option value="15">Net 15</option>' +
          '<option value="30" selected>Net 30</option>' +
          '<option value="45">Net 45</option>' +
          '<option value="60">Net 60</option>' +
        '</select>' +
      '</div>' +
      '<div style="font-size:.75rem;color:#b8c8b8;margin-bottom:1rem;">📎 You can attach your Rate Con and BOL after booking in the Money tab.</div>' +
      '<div style="display:flex;gap:.5rem;">' +
        '<button class="btn btn-green" onclick="confirmBooking(\'' + origin + '\',\'' + dest + '\',' + rate + ',' + miles + ',\'' + broker + '\',\'' + phone + '\')" style="flex:1;font-size:1rem;">✓ Book It</button>' +
        '<button class="btn btn-outline" onclick="document.getElementById(\'book-confirm-modal\').remove()" style="flex:1;">Cancel</button>' +
      '</div>' +
    '</div>';

  document.body.appendChild(modal);

  // Focus and select the pay input
  setTimeout(function() {
    var input = document.getElementById('book-actual-pay');
    if (input) { input.focus(); input.select(); }
  }, 100);
}

async function confirmBooking(origin, dest, postedRate, miles, broker, phone) {
  var actualPay = parseFloat(document.getElementById('book-actual-pay').value) || postedRate;
  var terms     = parseInt(document.getElementById('book-terms').value) || 30;
  var today     = new Date().toISOString().split('T')[0];
  var dueDate   = new Date();
  dueDate.setDate(dueDate.getDate() + terms);
  var dueDateStr = dueDate.toISOString().split('T')[0];
  var ref        = origin + ' to ' + dest;

  // Close modal
  var modal = document.getElementById('book-confirm-modal');
  if (modal) modal.remove();

  // 1. Auto-add broker to vault if not already there
  var brokerId = await ensureBrokerInVault(broker, phone, terms);

  // 2. Create invoice automatically
  var inv = {
    broker:    broker,
    broker_id: brokerId,
    amount:    actualPay,
    ref:       ref,
    date:      today,
    terms:     terms,
    phone:     phone,
    dueDate:   dueDateStr,
    status:    'pending',
    id:        Date.now(),
    notes:     'Booked via RoadCommand · ' + miles + ' mi · $' + (actualPay / miles).toFixed(2) + '/mi',
  };

  invoices.unshift(inv);
  renderInvoices();

  // Save to Supabase
  var saved = await saveInvoiceToSupabase(inv);
  var idx = invoices.findIndex(function(i) { return i.id === inv.id; });
  if (idx >= 0 && saved) invoices[idx] = saved;

  renderBrokers();
  updateMoneyTotals();

  // 3. Track
  track('load_booked', {
    rate:   actualPay,
    posted: postedRate,
    miles:  miles,
    rpm:    parseFloat((actualPay / miles).toFixed(2)),
    origin: origin,
    dest:   dest,
    broker: broker,
    negotiated: actualPay > postedRate,
  });

  // 4. Show success toast
  showBookingToast(actualPay, postedRate, broker);

  // 5. Log run
  promptLogRun(origin, dest, actualPay, miles);

  // 7. Save booked load to Supabase for Loadback push notifications
  await saveBookedLoadForLoadback(origin, dest, actualPay, miles, broker);

  // 8. Show loadback
  showLoadback(origin, dest, actualPay, miles, broker, phone);
}

async function ensureBrokerInVault(brokerName, phone, terms) {
  if (!window._rcUserId || !window._supabaseReady) return null;

  // Check if broker already exists
  var existing = _brokers.find(function(b) {
    return b.name.toLowerCase() === brokerName.toLowerCase();
  });
  if (existing) return existing.id;

  // Add broker to vault
  try {
    var { data, error } = await _supabase.from('brokers').insert({
      user_id:       window._rcUserId,
      name:          brokerName,
      phone:         phone || '',
      payment_terms: terms || 30,
      notes:         'Auto-added when load was booked via RoadCommand',
    }).select().single();

    if (error) throw error;
    _brokers.push(data);
    populateBrokerDropdown();
    return data.id;
  } catch(err) {
    console.error('Error adding broker to vault:', err);
    return null;
  }
}

async function saveBookedLoadForLoadback(origin, dest, rate, miles, broker) {
  if (!window._rcUserId || !window._supabaseReady) return;
  try {
    var destParts = dest.split(',');
    var destCity  = destParts[0].trim();
    var destState = destParts.length > 1 ? destParts[1].trim() : '';

    // Calculate ETA based on miles and avg speed
    var avgSpeed  = 55;
    var drivingHours = miles / avgSpeed;
    var etaDate   = new Date();
    etaDate.setHours(etaDate.getHours() + Math.ceil(drivingHours));

    await _supabase.from('booked_loads').upsert({
      user_id:        window._rcUserId,
      origin:         origin,
      destination:    dest,
      dest_state:     destState,
      dest_city:      destCity,
      rate:           rate,
      miles:          miles,
      broker:         broker,
      eta_date:       etaDate.toISOString().split('T')[0],
      equipment_type: window._rcEquipmentType || 'V',
      min_rpm:        defaults.minRpm || 2.00,
      active:         true,
    }, { onConflict: 'user_id,destination,eta_date' });

    console.log('Booked load saved for Loadback notifications — destination:', dest);
  } catch(err) {
    console.error('Error saving booked load:', err);
  }
}

function showBookingToast(actualPay, postedRate, broker) {
  var existing = document.getElementById('booking-toast');
  if (existing) existing.remove();

  var negotiated = actualPay > postedRate;
  var diff       = actualPay - postedRate;

  var toast = document.createElement('div');
  toast.id  = 'booking-toast';
  toast.style.cssText = 'position:fixed;top:1rem;left:50%;transform:translateX(-50%);z-index:960;background:var(--surface);border:1px solid var(--green-border);border-radius:8px;padding:.8rem 1.2rem;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,.5);min-width:260px;';
  toast.innerHTML =
    '<div style="font-size:.7rem;color:var(--green);text-transform:uppercase;letter-spacing:.1em;margin-bottom:.3rem;">✓ Load Booked</div>' +
    '<div style="font-size:1.2rem;font-weight:bold;color:var(--green);">$' + actualPay.toLocaleString() + '</div>' +
    (negotiated ? '<div style="font-size:.78rem;color:#ffd04d;margin-top:.2rem;">🤝 You negotiated $' + diff.toLocaleString() + ' extra</div>' : '') +
    '<div style="font-size:.75rem;color:#b8c8b8;margin-top:.2rem;">' + broker + ' · Invoice saved</div>';

  document.body.appendChild(toast);
  setTimeout(function() {
    toast.style.transition = 'opacity .5s';
    toast.style.opacity = '0';
    setTimeout(function() { toast.remove(); }, 500);
  }, 3000);
}

function addReturnLoad(route, miles, rate) {
  var parts = route.split(" → ");
  var origin = parts[0] || "", dest = parts[1] || "";
  var rpm = (rate / miles).toFixed(2);
  var loadsScreen = document.getElementById("screen-loads");
  var firstCard = loadsScreen.querySelector(".load-card");
  var panelId = "ret_" + Date.now();
  var fuelCost = Math.round((miles / (defaults.mpg || 6.5)) * (defaults.fuelPrice || 4.25));
  var net = rate - fuelCost;
  var minR = defaults.minRpm || 2.00;
  var tier = (parseFloat(rpm) >= minR && parseFloat(rpm) >= 2.30) ? "strong" : parseFloat(rpm) >= minR ? "ok" : "weak";
  var verdict = tier === "strong" ? "✅ Strong" : tier === "ok" ? "⚠️ Acceptable" : "❌ Below Minimum";
  var newCard = document.createElement("div");
  newCard.className = "load-card hot";
  newCard.setAttribute("data-rate", rate);
  newCard.setAttribute("data-miles", miles);
  newCard.setAttribute("data-pickup", origin);
  newCard.setAttribute("data-dest", dest);
  newCard.setAttribute("data-broker", "");
  newCard.innerHTML =
    '<div class="load-top load-card-clickable" onclick="toggleExpand(\'' + panelId + '\')">' +
      '<div><div class="load-route">' + origin + ' <span>→</span> ' + dest + '</div><div style="margin-top:.3rem;"><span class="load-tag tag-hot">Return Load</span></div></div>' +
      '<div><div class="load-rate">$' + rate.toLocaleString() + '</div><div class="load-rate-sub">$' + rpm + '/mi</div></div>' +
    '</div>' +
    '<div class="load-meta"><div><div class="lm-label">Miles</div><div class="lm-val">' + miles + '</div></div><div><div class="lm-label">Rate/Mi</div><div class="lm-val">$' + rpm + '</div></div><div><div class="lm-label">Est. Net</div><div class="lm-val">$' + net.toLocaleString() + '</div></div></div>' +
    '<div class="load-expand-panel" id="' + panelId + '" data-rate="' + rate + '" data-miles="' + miles + '" data-pickup="' + origin + '" data-dest="' + dest + '" data-broker="">' +
      '<div id="broker-badge_' + panelId + '" style="margin-bottom:.4rem;display:flex;gap:.4rem;flex-wrap:wrap;"></div>' +
      '<div id="hos_' + panelId + '"></div>' +
      '<div class="expand-profit-grid">' +
        '<div class="expand-stat"><div class="expand-label">Gross Rate</div><div class="expand-val">$' + rate.toLocaleString() + '</div></div>' +
        '<div class="expand-stat"><div class="expand-label">Est. Fuel</div><div class="expand-val red" id="fuel_' + panelId + '">-$' + fuelCost.toLocaleString() + '</div></div>' +
        '<div class="expand-stat"><div class="expand-label">Net Profit</div><div class="expand-val green" id="net_' + panelId + '">$' + net.toLocaleString() + '</div></div>' +
        '<div class="expand-stat"><div class="expand-label">Miles</div><div class="expand-val">' + miles + '</div></div>' +
      '</div>' +
      '<div class="expand-verdict ' + tier + '" id="verdict_' + panelId + '">' + verdict + '</div>' +
      AI_DISCLAIMER +
      '<div class="expand-notes"><div class="expand-label" style="margin-bottom:.3rem;">📋 Load Notes</div><div class="expand-notes-text" id="notes_' + panelId + '">Return load added from Loadback.</div></div>' +
    '</div>' +
    '<div class="load-actions">' +
      '<button class="load-action-btn call-btn" onclick="callBroker(\'\',\'Broker\')"><span class="btn-icon">📞</span>Call</button>' +
      '<button class="load-action-btn book-btn" onclick="bookLoad(this,\'' + origin + '\',\'' + dest + '\',' + rate + ',' + miles + ',\'Return Broker\',\'\')"><span class="btn-icon">✓</span>Book</button>' +
      '<button class="load-action-btn skip-btn" onclick="skipLoad(this)"><span class="btn-icon">✕</span>Skip</button>' +
    '</div>';
  if (firstCard) loadsScreen.insertBefore(newCard, firstCard);
  else loadsScreen.appendChild(newCard);
  closeLoadbackDirect();
  var loadsBtn = document.querySelector('.nav-btn[data-screen="loads"]');
  showScreen("loads", loadsBtn);
}

function reopenLoadback() {
  if (window._lastLoadback) { var l = window._lastLoadback; showLoadback(l.origin, l.dest, l.rate, l.miles, l.broker, l.phone); }
  else alert("No recent load booked yet.");
}

function goToInvoice() {
  closeLoadbackDirect();
  showScreen("money", document.querySelector('.nav-btn[data-screen="money"]'));
  var invCard = document.querySelector("#screen-money .card");
  if (invCard) {
    invCard.style.borderColor = "var(--green)";
    invCard.style.boxShadow = "0 0 12px rgba(94,220,130,0.3)";
    setTimeout(function() { invCard.style.borderColor = ""; invCard.style.boxShadow = ""; }, 2000);
  }
}

var _loadNotes = {};
function setLoadNotes(panelId, notesText) {
  var el = document.getElementById('notes_' + panelId);
  if (!el) return;
  if (notesText && notesText.trim()) { el.textContent = notesText; el.classList.add('has-notes'); }
  else { el.textContent = 'No special notes on this load.'; el.classList.remove('has-notes'); }
}
function populateAPILoads(api_payload) { api_payload.forEach(function(load) { if (load.notes) setLoadNotes(load.panel_id, load.notes); }); }

// ══════════════════════════════════════════════════════════════
// WEATHER
// ══════════════════════════════════════════════════════════════
var WEATHER_CONDITIONS = {
  "WA":[{type:"warning",icon:"🌨️",title:"Winter Weather Advisory — Eastern WA",sub:"Snow possible above 2,500ft on US-2 and SR-20. Chain requirements may apply."},{type:"clear",icon:"✅",title:"Roads Clear — I-90 Corridor",sub:"No active alerts for your current region."}],
  "ID":[{type:"warning",icon:"❄️",title:"Freezing Rain Advisory — Northern ID",sub:"US-95 and I-90 near Coeur d Alene. Reduce speed, allow extra following distance."}],
  "OR":[{type:"clear",icon:"🌤️",title:"Roads Clear — I-84 Corridor",sub:"No active advisories for Oregon routes."}],
  "UT":[{type:"warning",icon:"💨",title:"High Wind Warning — I-80 West of SLC",sub:"Winds 45-65 mph gusts. High-profile vehicles advised to use caution."}],
  "TX":[{type:"clear",icon:"☀️",title:"Clear Conditions — East Texas",sub:"No active road alerts. Good driving conditions."}],
  "MT":[{type:"alert",icon:"🚨",title:"Blizzard Warning — US-2 & I-15 North",sub:"Whiteout conditions possible. Chain law in effect. Consider delaying travel."}],
  "CO":[{type:"warning",icon:"⛰️",title:"Mountain Pass Alert — I-70 Eisenhower Tunnel",sub:"Passenger vehicle traction law in effect. Commercial vehicles require chains."}],
  "NV":[{type:"clear",icon:"🌤️",title:"Roads Clear — I-80 Nevada",sub:"No active advisories."}],
  "DEFAULT":[{type:"clear",icon:"✅",title:"No Active Road Alerts",sub:"Tap to refresh based on your current GPS location."}]
};

function refreshWeather() {
  var state = window._currentState || "DEFAULT";
  var conditions = WEATHER_CONDITIONS[state] || WEATHER_CONDITIONS["DEFAULT"];
  var main = conditions[0];
  document.getElementById("weather-icon").textContent = main.icon;
  document.getElementById("weather-title").textContent = main.title;
  document.getElementById("weather-sub").textContent = main.sub;
  var mainRow = document.getElementById("weather-main");
  mainRow.className = "weather-row " + (main.type === "alert" ? "alert" : main.type === "warning" ? "warning" : "clear");
  var now = new Date();
  document.getElementById("weather-time").textContent = now.getHours() + ":" + String(now.getMinutes()).padStart(2,"0");
  var alertsEl = document.getElementById("weather-alerts");
  if (conditions.length > 1) {
    alertsEl.innerHTML = conditions.slice(1).map(function(c) {
      return '<div class="weather-row ' + c.type + '"><span class="weather-icon">' + c.icon + '</span><div class="weather-text"><div class="weather-title">' + c.title + '</div><div class="weather-sub">' + c.sub + '</div></div></div>';
    }).join("");
  } else alertsEl.innerHTML = "";
}
function updateWeatherForState(stateCode) { window._currentState = stateCode; refreshWeather(); }

function checkDeadhead(panelId, rate, miles) {
  var el = document.getElementById("dh_" + panelId);
  if (!el) return;
  var deadInput = document.getElementById("drop-dead");
  var deadMiles = deadInput ? parseFloat(deadInput.value) || 0 : 0;
  if (deadMiles <= 0) { el.className = "deadhead-alert"; return; }
  var fuelPrice = window._df ? window._df.fuelPrice : 4.25;
  var emptyMpg  = defaults.emptyMpg || 8.0;
  var deadCost  = Math.round((deadMiles / emptyMpg) * fuelPrice);
  var pct       = Math.round((deadMiles / miles) * 100);
  var tier, msg;
  if (pct <= 10)       { tier = "ok";     msg = "✅ Deadhead " + deadMiles + " mi (-$" + deadCost + ") — Acceptable at " + pct + "% of loaded miles"; }
  else if (pct <= 20)  { tier = "warn";   msg = "⚠️ Deadhead " + deadMiles + " mi (-$" + deadCost + ") — " + pct + "% of loaded miles, eating margin"; }
  else                 { tier = "danger"; msg = "🚨 Deadhead " + deadMiles + " mi (-$" + deadCost + ") — " + pct + "% of loaded miles. Negotiate higher rate or pass."; }
  el.className = "deadhead-alert show " + tier;
  el.textContent = msg;
}

// ══════════════════════════════════════════════════════════════
// MAINTENANCE TRACKER
// ══════════════════════════════════════════════════════════════
var maintItems = [
  { name:"Oil Change",        lastOdo:487000, interval:15000,  cost:650,  currentOdo:495000 },
  { name:"Tire Rotation",     lastOdo:485000, interval:25000,  cost:200,  currentOdo:495000 },
  { name:"Annual DOT Inspect",lastOdo:470000, interval:100000, cost:450,  currentOdo:495000 },
  { name:"DPF Cleaning",      lastOdo:450000, interval:100000, cost:1200, currentOdo:495000 },
  { name:"Brake Inspection",  lastOdo:480000, interval:30000,  cost:350,  currentOdo:495000 },
];

async function loadMaintItems() {
  if (!window._rcUserId) return;
  try {
    var { data, error } = await _supabase.from('maintenance').select('*').eq('user_id', window._rcUserId);
    if (error || !data || !data.length) return;
    maintItems = data.map(function(row) { return { name: row.name, lastOdo: row.last_odo, interval: row.interval_miles, cost: row.cost, currentOdo: row.current_odo }; });
    renderMaint();
  } catch(err) { console.error('Error loading maintenance:', err); }
}

async function saveMaintItemToSupabase(item) {
  if (!window._rcUserId) return;
  try { await _supabase.from('maintenance').upsert({ user_id: window._rcUserId, name: item.name, last_odo: item.lastOdo, interval_miles: item.interval, cost: item.cost, current_odo: item.currentOdo }, { onConflict: 'user_id,name' }); }
  catch(err) { console.error('Error saving maintenance:', err); }
}

function renderMaint() {
  var list = document.getElementById("maint-list");
  if (!list) return;
  var totalCPM = 0;
  list.innerHTML = maintItems.map(function(item) {
    var milesSince = item.currentOdo - item.lastOdo;
    var milesLeft  = item.interval - milesSince;
    var pct        = Math.min(100, Math.round((milesSince / item.interval) * 100));
    var cpm        = (item.cost / item.interval).toFixed(3);
    totalCPM      += parseFloat(cpm);
    var tier, barColor, status;
    if (milesLeft < 0)                         { tier = "overdue"; barColor = "red";   status = "OVERDUE " + Math.abs(milesLeft).toLocaleString() + " mi"; }
    else if (milesLeft < item.interval * 0.15) { tier = "soon";    barColor = "amber"; status = "DUE IN " + milesLeft.toLocaleString() + " mi"; }
    else                                        { tier = "good";    barColor = "green"; status = "GOOD — " + milesLeft.toLocaleString() + " mi left"; }
    return '<div class="maint-item"><div class="maint-top"><div class="maint-name">' + item.name + '</div><span class="maint-status ' + tier + '">' + status + '</span></div>' +
      '<div class="maint-bar-wrap"><div class="maint-bar ' + barColor + '" style="width:' + pct + '%"></div></div>' +
      '<div class="maint-stats"><span class="maint-stat">Last: <strong>' + item.lastOdo.toLocaleString() + ' mi</strong></span><span class="maint-stat">Interval: <strong>' + item.interval.toLocaleString() + ' mi</strong></span><span class="maint-stat">Cost/mi: <strong>$' + cpm + '</strong></span><span class="maint-stat">Est. Cost: <strong>$' + item.cost.toLocaleString() + '</strong></span></div></div>';
  }).join("");
  var cpmEl = document.getElementById("maint-cpm");
  if (cpmEl) cpmEl.textContent = "$" + totalCPM.toFixed(3) + "/mi";
  if (window._df) window._df.maintCPM = totalCPM;
}

function saveMaintItem() {
  var type    = document.getElementById("maint-type").value;
  var custom  = document.getElementById("maint-custom").value.trim();
  var lastOdo = parseInt(document.getElementById("maint-last-odo").value) || 0;
  var interval= parseInt(document.getElementById("maint-interval").value) || 0;
  var cost    = parseInt(document.getElementById("maint-cost").value) || 0;
  var currOdo = parseInt(document.getElementById("maint-current-odo").value) || 0;
  if (!lastOdo || !interval) { alert("Last odometer and interval are required."); return; }
  var name = type === "Custom" ? (custom || "Custom Item") : type;
  var existing = maintItems.findIndex(function(i) { return i.name === name; });
  var item = { name: name, lastOdo: lastOdo, interval: interval, cost: cost, currentOdo: currOdo || lastOdo + 1000 };
  if (existing >= 0) maintItems[existing] = item; else maintItems.push(item);
  renderMaint();
  saveMaintItemToSupabase(item);
  ["maint-last-odo","maint-interval","maint-cost","maint-current-odo"].forEach(function(id) { var el = document.getElementById(id); if (el) el.value = ""; });
  alert(name + " saved!");
}

// ══════════════════════════════════════════════════════════════
// GPS DEADHEAD CALCULATOR
// ══════════════════════════════════════════════════════════════
var CITY_COORDS = {
  "moses lake":[47.1301,-119.2780],"pasco":[46.2396,-119.1006],"kennewick":[46.2112,-119.1372],"richland":[46.2859,-119.2845],
  "yakima":[46.6021,-120.5059],"spokane":[47.6588,-117.4260],"wenatchee":[47.4235,-120.3103],"ellensburg":[46.9965,-120.5478],
  "walla walla":[46.0646,-118.3430],"tri cities":[46.2396,-119.1006],"portland":[45.5051,-122.6750],"seattle":[47.6062,-122.3321],
  "boise":[43.6150,-116.2023],"salt lake city":[40.7608,-111.8910],"las vegas":[36.1699,-115.1398],"denver":[39.7392,-104.9903],
  "phoenix":[33.4484,-112.0740],"los angeles":[34.0522,-118.2437],"sacramento":[38.5816,-121.4944],"reno":[39.5296,-119.8138],
  "billings":[45.7833,-108.5007],"missoula":[46.8721,-113.9940],"great falls":[47.5002,-111.3008],"albuquerque":[35.0844,-106.6504],
  "el paso":[31.7619,-106.4850],"dallas":[32.7767,-96.7970],"fort worth":[32.7555,-97.3308],"houston":[29.7604,-95.3698],
  "san antonio":[29.4241,-98.4936],"kilgore":[32.3888,-94.8757],"oklahoma city":[35.4676,-97.5164],"kansas city":[39.0997,-94.5786],
  "omaha":[41.2565,-95.9345],"minneapolis":[44.9778,-93.2650],"chicago":[41.8781,-87.6298],
  "coeur dalene":[47.6777,-116.7805],"lewiston":[46.4165,-117.0177],"twin falls":[42.5629,-114.4609],"pocatello":[42.8713,-112.4455],
};

function haversineMiles(lat1, lon1, lat2, lon2) {
  var R = 3958.8;
  var dLat = (lat2-lat1)*Math.PI/180, dLon = (lon2-lon1)*Math.PI/180;
  var a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)*Math.sin(dLon/2);
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)) * 1.15);
}

function getDeadheadMiles(pickupCity) {
  if (!window._gpsLat || !window._gpsLon) return 0;
  var key = pickupCity.toLowerCase().split(",")[0].trim();
  var coords = CITY_COORDS[key];
  if (!coords) {
    var keys = Object.keys(CITY_COORDS);
    for (var i = 0; i < keys.length; i++) { if (key.indexOf(keys[i]) >= 0 || keys[i].indexOf(key) >= 0) { coords = CITY_COORDS[keys[i]]; break; } }
  }
  if (!coords) return 0;
  return haversineMiles(window._gpsLat, window._gpsLon, coords[0], coords[1]);
}

// Calculate deadhead miles between two cities (for Loadback)
function getDeadheadMilesFromCity(fromCity, fromState, toCity, toState) {
  var fromKey = (fromCity || '').toLowerCase().trim();
  var toKey   = (toCity   || '').toLowerCase().trim();
  var fromCoords = CITY_COORDS[fromKey];
  var toCoords   = CITY_COORDS[toKey];

  if (!fromCoords) {
    var keys = Object.keys(CITY_COORDS);
    for (var i = 0; i < keys.length; i++) {
      if (fromKey.indexOf(keys[i]) >= 0 || keys[i].indexOf(fromKey) >= 0) { fromCoords = CITY_COORDS[keys[i]]; break; }
    }
  }
  if (!toCoords) {
    var keys = Object.keys(CITY_COORDS);
    for (var i = 0; i < keys.length; i++) {
      if (toKey.indexOf(keys[i]) >= 0 || keys[i].indexOf(toKey) >= 0) { toCoords = CITY_COORDS[keys[i]]; break; }
    }
  }
  if (!fromCoords || !toCoords) return 0;
  return haversineMiles(fromCoords[0], fromCoords[1], toCoords[0], toCoords[1]);
}

// ══════════════════════════════════════════════════════════════
// EIA REGION MAP & GPS
// ══════════════════════════════════════════════════════════════
const STATE_REGION = {
  WA:'West Coast',OR:'West Coast',CA:'West Coast',NV:'West Coast',AZ:'West Coast',
  ID:'Rocky Mountain',MT:'Rocky Mountain',WY:'Rocky Mountain',UT:'Rocky Mountain',CO:'Rocky Mountain',
  ND:'Midwest',SD:'Midwest',NE:'Midwest',KS:'Midwest',MN:'Midwest',IA:'Midwest',MO:'Midwest',WI:'Midwest',IL:'Midwest',MI:'Midwest',IN:'Midwest',OH:'Midwest',
  OK:'Gulf Coast',TX:'Gulf Coast',LA:'Gulf Coast',MS:'Gulf Coast',AL:'Gulf Coast',AR:'Gulf Coast',NM:'Rocky Mountain',
  FL:'East Coast',GA:'East Coast',SC:'East Coast',NC:'East Coast',VA:'East Coast',WV:'East Coast',MD:'East Coast',DE:'East Coast',PA:'East Coast',NJ:'East Coast',NY:'East Coast',CT:'East Coast',RI:'East Coast',MA:'East Coast',VT:'East Coast',NH:'East Coast',ME:'East Coast',TN:'East Coast',KY:'East Coast',
};
const REGION_FALLBACK = {'West Coast':4.71,'Rocky Mountain':4.22,'Midwest':3.98,'Gulf Coast':3.82,'East Coast':4.15,'Unknown':4.25};
let currentRegion = 'Unknown', currentState = '', currentCity = '';

function startGPS() {
  const gpsBox = document.getElementById('gps-box');
  const gpsDot = document.getElementById('gps-dot');
  const gpsVal = document.getElementById('gps-value');
  const gpsSub = document.getElementById('gps-sub');
  if (!navigator.geolocation) { gpsVal.textContent = 'Not Available'; gpsSub.textContent = 'GPS not supported'; gpsDot.className = 'live-dot red'; gpsBox.className = 'live-box error'; return; }
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const lat = pos.coords.latitude.toFixed(4), lon = pos.coords.longitude.toFixed(4);
      document.getElementById('coords-display').textContent = lat + ', ' + lon;
      window._gpsLat = parseFloat(lat); window._gpsLon = parseFloat(lon);
      try {
        const r = await fetch('https://nominatim.openstreetmap.org/reverse?format=json&lat=' + lat + '&lon=' + lon, { headers: { 'Accept-Language': 'en' } });
        const d = await r.json();
        const addr = d.address || {};
        var iso = addr['ISO3166-2-lvl4'] || '';
        var state_code = iso ? iso.split('-').pop().toUpperCase() : (addr.state_code || '').toUpperCase();
        const city = addr.city || addr.town || addr.village || addr.county || '';
        const state = addr.state || '';
        currentState = state_code; currentCity = city;
        currentRegion = STATE_REGION[state_code] || 'Unknown';
        updateWeatherForState(state_code);
        document.getElementById('region-display').textContent = city ? city + ', ' + state : state;
        document.getElementById('eia-region').textContent = currentRegion;
        gpsVal.textContent = city || state;
        gpsSub.textContent = state + ' · ' + currentRegion + ' Region';
        document.querySelectorAll('.load-expand-panel.open').forEach(function(p) { var pid = p.id, r2 = parseInt(p.dataset.rate||0), m = parseInt(p.dataset.miles||0); if (r2 && m) recalcPanel(pid, r2, m); });
        gpsDot.className = 'live-dot green'; gpsBox.className = 'live-box connected';
        fetchFuelPrice(currentRegion);
        fetchNWSAlerts(window._gpsLat, window._gpsLon);
      } catch(e) {
        gpsVal.textContent = lat + '°N ' + Math.abs(lon) + '°W';
        gpsSub.textContent = 'Location found · geocode unavailable';
        gpsDot.className = 'live-dot green'; gpsBox.className = 'live-box connected';
        fetchFuelPrice('Unknown');
      }
    },
    (err) => { gpsVal.textContent = 'Access Denied'; gpsSub.textContent = 'Tap Allow when prompted'; gpsDot.className = 'live-dot red'; gpsBox.className = 'live-box error'; fetchFuelPrice('Unknown'); },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
  );
}

async function fetchFuelPrice(region) {
  if (window._gpsLat && window._gpsLon) {
    var crowdResult = await fetchCrowdFuelPrice(window._gpsLat, window._gpsLon);
    if (crowdResult && crowdResult.count >= 3) { updateFuelDisplay(crowdResult.price, crowdResult.count); return; }
  }
  const fuelBox = document.getElementById('fuel-box'), fuelDot = document.getElementById('fuel-dot'), fuelVal = document.getElementById('fuel-value'), fuelSub = document.getElementById('fuel-sub'), fuelUpd = document.getElementById('fuel-updated');
  const PADD = {'East Coast':'EMD_EPD2D_PTE_R10_DPG','Midwest':'EMD_EPD2D_PTE_R20_DPG','Gulf Coast':'EMD_EPD2D_PTE_R30_DPG','Rocky Mountain':'EMD_EPD2D_PTE_R40_DPG','West Coast':'EMD_EPD2D_PTE_R50_DPG','Unknown':'EMD_EPD2D_PTE_NUS_DPG'};
  const seriesId = PADD[region] || PADD['Unknown'];
  var eiaWorkerUrl = window._rcEIAWorker;
  const url = eiaWorkerUrl
    ? eiaWorkerUrl + '?region=' + encodeURIComponent(region)
    : 'https://api.eia.gov/v2/petroleum/pri/gnd/data/?frequency=weekly&data[0]=value&facets[series][]=' + seriesId + '&sort[0][column]=period&sort[0][direction]=desc&offset=0&length=1&api_key=DEMO_KEY';
  try {
    const r = await fetch(url), d = await r.json();
    var price, period;
    if (d && d.price) { price = parseFloat(d.price); period = d.period || ''; }
    else { const rows = d?.response?.data; if (!rows || !rows.length) throw new Error('No data'); price = parseFloat(rows[0].value); period = rows[0].period || ''; }
    if (price) {
      defaults.fuelPrice = price; fuelVal.textContent = '$' + price.toFixed(3) + '/gal'; fuelSub.textContent = region + ' Region · EIA Live';
      fuelDot.className = 'live-dot green'; fuelBox.className = 'live-box connected';
      if (fuelUpd) fuelUpd.textContent = 'Week of ' + period;
      injectProfitBars();
      const calcFuel = document.getElementById('calc-fuel'); if (calcFuel) calcFuel.value = price.toFixed(2);
    } else throw new Error('No data');
  } catch(e) {
    const fallback = REGION_FALLBACK[region] || 4.25; defaults.fuelPrice = fallback;
    fuelVal.textContent = '$' + fallback.toFixed(2) + '/gal'; fuelSub.textContent = region + ' · Est. (offline)';
    fuelDot.className = 'live-dot red'; fuelBox.className = 'live-box error';
    if (fuelUpd) fuelUpd.textContent = 'Using regional estimate';
    injectProfitBars();
    const calcFuel = document.getElementById('calc-fuel'); if (calcFuel) calcFuel.value = fallback.toFixed(2);
  }
}

function updateLocation() {
  const val = document.getElementById('location-input').value.trim();
  if (val) { document.getElementById('gps-value').textContent = val; document.getElementById('gps-sub').textContent = 'Manual entry'; document.getElementById('location-input').value = ''; }
}

renderStates(stateData); injectProfitBars(); loadSavedPreferences(); renderMaint(); refreshWeather();

// ══════════════════════════════════════════════════════════════
// PULL TO REFRESH
// ══════════════════════════════════════════════════════════════
(function() {
  var startY = 0, pulling = false;
  var indicator = document.createElement('div');
  indicator.id = 'pull-indicator';
  indicator.style.cssText = 'position:fixed;top:0;left:0;right:0;text-align:center;padding:.5rem;background:var(--green);color:#111312;font-size:.8rem;font-weight:bold;letter-spacing:.05em;z-index:999;transform:translateY(-100%);transition:transform .2s;';
  indicator.textContent = 'Pull to refresh';
  document.body.appendChild(indicator);
  document.addEventListener('touchstart', function(e) { if (window.scrollY === 0) { startY = e.touches[0].clientY; pulling = true; } }, { passive: true });
  document.addEventListener('touchmove', function(e) { if (!pulling) return; var dist = e.touches[0].clientY - startY; if (dist > 10) { indicator.style.transform = 'translateY(0)'; indicator.textContent = dist > 60 ? 'Release to refresh' : 'Pull to refresh'; } }, { passive: true });
  document.addEventListener('touchend', function(e) {
    if (!pulling) return; pulling = false;
    var dist = e.changedTouches[0].clientY - startY;
    indicator.style.transform = 'translateY(-100%)'; indicator.textContent = 'Pull to refresh';
    if (dist > 60) { indicator.textContent = 'Refreshing...'; indicator.style.transform = 'translateY(0)'; startGPS(); refreshWeather(); setTimeout(function() { indicator.style.transform = 'translateY(-100%)'; }, 1500); }
    startY = 0;
  }, { passive: true });
})();

window.addEventListener('load', function() { setTimeout(startGPS, 500); setTimeout(checkFirstTime, 700); });

// ══════════════════════════════════════════════════════════════
// LOADBACK — Return Load Finder
// ══════════════════════════════════════════════════════════════
var RETURN_LOADS = {
  "pasco":[
    {route:"Pasco, WA → Moses Lake, WA",dest:"Moses Lake, WA",miles:82,rate:205,rpm:2.50,avail:"same day",commodity:"General",broker:"CH Robinson",phone:"(800) 323-7587"},
    {route:"Pasco, WA → Spokane, WA",dest:"Spokane, WA",miles:143,rate:350,rpm:2.45,avail:"same day",commodity:"General",broker:"Echo Global",phone:"(800) 354-7993"},
    {route:"Pasco, WA → Portland, OR",dest:"Portland, OR",miles:215,rate:505,rpm:2.35,avail:"next day",commodity:"Ag Equip"},
    {route:"Pasco, WA → Yakima, WA",dest:"Yakima, WA",miles:75,rate:188,rpm:2.50,avail:"same day",commodity:"General"},
    {route:"Pasco, WA → Boise, ID",dest:"Boise, ID",miles:298,rate:685,rpm:2.30,avail:"next day",commodity:"General"},
  ],
  "boise":[
    {route:"Boise, ID → Moses Lake, WA",dest:"Moses Lake, WA",miles:302,rate:695,rpm:2.30,avail:"next day",commodity:"General",broker:"Coyote",phone:"(888) 264-8980"},
    {route:"Boise, ID → Salt Lake City, UT",dest:"Salt Lake City, UT",miles:340,rate:782,rpm:2.30,avail:"same day",commodity:"General"},
    {route:"Boise, ID → Portland, OR",dest:"Portland, OR",miles:428,rate:940,rpm:2.20,avail:"next day",commodity:"Lumber"},
    {route:"Boise, ID → Spokane, WA",dest:"Spokane, WA",miles:305,rate:700,rpm:2.30,avail:"same day",commodity:"General"},
    {route:"Boise, ID → Seattle, WA",dest:"Seattle, WA",miles:498,rate:1195,rpm:2.40,avail:"2 days out",commodity:"Produce"},
  ],
  "salt lake city":[
    {route:"Salt Lake City, UT → Moses Lake, WA",dest:"Moses Lake, WA",miles:710,rate:1633,rpm:2.30,avail:"next day",commodity:"General",broker:"XPO Logistics",phone:"(800) 742-5727"},
    {route:"Salt Lake City, UT → Las Vegas, NV",dest:"Las Vegas, NV",miles:421,rate:1050,rpm:2.49,avail:"same day",commodity:"General"},
    {route:"Salt Lake City, UT → Boise, ID",dest:"Boise, ID",miles:340,rate:820,rpm:2.41,avail:"same day",commodity:"Steel"},
    {route:"Salt Lake City, UT → Denver, CO",dest:"Denver, CO",miles:525,rate:1155,rpm:2.20,avail:"2 days out",commodity:"General"},
    {route:"Salt Lake City, UT → Portland, OR",dest:"Portland, OR",miles:778,rate:1789,rpm:2.30,avail:"2 days out",commodity:"Ag Equip"},
  ],
  "portland":[
    {route:"Portland, OR → Moses Lake, WA",dest:"Moses Lake, WA",miles:230,rate:530,rpm:2.30,avail:"same day",commodity:"General"},
    {route:"Portland, OR → Boise, ID",dest:"Boise, ID",miles:428,rate:1005,rpm:2.35,avail:"next day",commodity:"General"},
    {route:"Portland, OR → Sacramento, CA",dest:"Sacramento, CA",miles:580,rate:1392,rpm:2.40,avail:"next day",commodity:"Produce"},
    {route:"Portland, OR → Seattle, WA",dest:"Seattle, WA",miles:178,rate:445,rpm:2.50,avail:"same day",commodity:"General"},
    {route:"Portland, OR → Spokane, WA",dest:"Spokane, WA",miles:350,rate:805,rpm:2.30,avail:"same day",commodity:"Steel"},
  ],
  "spokane":[
    {route:"Spokane, WA → Moses Lake, WA",dest:"Moses Lake, WA",miles:100,rate:250,rpm:2.50,avail:"same day",commodity:"General"},
    {route:"Spokane, WA → Boise, ID",dest:"Boise, ID",miles:305,rate:700,rpm:2.30,avail:"same day",commodity:"General"},
    {route:"Spokane, WA → Portland, OR",dest:"Portland, OR",miles:350,rate:805,rpm:2.30,avail:"next day",commodity:"Lumber"},
    {route:"Spokane, WA → Seattle, WA",dest:"Seattle, WA",miles:280,rate:645,rpm:2.30,avail:"same day",commodity:"General"},
    {route:"Spokane, WA → Salt Lake City, UT",dest:"Salt Lake City, UT",miles:710,rate:1633,rpm:2.30,avail:"2 days out",commodity:"General"},
  ],
  "kennewick":[
    {route:"Kennewick, WA → Moses Lake, WA",dest:"Moses Lake, WA",miles:90,rate:225,rpm:2.50,avail:"same day",commodity:"General"},
    {route:"Kennewick, WA → Portland, OR",dest:"Portland, OR",miles:210,rate:483,rpm:2.30,avail:"same day",commodity:"Ag Equip"},
    {route:"Kennewick, WA → Boise, ID",dest:"Boise, ID",miles:300,rate:690,rpm:2.30,avail:"next day",commodity:"General"},
    {route:"Kennewick, WA → Seattle, WA",dest:"Seattle, WA",miles:225,rate:518,rpm:2.30,avail:"same day",commodity:"General"},
    {route:"Kennewick, WA → Yakima, WA",dest:"Yakima, WA",miles:85,rate:210,rpm:2.47,avail:"same day",commodity:"Produce"},
  ],
  "yakima":[
    {route:"Yakima, WA → Moses Lake, WA",dest:"Moses Lake, WA",miles:110,rate:275,rpm:2.50,avail:"same day",commodity:"General"},
    {route:"Yakima, WA → Portland, OR",dest:"Portland, OR",miles:200,rate:460,rpm:2.30,avail:"same day",commodity:"Produce"},
    {route:"Yakima, WA → Seattle, WA",dest:"Seattle, WA",miles:145,rate:334,rpm:2.30,avail:"same day",commodity:"General"},
    {route:"Yakima, WA → Boise, ID",dest:"Boise, ID",miles:330,rate:759,rpm:2.30,avail:"next day",commodity:"General"},
  ],
  "las vegas":[
    {route:"Las Vegas, NV → Los Angeles, CA",dest:"Los Angeles, CA",miles:270,rate:621,rpm:2.30,avail:"same day",commodity:"General"},
    {route:"Las Vegas, NV → Salt Lake City, UT",dest:"Salt Lake City, UT",miles:421,rate:969,rpm:2.30,avail:"same day",commodity:"General"},
    {route:"Las Vegas, NV → Phoenix, AZ",dest:"Phoenix, AZ",miles:297,rate:683,rpm:2.30,avail:"same day",commodity:"General"},
  ],
  "kilgore":[
    {route:"Kilgore, TX → Dallas, TX",dest:"Dallas, TX",miles:130,rate:325,rpm:2.50,avail:"same day",commodity:"General"},
    {route:"Kilgore, TX → Houston, TX",dest:"Houston, TX",miles:220,rate:506,rpm:2.30,avail:"same day",commodity:"Oilfield"},
    {route:"Kilgore, TX → Oklahoma City, OK",dest:"Oklahoma City, OK",miles:340,rate:782,rpm:2.30,avail:"next day",commodity:"General"},
    {route:"Kilgore, TX → Memphis, TN",dest:"Memphis, TN",miles:530,rate:1219,rpm:2.30,avail:"2 days out",commodity:"General"},
  ],
  "denver":[
    {route:"Denver, CO → Salt Lake City, UT",dest:"Salt Lake City, UT",miles:525,rate:1208,rpm:2.30,avail:"same day",commodity:"General"},
    {route:"Denver, CO → Kansas City, MO",dest:"Kansas City, MO",miles:600,rate:1380,rpm:2.30,avail:"next day",commodity:"General"},
    {route:"Denver, CO → Albuquerque, NM",dest:"Albuquerque, NM",miles:450,rate:1035,rpm:2.30,avail:"same day",commodity:"General"},
  ],
};

function calcArrival(miles, startDate, availHOS) {
  var AVG_SPEED=55, MAX_DRIVE=11, BREAK_WINDOW=8, BREAK_TIME=0.5, RESET_TIME=10, MAX_WINDOW=14;
  var hosAvail = (availHOS !== undefined) ? availHOS : MAX_DRIVE;
  var current = startDate ? new Date(startDate) : new Date();
  var milesLeft=miles, driveAccum=0, windowUsed=0, breakTaken=false, shiftDriveLeft=Math.min(hosAvail,MAX_DRIVE);
  while (milesLeft > 0) {
    var tillBreak  = breakTaken ? (MAX_DRIVE-driveAccum) : (BREAK_WINDOW-driveAccum);
    var tillShift  = shiftDriveLeft-driveAccum, tillWindow=MAX_WINDOW-windowUsed;
    var driveSegment = Math.max(Math.min(tillBreak,tillShift,tillWindow), 0);
    if (driveSegment <= 0) {
      if (!breakTaken && driveAccum >= BREAK_WINDOW) { current=new Date(current.getTime()+BREAK_TIME*3600000); windowUsed+=BREAK_TIME; breakTaken=true; }
      else { current=new Date(current.getTime()+RESET_TIME*3600000); driveAccum=0; windowUsed=0; shiftDriveLeft=MAX_DRIVE; breakTaken=false; }
      continue;
    }
    var milesCovered = driveSegment*AVG_SPEED;
    if (milesCovered >= milesLeft) { var fdt=milesLeft/AVG_SPEED; current=new Date(current.getTime()+fdt*3600000); driveAccum+=fdt; windowUsed+=fdt; milesLeft=0; }
    else { current=new Date(current.getTime()+driveSegment*3600000); driveAccum+=driveSegment; windowUsed+=driveSegment; milesLeft-=milesCovered; }
  }
  return current;
}

function formatArrival(date) {
  var days=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"], months=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  var hrs=date.getHours(), mins=String(date.getMinutes()).padStart(2,"0"), ampm=hrs>=12?"PM":"AM";
  hrs = hrs%12||12;
  return days[date.getDay()]+" "+months[date.getMonth()]+" "+date.getDate()+" · "+hrs+":"+mins+" "+ampm;
}

function availToDate(avail, arrivalDate) {
  var d = new Date(arrivalDate);
  if (avail === "same day") return d;
  if (avail === "next day") { d.setDate(d.getDate()+1); return d; }
  if (avail === "2 days out") { d.setDate(d.getDate()+2); return d; }
  return d;
}

function closeLoadback(e) { if (e && e.target !== document.getElementById("loadback-panel")) return; document.getElementById("loadback-panel").classList.remove("open"); }
function closeLoadbackDirect() { document.getElementById("loadback-panel").classList.remove("open"); }

function showLoadback(origin, dest, rate, miles, broker, phone) {
  window._lastLoadback = { origin:origin, dest:dest, rate:rate, miles:miles, broker:broker, phone:phone };
  var panel = document.getElementById("loadback-panel");
  var lbContent = document.getElementById("loadback-content");
  var now = new Date(), hosAvail = window._hosAvailable || 11;
  var arrival = calcArrival(miles, now, hosAvail);
  var arrivalStr = formatArrival(arrival);
  var driveOnlyHrs = Math.round((miles/55)*10)/10;
  var totalCalHrs = Math.round((arrival-now)/3600000*10)/10;
  var hosBreaks = totalCalHrs - driveOnlyHrs;
  var hosNote = hosBreaks > 0 ? "Includes ~" + hosBreaks.toFixed(1) + " hrs of required HOS breaks" : "No HOS breaks required for this run";
  var fuelPrice=defaults.fuelPrice||4.25, mpg=defaults.mpg||6.5;
  var fuelCost=Math.round((miles/mpg)*fuelPrice), net=rate-fuelCost;
  var destKey=dest.toLowerCase().split(",")[0].trim(), returnLoads=null, keys=Object.keys(RETURN_LOADS);
  for (var k=0; k<keys.length; k++) { if (destKey.indexOf(keys[k])>=0 || keys[k].indexOf(destKey)>=0) { returnLoads=RETURN_LOADS[keys[k]]; break; } }
  if (!returnLoads) returnLoads = NEARBY_LOADS["default"] || [];
  var scoredLoads = returnLoads.map(function(l) {
    var availDate=availToDate(l.avail,arrival), returnFuel=Math.round((l.miles/mpg)*fuelPrice), returnNet=l.rate-returnFuel;
    return Object.assign({},l,{availDate:availDate,availStr:formatArrival(availDate),returnNet:returnNet,roundTripNet:net+returnNet,daysOut:Math.round((availDate-now)/(1000*60*60*24))});
  }).filter(function(l) { return l.availDate >= new Date(arrival.getTime()-2*60*60*1000); })
    .sort(function(a,b) { return b.roundTripNet-a.roundTripNet; });
  var loadsHtml = scoredLoads.length > 0
    ? scoredLoads.map(function(l,i) {
        var isBest = i===0;
        return '<div class="loadback-card ' + (isBest?"best":"") + '">' +
          '<div class="loadback-card-top"><div class="loadback-route">' + l.route + (isBest?'<span class="loadback-best-badge">BEST</span>':'') + '</div><div class="loadback-rate">$' + l.rate.toLocaleString() + '</div></div>' +
          '<div class="loadback-stats"><span class="loadback-stat">Miles: <strong>' + l.miles + '</strong></span><span class="loadback-stat">RPM: <strong>$' + l.rpm.toFixed(2) + '</strong></span><span class="loadback-stat">Net: <strong>$' + l.returnNet.toLocaleString() + '</strong></span><span class="loadback-stat">Round Trip: <strong style="color:var(--green)">$' + l.roundTripNet.toLocaleString() + '</strong></span></div>' +
          '<div class="loadback-date">📅 Available: ' + l.availStr + ' · ' + l.commodity + '</div>' +
          '<div class="lb-actions">' + (l.phone ? '<button class="lb-call-btn" onclick="callBroker(\'' + l.phone + '\',\'' + l.broker + '\')">📞 Call ' + l.broker + '</button>' : '') +
          '<button class="lb-book-btn" onclick="addReturnLoad(\'' + l.route + '\',' + l.miles + ',' + l.rate + ')">✓ Add to Loads</button>' +
          '<button class="lb-call-btn lb-ai-btn" onclick="analyzeReturnLoad(this,\'' + l.route + '\',' + l.rate + ',' + l.miles + ',' + l.rpm.toFixed(2) + ',' + l.returnNet + ',' + l.roundTripNet + ',\'' + (l.broker||'') + '\')" style="color:#7ab8ff;border-color:rgba(122,184,255,.35);">🤖 Analyze</button>' +
          '</div>' +
          '<div class="lb-ai-result" style="display:none;margin-top:.5rem;padding:.5rem .7rem;border-radius:3px;font-size:.82rem;"></div>' +
          '</div>';
      }).join("")
    : '<div class="alert alert-amber"><div class="alert-icon">⚠️</div><div>No return loads found for ' + dest + '. Connect Truckstop API for live loads.</div></div>';
  lbContent.innerHTML =
    '<div class="loadback-summary">' +
      '<div class="loadback-summary-row"><span>Booked Load</span><strong>' + origin + ' → ' + dest + '</strong></div>' +
      '<div class="loadback-summary-row"><span>Broker</span><strong>' + broker + '</strong></div>' +
      '<div class="loadback-summary-row"><span>Miles</span><strong>' + miles + ' mi</strong></div>' +
      '<div class="loadback-summary-row"><span>Gross Rate</span><strong>$' + rate.toLocaleString() + '</strong></div>' +
      '<div class="loadback-summary-row highlight"><span>Net After Fuel</span><strong>$' + net.toLocaleString() + '</strong></div>' +
    '</div>' +
    '<div class="loadback-arrival">🕐 Estimated arrival at <strong>' + dest + '</strong>: <strong>' + arrivalStr + '</strong><br>' +
      '<span style="font-size:.78rem;opacity:.8;">' + miles + ' mi · ' + driveOnlyHrs + ' hrs drive · ' + hosNote + '</span><br>' +
      '<span style="font-size:.75rem;opacity:.65;color:#ffd04d;">HOS: 11hr drive / 14hr window / 10hr reset rule applied</span><br>' +
      HOS_DISCLAIMER + '</div>' +
    '<div class="loadback-section-title">Return Loads Available From ' + dest + '</div>' +
    loadsHtml + AI_DISCLAIMER +
    '<button class="btn btn-green" onclick="goToInvoice()" style="margin-top:.5rem;">📋 Log Invoice in Money Tab →</button><div style="height:1rem;"></div>';
  panel.classList.add("open");
}

// ══════════════════════════════════════════════════════════════
// BROKER VAULT — Supabase backed
// ══════════════════════════════════════════════════════════════
var _brokers = [], _brokerInvoices = {}, _brokerSearchQuery = '';

function toggleAddBroker() {
  var form = document.getElementById('add-broker-form');
  var hint = document.getElementById('add-broker-toggle-hint');
  var open = form.style.display !== 'none';
  form.style.display = open ? 'none' : 'block';
  hint.textContent = open ? 'Tap to expand' : 'Tap to collapse';
}

async function saveBroker() {
  var name  = document.getElementById('new-broker-name').value.trim();
  var mc    = document.getElementById('new-broker-mc').value.trim();
  var phone = document.getElementById('new-broker-phone').value.trim();
  var email = document.getElementById('new-broker-email').value.trim();
  var terms = parseInt(document.getElementById('new-broker-terms').value);
  var notes = document.getElementById('new-broker-notes').value.trim();
  if (!name) { alert('Broker name is required.'); return; }
  try {
    var { data, error } = await _supabase.from('brokers').insert({ user_id: window._rcUserId, name: name, mc_number: mc, phone: phone, email: email, payment_terms: terms, notes: notes }).select().single();
    if (error) throw error;
    ['new-broker-name','new-broker-mc','new-broker-phone','new-broker-email','new-broker-notes'].forEach(function(id) { var el = document.getElementById(id); if (el) el.value = ''; });
    document.getElementById('add-broker-form').style.display = 'none';
    document.getElementById('add-broker-toggle-hint').textContent = 'Tap to expand';
    await loadBrokers();
    track('broker_added', { name: name, terms: terms });
    alert(name + ' added to your broker network!');
  } catch(err) { alert('Error saving broker: ' + err.message); }
}

async function loadBrokers() {
  if (!window._rcUserId) return;
  try {
    var { data, error } = await _supabase.from('brokers').select('*').eq('user_id', window._rcUserId).order('name');
    if (error) throw error;
    _brokers = data || [];
    renderBrokers();
    populateBrokerDropdown();
  } catch(err) { console.error('Error loading brokers:', err); }
}

function searchBrokers() {
  var input = document.getElementById('broker-vault-search');
  _brokerSearchQuery = input ? input.value.trim().toLowerCase() : '';
  renderBrokers();
}

function clearBrokerSearch() {
  var input = document.getElementById('broker-vault-search');
  if (input) input.value = '';
  _brokerSearchQuery = '';
  renderBrokers();
}

function renderBrokers() {
  var list = document.getElementById('broker-list');
  if (!list) return;
  if (!_brokers.length) {
    list.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🏦</div><div class="empty-state-msg">No brokers yet. Add your first broker above — every broker you haul for belongs in your vault.</div></div>';
    return;
  }
  var totalOutstanding = 0, totalOverdue = 0;
  var today = new Date(), fifteenDaysAgo = new Date(today.getTime() - 15 * 24 * 60 * 60 * 1000);
  invoices.forEach(function(inv) {
    if (inv.status !== 'paid') {
      totalOutstanding += inv.amount;
      if (new Date(inv.dueDate) < today) totalOverdue += inv.amount;
    }
  });
  var outEl = document.getElementById('broker-total-outstanding'), ovEl = document.getElementById('broker-total-overdue');
  if (outEl) outEl.textContent = '$' + totalOutstanding.toLocaleString();
  if (ovEl)  ovEl.textContent  = '$' + totalOverdue.toLocaleString();
  var filteredBrokers = _brokers.filter(function(b) {
    if (_brokerSearchQuery) {
      return b.name.toLowerCase().indexOf(_brokerSearchQuery) >= 0 ||
             (b.mc_number && b.mc_number.toLowerCase().indexOf(_brokerSearchQuery) >= 0);
    }
    var hasUnpaid = invoices.some(function(i) { return i.broker && i.broker.toLowerCase() === b.name.toLowerCase() && i.status !== 'paid'; });
    if (hasUnpaid) return true;
    return invoices.some(function(i) {
      if (!i.broker || i.broker.toLowerCase() !== b.name.toLowerCase()) return false;
      return new Date(i.date) >= fifteenDaysAgo;
    });
  });
  var countInfo = '';
  if (!_brokerSearchQuery) {
    var hiddenCount = _brokers.length - filteredBrokers.length;
    countInfo = '<div style="font-size:.72rem;color:#b8c8b8;padding:.4rem .8rem;margin-bottom:.3rem;">Showing ' + filteredBrokers.length + ' active brokers' + (hiddenCount > 0 ? ' · ' + hiddenCount + ' inactive (search to find)' : '') + '</div>';
  } else {
    countInfo = '<div style="font-size:.72rem;color:var(--green);padding:.4rem .8rem;margin-bottom:.3rem;">Search results: ' + filteredBrokers.length + ' broker' + (filteredBrokers.length !== 1 ? 's' : '') + ' <button onclick="clearBrokerSearch()" style="background:none;border:none;color:#b8c8b8;cursor:pointer;font-size:.72rem;text-decoration:underline;">Clear</button></div>';
  }
  if (!filteredBrokers.length) {
    list.innerHTML = countInfo + '<div class="alert alert-amber" style="margin-top:.3rem;"><div class="alert-icon">🔍</div><div>' + (_brokerSearchQuery ? 'No brokers found matching "' + _brokerSearchQuery + '"' : 'No brokers with recent activity. Use the search box above to find any broker.') + '</div></div>';
    return;
  }
  list.innerHTML = countInfo + filteredBrokers.map(function(b) {
    var brokerInvs = invoices.filter(function(i) { return i.broker && i.broker.toLowerCase() === b.name.toLowerCase(); });
    var outstanding = brokerInvs.filter(function(i) { return i.status !== 'paid'; }).reduce(function(sum, i) { return sum + i.amount; }, 0);
    var paid        = brokerInvs.filter(function(i) { return i.status === 'paid'; }).reduce(function(sum, i) { return sum + i.amount; }, 0);
    var invoiceCount = brokerInvs.length;
    return '<div class="load-card broker-card" style="cursor:pointer;" data-broker-id="' + b.id + '">' +
      '<div class="load-top"><div>' +
        '<div class="load-route">' + b.name + '</div>' +
        '<div style="margin-top:.2rem;">' + (b.mc_number ? '<span style="font-size:.72rem;color:#b8c8b8;margin-right:.5rem;">' + b.mc_number + '</span>' : '') + '<span class="load-tag tag-' + (outstanding > 0 ? 'watch' : 'booked') + '">' + b.payment_terms + ' day terms</span></div>' +
      '</div>' +
      '<div style="text-align:right;">' + (outstanding > 0 ? '<div style="color:var(--amber);font-weight:bold;font-size:.95rem;">$' + outstanding.toLocaleString() + ' owed</div>' : '<div style="color:var(--green);font-size:.85rem;">✓ Clear</div>') + '<div style="font-size:.72rem;color:#b8c8b8;">' + invoiceCount + ' invoice' + (invoiceCount !== 1 ? 's' : '') + '</div></div>' +
      '</div>' +
      '<div class="load-meta">' +
        '<div><div class="lm-label">Phone</div><div class="lm-val">' + (b.phone || '—') + '</div></div>' +
        '<div><div class="lm-label">Total Paid</div><div class="lm-val" style="color:var(--green);">$' + paid.toLocaleString() + '</div></div>' +
        '<div><div class="lm-label">Outstanding</div><div class="lm-val" style="color:' + (outstanding > 0 ? 'var(--amber)' : 'var(--green)') + ';">$' + outstanding.toLocaleString() + '</div></div>' +
      '</div></div>';
  }).join('');
}

function openBrokerDetail(brokerId) {
  var broker = _brokers.find(function(b) { return b.id === brokerId; });
  if (!broker) return;
  var panel   = document.getElementById('broker-detail-panel');
  var content = document.getElementById('broker-detail-content');
  var nameEl  = document.getElementById('broker-detail-name');
  nameEl.textContent = broker.name;
  var twelveMonthsAgo = new Date(); twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  var brokerInvs = invoices.filter(function(i) {
    if (!i.broker || i.broker.toLowerCase() !== broker.name.toLowerCase()) return false;
    return new Date(i.date) >= twelveMonthsAgo;
  });
  var today = new Date(), totalPaid = 0, totalOwed = 0;
  brokerInvs.forEach(function(i) { if (i.status === 'paid') totalPaid += i.amount; else totalOwed += i.amount; });
  var invoicesHtml = brokerInvs.length > 0
    ? brokerInvs.map(function(inv) {
        var due = new Date(inv.dueDate), daysLeft = Math.ceil((due-today)/(1000*60*60*24));
        var isOverdue = inv.status === 'pending' && daysLeft < 0;
        var badge = inv.status === 'paid' ? '<span class="paid-badge">PAID</span>' : isOverdue ? '<span class="overdue-badge">OVERDUE ' + Math.abs(daysLeft) + 'd</span>' : '<span class="due-badge">DUE IN ' + daysLeft + 'd</span>';
        return '<div class="invoice-item ' + (inv.status==="paid"?"paid":isOverdue?"overdue":"") + '" style="margin:.4rem 1rem;">' +
          '<div class="inv-top"><div><div class="inv-broker-name">' + (inv.ref||'Invoice') + '</div><div style="margin-top:.2rem;">' + badge + '</div></div><div class="inv-amount">$' + inv.amount.toLocaleString() + '</div></div>' +
          '<div class="inv-meta"><span class="inv-stat">Date: <strong>' + inv.date + '</strong></span><span class="inv-stat">Due: <strong>' + inv.dueDate + '</strong></span></div>' +
          '<div class="inv-actions">' + (inv.status !== 'paid' ? '<button class="inv-btn green" onclick="markPaid(\'' + inv.id + '\');openBrokerDetail(\'' + brokerId + '\')">✓ Mark Paid</button>' : '') + (broker.phone ? '<button class="inv-btn call" onclick="callBroker(\'' + broker.phone + '\',\'' + broker.name + '\')">📞 Call</button>' : '') + '</div>' +
          '<div style="padding:.2rem 1rem .6rem;">' + getDocUploadHTML(inv.id) + '</div></div>';
      }).join('')
    : '<div style="padding:1rem;font-size:.85rem;color:#b8c8b8;">No invoices in the last 12 months for this broker.</div>';
  content.innerHTML =
    '<div class="loadback-summary">' +
      '<div class="loadback-summary-row"><span>MC Number</span><strong>' + (broker.mc_number||'—') + '</strong></div>' +
      '<div class="loadback-summary-row"><span>Phone</span><strong>' + (broker.phone||'—') + '</strong></div>' +
      '<div class="loadback-summary-row"><span>Email</span><strong>' + (broker.email||'—') + '</strong></div>' +
      '<div class="loadback-summary-row"><span>Payment Terms</span><strong>Net ' + broker.payment_terms + '</strong></div>' +
      (broker.notes ? '<div class="loadback-summary-row"><span>Notes</span><strong>' + broker.notes + '</strong></div>' : '') +
      '<div class="loadback-summary-row"><span>Paid (12mo)</span><strong style="color:var(--green);">$' + totalPaid.toLocaleString() + '</strong></div>' +
      (totalOwed > 0 ? '<div class="loadback-summary-row"><span>Outstanding</span><strong style="color:var(--amber);">$' + totalOwed.toLocaleString() + '</strong></div>' : '') +
    '</div>' +
    '<div style="display:flex;gap:.5rem;padding:.8rem 1rem;">' +
      (broker.phone ? '<button class="lb-call-btn" onclick="callBroker(\'' + broker.phone + '\',\'' + broker.name + '\')">📞 Call</button>' : '') +
      '<button class="lb-call-btn" style="color:var(--red);border-color:rgba(255,126,126,.35);" onclick="deleteBroker(\'' + broker.id + '\',\'' + broker.name + '\')">🗑 Delete</button>' +
    '</div>' +
    '<div class="loadback-section-title">Invoice History — Last 12 Months</div>' +
    invoicesHtml +
    '<div style="padding:1rem;">' +
      '<div style="font-size:.72rem;color:var(--green);text-transform:uppercase;letter-spacing:.1em;margin-bottom:.5rem;">Add Invoice for ' + broker.name + '</div>' +
      '<div class="form-row" style="margin-bottom:.6rem;">' +
        '<div class="form-group"><label class="form-label">Amount</label><input class="form-input" id="bd-amount" type="number" placeholder="2500"></div>' +
        '<div class="form-group"><label class="form-label">Ref #</label><input class="form-input" id="bd-ref" placeholder="BOL-12345"></div>' +
      '</div>' +
      '<div class="form-row" style="margin-bottom:.8rem;">' +
        '<div class="form-group"><label class="form-label">Invoice Date</label><input class="form-input" id="bd-date" type="date"></div>' +
        '<div class="form-group"><label class="form-label">Terms</label><select class="form-select" id="bd-terms"><option value="15">Net 15</option><option value="30" selected>Net 30</option><option value="45">Net 45</option><option value="60">Net 60</option></select></div>' +
      '</div>' +
      '<button class="btn btn-green" onclick="addInvoiceFromBroker(\'' + broker.id + '\',\'' + broker.name + '\',\'' + (broker.phone||'') + '\')">Add Invoice</button>' +
    '</div><div style="height:2rem;"></div>';
  panel.classList.add('open');
  brokerInvs.forEach(function(inv) { loadInvoiceDocs(inv.id); });
}

function addInvoiceFromBroker(brokerId, brokerName, brokerPhone) {
  var amount = parseFloat(document.getElementById('bd-amount').value);
  var ref    = document.getElementById('bd-ref').value.trim();
  var date   = document.getElementById('bd-date').value;
  var terms  = parseInt(document.getElementById('bd-terms').value);
  if (!amount || !date) { alert('Amount and date required.'); return; }
  var invoiceDate = new Date(date), dueDate = new Date(invoiceDate);
  dueDate.setDate(dueDate.getDate() + terms);
  var inv = { broker: brokerName, broker_id: brokerId, amount: amount, ref: ref, date: date, terms: terms, phone: brokerPhone, dueDate: dueDate.toISOString().split('T')[0], status: 'pending', id: Date.now() };
  invoices.unshift(inv); renderInvoices();
  saveInvoiceToSupabase(inv).then(function(saved) {
    var idx = invoices.findIndex(function(i) { return i.id === inv.id; });
    if (idx >= 0) invoices[idx] = saved;
    renderBrokers();
    openBrokerDetail(brokerId);
  });
}

function closeBrokerDetail() { document.getElementById('broker-detail-panel').classList.remove('open'); }

async function deleteBroker(brokerId, brokerName) {
  if (!confirm('Delete ' + brokerName + ' from your broker network?')) return;
  try {
    var { error } = await _supabase.from('brokers').delete().eq('id', brokerId);
    if (error) throw error;
    closeBrokerDetail();
    await loadBrokers();
  } catch(err) { alert('Error deleting broker: ' + err.message); }
}

function populateBrokerDropdown() {
  var select = document.getElementById('inv-broker-select');
  if (!select) return;
  while (select.options.length > 1) select.remove(1);
  _brokers.forEach(function(b) {
    var opt = document.createElement('option');
    opt.value = b.name; opt.dataset.brokerId = b.id; opt.dataset.phone = b.phone || '';
    opt.textContent = b.name;
    select.appendChild(opt);
  });
}

function onBrokerSelectChange() {
  var select = document.getElementById('inv-broker-select');
  var nameInput = document.getElementById('inv-broker'), phoneInput = document.getElementById('inv-phone');
  if (!select) return;
  var selected = select.options[select.selectedIndex];
  if (selected && selected.value !== '') {
    if (nameInput) nameInput.value = selected.value;
    if (phoneInput && selected.dataset.phone) phoneInput.value = selected.dataset.phone;
    window._selectedBrokerId = selected.dataset.brokerId || null;
  } else window._selectedBrokerId = null;
}

// ══════════════════════════════════════════════════════════════
// INVOICE SYSTEM — Supabase backed
// ══════════════════════════════════════════════════════════════
var invoices = [];

async function loadInvoices() {
  if (!window._rcUserId) return;
  try {
    var { data, error } = await _supabase.from('invoices').select('*').eq('user_id', window._rcUserId).order('created_at', { ascending: false });
    if (error) throw error;
    invoices = (data || []).map(function(row) {
      return { id: row.id, broker: row.broker_name, amount: row.amount, ref: row.ref, date: row.invoice_date, terms: row.terms, phone: row.phone, dueDate: row.due_date, status: row.status, notes: row.notes, broker_id: row.broker_id, supabase: true };
    });
    renderInvoices();
    renderBrokers();
    updateMoneyTotals();
    checkDailyBriefing();
  } catch(err) { console.error('Error loading invoices:', err); }
}

async function saveInvoiceToSupabase(inv) {
  if (!window._rcUserId) return inv;
  try {
    var { data, error } = await _supabase.from('invoices').insert({ user_id: window._rcUserId, broker_name: inv.broker, amount: inv.amount, ref: inv.ref, phone: inv.phone, invoice_date: inv.date, due_date: inv.dueDate, terms: inv.terms, status: inv.status || 'pending', notes: inv.notes || '' }).select().single();
    if (error) throw error;
    return Object.assign({}, inv, { id: data.id, supabase: true });
  } catch(err) { console.error('Error saving invoice:', err); return inv; }
}

async function updateInvoiceStatus(id, status) {
  if (!window._rcUserId) return;
  try { await _supabase.from('invoices').update({ status: status }).eq('id', id).eq('user_id', window._rcUserId); }
  catch(err) { console.error('Error updating invoice:', err); }
}

async function deleteInvoiceFromSupabase(id) {
  if (!window._rcUserId) return;
  try { await _supabase.from('invoices').delete().eq('id', id).eq('user_id', window._rcUserId); }
  catch(err) { console.error('Error deleting invoice:', err); }
}

function addInvoice() {
  var broker = document.getElementById("inv-broker").value.trim();
  var amount = parseFloat(document.getElementById("inv-amount").value);
  var ref    = document.getElementById("inv-ref").value.trim();
  var date   = document.getElementById("inv-date").value;
  var terms  = parseInt(document.getElementById("inv-terms").value);
  var phone  = document.getElementById("inv-phone").value.trim();
  if (!broker || !amount || !date) { alert("Broker, amount, and date required."); return; }
  var invoiceDate = new Date(date);
  var dueDate = new Date(invoiceDate);
  dueDate.setDate(dueDate.getDate() + terms);
  var inv = { broker: broker, amount: amount, ref: ref, date: date, terms: terms, phone: phone, dueDate: dueDate.toISOString().split("T")[0], status: "pending", id: Date.now(), broker_id: window._selectedBrokerId || null };
  invoices.unshift(inv);
  renderInvoices();
  track('invoice_added', { amount: amount, broker: broker, terms: terms });
  saveInvoiceToSupabase(inv).then(function(saved) {
    var idx = invoices.findIndex(function(i) { return i.id === inv.id; });
    if (idx >= 0) invoices[idx] = saved;
    renderBrokers();
    window._selectedBrokerId = null;
  });
  ["inv-broker","inv-amount","inv-ref","inv-phone"].forEach(function(id) { var el = document.getElementById(id); if (el) el.value = ""; });
}

function markPaid(id) {
  var inv = invoices.find(function(i) { return i.id == id; });
  if (inv) { inv.status = "paid"; updateInvoiceStatus(id, "paid"); track('invoice_marked_paid', { amount: inv.amount, broker: inv.broker }); }
  renderInvoices(); renderBrokers();
}

function removeInvoice(id) {
  deleteInvoiceFromSupabase(id);
  invoices = invoices.filter(function(i) { return i.id != id; });
  renderInvoices(); renderBrokers();
}

function updateMoneyTotals() {
  var today = new Date(), outstanding = 0, overdue = 0;
  invoices.filter(function(i) { return i.status !== "paid"; }).forEach(function(i) {
    outstanding += i.amount;
    if (new Date(i.dueDate) < today) overdue += i.amount;
  });
  var mo = document.getElementById("money-outstanding"), mv = document.getElementById("money-overdue");
  if (mo) mo.textContent = "$" + outstanding.toLocaleString();
  if (mv) mv.textContent = "$" + overdue.toLocaleString();
}

function renderInvoices() {
  var list = document.getElementById("invoice-list");
  if (!list) return;
  var today = new Date();
  var thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  var activeInvoices = invoices.filter(function(inv) { return inv.status !== "paid"; });
  var paidThisMonth  = invoices.filter(function(inv) { return inv.status === "paid" && new Date(inv.date) >= thisMonthStart; });
  if (!invoices.length) {
    list.innerHTML = '<div class="empty-state"><div class="empty-state-icon">💵</div><div class="empty-state-msg">Your first load is out there. Book it and log the invoice here — tap Add Invoice above after you deliver.</div></div>';
    updateMoneyTotals(); return;
  }
  function buildRow(inv) {
    var due = new Date(inv.dueDate);
    var daysLeft = Math.ceil((due - today) / (1000*60*60*24));
    var isOverdue = inv.status === "pending" && daysLeft < 0;
    var badge = inv.status === "paid" ? '<span class="paid-badge">PAID</span>'
      : isOverdue ? '<span class="overdue-badge">OVERDUE ' + Math.abs(daysLeft) + 'd</span>'
      : '<span class="due-badge">DUE IN ' + daysLeft + 'd</span>';
    return '<div class="invoice-item ' + (inv.status==="paid"?"paid":isOverdue?"overdue":"") + '">' +
      '<div class="inv-top"><div><div class="inv-broker-name">' + inv.broker + '</div><div style="margin-top:.2rem;">' + badge + '</div></div><div class="inv-amount">$' + inv.amount.toLocaleString() + '</div></div>' +
      '<div class="inv-meta">' + (inv.ref ? '<span class="inv-stat">Ref: <strong>' + inv.ref + '</strong></span>' : '') + '<span class="inv-stat">Invoiced: <strong>' + inv.date + '</strong></span><span class="inv-stat">Due: <strong>' + inv.dueDate + '</strong></span></div>' +
      '<div class="inv-actions">' +
        (inv.phone ? '<button class="inv-btn call" onclick="callBroker(\'' + inv.phone + '\',\'' + inv.broker + '\')">📞 Call</button>' : '') +
        (inv.status !== "paid" ? '<button class="inv-btn green" onclick="markPaid(\'' + inv.id + '\')">✓ Mark Paid</button>' : '') +
        (inv.status !== "paid" ? '<button class="inv-btn" onclick="draftChaseMessage(\'' + inv.id + '\')" id="chase-btn-' + inv.id + '" style="background:none;border:1px solid rgba(122,184,255,.35);color:#7ab8ff;font-size:.72rem;">📨 Chase</button>' : '') +
        '<button class="inv-btn red" onclick="removeInvoice(\'' + inv.id + '\')">✕ Remove</button>' +
      '</div></div>';
  }
  var html = activeInvoices.length
    ? activeInvoices.map(buildRow).join('')
    : '<div style="padding:.8rem;font-size:.85rem;color:var(--green);text-align:center;">✅ All caught up — no outstanding invoices</div>';
  if (paidThisMonth.length) {
    var paidTotal = paidThisMonth.reduce(function(sum, i) { return sum + i.amount; }, 0);
    html += '<div style="margin-top:1rem;">' +
      '<div onclick="togglePaidSection()" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;padding:.6rem .8rem;background:var(--surface2);border-radius:4px;border:1px solid rgba(255,255,255,.08);">' +
        '<span style="font-size:.75rem;color:var(--green);text-transform:uppercase;letter-spacing:.08em;">✅ Paid This Month (' + paidThisMonth.length + ')</span>' +
        '<span style="font-size:.8rem;color:var(--green);font-weight:bold;">$' + paidTotal.toLocaleString() + ' <span id="paid-section-arrow" style="color:#b8c8b8;">▼</span></span>' +
      '</div>' +
      '<div id="paid-section-body" style="display:none;">' + paidThisMonth.map(buildRow).join('') + '</div>' +
    '</div>';
  }
  list.innerHTML = html;
  updateMoneyTotals();
}

function togglePaidSection() {
  var body = document.getElementById('paid-section-body');
  var arrow = document.getElementById('paid-section-arrow');
  if (!body) return;
  var isOpen = body.style.display !== 'none';
  body.style.display = isOpen ? 'none' : 'block';
  if (arrow) arrow.textContent = isOpen ? '▼' : '▲';
}

// ══════════════════════════════════════════════════════════════
// TAX EXPORT SYSTEM
// ══════════════════════════════════════════════════════════════
function loadScript(src) {
  return new Promise(function(resolve, reject) {
    var s = document.createElement('script'); s.src = src; s.onload = resolve; s.onerror = reject; document.head.appendChild(s);
  });
}
async function fetchDocAsBlob(url) { try { var r = await fetch(url); return r.ok ? await r.blob() : null; } catch(e) { return null; } }
function getExtFromUrl(url) { var parts = url.split('.'), ext = parts[parts.length-1].split('?')[0].toLowerCase(); return ['jpg','jpeg','png','pdf','webp'].indexOf(ext) >= 0 ? ext : 'jpg'; }

async function exportMonthlyTax(year, month) {
  if (!year || !month) { var now = new Date(); year = now.getFullYear(); month = now.getMonth() + 1; }
  var monthStr = String(month).padStart(2, '0');
  var monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var monthName = monthNames[month-1], folderName = year + '-' + monthStr;
  var monthStart = new Date(year, month-1, 1), monthEnd = new Date(year, month, 1);
  var monthInvoices = invoices.filter(function(inv) { var d = new Date(inv.date); return d >= monthStart && d < monthEnd; });
  if (!monthInvoices.length) { alert('No invoices found for ' + monthName + ' ' + year + '.'); return; }
  var btn = document.getElementById('tax-export-btn');
  if (btn) { btn.textContent = 'Building export...'; btn.disabled = true; }
  try {
    if (typeof JSZip === 'undefined') await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
    var zip = new JSZip(), monthFolder = zip.folder(folderName);
    var csvLines = ['Invoice Date,Broker,Reference,Amount,Due Date,Status,Notes'], totalAmount = 0, paidAmount = 0;
    for (var i = 0; i < monthInvoices.length; i++) {
      var inv = monthInvoices[i]; totalAmount += inv.amount; if (inv.status === 'paid') paidAmount += inv.amount;
      csvLines.push([inv.date, '"' + (inv.broker||'') + '"', '"' + (inv.ref||'') + '"', inv.amount, inv.dueDate, inv.status, '"' + (inv.notes||'') + '"'].join(','));
      var safeBroker = (inv.broker||'Unknown').replace(/[^a-zA-Z0-9]/g, '-');
      var invFolder = monthFolder.folder('Invoice-' + safeBroker + '-' + (inv.date||'nodate') + '-' + (inv.ref||'noref'));
      invFolder.file('invoice-summary.txt',
        'ROADCOMMAND INVOICE RECORD\n==========================\n' +
        'Broker:       ' + (inv.broker||'—') + '\nReference:    ' + (inv.ref||'—') + '\nAmount:       $' + inv.amount.toLocaleString() +
        '\nInvoice Date: ' + (inv.date||'—') + '\nDue Date:     ' + (inv.dueDate||'—') + '\nTerms:        Net ' + (inv.terms||'30') +
        '\nStatus:       ' + (inv.status||'pending').toUpperCase() + '\nPhone:        ' + (inv.phone||'—') +
        (inv.notes ? '\nNotes:        ' + inv.notes : '') + '\n\nExported from RoadCommand on ' + new Date().toLocaleDateString()
      );
      var docs = _invoiceDocs[inv.id] || {};
      if (docs.rateCon) { var rcB = await fetchDocAsBlob(docs.rateCon); if (rcB) invFolder.file('rate-confirmation.' + getExtFromUrl(docs.rateCon), rcB); }
      if (docs.bol)     { var bolB = await fetchDocAsBlob(docs.bol);     if (bolB) invFolder.file('bill-of-lading.' + getExtFromUrl(docs.bol), bolB); }
    }
    csvLines.push('', '"TOTAL","","","' + totalAmount + '","","",""', '"PAID","","","' + paidAmount + '","","",""', '"OUTSTANDING","","","' + (totalAmount-paidAmount) + '","","",""');
    monthFolder.file('_SUMMARY-' + folderName + '.csv', csvLines.join('\n'));
    var content = await zip.generateAsync({ type: 'blob' });
    var url = URL.createObjectURL(content), a = document.createElement('a');
    a.href = url; a.download = 'RoadCommand-' + folderName + '-Tax-Export.zip'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    alert('Export ready! ' + monthInvoices.length + ' invoices exported for ' + monthName + ' ' + year + '.');
    track('tax_export_downloaded', { year: year, month: month, invoice_count: monthInvoices.length, total: totalAmount });
  } catch(err) { alert('Export failed: ' + err.message); console.error('Tax export error:', err); }
  if (btn) { btn.textContent = '📦 Export Month'; btn.disabled = false; }
}

async function exportYearlyTax(year) {
  if (!year) year = new Date().getFullYear();
  var btn = document.getElementById('tax-year-export-btn');
  if (btn) { btn.textContent = 'Building annual export...'; btn.disabled = true; }
  var yearInvoices = invoices.filter(function(inv) { return inv.date && inv.date.startsWith(String(year)); });
  if (!yearInvoices.length) { alert('No invoices found for ' + year + '.'); if (btn) { btn.textContent = '📦 Export Full Year'; btn.disabled = false; } return; }
  try {
    if (typeof JSZip === 'undefined') await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
    var zip = new JSZip(), yearFolder = zip.folder(String(year) + '-Full-Year');
    var monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    var yearTotal = 0, yearPaid = 0, yearCsvLines = ['Month,Broker,Reference,Amount,Due Date,Status'];
    for (var m = 1; m <= 12; m++) {
      var ms = new Date(year, m-1, 1), me = new Date(year, m, 1);
      var mInvs = yearInvoices.filter(function(inv) { var d = new Date(inv.date); return d >= ms && d < me; });
      if (!mInvs.length) continue;
      var mStr = String(m).padStart(2,'0'), mFolder = yearFolder.folder(year + '-' + mStr + '-' + monthNames[m-1]);
      for (var i = 0; i < mInvs.length; i++) {
        var inv2 = mInvs[i]; yearTotal += inv2.amount; if (inv2.status === 'paid') yearPaid += inv2.amount;
        yearCsvLines.push([monthNames[m-1], '"' + (inv2.broker||'') + '"', '"' + (inv2.ref||'') + '"', inv2.amount, inv2.dueDate, inv2.status].join(','));
        var sb = (inv2.broker||'Unknown').replace(/[^a-zA-Z0-9]/g, '-'), iFolder = mFolder.folder('Invoice-' + sb + '-' + (inv2.date||'nodate'));
        iFolder.file('invoice-summary.txt', 'Broker: ' + (inv2.broker||'—') + '\nRef: ' + (inv2.ref||'—') + '\nAmount: $' + inv2.amount.toLocaleString() + '\nDate: ' + (inv2.date||'—') + '\nDue: ' + (inv2.dueDate||'—') + '\nStatus: ' + (inv2.status||'pending').toUpperCase());
        var docs2 = _invoiceDocs[inv2.id] || {};
        if (docs2.rateCon) { var rcB2 = await fetchDocAsBlob(docs2.rateCon); if (rcB2) iFolder.file('rate-confirmation.' + getExtFromUrl(docs2.rateCon), rcB2); }
        if (docs2.bol)     { var bolB2 = await fetchDocAsBlob(docs2.bol);     if (bolB2) iFolder.file('bill-of-lading.' + getExtFromUrl(docs2.bol), bolB2); }
      }
    }
    yearCsvLines.push('', '"YEAR TOTAL","","","' + yearTotal + '","",""', '"YEAR PAID","","","' + yearPaid + '","",""', '"YEAR OUTSTANDING","","","' + (yearTotal-yearPaid) + '","",""');
    yearFolder.file('_ANNUAL-SUMMARY-' + year + '.csv', yearCsvLines.join('\n'));
    var content = await zip.generateAsync({ type: 'blob' });
    var url = URL.createObjectURL(content), a = document.createElement('a');
    a.href = url; a.download = 'RoadCommand-' + year + '-Annual-Tax-Export.zip'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    alert('Annual export ready! ' + yearInvoices.length + ' invoices exported for ' + year + '.');
  } catch(err) { alert('Export failed: ' + err.message); }
  if (btn) { btn.textContent = '📦 Export Full Year'; btn.disabled = false; }
}

// ══════════════════════════════════════════════════════════════
// DOCUMENT VAULT
// ══════════════════════════════════════════════════════════════
var _invoiceDocs = {};

async function uploadInvoiceDoc(invoiceId, docType) {
  var input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*,.pdf';
  input.onchange = async function() {
    var file = input.files[0]; if (!file) return;
    var ext = file.name.split('.').pop().toLowerCase(), path = window._rcUserId + '/' + invoiceId + '/' + docType + '.' + ext;
    try {
      var { error } = await _supabase.storage.from('documents').upload(path, file, { upsert: true });
      if (error) throw error;
      var { data } = _supabase.storage.from('documents').getPublicUrl(path);
      if (!_invoiceDocs[invoiceId]) _invoiceDocs[invoiceId] = {};
      _invoiceDocs[invoiceId][docType] = data.publicUrl;
      var btn = document.getElementById('doc-btn-' + invoiceId + '-' + docType);
      if (btn) { btn.textContent = '✅ ' + (docType === 'rateCon' ? 'Rate Con' : 'BOL') + ' Uploaded'; btn.style.color = 'var(--green)'; btn.style.borderColor = 'var(--green-border)'; }
      var linkEl = document.getElementById('doc-link-' + invoiceId + '-' + docType);
      if (linkEl) linkEl.innerHTML = '<a href="' + data.publicUrl + '" target="_blank" style="color:var(--green);font-size:.72rem;">View ' + (docType === 'rateCon' ? 'Rate Con' : 'BOL') + ' →</a>';
      alert((docType === 'rateCon' ? 'Rate Confirmation' : 'BOL') + ' uploaded successfully!');
    } catch(err) { alert('Upload failed: ' + err.message); }
  };
  input.click();
}

async function loadInvoiceDocs(invoiceId) {
  if (!window._rcUserId) return;
  try {
    var { data, error } = await _supabase.storage.from('documents').list(window._rcUserId + '/' + invoiceId);
    if (error || !data) return;
    if (!_invoiceDocs[invoiceId]) _invoiceDocs[invoiceId] = {};
    data.forEach(function(file) {
      var docType = file.name.startsWith('rateCon') ? 'rateCon' : 'bol';
      var path = window._rcUserId + '/' + invoiceId + '/' + file.name;
      var { data: urlData } = _supabase.storage.from('documents').getPublicUrl(path);
      _invoiceDocs[invoiceId][docType] = urlData.publicUrl;
      var btn = document.getElementById('doc-btn-' + invoiceId + '-' + docType);
      if (btn) { btn.textContent = '✅ ' + (docType === 'rateCon' ? 'Rate Con' : 'BOL') + ' Uploaded'; btn.style.color = 'var(--green)'; btn.style.borderColor = 'var(--green-border)'; }
      var linkEl = document.getElementById('doc-link-' + invoiceId + '-' + docType);
      if (linkEl) linkEl.innerHTML = '<a href="' + urlData.publicUrl + '" target="_blank" style="color:var(--green);font-size:.72rem;">View ' + (docType === 'rateCon' ? 'Rate Con' : 'BOL') + ' →</a>';
    });
  } catch(err) { console.error('Error loading docs:', err); }
}

function getDocUploadHTML(invoiceId) {
  return '<div style="padding:.5rem 0;display:flex;gap:.5rem;flex-wrap:wrap;align-items:center;">' +
    '<button class="lb-call-btn doc-upload-btn" data-inv="' + invoiceId + '" data-type="rc" style="font-size:.72rem;" id="doc-btn-' + invoiceId + '-rateCon">📎 Rate Con</button>' +
    '<span id="doc-link-' + invoiceId + '-rateCon"></span>' +
    '<button class="lb-call-btn doc-upload-btn" data-inv="' + invoiceId + '" data-type="bol" style="font-size:.72rem;" id="doc-btn-' + invoiceId + '-bol">📎 BOL</button>' +
    '<span id="doc-link-' + invoiceId + '-bol"></span>' +
    '</div>';
}

// ── Event Delegation ──────────────────────────────────────────
document.addEventListener("click", function(e) {
  var btn = e.target.closest(".doc-upload-btn");
  if (btn) { uploadInvoiceDoc(btn.dataset.inv, btn.dataset.type === "rc" ? "rateCon" : "bol"); return; }
  var card = e.target.closest(".broker-card");
  if (card && card.dataset.brokerId) { openBrokerDetail(card.dataset.brokerId); return; }
  var copyChase = e.target.closest(".copy-chase-btn");
  if (copyChase) { var textEl = copyChase.closest('div').previousElementSibling; if (textEl) navigator.clipboard.writeText(textEl.textContent).then(function() { alert('Copied!'); }); return; }
  var closeChase = e.target.closest(".close-chase-modal");
  if (closeChase) { var modal = closeChase.closest('[style*="position:fixed"]') || closeChase.closest('[style*="fixed"]'); if (modal) modal.remove(); return; }
  var aiBtn = e.target.closest(".ai-decide-btn");
  if (aiBtn) { getLoadDecision(aiBtn.dataset.panelId, parseFloat(aiBtn.dataset.rate), parseFloat(aiBtn.dataset.miles), aiBtn.dataset.broker, aiBtn.dataset.pickup); return; }
  // Route Intel on load card — event delegation (Change 4)
  var riBtn = e.target.closest(".route-intel-card-btn");
  if (riBtn) { getRouteIntelForCard(riBtn.dataset.dest, riBtn.dataset.panel); return; }
  var removeBtn = e.target.closest(".remove-invoice-btn");
  if (removeBtn && removeBtn.dataset.invId) removeInvoice(removeBtn.dataset.invId);
  var moreDrawer = document.getElementById('more-drawer');
  if (moreDrawer && moreDrawer.classList.contains('open')) {
    if (!e.target.closest('#more-drawer') && !e.target.closest('#more-nav-btn')) { closeMoreDrawer(); }
  }
});

// ══════════════════════════════════════════════════════════════
// CROWDSOURCED FUEL PRICE
// ══════════════════════════════════════════════════════════════
var _crowdFuelPrice = null, _crowdReportCount = 0;

function distanceMiles(lat1, lon1, lat2, lon2) {
  var R = 3958.8, dLat = (lat2-lat1)*Math.PI/180, dLon = (lon2-lon1)*Math.PI/180;
  var a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)*Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

async function fetchCrowdFuelPrice(lat, lon) {
  if (!lat || !lon) return null;
  try {
    var sevenDaysAgo = new Date(Date.now() - 7*24*60*60*1000).toISOString();
    var { data, error } = await _supabase.from('fuel_prices').select('price,latitude,longitude,created_at,location_name').gte('created_at', sevenDaysAgo).order('created_at', { ascending: false });
    if (error || !data || !data.length) return null;
    var nearby = data.filter(function(row) { return distanceMiles(lat, lon, row.latitude, row.longitude) <= 100; });
    if (!nearby.length) return null;
    var avg = nearby.reduce(function(sum, r) { return sum + parseFloat(r.price); }, 0) / nearby.length;
    _crowdReportCount = nearby.length; _crowdFuelPrice = Math.round(avg*1000)/1000;
    return { price: _crowdFuelPrice, count: nearby.length };
  } catch(err) { console.error('Crowd fuel error:', err); return null; }
}

async function submitFuelPrice() {
  var input = document.getElementById('crowd-fuel-input'), price = parseFloat(input ? input.value : 0);
  if (!price || price < 2 || price > 10) { alert('Please enter a valid diesel price between $2 and $10.'); return; }
  if (!window._rcUserId) { alert('Please sign in to submit a price.'); return; }
  if (!window._gpsLat || !window._gpsLon) { alert('GPS location required to submit a price.'); return; }
  try {
    var { error } = await _supabase.from('fuel_prices').insert({ user_id: window._rcUserId, price: price, latitude: window._gpsLat, longitude: window._gpsLon, location_name: currentCity || 'Unknown' });
    if (error) throw error;
    defaults.fuelPrice = price;
    var fv = document.getElementById('fuel-value'), fs = document.getElementById('fuel-sub'), fb = document.getElementById('fuel-box'), fd = document.getElementById('fuel-dot');
    if (fv) fv.textContent = '$' + price.toFixed(3) + '/gal'; if (fs) fs.textContent = 'Your report · ' + (currentCity || 'Local'); if (fd) fd.className = 'live-dot green'; if (fb) fb.className = 'live-box connected';
    closeFuelModal(); injectProfitBars();
    fetchCrowdFuelPrice(window._gpsLat, window._gpsLon).then(function(result) { if (result && result.count >= 3) updateFuelDisplay(result.price, result.count); });
    track('fuel_price_reported', { price: price, city: currentCity || 'unknown' });
    alert('Thanks! Your price report helps all RoadCommand drivers in your area.');
  } catch(err) { alert('Error submitting price: ' + err.message); }
}

function updateFuelDisplay(price, count) {
  var fv = document.getElementById('fuel-value'), fs = document.getElementById('fuel-sub'), fu = document.getElementById('fuel-updated');
  if (fv) fv.textContent = '$' + price.toFixed(3) + '/gal';
  if (fs) fs.textContent = count >= 3 ? 'Driver reports · ' + count + ' nearby' : 'Limited data · ' + count + ' report' + (count > 1 ? 's' : '') + ' nearby';
  if (fu) fu.textContent = 'Crowdsourced — last 7 days';
  defaults.fuelPrice = price; injectProfitBars();
}
function openFuelModal() {
  var modal = document.getElementById('fuel-report-modal');
  if (modal) { modal.style.display = 'flex'; var input = document.getElementById('crowd-fuel-input'); if (input) { input.value = defaults.fuelPrice ? defaults.fuelPrice.toFixed(2) : ''; setTimeout(function() { input.focus(); }, 100); } }
}
document.addEventListener('touchend', function(e) { var fb = e.target.closest('#fuel-box'); if (fb) { e.preventDefault(); openFuelModal(); } }, { passive: false });
function closeFuelModal() { var modal = document.getElementById('fuel-report-modal'); if (modal) modal.style.display = 'none'; }

// ══════════════════════════════════════════════════════════════
// AI FEATURES
// ══════════════════════════════════════════════════════════════
async function callAI(prompt, maxTokens) {
  maxTokens = maxTokens || 300;
  var aiWorkerUrl = window._rcAIWorker, aiEndpoint = aiWorkerUrl || "https://api.anthropic.com/v1/messages";
  var aiHeaders = aiWorkerUrl ? { "Content-Type": "application/json" } : { "Content-Type": "application/json", "x-api-key": window._rcAnthropicKey || "", "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" };
  var response = await fetch(aiEndpoint, { method: "POST", headers: aiHeaders, body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] }) });
  var data = await response.json();
  if (data.content && data.content[0]) return data.content[0].text;
  throw new Error(data.error ? data.error.message : "AI unavailable");
}

async function showDailyBriefing() {
  var today = new Date().toDateString(), lastShown = '';
  try { lastShown = localStorage.getItem('rc-briefing-date') || ''; } catch(e) {}
  if (lastShown === today) return;
  var outstanding = invoices.filter(function(i) { return i.status !== 'paid'; }).reduce(function(sum, i) { return sum + i.amount; }, 0);
  var overdue = invoices.filter(function(i) { return i.status !== 'paid' && new Date(i.dueDate) < new Date(); }).reduce(function(sum, i) { return sum + i.amount; }, 0);
  var maintDue = maintItems.filter(function(m) { return (m.currentOdo - m.lastOdo) >= (m.interval * 0.85); }).map(function(m) { return m.name; }).join(', ');
  var prompt = "You are RoadCommand, a dispatcher assistant for an owner-operator trucker. Generate a brief, friendly morning dispatch briefing in 2-3 sentences max. Be direct and practical.\n\nContext:\n- Driver: " + (window._rcUserFirstName||'Driver') + "\n- Location: " + (currentCity||'Unknown') + ", " + (currentState||'') + "\n- Current diesel price: $" + (defaults.fuelPrice?defaults.fuelPrice.toFixed(3):'?') + "/gal\n- Outstanding invoices: $" + outstanding.toLocaleString() + (overdue > 0 ? " ($" + overdue.toLocaleString() + " overdue)" : "") + (maintDue ? "\n- Maintenance due soon: " + maintDue : "") + "\n- Current region: " + (currentRegion||'Unknown') + "\n\nGenerate a morning briefing. Mention any overdue invoices or maintenance issues if present. End with one piece of tactical advice for today.";
  try {
    var text = await callAI(prompt, 150);
    showBriefingBanner(text);
    try { localStorage.setItem('rc-briefing-date', today); } catch(e) {}
  } catch(e) { console.log('Daily briefing unavailable:', e.message); }
}

function showBriefingBanner(text) {
  var existing = document.getElementById('daily-briefing-banner'); if (existing) existing.remove();
  var banner = document.createElement('div'); banner.id = 'daily-briefing-banner';
  banner.style.cssText = 'background:var(--surface);border:1px solid var(--green-border);border-radius:4px;padding:.9rem 1rem;margin-bottom:.8rem;position:relative;';
  banner.innerHTML = '<div style="font-size:.7rem;color:var(--green);text-transform:uppercase;letter-spacing:.1em;margin-bottom:.4rem;">🤖 Morning Briefing</div>' +
    '<div style="font-size:.85rem;line-height:1.7;color:var(--text);">' + text + '</div>' +
    '<div style="font-size:.68rem;color:#b8c8b8;margin-top:.4rem;font-style:italic;">AI-generated · Verify details before making decisions</div>' +
    '<button onclick="this.parentElement.remove()" style="position:absolute;top:.5rem;right:.5rem;background:none;border:none;color:#b8c8b8;cursor:pointer;font-size:1rem;">✕</button>';
  var dashScreen = document.getElementById('screen-dash'), firstCard = dashScreen ? dashScreen.querySelector('.card,.weather-strip,.live-bar') : null;
  if (firstCard) dashScreen.insertBefore(banner, firstCard);
}

async function getLoadDecision(panelId, rate, miles, broker, pickup) {
  var btn = document.getElementById('ai-decide-' + panelId); if (btn) { btn.textContent = '🤖 Analyzing...'; btn.disabled = true; }
  var deadMiles  = getDeadheadMiles(pickup) || 0;
  var fuelPrice  = defaults.fuelPrice || 4.25;
  var mpg        = defaults.mpg || 6.5;
  var emptyMpg   = defaults.emptyMpg || 8.0;
  var loadedFuel = Math.round((miles / mpg) * fuelPrice);
  var deadFuel   = Math.round((deadMiles / emptyMpg) * fuelPrice);
  var totalFuel  = loadedFuel + deadFuel;
  var net        = rate - totalFuel;
  var rpm        = parseFloat((rate / miles).toFixed(2));
  var netPerMile = parseFloat((net / (miles + deadMiles)).toFixed(2));
  var minRpm     = defaults.minRpm || 2.00;
  var minGross   = defaults.minGross || 1500;

  var rpmStatus   = rpm >= minRpm   ? 'ABOVE minimum ($' + rpm + ' vs $' + minRpm + ' min)' : 'BELOW minimum ($' + rpm + ' vs $' + minRpm + ' min)';
  var grossStatus = rate >= minGross ? 'ABOVE minimum ($' + rate + ' vs $' + minGross + ' min)' : 'BELOW minimum ($' + rate + ' vs $' + minGross + ' min)';

  var brokerInfo = "";
  if (broker) {
    var bKey = broker.toLowerCase(), keys = Object.keys(BROKER_DB);
    for (var k = 0; k < keys.length; k++) {
      if (bKey.indexOf(keys[k]) >= 0 || keys[k].indexOf(bKey) >= 0) {
        var bd = BROKER_DB[keys[k]];
        brokerInfo = "Broker credit: " + bd.score + ", avg " + bd.days + " days to pay.";
        break;
      }
    }
  }

  var prompt =
    "You are a freight dispatcher advising an owner-operator trucker. Give a quick TAKE IT or PASS recommendation with ONE sentence of reasoning. Be blunt and specific with numbers.\n\n" +
    "LOAD DETAILS:\n" +
    "- Gross rate: $" + rate + " — " + grossStatus + "\n" +
    "- Miles: " + miles + " loaded + " + deadMiles + " deadhead\n" +
    "- Rate per mile: $" + rpm + " — " + rpmStatus + "\n" +
    "- Loaded fuel: $" + loadedFuel + " · Deadhead fuel: $" + deadFuel + "\n" +
    "- Net after all fuel: $" + net + " ($" + netPerMile + "/mi all-in)\n" +
    "- Broker: " + (broker || "unknown") + (brokerInfo ? " — " + brokerInfo : "") + "\n\n" +
    "Reply format: TAKE IT or PASS — [one sentence with the key number that drives your decision]";

  try {
    var text = await callAI(prompt, 80);
    var resultEl = document.getElementById('ai-decide-result-' + panelId);
    if (resultEl) {
      var isTake = text.toUpperCase().includes('TAKE');
      resultEl.innerHTML =
        '<div style="padding:.5rem .7rem;border-radius:3px;font-size:.82rem;margin-top:.4rem;background:' + (isTake ? 'var(--green-dim)' : 'var(--red-dim)') + ';border:1px solid ' + (isTake ? 'var(--green-border)' : 'rgba(255,126,126,.35)') + ';color:' + (isTake ? 'var(--green)' : 'var(--red)') + ';">🤖 ' + text + '</div>' +
        '<div style="font-size:.68rem;color:#b8c8b8;margin-top:.25rem;font-style:italic;">AI estimate · Verify costs before booking</div>';
      resultEl.style.display = 'block';
    }
  } catch(e) { if (btn) btn.textContent = 'AI unavailable'; }
  if (btn) { btn.textContent = '🤖 AI Decision'; btn.disabled = false; }
}

async function draftChaseMessage(invoiceId) {
  var inv = invoices.find(function(i) { return i.id == invoiceId; }); if (!inv) return;
  var today = new Date(), due = new Date(inv.dueDate), daysOverdue = Math.ceil((today-due)/(1000*60*60*24));
  var prompt = "Write a short, professional collection message for an overdue freight invoice. Keep it firm but professional.\n\nDetails:\n- Broker: " + inv.broker + "\n- Amount: $" + inv.amount.toLocaleString() + "\n- Reference: " + (inv.ref||'N/A') + "\n- Days overdue: " + daysOverdue + "\n- Driver name: " + (window._rcUserFirstName||'Driver') + "\n\nWrite a 3-4 sentence email or text message.";
  var btn = document.getElementById('chase-btn-' + invoiceId); if (btn) { btn.textContent = 'Drafting...'; btn.disabled = true; }
  try {
    var text = await callAI(prompt, 200);
    var modal = document.createElement('div'); modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:950;display:flex;align-items:flex-end;padding:1rem;';
    modal.innerHTML = '<div style="background:var(--surface);border:1px solid var(--green-border);border-radius:8px;width:100%;max-width:480px;margin:0 auto;padding:1.5rem;"><div style="font-size:.85rem;font-weight:bold;color:var(--green);margin-bottom:.8rem;">📨 Collection Message Draft</div><div style="font-size:.85rem;line-height:1.7;color:var(--text);background:var(--surface2);border-radius:4px;padding:.8rem;margin-bottom:1rem;">' + text + '</div><div style="font-size:.68rem;color:#b8c8b8;margin-bottom:.8rem;font-style:italic;">AI-generated draft — review and edit before sending</div><div style="display:flex;gap:.5rem;"><button class="btn btn-green copy-chase-btn" style="flex:1;">📋 Copy</button><button class="btn btn-outline close-chase-modal" style="flex:1;">Close</button></div></div>';
    document.body.appendChild(modal);
  } catch(e) { alert('AI unavailable. Try again later.'); }
  if (btn) { btn.textContent = '📨 Chase'; btn.disabled = false; }
}

async function generateWeeklySummary() {
  var btn = document.getElementById('weekly-summary-btn'); if (btn) { btn.textContent = 'Generating...'; btn.disabled = true; }
  track('weekly_summary_generated', {});
  var totalRevenue = invoices.reduce(function(sum, i) { return sum + i.amount; }, 0);
  var paidRevenue  = invoices.filter(function(i) { return i.status === 'paid'; }).reduce(function(sum, i) { return sum + i.amount; }, 0);
  var outstanding = totalRevenue - paidRevenue, brokerCount = _brokers.length, maintCPM = 0;
  maintItems.forEach(function(m) { maintCPM += m.cost / m.interval; });
  var prompt = "Generate a brief weekly business performance summary for an owner-operator trucker. Be direct, specific, and tactical.\n\nBusiness data:\n- Driver: " + (window._rcUserFirstName||'Driver') + "\n- Total invoiced: $" + totalRevenue.toLocaleString() + "\n- Paid: $" + paidRevenue.toLocaleString() + "\n- Outstanding: $" + outstanding.toLocaleString() + "\n- Active brokers: " + brokerCount + "\n- Maintenance cost/mile: $" + maintCPM.toFixed(3) + "\n- Current diesel: $" + (defaults.fuelPrice?defaults.fuelPrice.toFixed(3):'?') + "/gal\n- Region: " + (currentRegion||'Unknown') + "\n\nWrite 3-4 sentences: performance assessment, one concern or opportunity, one tactical recommendation for next week. End with an encouraging close.";
  try {
    var text = await callAI(prompt, 200);
    var output = document.getElementById('weekly-summary-output');
    if (output) {
      output.innerHTML = '<div style="background:var(--surface2);border:1px solid var(--green-border);border-radius:4px;padding:1rem;margin-top:.8rem;">' +
        '<div style="font-size:.7rem;color:var(--green);text-transform:uppercase;letter-spacing:.1em;margin-bottom:.5rem;">📊 Weekly Business Summary</div>' +
        '<div style="font-size:.88rem;line-height:1.8;color:var(--text);">' + text + '</div>' +
        '<div style="font-size:.68rem;color:#b8c8b8;margin-top:.5rem;font-style:italic;">AI-generated summary based on your invoice data</div>' +
      '</div>';
      output.style.display = 'block';
    }
  } catch(e) { alert('AI unavailable. Try again later.'); }
  if (btn) { btn.textContent = '📊 Generate Weekly Summary'; btn.disabled = false; }
}

// ══════════════════════════════════════════════════════════════
// ROUTE INTEL — standalone + load card (Change 4)
// ══════════════════════════════════════════════════════════════

// Shared core logic — called by both standalone and card versions
async function _fetchRouteIntel(destination) {
  var destKey = destination.toLowerCase().split(',')[0].trim();
  var returnLoads = RETURN_LOADS[destKey] || NEARBY_LOADS[destKey] || [];
  var topReturn = returnLoads.length > 0 ? returnLoads[0].route + " at $" + returnLoads[0].rpm.toFixed(2) + "/mi" : "limited return data in database";
  var prompt = "Give a 3-point tactical briefing for a trucker delivering to " + destination + ". Be specific and practical.\n\nContext:\n- Driver coming from: " + (currentCity||currentState||'Pacific Northwest') + "\n- Best return load in database: " + topReturn + "\n- Current diesel: $" + (defaults.fuelPrice?defaults.fuelPrice.toFixed(3):'?') + "\n\nFormat as exactly 3 numbered points. Each point max 2 sentences. Focus on: (1) rates from that market, (2) best return lane strategy, (3) timing or tactical tip.";
  try {
    var text = await callAI(prompt, 250);
    return '<div style="background:var(--surface2);border:1px solid var(--green-border);border-radius:4px;padding:1rem;margin-top:.5rem;">' +
      '<div style="font-size:.7rem;color:var(--green);text-transform:uppercase;letter-spacing:.1em;margin-bottom:.5rem;">🗺️ Route Intel — ' + destination + '</div>' +
      '<div style="font-size:.85rem;line-height:1.8;color:var(--text);white-space:pre-wrap;">' + text + '</div>' +
      '<div style="font-size:.68rem;color:#b8c8b8;margin-top:.5rem;font-style:italic;">AI estimate · Market conditions change — verify current rates before booking</div>' +
    '</div>';
  } catch(e) {
    return '<div class="alert alert-amber" style="margin-top:.5rem;"><div class="alert-icon">⚠️</div><div>AI unavailable. Check your connection.</div></div>';
  }
}

// Standalone — Dispatcher tab
async function getRouteIntel(destination) {
  if (!destination) { destination = document.getElementById('route-intel-dest') ? document.getElementById('route-intel-dest').value.trim() : ''; }
  if (!destination) { alert('Enter a destination city first.'); return; }
  track('route_intel_requested', { destination: destination });
  var btn = document.getElementById('route-intel-btn'), output = document.getElementById('route-intel-output');
  if (btn) { btn.textContent = 'Analyzing...'; btn.disabled = true; }
  var result = await _fetchRouteIntel(destination);
  if (output) { output.innerHTML = result; output.style.display = 'block'; }
  if (btn) { btn.textContent = '🗺️ Get Route Intel'; btn.disabled = false; }
}

// Load card — pre-populated with destination from card data-dest attribute
async function getRouteIntelForCard(destination, panelId) {
  if (!destination) return;
  track('route_intel_requested', { destination: destination, source: 'load_card' });
  var btn = document.getElementById('route-intel-btn_' + panelId);
  var output = document.getElementById('route-intel-result_' + panelId);
  if (btn) { btn.textContent = '🗺️ Loading...'; btn.disabled = true; }
  var result = await _fetchRouteIntel(destination);
  if (output) { output.innerHTML = result; output.style.display = 'block'; }
  if (btn) { btn.textContent = '🗺️ Route Intel — ' + destination; btn.disabled = false; }
}

// Standalone HOS checker (kept in Dispatcher tab)
function checkHOS() {
  var hours  = parseFloat(document.getElementById("hos-hours").value) || 0;
  var miles  = parseFloat(document.getElementById("hos-miles").value) || 0;
  var pickup = parseFloat(document.getElementById("hos-pickup").value) || 1;
  var speed  = parseFloat(document.getElementById("hos-speed").value) || 55;
  var container = document.getElementById("hos-result");
  if (!hours || !miles) { alert("Enter available hours and miles."); return; }
  var driveTime = miles / speed;
  var totalNeeded = driveTime + pickup;
  var buffer = hours - totalNeeded;
  var legal = buffer >= 0;
  container.innerHTML = (legal
    ? '<div class="hos-pass"><div class="hos-title">✅ Legal — You Can Make This Load</div><div class="hos-detail">Drive time: <strong>' + driveTime.toFixed(1) + ' hrs</strong> at ' + speed + ' mph<br>Pickup window: <strong>' + pickup + ' hrs</strong><br>Total needed: <strong>' + totalNeeded.toFixed(1) + ' hrs</strong><br>Your available: <strong>' + hours + ' hrs</strong><br>Buffer: <strong>' + buffer.toFixed(1) + ' hrs</strong> to spare</div></div>'
    : '<div class="hos-fail"><div class="hos-title">❌ Illegal — Do Not Accept This Load</div><div class="hos-detail">You need <strong>' + totalNeeded.toFixed(1) + ' hours</strong> but only have <strong>' + hours + ' hours</strong>.<br>You are short <strong>' + Math.abs(buffer).toFixed(1) + ' hours</strong>.<br><br>Options: Reset your clock, negotiate a later pickup, or pass on this load.</div></div>')
    + HOS_DISCLAIMER;
  container.style.display = "block";
}

function promptLogRun(origin, dest, rate, miles) {
  var today = new Date().toISOString().split('T')[0], rpm = (rate/miles).toFixed(2);
  if (confirm('Log this as a completed run? ' + origin + ' to ' + dest + ' - $' + rate.toLocaleString() + ' at $' + rpm + '/mi')) {
    var logList = document.getElementById('run-list');
    if (logList) {
      var item = document.createElement('div');
      item.className = 'run-row';
      item.innerHTML = '<div><div class="run-route">' + origin + ' → ' + dest + '</div><div class="run-meta">' + today + ' · ' + miles + ' mi</div></div><div><div class="run-profit">$' + rate.toLocaleString() + '</div><div class="run-rpm">$' + rpm + '/mi</div></div>';
      logList.insertBefore(item, logList.firstChild);
    }
    var ytdRev = document.getElementById('log-ytd-rev'); if (ytdRev) { var current = parseFloat(ytdRev.textContent.replace(/[^0-9.]/g,''))||0; ytdRev.textContent = '$' + (current+rate).toLocaleString(); }
  }
}

function calcBrokerAvgDays(brokerName) {
  var brokerInvs = invoices.filter(function(i) { return i.broker && i.broker.toLowerCase() === brokerName.toLowerCase() && i.status === 'paid'; });
  if (!brokerInvs.length) return null;
  return Math.round(brokerInvs.reduce(function(sum, inv) { return sum + inv.terms; }, 0) / brokerInvs.length);
}

function updateOdometer() {
  var input = document.getElementById('dash-odometer'); if (!input) return;
  var odo = parseInt(input.value); if (!odo || odo < 100000) { alert('Enter a valid odometer reading (100,000+)'); return; }
  maintItems = maintItems.map(function(item) { return Object.assign({}, item, { currentOdo: odo }); });
  renderMaint(); maintItems.forEach(function(item) { saveMaintItemToSupabase(item); }); input.value = '';
  alert('Odometer updated to ' + odo.toLocaleString() + ' mi. Maintenance status refreshed.');
}

function checkDailyBriefing() { if (window._rcAIWorker || window._rcAnthropicKey) setTimeout(showDailyBriefing, 2000); }

// ══════════════════════════════════════════════════════════════
// NWS LIVE ALERTS
// ══════════════════════════════════════════════════════════════
var _nwsLastFetch = 0, _nwsAlerts = [];

async function fetchNWSAlerts(lat, lon) {
  if (Date.now() - _nwsLastFetch < 30*60*1000 && _nwsAlerts.length) { renderNWSAlerts(_nwsAlerts); return; }
  try {
    var alertsRes = await fetch('https://api.weather.gov/alerts/active?point=' + parseFloat(lat).toFixed(4) + ',' + parseFloat(lon).toFixed(4), { headers: { 'User-Agent': 'RoadCommand/1.0 (admin@roadcommand.co)' } });
    if (!alertsRes.ok) throw new Error('NWS unavailable');
    var alertsData = await alertsRes.json(), features = alertsData.features || [];
    var truckKeywords = ['winter storm','blizzard','ice','freezing','snow','wind advisory','high wind','chain','fog','frost','freeze','road','travel'];
    var relevant = features.filter(function(f) { var event = (f.properties.event||'').toLowerCase(), headline = (f.properties.headline||'').toLowerCase(); return truckKeywords.some(function(kw) { return event.includes(kw) || headline.includes(kw); }); }).slice(0,3);
    _nwsAlerts = relevant; _nwsLastFetch = Date.now(); renderNWSAlerts(relevant);
  } catch(e) { console.log('NWS unavailable, using static alerts'); }
}

function renderNWSAlerts(alerts) {
  var iconEl = document.getElementById('weather-icon'), titleEl = document.getElementById('weather-title'), subEl = document.getElementById('weather-sub'), mainRow = document.getElementById('weather-main'), alertsEl = document.getElementById('weather-alerts'), timeEl = document.getElementById('weather-time');
  if (!mainRow) return;
  var now = new Date(); if (timeEl) timeEl.textContent = now.getHours() + ':' + String(now.getMinutes()).padStart(2,'0');
  if (!alerts || !alerts.length) { mainRow.className = 'weather-row clear'; if (iconEl) iconEl.textContent = '✅'; if (titleEl) titleEl.textContent = 'No Active Road Alerts — NWS'; if (subEl) subEl.textContent = 'National Weather Service reports no alerts for your area'; if (alertsEl) alertsEl.innerHTML = ''; return; }
  var sev = alerts[0].properties.severity||'Minor', event = alerts[0].properties.event||'Weather Alert', desc = (alerts[0].properties.description||'').split('.')[0].trim();
  var rowClass = (sev === 'Extreme' || sev === 'Severe') ? 'alert' : 'warning', icon = sev === 'Extreme' ? '🚨' : sev === 'Severe' ? '❄️' : '⚠️';
  mainRow.className = 'weather-row ' + rowClass;
  if (iconEl) iconEl.textContent = icon; if (titleEl) titleEl.textContent = event + ' — NWS Live'; if (subEl) subEl.textContent = desc;
  if (alertsEl) alertsEl.innerHTML = alerts.slice(1).map(function(a) { var cls = (a.properties.severity==='Extreme'||a.properties.severity==='Severe')?'alert':'warning', ic = a.properties.severity==='Extreme'?'🚨':'⚠️', d = (a.properties.description||'').split('.')[0].trim(); return '<div class="weather-row ' + cls + '"><span class="weather-icon">' + ic + '</span><div class="weather-text"><div class="weather-title">' + (a.properties.event||'Alert') + '</div><div class="weather-sub">' + d + '</div></div></div>'; }).join('');
}

// ══════════════════════════════════════════════════════════════
// FMCSA AUTHORITY HEALTH
// ══════════════════════════════════════════════════════════════
var FMCSA_KEY = 'd766def283f39a89c821a2e8d4a00f58e049f077';
var _fmcsaData = null;

async function fetchFMCSAProfile(mcNumber) {
  if (!mcNumber) return null;
  var mc = mcNumber.toString().replace(/^MC-?/i, '').trim();
  try {
    var url = 'https://mobile.fmcsa.dot.gov/qc/services/carriers/docket-number/' + mc + '?webKey=' + FMCSA_KEY;
    var res = await fetch(url);
    if (!res.ok) throw new Error('FMCSA API error: ' + res.status);
    var data = await res.json();
    return data;
  } catch(err) { console.error('FMCSA fetch error:', err); return null; }
}

async function loadFMCSAProfile() {
  var mc = window._rcMCNumber || (window._fmcsaData && window._fmcsaData.mc);
  if (!mc) { var mcInput = document.getElementById('set-mc-number'); if (mcInput) mc = mcInput.value.trim(); }
  if (!mc) { renderFMCSACard(null, 'no-mc'); return; }
  renderFMCSACard(null, 'loading');
  var data = await fetchFMCSAProfile(mc);
  if (!data) { renderFMCSACard(null, 'error'); return; }
  var carrier = null;
  if (data.content && Array.isArray(data.content) && data.content[0] && data.content[0].carrier) { carrier = data.content[0].carrier; }
  else if (data.content && data.content.carrier) { carrier = data.content.carrier; }
  else if (data.carrier) { carrier = data.carrier; }
  else { carrier = data; }
  _fmcsaData = carrier; window._fmcsaData = carrier;
  if (window._rcUserId && window._supabaseReady) {
    try { await _supabase.from('profiles').update({ mc_number: mc }).eq('user_id', window._rcUserId); } catch(e) {}
  }
  renderFMCSACard(carrier, 'loaded');
  renderFMCSADashCard(carrier);
  track('fmcsa_profile_loaded', { mc: mc });
}

function calcAuthorityScore(carrier) {
  if (!carrier) return { score: 0, tier: 'unknown', color: '#b8c8b8' };
  var score = 100, issues = [];
  var authStatus = (carrier.allowedToOperate || '').toUpperCase();
  if (authStatus === 'N') { score -= 40; issues.push('Not authorized to operate'); }
  var safetyRating = (carrier.safetyRating || '').toLowerCase();
  if (safetyRating === 'unsatisfactory') { score -= 35; issues.push('Unsatisfactory safety rating'); }
  else if (safetyRating === 'conditional') { score -= 15; issues.push('Conditional safety rating'); }
  var bipdAmt = parseFloat(carrier.bipdInsuranceOnFile || 0);
  var hasInsurance = bipdAmt > 0;
  if (!hasInsurance) { score -= 25; issues.push('BIPD insurance not on file — fix immediately'); }
  var driverOos = parseFloat(carrier.driverOosRate || 0);
  var vehicleOos = parseFloat(carrier.vehicleOosRate || 0);
  if (driverOos > 25) { score -= 15; issues.push('Driver OOS rate ' + driverOos.toFixed(1) + '% — national avg 5.51%'); }
  else if (driverOos > 10) { score -= 8; issues.push('Driver OOS rate elevated — review driver compliance'); }
  if (vehicleOos > 35) { score -= 15; issues.push('Vehicle OOS rate ' + vehicleOos.toFixed(1) + '% — national avg 20.72%'); }
  else if (vehicleOos > 20) { score -= 8; issues.push('Vehicle OOS rate above national average'); }
  score = Math.max(0, Math.min(100, score));
  var tier, color, label;
  if (score >= 85)      { tier = 'strong'; color = 'var(--green)'; label = 'Strong'; }
  else if (score >= 65) { tier = 'stable'; color = '#7ab8ff'; label = 'Stable'; }
  else if (score >= 40) { tier = 'watch';  color = 'var(--amber)'; label = 'Watch'; }
  else                  { tier = 'critical'; color = 'var(--red)'; label = 'Critical'; }
  return { score, tier, color, label, issues };
}

function renderFMCSADashCard(carrier) {
  var card = document.getElementById('authority-health-card');
  if (!card) return;
  if (!carrier) { card.style.display = 'none'; return; }
  var { score, tier, color, label } = calcAuthorityScore(carrier);
  var authStatus = (carrier.allowedToOperate || '').toUpperCase() === 'Y' ? '✅ Active' : '❌ Inactive';
  var safetyRating = carrier.safetyRating || 'Not Rated';
  var safetyColor = safetyRating.toLowerCase() === 'satisfactory' ? 'var(--green)' : safetyRating.toLowerCase() === 'conditional' ? 'var(--amber)' : safetyRating.toLowerCase() === 'unsatisfactory' ? 'var(--red)' : '#b8c8b8';
  card.style.display = 'block';
  card.innerHTML =
    '<div class="card-header" onclick="showScreen(\'fmcsa\',null)" style="cursor:pointer;">' +
      '<div class="card-title">🛡️ Authority Health</div>' +
      '<span style="font-size:.75rem;color:#b8c8b8;">Tap for full profile →</span>' +
    '</div>' +
    '<div class="card-body" style="padding:.8rem 1rem;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.8rem;">' +
        '<div>' +
          '<div style="font-family:Georgia,serif;font-size:2.5rem;font-weight:bold;color:' + color + ';line-height:1;">' + score + '</div>' +
          '<div style="font-size:.72rem;color:#b8c8b8;text-transform:uppercase;letter-spacing:.1em;">Authority Score</div>' +
        '</div>' +
        '<div style="text-align:right;">' +
          '<div style="font-size:.95rem;font-weight:bold;color:' + color + ';">' + label + '</div>' +
          '<div style="font-size:.78rem;color:#b8c8b8;margin-top:.2rem;">' + (carrier.legalName || carrier.dbaName || '') + '</div>' +
          '<div style="font-size:.72rem;color:#b8c8b8;">MC-' + (carrier.dotNumber || '') + '</div>' +
        '</div>' +
      '</div>' +
      '<div style="background:var(--surface2);border-radius:100px;height:6px;margin-bottom:.8rem;overflow:hidden;">' +
        '<div style="height:100%;border-radius:100px;background:' + color + ';width:' + score + '%;transition:width .5s;"></div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.5rem;">' +
        '<div style="text-align:center;padding:.4rem;background:var(--surface2);border-radius:3px;"><div style="font-size:.65rem;color:#b8c8b8;text-transform:uppercase;letter-spacing:.06em;">Authority</div><div style="font-size:.78rem;font-weight:bold;margin-top:.1rem;">' + authStatus + '</div></div>' +
        '<div style="text-align:center;padding:.4rem;background:var(--surface2);border-radius:3px;"><div style="font-size:.65rem;color:#b8c8b8;text-transform:uppercase;letter-spacing:.06em;">Safety</div><div style="font-size:.78rem;font-weight:bold;margin-top:.1rem;color:' + safetyColor + ';">' + safetyRating + '</div></div>' +
        '<div style="text-align:center;padding:.4rem;background:var(--surface2);border-radius:3px;"><div style="font-size:.65rem;color:#b8c8b8;text-transform:uppercase;letter-spacing:.06em;">Power Units</div><div style="font-size:.78rem;font-weight:bold;margin-top:.1rem;">' + (carrier.totalPowerUnits || '—') + '</div></div>' +
      '</div>' +
    '</div>';
}

function renderFMCSACard(carrier, state) {
  var screen = document.getElementById('screen-fmcsa');
  if (!screen) return;
  if (state === 'loading') { screen.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--green);">🔄 Loading your FMCSA profile...</div>'; return; }
  if (state === 'no-mc') {
    screen.innerHTML = '<div class="section-head"><div class="section-label">— Authority Health</div><div class="section-title">FMCSA Profile</div></div>' +
      '<div class="alert alert-amber"><div class="alert-icon">⚠️</div><div>Enter your MC number in Settings to load your FMCSA profile.</div></div>' +
      '<button class="btn btn-green" onclick="showScreen(\'settings\',null)">Go to Settings →</button>';
    return;
  }
  if (state === 'error' || !carrier) {
    screen.innerHTML = '<div class="section-head"><div class="section-label">— Authority Health</div><div class="section-title">FMCSA Profile</div></div>' +
      '<div class="alert alert-amber"><div class="alert-icon">⚠️</div><div>Could not load FMCSA data. Check your MC number in Settings or try again.</div></div>' +
      '<button class="btn btn-outline" onclick="loadFMCSAProfile()" style="margin-top:.5rem;">🔄 Retry</button>';
    return;
  }
  var { score, tier, color, label, issues } = calcAuthorityScore(carrier);
  var authStatus   = (carrier.allowedToOperate || '').toUpperCase() === 'Y';
  var bipdAmt      = parseFloat(carrier.bipdInsuranceOnFile || 0);
  var hasInsurance = bipdAmt > 0;
  var bipdDisplay  = bipdAmt > 0 ? '✅ $' + bipdAmt.toLocaleString() + ',000' : '❌ Not on File';
  var cargoOnFile  = parseFloat(carrier.cargoInsuranceOnFile || 0) > 0;
  var bondOnFile   = parseFloat(carrier.bondInsuranceOnFile || 0) > 0;
  var safetyRating = carrier.safetyRating || 'Not Rated';
  var safetyColor  = safetyRating.toLowerCase() === 'satisfactory' ? 'var(--green)' : safetyRating.toLowerCase() === 'conditional' ? 'var(--amber)' : safetyRating.toLowerCase() === 'unsatisfactory' ? 'var(--red)' : '#b8c8b8';
  var driverOos    = carrier.driverOosRate ? parseFloat(carrier.driverOosRate).toFixed(1) + '%' : 'N/A';
  var vehicleOos   = carrier.vehicleOosRate ? parseFloat(carrier.vehicleOosRate).toFixed(1) + '%' : 'N/A';
  var driverOosAvg = carrier.driverOosRateNationalAverage || '5.51';
  var vehicleOosAvg= carrier.vehicleOosRateNationalAverage || '20.72';
  screen.innerHTML =
    '<div class="section-head"><div class="section-label">— Authority Health</div><div class="section-title">FMCSA Carrier Profile</div></div>' +
    '<div class="card" style="border-color:' + color + ';margin-bottom:.8rem;">' +
      '<div class="card-body">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:1rem;">' +
          '<div>' +
            '<div style="font-family:Georgia,serif;font-size:3.5rem;font-weight:bold;color:' + color + ';line-height:1;">' + score + '</div>' +
            '<div style="font-size:.72rem;color:#b8c8b8;text-transform:uppercase;letter-spacing:.12em;margin-top:.2rem;">Authority Score / 100</div>' +
            '<div style="display:inline-block;margin-top:.5rem;padding:.25rem .8rem;background:rgba(0,0,0,.3);border:1px solid ' + color + ';border-radius:100px;font-size:.8rem;font-weight:bold;color:' + color + ';">' + label + '</div>' +
          '</div>' +
          '<div style="text-align:right;">' +
            '<div style="font-size:.95rem;font-weight:bold;color:var(--text);">' + (carrier.legalName || carrier.dbaName || 'Your Company') + '</div>' +
            (carrier.dbaName && carrier.legalName ? '<div style="font-size:.78rem;color:#b8c8b8;">DBA: ' + carrier.dbaName + '</div>' : '') +
            '<div style="font-size:.78rem;color:var(--green);margin-top:.2rem;">MC-' + (carrier.dotNumber || '') + '</div>' +
            '<div style="font-size:.72rem;color:#b8c8b8;">' + (carrier.phyCity || '') + (carrier.phyCity && carrier.phyState ? ', ' : '') + (carrier.phyState || '') + '</div>' +
          '</div>' +
        '</div>' +
        '<div style="background:var(--surface2);border-radius:100px;height:8px;margin-bottom:1rem;overflow:hidden;">' +
          '<div style="height:100%;border-radius:100px;background:' + color + ';width:' + score + '%;transition:width .6s;"></div>' +
        '</div>' +
        (issues.length > 0 ? '<div style="background:rgba(255,126,126,.1);border:1px solid rgba(255,126,126,.3);border-radius:4px;padding:.7rem .9rem;margin-bottom:.5rem;">' +
          '<div style="font-size:.72rem;color:var(--red);text-transform:uppercase;letter-spacing:.1em;margin-bottom:.4rem;">⚠️ Issues Affecting Your Score</div>' +
          issues.map(function(i) { return '<div style="font-size:.82rem;color:#b8c8b8;padding:.2rem 0;">• ' + i + '</div>'; }).join('') +
        '</div>' : '') +
      '</div>' +
    '</div>' +
    '<div class="card" style="margin-bottom:.8rem;">' +
      '<div class="card-header"><div class="card-title">👁️ What Brokers See</div></div>' +
      '<div class="card-body">' +
        '<div style="font-size:.78rem;color:#b8c8b8;margin-bottom:.8rem;font-style:italic;">This is your public FMCSA record. Every broker pulls this before booking a load with you.</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem;">' +
          fmcsaStatBox('Authority', authStatus ? '✅ Active' : '❌ Inactive', authStatus ? 'var(--green)' : 'var(--red)') +
          fmcsaStatBox('Safety Rating', safetyRating, safetyColor) +
          fmcsaStatBox('BIPD Insurance', bipdDisplay, hasInsurance ? 'var(--green)' : 'var(--red)') +
          fmcsaStatBox('Common Authority', carrier.commonAuthorityStatus === 'A' ? '✅ Active' : '—', carrier.commonAuthorityStatus === 'A' ? 'var(--green)' : '#b8c8b8') +
          fmcsaStatBox('Power Units', carrier.totalPowerUnits || '—', 'var(--text)') +
          fmcsaStatBox('Drivers', carrier.totalDrivers || '—', 'var(--text)') +
          fmcsaStatBox('Driver OOS Rate', driverOos + ' (avg ' + driverOosAvg + '%)', parseFloat(carrier.driverOosRate||0) > 10 ? 'var(--amber)' : 'var(--green)') +
          fmcsaStatBox('Vehicle OOS Rate', vehicleOos + ' (avg ' + vehicleOosAvg + '%)', parseFloat(carrier.vehicleOosRate||0) > 25 ? 'var(--amber)' : 'var(--green)') +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="card" style="margin-bottom:.8rem;">' +
      '<div class="card-header"><div class="card-title">📋 Authority Details</div></div>' +
      '<div class="card-body">' +
        fmcsaDetailRow('Legal Name', carrier.legalName || '—') +
        fmcsaDetailRow('DBA Name', carrier.dbaName || '—') +
        fmcsaDetailRow('DOT Number', carrier.dotNumber || '—') +
        fmcsaDetailRow('Entity Type', carrier.censusTypeId ? carrier.censusTypeId.censusTypeDesc : '—') +
        fmcsaDetailRow('City / State', (carrier.phyCity || '') + (carrier.phyState ? ', ' + carrier.phyState : '')) +
        fmcsaDetailRow('BIPD Insurance', bipdDisplay) +
        fmcsaDetailRow('Cargo Insurance', cargoOnFile ? '✅ On File' : 'Not Required') +
        fmcsaDetailRow('Bond/Trust', bondOnFile ? '✅ On File' : 'Not Required') +
        fmcsaDetailRow('Common Authority', carrier.commonAuthorityStatus === 'A' ? '✅ Active' : carrier.commonAuthorityStatus || '—') +
        fmcsaDetailRow('Broker Authority', carrier.brokerAuthorityStatus === 'A' ? '✅ Active' : 'Not Active') +
        fmcsaDetailRow('Carrier Operation', carrier.carrierOperation ? carrier.carrierOperation.carrierOperationDesc : '—') +
        fmcsaDetailRow('Total Crashes', carrier.crashTotal !== undefined ? carrier.crashTotal : '—') +
        fmcsaDetailRow('Fatal Crashes', carrier.fatalCrash !== undefined ? carrier.fatalCrash : '—') +
      '</div>' +
    '</div>' +
    '<div class="card" style="margin-bottom:.8rem;">' +
      '<div class="card-header"><div class="card-title">🔍 Out of Service Detail</div></div>' +
      '<div class="card-body">' +
        '<div style="font-size:.78rem;color:#b8c8b8;margin-bottom:.8rem;">High OOS rates flag your carrier profile to brokers and FMCSA auditors.</div>' +
        fmcsaDetailRow('Driver Inspections', carrier.driverInsp || '0') +
        fmcsaDetailRow('Driver OOS', carrier.driverOosInsp || '0') +
        fmcsaDetailRow('Driver OOS Rate', driverOos) +
        fmcsaDetailRow('Driver OOS Avg', driverOosAvg + '%') +
        fmcsaDetailRow('Vehicle Inspections', carrier.vehicleInsp || '0') +
        fmcsaDetailRow('Vehicle OOS', carrier.vehicleOosInsp || '0') +
        fmcsaDetailRow('Vehicle OOS Rate', vehicleOos) +
        fmcsaDetailRow('Vehicle OOS Avg', vehicleOosAvg + '%') +
      '</div>' +
    '</div>' +
    '<div class="alert ' + (authStatus && hasInsurance ? 'alert-green' : 'alert-amber') + '" style="margin-bottom:1rem;">' +
      '<div class="alert-icon">💡</div>' +
      '<div style="font-size:.82rem;line-height:1.7;"><strong>Why this matters:</strong> Brokers check your FMCSA record before every load. ' +
        (authStatus && hasInsurance && safetyRating.toLowerCase() !== 'unsatisfactory'
          ? 'Your authority is active and insurance is confirmed. Brokers will book you with confidence.'
          : 'Some items need attention. Fix these to avoid being passed over for loads.') +
      '</div>' +
    '</div>' +
    '<button class="btn btn-outline" onclick="loadFMCSAProfile()" style="margin-bottom:1rem;">🔄 Refresh Profile</button>';
}

function fmcsaStatBox(label, value, color) {
  return '<div style="background:var(--surface2);border-radius:4px;padding:.7rem .8rem;">' +
    '<div style="font-size:.65rem;color:#b8c8b8;text-transform:uppercase;letter-spacing:.06em;margin-bottom:.2rem;">' + label + '</div>' +
    '<div style="font-size:.88rem;font-weight:bold;color:' + color + ';">' + value + '</div>' +
  '</div>';
}

function fmcsaDetailRow(label, value) {
  return '<div style="display:flex;justify-content:space-between;padding:.5rem 0;border-bottom:1px solid var(--border);font-size:.82rem;">' +
    '<span style="color:#b8c8b8;">' + label + '</span>' +
    '<span style="color:var(--text);font-weight:bold;text-align:right;max-width:60%;">' + value + '</span>' +
  '</div>';
}

async function saveMCNumber() {
  var input = document.getElementById('set-mc-number');
  if (!input || !input.value.trim()) { alert('Enter your MC number first.'); return; }
  var mc = input.value.trim().replace(/^MC-?/i, '');
  window._rcMCNumber = mc;
  try {
    if (window._rcUserId) { await _supabase.from('profiles').update({ mc_number: mc }).eq('user_id', window._rcUserId); }
    localStorage.setItem('rc-mc-number', mc);
  } catch(e) {}
  await loadFMCSAProfile();
  alert('MC number saved. Loading your FMCSA profile...');
}

function loadSavedMCNumber() {
  try {
    var mc = localStorage.getItem('rc-mc-number');
    if (mc) {
      window._rcMCNumber = mc;
      var input = document.getElementById('set-mc-number');
      if (input) input.value = 'MC-' + mc;
      setTimeout(function() { loadFMCSAProfile(); }, 2000);
    }
  } catch(e) {}
}

// ══════════════════════════════════════════════════════════════
// LIVE DASHBOARD STATS
// ══════════════════════════════════════════════════════════════
function updateDashboardStats() {
  if (!invoices || !invoices.length) return;
  var now = new Date();
  var weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  var monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  var weekRevenue = invoices.filter(function(i) { return i.status === 'paid' && new Date(i.date) >= weekAgo; }).reduce(function(sum, i) { return sum + i.amount; }, 0);
  var outstanding = invoices.filter(function(i) { return i.status !== 'paid'; }).reduce(function(sum, i) { return sum + i.amount; }, 0);
  var monthRevenue = invoices.filter(function(i) { return i.status === 'paid' && new Date(i.date) >= monthStart; }).reduce(function(sum, i) { return sum + i.amount; }, 0);
  var metricCards = document.querySelectorAll('#screen-dash .metric');
  metricCards.forEach(function(card) {
    var label = card.querySelector('.metric-label');
    var val   = card.querySelector('.metric-val');
    if (!label || !val) return;
    var labelText = label.textContent.toLowerCase();
    if (labelText.includes('week revenue')) { val.textContent = '$' + weekRevenue.toLocaleString(); val.className = 'metric-val' + (weekRevenue > 0 ? '' : ' red'); }
    if (labelText.includes('outstanding'))  { val.textContent = '$' + outstanding.toLocaleString(); val.className = 'metric-val' + (outstanding > 0 ? ' amber' : ''); }
    if (labelText.includes('month revenue') || labelText.includes('this month')) { val.textContent = '$' + monthRevenue.toLocaleString(); }
  });
}

// ══════════════════════════════════════════════════════════════
// COMMAND SCORE
// ══════════════════════════════════════════════════════════════
function calcCommandScore() {
  var score = 50, factors = [];
  var totalInvoiced = invoices.reduce(function(s, i) { return s + i.amount; }, 0);
  var totalPaid     = invoices.filter(function(i) { return i.status === 'paid'; }).reduce(function(s, i) { return s + i.amount; }, 0);
  var payRate = totalInvoiced > 0 ? (totalPaid / totalInvoiced) : 0;
  if (payRate >= 0.9)      { score += 15; factors.push({ t: 'good', m: 'Strong payment collection rate' }); }
  else if (payRate >= 0.7) { score += 5;  factors.push({ t: 'warn', m: 'Some outstanding invoices — follow up' }); }
  else if (payRate < 0.5)  { score -= 10; factors.push({ t: 'bad',  m: 'Low collection rate — chase overdue invoices' }); }
  var today   = new Date();
  var overdue = invoices.filter(function(i) { return i.status !== 'paid' && new Date(i.dueDate) < today; });
  if (overdue.length === 0)      { score += 10; factors.push({ t: 'good', m: 'No overdue invoices' }); }
  else if (overdue.length <= 2)  { score -= 5;  factors.push({ t: 'warn', m: overdue.length + ' overdue invoice(s) — collect now' }); }
  else                           { score -= 15; factors.push({ t: 'bad',  m: overdue.length + ' overdue invoices — critical' }); }
  if (_fmcsaData) {
    var { score: authScore } = calcAuthorityScore(_fmcsaData);
    if (authScore >= 85)      { score += 15; factors.push({ t: 'good', m: 'Strong FMCSA authority profile' }); }
    else if (authScore >= 65) { score += 5;  factors.push({ t: 'warn', m: 'FMCSA profile needs attention' }); }
    else                      { score -= 15; factors.push({ t: 'bad',  m: 'FMCSA issues — fix before they cost you loads' }); }
  }
  var brokerCounts = {};
  invoices.forEach(function(i) { if (i.broker) brokerCounts[i.broker] = (brokerCounts[i.broker] || 0) + 1; });
  var brokerCount = Object.keys(brokerCounts).length;
  if (brokerCount >= 5)      { score += 10; factors.push({ t: 'good', m: 'Good broker diversity (' + brokerCount + ' brokers)' }); }
  else if (brokerCount >= 3) { score += 5;  factors.push({ t: 'warn', m: 'Limited broker diversity — add more brokers' }); }
  else if (brokerCount > 0)  { score -= 5;  factors.push({ t: 'bad',  m: 'Over-reliant on too few brokers' }); }
  score = Math.max(0, Math.min(100, score));
  var tier, color, label;
  if (score >= 85)      { tier = 'strong';   color = 'var(--green)'; label = 'Strong'; }
  else if (score >= 65) { tier = 'stable';   color = '#7ab8ff'; label = 'Stable'; }
  else if (score >= 40) { tier = 'watch';    color = 'var(--amber)'; label = 'Watch'; }
  else                  { tier = 'critical'; color = 'var(--red)'; label = 'Critical'; }
  return { score, tier, color, label, factors };
}

function renderCommandScore() {
  var card = document.getElementById('command-score-card');
  if (!card) return;
  var { score, color, label, factors } = calcCommandScore();
  card.innerHTML =
    '<div class="card-header" style="cursor:pointer;" onclick="toggleCommandDetail()">' +
      '<div class="card-title">📈 Carrier Command Score</div>' +
      '<span style="font-size:.75rem;color:#b8c8b8;">Tap for details ▼</span>' +
    '</div>' +
    '<div class="card-body" style="padding:.8rem 1rem;">' +
      '<div style="display:flex;align-items:center;gap:1rem;margin-bottom:.8rem;">' +
        '<div style="font-family:Georgia,serif;font-size:3rem;font-weight:bold;color:' + color + ';line-height:1;">' + score + '</div>' +
        '<div><div style="font-size:1rem;font-weight:bold;color:' + color + ';">' + label + '</div><div style="font-size:.72rem;color:#b8c8b8;">out of 100 · updated live</div></div>' +
      '</div>' +
      '<div style="background:var(--surface2);border-radius:100px;height:6px;overflow:hidden;margin-bottom:.8rem;">' +
        '<div style="height:100%;border-radius:100px;background:' + color + ';width:' + score + '%;transition:width .5s;"></div>' +
      '</div>' +
      '<div id="command-detail" style="display:none;">' +
        factors.map(function(f) {
          var ic = f.t === 'good' ? '✅' : f.t === 'warn' ? '⚠️' : '❌';
          var fc = f.t === 'good' ? 'var(--green)' : f.t === 'warn' ? 'var(--amber)' : 'var(--red)';
          return '<div style="display:flex;gap:.5rem;padding:.4rem 0;border-bottom:1px solid var(--border);font-size:.8rem;">' +
            '<span>' + ic + '</span><span style="color:' + fc + ';">' + f.m + '</span></div>';
        }).join('') +
      '</div>' +
    '</div>';
}

function toggleCommandDetail() {
  var d = document.getElementById('command-detail');
  if (d) d.style.display = d.style.display === 'none' ? 'block' : 'none';
}

// Hook into onAuthReady and loadInvoices
var _origOnAuthReady = onAuthReady;
onAuthReady = function(firstName, userId, email) {
  _origOnAuthReady(firstName, userId, email);
  setTimeout(loadSavedMCNumber, 1500);
  setTimeout(function() { updateDashboardStats(); renderCommandScore(); }, 3000);
};

var _origLoadInvoices = loadInvoices;
loadInvoices = async function() {
  await _origLoadInvoices();
  setTimeout(function() { updateDashboardStats(); renderCommandScore(); }, 500);
};

// ══════════════════════════════════════════════════════════════════════════
// TRUCKSTOP LIVE LOAD INTEGRATION
// ══════════════════════════════════════════════════════════════════════════

var _tsWorkerUrl = 'https://truckstop-search.wild-sunset-1d5f.workers.dev';
var _liveLoadsCache = [];
var _liveLoadsFetching = false;
var _liveLoadsLastFetch = 0;

// ── Fetch live loads from Truckstop via Worker ────────────────────────────
async function fetchTruckstopLoads(forceRefresh) {
  if (_liveLoadsFetching) return;
  var now = Date.now();
  // Cache for 3 minutes unless forced
  if (!forceRefresh && _liveLoadsLastFetch && (now - _liveLoadsLastFetch) < 180000) {
    return _liveLoadsCache;
  }

  var state     = currentState || 'WA';
  var city      = currentCity  || '';
  var maxDead   = defaults.maxDeadhead || 150;
  var minRpm    = defaults.minRpm || 2.00;
  var equipType = window._rcEquipmentType || 'V';
  var loadType  = window._rcLoadType || 'All';

  _liveLoadsFetching = true;
  showLoadingState();

  try {
    var equipTypes = equipType.split(',').map(function(e) { return e.trim(); });
    var allLoads = [];

    for (var i = 0; i < equipTypes.length; i++) {
      var url = _tsWorkerUrl + '/search' +
        '?originState='  + encodeURIComponent(state) +
        '&originCity='   + encodeURIComponent(city) +
        '&equipmentType=' + encodeURIComponent(equipTypes[i]) +
        '&hoursOld=24' +
        '&pageSize=25' +
        '&originRange='  + maxDead +
        '&loadType='     + encodeURIComponent(loadType);

      var res  = await fetch(url);
      var data = await res.json();
      if (data.success && data.loads) {
        allLoads = allLoads.concat(data.loads);
      }
    }

    // Also do client-side deadhead filter using GPS if available
    if (window._gpsLat && window._gpsLon && allLoads.length > 0) {
      allLoads = allLoads.filter(function(load) {
        if (!load.originCity || !load.originState) return true;
        var dh = getDeadheadMiles(load.originCity + ', ' + load.originState);
        load.deadheadMiles = dh;
        return dh <= maxDead || dh === 0;
      });
    }

    if (allLoads.length > 0) {
      _liveLoadsCache = allLoads;
      _liveLoadsLastFetch = now;
      // Wait for DOM containers to exist before rendering
      var waitForDOM = setInterval(function() {
        if (document.getElementById('dash-live-loads') || document.getElementById('loads-screen-live')) {
          clearInterval(waitForDOM);
          renderLiveLoadCards(allLoads, minRpm);
          track('live_loads_fetched', { count: allLoads.length, state: state });
        }
      }, 200);
      // Give up after 10 seconds
      setTimeout(function() { clearInterval(waitForDOM); }, 10000);
    } else {
      showNoLoadsState(state);
    }
  } catch(err) {
    console.error('Truckstop fetch error:', err);
    showNoLoadsState(state);
  }

  _liveLoadsFetching = false;
}

// ── Render live load cards into both dash and loads screens ───────────────
function renderLiveLoadCards(loads, minRpm) {
  minRpm = minRpm || defaults.minRpm || 2.00;
  var minGross  = defaults.minGross    || 0;
  var minMiles  = defaults.minMiles    || 0;
  var maxMiles  = defaults.maxMiles    || 9999;
  var maxWeight = defaults.maxWeight   || 48000;

  console.log('renderLiveLoadCards: ' + loads.length + ' loads, minGross=' + minGross + ' minMiles=' + minMiles + ' maxMiles=' + maxMiles + ' minRpm=' + minRpm + ' maxWeight=' + maxWeight);

  var hotLoads = loads.filter(function(l) {
    if (l.rate <= 0 || l.miles <= 0) return false;
    if (minGross > 0 && l.rate < minGross) return false;
    if (minMiles > 0 && l.miles < minMiles) return false;
    if (maxMiles < 9999 && l.miles > maxMiles) return false;
    if (l.rpm < minRpm) return false;
    if (maxWeight > 0 && l.weight > 0 && l.weight > maxWeight) return false;
    return true;
  });
  var watchLoads = loads.filter(function(l) {
    return hotLoads.indexOf(l) < 0;
  });

  console.log('Hot: ' + hotLoads.length + ' Watch: ' + watchLoads.length);

  // Hot first, then watching
  loads = hotLoads.concat(watchLoads);
  var hotCount = hotLoads.length;
  clearLoadCards();

  var cards = loads.map(function(load) {
    var isHot     = hotLoads.indexOf(load) >= 0;
    var cardClass = isHot ? 'hot' : 'watch';
    var tagClass  = isHot ? 'tag-hot' : 'tag-watch';
    var tagLabel  = isHot ? '🔥 Matches Parameters' : '👁 Below Parameters';

    var panelId = 'live_' + load.id;
    var rpmDisplay  = load.rpm ? '$' + load.rpm.toFixed(2) + '/mi' : '—';
    var rateDisplay = load.rate ? '$' + load.rate.toLocaleString() : 'Call';

    // Calculate fuel with actual deadhead from GPS
    var loadedFuelEst = load.miles > 0 ? Math.round((load.miles / (defaults.mpg || 6.5)) * (defaults.fuelPrice || 4.25)) : 0;
    var deadMilesEst  = load.deadheadMiles !== undefined ? load.deadheadMiles : (load.originCity ? getDeadheadMiles(load.originCity + ', ' + load.originState) : 0);
    var deadFuelEst   = deadMilesEst > 0 ? Math.round((deadMilesEst / (defaults.emptyMpg || 8.0)) * (defaults.fuelPrice || 4.25)) : 0;
    var totalFuelEst  = loadedFuelEst + deadFuelEst;
    var fuelDisplay   = totalFuelEst > 0 ? '-$' + totalFuelEst.toLocaleString() : (load.fuelCost || '—');
    var fuelSubDisplay = deadFuelEst > 0 ? '$' + loadedFuelEst + ' loaded + $' + deadFuelEst + ' DH (' + Math.round(deadMilesEst) + ' mi)' : '';
    var netEst        = load.rate && totalFuelEst ? '$' + Math.max(0, load.rate - totalFuelEst).toLocaleString() : '—';

    return '<div class="load-card ' + cardClass + '" data-rate="' + (load.rate || 0) + '" data-miles="' + (load.miles || 0) + '">' +
      '<div class="load-top load-card-clickable" onclick="toggleExpand(\'' + panelId + '\')">' +
        '<div>' +
          '<div class="load-route"><span class="expand-arrow" id="arrow_' + panelId + '">▼</span>' +
            load.originCity + ', ' + load.originState + ' <span>→</span> ' + load.destCity + ', ' + load.destState +
          '</div>' +
          '<div style="margin-top:.3rem;"><span class="load-tag ' + tagClass + '">' + tagLabel + '</span></div>' +
        '</div>' +
        '<div><div class="load-rate">' + rateDisplay + '</div><div class="load-rate-sub">' + rpmDisplay + '</div></div>' +
      '</div>' +
      '<div class="broker-info" onclick="toggleExpand(\'' + panelId + '\')" style="cursor:pointer;">' +
        '<span class="broker-name">' + (load.broker || 'Broker') + ':</span>' +
        '<span class="broker-phone">📞 ' + (load.contactPhone || load.brokerPhone || '—') + '</span>' +
      '</div>' +
      '<div class="load-meta" onclick="toggleExpand(\'' + panelId + '\')" style="cursor:pointer;">' +
        '<div><div class="lm-label">Miles</div><div class="lm-val">' + (load.miles || '—') + '</div></div>' +
        '<div><div class="lm-label">Weight</div><div class="lm-val">' + (load.weight ? load.weight.toLocaleString() + ' lb' : '—') + '</div></div>' +
        '<div><div class="lm-label">Pickup</div><div class="lm-val">' + (load.pickupDate || '—') + '</div></div>' +
      '</div>' +
      '<div class="load-expand-panel" id="' + panelId + '" ' +
        'data-pickup="' + load.originCity + ', ' + load.originState + '" ' +
        'data-rate="' + (load.rate || 0) + '" ' +
        'data-miles="' + (load.miles || 0) + '" ' +
        'data-broker="' + (load.broker || '') + '" ' +
        'data-dest="' + load.destCity + ', ' + load.destState + '">' +
        '<div id="broker-badge_' + panelId + '" style="margin-bottom:.4rem;display:flex;gap:.4rem;flex-wrap:wrap;"></div>' +
        '<div id="hos_' + panelId + '"></div>' +
        '<div class="expand-profit-grid">' +
          '<div class="expand-stat"><div class="expand-label">Gross Rate</div><div class="expand-val">' + rateDisplay + '</div></div>' +
          '<div class="expand-stat"><div class="expand-label">Est. Fuel</div><div class="expand-val red" id="fuel_' + panelId + '">' + fuelDisplay + (fuelSubDisplay ? '<div style="font-size:.65rem;color:#b8c8b8;margin-top:.1rem;">' + fuelSubDisplay + '</div>' : '') + '</div></div>' +
          '<div class="expand-stat"><div class="expand-label">Net Profit</div><div class="expand-val green" id="net_' + panelId + '">' + netEst + '</div></div>' +
          '<div class="expand-stat"><div class="expand-label">Net/Mile</div><div class="expand-val" id="npm_' + panelId + '">—</div></div>' +
          '<div class="expand-stat"><div class="expand-label">Rate/Mile</div><div class="expand-val">' + rpmDisplay + '</div></div>' +
          '<div class="expand-stat"><div class="expand-label">Miles</div><div class="expand-val">' + (load.miles || '—') + '</div></div>' +
        '</div>' +
        '<div class="expand-verdict" id="verdict_' + panelId + '">—</div>' +
        '<div class="deadhead-alert" id="dh_' + panelId + '"></div>' +
        '<div class="expand-notes"><div class="expand-label" style="margin-bottom:.3rem;">📋 Load Notes</div>' +
          '<div class="expand-notes-text" id="notes_' + panelId + '">' + (load.notes || load.specInfo || 'No special notes on this load.') + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="load-actions">' +
        '<button class="load-action-btn call-btn" onclick="callBroker(\'' + (load.contactPhone || load.brokerPhone || '') + '\',\'' + (load.broker || 'Broker') + '\')"><span class="btn-icon">📞</span>Call</button>' +
        '<button class="load-action-btn book-btn" onclick="bookLoad(this,\'' + load.originCity + ', ' + load.originState + '\',\'' + load.destCity + ', ' + load.destState + '\',' + (load.rate || 0) + ',' + (load.miles || 0) + ',\'' + (load.broker || '') + '\',\'' + (load.contactPhone || '') + '\')"><span class="btn-icon">✓</span>Book</button>' +
        '<button class="load-action-btn skip-btn" onclick="skipLoad(this)"><span class="btn-icon">✕</span>Skip</button>' +
      '</div>' +
    '</div>';
  }).join('');

  // Update hot loads count badge
  var hotBadge = document.querySelector('#screen-dash .card-header .load-tag');
  if (hotBadge) hotBadge.textContent = hotCount + ' New';

  // Inject into dash screen
  var dashCardBody = document.getElementById('dash-live-loads');
  if (dashCardBody) {
    dashCardBody.innerHTML = hotCount > 0
      ? cards
      : '<div class="alert alert-amber" style="margin:.5rem 0;"><div class="alert-icon">📋</div><div>No loads matching your parameters right now. Checking every 5 minutes.</div></div>';
  }

  // Inject into loads screen
  var loadsLive = document.getElementById('loads-screen-live');
  if (loadsLive) {
    loadsLive.innerHTML = cards;
  }

  // Re-inject profit bars
  injectProfitBars();
}

function clearLoadCards() {
  var dashCardBody = document.getElementById('dash-live-loads');
  if (dashCardBody) dashCardBody.innerHTML = '';
  var loadsLive = document.getElementById('loads-screen-live');
  if (loadsLive) loadsLive.innerHTML = '';
}

function showLoadingState() {
  var dashCardBody = document.getElementById('dash-live-loads');
  if (dashCardBody) {
    dashCardBody.innerHTML = '<div style="padding:1rem;text-align:center;color:var(--green);font-size:.85rem;">🔄 Searching for loads near you...</div>';
  }
}

function showNoLoadsState(state) {
  var dashCardBody = document.getElementById('dash-live-loads');
  if (dashCardBody) {
    dashCardBody.innerHTML = '<div class="alert alert-amber" style="margin:.5rem 0;"><div class="alert-icon">📋</div><div>No loads found near ' + (state || 'your location') + ' right now. Checking every 5 minutes — you will get a push notification when something good posts.</div></div>';
  }
  var loadsLive = document.getElementById('loads-screen-live');
  if (loadsLive) loadsLive.innerHTML = '<div class="alert alert-amber"><div class="alert-icon">📋</div><div>No loads found near ' + (state || 'your location') + ' right now.</div></div>';
}

// ── Hook into GPS — fetch loads when location is confirmed ────────────────
var _origUpdateWeatherForState = updateWeatherForState;
updateWeatherForState = function(stateCode) {
  _origUpdateWeatherForState(stateCode);
  setTimeout(function() { fetchTruckstopLoads(false); }, 500);
};

// Also fetch immediately on auth ready — triggered after preferences load
var _origOnAuthReadyLoads = onAuthReady;

// Manual refresh button
function refreshLoads() {
  fetchTruckstopLoads(true);
  track('loads_manually_refreshed', {});
}

// ══════════════════════════════════════════════════════════════════════════
// PUSH NOTIFICATION SUBSCRIPTION
// ══════════════════════════════════════════════════════════════════════════

var VAPID_PUBLIC_KEY = 'BLc4PlGPbsl7DUqVdEk6_w9bmQcYLNTZpGuIXLnb866hUKF4IbTodgLZ9KLlnyNXD4iPt8gOJx8PXqNrcutgLhg';

async function registerPushSubscription() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('Push not supported on this browser');
    return;
  }
  if (!window._rcUserId) return;

  try {
    // Register service worker if not already registered
    var reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    // Check existing subscription
    var existing = await reg.pushManager.getSubscription();
    if (existing) {
      await savePushSubscription(existing);
      return;
    }

    // Request permission
    var permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Push permission denied');
      return;
    }

    // Subscribe
    var subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    await savePushSubscription(subscription);
    await saveLoadAlertPrefs();

    console.log('Push subscription registered');
    track('push_subscription_registered', {});

  } catch(err) {
    console.error('Push registration error:', err);
  }
}

async function savePushSubscription(subscription) {
  if (!window._rcUserId || !window._supabaseReady) return;
  var sub = subscription.toJSON();
  try {
    await _supabase.from('push_subscriptions').upsert({
      user_id:  window._rcUserId,
      endpoint: sub.endpoint,
      p256dh:   sub.keys.p256dh,
      auth:     sub.keys.auth,
    }, { onConflict: 'user_id,endpoint' });
  } catch(err) {
    console.error('Error saving push subscription:', err);
  }
}

async function saveLoadAlertPrefs() {
  if (!window._rcUserId || !window._supabaseReady) return;
  try {
    await _supabase.from('load_alerts').upsert({
      user_id:        window._rcUserId,
      origin_state:   currentState || 'WA',
      min_rpm:        defaults.minRpm || 2.00,
      max_deadhead:   defaults.maxDeadhead || 150,
      equipment_type: window._rcEquipmentType || 'V',
      active:         true,
    }, { onConflict: 'user_id' });
  } catch(err) {
    console.error('Error saving load alert prefs:', err);
  }
}

function urlBase64ToUint8Array(base64String) {
  var padding = '='.repeat((4 - base64String.length % 4) % 4);
  var base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  var rawData = window.atob(base64);
  var outputArray = new Uint8Array(rawData.length);
  for (var i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Handle notification click — show the load when driver taps notification
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'LOAD_ALERT_CLICKED') {
      var loadsBtn = document.querySelector('.nav-btn[data-screen="loads"]');
      showScreen('loads', loadsBtn);
    }
  });
}

// ══════════════════════════════════════════════════════════════════════════
// LIVE LOADBACK — Real return loads based on arrival ETA
// ══════════════════════════════════════════════════════════════════════════

var _origShowLoadback = showLoadback;
showLoadback = async function(origin, dest, rate, miles, broker, phone) {
  // Call original for immediate display with cached data
  _origShowLoadback(origin, dest, rate, miles, broker, phone);

  // Then try to fetch real return loads from Truckstop
  var destParts = dest.split(',');
  var destState = destParts.length > 1 ? destParts[1].trim() : '';
  var destCity  = destParts[0].trim();

  if (!destState || !window._rcUserId) return;

  // Calculate ETA
  var now      = new Date();
  var hosAvail = window._hosAvailable || 11;
  var arrival  = calcArrival(miles, now, hosAvail);

  try {
    var equipType = window._rcEquipmentType || 'V';
    var url = _tsWorkerUrl + '/search' +
      '?originState=' + encodeURIComponent(destState) +
      '&originCity='  + encodeURIComponent(destCity) +
      '&equipmentType=' + encodeURIComponent(equipType) +
      '&hoursOld=0' +
      '&pageSize=25';

    var res  = await fetch(url);
    var data = await res.json();

    if (!data.success || !data.loads || !data.loads.length) return;

    var fuelPrice  = defaults.fuelPrice  || 4.25;
    var mpg        = defaults.mpg        || 6.5;
    var emptyMpg   = defaults.emptyMpg   || 8.0;
    var outNet     = rate - Math.round((miles / mpg) * fuelPrice);
    var minRpm     = defaults.minRpm     || 2.00;
    var minGross   = defaults.minGross   || 0;
    var maxDeadLB  = defaults.maxDeadhead || 150;

    // Score and filter return loads — apply deadhead filter from destination city
    var scoredLoads = data.loads
      .filter(function(l) { return l.rate > 0 && l.miles > 0; })
      .map(function(l) {
        // Calculate deadhead from destination city to this pickup
        var dhFromDest = getDeadheadMilesFromCity(destCity, destState, l.originCity, l.originState);
        var dhFuel     = dhFromDest > 0 ? Math.round((dhFromDest / emptyMpg) * fuelPrice) : 0;
        var returnFuel = Math.round((l.miles / mpg) * fuelPrice);
        var returnNet  = l.rate - returnFuel - dhFuel;
        var roundTripNet = outNet + returnNet;
        return Object.assign({}, l, {
          returnNet:    returnNet,
          roundTripNet: roundTripNet,
          dhFromDest:   dhFromDest,
          availStr:     formatArrival(arrival),
        });
      })
      .filter(function(l) {
        if (l.rpm < minRpm) return false;
        if (minGross > 0 && l.rate < minGross) return false;
        if (maxDeadLB > 0 && l.dhFromDest > maxDeadLB) return false;
        return true;
      })
      .sort(function(a, b) { return b.roundTripNet - a.roundTripNet; })
      .slice(0, 5);

    if (!scoredLoads.length) return;

    // Replace the loadback content with live data
    var lbContent = document.getElementById('loadback-content');
    if (!lbContent) return;

    var loadsHtml = scoredLoads.map(function(l, i) {
      var isBest = i === 0;
      return '<div class="loadback-card ' + (isBest ? 'best' : '') + '">' +
        '<div class="loadback-card-top">' +
          '<div class="loadback-route">' + l.route + (isBest ? '<span class="loadback-best-badge">BEST</span>' : '') + '</div>' +
          '<div class="loadback-rate">$' + l.rate.toLocaleString() + '</div>' +
        '</div>' +
        '<div class="loadback-stats">' +
          '<span class="loadback-stat">Miles: <strong>' + l.miles + '</strong></span>' +
          '<span class="loadback-stat">RPM: <strong>$' + l.rpm.toFixed(2) + '</strong></span>' +
          '<span class="loadback-stat">Net: <strong>$' + l.returnNet.toLocaleString() + '</strong></span>' +
          '<span class="loadback-stat">Round Trip: <strong style="color:var(--green)">$' + l.roundTripNet.toLocaleString() + '</strong></span>' +
        '</div>' +
        '<div class="loadback-date">📅 Available around arrival · ' + (l.equipment || 'V') + '</div>' +
        '<div class="lb-actions">' +
          (l.contactPhone ? '<button class="lb-call-btn" onclick="callBroker(\'' + l.contactPhone + '\',\'' + (l.broker || 'Broker') + '\')">📞 Call ' + (l.broker || 'Broker') + '</button>' : '') +
          '<button class="lb-book-btn" onclick="addReturnLoad(\'' + l.route + '\',' + l.miles + ',' + l.rate + ')">✓ Add to Loads</button>' +
          '<button class="lb-call-btn lb-ai-btn" onclick="analyzeReturnLoad(this,\'' + l.route + '\',' + l.rate + ',' + l.miles + ',' + l.rpm.toFixed(2) + ',' + l.returnNet + ',' + l.roundTripNet + ',\'' + (l.broker||'') + '\')" style="color:#7ab8ff;border-color:rgba(122,184,255,.35);">🤖 Analyze</button>' +
        '</div>' +
        '<div class="lb-ai-result" style="display:none;margin-top:.5rem;padding:.5rem .7rem;border-radius:3px;font-size:.82rem;"></div>' +
      '</div>';
    }).join('');

    // Find and replace just the return loads section
    var sectionTitle = lbContent.querySelector('.loadback-section-title');
    if (sectionTitle) {
      // Remove everything after the section title
      var next = sectionTitle.nextSibling;
      while (next) {
        var toRemove = next;
        next = next.nextSibling;
        if (toRemove.classList && toRemove.classList.contains('btn')) break;
        lbContent.removeChild(toRemove);
      }
      sectionTitle.insertAdjacentHTML('afterend',
        loadsHtml + AI_DISCLAIMER
      );
    }

    track('live_loadback_fetched', { dest: dest, count: scoredLoads.length });

  } catch(err) {
    console.error('Live loadback error:', err);
    // Original static data already showing — no action needed
  }
};


// ══════════════════════════════════════════════════════════════════════════
// AI ANALYZE — Return load analysis in Loadback context
// ══════════════════════════════════════════════════════════════════════════
async function analyzeReturnLoad(btn, route, returnRate, returnMiles, returnRpm, returnNet, roundTripNet, broker) {
  var resultEl = btn.parentElement.nextElementSibling;
  if (!resultEl || !resultEl.classList.contains('lb-ai-result')) return;

  btn.textContent = '🤖 Analyzing...';
  btn.disabled = true;

  // Get outbound context from last booked load
  var lastLoad   = window._lastLoadback || {};
  var outRate    = lastLoad.rate   || 0;
  var outMiles   = lastLoad.miles  || 0;
  var outOrigin  = lastLoad.origin || 'unknown';
  var outDest    = lastLoad.dest   || 'unknown';
  var outFuel    = Math.round((outMiles / (defaults.mpg || 6.5)) * (defaults.fuelPrice || 4.25));
  var outNet     = outRate - outFuel;
  var minRpm     = defaults.minRpm || 2.00;

  // Get broker credit if available
  var brokerInfo = '';
  if (broker) {
    var bKey = broker.toLowerCase();
    var keys = Object.keys(BROKER_DB);
    for (var k = 0; k < keys.length; k++) {
      if (bKey.indexOf(keys[k]) >= 0 || keys[k].indexOf(bKey) >= 0) {
        var bd = BROKER_DB[keys[k]];
        brokerInfo = broker + ' — Credit: ' + bd.score + ', pays in ' + bd.days + ' days avg.';
        break;
      }
    }
  }

  var prompt =
    'You are a freight dispatcher analyzing a return load for an owner-operator trucker. ' +
    'Give a single TAKE IT or PASS verdict with one sentence of round trip reasoning. Be specific with numbers.\n\n' +
    'OUTBOUND LOAD:\n' +
    '- Route: ' + outOrigin + ' → ' + outDest + '\n' +
    '- Rate: $' + outRate.toLocaleString() + ' · ' + outMiles + ' mi · Net: $' + outNet.toLocaleString() + '\n\n' +
    'RETURN LOAD:\n' +
    '- Route: ' + route + '\n' +
    '- Rate: $' + returnRate.toLocaleString() + ' · ' + returnMiles + ' mi · $' + returnRpm + '/mi · Net: $' + returnNet.toLocaleString() + '\n' +
    '- Round trip net: $' + roundTripNet.toLocaleString() + '\n' +
    (brokerInfo ? '- Broker: ' + brokerInfo + '\n' : '') +
    '- Driver min RPM: $' + minRpm + '/mi\n\n' +
    'Reply format: TAKE IT or PASS — [one sentence with round trip net and key reason]';

  try {
    var text = await callAI(prompt, 100);
    var isTake = text.toUpperCase().includes('TAKE');
    resultEl.style.display = 'block';
    resultEl.style.background = isTake ? 'var(--green-dim)' : 'rgba(255,126,126,.1)';
    resultEl.style.border = '1px solid ' + (isTake ? 'var(--green-border)' : 'rgba(255,126,126,.35)');
    resultEl.style.color = isTake ? 'var(--green)' : 'var(--red)';
    resultEl.innerHTML = '🤖 ' + text +
      '<div style="font-size:.68rem;color:#b8c8b8;margin-top:.25rem;font-style:italic;">AI estimate · Verify before booking</div>';
  } catch(e) {
    resultEl.style.display = 'block';
    resultEl.style.background = 'var(--surface2)';
    resultEl.style.color = '#b8c8b8';
    resultEl.textContent = 'AI unavailable. Check your connection.';
  }

  btn.textContent = '🤖 Analyze';
  btn.disabled = false;
}

var _origOnAuthReadyTS = onAuthReady;
onAuthReady = function(firstName, userId, email) {
  _origOnAuthReadyTS(firstName, userId, email);
  var waitForSupabase = setInterval(function() {
    if (window._supabaseReady && window._supabase) {
      clearInterval(waitForSupabase);
      // Load preferences from Supabase first so filters are correct
      loadPreferencesFromSupabase().then(function() {
        registerPushSubscription();
        saveLoadAlertPrefs();
        // Re-fetch loads with correct parameters after prefs load
        setTimeout(function() { fetchTruckstopLoads(true); }, 500);
      });
    }
  }, 500);
};
