/**
 * MagpieAuth Popup - Main Logic
 * 
 * State machine: CONNECTING → OFFLINE | LOCKED | READY
 *   LOCKED  → (pattern unlock) → READY
 *   OFFLINE → (retry/launch)   → CONNECTING
 *   READY   → show vault list
 */

// ── State Constants ─────────────────────────────────────────────────
const State = {
  CONNECTING: 'CONNECTING',
  OFFLINE: 'OFFLINE',
  LOCKED: 'LOCKED',
  READY: 'READY',
};

// ── DOM References ──────────────────────────────────────────────────
const views = {
  connecting: document.getElementById('connecting-view'),
  offline: document.getElementById('offline-view'),
  locked: document.getElementById('locked-view'),
  vault: document.getElementById('vault-view'),
};

const els = {
  btnLaunch: document.getElementById('btn-launch'),
  btnRetry: document.getElementById('btn-retry'),
  patternCanvas: document.getElementById('pattern-canvas'),
  patternError: document.getElementById('pattern-error'),
  searchInput: document.getElementById('search-input'),
  searchClear: document.getElementById('search-clear'),
  vaultItems: document.getElementById('vault-items'),
  vaultEmpty: document.getElementById('vault-empty'),
  vaultLoading: document.getElementById('vault-loading'),
  toast: document.getElementById('toast'),
  toastMessage: document.getElementById('toast-message'),
};

// ── App State ───────────────────────────────────────────────────────
let currentState = State.CONNECTING;
let patternLock = null;
let vaultData = [];
let expandedItemId = null;
let searchDebounceTimer = null;
let totpIntervals = {};  // itemId -> intervalId
let statusPollTimer = null;
let passwordRevealTimers = {};  // itemId -> timeoutId

// ── View Management ─────────────────────────────────────────────────

/**
 * Switch to a new state, showing the appropriate view.
 */
function setState(newState) {
  currentState = newState;

  // Hide all views
  Object.values(views).forEach((v) => v.classList.remove('active'));

  // Show the correct view
  switch (newState) {
    case State.CONNECTING:
      views.connecting.classList.add('active');
      break;
    case State.OFFLINE:
      views.offline.classList.add('active');
      break;
    case State.LOCKED:
      views.locked.classList.add('active');
      initPatternLock();
      break;
    case State.READY:
      views.vault.classList.add('active');
      loadVaultItems();
      break;
  }
}

// ── Connection Check ────────────────────────────────────────────────

/**
 * Check the desktop app status and transition to the correct state.
 */
async function checkStatus() {
  setState(State.CONNECTING);

  try {
    const status = await magpieAPI.getStatus();

    if (status.locked) {
      // Check if we already have a valid token
      const hasToken = await magpieAPI.hasToken();
      if (hasToken) {
        // Token exists, try to load vault to verify it's still valid
        try {
          await magpieAPI.getVaultItems();
          setState(State.READY);
        } catch (e) {
          // Token invalid, show lock screen
          setState(State.LOCKED);
        }
      } else {
        setState(State.LOCKED);
      }
    } else {
      setState(State.READY);
    }

    // Notify service worker of status
    chrome.runtime.sendMessage({
      type: 'UPDATE_BADGE',
      status: status.locked ? 'locked' : 'online',
    }).catch(() => {});

  } catch (err) {
    setState(State.OFFLINE);
    chrome.runtime.sendMessage({
      type: 'UPDATE_BADGE',
      status: 'offline',
    }).catch(() => {});
  }
}

// ── Pattern Lock ────────────────────────────────────────────────────

/**
 * Initialize the pattern lock canvas component.
 */
function initPatternLock() {
  if (patternLock) {
    patternLock.destroy();
  }

  els.patternError.style.display = 'none';

  patternLock = new PatternLock(els.patternCanvas, {
    gridSize: 4,
    dotRadius: 7,
    hitRadius: 22,
    lineWidth: 2.5,
    resetDelay: 600,
    onComplete: handlePatternComplete,
  });
}

