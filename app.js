/* RoadCommand — app.js */

// ══════════════════════════════════════════════════════════════
// AUTH & SUPABASE INTEGRATION
// ══════════════════════════════════════════════════════════════
// window._rcUserFirstName  — set by auth.js after login
// window._rcUserId         — Supabase user UUID
// window._rcUserEmail      — user email

// Called by auth.js when user is confirmed logged in
function onAuthReady(firstName, userId, email) {
  window._rcUserFirstName = firstName || 'Driver';
  window._rcUserId        = userId;
  window._rcUserEmail     = email;

  // Populate header from profile globals set by auth.js
  var truckModel = window._rcTruckYear && window._rcTruckModel
    ? window._rcTruckYear + ' ' + window._rcTruckModel
    : 'RoadCommand';
  var driverName = window._rcUserFirstName || '';
  if (window._rcUserCodriver) driverName += ' & ' + window._rcUserCodriver;

  var headerModel = document.getElementById('header-truck-model');
  var headerName  = document.getElementById('header-truck-name');
  if (headerModel) headerModel.textContent = truckModel;
  if (headerName)  headerName.textContent  = driverName;

  // Populate settings fields from profile
  var nameEl     = document.getElementById('set-name');
  var codriverEl = document.getElementById('set-codriver');
  var yearEl     = document.getElementById('set-year');
  var modelEl    = document.getElementById('set-model');
  if (nameEl     && !nameEl.value)     nameEl.value     = window._rcUserFirstName || '';
  if (codriverEl && !codriverEl.value) codriverEl.value = window._rcUserCodriver  || '';
  if (yearEl     && !yearEl.value)     yearEl.value     = window._rcTruckYear     || '';
  if (modelEl    && !modelEl.value)    modelEl.value    = window._rcTruckModel    || '';

  // Re-init app
  renderStates(stateData);
  injectProfitBars();
  loadSavedPreferences();
  renderMaint();
  refreshWeather();
  setTimeout(startGPS, 500);
  setTimeout(checkFirstTime, 700);
  // Load broker vault, invoices, and maintenance
  setTimeout(loadBrokers, 800);
  setTimeout(loadInvoices, 1000);
  setTimeout(loadMaintItems, 1200);
}

// ══════════════════════════════════════════════════════════════
// FEEDBACK BUTTON
// ══════════════════════════════════════════════════════════════
function submitFeedback() {
  var type = document.getElementById('feedback-type') ? document.getElementById('feedback-type').value : 'general';
  var msg  = document.getElementById('feedback-msg')  ? document.getElementById('feedback-msg').value.trim() : '';
  if (!msg) { alert('Please describe your feedback before submitting.'); return; }
  // Mailto fallback — will be replaced with Supabase DB insert in Phase 4
  var subject = encodeURIComponent('[RoadCommand ' + type + '] Feedback');
  var body    = encodeURIComponent(msg + '\n\n— ' + (window._rcUserEmail || 'user'));
  window.location.href = 'mailto:levi@roadcommand.co?subject=' + subject + '&body=' + body;
  document.getElementById('feedback-msg').value = '';
  alert('Thanks! Your feedback is on its way.');
}


// STATE DATA
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

// CALL BROKER
function callBroker(phone, name) {
  const clean = phone.replace(/[^0-9+]/g,'');
  if (confirm(`Call ${name}?\n${phone}`)) {
    window.location.href = 'tel:' + clean;
  }
}

// NAV
function showScreen(id, btn) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('screen-' + id).classList.add('active');
  if (btn) btn.classList.add('active');
}

function goToSettings() {
  var btns = document.querySelectorAll('.nav-btn');
  var settingsBtn = null;
  btns.forEach(function(b) {
    if (b.textContent.indexOf('Settings') >= 0) settingsBtn = b;
  });
  showScreen('settings', settingsBtn);
  // Scroll nav to show settings button
  if (settingsBtn) {
    settingsBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }
}

// LOCATION
// updateLocation defined above in GPS section

// LOAD ACTIONS
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

function saveLoad() {
  alert('Load saved!');
  document.getElementById('add-load-form').style.display = 'none';
}

function showAddRun() {
  const f = document.getElementById('add-run-form');
  f.style.display = f.style.display === 'none' ? 'block' : 'none';
}

function saveRun() {
  alert('Run logged!');
  document.getElementById('add-run-form').style.display = 'none';
}

// CALC
function calcLoad(rate, miles) {
  showScreen('calc', document.querySelectorAll('.nav-btn')[2]);
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
  if (rpm >= 2.3) { verdict = '✅ Strong — Take It'; color = 'var(--green)'; }
  else if (rpm >= 2.0) { verdict = '⚠️ Acceptable — Meets Minimum'; color = 'var(--amber)'; }
  else { verdict = '❌ Skip — Below Your Minimum'; color = 'var(--red)'; }
  document.getElementById('r-verdict').textContent = verdict;
  document.getElementById('r-verdict').style.color = color;
  document.getElementById('r-total-row').className = net >= 0 ? 'calc-row total' : 'calc-row total loss';
  document.getElementById('calc-result').style.display = 'block';
}

function saveParams() {
  // Update defaults from Parameters inputs so profit bars refresh
  const fuel = parseFloat(document.getElementById('calc-fuel') && document.getElementById('calc-fuel').value) || 4.25;
  const mpg  = parseFloat(document.getElementById('calc-mpg')  && document.getElementById('calc-mpg').value)  || 6.5;
  defaults.fuelPrice = fuel;
  defaults.mpg = mpg;
  injectProfitBars();
  alert('Parameters saved! Profit estimates updated.');
}
function filterLoads(type) {
  document.querySelectorAll('[id^=filter-]').forEach(b => b.className = 'btn btn-outline btn-sm');
  document.getElementById('filter-' + type).className = 'btn btn-green btn-sm';
}

// INLINE PROFIT CALCULATOR
// Default settings — synced from Parameters tab
const defaults = { fuelPrice: 4.25, mpg: 6.5, emptyMpg: 8.0, deadhead: 0, brokerPct: 0 };

function autoProfit(rate, miles) {
  const totalMiles = miles + defaults.deadhead;
  const fuelCost = (totalMiles / defaults.mpg) * defaults.fuelPrice;
  const brokerFee = rate * (defaults.brokerPct / 100);
  const net = rate - fuelCost - brokerFee;
  const rpm = rate / miles;
  let tier, verdictText;
  if (rpm >= 2.3)      { tier = 'strong'; verdictText = '✅ Strong — Take It'; }
  else if (rpm >= 2.0) { tier = 'ok';     verdictText = '⚠️ Acceptable'; }
  else                 { tier = 'weak';   verdictText = '❌ Below Minimum'; }
  const fmt = n => '$' + Math.abs(n).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return { net, rpm, tier, verdictText, fuelCost, fmt };
}

function injectProfitBars() {
  // Each load card that has data-rate and data-miles attributes
  document.querySelectorAll('.load-card[data-rate]').forEach(card => {
    const rate  = parseFloat(card.dataset.rate);
    const miles = parseFloat(card.dataset.miles);
    if (!rate || !miles) return;
    const { net, rpm, tier, verdictText, fuelCost, fmt } = autoProfit(rate, miles);
    // Remove existing profit bar if re-running
    const existing = card.querySelector('.load-profit');
    if (existing) existing.remove();
    // Build profit bar
    const bar = document.createElement('div');
    bar.className = 'load-profit ' + tier;
    bar.innerHTML = `
      <div class="profit-left">
        <div class="profit-net ${tier}">${net >= 0 ? '' : '-'}${fmt(net)} net</div>
        <div class="profit-detail">After fuel ${fmt(fuelCost)} · ${fmt(rate / miles)}/mi loaded</div>
      </div>
      <span class="profit-verdict verdict-${tier}">${verdictText}</span>`;
    // Insert before load-actions
    const actions = card.querySelector('.load-actions');
    card.insertBefore(bar, actions);
  });
}

// ══════════════════════════════════════════════════════════════
// TUTORIAL SYSTEM
// ══════════════════════════════════════════════════════════════
const TUTORIAL_STEPS = [
  {
    icon: '👋',
    title: 'Welcome, ' + (window._rcUserFirstName || 'Driver'),
    desc: 'RoadCommand is your personal dispatcher — built to eliminate dispatch fees and put you in control of every load decision.',
    tip: '<strong>This tutorial walks you through every feature.</strong> Takes about 2 minutes. You can also re-run it anytime from the Settings tab.'
  },
  {
    icon: '📊',
    title: 'Dashboard',
    desc: 'Your home screen. Shows live GPS location, current diesel price for your region, weekly stats, and hot loads matching your parameters — all automatically.',
    tip: '<strong>Diesel price updates automatically</strong> based on your GPS location. West Coast, Rocky Mountain, Gulf Coast — it knows where you are.'
  },
  {
    icon: '🚛',
    title: 'Loads Tab',
    desc: 'All your loads in one place — Hot, Watching, and Booked. Tap 📞 Call to dial the broker directly. Tap 💰 Calc to run the full profit breakdown. Tap 👁 Watch to save a load for later.',
    tip: '<strong>Every load shows auto profit</strong> — net after fuel calculated instantly using your real local diesel price. Green = take it. Amber = acceptable. Red = skip it.'
  },
  {
    icon: '🤝',
    title: 'Negotiate Tab',
    desc: 'Your secret weapon. Check any broker credit score and payment history before you call. Then enter the lane and broker offer to get a word-for-word counter-offer script.',
    tip: '<strong>Use the Rate Coach before every call.</strong> Enter the origin state, destination state, broker offer, and miles — it tells you exactly what to counter at.'
  },
  {
    icon: '🛠️',
    title: 'Tools Tab',
    desc: 'Three tools that replace dispatcher knowledge: Lane Planner finds your return load before you deliver. HOS Checker tells you if a load is legally deliverable. Doc Tracker records every BOL and rate confirmation.',
    tip: '<strong>Always run Lane Planner before accepting a load.</strong> Knowing your return options before you commit is how experienced operators maximize their average RPM.'
  },
  {
    icon: '💵',
    title: 'Money Tab',
    desc: 'Track every invoice. See outstanding and overdue totals at a glance. Color-coded: green = paid, amber = due soon, red = overdue. One tap to call the broker and chase payment.',
    tip: '<strong>Log invoices the day you deliver.</strong> Brokers pay faster when they know you are tracking. Never chase a payment you forgot about.'
  },
  {
    icon: '🗺️',
    title: 'States Tab',
    desc: 'Track which states have the most available loads and the best rates. Sort by volume, average RPM, or trending up. Manually update as you observe the market — or connect the API to auto-populate.',
    tip: '<strong>Check States before planning your week.</strong> High volume + rising trend = strong negotiating position. Low volume = take what you can get and move on.'
  },
  {
    icon: '⚙️',
    title: 'Parameters Tab',
    desc: 'Set your minimum rate per mile, preferred lanes, home base, max weight, and alert preferences. These become your live filters when the Truckstop API is connected.',
    tip: '<strong>Set your real minimums here.</strong> The app uses these to flag Hot loads and calculate whether a broker offer meets your standard.'
  },
  {
    icon: '🔧',
    title: 'Settings Tab',
    desc: 'Change text size for easier reading in the cab. Switch to High Contrast mode for bright sunlight. Update your truck info and fuel defaults. All preferences save to your device.',
    tip: '<strong>Pinch to zoom works on any screen</strong> regardless of text size setting. Settings + pinch zoom = readable in any conditions.'
  },
];

let currentStep = 0;

function renderTutorialStep(step) {
  const s = TUTORIAL_STEPS[step];
  const total = TUTORIAL_STEPS.length;

  document.getElementById('t-step-count').textContent = 'Step ' + (step+1) + ' of ' + total;
  document.getElementById('t-body').innerHTML = `
    <div class="tutorial-icon">${s.icon}</div>
    <div class="tutorial-screen-title">${s.title}</div>
    <div class="tutorial-desc">${s.desc}</div>
    <div class="tutorial-tip">${s.tip}</div>
  `;

  // Dots
  const dotsEl = document.getElementById('t-dots');
  dotsEl.innerHTML = TUTORIAL_STEPS.map((_,i) =>
    `<div class="t-dot ${i===step?'active':''}"></div>`
  ).join('');

  // Next button label
  const nextBtn = document.getElementById('t-next-btn');
  nextBtn.textContent = step === total-1 ? "Lets Go! 🚛" : "Tap anywhere →";

  // Back button — hide on step 0, show on all others
  var backBtn = document.getElementById('t-back-btn');
  if (backBtn) {
    backBtn.style.display = step === 0 ? 'none' : 'inline-block';
  }
}

function nextTutorialStep() {
  if (currentStep < TUTORIAL_STEPS.length - 1) {
    currentStep++;
    renderTutorialStep(currentStep);
  } else {
    skipTutorial();
  }
}

function prevTutorialStep() {
  if (currentStep > 0) {
    currentStep--;
    renderTutorialStep(currentStep);
  }
}

function skipTutorial() {
  const overlay = document.getElementById('tutorial-overlay');
  overlay.style.display = 'none';
  try { localStorage.setItem('rc-tutorialdone-v7', '1'); } catch(e) {}
}

function startTutorial() {
  tutorialSeen = false;
  currentStep = 0;
  renderTutorialStep(0);
  document.getElementById('tutorial-overlay').style.display = 'flex';
}

function checkFirstTime() {
  try {
    if (!localStorage.getItem('rc-tutorialdone-v7')) {
      setTimeout(startTutorial, 800);
    }
  } catch(e) {
    // localStorage not available — show tutorial anyway
    setTimeout(startTutorial, 800);
  }
}

