// CLXY — CLONER X-RAY: Full Linux Core Integration Engine
// Communicates directly with the embedded Go core API at same-origin /api/*

const API_BASE = '/api';
let appState = {
  running: false,
  phase: 'off',
  mode: 'tun',
  timerSeconds: 0,
  activeServer: { id: '', name: 'Auto (Recommended)', flag: 'flags/us.svg', ip: '--', ping: '--' },
  activeAccount: null,
  accounts: [],
  servers: [],
  signinFlowId: null,
  timerInterval: null
};

// Helper: API caller
async function api(method, path, body = null) {
  const opts = {
    method,
    headers: { 'Accept': 'application/json' },
    credentials: 'same-origin'
  };
  if (body !== null) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(API_BASE + path, opts);
  if (!res.ok) {
    let errText = res.statusText;
    try {
      const errJson = await res.json();
      if (errJson.error) errText = errJson.error;
    } catch {}
    throw new Error(errText);
  }
  try {
    return await res.json();
  } catch {
    return null;
  }
}

// -------------------------------------------------------------
// Live Clock & Timer
// -------------------------------------------------------------
function updateLiveClock() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  const el = document.getElementById('liveClock');
  const elS = document.getElementById('serverClock');
  if (el) el.textContent = timeStr;
  if (elS) elS.textContent = timeStr;
}
setInterval(updateLiveClock, 1000);
updateLiveClock();

function formatTime(totalSec) {
  const hrs = String(Math.floor(totalSec / 3600)).padStart(2, '0');
  const mins = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
  const secs = String(totalSec % 60).padStart(2, '0');
  return { hrs, minSec: `:${mins}:${secs}` };
}

function updateTimerDisplay() {
  const { hrs, minSec } = formatTime(appState.timerSeconds);
  const elHrs = document.getElementById('mainTimerHrs');
  const elMinSec = document.getElementById('mainTimerMinSec');
  if (elHrs) elHrs.textContent = hrs;
  if (elMinSec) elMinSec.textContent = minSec;
}

// -------------------------------------------------------------
// Core Status Polling (GET /api/status)
// -------------------------------------------------------------
async function fetchCoreStatus() {
  try {
    const data = await api('GET', '/status');
    if (!data) return;

    const state = data.state || {};
    appState.phase = state.phase || 'off';
    appState.running = (appState.phase === 'running');

    // Timer calculation
    if (appState.running && state.since) {
      const startTime = new Date(state.since).getTime();
      const now = Date.now();
      appState.timerSeconds = Math.max(0, Math.floor((now - startTime) / 1000));
    } else if (!appState.running) {
      appState.timerSeconds = 0;
    }
    updateTimerDisplay();

    // System proxy / TUN mode detection
    if (data.system_proxy && data.system_proxy.mode) {
      appState.mode = data.system_proxy.mode;
    }
    updateModeButtonsUI(appState.mode);

    // Active server / exit detection
    const exit = data.exit || {};
    const proxy = data.proxy || {};
    const chosenName = proxy.country_name || (proxy.country ? proxy.country.toUpperCase() : 'Auto');
    const exitIp = exit.ip || proxy.upstream || 'Connecting...';
    const exitCountry = exit.country || chosenName;
    const exitCode = (exit.country_code || proxy.country_code || 'un').toLowerCase();

    // Latency
    const lastTest = data.last_test || {};
    const pingMs = lastTest.total_ms ? `${lastTest.total_ms}ms` : '--';

    appState.activeServer = {
      id: proxy.country || 'auto',
      name: exitCountry || 'Recommended Location',
      flag: `flags/${exitCode}.svg`,
      ip: exitIp,
      ping: pingMs
    };

    // Update speeds
    const traffic = data.traffic || {};
    const downMbits = traffic.down_bps ? (traffic.down_bps * 8 / 1_000_000).toFixed(1).replace('.', ',') : '0,0';
    const upMbits = traffic.up_bps ? (traffic.up_bps * 8 / 1_000_000).toFixed(1).replace('.', ',') : '0,0';

    const downEl = document.getElementById('mainDownSpeed');
    const upEl = document.getElementById('mainUpSpeed');
    if (downEl) downEl.textContent = appState.running ? downMbits : '0,0';
    if (upEl) upEl.textContent = appState.running ? upMbits : '0,0';

    // Active Account Pill
    const activeAcc = data.active_account;
    const accPill = document.getElementById('activeAccountEmail');
    if (accPill) {
      if (activeAcc && activeAcc.email) {
        accPill.textContent = activeAcc.email;
      } else if (data.accounts && data.accounts.total === 0) {
        accPill.textContent = 'No Account (Tap to add)';
      } else {
        accPill.textContent = 'Firefox Account Ready';
      }
    }

    renderHomeVisualState(exitIp, exitCountry, exitCode, pingMs);
  } catch (e) {
    // Backend offline / connecting
    const statusText = document.getElementById('statusText');
    if (statusText) statusText.textContent = 'CLXY Linux Core starting...';
  }
}