/**
 * Handle completed pattern input.
 */
async function handlePatternComplete(pattern) {
  if (pattern.length < 2) return;

  patternLock.setDisabled(true);

  try {
    const result = await magpieAPI.authenticatePattern(pattern);

    if (result.token || result.success) {
      // Success! Transition to vault
      els.patternError.style.display = 'none';
      setState(State.READY);
    } else {
      // Wrong pattern
      patternLock.setError();
      els.patternError.style.display = 'block';
      els.patternError.textContent = result.error || 'Invalid pattern. Try again.';
      // Re-trigger shake animation
      els.patternError.style.animation = 'none';
      els.patternError.offsetHeight; // force reflow
      els.patternError.style.animation = '';
    }
  } catch (err) {
    if (err.status === 401) {
      patternLock.setError();
      els.patternError.style.display = 'block';
      els.patternError.textContent = 'Invalid pattern. Try again.';
    } else {
      patternLock.setError();
      els.patternError.style.display = 'block';
      els.patternError.textContent = 'Connection error. Please try again.';
    }
  } finally {
    patternLock.setDisabled(false);
  }
}

// ── Vault Items ─────────────────────────────────────────────────────

/**
 * Load all vault items from the API.
 */
async function loadVaultItems() {
  els.vaultLoading.style.display = 'flex';
  els.vaultItems.style.display = 'none';
  els.vaultEmpty.style.display = 'none';

  try {
    vaultData = await magpieAPI.getVaultItems();
    renderVaultItems(vaultData);
  } catch (err) {
    if (err.status === 401) {
      setState(State.LOCKED);
    } else {
      els.vaultLoading.style.display = 'none';
      els.vaultEmpty.style.display = 'flex';
      els.vaultEmpty.querySelector('p').textContent = 'Failed to load vault';
    }
  }
}

/**
 * Render the vault items list.
 * @param {Array} items
 */
function renderVaultItems(items) {
  els.vaultLoading.style.display = 'none';

  if (!items || items.length === 0) {
    els.vaultItems.style.display = 'none';
    els.vaultEmpty.style.display = 'flex';
    els.vaultEmpty.querySelector('p').textContent = 'No items found';
    return;
  }

  els.vaultItems.style.display = 'block';
  els.vaultEmpty.style.display = 'none';
  els.vaultItems.innerHTML = '';

  items.forEach((item, index) => {
    const el = createVaultItemElement(item);
    // Stagger animation
    el.style.animationDelay = `${index * 30}ms`;
    els.vaultItems.appendChild(el);
  });
}

/**
 * Create a vault item card element.
 */
function createVaultItemElement(item) {
  const div = document.createElement('div');
  div.className = 'vault-item';
  div.dataset.itemId = item.id;
  div.style.animation = 'fadeIn 300ms ease forwards';
  div.style.opacity = '0';

  // Get first letter for icon
  const initial = (item.name || item.title || '?')[0];

  // Label dot HTML
  const labelDot = item.labelColor
    ? `<span class="label-dot" style="background: ${escapeHtml(item.labelColor)}"></span>`
    : '';

  div.innerHTML = `
    <div class="vault-item-header">
      <div class="vault-item-icon" ${item.labelColor ? `style="background: ${escapeHtml(item.labelColor)}22; color: ${escapeHtml(item.labelColor)}"` : ''}>
        ${escapeHtml(initial)}
      </div>
      <div class="vault-item-info">
        <div class="vault-item-name">
          ${escapeHtml(item.name || item.title || 'Untitled')}
          ${labelDot}
        </div>
        <div class="vault-item-account">${escapeHtml(item.username || item.account || '')}</div>
      </div>
      <svg class="vault-item-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </div>
    <div class="vault-item-details" id="details-${escapeHtml(item.id)}"></div>
  `;

  div.addEventListener('click', () => toggleItemExpand(item, div));

  return div;
}

/**
 * Toggle the expanded state of a vault item.
 */