// ══════════════════════════════════════════════════════════════
// TOOL HELP SYSTEM
// ══════════════════════════════════════════════════════════════
const HELP_CONTENT = {
  loads: {
    title: '🚛 How to Use the Loads Tab',
    steps: [
      'Tap any load card to see full details — miles, weight, pickup date, broker name and phone.',
      'Tap 📞 Call to confirm the broker number and dial directly from your phone.',
      'Tap 💰 Calc to jump to the profit calculator pre-filled with that load rate and miles.',
      'Tap 👁 Watch to save a load you are considering but not ready to book.',
      'Tap ✕ Skip to remove a load from your view.',
      'The colored profit bar shows your estimated net after fuel automatically. Green = strong, Amber = acceptable, Red = below your minimum.',
      'Tap + Add Load Manually to enter any load you find on Truckstop or DAT.',
    ]
  },
  broker: {
    title: '🏦 How to Use Broker Scorecard',
    steps: [
      'Type the broker name (e.g. "CH Robinson", "Echo Global", "Coyote") in the search box.',
      'Tap Check to see their credit rating, average days to pay, and any red flags.',
      'Green flags mean the broker is reliable. Amber means proceed with caution. Red means high risk.',
      'Read the recommendation at the bottom — it tells you exactly how to negotiate with that specific broker.',
      'Always get a signed rate confirmation before loading for any broker you have not worked with before.',
    ]
  },
  negotiate: {
    title: '📈 How to Use Rate Negotiation Coach',
    steps: [
      'Select the origin state and destination state for the load.',
      'Enter the broker current offer in dollars.',
      'Enter the total loaded miles.',
      'Tap Get My Counter-Offer to see the market rate for that lane.',
      'The coach shows you the market average RPM, whether the offer is strong/at market/below market, and the total dollar amount to counter at.',
      'Read the script at the bottom — use it word for word on the phone. Most brokers have $100–200 flex on spot loads.',
      'If the offer is already above market, accept it or push very lightly.',
    ]
  },
  deadhead: {
    title: '📍 How to Use Nearest Load Finder',
    steps: [
      'Enter the city where you are dropping your current load (e.g. "Salt Lake City, UT").',
      'Set your maximum deadhead miles — how far you are willing to drive empty to reach the next pickup.',
      'Set your minimum rate per mile.',
      'Tap Find Nearby Loads to see available loads near your drop point.',
      'Green bordered cards meet your minimum. Review estimated net profit on each.',
      'Use this BEFORE you deliver — knowing your options early gives you leverage with brokers.',
    ]
  },
  lanner: {
    title: '🗺️ How to Use Lane Planner',
    steps: [
      'Enter your outbound load details — origin, destination, rate, and miles.',
      'Tap Plan Round Trip to see available return loads from your destination.',
      'Each return card shows the miles, rate per mile, and estimated round-trip net profit.',
      'Green cards are the strongest return options. Book these early.',
      'The advice box at the bottom shows your outbound net and round-trip summary.',
      'Pro tip: always plan your return before accepting the outbound load. Empty miles kill your average RPM.',
    ]
  },
  hos: {
    title: '⏱️ How to Use HOS Load Checker',
    steps: [
      'Enter your available driving hours remaining on your current HOS clock.',
      'Enter the total miles to deliver the load.',
      'Enter the pickup window — how many hours you have to get to the shipper.',
      'Adjust average speed if needed (default 55 mph is conservative and legal).',
      'Tap Check If Legal to get an instant verdict.',
      'Green means you can legally make the load with time to spare.',
      'Red means do NOT accept the load — you cannot legally deliver it on time. Negotiate a later pickup or pass.',
    ]
  },
  docs: {
    title: '📄 How to Use Load Document Tracker',
    steps: [
      'Enter the BOL (Bill of Lading) number — this is your primary record ID.',
      'Enter the Rate Confirmation number from the broker.',
      'Enter the broker name, load amount, and delivery date.',
      'Add any notes — delivery issues, detention time, lumper fees, or damage.',
      'Tap Save Load Record — the entry appears below for future reference.',
      'If a broker disputes a load or delays payment, you have a complete record to reference.',
      'Keep this updated for every load. Takes 30 seconds and protects thousands of dollars.',
    ]
  },
  invoice: {
    title: '💵 How to Use Invoice Tracker',
    steps: [
      'After delivering a load, enter the broker name, amount owed, and reference number.',
      'Enter the invoice date (today) and select your payment terms (Net 15, 30, 45, or 60).',
      'Add the broker phone number so you can call directly from the invoice.',
      'Tap Add Invoice — it appears in your list color-coded by status.',
      'Amber = payment due soon. Red = overdue. Green = paid.',
      'When payment arrives tap ✓ Mark Paid to clear the invoice.',
      'Tap 📞 Call directly from an overdue invoice to chase payment immediately.',
      'The totals at the top always show your total outstanding and overdue balances.',
    ]
  },
  calc: {
    title: '💰 How to Use Profit Calculator',
    steps: [
      'Enter the gross rate the broker is offering in dollars.',
      'Enter the total loaded miles.',
      'Fuel price and MPG are pre-filled from your Settings — update them anytime.',
      'Enter deadhead miles if you have to drive empty to reach the pickup.',
      'Enter broker fee percentage if applicable (most spot loads are 0%).',
      'Enter any other costs — lumper fees, tolls, scale fees.',
      'Results update instantly as you type. Check the Verdict line for a quick decision.',
      'Green verdict = take it. Amber = acceptable but push back. Red = below your minimum — walk away.',
    ]
  },
};

function showHelp(toolId) {
  const h = HELP_CONTENT[toolId];
  if (!h) return;
  document.getElementById('help-modal-title-text').textContent = h.title;
  document.getElementById('help-modal-body').innerHTML = h.steps.map((s,i) =>
    `<div class="help-step">
      <div class="help-step-num">${i+1}</div>
      <div>${s}</div>
    </div>`
  ).join('');
  document.getElementById('help-modal-overlay').classList.remove('hidden');
}

function closeHelpModal(e) {
  if (!e || e.target === document.getElementById('help-modal-overlay')) {
    document.getElementById('help-modal-overlay').classList.add('hidden');
  }
}

// ══════════════════════════════════════════════════════════════
// SETTINGS
// ══════════════════════════════════════════════════════════════
function setTextSize(size, btn) {
  // Remove any existing text-size class without touching other classes
  ['text-normal','text-large','text-xlarge','text-xxlarge'].forEach(function(c) {
    document.body.classList.remove(c);
  });
  document.body.classList.add('text-' + size);

  document.querySelectorAll('.text-size-btn').forEach(function(b) { b.classList.remove('active'); });
  if (btn) btn.classList.add('active');

  // Save preference
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

  // Update header display
  const truckEl = document.querySelector('.header-truck');
  if (truckEl) {
    truckEl.innerHTML = '<strong>' + year + ' ' + model + '</strong>' + name + (codriver ? ' & ' + codriver : '');
  }
  try {
    localStorage.setItem('rc-truck', JSON.stringify({ name, codriver, year, model }));
  } catch(e) {}
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

  // Update calc tab defaults
  const cf = document.getElementById('calc-fuel');
  const cm = document.getElementById('calc-mpg');
  if (cf) cf.value = fuel.toFixed(2);
  if (cm) cm.value = mpg.toFixed(1);

  // Refresh profit bars
  injectProfitBars();

  try {
    localStorage.setItem('rc-defaults', JSON.stringify({ mpg, emptyMpg, fuel, minrpm, speed }));
  } catch(e) {}
  alert('Fuel defaults saved! Profit bars updated.');
}

// Load saved preferences on start
function loadSavedPreferences() {
  try {
    const size = localStorage.getItem('rc-textsize');
    if (size) {
      const btn = document.getElementById('size-' + size);
      if (btn) setTextSize(size, btn);
    }
    const scheme = localStorage.getItem('rc-scheme');
    if (scheme) {
      const btn = document.getElementById('scheme-' + scheme);
      if (btn) setScheme(scheme, btn);
    }
    const savedDefaults = localStorage.getItem('rc-defaults');
    if (savedDefaults) {
      const d = JSON.parse(savedDefaults);
      if (d.mpg)      { defaults.mpg = d.mpg; document.getElementById('set-mpg').value = d.mpg; }
      if (d.emptyMpg) { defaults.emptyMpg = d.emptyMpg; var emEl = document.getElementById('set-empty-mpg'); if (emEl) emEl.value = d.emptyMpg; }
      if (d.fuel)     { defaults.fuelPrice = d.fuel; document.getElementById('set-fuel').value = d.fuel; }
      if (d.speed) { document.getElementById('set-speed').value = d.speed; }
    }
    const truck = localStorage.getItem('rc-truck');
    if (truck) {
      const t = JSON.parse(truck);
      if (t.name)     document.getElementById('set-name').value = t.name;
      if (t.codriver) document.getElementById('set-codriver').value = t.codriver;
      if (t.year)     document.getElementById('set-year').value = t.year;
      if (t.model)    document.getElementById('set-model').value = t.model;
      const truckEl = document.querySelector('.header-truck');
      if (truckEl && t.year && t.model) {
        truckEl.innerHTML = '<strong>' + t.year + ' ' + t.model + '</strong>' + t.name + (t.codriver ? ' & ' + t.codriver : '');
      }
    }
  } catch(e) {}
}

// Hide swipe hint when nav is scrolled
document.addEventListener('DOMContentLoaded', function() {
  var nav = document.getElementById('bottom-nav');
  if (nav) {
    nav.addEventListener('scroll', function() {
      var hint = document.getElementById('swipe-hint');
      if (hint) hint.style.display = 'none';
    }, { once: true });
  }
});

// BROKER DATABASE
var BROKER_DB = {
  "ch robinson":  { score:"A+", days:22, flags:[{t:"good",i:"✅",m:"Pays consistently on time"},{t:"good",i:"✅",m:"Top credit rating"},{t:"warn",i:"⚠️",m:"Large volume broker — negotiate hard"}], rec:"Solid broker. Book with confidence. Push for $0.15 to $0.25 above first offer." },
  "echo global":  { score:"A",  days:27, flags:[{t:"good",i:"✅",m:"Good payment history"},{t:"warn",i:"⚠️",m:"Low first offers on competitive lanes"}], rec:"Reliable. Counter at 10 percent above their initial offer." },
  "coyote":       { score:"A",  days:25, flags:[{t:"good",i:"✅",m:"Strong credit rating"},{t:"good",i:"✅",m:"24/7 availability"}], rec:"Good broker. Fair rates. Push back once on spot loads." },
  "xpo":          { score:"B+", days:31, flags:[{t:"warn",i:"⚠️",m:"Occasional delays at month end"},{t:"good",i:"✅",m:"High load volume"}], rec:"Acceptable. Get rate confirmation in writing before loading." },
  "convoy":       { score:"B",  days:35, flags:[{t:"warn",i:"⚠️",m:"Payment can run 30 to 45 days"},{t:"warn",i:"⚠️",m:"App based — limited personal service"}], rec:"Use for backhauls only. Factor payment terms into your rate." },
  "uber freight": { score:"B",  days:33, flags:[{t:"warn",i:"⚠️",m:"Digital broker — rate usually firm"},{t:"good",i:"✅",m:"Fast booking"}], rec:"Rate is usually firm. Good for quick backhauls." },
  "total quality": { score:"A", days:24, flags:[{t:"good",i:"✅",m:"Fast payment"},{t:"good",i:"✅",m:"Good to work with"}], rec:"Reliable broker. Accept or push lightly." },
  "j.b. hunt":    { score:"A+", days:20, flags:[{t:"good",i:"✅",m:"Excellent payment history"},{t:"good",i:"✅",m:"Large stable company"}], rec:"Very reliable. Strong rates on dedicated lanes." },
  "landstar":     { score:"A+", days:21, flags:[{t:"good",i:"✅",m:"Top tier credit"},{t:"good",i:"✅",m:"Agent based — negotiate with agent directly"}], rec:"Push the agent for an extra 5 to 10 percent. They have flexibility." },
};

function lookupBroker() {
  var q = document.getElementById("broker-search").value.trim().toLowerCase();
  var result = document.getElementById("broker-result");
  if (!q) return;
  var match = null;
  var keys = Object.keys(BROKER_DB);
  for (var k = 0; k < keys.length; k++) {
    if (q.indexOf(keys[k]) >= 0 || keys[k].indexOf(q) >= 0) {
      match = BROKER_DB[keys[k]];
      break;
    }
  }
  if (!match) {
    match = {
      score:"N/A", days:"?",
      flags:[{t:"warn",i:"⚠️",m:"Broker not in database — verify on Truckstop"},{t:"warn",i:"⚠️",m:"Check credit score before loading"},{t:"warn",i:"⚠️",m:"Get signed rate confirmation before accepting"}],
      rec:"Unknown broker. Check their Truckstop credit rating. Always get payment terms in writing."
    };
  }
  var scoreColor = match.score.indexOf("A") === 0 ? "var(--green)" : match.score.indexOf("B") === 0 ? "var(--amber)" : "var(--red)";
  var daysColor  = match.days <= 28 ? "var(--green)" : match.days <= 35 ? "var(--amber)" : "var(--red)";
  document.getElementById("b-score").textContent = match.score;
  document.getElementById("b-score").style.color = scoreColor;
  document.getElementById("b-days").textContent = match.days;
  document.getElementById("b-days").style.color = daysColor;
  var flagsHtml = match.flags.map(function(f) {
    return "<div class=\"broker-flag\"><span class=\"flag-icon\">" + f.i + "</span><span class=\"flag-" + f.t + "\">" + f.m + "</span></div>";
  }).join("");
  document.getElementById("broker-flags").innerHTML = flagsHtml;
  document.getElementById("broker-rec").textContent = "💡 " + match.rec;
  result.style.display = "block";
}

// LANE RATE DATABASE
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

function runNegCoach() {
  var origin = document.getElementById("neg-origin").value;
  var dest   = document.getElementById("neg-dest").value;
  var offer  = parseFloat(document.getElementById("neg-offer").value);
  var miles  = parseFloat(document.getElementById("neg-miles").value);
  if (!origin || !dest || !offer || !miles) { alert("Fill in all fields first."); return; }
  var key = origin + "-" + dest;
  var revKey = dest + "-" + origin;
  var marketRpm = LANE_RATES[key] || LANE_RATES[revKey] || 2.15;
  var marketTotal = Math.round(marketRpm * miles);
  var offerRpm = offer / miles;
  var counterRpm = Math.max(marketRpm, offerRpm + 0.15);
  var counterTotal = Math.round(counterRpm * miles);
  document.getElementById("neg-market").textContent = "$" + marketRpm.toFixed(2) + "/mi";
  document.getElementById("neg-offer-rpm").textContent = "$" + offerRpm.toFixed(2) + "/mi";
  document.getElementById("neg-counter").textContent = "$" + counterTotal.toLocaleString();
  var diff = offerRpm - marketRpm;
  var assessment, script;
  if (diff >= 0.15) {
    assessment = "✅ Strong Offer — Above Market";
    script = "Their offer of $" + offer.toLocaleString() + " is above market for this lane. Accept or push lightly: We can do this load at $" + (counterTotal - 50).toLocaleString() + " with pickup confirmed for your date.";
  } else if (diff >= -0.10) {
    assessment = "⚠️ At Market — Push Back Once";
    script = "This is right at market. Counter with: We are at $" + counterTotal.toLocaleString() + " on this lane based on current market rates. Can you get there? Most brokers have $100 to $200 flex on spot loads.";
  } else {
    assessment = "❌ Below Market — Hold Firm";
    script = "Their offer is below market by $" + Math.abs(Math.round(diff * miles)) + ". Counter confidently: Current market on this lane is running $" + marketRpm.toFixed(2) + " per mile. We need $" + counterTotal.toLocaleString() + " to make it work. If they cannot move, walk away — a better load is coming.";
  }
  document.getElementById("neg-script").innerHTML = "<strong>" + assessment + "</strong><br><br>" + script;
  document.getElementById("neg-result").style.display = "block";
}