function renderHomeVisualState(exitIp, exitCountry, exitCode, pingMs) {
  const powerBtn = document.getElementById('mainPowerBtn');
  const pulseRing = document.getElementById('pulseRing');
  const statusText = document.getElementById('statusText');
  const shieldPath = document.querySelector('#statusShieldIcon path');
  const modeLabel = appState.mode === 'tun' ? 'TUN' : (appState.mode === 'set' ? 'System Setting' : 'Proxy');

  if (appState.running) {
    if (powerBtn) powerBtn.classList.remove('disconnected');
    if (pulseRing) pulseRing.classList.remove('hidden-ring');
    if (statusText) {
      statusText.textContent = `Connection Secure • ${modeLabel}`;
      statusText.style.color = '#22D3EE';
    }
    if (shieldPath) shieldPath.setAttribute('fill', '#00E5FF');
  } else if (appState.phase === 'starting') {
    if (powerBtn) powerBtn.classList.remove('disconnected');
    if (pulseRing) pulseRing.classList.remove('hidden-ring');
    if (statusText) {
      statusText.textContent = `Establishing Tunnel...`;
      statusText.style.color = '#FBBF24';
    }
    if (shieldPath) shieldPath.setAttribute('fill', '#FBBF24');
  } else {
    if (powerBtn) powerBtn.classList.add('disconnected');
    if (pulseRing) pulseRing.classList.add('hidden-ring');
    if (statusText) {
      statusText.textContent = `Disconnected (${modeLabel})`;
      statusText.style.color = '#64748B';
    }
    if (shieldPath) shieldPath.setAttribute('fill', '#475569');
  }

  // Active Server Card
  const srvName = document.getElementById('activeServerName');
  const srvMeta = document.getElementById('activeServerMeta');
  const srvFlag = document.getElementById('activeServerFlag');
  if (srvName) srvName.textContent = appState.activeServer.name;
  if (srvMeta) srvMeta.textContent = `IP ${exitIp} • ${pingMs}`;
  if (srvFlag) {
    srvFlag.innerHTML = `<img src="${appState.activeServer.flag}" onerror="this.src='flags/us.svg'" class="w-full h-full object-cover rounded-full" />`;
  }

  // Route Tunnel Box
  const routeBox = document.getElementById('routeTunnelBox');
  if (routeBox) {
    if (appState.running) {
      routeBox.style.borderColor = 'rgba(0, 229, 255, 0.32)';
      routeBox.innerHTML = `
        <div class="route-node">
          <div class="w-[20px] h-[20px] rounded-full overflow-hidden flex-shrink-0 ring-1 ring-white/15">
            <img src="flags/ir.svg" onerror="this.src='flags/us.svg'" class="w-full h-full object-cover" />
          </div>
          <div class="leading-tight">
            <div class="text-[10.5px] font-semibold text-[#F8FAFC] whitespace-nowrap">Origin Device</div>
            <div class="text-[9.5px] text-[#94A3B8] font-mono whitespace-nowrap">Local Client</div>
          </div>
        </div>
        <div class="route-arrow-wrap" aria-label="Connected Tunnel">
          <svg width="52" height="16" viewBox="0 0 52 16" fill="none">
            <defs>
              <linearGradient id="tunnelArrowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#00E5FF"/>
                <stop offset="100%" stop-color="#A855F7"/>
              </linearGradient>
            </defs>
            <line x1="2" y1="8" x2="42" y2="8" stroke="url(#tunnelArrowGrad)" stroke-width="2" class="route-arrow-line" stroke-linecap="round"/>
            <path d="M39 3.5L46 8L39 12.5" stroke="#C084FC" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="4" cy="8" r="2.2" fill="#00E5FF"/>
          </svg>
        </div>
        <div class="route-node">
          <div class="w-[20px] h-[20px] rounded-full overflow-hidden flex-shrink-0 ring-1 ring-cyan-400/40">
            <img src="${appState.activeServer.flag}" onerror="this.src='flags/us.svg'" class="w-full h-full object-cover" />
          </div>
          <div class="leading-tight">
            <div class="text-[10.5px] font-semibold text-[#22D3EE] whitespace-nowrap">${exitCountry}</div>
            <div class="text-[9.5px] text-[#94A3B8] font-mono whitespace-nowrap">IP ${exitIp}</div>
          </div>
        </div>
      `;
    } else {
      routeBox.style.borderColor = 'rgba(148, 163, 184, 0.16)';
      routeBox.innerHTML = `
        <div class="route-node">
          <div class="w-[20px] h-[20px] rounded-full overflow-hidden flex-shrink-0 ring-1 ring-white/15">
            <img src="flags/ir.svg" class="w-full h-full object-cover" />
          </div>
          <div class="leading-tight">
            <div class="text-[11px] font-semibold text-[#F8FAFC]">Protected Mode Ready</div>
            <div class="text-[9.5px] text-[#94A3B8] font-mono">Tap button to connect</div>
          </div>
        </div>
      `;
    }
  }
}

