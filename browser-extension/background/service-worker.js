/**
 * MagpieAuth Service Worker
 * 
 * Runs in the background to:
 * - Periodically check connection to the desktop app
 * - Update the extension icon based on connection status
 * - Handle messages from the popup (e.g., launch MagpieAuth)
 */

const API_BASE = 'http://127.0.0.1:19826';
const CHECK_ALARM = 'magpie-connection-check';
const CHECK_INTERVAL_MINUTES = 1; // Check every 60 seconds

// ── Icon Badge Management ───────────────────────────────────────────

/**
 * Update the extension badge based on connection/lock status.
 * @param {'online'|'locked'|'offline'} status
 */
function updateBadge(status) {
  switch (status) {
    case 'online':
      chrome.action.setBadgeText({ text: '' });
      chrome.action.setBadgeBackgroundColor({ color: '#22c55e' });
      break;
    case 'locked':
      chrome.action.setBadgeText({ text: '🔒' });
      chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' });
      break;
    case 'offline':
      chrome.action.setBadgeText({ text: '!' });
      chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
      break;
  }
}

// ── Connection Check ────────────────────────────────────────────────

/**
 * Check if MagpieAuth desktop app is running and its lock state.
 */
async function checkConnection() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${API_BASE}/api/status`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      updateBadge(data.locked ? 'locked' : 'online');
      return { connected: true, locked: data.locked };
    } else {
      updateBadge('offline');
      return { connected: false, locked: true };
    }
  } catch (err) {
    updateBadge('offline');
    return { connected: false, locked: true };
  }
}

// ── Alarm Setup ─────────────────────────────────────────────────────

// Create periodic alarm on install/startup
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(CHECK_ALARM, {
    periodInMinutes: CHECK_INTERVAL_MINUTES,
  });
  // Run initial check
  checkConnection();
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(CHECK_ALARM, {
    periodInMinutes: CHECK_INTERVAL_MINUTES,
  });
  checkConnection();
});

// Handle alarm fires
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === CHECK_ALARM) {
    checkConnection();
  }
});

// ── Message Handling ────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'CHECK_CONNECTION':
      checkConnection().then(sendResponse);
      return true; // async response

    case 'LAUNCH_APP':
      // Attempt to launch MagpieAuth via custom protocol
      try {
        // Open a new tab with the custom protocol URL
        // The OS will handle the protocol and launch the app
        chrome.tabs.create({
          url: 'magpieauth://launch',
          active: false,
        }, (tab) => {
          // Close the tab after a brief moment (protocol handler will take over)
          setTimeout(() => {
            if (tab && tab.id) {
              chrome.tabs.remove(tab.id).catch(() => {});
            }
          }, 1000);
        });
        sendResponse({ success: true });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
      return true;

    case 'UPDATE_BADGE':
      updateBadge(message.status);
      sendResponse({ success: true });
      return true;

    default:
      return false;
  }
});