// NEARBY LOADS DATABASE
var NEARBY_LOADS = {
  "salt lake city":[
    {route:"Salt Lake City, UT → Las Vegas, NV",  miles:421, rate:1050, rpm:2.49},
    {route:"Salt Lake City, UT → Boise, ID",       miles:340, rate:820,  rpm:2.41},
    {route:"Salt Lake City, UT → Denver, CO",      miles:525, rate:1155, rpm:2.20},
    {route:"Salt Lake City, UT → Phoenix, AZ",     miles:673, rate:1413, rpm:2.10},
  ],
  "portland":[
    {route:"Portland, OR → Seattle, WA",           miles:178, rate:445,  rpm:2.50},
    {route:"Portland, OR → Boise, ID",             miles:428, rate:1005, rpm:2.35},
    {route:"Portland, OR → Sacramento, CA",        miles:580, rate:1392, rpm:2.40},
  ],
  "boise":[
    {route:"Boise, ID → Moses Lake, WA",           miles:302, rate:695,  rpm:2.30},
    {route:"Boise, ID → Salt Lake City, UT",       miles:340, rate:782,  rpm:2.30},
    {route:"Boise, ID → Portland, OR",             miles:428, rate:940,  rpm:2.20},
  ],
  "pasco":[
    {route:"Pasco, WA → Moses Lake, WA",           miles:82,  rate:205,  rpm:2.50},
    {route:"Pasco, WA → Spokane, WA",              miles:143, rate:350,  rpm:2.45},
    {route:"Pasco, WA → Portland, OR",             miles:215, rate:505,  rpm:2.35},
  ],
  "spokane":[
    {route:"Spokane, WA → Moses Lake, WA",         miles:100, rate:250,  rpm:2.50},
    {route:"Spokane, WA → Portland, OR",           miles:350, rate:805,  rpm:2.30},
    {route:"Spokane, WA → Boise, ID",              miles:305, rate:700,  rpm:2.30},
  ],
  "las vegas":[
    {route:"Las Vegas, NV → Los Angeles, CA",      miles:270, rate:620,  rpm:2.30},
    {route:"Las Vegas, NV → Salt Lake City, UT",   miles:421, rate:970,  rpm:2.30},
    {route:"Las Vegas, NV → Phoenix, AZ",          miles:297, rate:680,  rpm:2.29},
  ],
  "denver":[
    {route:"Denver, CO → Salt Lake City, UT",      miles:525, rate:1155, rpm:2.20},
    {route:"Denver, CO → Albuquerque, NM",         miles:450, rate:990,  rpm:2.20},
    {route:"Denver, CO → Kansas City, MO",         miles:600, rate:1320, rpm:2.20},
  ],
  "default":[
    {route:"Nearby → Moses Lake, WA",              miles:200, rate:480,  rpm:2.40},
    {route:"Nearby → Spokane, WA",                 miles:250, rate:575,  rpm:2.30},
    {route:"Nearby → Portland, OR",                miles:350, rate:805,  rpm:2.30},
  ]
};

function findNearestLoads() {
  var city = document.getElementById("drop-city").value.trim().toLowerCase();
  var minRpm = parseFloat(document.getElementById("drop-rpm").value) || 2.00;
  var container = document.getElementById("nearest-results");
  var loads = null;
  var keys = Object.keys(NEARBY_LOADS);
  for (var k = 0; k < keys.length; k++) {
    if (city.indexOf(keys[k]) >= 0) { loads = NEARBY_LOADS[keys[k]]; break; }
  }
  if (!loads) loads = NEARBY_LOADS["default"];
  var filtered = loads.filter(function(l) { return l.rpm >= minRpm; });
  if (!filtered.length) {
    container.innerHTML = "<div class=\"alert alert-amber\"><div class=\"alert-icon\">⚠️</div><div>No loads found at that minimum rate near that city. Try lowering your minimum or a different city.</div></div>";
    return;
  }
  container.innerHTML = filtered.map(function(l) {
    var isGood = l.rpm >= 2.30;
    var net = Math.round(l.rate - (l.miles / defaults.mpg) * defaults.fuelPrice);
    return "<div class=\"return-card " + (isGood ? "good" : "") + "\"><div class=\"return-top\"><div class=\"return-route\">" + l.route + "</div><div class=\"return-rate\">$" + l.rate.toLocaleString() + "</div></div><div class=\"return-stats\"><span>Miles: <strong>" + l.miles + "</strong></span><span>RPM: <strong>$" + l.rpm.toFixed(2) + "</strong></span><span>Est. Net: <strong>$" + net.toLocaleString() + "</strong></span></div></div>";
  }).join("");
}

function planLane() {
  var origin = document.getElementById("lp-origin").value.trim();
  var dest   = document.getElementById("lp-dest").value.trim();
  var rate   = parseFloat(document.getElementById("lp-rate").value) || 0;
  var miles  = parseFloat(document.getElementById("lp-miles").value) || 0;
  if (!origin || !dest) { alert("Enter origin and destination."); return; }
  var destKey = dest.toLowerCase().split(",")[0].trim();
  var returnLoads = null;
  var keys = Object.keys(NEARBY_LOADS);
  for (var k = 0; k < keys.length; k++) {
    if (destKey.indexOf(keys[k]) >= 0) { returnLoads = NEARBY_LOADS[keys[k]]; break; }
  }
  if (!returnLoads) returnLoads = NEARBY_LOADS["default"];
  var outRpm = miles > 0 ? (rate / miles).toFixed(2) : "--";
  var outNet = rate > 0 && miles > 0 ? Math.round(rate - (miles / defaults.mpg) * defaults.fuelPrice) : 0;
  var loadsHtml = returnLoads.slice(0,3).map(function(l) {
    var roundNet = outNet + Math.round(l.rate - (l.miles / defaults.mpg) * defaults.fuelPrice);
    return "<div class=\"return-card " + (l.rpm >= 2.20 ? "good" : "") + "\"><div class=\"return-top\"><div class=\"return-route\">" + l.route + "</div><div class=\"return-rate\">$" + l.rate.toLocaleString() + "</div></div><div class=\"return-stats\"><span>Miles: <strong>" + l.miles + "</strong></span><span>RPM: <strong>$" + l.rpm.toFixed(2) + "</strong></span><span>Round Trip Net: <strong>$" + roundNet.toLocaleString() + "</strong></span></div></div>";
  }).join("");
  document.getElementById("return-loads").innerHTML = loadsHtml;
  document.getElementById("lane-advice").innerHTML = "Outbound: <strong>" + origin + " to " + dest + "</strong> · $" + rate.toLocaleString() + " · $" + outRpm + "/mi · Est. net $" + outNet.toLocaleString() + "<br>Lock a return load from <strong>" + dest + "</strong> before you deliver the outbound.";
  document.getElementById("lane-result").style.display = "block";
}

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
  var html = legal
    ? "<div class=\"hos-pass\"><div class=\"hos-title\">✅ Legal — You Can Make This Load</div><div class=\"hos-detail\">Drive time: <strong>" + driveTime.toFixed(1) + " hrs</strong> at " + speed + " mph<br>Pickup window: <strong>" + pickup + " hrs</strong><br>Total needed: <strong>" + totalNeeded.toFixed(1) + " hrs</strong><br>Your available: <strong>" + hours + " hrs</strong><br>Buffer: <strong>" + buffer.toFixed(1) + " hrs</strong> to spare</div></div>"
    : "<div class=\"hos-fail\"><div class=\"hos-title\">❌ Illegal — Do Not Accept This Load</div><div class=\"hos-detail\">You need <strong>" + totalNeeded.toFixed(1) + " hours</strong> but only have <strong>" + hours + " hours</strong>.<br>You are short <strong>" + Math.abs(buffer).toFixed(1) + " hours</strong>.<br><br>Options: Reset your clock, negotiate a later pickup, or pass on this load.</div></div>";
  container.innerHTML = html;
  container.style.display = "block";
}

var docRecords = [];
function saveDoc() {
  var bol    = document.getElementById("doc-bol").value.trim();
  var rc     = document.getElementById("doc-rc").value.trim();
  var broker = document.getElementById("doc-broker").value.trim();
  var amount = document.getElementById("doc-amount").value;
  var date   = document.getElementById("doc-date").value;
  var notes  = document.getElementById("doc-notes").value.trim();
  if (!bol) { alert("BOL number required."); return; }
  docRecords.unshift({bol:bol, rc:rc, broker:broker, amount:amount, date:date, notes:notes});
  renderDocs();
  document.getElementById("doc-bol").value = "";
  document.getElementById("doc-rc").value = "";
  document.getElementById("doc-broker").value = "";
  document.getElementById("doc-amount").value = "";
  document.getElementById("doc-notes").value = "";
}

function renderDocs() {
  var list = document.getElementById("doc-list");
  if (!list) return;
  if (!docRecords.length) { list.innerHTML = ""; return; }
  list.innerHTML = "<div class=\"section-label\" style=\"margin-bottom:.5rem;\">Saved Records</div>" +
    docRecords.map(function(d) {
      return "<div class=\"doc-item\"><div class=\"doc-top\"><div class=\"doc-bol\">" + d.bol + "</div><div class=\"doc-broker\">" + (d.broker||"—") + "</div></div><div class=\"doc-stats\">" + (d.rc ? "<span>RC: <strong>" + d.rc + "</strong></span>" : "") + (d.amount ? "<span>$<strong>" + parseFloat(d.amount).toLocaleString() + "</strong></span>" : "") + (d.date ? "<span>Del: <strong>" + d.date + "</strong></span>" : "") + "</div>" + (d.notes ? "<div style=\"font-size:.75rem;color:#ffd04d;opacity:.8;margin-top:.3rem;\">" + d.notes + "</div>" : "") + "</div>";
    }).join("");
}

// ══════════════════════════════════════════════════════════════
// INVOICE SYSTEM — Supabase backed
// All invoices saved to cloud, linked to brokers where possible
// ══════════════════════════════════════════════════════════════

var invoices = []; // local cache loaded from Supabase

// ── Load all invoices from Supabase ──────────────────────────
async function loadInvoices() {
  if (!window._rcUserId) return;
  try {
    var { data, error } = await _supabase
      .from('invoices')
      .select('*')
      .eq('user_id', window._rcUserId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    // Map Supabase rows to local invoice format
    invoices = (data || []).map(function(row) {
      return {
        id:        row.id,
        broker:    row.broker_name,
        amount:    row.amount,
        ref:       row.ref,
        date:      row.invoice_date,
        terms:     row.terms,
        phone:     row.phone,
        dueDate:   row.due_date,
        status:    row.status,
        notes:     row.notes,
        broker_id: row.broker_id,
        supabase:  true
      };
    });
    renderInvoices();
    renderBrokers();
    updateMoneyTotals();
  } catch(err) {
    console.error('Error loading invoices:', err);
  }
}

// ── Save invoice to Supabase ──────────────────────────────────
async function saveInvoiceToSupabase(inv) {
  if (!window._rcUserId) return inv;
  try {
    var { data, error } = await _supabase
      .from('invoices')
      .insert({
        user_id:      window._rcUserId,
        broker_name:  inv.broker,
        amount:       inv.amount,
        ref:          inv.ref,
        phone:        inv.phone,
        invoice_date: inv.date,
        due_date:     inv.dueDate,
        terms:        inv.terms,
        status:       inv.status || 'pending',
        notes:        inv.notes || ''
      })
      .select()
      .single();
    if (error) throw error;
    return Object.assign({}, inv, { id: data.id, supabase: true });
  } catch(err) {
    console.error('Error saving invoice:', err);
    return inv;
  }
}

// ── Update invoice status in Supabase ────────────────────────
async function updateInvoiceStatus(id, status) {
  if (!window._rcUserId) return;
  try {
    await _supabase
      .from('invoices')
      .update({ status: status })
      .eq('id', id)
      .eq('user_id', window._rcUserId);
  } catch(err) {
    console.error('Error updating invoice:', err);
  }
}

// ── Delete invoice from Supabase ──────────────────────────────
async function deleteInvoiceFromSupabase(id) {
  if (!window._rcUserId) return;
  try {
    await _supabase
      .from('invoices')
      .delete()
      .eq('id', id)
      .eq('user_id', window._rcUserId);
  } catch(err) {
    console.error('Error deleting invoice:', err);
  }
}

function addInvoice() {
  var broker  = document.getElementById("inv-broker").value.trim();
  var amount  = parseFloat(document.getElementById("inv-amount").value);
  var ref     = document.getElementById("inv-ref").value.trim();
  var date    = document.getElementById("inv-date").value;
  var terms   = parseInt(document.getElementById("inv-terms").value);
  var phone   = document.getElementById("inv-phone").value.trim();
  if (!broker || !amount || !date) { alert("Broker, amount, and date required."); return; }
  var invoiceDate = new Date(date);
  var dueDate = new Date(invoiceDate);
  dueDate.setDate(dueDate.getDate() + terms);
  var inv = {broker:broker, amount:amount, ref:ref, date:date, terms:terms, phone:phone, dueDate:dueDate.toISOString().split("T")[0], status:"pending", id:Date.now()};
  inv.broker_id = window._selectedBrokerId || null;
  invoices.unshift(inv);
  renderInvoices();
  // Save to Supabase and update local id with server id
  saveInvoiceToSupabase(inv).then(function(saved) {
    var idx = invoices.findIndex(function(i) { return i.id === inv.id; });
    if (idx >= 0) invoices[idx] = saved;
    renderBrokers();
    window._selectedBrokerId = null;
  });
  document.getElementById("inv-broker").value = "";
  document.getElementById("inv-amount").value = "";
  document.getElementById("inv-ref").value = "";
  document.getElementById("inv-phone").value = "";
}

function markPaid(id) {
  var inv = invoices.find(function(i) { return i.id === id; });
  if (inv) {
    inv.status = "paid";
    updateInvoiceStatus(id, "paid");
  }
  renderInvoices();
  renderBrokers();
}

function removeInvoice(id) {
  deleteInvoiceFromSupabase(id);
  invoices = invoices.filter(function(i) { return i.id !== id; });
  renderInvoices();
  renderBrokers();
}

function updateMoneyTotals() {
  var today = new Date();
  var outstanding = 0, overdue = 0;
  invoices.filter(function(i) { return i.status !== "paid"; }).forEach(function(i) {
    outstanding += i.amount;
    var due = new Date(i.dueDate);
    if (due < today) overdue += i.amount;
  });
  var mo = document.getElementById("money-outstanding");
  var mv = document.getElementById("money-overdue");
  if (mo) mo.textContent = "$" + outstanding.toLocaleString();
  if (mv) mv.textContent = "$" + overdue.toLocaleString();
}

function renderInvoices() {
  var list = document.getElementById("invoice-list");
  if (!list) return;
  if (!invoices.length) {
    list.innerHTML = "<div class=\"alert alert-amber\"><div class=\"alert-icon\">📋</div><div>No invoices logged yet.</div></div>";
    updateMoneyTotals();
    return;
  }
  var today = new Date();
  list.innerHTML = invoices.map(function(inv) {
    var due = new Date(inv.dueDate);
    var daysLeft = Math.ceil((due - today) / (1000*60*60*24));
    var isOverdue = inv.status === "pending" && daysLeft < 0;
    var statusBadge = inv.status === "paid"
      ? "<span class=\"paid-badge\">PAID</span>"
      : isOverdue
        ? "<span class=\"overdue-badge\">OVERDUE " + Math.abs(daysLeft) + "d</span>"
        : "<span class=\"due-badge\">DUE IN " + daysLeft + "d</span>";
    return "<div class=\"invoice-item " + (inv.status==="paid"?"paid":isOverdue?"overdue":"") + "\"><div class=\"inv-top\"><div><div class=\"inv-broker-name\">" + inv.broker + "</div><div style=\"margin-top:.2rem;\">" + statusBadge + "</div></div><div class=\"inv-amount\">$" + inv.amount.toLocaleString() + "</div></div><div class=\"inv-meta\">" + (inv.ref?"<span class=\"inv-stat\">Ref: <strong>"+inv.ref+"</strong></span>":"") + "<span class=\"inv-stat\">Invoiced: <strong>" + inv.date + "</strong></span><span class=\"inv-stat\">Due: <strong>" + inv.dueDate + "</strong></span></div><div class=\"inv-actions\">" + (inv.phone?"<button class=\"inv-btn call\" onclick=\"callBroker('" + inv.phone + "','" + inv.broker + "')\">📞 Call</button>":"") + (inv.status!=="paid"?"<button class=\"inv-btn green\" onclick=\"markPaid(" + inv.id + ")\">✓ Mark Paid</button>":"") + "<button class=\"inv-btn red\" onclick=\"removeInvoice(" + inv.id + ")\">✕ Remove</button></div></div>";
  }).join("");
  updateMoneyTotals();
}

// EXPAND LOAD CARD
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
    // Get rate and miles from data attributes
    var rate  = parseInt(panel.dataset.rate  || 0);
    var miles = parseInt(panel.dataset.miles || 0);
    if (rate && miles) {
      recalcPanel(panelId, rate, miles);
    }
  }
}