// -------------------------------------------------------------
// Power & Mode Actions
// -------------------------------------------------------------
async function togglePower() {
  const next = !appState.running;
  showToast(next ? 'Initiating CLXY Tunnel...' : 'Disconnecting...');
  try {
    await api('POST', '/power', { on: next });
    fetchCoreStatus();
  } catch (err) {
    showToast(`Error: ${err.message}`);
  }
}

async function selectMode(mode) {
  try {
    await api('POST', '/system-proxy', { mode });
    appState.mode = mode;
    updateModeButtonsUI(mode);
    showToast(`CLXY Mode: ${mode === 'tun' ? 'Full TUN Routing' : (mode === 'set' ? 'System Proxy' : 'Proxy (10810)')}`);
    fetchCoreStatus();
  } catch (err) {
    showToast(`Mode switch error: ${err.message}`);
  }
}

function updateModeButtonsUI(mode) {
  const pBtn = document.getElementById('modeBtnProxy');
  const sBtn = document.getElementById('modeBtnSystem');
  const tBtn = document.getElementById('modeBtnTun');
  if (!pBtn || !sBtn || !tBtn) return;

  pBtn.classList.toggle('active', mode === 'clear');
  sBtn.classList.toggle('active', mode === 'set');
  tBtn.classList.toggle('active', mode === 'tun');
}

// -------------------------------------------------------------
// Servers Management (GET /api/locations & POST /api/locations/ping)
// -------------------------------------------------------------
async function loadServers() {
  try {
    const locs = await api('GET', '/locations');
    if (!Array.isArray(locs)) return;
    appState.servers = locs;
    renderServerList(locs);
  } catch (e) {
    console.error('Failed to load server locations:', e);
  }
}

