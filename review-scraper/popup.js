const pickCard = document.getElementById('pick-card');
const pickNext = document.getElementById('pick-next');
const startBtn = document.getElementById('start');
const dlCsv = document.getElementById('download-csv');
const dlJson = document.getElementById('download-json');
const table = document.getElementById('preview');

const port = chrome.runtime.connect();
port.onMessage.addListener(msg => {
  if (msg.type === 'review') {
    addRow(msg.data);
  }
});

chrome.runtime.sendMessage({ type: 'get-reviews' }, res => {
  (res.reviews || []).slice(0, 10).forEach(addRow);
});

pickCard.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'pick-element', kind: 'card' });
});

pickNext.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'pick-element', kind: 'next' });
});

startBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'start-scrape' }, res => {
    if (res?.error) alert(res.error);
  });
});

dlCsv.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'download', format: 'csv' });
});

dlJson.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'download', format: 'json' });
});

function addRow(review) {
  if (table.rows.length === 0) {
    const header = table.insertRow();
    Object.keys(review).forEach(k => {
      const th = document.createElement('th');
      th.textContent = k;
      header.appendChild(th);
    });
  }
  if (table.rows.length > 10) return;
  const row = table.insertRow();
  Object.values(review).forEach(v => {
    const td = row.insertCell();
    td.textContent = v;
  });
}