function recalcPanel(panelId, rate, miles) {
  // Get current defaults
  var fuelPrice = (window._df && window._df.fuelPrice) ? window._df.fuelPrice : defaults.fuelPrice;
  var mpg       = (window._df && window._df.mpg)       ? window._df.mpg       : defaults.mpg;
  var emptyMpg  = defaults.emptyMpg || 8.0;

  // Get deadhead miles from GPS to pickup location
  var panel = document.getElementById(panelId);
  var pickupCity = panel ? (panel.dataset.pickup || "") : "";
  var deadMiles = 0;
  if (pickupCity && window._gpsLat) {
    deadMiles = getDeadheadMiles(pickupCity);
  }
  // Fallback to manual input if GPS not available
  if (!deadMiles) {
    var dhInput = document.getElementById("drop-dead");
    deadMiles = dhInput ? (parseFloat(dhInput.value) || 0) : 0;
  }

  var totalMiles  = miles + deadMiles;
  var loadedFuel  = Math.round((miles / mpg) * fuelPrice);
  var deadFuel    = Math.round((deadMiles / emptyMpg) * fuelPrice);
  var fuelCost    = loadedFuel + deadFuel;
  var net         = rate - fuelCost;
  var npm         = (net / totalMiles).toFixed(2);
  var rpm         = (rate / miles).toFixed(2);

  var tier, verdictText;
  if (parseFloat(rpm) >= 2.30)      { tier = "strong"; verdictText = "✅ Strong — Take It"; }
  else if (parseFloat(rpm) >= 2.00) { tier = "ok";     verdictText = "⚠️ Acceptable — Meets Minimum"; }
  else                               { tier = "weak";   verdictText = "❌ Below Minimum — Skip It"; }

  // Update fuel display
  var fuelEl = document.getElementById("fuel_" + panelId);
  if (fuelEl) {
    fuelEl.textContent = deadMiles > 0
      ? "-$" + fuelCost.toLocaleString() + " (incl. " + deadMiles + "mi DH)"
      : "-$" + fuelCost.toLocaleString();
  }

  // Update net profit
  var netEl = document.getElementById("net_" + panelId);
  if (netEl) {
    netEl.textContent = (net >= 0 ? "$" : "-$") + Math.abs(net).toLocaleString();
    netEl.className = "expand-val " + (net >= 0 ? "green" : "red");
  }

  // Update net/mile
  var npmEl = document.getElementById("npm_" + panelId);
  if (npmEl) {
    npmEl.textContent = "$" + npm + "/mi";
    npmEl.className = "expand-val " + (parseFloat(npm) >= 1.50 ? "green" : "amber");
  }

  // Update verdict
  var verdictEl = document.getElementById("verdict_" + panelId);
  if (verdictEl) {
    verdictEl.textContent = verdictText;
    verdictEl.className = "expand-verdict " + tier;
  }

  // Run deadhead warning
  checkDeadhead(panelId, rate, miles);
}

// BOOK LOAD — moves to Money tab and pre-fills invoice
function bookLoad(btn, origin, dest, rate, miles, broker, phone) {
  // Mark card as booked
  var card = btn.closest(".load-card");
  if (card) {
    card.className = card.className.replace(/hot|watch/, "booked");
    var tags = card.querySelectorAll(".load-tag");
    tags.forEach(function(t) { t.className = "load-tag tag-booked"; t.textContent = "Booked"; });
  }

  // Pre-fill invoice form in Money tab for later
  var brokerField = document.getElementById("inv-broker");
  var amountField = document.getElementById("inv-amount");
  var phoneField  = document.getElementById("inv-phone");
  var refField    = document.getElementById("inv-ref");
  var dateField   = document.getElementById("inv-date");
  if (brokerField) brokerField.value = broker;
  if (amountField) amountField.value = rate;
  if (phoneField)  phoneField.value  = phone;
  if (refField)    refField.value    = origin + " to " + dest;
  if (dateField) {
    var today = new Date();
    dateField.value = today.toISOString().split("T")[0];
  }

  // Show loadback panel — finds return loads based on arrival date
  showLoadback(origin, dest, rate, miles, broker, phone);
}

function addReturnLoad(route, miles, rate) {
  // Parse route into origin/dest
  var parts = route.split(" → ");
  var origin = parts[0] || "";
  var dest   = parts[1] || "";
  var rpm    = (rate / miles).toFixed(2);

  // Create a new load card and prepend to loads tab
  var loadsScreen = document.getElementById("screen-loads");
  var firstCard   = loadsScreen.querySelector(".load-card");

  var panelId = "ret_" + Date.now();
  var fuelCost = Math.round((miles / (defaults.mpg || 6.5)) * (defaults.fuelPrice || 4.25));
  var net = rate - fuelCost;
  var tier = parseFloat(rpm) >= 2.30 ? "strong" : parseFloat(rpm) >= 2.00 ? "ok" : "weak";
  var verdict = tier === "strong" ? "✅ Strong — Take It" : tier === "ok" ? "⚠️ Acceptable" : "❌ Below Minimum";

  var newCard = document.createElement("div");
  newCard.className = "load-card hot";
  newCard.setAttribute("data-rate", rate);
  newCard.setAttribute("data-miles", miles);
  newCard.setAttribute("data-pickup", origin);
  newCard.innerHTML =
    "<div class=\"load-top load-card-clickable\" onclick=\"toggleExpand('"+panelId+"')\">" +
      "<div>" +
        "<div class=\"load-route\">" + origin + " <span>→</span> " + dest + "</div>" +
        "<div style=\"margin-top:.3rem;\"><span class=\"load-tag tag-hot\">Return Load</span></div>" +
      "</div>" +
      "<div><div class=\"load-rate\">$" + rate.toLocaleString() + "</div><div class=\"load-rate-sub\">$" + rpm + "/mi · tap for profit</div></div>" +
    "</div>" +
    "<div class=\"load-meta\">" +
      "<div><div class=\"lm-label\">Miles</div><div class=\"lm-val\">" + miles + "</div></div>" +
      "<div><div class=\"lm-label\">Rate/Mi</div><div class=\"lm-val\">$" + rpm + "</div></div>" +
      "<div><div class=\"lm-label\">Est. Net</div><div class=\"lm-val\">$" + net.toLocaleString() + "</div></div>" +
    "</div>" +
    "<div class=\"load-expand-panel\" id=\""+panelId+"\" data-rate=\""+rate+"\" data-miles=\""+miles+"\" data-pickup=\""+origin+"\">" +
      "<div class=\"expand-profit-grid\">" +
        "<div class=\"expand-stat\"><div class=\"expand-label\">Gross Rate</div><div class=\"expand-val\">$" + rate.toLocaleString() + "</div></div>" +
        "<div class=\"expand-stat\"><div class=\"expand-label\">Est. Fuel</div><div class=\"expand-val red\" id=\"fuel_"+panelId+"\">-$" + fuelCost.toLocaleString() + "</div></div>" +
        "<div class=\"expand-stat\"><div class=\"expand-label\">Net Profit</div><div class=\"expand-val green\" id=\"net_"+panelId+"\">$" + net.toLocaleString() + "</div></div>" +
        "<div class=\"expand-stat\"><div class=\"expand-label\">Miles</div><div class=\"expand-val\">" + miles + "</div></div>" +
      "</div>" +
      "<div class=\"expand-verdict " + tier + "\" id=\"verdict_"+panelId+"\">" + verdict + "</div>" +
      "<div class=\"expand-notes\"><div class=\"expand-label\" style=\"margin-bottom:.3rem;\">📋 Load Notes</div><div class=\"expand-notes-text\" id=\"notes_"+panelId+"\">Return load added from Loadback. Connect Truckstop API for full details.</div></div>" +
    "</div>" +
    "<div class=\"load-actions\">" +
      "<button class=\"load-action-btn call-btn\" onclick=\"callBroker('','Broker')\"><span class=\"btn-icon\">📞</span>Call</button>" +
      "<button class=\"load-action-btn book-btn\" onclick=\"bookLoad(this,'"+origin+"','"+dest+"',"+rate+","+miles+",'Return Broker','')\"><span class=\"btn-icon\">✓</span>Book</button>" +
      "<button class=\"load-action-btn skip-btn\" onclick=\"skipLoad(this)\"><span class=\"btn-icon\">✕</span>Skip</button>" +
    "</div>";

  if (firstCard) {
    loadsScreen.insertBefore(newCard, firstCard);
  } else {
    loadsScreen.appendChild(newCard);
  }

  closeLoadbackDirect();

  // Switch to loads tab
  var loadsBtn = null;
  document.querySelectorAll(".nav-btn").forEach(function(b) {
    if (b.textContent.indexOf("Loads") >= 0) loadsBtn = b;
  });
  showScreen("loads", loadsBtn);
}

function reopenLoadback() {
  if (window._lastLoadback) {
    var l = window._lastLoadback;
    showLoadback(l.origin, l.dest, l.rate, l.miles, l.broker, l.phone);
  } else {
    alert("No recent load booked yet.");
  }
}

function goToInvoice() {
  closeLoadbackDirect();
  var moneyBtn = null;
  document.querySelectorAll(".nav-btn").forEach(function(b) {
    if (b.textContent.indexOf("Money") >= 0) moneyBtn = b;
  });
  showScreen("money", moneyBtn);
  var invCard = document.querySelector("#screen-money .card");
  if (invCard) {
    invCard.style.borderColor = "var(--green)";
    invCard.style.boxShadow = "0 0 12px rgba(94,220,130,0.3)";
    setTimeout(function() {
      invCard.style.borderColor = "";
      invCard.style.boxShadow = "";
    }, 2000);
  }
}

// LOAD NOTES — populated by Truckstop API when connected
// Format: { 'LOAD_ID': 'note text' }
var _loadNotes = {};

function setLoadNotes(panelId, notesText) {
  var el = document.getElementById('notes_' + panelId);
  if (!el) return;
  if (notesText && notesText.trim()) {
    el.textContent = notesText;
    el.classList.add('has-notes');
  } else {
    el.textContent = 'No special notes on this load.';
    el.classList.remove('has-notes');
  }
}

// Called when Truckstop API connects and returns load data
// api_payload = array of { panel_id, notes, origin, dest, rate, miles, broker, phone }
function populateAPILoads(api_payload) {
  api_payload.forEach(function(load) {
    if (load.notes) setLoadNotes(load.panel_id, load.notes);
  });
}

// ══════════════════════════════════════════════════════════════
// WEATHER & ROAD ALERTS
// ══════════════════════════════════════════════════════════════
var WEATHER_CONDITIONS = {
  "WA": [
    { type:"warning", icon:"🌨️", title:"Winter Weather Advisory — Eastern WA", sub:"Snow possible above 2,500ft on US-2 and SR-20. Chain requirements may apply." },
    { type:"clear",   icon:"✅", title:"Roads Clear — I-90 Corridor", sub:"No active alerts for your current region." }
  ],
  "ID": [
    { type:"warning", icon:"❄️", title:"Freezing Rain Advisory — Northern ID", sub:"US-95 and I-90 near Coeur d Alene. Reduce speed, allow extra following distance." }
  ],
  "OR": [
    { type:"clear", icon:"🌤️", title:"Roads Clear — I-84 Corridor", sub:"No active advisories for Oregon routes." }
  ],
  "UT": [
    { type:"warning", icon:"💨", title:"High Wind Warning — I-80 West of SLC", sub:"Winds 45-65 mph gusts. High-profile vehicles advised to use caution." }
  ],
  "TX": [
    { type:"clear", icon:"☀️", title:"Clear Conditions — East Texas", sub:"No active road alerts. Good driving conditions." }
  ],
  "MT": [
    { type:"alert",   icon:"🚨", title:"Blizzard Warning — US-2 & I-15 North", sub:"Whiteout conditions possible. Chain law in effect. Consider delaying travel." }
  ],
  "CO": [
    { type:"warning", icon:"⛰️", title:"Mountain Pass Alert — I-70 Eisenhower Tunnel", sub:"Passenger vehicle traction law in effect. Commercial vehicles require chains." }
  ],
  "NV": [
    { type:"clear", icon:"🌤️", title:"Roads Clear — I-80 Nevada", sub:"No active advisories." }
  ],
  "DEFAULT": [
    { type:"clear", icon:"✅", title:"No Active Road Alerts", sub:"Tap to refresh based on your current GPS location." }
  ]
};

function refreshWeather() {
  var state = window._currentState || "DEFAULT";
  var conditions = WEATHER_CONDITIONS[state] || WEATHER_CONDITIONS["DEFAULT"];
  var main = conditions[0];

  // Update main row
  document.getElementById("weather-icon").textContent = main.icon;
  document.getElementById("weather-title").textContent = main.title;
  document.getElementById("weather-sub").textContent = main.sub;

  var mainRow = document.getElementById("weather-main");
  mainRow.className = "weather-row " + (main.type === "alert" ? "alert" : main.type === "warning" ? "warning" : "clear");

  // Update time
  var now = new Date();
  document.getElementById("weather-time").textContent = now.getHours() + ":" + String(now.getMinutes()).padStart(2,"0");

  // Additional alerts
  var alertsEl = document.getElementById("weather-alerts");
  if (conditions.length > 1) {
    alertsEl.innerHTML = conditions.slice(1).map(function(c) {
      return "<div class=\"weather-row " + c.type + "\"><span class=\"weather-icon\">" + c.icon + "</span><div class=\"weather-text\"><div class=\"weather-title\">" + c.title + "</div><div class=\"weather-sub\">" + c.sub + "</div></div></div>";
    }).join("");
  } else {
    alertsEl.innerHTML = "";
  }
}

// Called from GPS when state is identified
function updateWeatherForState(stateCode) {
  window._currentState = stateCode;
  refreshWeather();
}

// ══════════════════════════════════════════════════════════════
// DEADHEAD ALERT
// ══════════════════════════════════════════════════════════════
function checkDeadhead(panelId, rate, miles) {
  var el = document.getElementById("dh_" + panelId);
  if (!el) return;

  var deadInput = document.getElementById("drop-dead");
  var deadMiles = deadInput ? parseFloat(deadInput.value) || 0 : 0;

  // If no deadhead entered use 0 — user can set in nearest load finder
  if (deadMiles <= 0) {
    el.className = "deadhead-alert";
    return;
  }

  var fuelPrice = window._df ? window._df.fuelPrice : 4.25;
  var emptyMpg  = defaults.emptyMpg || 8.0;
  var deadCost  = Math.round((deadMiles / emptyMpg) * fuelPrice);
  var pct       = Math.round((deadMiles / miles) * 100);

  var tier, msg;
  if (pct <= 10) {
    tier = "ok";
    msg  = "✅ Deadhead " + deadMiles + " mi (-$" + deadCost + ") — Acceptable at " + pct + "% of loaded miles";
  } else if (pct <= 20) {
    tier = "warn";
    msg  = "⚠️ Deadhead " + deadMiles + " mi (-$" + deadCost + ") — " + pct + "% of loaded miles, eating margin";
  } else {
    tier = "danger";
    msg  = "🚨 Deadhead " + deadMiles + " mi (-$" + deadCost + ") — " + pct + "% of loaded miles. Negotiate higher rate or pass.";
  }

  el.className = "deadhead-alert show " + tier;
  el.textContent = msg;
}