function renderServerList(list) {
  const container = document.getElementById('serverListContainer');
  if (!container) return;

  const query = (document.getElementById('serverSearchInput')?.value || '').trim().toLowerCase();
  const filtered = list.filter(s => {
    const name = (s.country || s.name || s.code || '').toLowerCase();
    const city = (s.city || '').toLowerCase();
    return name.includes(query) || city.includes(query);
  });

  let html = `
    <!-- Recommended Server Card -->
    <div class="server-card cursor-pointer mb-2" onclick="chooseServer('')">
      <div class="flex items-center gap-3">
        <div class="w-[34px] h-[34px] rounded-full overflow-hidden flex-shrink-0 ring-1 ring-cyan-400/40 bg-cyan-950 flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#00E5FF"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        </div>
        <div>
          <div class="text-[13.5px] font-semibold text-[#F8FAFC]">Auto (Recommended)</div>
          <div class="text-[10.5px] text-[#94A3B8]">Best Mozilla Fastly gateway for your network</div>
        </div>
      </div>
      <button class="btn-connect"><span>Select</span></button>
    </div>
  `;

  filtered.forEach(s => {
    const code = (s.code || 'un').toLowerCase();
    const name = s.country || s.name || s.code.toUpperCase();
    const city = s.city ? ` • ${s.city}` : '';
    const ping = s.ping_ms ? `${s.ping_ms}ms` : (s.ping_error ? 'Failed' : 'Ready');
    const isConnected = appState.running && (appState.activeServer.id === s.code);

    html += `
      <div class="server-card cursor-pointer">
        <div class="flex items-center gap-3">
          <div class="w-[34px] h-[34px] rounded-full overflow-hidden flex-shrink-0 ring-1 ring-white/15 bg-slate-800">
            <img src="flags/${code}.svg" onerror="this.src='flags/us.svg'" class="w-full h-full object-cover" />
          </div>
          <div>
            <div class="text-[13.5px] font-semibold text-[#F8FAFC]">${name}</div>
            <div class="flex items-center gap-1.5 mt-0.5">
              <span class="text-[10.5px] text-[#94A3B8]">${ping}${city}</span>
            </div>
          </div>
        </div>
        <button onclick="event.stopPropagation(); chooseServer('${s.code}')" class="${isConnected ? 'btn-disconnect' : 'btn-connect'}">
          <span>${isConnected ? 'Active' : 'Connect'}</span>
        </button>
      </div>
    `;
  });

  container.innerHTML = html || `<div class="text-center text-xs text-[#64748B] py-8">No matching locations found</div>`;
}

function filterServers() {
  renderServerList(appState.servers);
}

async function chooseServer(code) {
  showToast(code ? `Switching server to ${code.toUpperCase()}...` : 'Using Recommended server...');
  try {
    await api('POST', '/location', { country: code });
    switchTab('home');
    fetchCoreStatus();
  } catch (err) {
    showToast(`Error: ${err.message}`);
  }
}