async function toggleItemExpand(item, element) {
  const detailsEl = element.querySelector('.vault-item-details');

  // If clicking the same item, collapse it
  if (expandedItemId === item.id) {
    element.classList.remove('expanded');
    expandedItemId = null;
    cleanupTotpInterval(item.id);
    return;
  }

  // Collapse previously expanded item
  if (expandedItemId) {
    const prevEl = document.querySelector(`.vault-item[data-item-id="${expandedItemId}"]`);
    if (prevEl) prevEl.classList.remove('expanded');
    cleanupTotpInterval(expandedItemId);
  }

  expandedItemId = item.id;
  element.classList.add('expanded');

  // Build details content
  detailsEl.innerHTML = buildDetailsHTML(item);

  // Attach detail event listeners
  attachDetailListeners(item, detailsEl);

  // Load TOTP if available
  if (item.hasTotp || item.totpSecret) {
    await loadTotpCode(item.id, detailsEl);
  }
}

/**
 * Build the HTML for item details.
 */
function buildDetailsHTML(item) {
  const accountValue = item.username || item.account || '';
  const hasTotp = item.hasTotp || item.totpSecret;

  let html = '';

  // Account/Username row
  if (accountValue) {
    html += `
      <div class="detail-row">
        <span class="detail-label">Account</span>
        <div class="detail-value">
          <span>${escapeHtml(accountValue)}</span>
          <button class="btn-copy" data-copy="${escapeHtml(accountValue)}" title="Copy account">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  }

  // Password row
  html += `
    <div class="detail-row">
      <span class="detail-label">Password</span>
      <div class="detail-value">
        <span class="password-display password-dots" data-item-id="${escapeHtml(item.id)}">••••••••</span>
        <button class="btn-reveal" data-item-id="${escapeHtml(item.id)}" title="Reveal password">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
          </svg>
        </button>
        <button class="btn-copy btn-copy-password" data-item-id="${escapeHtml(item.id)}" title="Copy password">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
        </button>
      </div>
    </div>
  `;

  // TOTP row (placeholder, filled by loadTotpCode)
  if (hasTotp) {
    html += `
      <div class="detail-row totp-row">
        <span class="detail-label">TOTP</span>
        <div class="totp-container" id="totp-display-${escapeHtml(item.id)}">
          <div class="spinner" style="width: 18px; height: 18px;"></div>
        </div>
      </div>
    `;
  }

  return html;
}

/**
 * Attach click listeners to detail buttons.
 */
function attachDetailListeners(item, container) {
  // Copy buttons (for account)
  container.querySelectorAll('.btn-copy[data-copy]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      copyToClipboard(btn.dataset.copy, btn);
    });
  });

  // Reveal password button
  const revealBtn = container.querySelector('.btn-reveal');
  if (revealBtn) {
    revealBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      revealPassword(item.id, container);
    });
  }

  // Copy password button
  const copyPwBtn = container.querySelector('.btn-copy-password');
  if (copyPwBtn) {
    copyPwBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      copyPassword(item.id, copyPwBtn);
    });
  }
}

// ── Password Reveal ─────────────────────────────────────────────────

/**
 * Reveal the password for an item (auto-hide after 5s).
 */
async function revealPassword(itemId, container) {
  const display = container.querySelector(`.password-display[data-item-id="${itemId}"]`);
  if (!display) return;

  // If already revealed, hide it
  if (display.classList.contains('password-revealed')) {
    display.textContent = '••••••••';
    display.classList.remove('password-revealed');
    display.classList.add('password-dots');
    clearTimeout(passwordRevealTimers[itemId]);
    return;
  }

  try {
    display.textContent = '...';
    const result = await magpieAPI.getPassword(itemId);
    const password = result.plaintext || '';

    display.textContent = password;
    display.classList.remove('password-dots');
    display.classList.add('password-revealed');

    // Auto-hide after 5 seconds
    clearTimeout(passwordRevealTimers[itemId]);
    passwordRevealTimers[itemId] = setTimeout(() => {
      display.textContent = '••••••••';
      display.classList.remove('password-revealed');
      display.classList.add('password-dots');
    }, 5000);
  } catch (err) {
    display.textContent = 'Error loading';
    setTimeout(() => {
      display.textContent = '••••••••';
    }, 2000);
  }
}

/**
 * Copy a password to clipboard.
 */
async function copyPassword(itemId, btn) {
  try {
    const result = await magpieAPI.getPassword(itemId);
    await copyToClipboard(result.plaintext || '', btn);
  } catch (err) {
    showToast('Failed to copy password');
  }
}

// ── TOTP ────────────────────────────────────────────────────────────

const TOTP_PERIOD = 30; // seconds
const TOTP_ARC_CIRCUMFERENCE = 2 * Math.PI * 13; // radius = 13

/**
 * Load and display TOTP code for an item.
 */
async function loadTotpCode(itemId, container) {
  const totpEl = container.querySelector(`#totp-display-${itemId}`);
  if (!totpEl) return;

  try {
    const result = await magpieAPI.getTotpCode(itemId);
    const code = result.code || '------';
    const remaining = result.remaining || 30;

    renderTotpDisplay(totpEl, itemId, code, remaining);

    // Start auto-refresh interval
    startTotpRefresh(itemId, container);
  } catch (err) {
    totpEl.innerHTML = '<span style="color: var(--text-tertiary); font-size: 12px;">TOTP unavailable</span>';
  }
}

/**
 * Render the TOTP display with code and arc timer.
 */
function renderTotpDisplay(container, itemId, code, remaining) {
  const fraction = remaining / TOTP_PERIOD;
  const dashOffset = TOTP_ARC_CIRCUMFERENCE * (1 - fraction);
  const isUrgent = remaining <= 5;

  // Format code with space in middle (e.g., "123 456")
  const formattedCode = code.length === 6
    ? `${code.slice(0, 3)} ${code.slice(3)}`
    : code;

  container.innerHTML = `
    <span class="totp-code">${escapeHtml(formattedCode)}</span>
    <div class="totp-timer">
      <svg width="32" height="32" viewBox="0 0 32 32">
        <circle class="totp-arc-bg" cx="16" cy="16" r="13"/>
        <circle 
          class="totp-arc ${isUrgent ? 'urgent' : ''}" 
          cx="16" cy="16" r="13"
          stroke-dasharray="${TOTP_ARC_CIRCUMFERENCE}"
          stroke-dashoffset="${dashOffset}"
        />
      </svg>
      <span class="totp-seconds">${remaining}</span>
    </div>
    <button class="btn-copy btn-copy-totp" data-copy="${escapeHtml(code)}" title="Copy TOTP code">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
      </svg>
    </button>
  `;

  // Attach copy listener for TOTP
  const copyBtn = container.querySelector('.btn-copy-totp');
  if (copyBtn) {
    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      copyToClipboard(copyBtn.dataset.copy, copyBtn);
    });
  }
}