// ══════════════════════════════════════════════════════════════
// MAINTENANCE TRACKER
// ══════════════════════════════════════════════════════════════
// Default maintenance items — realistic costs for Class 8 semi
// Users update these with their actual odometer and costs
// Saved to Supabase when user edits
var maintItems = [
  { name:"Oil Change",        lastOdo:487000, interval:15000,  cost:650,  currentOdo:495000 },
  { name:"Tire Rotation",     lastOdo:485000, interval:25000,  cost:200,  currentOdo:495000 },
  { name:"Annual DOT Inspect",lastOdo:470000, interval:100000, cost:450,  currentOdo:495000 },
  { name:"DPF Cleaning",      lastOdo:450000, interval:100000, cost:1200, currentOdo:495000 },
  { name:"Brake Inspection",  lastOdo:480000, interval:30000,  cost:350,  currentOdo:495000 },
];

// ── Load maintenance items from Supabase ──────────────────────
async function loadMaintItems() {
  if (!window._rcUserId) return;
  try {
    var { data, error } = await _supabase
      .from('maintenance')
      .select('*')
      .eq('user_id', window._rcUserId);
    if (error || !data || !data.length) return;
    // Replace defaults with user saved items
    maintItems = data.map(function(row) {
      return {
        name:       row.name,
        lastOdo:    row.last_odo,
        interval:   row.interval_miles,
        cost:       row.cost,
        currentOdo: row.current_odo
      };
    });
    renderMaint();
  } catch(err) {
    console.error('Error loading maintenance:', err);
  }
}

// ── Save maintenance item to Supabase ─────────────────────────
async function saveMaintItemToSupabase(item) {
  if (!window._rcUserId) return;
  try {
    // Upsert based on user_id + name
    await _supabase.from('maintenance').upsert({
      user_id:        window._rcUserId,
      name:           item.name,
      last_odo:       item.lastOdo,
      interval_miles: item.interval,
      cost:           item.cost,
      current_odo:    item.currentOdo
    }, { onConflict: 'user_id,name' });
  } catch(err) {
    console.error('Error saving maintenance:', err);
  }
}

function renderMaint() {
  var list = document.getElementById("maint-list");
  if (!list) return;

  var totalCPM = 0;
  list.innerHTML = maintItems.map(function(item) {
    var milesSince  = item.currentOdo - item.lastOdo;
    var milesLeft   = item.interval - milesSince;
    var pct         = Math.min(100, Math.round((milesSince / item.interval) * 100));
    var cpm         = (item.cost / item.interval).toFixed(3);
    totalCPM       += parseFloat(cpm);

    var tier, barColor;
    var status;
    if (milesLeft < 0) {
      tier = "overdue"; barColor = "red";
      status = "OVERDUE " + Math.abs(milesLeft).toLocaleString() + " mi";
    } else if (milesLeft < item.interval * 0.15) {
      tier = "soon"; barColor = "amber";
      status = "DUE IN " + milesLeft.toLocaleString() + " mi";
    } else {
      tier = "good"; barColor = "green";
      status = "GOOD — " + milesLeft.toLocaleString() + " mi left";
    }

    return "<div class=\"maint-item\">" +
      "<div class=\"maint-top\">" +
        "<div class=\"maint-name\">" + item.name + "</div>" +
        "<span class=\"maint-status " + tier + "\">" + status + "</span>" +
      "</div>" +
      "<div class=\"maint-bar-wrap\"><div class=\"maint-bar " + barColor + "\" style=\"width:" + pct + "%\"></div></div>" +
      "<div class=\"maint-stats\">" +
        "<span class=\"maint-stat\">Last: <strong>" + item.lastOdo.toLocaleString() + " mi</strong></span>" +
        "<span class=\"maint-stat\">Interval: <strong>" + item.interval.toLocaleString() + " mi</strong></span>" +
        "<span class=\"maint-stat\">Cost/mi: <strong>$" + cpm + "</strong></span>" +
        "<span class=\"maint-stat\">Est. Cost: <strong>$" + item.cost.toLocaleString() + "</strong></span>" +
      "</div>" +
    "</div>";
  }).join("");

  var cpmEl = document.getElementById("maint-cpm");
  if (cpmEl) cpmEl.textContent = "$" + totalCPM.toFixed(3) + "/mi";

  // Update defaults cost per mile
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

  var item = { name:name, lastOdo:lastOdo, interval:interval, cost:cost, currentOdo:currOdo || lastOdo + 1000 };
  if (existing >= 0) {
    maintItems[existing] = item;
  } else {
    maintItems.push(item);
  }

  renderMaint();
  saveMaintItemToSupabase(item);
  document.getElementById("maint-last-odo").value = "";
  document.getElementById("maint-interval").value = "";
  document.getElementById("maint-cost").value = "";
  document.getElementById("maint-current-odo").value = "";
  alert(name + " saved!");
}

// ══════════════════════════════════════════════════════════════
// GPS-BASED DEADHEAD CALCULATOR
// ══════════════════════════════════════════════════════════════
// City coordinates for common pickup locations
var CITY_COORDS = {
  "moses lake":      [47.1301, -119.2780],
  "pasco":           [46.2396, -119.1006],
  "kennewick":       [46.2112, -119.1372],
  "richland":        [46.2859, -119.2845],
  "yakima":          [46.6021, -120.5059],
  "spokane":         [47.6588, -117.4260],
  "wenatchee":       [47.4235, -120.3103],
  "ellensburg":      [46.9965, -120.5478],
  "walla walla":     [46.0646, -118.3430],
  "tri cities":      [46.2396, -119.1006],
  "portland":        [45.5051, -122.6750],
  "seattle":         [47.6062, -122.3321],
  "boise":           [43.6150, -116.2023],
  "salt lake city":  [40.7608, -111.8910],
  "las vegas":       [36.1699, -115.1398],
  "denver":          [39.7392, -104.9903],
  "phoenix":         [33.4484, -112.0740],
  "los angeles":     [34.0522, -118.2437],
  "sacramento":      [38.5816, -121.4944],
  "reno":            [39.5296, -119.8138],
  "billings":        [45.7833, -108.5007],
  "missoula":        [46.8721, -113.9940],
  "great falls":     [47.5002, -111.3008],
  "albuquerque":     [35.0844, -106.6504],
  "el paso":         [31.7619, -106.4850],
  "dallas":          [32.7767, -96.7970],
  "fort worth":      [32.7555, -97.3308],
  "houston":         [29.7604, -95.3698],
  "san antonio":     [29.4241, -98.4936],
  "kilgore":         [32.3888, -94.8757],
  "longview":        [32.5007, -94.7405],
  "tyler":           [32.3513, -95.3011],
  "oklahoma city":   [35.4676, -97.5164],
  "kansas city":     [39.0997, -94.5786],
  "omaha":           [41.2565, -95.9345],
  "minneapolis":     [44.9778, -93.2650],
  "chicago":         [41.8781, -87.6298],
  "coeur dalene":    [47.6777, -116.7805],
  "lewiston":        [46.4165, -117.0177],
  "twin falls":      [42.5629, -114.4609],
  "pocatello":       [42.8713, -112.4455],
};

