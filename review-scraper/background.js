// Background service worker
const reviews = [];
const ports = new Set();

chrome.runtime.onConnect.addListener(port => {
  ports.add(port);
  port.onDisconnect.addListener(() => ports.delete(port));
});

function broadcast(msg) {
  for (const p of ports) {
    try { p.postMessage(msg); } catch (e) {}
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'start-scrape') {
    startScrape().then(result => sendResponse(result));
    return true;
  }
  if (msg.type === 'pick-element') {
    forwardToTab(msg).then(result => sendResponse(result));
    return true;
  }
  if (msg.type === 'get-reviews') {
    sendResponse({ reviews });
  }
  if (msg.type === 'download') {
    downloadFile(msg.format).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg.type === 'review') {
    reviews.push(msg.data);
    broadcast({ type: 'review', data: msg.data });
  }
});

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function allowed(tab) {
  const { allowedDomains = [] } = await chrome.storage.local.get('allowedDomains');
  const host = new URL(tab.url).hostname;
  return allowedDomains.includes(host);
}

async function forwardToTab(message) {
  const tab = await activeTab();
  if (!tab) return { error: 'No active tab' };
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
  await chrome.tabs.sendMessage(tab.id, message);
  return { ok: true };
}

async function startScrape() {
  const tab = await activeTab();
  if (!tab) return { error: 'No active tab' };
  if (!(await allowed(tab))) return { error: 'Domain not allowed' };
  reviews.length = 0;
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
  await chrome.tabs.sendMessage(tab.id, { type: 'scrape' });
  return { ok: true };
}

function toCSV(items) {
  const header = Object.keys(items[0] || {}).join(',');
  const rows = items.map(r => Object.values(r).map(v => '"' + ('' + v).replace(/"/g, '""') + '"').join(','));
  return [header, ...rows].join('\n');
}

async function downloadFile(format) {
  const data = format === 'json' ? JSON.stringify(reviews, null, 2) : toCSV(reviews);
  const blob = new Blob([data], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  await chrome.downloads.download({ url, filename: `reviews.${format}`, saveAs: true });
  URL.revokeObjectURL(url);
}