/**
 * Start auto-refresh interval for TOTP display.
 * Refreshes every second to update the arc and remaining time.
 */
function startTotpRefresh(itemId, detailsContainer) {
  cleanupTotpInterval(itemId);

  totpIntervals[itemId] = setInterval(async () => {
    // Check if item is still expanded
    if (expandedItemId !== itemId) {
      cleanupTotpInterval(itemId);
      return;
    }

    const totpEl = detailsContainer.querySelector(`#totp-display-${itemId}`);
    if (!totpEl) {
      cleanupTotpInterval(itemId);
      return;
    }

    try {
      const result = await magpieAPI.getTotpCode(itemId);
      renderTotpDisplay(totpEl, itemId, result.code || '------', result.remaining || 30);
    } catch (err) {
      // Silently fail, will retry next interval
    }
  }, 1000);
}

/**
 * Clean up TOTP refresh interval for an item.
 */
function cleanupTotpInterval(itemId) {
  if (totpIntervals[itemId]) {
    clearInterval(totpIntervals[itemId]);
    delete totpIntervals[itemId];
  }
}

// ── Search ──────────────────────────────────────────────────────────

/**
 * Handle search input with 200ms debounce.
 */
function handleSearch() {
  const query = els.searchInput.value.trim();

  // Show/hide clear button
  els.searchClear.style.display = query ? 'flex' : 'none';

  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(async () => {
    if (!query) {
      // Empty query – show all items
      renderVaultItems(vaultData);
      return;
    }

    try {
      const results = await magpieAPI.searchItems(query);
      renderVaultItems(results);
    } catch (err) {
      // Fallback: client-side filter
      const filtered = vaultData.filter((item) => {
        const name = (item.name || item.title || '').toLowerCase();
        const account = (item.username || item.account || '').toLowerCase();
        const q = query.toLowerCase();
        return name.includes(q) || account.includes(q);
      });
      renderVaultItems(filtered);
    }
  }, 200);
}