// Haversine formula — returns miles between two lat/lon points
function haversineMiles(lat1, lon1, lat2, lon2) {
  var R = 3958.8; // Earth radius in miles
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLon = (lon2 - lon1) * Math.PI / 180;
  var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
          Math.sin(dLon/2) * Math.sin(dLon/2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return Math.round(R * c * 1.15); // 1.15 = road vs straight-line factor
}

// Get deadhead miles from current GPS to a pickup city
function getDeadheadMiles(pickupCity) {
  if (!window._gpsLat || !window._gpsLon) return 0;
  var key = pickupCity.toLowerCase().split(",")[0].trim();
  // Try exact match first
  var coords = CITY_COORDS[key];
  // Try partial match
  if (!coords) {
    var keys = Object.keys(CITY_COORDS);
    for (var i = 0; i < keys.length; i++) {
      if (key.indexOf(keys[i]) >= 0 || keys[i].indexOf(key) >= 0) {
        coords = CITY_COORDS[keys[i]];
        break;
      }
    }
  }
  if (!coords) return 0;
  return haversineMiles(window._gpsLat, window._gpsLon, coords[0], coords[1]);
}

// ══════════════════════════════════════════════════════════════
// LOADBACK — Return Load Finder with Arrival Date Calculation
// ══════════════════════════════════════════════════════════════

// Extended return loads database with pickup availability windows
var RETURN_LOADS = {
  "pasco": [
    { route:"Pasco, WA → Moses Lake, WA",         dest:"Moses Lake, WA",   miles:82,   rate:205,  rpm:2.50, avail:"same day",    commodity:"General",  broker:"CH Robinson",    phone:"(800) 323-7587" },
    { route:"Pasco, WA → Spokane, WA",             dest:"Spokane, WA",      miles:143,  rate:350,  rpm:2.45, avail:"same day",    commodity:"General",  broker:"Echo Global",     phone:"(800) 354-7993" },
    { route:"Pasco, WA → Portland, OR",            dest:"Portland, OR",     miles:215,  rate:505,  rpm:2.35, avail:"next day",    commodity:"Ag Equip" },
    { route:"Pasco, WA → Yakima, WA",              dest:"Yakima, WA",       miles:75,   rate:188,  rpm:2.50, avail:"same day",    commodity:"General" },
    { route:"Pasco, WA → Boise, ID",               dest:"Boise, ID",        miles:298,  rate:685,  rpm:2.30, avail:"next day",    commodity:"General" },
  ],
  "boise": [
    { route:"Boise, ID → Moses Lake, WA",          dest:"Moses Lake, WA",   miles:302,  rate:695,  rpm:2.30, avail:"next day",    commodity:"General",  broker:"Coyote",          phone:"(888) 264-8980" },
    { route:"Boise, ID → Salt Lake City, UT",      dest:"Salt Lake City, UT",miles:340, rate:782,  rpm:2.30, avail:"same day",    commodity:"General" },
    { route:"Boise, ID → Portland, OR",            dest:"Portland, OR",     miles:428,  rate:940,  rpm:2.20, avail:"next day",    commodity:"Lumber" },
    { route:"Boise, ID → Spokane, WA",             dest:"Spokane, WA",      miles:305,  rate:700,  rpm:2.30, avail:"same day",    commodity:"General" },
    { route:"Boise, ID → Seattle, WA",             dest:"Seattle, WA",      miles:498,  rate:1195, rpm:2.40, avail:"2 days out",  commodity:"Produce" },
  ],
  "salt lake city": [
    { route:"Salt Lake City, UT → Moses Lake, WA", dest:"Moses Lake, WA",   miles:710,  rate:1633, rpm:2.30, avail:"next day",    commodity:"General",  broker:"XPO Logistics",   phone:"(800) 742-5727" },
    { route:"Salt Lake City, UT → Las Vegas, NV",  dest:"Las Vegas, NV",    miles:421,  rate:1050, rpm:2.49, avail:"same day",    commodity:"General" },
    { route:"Salt Lake City, UT → Boise, ID",      dest:"Boise, ID",        miles:340,  rate:820,  rpm:2.41, avail:"same day",    commodity:"Steel" },
    { route:"Salt Lake City, UT → Denver, CO",     dest:"Denver, CO",       miles:525,  rate:1155, rpm:2.20, avail:"2 days out",  commodity:"General" },
    { route:"Salt Lake City, UT → Portland, OR",   dest:"Portland, OR",     miles:778,  rate:1789, rpm:2.30, avail:"2 days out",  commodity:"Ag Equip" },
  ],
  "portland": [
    { route:"Portland, OR → Moses Lake, WA",       dest:"Moses Lake, WA",   miles:230,  rate:530,  rpm:2.30, avail:"same day",    commodity:"General" },
    { route:"Portland, OR → Boise, ID",            dest:"Boise, ID",        miles:428,  rate:1005, rpm:2.35, avail:"next day",    commodity:"General" },
    { route:"Portland, OR → Sacramento, CA",       dest:"Sacramento, CA",   miles:580,  rate:1392, rpm:2.40, avail:"next day",    commodity:"Produce" },
    { route:"Portland, OR → Seattle, WA",          dest:"Seattle, WA",      miles:178,  rate:445,  rpm:2.50, avail:"same day",    commodity:"General" },
    { route:"Portland, OR → Spokane, WA",          dest:"Spokane, WA",      miles:350,  rate:805,  rpm:2.30, avail:"same day",    commodity:"Steel" },
  ],
  "spokane": [
    { route:"Spokane, WA → Moses Lake, WA",        dest:"Moses Lake, WA",   miles:100,  rate:250,  rpm:2.50, avail:"same day",    commodity:"General" },
    { route:"Spokane, WA → Boise, ID",             dest:"Boise, ID",        miles:305,  rate:700,  rpm:2.30, avail:"same day",    commodity:"General" },
    { route:"Spokane, WA → Portland, OR",          dest:"Portland, OR",     miles:350,  rate:805,  rpm:2.30, avail:"next day",    commodity:"Lumber" },
    { route:"Spokane, WA → Seattle, WA",           dest:"Seattle, WA",      miles:280,  rate:645,  rpm:2.30, avail:"same day",    commodity:"General" },
    { route:"Spokane, WA → Salt Lake City, UT",    dest:"Salt Lake City, UT",miles:710, rate:1633, rpm:2.30, avail:"2 days out",  commodity:"General" },
  ],
  "kennewick": [
    { route:"Kennewick, WA → Moses Lake, WA",      dest:"Moses Lake, WA",   miles:90,   rate:225,  rpm:2.50, avail:"same day",    commodity:"General" },
    { route:"Kennewick, WA → Portland, OR",        dest:"Portland, OR",     miles:210,  rate:483,  rpm:2.30, avail:"same day",    commodity:"Ag Equip" },
    { route:"Kennewick, WA → Boise, ID",           dest:"Boise, ID",        miles:300,  rate:690,  rpm:2.30, avail:"next day",    commodity:"General" },
    { route:"Kennewick, WA → Seattle, WA",         dest:"Seattle, WA",      miles:225,  rate:518,  rpm:2.30, avail:"same day",    commodity:"General" },
    { route:"Kennewick, WA → Yakima, WA",          dest:"Yakima, WA",       miles:85,   rate:210,  rpm:2.47, avail:"same day",    commodity:"Produce" },
  ],
  "yakima": [
    { route:"Yakima, WA → Moses Lake, WA",         dest:"Moses Lake, WA",   miles:110,  rate:275,  rpm:2.50, avail:"same day",    commodity:"General" },
    { route:"Yakima, WA → Portland, OR",           dest:"Portland, OR",     miles:200,  rate:460,  rpm:2.30, avail:"same day",    commodity:"Produce" },
    { route:"Yakima, WA → Seattle, WA",            dest:"Seattle, WA",      miles:145,  rate:334,  rpm:2.30, avail:"same day",    commodity:"General" },
    { route:"Yakima, WA → Boise, ID",              dest:"Boise, ID",        miles:330,  rate:759,  rpm:2.30, avail:"next day",    commodity:"General" },
  ],
  "las vegas": [
    { route:"Las Vegas, NV → Los Angeles, CA",     dest:"Los Angeles, CA",  miles:270,  rate:621,  rpm:2.30, avail:"same day",    commodity:"General" },
    { route:"Las Vegas, NV → Salt Lake City, UT",  dest:"Salt Lake City, UT",miles:421, rate:969,  rpm:2.30, avail:"same day",    commodity:"General" },
    { route:"Las Vegas, NV → Phoenix, AZ",         dest:"Phoenix, AZ",      miles:297,  rate:683,  rpm:2.30, avail:"same day",    commodity:"General" },
  ],
  "kilgore": [
    { route:"Kilgore, TX → Dallas, TX",            dest:"Dallas, TX",       miles:130,  rate:325,  rpm:2.50, avail:"same day",    commodity:"General" },
    { route:"Kilgore, TX → Houston, TX",           dest:"Houston, TX",      miles:220,  rate:506,  rpm:2.30, avail:"same day",    commodity:"Oilfield" },
    { route:"Kilgore, TX → Oklahoma City, OK",     dest:"Oklahoma City, OK",miles:340,  rate:782,  rpm:2.30, avail:"next day",    commodity:"General" },
    { route:"Kilgore, TX → Memphis, TN",           dest:"Memphis, TN",      miles:530,  rate:1219, rpm:2.30, avail:"2 days out",  commodity:"General" },
  ],
  "denver": [
    { route:"Denver, CO → Salt Lake City, UT",     dest:"Salt Lake City, UT",miles:525, rate:1208, rpm:2.30, avail:"same day",    commodity:"General" },
    { route:"Denver, CO → Kansas City, MO",        dest:"Kansas City, MO",  miles:600,  rate:1380, rpm:2.30, avail:"next day",    commodity:"General" },
    { route:"Denver, CO → Albuquerque, NM",        dest:"Albuquerque, NM",  miles:450,  rate:1035, rpm:2.30, avail:"same day",    commodity:"General" },
  ],
};

// Estimate arrival date/time based on miles and current time
function calcArrival(miles, startDate, availHOS) {
  // FMCSA HOS Rules for property-carrying drivers (single driver):
  // - Max 11 hours driving in a 14-hour on-duty window
  // - Must take 10-hour off-duty break before starting a new 14-hour window
  // - 30-minute break required after 8 cumulative hours of driving
  //
  // availHOS = hours of drive time currently available (default 11 if fresh)

  var AVG_SPEED     = 55;    // mph
  var MAX_DRIVE     = 11;    // max driving hours per shift
  var BREAK_WINDOW  = 8;     // must take 30-min break after this many hours driving
  var BREAK_TIME    = 0.5;   // 30-minute mandatory break (hours)
  var RESET_TIME    = 10;    // 10-hour mandatory off-duty reset
  var MAX_WINDOW    = 14;    // 14-hour on-duty window

  var hosAvail = (availHOS !== undefined) ? availHOS : MAX_DRIVE;
  var now      = startDate ? new Date(startDate) : new Date();
  var current  = new Date(now.getTime());

  var milesLeft    = miles;
  var driveAccum   = 0;      // drive hours accumulated in current shift
  var windowUsed   = 0;      // total on-duty hours in current 14-hr window
  var breakTaken   = false;  // has the 30-min break been taken this shift

  // Cap available HOS to max drive time
  var shiftDriveLeft = Math.min(hosAvail, MAX_DRIVE);

  while (milesLeft > 0) {
    // How many hours can we drive before next mandatory stop?
    var tillBreak  = breakTaken ? (MAX_DRIVE - driveAccum) : (BREAK_WINDOW - driveAccum);
    var tillShift  = shiftDriveLeft - driveAccum;
    var tillWindow = (MAX_WINDOW - windowUsed);

    // Effective drive time available this segment
    var driveSegment = Math.min(tillBreak, tillShift, tillWindow);
    driveSegment = Math.max(driveSegment, 0);

    if (driveSegment <= 0) {
      // Need a break or reset
      if (!breakTaken && driveAccum >= BREAK_WINDOW) {
        // Take mandatory 30-min break
        current = new Date(current.getTime() + BREAK_TIME * 3600000);
        windowUsed += BREAK_TIME;
        breakTaken = true;
      } else {
        // Take full 10-hour reset
        current = new Date(current.getTime() + RESET_TIME * 3600000);
        driveAccum   = 0;
        windowUsed   = 0;
        shiftDriveLeft = MAX_DRIVE;
        breakTaken   = false;
      }
      continue;
    }

    // Drive the segment
    var milesCovered = driveSegment * AVG_SPEED;
    if (milesCovered >= milesLeft) {
      // Final segment — only drive what we need
      var finalDriveTime = milesLeft / AVG_SPEED;
      current    = new Date(current.getTime() + finalDriveTime * 3600000);
      driveAccum += finalDriveTime;
      windowUsed += finalDriveTime;
      milesLeft  = 0;
    } else {
      current    = new Date(current.getTime() + driveSegment * 3600000);
      driveAccum += driveSegment;
      windowUsed += driveSegment;
      milesLeft  -= milesCovered;
    }
  }

  return current;
}

function formatArrival(date) {
  var days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  var hrs = date.getHours();
  var mins = String(date.getMinutes()).padStart(2,"0");
  var ampm = hrs >= 12 ? "PM" : "AM";
  hrs = hrs % 12 || 12;
  return days[date.getDay()] + " " + months[date.getMonth()] + " " + date.getDate() + " · " + hrs + ":" + mins + " " + ampm;
}

function availToDate(avail, arrivalDate) {
  var d = new Date(arrivalDate);
  if (avail === "same day") return d;
  if (avail === "next day") { d.setDate(d.getDate() + 1); return d; }
  if (avail === "2 days out") { d.setDate(d.getDate() + 2); return d; }
  return d;
}

function closeLoadback(e) {
  if (e && e.target !== document.getElementById("loadback-panel")) return;
  document.getElementById("loadback-panel").classList.remove("open");
}

function closeLoadbackDirect() {
  document.getElementById("loadback-panel").classList.remove("open");
}

function showLoadback(origin, dest, rate, miles, broker, phone) {
  // Store for reopen
  window._lastLoadback = { origin:origin, dest:dest, rate:rate, miles:miles, broker:broker, phone:phone };
  var panel = document.getElementById("loadback-panel");
  var lbContent = document.getElementById("loadback-content");

  // Calculate arrival at destination
  var now = new Date();
  // Default to fresh HOS (11 hours available) — will update when HOS tab is connected
  var hosAvail = window._hosAvailable || 11;
  var arrival  = calcArrival(miles, now, hosAvail);
  var arrivalStr = formatArrival(arrival);
  var totalCalendarHrs = Math.round((arrival - now) / 3600000 * 10) / 10;
  var driveOnlyHrs = Math.round((miles / 55) * 10) / 10;
  var hosBreaks = totalCalendarHrs - driveOnlyHrs;
  var hosNote = hosBreaks > 0
    ? "Includes ~" + hosBreaks.toFixed(1) + " hrs of required HOS breaks"
    : "No HOS breaks required for this run";

  // Calculate net on booked load
  var fuelPrice = defaults.fuelPrice || 4.25;
  var mpg = defaults.mpg || 6.5;
  var fuelCost = Math.round((miles / mpg) * fuelPrice);
  var net = rate - fuelCost;

  // Find return loads from destination
  var destKey = dest.toLowerCase().split(",")[0].trim();
  var returnLoads = null;
  var keys = Object.keys(RETURN_LOADS);
  for (var k = 0; k < keys.length; k++) {
    if (destKey.indexOf(keys[k]) >= 0 || keys[k].indexOf(destKey) >= 0) {
      returnLoads = RETURN_LOADS[keys[k]];
      break;
    }
  }
  if (!returnLoads) returnLoads = NEARBY_LOADS["default"] || [];

  // Filter loads that are available on or after arrival date
  // and calculate round-trip profit
  var scoredLoads = returnLoads.map(function(l) {
    var availDate = availToDate(l.avail, arrival);
    var returnFuel = Math.round((l.miles / mpg) * fuelPrice);
    var returnNet = l.rate - returnFuel;
    var roundTripNet = net + returnNet;
    var daysOut = Math.round((availDate - now) / (1000*60*60*24));
    return Object.assign({}, l, {
      availDate: availDate,
      availStr: formatArrival(availDate),
      returnNet: returnNet,
      roundTripNet: roundTripNet,
      daysOut: daysOut
    });
  }).filter(function(l) {
    return l.availDate >= new Date(arrival.getTime() - 2*60*60*1000); // within 2hrs before arrival
  }).sort(function(a,b) {
    return b.roundTripNet - a.roundTripNet; // best round trip profit first
  });

  var bestLoad = scoredLoads[0];

  var loadsHtml = scoredLoads.length > 0
    ? scoredLoads.map(function(l, i) {
        var isBest = i === 0;
        return "<div class=\"loadback-card " + (isBest?"best":"") + "\">" +
          "<div class=\"loadback-card-top\">" +
            "<div class=\"loadback-route\">" + l.route + (isBest?"<span class=\"loadback-best-badge\">BEST</span>":"") + "</div>" +
            "<div class=\"loadback-rate\">$" + l.rate.toLocaleString() + "</div>" +
          "</div>" +
          "<div class=\"loadback-stats\">" +
            "<span class=\"loadback-stat\">Miles: <strong>" + l.miles + "</strong></span>" +
            "<span class=\"loadback-stat\">RPM: <strong>$" + l.rpm.toFixed(2) + "</strong></span>" +
            "<span class=\"loadback-stat\">Net: <strong>$" + l.returnNet.toLocaleString() + "</strong></span>" +
            "<span class=\"loadback-stat\">Round Trip: <strong style=\"color:var(--green)\">$" + l.roundTripNet.toLocaleString() + "</strong></span>" +
          "</div>" +
          "<div class=\"loadback-date\">📅 Available: " + l.availStr + " · " + l.commodity + "</div>" +
          "<div class=\"lb-actions\">" +
            (l.phone ? "<button class=\"lb-call-btn\" onclick=\"callBroker('"+l.phone+"','"+l.broker+"')\" >📞 Call " + l.broker + "</button>" : "") +
            "<button class=\"lb-book-btn\" onclick=\"addReturnLoad('"+l.route+"',"+l.miles+","+l.rate+")\">✓ Add to Loads</button>" +
          "</div>" +
        "</div>";
      }).join("")
    : "<div class=\"alert alert-amber\"><div class=\"alert-icon\">⚠️</div><div>No return loads found in database for " + dest + ". Connect Truckstop API for live loads.</div></div>";

  lbContent.innerHTML =
    "<div class=\"loadback-summary\">" +
      "<div class=\"loadback-summary-row\"><span>Booked Load</span><strong>" + origin + " → " + dest + "</strong></div>" +
      "<div class=\"loadback-summary-row\"><span>Broker</span><strong>" + broker + "</strong></div>" +
      "<div class=\"loadback-summary-row\"><span>Miles</span><strong>" + miles + " mi</strong></div>" +
      "<div class=\"loadback-summary-row\"><span>Gross Rate</span><strong>$" + rate.toLocaleString() + "</strong></div>" +
      "<div class=\"loadback-summary-row highlight\"><span>Net After Fuel</span><strong>$" + net.toLocaleString() + "</strong></div>" +
    "</div>" +
    "<div class=\"loadback-arrival\">" +
      "🕐 Estimated arrival at <strong>" + dest + "</strong>: <strong>" + arrivalStr + "</strong><br>" +
      "<span style=\"font-size:.78rem;opacity:.8;\">" + miles + " mi · " + driveOnlyHrs + " hrs drive · " + hosNote + "</span><br>" +
      "<span style=\"font-size:.75rem;opacity:.65;color:#ffd04d;\">HOS: 11hr drive / 14hr window / 10hr reset rule applied</span>" +
    "</div>" +
    "<div class=\"loadback-section-title\">Return Loads Available From " + dest + "</div>" +
    loadsHtml +
    "<button class=\"btn btn-green\" onclick=\"goToInvoice()\" style=\"margin-top:.5rem;\">📋 Log Invoice in Money Tab →</button><div style=\"height:1rem;\"></div>";

  panel.classList.add("open");
}

// ─── EIA REGION MAP ───────────────────────────────────────────────
// Maps US states to EIA petroleum district names & display labels
const STATE_REGION = {
  WA:'West Coast', OR:'West Coast', CA:'West Coast', NV:'West Coast', AZ:'West Coast',
  ID:'Rocky Mountain', MT:'Rocky Mountain', WY:'Rocky Mountain', UT:'Rocky Mountain', CO:'Rocky Mountain',
  ND:'Midwest', SD:'Midwest', NE:'Midwest', KS:'Midwest', MN:'Midwest',
  IA:'Midwest', MO:'Midwest', WI:'Midwest', IL:'Midwest', MI:'Midwest',
  IN:'Midwest', OH:'Midwest', OK:'Gulf Coast', TX:'Gulf Coast', LA:'Gulf Coast',
  MS:'Gulf Coast', AL:'Gulf Coast', AR:'Gulf Coast', NM:'Rocky Mountain',
  FL:'East Coast', GA:'East Coast', SC:'East Coast', NC:'East Coast',
  VA:'East Coast', WV:'East Coast', MD:'East Coast', DE:'East Coast',
  PA:'East Coast', NJ:'East Coast', NY:'East Coast', CT:'East Coast',
  RI:'East Coast', MA:'East Coast', VT:'East Coast', NH:'East Coast', ME:'East Coast',
  TN:'East Coast', KY:'East Coast',
};

// Approximate diesel prices by region (fallback if API fails)
// Updated weekly — EIA data
const REGION_FALLBACK = {
  'West Coast': 4.71,
  'Rocky Mountain': 4.22,
  'Midwest': 3.98,
  'Gulf Coast': 3.82,
  'East Coast': 4.15,
  'Unknown': 4.25,
};

let currentRegion = 'Unknown';
let currentState  = '';
let currentCity   = '';

// ─── GPS LOCATION ─────────────────────────────────────────────────
function startGPS() {
  const gpsBox  = document.getElementById('gps-box');
  const gpsDot  = document.getElementById('gps-dot');
  const gpsVal  = document.getElementById('gps-value');
  const gpsSub  = document.getElementById('gps-sub');

  if (!navigator.geolocation) {
    gpsVal.textContent = 'Not Available';
    gpsSub.textContent = 'GPS not supported';
    gpsDot.className = 'live-dot red';
    gpsBox.className = 'live-box error';
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const lat = pos.coords.latitude.toFixed(4);
      const lon = pos.coords.longitude.toFixed(4);
      document.getElementById('coords-display').textContent = lat + ', ' + lon;
      // Store globally for deadhead calculations
      window._gpsLat = parseFloat(lat);
      window._gpsLon = parseFloat(lon);

      // Reverse geocode using free nominatim API
      try {
        const r = await fetch(
          'https://nominatim.openstreetmap.org/reverse?format=json&lat=' + lat + '&lon=' + lon,
          { headers: { 'Accept-Language': 'en' } }
        );
        const d = await r.json();
        const addr = d.address || {};
        // Nominatim returns state as ISO3166-2-lvl4 = 'US-WA' format on mobile
        var iso = addr['ISO3166-2-lvl4'] || '';
        var state_code = iso ? iso.split('-').pop().toUpperCase() : (addr.state_code || '').toUpperCase();
        const city = addr.city || addr.town || addr.village || addr.county || '';
        const state = addr.state || '';
        currentState = state_code;
        currentCity  = city;

        // Update region
        currentRegion = STATE_REGION[state_code] || 'Unknown';
        updateWeatherForState(state_code);
        document.getElementById('region-display').textContent = city ? city + ', ' + state : state;
        document.getElementById('eia-region').textContent = currentRegion;

        // Update GPS display
        gpsVal.textContent = city || state;
        gpsSub.textContent = state + ' · ' + currentRegion + ' Region';
        // Refresh all open panels with new GPS-based deadhead
        document.querySelectorAll('.load-expand-panel.open').forEach(function(p) {
          var pid = p.id;
          var r = parseInt(p.dataset.rate || 0);
          var m = parseInt(p.dataset.miles || 0);
          if (r && m) recalcPanel(pid, r, m);
        });
        gpsDot.className = 'live-dot green';
        gpsBox.className = 'live-box connected';

        // Now fetch fuel price for this region
        fetchFuelPrice(currentRegion);

      } catch(e) {
        gpsVal.textContent = lat + '°N ' + Math.abs(lon) + '°W';
        gpsSub.textContent = 'Location found · geocode unavailable';
        gpsDot.className = 'live-dot green';
        gpsBox.className = 'live-box connected';
        fetchFuelPrice('Unknown');
      }
    },
    (err) => {
      gpsVal.textContent = 'Access Denied';
      gpsSub.textContent = 'Tap Allow when prompted';
      gpsDot.className = 'live-dot red';
      gpsBox.className = 'live-box error';
      // Still fetch national average fuel price
      fetchFuelPrice('Unknown');
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
  );
}

// ─── EIA FUEL PRICE ───────────────────────────────────────────────
async function fetchFuelPrice(region) {
  // Check crowdsourced prices first if GPS available
  if (window._gpsLat && window._gpsLon) {
    var crowdResult = await fetchCrowdFuelPrice(window._gpsLat, window._gpsLon);
    if (crowdResult && crowdResult.count >= 3) {
      updateFuelDisplay(crowdResult.price, crowdResult.count);
      return; // Use crowd data, skip EIA
    }
  }
  const fuelBox  = document.getElementById('fuel-box');
  const fuelDot  = document.getElementById('fuel-dot');
  const fuelVal  = document.getElementById('fuel-value');
  const fuelSub  = document.getElementById('fuel-sub');
  const fuelUpd  = document.getElementById('fuel-updated');

  // EIA API — free, no key needed for series data
  // We use the weekly retail diesel price series
  // PADD regions: 1=East Coast, 2=Midwest, 3=Gulf, 4=Rocky Mtn, 5=West Coast
  // EIA PADD regional diesel series
  const PADD = {
    'East Coast':      'EMD_EPD2D_PTE_R10_DPG',
    'Midwest':         'EMD_EPD2D_PTE_R20_DPG',
    'Gulf Coast':      'EMD_EPD2D_PTE_R30_DPG',
    'Rocky Mountain':  'EMD_EPD2D_PTE_R40_DPG',
    'West Coast':      'EMD_EPD2D_PTE_R50_DPG',
    'Unknown':         'EMD_EPD2D_PTE_NUS_DPG',
  };

  const seriesId = PADD[region] || PADD['Unknown'];
  const isStatLevel = false;
  const url = 'https://api.eia.gov/v2/petroleum/pri/gnd/data/?frequency=weekly&data[0]=value&facets[series][]=' + seriesId + '&sort[0][column]=period&sort[0][direction]=desc&offset=0&length=1&api_key=2kWPj1CuJO5R9mve6S0C45KtGxk8HGpSFE3EiXGF';

  try {
    const r = await fetch(url);
    const d = await r.json();
    const rows = d?.response?.data;
    if (rows && rows.length > 0) {
      const price = parseFloat(rows[0].value);
      const period = rows[0].period || '';
      defaults.fuelPrice = price;
      fuelVal.textContent = '$' + price.toFixed(3) + '/gal';
      fuelSub.textContent = region + ' Region · EIA Live';
      fuelDot.className = 'live-dot green';
      fuelBox.className = 'live-box connected';
      if (fuelUpd) fuelUpd.textContent = 'Week of ' + period;
      // Refresh all profit bars with new price
      injectProfitBars();
      // Also update the calculator default input
      const calcFuel = document.getElementById('calc-fuel');
      if (calcFuel) calcFuel.value = price.toFixed(2);
    } else {
      throw new Error('No data');
    }
  } catch(e) {
    // Fall back to regional estimate
    const fallback = REGION_FALLBACK[region] || 4.25;
    defaults.fuelPrice = fallback;
    fuelVal.textContent = '$' + fallback.toFixed(2) + '/gal';
    fuelSub.textContent = region + ' · Est. (offline)';
    fuelDot.className = 'live-dot red';
    fuelBox.className = 'live-box error';
    if (fuelUpd) fuelUpd.textContent = 'Using regional estimate';
    injectProfitBars();
    const calcFuel = document.getElementById('calc-fuel');
    if (calcFuel) calcFuel.value = fallback.toFixed(2);
  }
}

// Manual location override
function updateLocation() {
  const val = document.getElementById('location-input').value.trim();
  if (val) {
    document.getElementById('gps-value').textContent = val;
    document.getElementById('gps-sub').textContent = 'Manual entry';
    document.getElementById('location-input').value = '';
  }
}

// ─── INIT ──────────────────────────────────────────────────────────
renderStates(stateData);
injectProfitBars();
loadSavedPreferences();
renderMaint();
refreshWeather();
// Start GPS + fuel fetch on load

// ══════════════════════════════════════════════════════════════
// PULL TO REFRESH
// ══════════════════════════════════════════════════════════════
(function() {
  var startY = 0;
  var pulling = false;
  var indicator = document.createElement('div');
  indicator.id = 'pull-indicator';
  indicator.style.cssText = 'position:fixed;top:0;left:0;right:0;text-align:center;padding:.5rem;background:var(--green);color:#111312;font-size:.8rem;font-weight:bold;letter-spacing:.05em;z-index:999;transform:translateY(-100%);transition:transform .2s;';
  indicator.textContent = 'Pull to refresh';
  document.body.appendChild(indicator);

  document.addEventListener('touchstart', function(e) {
    if (window.scrollY === 0) {
      startY = e.touches[0].clientY;
      pulling = true;
    }
  }, { passive: true });

  document.addEventListener('touchmove', function(e) {
    if (!pulling) return;
    var dist = e.touches[0].clientY - startY;
    if (dist > 10) {
      indicator.style.transform = 'translateY(0)';
      indicator.textContent = dist > 60 ? 'Release to refresh' : 'Pull to refresh';
    }
  }, { passive: true });

  document.addEventListener('touchend', function(e) {
    if (!pulling) return;
    pulling = false;
    var dist = e.changedTouches[0].clientY - startY;
    indicator.style.transform = 'translateY(-100%)';
    indicator.textContent = 'Pull to refresh';
    if (dist > 60) {
      indicator.textContent = 'Refreshing...';
      indicator.style.transform = 'translateY(0)';
      startGPS();
      refreshWeather();
      setTimeout(function() {
        indicator.style.transform = 'translateY(-100%)';
      }, 1500);
    }
    startY = 0;
  }, { passive: true });
})();

window.addEventListener('load', () => {   setTimeout(startGPS, 500);   setTimeout(checkFirstTime, 700);    if ('serviceWorker' in navigator) {     navigator.serviceWorker.register('/sw.js').then(function(reg) {       reg.update();       reg.addEventListener('updatefound', function() {         var newWorker = reg.installing;         newWorker.addEventListener('statechange', function() {           if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {             newWorker.postMessage('SKIP_WAITING');           }         });       });     });     navigator.serviceWorker.addEventListener('controllerchange', function() {       window.location.reload();     });   } }); () => {
  setTimeout(startGPS, 500);
  setTimeout(checkFirstTime, 700);
});