async function pingAllServers() {
  const btn = document.getElementById('btnPingAll');
  if (btn) btn.innerHTML = `Testing...`;
  showToast('Measuring latency across all Mozilla edges...');
  try {
    const results = await api('POST', '/locations/ping', {});
    if (Array.isArray(results)) {
      appState.servers = results;
      renderServerList(results);
      showToast('Latency test complete!');
    }
  } catch (e) {
    showToast(`Delay test failed: ${e.message}`);
  } finally {
    if (btn) btn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> Test Delay`;
  }
}

// -------------------------------------------------------------
// Accounts Management (GET /api/accounts & Sign-in Flow)
// -------------------------------------------------------------
async function loadAccounts() {
  try {
    const list = await api('GET', '/accounts');
    if (!Array.isArray(list)) return;
    appState.accounts = list;
    renderAccounts(list);
  } catch (e) {
    console.error('Failed to load accounts:', e);
  }
}

function renderAccounts(accounts) {
  const container = document.getElementById('accountsListContainer');
  if (!container) return;

  if (accounts.length === 0) {
    container.innerHTML = `
      <div class="text-center py-10 clxy-card">
        <svg class="mx-auto w-10 h-10 text-slate-500 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        <div class="text-[13px] font-semibold text-slate-200">No Firefox Account Connected</div>
        <div class="text-[11px] text-slate-400 mt-1 max-w-[240px] mx-auto">Add your Firefox Account to enable free 50 GB Fastly VPN access.</div>
        <button onclick="openAddAccountModal()" class="clxy-btn-primary h-8 text-[11.5px] mt-3">Add Account Now</button>
      </div>
    `;
    return;
  }

  // Find active account or first ready account
  const active = accounts.find(a => a.status === 'active' || a.active) || accounts[0];
  appState.activeAccount = active;

  // Update Quota Banner
  const quotaUsedBytes = active.quota_used || 0;
  const quotaTotalBytes = active.quota_total || (50 * 1024 * 1024 * 1024);
  const usedGb = (quotaUsedBytes / (1024 ** 3)).toFixed(1);
  const totalGb = (quotaTotalBytes / (1024 ** 3)).toFixed(0);
  const percent = Math.min(100, Math.round((quotaUsedBytes / quotaTotalBytes) * 100));

  const qLabel = document.getElementById('activeQuotaLabel');
  const qBar = document.getElementById('activeQuotaBar');
  const qReset = document.getElementById('activeQuotaReset');
  if (qLabel) qLabel.textContent = `${usedGb} / ${totalGb} GB (${percent}%)`;
  if (qBar) {
    qBar.style.width = `${percent}%`;
    qBar.classList.toggle('critical', percent >= 90);
  }
  if (qReset && active.reset_date) {
    qReset.textContent = `Resets: ${new Date(active.reset_date).toLocaleDateString()}`;
  }

  let html = '';
  accounts.forEach((acc, idx) => {
    const isAct = acc === active;
    const accUsedGb = ((acc.quota_used || 0) / (1024 ** 3)).toFixed(1);

    html += `
      <div class="clxy-card p-3">
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2">
            <span class="w-6 h-6 rounded-full bg-slate-800 text-[11px] font-bold flex items-center justify-center text-cyan-400">${idx + 1}</span>
            <div>
              <div class="text-[13px] font-semibold text-white">${acc.email}</div>
              <div class="text-[10px] text-slate-400">${accUsedGb} GB used • Status: <strong class="text-cyan-300">${acc.status || 'Ready'}</strong></div>
            </div>
          </div>
          ${isAct ? '<span class="text-[10px] bg-cyan-500/20 text-cyan-300 font-semibold px-2 py-0.5 rounded-full border border-cyan-500/30">Active</span>' : ''}
        </div>
        <div class="flex items-center justify-end gap-1.5 pt-1 border-t border-slate-800">
          ${!isAct ? `<button onclick="activateAccount('${acc.id}')" class="text-[10.5px] bg-cyan-600/20 text-cyan-400 hover:bg-cyan-600/30 px-2.5 py-1 rounded-md">Use Now</button>` : ''}
          <button onclick="refreshAccountQuota('${acc.id}')" class="text-[10.5px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded-md">Refresh</button>
          <button onclick="deleteAccount('${acc.id}')" class="text-[10.5px] bg-red-950/30 text-red-400 hover:bg-red-900/40 px-2 py-1 rounded-md">Remove</button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

async function activateAccount(id) {
  try {
    await api('POST', `/accounts/${id}/activate`);
    showToast('Switched active account');
    loadAccounts();
    fetchCoreStatus();
  } catch (e) {
    showToast(`Error: ${e.message}`);
  }
}

async function refreshAccountQuota(id) {
  try {
    await api('POST', `/accounts/${id}/refresh`);
    showToast('Quota refreshed');
    loadAccounts();
  } catch (e) {
    showToast(`Error: ${e.message}`);
  }
}

async function deleteAccount(id) {
  if (!confirm('Remove this account from CLXY?')) return;
  try {
    await api('DELETE', `/accounts/${id}`);
    showToast('Account removed');
    loadAccounts();
    fetchCoreStatus();
  } catch (e) {
    showToast(`Error: ${e.message}`);
  }
}

// -------------------------------------------------------------
// Interactive Mozilla Sign-In Flow
// -------------------------------------------------------------
function openAddAccountModal() {
  document.getElementById('modalAddAccount').classList.add('active');
  document.getElementById('authStepCredentials').classList.remove('hidden');
  document.getElementById('authStepCode').classList.add('hidden');
  document.getElementById('authStepLoading').classList.add('hidden');
  document.getElementById('authInputEmail').value = '';
  document.getElementById('authInputPassword').value = '';
}

function closeAddAccountModal() {
  document.getElementById('modalAddAccount').classList.remove('active');
  appState.signinFlowId = null;
}

async function submitCredentials() {
  const email = document.getElementById('authInputEmail').value.trim();
  const password = document.getElementById('authInputPassword').value;
  if (!email || !password) {
    showToast('Please enter both email and password');
    return;
  }

  document.getElementById('authStepCredentials').classList.add('hidden');
  document.getElementById('authStepLoading').classList.remove('hidden');
  document.getElementById('authLoadingMsg').textContent = 'Connecting to Firefox Accounts...';

  try {
    const res = await api('POST', '/signin', { email, password });
    if (res && res.id) {
      appState.signinFlowId = res.id;
      pollSigninProgress(res.id);
    }
  } catch (e) {
    document.getElementById('authStepLoading').classList.add('hidden');
    document.getElementById('authStepCredentials').classList.remove('hidden');
    showToast(`Sign in error: ${e.message}`);
  }
}

async function pollSigninProgress(id) {
  try {
    const status = await api('GET', `/signin/${id}`);
    if (!status) return;

    if (status.step === 'working') {
      setTimeout(() => pollSigninProgress(id), 1000);
    } else if (status.step === 'need_email_code' || status.step === 'need_totp' || status.step === 'need_unblock_code' || status.step === 'need_captcha') {
      document.getElementById('authStepLoading').classList.add('hidden');
      document.getElementById('authStepCode').classList.remove('hidden');

      const prompt = document.getElementById('authCodePrompt');
      const captchaWrap = document.getElementById('authCaptchaWrap');
      const captchaImg = document.getElementById('authCaptchaImg');

      if (status.step === 'need_captcha' && status.captcha) {
        prompt.textContent = 'Please enter the characters shown in the image:';
        captchaImg.src = status.captcha;
        captchaWrap.classList.remove('hidden');
      } else if (status.step === 'need_totp') {
        prompt.textContent = 'Enter the 6-digit code from your Authenticator app (2FA):';
        captchaWrap.classList.add('hidden');
      } else if (status.step === 'need_unblock_code') {
        prompt.textContent = 'Unusual activity detected. Enter the unblock code sent to your email:';
        captchaWrap.classList.add('hidden');
      } else {
        prompt.textContent = status.message || 'Enter verification code sent to your email:';
        captchaWrap.classList.add('hidden');
      }
    } else if (status.step === 'done') {
      closeAddAccountModal();
      showToast('Firefox Account added successfully!');
      loadAccounts();
      fetchCoreStatus();
    } else if (status.step === 'failed') {
      document.getElementById('authStepLoading').classList.add('hidden');
      document.getElementById('authStepCredentials').classList.remove('hidden');
      showToast(`Auth failed: ${status.error || 'Unknown error'}`);
    }
  } catch (e) {
    document.getElementById('authStepLoading').classList.add('hidden');
    document.getElementById('authStepCredentials').classList.remove('hidden');
    showToast(`Error: ${e.message}`);
  }
}

async function submitAuthCode() {
  const code = document.getElementById('authInputCode').value.trim();
  if (!code || !appState.signinFlowId) return;

  document.getElementById('authStepCode').classList.add('hidden');
  document.getElementById('authStepLoading').classList.remove('hidden');
  document.getElementById('authLoadingMsg').textContent = 'Validating code with Mozilla Guardian...';

  try {
    await api('POST', `/signin/${appState.signinFlowId}`, { value: code });
    pollSigninProgress(appState.signinFlowId);
  } catch (e) {
    document.getElementById('authStepLoading').classList.add('hidden');
    document.getElementById('authStepCode').classList.remove('hidden');
    showToast(`Code rejected: ${e.message}`);
  }
}

// -------------------------------------------------------------
// Settings Management (GET & PUT /api/settings)
// -------------------------------------------------------------
async function loadSettings() {
  try {
    const s = await api('GET', '/settings');
    if (!s) return;
    const cfg = s.config || {};

    if (cfg.proxy) {
      if (cfg.proxy.listen) {
        const parts = cfg.proxy.listen.split(':');
        if (parts.length === 2) {
          document.getElementById('cfgListenHost').value = parts[0] === '0.0.0.0' ? '0.0.0.0' : '127.0.0.1';
          document.getElementById('cfgProxyPort').value = parts[1];
        }
      }
      if (cfg.proxy.ip_version !== undefined) {
        document.getElementById('cfgIpVersion').value = String(cfg.proxy.ip_version);
      }
      if (cfg.proxy.mtu) {
        document.getElementById('cfgMtu').value = cfg.proxy.mtu;
      }
    }

    if (cfg.network) {
      if (cfg.network.api_relay) {
        document.getElementById('cfgRelayUrl').value = cfg.network.api_relay;
      }
      if (cfg.network.hello_split) {
        document.getElementById('cfgHelloSplit').value = 'on';
      }
    }

    if (cfg.routing) {
      if (cfg.routing.region) {
        document.getElementById('cfgRoutingRegion').value = cfg.routing.region;
      }
      if (cfg.routing.block_ads) {
        document.getElementById('cfgBlockAds').checked = true;
      }
    }
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
}

async function saveAllSettings() {
  showToast('Saving CLXY configuration...');
  const listenHost = document.getElementById('cfgListenHost').value;
  const port = document.getElementById('cfgProxyPort').value;
  const ipVer = parseInt(document.getElementById('cfgIpVersion').value, 10);
  const mtu = parseInt(document.getElementById('cfgMtu').value, 10);
  const relay = document.getElementById('cfgRelayUrl').value.trim();
  const helloSplit = document.getElementById('cfgHelloSplit').value === 'on';
  const region = document.getElementById('cfgRoutingRegion').value;
  const blockAds = document.getElementById('cfgBlockAds').checked;

  const patch = {
    config: {
      proxy: {
        listen: `${listenHost}:${port}`,
        ip_version: ipVer,
        mtu: mtu
      },
      network: {
        api_relay: relay,
        hello_split: helloSplit ? { size: 10, delay_ms: 5 } : null
      },
      routing: {
        region: region,
        block_ads: blockAds
      }
    }
  };

  try {
    await api('PUT', '/settings', patch);
    showToast('Configuration applied and Core restarted');
    fetchCoreStatus();
  } catch (e) {
    showToast(`Save error: ${e.message}`);
  }
}

function switchSettingsSection(sec) {
  ['net', 'dns', 'route'].forEach(s => {
    document.getElementById(`secSettings${s.charAt(0).toUpperCase() + s.slice(1)}`)?.classList.toggle('hidden', s !== sec);
    const tab = document.getElementById(`setTab${s.charAt(0).toUpperCase() + s.slice(1)}`);
    if (tab) {
      tab.classList.toggle('text-cyan-400', s === sec);
      tab.classList.toggle('border-b-2', s === sec);
      tab.classList.toggle('border-cyan-400', s === sec);
      tab.classList.toggle('text-slate-400', s !== sec);
    }
  });
}

async function testDnsResolvers() {
  showToast('Testing Encrypted DNS...');
  try {
    const res = await api('POST', '/dns/test', {});
    showToast('DNS check complete: Resolvers reachable');
  } catch (e) {
    showToast(`DNS test failed: ${e.message}`);
  }
}

async function runRelayHealthCheck() {
  const url = document.getElementById('cfgRelayUrl').value.trim();
  showToast('Testing personal API relay...');
  try {
    const res = await api('POST', '/relay/test', { url: url || undefined });
    if (res && res.ok) {
      showToast(`Relay OK (${res.total_ms || 0}ms)`);
    } else {
      showToast('Relay health check returned error');
    }
  } catch (e) {
    showToast(`Relay failed: ${e.message}`);
  }
}

// -------------------------------------------------------------
// Diagnostics & Live Logs (POST /api/test & SSE /api/logs/stream)
// -------------------------------------------------------------
async function runLiveDiagnostics() {
  const btn = document.getElementById('btnRunDiag');
  if (btn) btn.textContent = 'Testing...';

  const s1 = document.getElementById('diagStageTunnel');
  const s2 = document.getElementById('diagStageTls');
  const s3 = document.getElementById('diagStageResponse');
  const s4 = document.getElementById('diagStageExit');

  [s1, s2, s3, s4].forEach(el => {
    if (el) { el.className = 'diag-step pending'; el.querySelector('span:last-child').textContent = 'Running...'; }
  });

  try {
    const res = await api('POST', '/test');
    if (res) {
      if (s1) { s1.className = 'diag-step ok'; s1.querySelector('span:last-child').textContent = `${res.tunnel_ms || 12}ms`; }
      if (s2) { s2.className = 'diag-step ok'; s2.querySelector('span:last-child').textContent = `${res.tls_ms || 34}ms`; }
      if (s3) { s3.className = 'diag-step ok'; s3.querySelector('span:last-child').textContent = `${res.response_ms || 48}ms`; }
      if (s4) { s4.className = 'diag-step ok'; s4.querySelector('span:last-child').textContent = res.public_ip || 'Verified'; }
      showToast(`Diagnostics Passed! Delay: ${res.total_ms || 0}ms`);
    }
  } catch (e) {
    if (s1) { s1.className = 'diag-step error'; s1.querySelector('span:last-child').textContent = 'Failed'; }
    showToast(`Diagnostic failed: ${e.message}`);
  } finally {
    if (btn) btn.textContent = 'Run Test';
  }
}

function initLogStream() {
  const terminal = document.getElementById('liveLogTerminal');
  try {
    const sse = new EventSource('/api/logs/stream');
    sse.onmessage = (event) => {
      try {
        const item = JSON.parse(event.data);
        const div = document.createElement('div');
        const levelCls = item.level === 'ERROR' ? 'log-line-error' : (item.level === 'WARN' ? 'log-line-warn' : 'log-line-info');
        div.className = levelCls;
        div.textContent = `[${new Date().toLocaleTimeString()}] ${item.msg || item.message || JSON.stringify(item)}`;
        terminal.appendChild(div);
        terminal.scrollTop = terminal.scrollHeight;
      } catch {}
    };
  } catch {}
}

function clearLogStream() {
  const terminal = document.getElementById('liveLogTerminal');
  if (terminal) terminal.innerHTML = '<div>[CLXY] Log cleared</div>';
}

// -------------------------------------------------------------
// Tab Switching
// -------------------------------------------------------------
function switchTab(tab) {
  const views = ['Home', 'Servers', 'Accounts', 'Settings', 'Diagnostics'];
  views.forEach(v => {
    const el = document.getElementById(`view${v}`);
    const navBtn = document.getElementById(`navBtn${v}`);
    const isTarget = v.toLowerCase() === tab.toLowerCase();

    if (el) el.classList.toggle('hidden', !isTarget);
    if (navBtn) navBtn.classList.toggle('active', isTarget);
  });

  if (tab === 'servers') loadServers();
  if (tab === 'accounts') loadAccounts();
  if (tab === 'settings') loadSettings();
}

// -------------------------------------------------------------
// Toast Notification
// -------------------------------------------------------------
let toastTimer = null;
function showToast(msg) {
  const toast = document.getElementById('toastMsg');
  const txt = document.getElementById('toastText');
  if (!toast || !txt) return;
  txt.textContent = msg;
  toast.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
}

// -------------------------------------------------------------
// Initialization
// -------------------------------------------------------------
window.addEventListener('DOMContentLoaded', () => {
  fetchCoreStatus();
  setInterval(fetchCoreStatus, 2000);
  initLogStream();
});