// ── Clipboard ───────────────────────────────────────────────────────

/**
 * Copy text to clipboard and show visual feedback.
 */
async function copyToClipboard(text, buttonEl) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Copied!');

    if (buttonEl) {
      buttonEl.classList.add('copied');
      setTimeout(() => buttonEl.classList.remove('copied'), 1500);
    }
  } catch (err) {
    showToast('Failed to copy');
  }
}

// ── Toast ───────────────────────────────────────────────────────────

let toastTimer = null;

/**
 * Show a brief toast notification.
 */
function showToast(message) {
  clearTimeout(toastTimer);
  els.toastMessage.textContent = message;
  els.toast.classList.add('show');

  toastTimer = setTimeout(() => {
    els.toast.classList.remove('show');
  }, 1800);
}

// ── Status Polling ──────────────────────────────────────────────────

/**
 * Start periodic status polling (every 30s while popup is open).
 */
function startStatusPolling() {
  stopStatusPolling();
  statusPollTimer = setInterval(async () => {
    if (currentState === State.CONNECTING) return;

    try {
      const status = await magpieAPI.getStatus();
      if (status.locked && currentState === State.READY) {
        // App was locked externally
        setState(State.LOCKED);
      }
    } catch (err) {
      if (currentState === State.READY || currentState === State.LOCKED) {
        setState(State.OFFLINE);
      }
    }
  }, 30000);
}

function stopStatusPolling() {
  if (statusPollTimer) {
    clearInterval(statusPollTimer);
    statusPollTimer = null;
  }
}

// ── Utilities ───────────────────────────────────────────────────────

/**
 * Escape HTML special characters to prevent XSS.
 */
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

// ── Event Listeners ─────────────────────────────────────────────────

// Offline actions
els.btnLaunch.addEventListener('click', async () => {
  try {
    await chrome.runtime.sendMessage({ type: 'LAUNCH_APP' });
    showToast('Launching MagpieAuth...');
    // Wait a moment then retry connection
    setTimeout(() => checkStatus(), 2000);
  } catch (err) {
    showToast('Could not launch app');
  }
});

els.btnRetry.addEventListener('click', () => {
  checkStatus();
});

// Search
els.searchInput.addEventListener('input', handleSearch);
els.searchClear.addEventListener('click', () => {
  els.searchInput.value = '';
  els.searchClear.style.display = 'none';
  renderVaultItems(vaultData);
  els.searchInput.focus();
});

// Keyboard shortcut: Escape to clear search
els.searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    els.searchInput.value = '';
    els.searchClear.style.display = 'none';
    renderVaultItems(vaultData);
    els.searchInput.blur();
  }
});

// Cleanup on popup close
window.addEventListener('beforeunload', () => {
  stopStatusPolling();
  Object.keys(totpIntervals).forEach(cleanupTotpInterval);
  Object.values(passwordRevealTimers).forEach(clearTimeout);
});

// ── Initialize ──────────────────────────────────────────────────────
checkStatus();
startStatusPolling();