// ══════════════════════════════════════════════════════════════
// BROKER VAULT
// Supabase-backed broker rolodex + invoice tracker
// ══════════════════════════════════════════════════════════════

var _brokers = [];       // local cache of brokers from Supabase
var _brokerInvoices = {}; // invoices keyed by broker_name

// ── Toggle add broker form ────────────────────────────────────
function toggleAddBroker() {
  var form = document.getElementById('add-broker-form');
  var hint = document.getElementById('add-broker-toggle-hint');
  var open = form.style.display !== 'none';
  form.style.display = open ? 'none' : 'block';
  hint.textContent = open ? 'Tap to expand' : 'Tap to collapse';
}

// ── Save broker to Supabase ───────────────────────────────────
async function saveBroker() {
  var name  = document.getElementById('new-broker-name').value.trim();
  var mc    = document.getElementById('new-broker-mc').value.trim();
  var phone = document.getElementById('new-broker-phone').value.trim();
  var email = document.getElementById('new-broker-email').value.trim();
  var terms = parseInt(document.getElementById('new-broker-terms').value);
  var notes = document.getElementById('new-broker-notes').value.trim();

  if (!name) { alert('Broker name is required.'); return; }

  try {
    var { data, error } = await _supabase
      .from('brokers')
      .insert({
        user_id: window._rcUserId,
        name: name,
        mc_number: mc,
        phone: phone,
        email: email,
        payment_terms: terms,
        notes: notes
      })
      .select()
      .single();

    if (error) throw error;

    // Clear form
    document.getElementById('new-broker-name').value = '';
    document.getElementById('new-broker-mc').value = '';
    document.getElementById('new-broker-phone').value = '';
    document.getElementById('new-broker-email').value = '';
    document.getElementById('new-broker-notes').value = '';
    document.getElementById('add-broker-form').style.display = 'none';
    document.getElementById('add-broker-toggle-hint').textContent = 'Tap to expand';

    // Reload brokers
    await loadBrokers();
    alert(name + ' added to your broker network!');
  } catch(err) {
    alert('Error saving broker: ' + err.message);
  }
}

// ── Load brokers from Supabase ────────────────────────────────
async function loadBrokers() {
  if (!window._rcUserId) return;
  try {
    var { data, error } = await _supabase
      .from('brokers')
      .select('*')
      .eq('user_id', window._rcUserId)
      .order('name');

    if (error) throw error;
    _brokers = data || [];
    renderBrokers();
    populateBrokerDropdown();
  } catch(err) {
    console.error('Error loading brokers:', err);
  }
}

// ── Render broker list ────────────────────────────────────────
function renderBrokers() {
  var list = document.getElementById('broker-list');
  if (!list) return;

  if (!_brokers.length) {
    list.innerHTML = '<div class="alert alert-amber" style="margin-top:.5rem;"><div class="alert-icon">🏦</div><div>No brokers added yet. Add your first broker above.</div></div>';
    return;
  }

  // Calculate totals from local invoices
  var totalOutstanding = 0;
  var totalOverdue = 0;
  var today = new Date();

  invoices.forEach(function(inv) {
    if (inv.status !== 'paid') {
      totalOutstanding += inv.amount;
      if (new Date(inv.dueDate) < today) totalOverdue += inv.amount;
    }
  });

  var outEl = document.getElementById('broker-total-outstanding');
  var ovEl  = document.getElementById('broker-total-overdue');
  if (outEl) outEl.textContent = '$' + totalOutstanding.toLocaleString();
  if (ovEl)  ovEl.textContent  = '$' + totalOverdue.toLocaleString();

  list.innerHTML = _brokers.map(function(b) {
    // Get invoices for this broker
    var brokerInvs = invoices.filter(function(i) {
      return i.broker && i.broker.toLowerCase() === b.name.toLowerCase();
    });
    var outstanding = brokerInvs.filter(function(i) { return i.status !== 'paid'; })
      .reduce(function(sum, i) { return sum + i.amount; }, 0);
    var paid = brokerInvs.filter(function(i) { return i.status === 'paid'; })
      .reduce(function(sum, i) { return sum + i.amount; }, 0);
    var invoiceCount = brokerInvs.length;

    return '<div class="load-card broker-card" style="cursor:pointer;" data-broker-id="' + b.id + '">' +
      '<div class="load-top">' +
        '<div>' +
          '<div class="load-route">' + b.name + '</div>' +
          '<div style="margin-top:.2rem;">' +
            (b.mc_number ? '<span style="font-size:.72rem;color:#b8c8b8;margin-right:.5rem;">' + b.mc_number + '</span>' : '') +
            '<span class="load-tag tag-' + (outstanding > 0 ? 'watch' : 'booked') + '">' + b.payment_terms + ' day terms</span>' +
          '</div>' +
        '</div>' +
        '<div style="text-align:right;">' +
          (outstanding > 0 ? '<div style="color:var(--amber);font-weight:bold;font-size:.95rem;">$' + outstanding.toLocaleString() + ' owed</div>' : '<div style="color:var(--green);font-size:.85rem;">✓ Clear</div>') +
          '<div style="font-size:.72rem;color:#b8c8b8;">' + invoiceCount + ' invoice' + (invoiceCount !== 1 ? 's' : '') + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="load-meta">' +
        '<div><div class="lm-label">Phone</div><div class="lm-val">' + (b.phone || '—') + '</div></div>' +
        '<div><div class="lm-label">Total Paid</div><div class="lm-val" style="color:var(--green);">$' + paid.toLocaleString() + '</div></div>' +
        '<div><div class="lm-label">Outstanding</div><div class="lm-val" style="color:' + (outstanding > 0 ? 'var(--amber)' : 'var(--green)') + ';">$' + outstanding.toLocaleString() + '</div></div>' +
      '</div>' +
    '</div>';
  }).join('');
}

// ── Open broker detail panel ──────────────────────────────────
function openBrokerDetail(brokerId) {
  var broker = _brokers.find(function(b) { return b.id === brokerId; });
  if (!broker) return;

  var panel   = document.getElementById('broker-detail-panel');
  var content = document.getElementById('broker-detail-content');
  var nameEl  = document.getElementById('broker-detail-name');
  nameEl.textContent = broker.name;

  // Get this broker invoices
  var brokerInvs = invoices.filter(function(i) {
    return i.broker && i.broker.toLowerCase() === broker.name.toLowerCase();
  });

  var today = new Date();
  var totalPaid = 0, totalOwed = 0, totalOverdue = 0;
  brokerInvs.forEach(function(i) {
    if (i.status === 'paid') totalPaid += i.amount;
    else {
      totalOwed += i.amount;
      if (new Date(i.dueDate) < today) totalOverdue += i.amount;
    }
  });

  var invoicesHtml = brokerInvs.length > 0
    ? brokerInvs.map(function(inv) {
        var due = new Date(inv.dueDate);
        var daysLeft = Math.ceil((due - today) / (1000*60*60*24));
        var isOverdue = inv.status === 'pending' && daysLeft < 0;
        var badge = inv.status === 'paid'
          ? '<span class="paid-badge">PAID</span>'
          : isOverdue
            ? '<span class="overdue-badge">OVERDUE ' + Math.abs(daysLeft) + 'd</span>'
            : '<span class="due-badge">DUE IN ' + daysLeft + 'd</span>';
        return '<div class="invoice-item ' + (inv.status==="paid"?"paid":isOverdue?"overdue":"") + '" style="margin:.4rem 1rem;">' +
          '<div class="inv-top"><div><div class="inv-broker-name">' + (inv.ref || 'Invoice') + '</div><div style="margin-top:.2rem;">' + badge + '</div></div>' +
          '<div class="inv-amount">$' + inv.amount.toLocaleString() + '</div></div>' +
          '<div class="inv-meta"><span class="inv-stat">Date: <strong>' + inv.date + '</strong></span><span class="inv-stat">Due: <strong>' + inv.dueDate + '</strong></span></div>' +
          '<div class="inv-actions">' +
            (inv.status !== 'paid' ? '<button class="inv-btn green" onclick="markPaid(' + inv.id + ');openBrokerDetail(\'' + brokerId + '\')">✓ Mark Paid</button>' : '') +
            (broker.phone ? '<button class="inv-btn call" onclick="callBroker(\'' + broker.phone + '\',\'' + broker.name + '\')">📞 Call</button>' : '') +
          '</div>' +
          '<div style="padding:.2rem 1rem .6rem;">' + getDocUploadHTML(inv.id) + '</div>' +
          '</div>';
      }).join('')
    : '<div style="padding:1rem;font-size:.85rem;color:#b8c8b8;">No invoices for this broker yet.</div>';

  content.innerHTML =
    '<div class="loadback-summary">' +
      '<div class="loadback-summary-row"><span>MC Number</span><strong>' + (broker.mc_number || '—') + '</strong></div>' +
      '<div class="loadback-summary-row"><span>Phone</span><strong>' + (broker.phone || '—') + '</strong></div>' +
      '<div class="loadback-summary-row"><span>Email</span><strong>' + (broker.email || '—') + '</strong></div>' +
      '<div class="loadback-summary-row"><span>Payment Terms</span><strong>Net ' + broker.payment_terms + '</strong></div>' +
      (broker.notes ? '<div class="loadback-summary-row"><span>Notes</span><strong>' + broker.notes + '</strong></div>' : '') +
    '</div>' +
    '<div style="display:flex;gap:.5rem;padding:.8rem 1rem;">' +
      (broker.phone ? '<button class="lb-call-btn" onclick="callBroker(\'' + broker.phone + '\',\'' + broker.name + '\')">📞 Call</button>' : '') +
      '<button class="lb-call-btn" style="color:var(--red);border-color:rgba(255,126,126,.35);" onclick="deleteBroker(\'' + broker.id + '\',\'' + broker.name + '\')">🗑 Delete</button>' +
    '</div>' +
    '<div class="loadback-section-title">Invoices — ' + broker.name + '</div>' +
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
    '</div>' +
    '<div style="height:2rem;"></div>';

  panel.classList.add('open');
  // Load existing documents for each invoice
  brokerInvs.forEach(function(inv) { loadInvoiceDocs(inv.id); });
}

function addInvoiceFromBroker(brokerId, brokerName, brokerPhone) {
  var amount = parseFloat(document.getElementById('bd-amount').value);
  var ref    = document.getElementById('bd-ref').value.trim();
  var date   = document.getElementById('bd-date').value;
  var terms  = parseInt(document.getElementById('bd-terms').value);

  if (!amount || !date) { alert('Amount and date required.'); return; }

  var invoiceDate = new Date(date);
  var dueDate = new Date(invoiceDate);
  dueDate.setDate(dueDate.getDate() + terms);

  var inv = {
    broker:    brokerName,
    broker_id: brokerId,
    amount:    amount,
    ref:       ref,
    date:      date,
    terms:     terms,
    phone:     brokerPhone,
    dueDate:   dueDate.toISOString().split('T')[0],
    status:    'pending',
    id:        Date.now()
  };
  invoices.unshift(inv);
  renderInvoices();
  // Save to Supabase with broker_id link
  saveInvoiceToSupabase(inv).then(function(saved) {
    var idx = invoices.findIndex(function(i) { return i.id === inv.id; });
    if (idx >= 0) invoices[idx] = saved;
    renderBrokers();
    openBrokerDetail(brokerId);
  });
}

function closeBrokerDetail() {
  document.getElementById('broker-detail-panel').classList.remove('open');
}

async function deleteBroker(brokerId, brokerName) {
  if (!confirm('Delete ' + brokerName + ' from your broker network?')) return;
  try {
    var { error } = await _supabase
      .from('brokers')
      .delete()
      .eq('id', brokerId);
    if (error) throw error;
    closeBrokerDetail();
    await loadBrokers();
  } catch(err) {
    alert('Error deleting broker: ' + err.message);
  }
}

// Load brokers when auth is ready — hook into onAuthReady

// ══════════════════════════════════════════════════════════════
// DOCUMENT VAULT — BOL & Rate Confirmation uploads
// Files stored in Supabase Storage: documents/{user_id}/{invoice_id}/
// ══════════════════════════════════════════════════════════════

var _invoiceDocs = {}; // cache: { invoice_id: { rateCon: url, bol: url } }

// ── Upload a document for an invoice ─────────────────────────
async function uploadInvoiceDoc(invoiceId, docType) {
  // Create hidden file input
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*,.pdf';
  input.onchange = async function() {
    var file = input.files[0];
    if (!file) return;

    var ext  = file.name.split('.').pop().toLowerCase();
    var path = window._rcUserId + '/' + invoiceId + '/' + docType + '.' + ext;

    try {
      var { error } = await _supabase.storage
        .from('documents')
        .upload(path, file, { upsert: true });

      if (error) throw error;

      // Get public URL
      var { data } = _supabase.storage.from('documents').getPublicUrl(path);

      // Cache it
      if (!_invoiceDocs[invoiceId]) _invoiceDocs[invoiceId] = {};
      _invoiceDocs[invoiceId][docType] = data.publicUrl;

      // Update button to show uploaded
      var btn = document.getElementById('doc-btn-' + invoiceId + '-' + docType);
      if (btn) {
        btn.textContent = '✅ ' + (docType === 'rateCon' ? 'Rate Con' : 'BOL') + ' Uploaded';
        btn.style.color = 'var(--green)';
        btn.style.borderColor = 'var(--green-border)';
      }

      // Add view link
      var linkEl = document.getElementById('doc-link-' + invoiceId + '-' + docType);
      if (linkEl) {
        linkEl.innerHTML = '<a href="' + data.publicUrl + '" target="_blank" style="color:var(--green);font-size:.72rem;">View ' + (docType === 'rateCon' ? 'Rate Con' : 'BOL') + ' →</a>';
      }

      alert((docType === 'rateCon' ? 'Rate Confirmation' : 'BOL') + ' uploaded successfully!');
    } catch(err) {
      alert('Upload failed: ' + err.message);
    }
  };
  input.click();
}

// ── Load existing docs for an invoice ────────────────────────
async function loadInvoiceDocs(invoiceId) {
  if (!window._rcUserId) return;
  try {
    var { data, error } = await _supabase.storage
      .from('documents')
      .list(window._rcUserId + '/' + invoiceId);

    if (error || !data) return;

    if (!_invoiceDocs[invoiceId]) _invoiceDocs[invoiceId] = {};

    data.forEach(function(file) {
      var docType = file.name.startsWith('rateCon') ? 'rateCon' : 'bol';
      var path = window._rcUserId + '/' + invoiceId + '/' + file.name;
      var { data: urlData } = _supabase.storage.from('documents').getPublicUrl(path);
      _invoiceDocs[invoiceId][docType] = urlData.publicUrl;

      // Update UI
      var btn = document.getElementById('doc-btn-' + invoiceId + '-' + docType);
      if (btn) {
        btn.textContent = '✅ ' + (docType === 'rateCon' ? 'Rate Con' : 'BOL') + ' Uploaded';
        btn.style.color = 'var(--green)';
        btn.style.borderColor = 'var(--green-border)';
      }
      var linkEl = document.getElementById('doc-link-' + invoiceId + '-' + docType);
      if (linkEl) {
        linkEl.innerHTML = '<a href="' + urlData.publicUrl + '" target="_blank" style="color:var(--green);font-size:.72rem;">View ' + (docType === 'rateCon' ? 'Rate Con' : 'BOL') + ' →</a>';
      }
    });
  } catch(err) {
    console.error('Error loading docs:', err);
  }
}

// ── Generate doc upload HTML for an invoice ───────────────────
function getDocUploadHTML(invoiceId) {
  return '<div style="padding:.5rem 0;display:flex;gap:.5rem;flex-wrap:wrap;align-items:center;">'
    + '<button class="lb-call-btn doc-upload-btn" data-inv="' + invoiceId + '" data-type="rc" style="font-size:.72rem;" id="doc-btn-' + invoiceId + '-rateCon">📎 Rate Con</button>'
    + '<span id="doc-link-' + invoiceId + '-rateCon"></span>'
    + '<button class="lb-call-btn doc-upload-btn" data-inv="' + invoiceId + '" data-type="bol" style="font-size:.72rem;" id="doc-btn-' + invoiceId + '-bol">📎 BOL</button>'
    + '<span id="doc-link-' + invoiceId + '-bol"></span>'
    + '</div>';
}

// Delegate doc upload clicks
document.addEventListener("click", function(e) {
  var btn = e.target.closest(".doc-upload-btn");
  if (btn) {
    var invoiceId = btn.dataset.inv;
    var docType   = btn.dataset.type === "rc" ? "rateCon" : "bol";
    uploadInvoiceDoc(invoiceId, docType);
    return;
  }
  // Delegate broker card clicks
  var card = e.target.closest(".broker-card");
  if (card) {
    var brokerId = card.dataset.brokerId;
    if (brokerId) openBrokerDetail(brokerId);
  }
});

// ── Populate broker dropdown in Money tab invoice form ────────
function populateBrokerDropdown() {
  var select = document.getElementById('inv-broker-select');
  if (!select) return;
  // Clear existing options except first
  while (select.options.length > 1) select.remove(1);
  // Add brokers from loaded list
  _brokers.forEach(function(b) {
    var opt = document.createElement('option');
    opt.value = b.name;
    opt.dataset.brokerId = b.id;
    opt.dataset.phone = b.phone || '';
    opt.textContent = b.name;
    select.appendChild(opt);
  });
}

function onBrokerSelectChange() {
  var select = document.getElementById('inv-broker-select');
  var nameInput = document.getElementById('inv-broker');
  var phoneInput = document.getElementById('inv-phone');
  if (!select) return;
  var selected = select.options[select.selectedIndex];
  if (selected && selected.value !== '') {
    if (nameInput) nameInput.value = selected.value;
    if (phoneInput && selected.dataset.phone) phoneInput.value = selected.dataset.phone;
    // Store broker_id for linking
    window._selectedBrokerId = selected.dataset.brokerId || null;
  } else {
    window._selectedBrokerId = null;
  }
}

// ══════════════════════════════════════════════════════════════
// CROWDSOURCED FUEL PRICE SYSTEM
// Users submit real pump prices — averaged by proximity
// Falls back to EIA regional if not enough local data
// ══════════════════════════════════════════════════════════════

var _crowdFuelPrice  = null;  // cached crowdsourced price
var _crowdReportCount = 0;    // how many reports in range

// ── Haversine distance in miles between two points ────────────
function distanceMiles(lat1, lon1, lat2, lon2) {
  var R = 3958.8;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLon = (lon2 - lon1) * Math.PI / 180;
  var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
          Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ── Fetch nearby crowdsourced prices from Supabase ────────────
async function fetchCrowdFuelPrice(lat, lon) {
  if (!lat || !lon) return null;
  try {
    // Get all prices from last 7 days
    var sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    var { data, error } = await _supabase
      .from('fuel_prices')
      .select('price, latitude, longitude, created_at, location_name')
      .gte('created_at', sevenDaysAgo)
      .order('created_at', { ascending: false });

    if (error || !data || !data.length) return null;

    // Filter to within 100 miles
    var nearby = data.filter(function(row) {
      return distanceMiles(lat, lon, row.latitude, row.longitude) <= 100;
    });

    if (!nearby.length) return null;

    // Average the prices
    var avg = nearby.reduce(function(sum, r) { return sum + parseFloat(r.price); }, 0) / nearby.length;
    _crowdReportCount = nearby.length;
    _crowdFuelPrice   = Math.round(avg * 1000) / 1000;
    return { price: _crowdFuelPrice, count: nearby.length };
  } catch(err) {
    console.error('Crowd fuel error:', err);
    return null;
  }
}

// ── Submit a fuel price report ────────────────────────────────
async function submitFuelPrice() {
  var input = document.getElementById('crowd-fuel-input');
  var price = parseFloat(input ? input.value : 0);
  if (!price || price < 2 || price > 10) {
    alert('Please enter a valid diesel price between $2 and $10.');
    return;
  }
  if (!window._rcUserId) { alert('Please sign in to submit a price.'); return; }
  if (!window._gpsLat || !window._gpsLon) { alert('GPS location required to submit a price.'); return; }

  try {
    var { error } = await _supabase.from('fuel_prices').insert({
      user_id:       window._rcUserId,
      price:         price,
      latitude:      window._gpsLat,
      longitude:     window._gpsLon,
      location_name: currentCity || 'Unknown'
    });
    if (error) throw error;

    // Update local display immediately
    defaults.fuelPrice = price;
    var fuelVal = document.getElementById('fuel-value');
    var fuelSub = document.getElementById('fuel-sub');
    var fuelBox = document.getElementById('fuel-box');
    var fuelDot = document.getElementById('fuel-dot');
    if (fuelVal) fuelVal.textContent = '$' + price.toFixed(3) + '/gal';
    if (fuelSub) fuelSub.textContent = 'Your report · ' + (currentCity || 'Local');
    if (fuelDot) fuelDot.className = 'live-dot green';
    if (fuelBox) fuelBox.className = 'live-box connected';

    // Close modal
    closeFuelModal();
    injectProfitBars();

    // Refresh crowd data
    fetchCrowdFuelPrice(window._gpsLat, window._gpsLon).then(function(result) {
      if (result && result.count >= 3) {
        updateFuelDisplay(result.price, result.count);
      }
    });

    alert('Thanks! Your price report helps all RoadCommand drivers in your area.');
  } catch(err) {
    alert('Error submitting price: ' + err.message);
  }
}

// ── Update fuel display with crowd data ──────────────────────
function updateFuelDisplay(price, count) {
  var fuelVal = document.getElementById('fuel-value');
  var fuelSub = document.getElementById('fuel-sub');
  var fuelUpd = document.getElementById('fuel-updated');
  if (fuelVal) fuelVal.textContent = '$' + price.toFixed(3) + '/gal';
  if (fuelSub) {
    if (count >= 3) {
      fuelSub.textContent = 'Driver reports · ' + count + ' nearby';
    } else {
      fuelSub.textContent = 'Limited data · ' + count + ' report' + (count > 1 ? 's' : '') + ' nearby';
    }
  }
  if (fuelUpd) fuelUpd.textContent = 'Crowdsourced — last 7 days';
  defaults.fuelPrice = price;
  injectProfitBars();
}

// ── Open fuel price modal ─────────────────────────────────────
function openFuelModal() {
  var modal = document.getElementById('fuel-report-modal');
  if (modal) {
    modal.style.display = 'flex';
    var input = document.getElementById('crowd-fuel-input');
    if (input) {
      input.value = defaults.fuelPrice ? defaults.fuelPrice.toFixed(2) : '';
      setTimeout(function() { input.focus(); }, 100);
    }
  }
}

// Add touch event support for fuel box on mobile via delegation
document.addEventListener('touchend', function(e) {
  var fuelBox = e.target.closest('#fuel-box');
  if (fuelBox) {
    e.preventDefault();
    openFuelModal();
  }
}, { passive: false });

function closeFuelModal() {
  var modal = document.getElementById('fuel-report-modal');
  if (modal) modal.style.display = 'none';
}
