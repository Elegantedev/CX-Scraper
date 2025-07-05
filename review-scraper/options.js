const input = document.getElementById('domain-input');
const addBtn = document.getElementById('add-domain');
const list = document.getElementById('domain-list');

function render(domains) {
  list.innerHTML = '';
  domains.forEach(d => {
    const li = document.createElement('li');
    li.textContent = d;
    li.addEventListener('click', () => {
      removeDomain(d);
    });
    list.appendChild(li);
  });
}

async function load() {
  const { allowedDomains = [] } = await chrome.storage.local.get('allowedDomains');
  render(allowedDomains);
}

async function addDomain() {
  const domain = input.value.trim();
  if (!domain) return;
  const { allowedDomains = [] } = await chrome.storage.local.get('allowedDomains');
  if (!allowedDomains.includes(domain)) {
    allowedDomains.push(domain);
    await chrome.storage.local.set({ allowedDomains });
    render(allowedDomains);
  }
  input.value = '';
}

async function removeDomain(domain) {
  const { allowedDomains = [] } = await chrome.storage.local.get('allowedDomains');
  const idx = allowedDomains.indexOf(domain);
  if (idx !== -1) {
    allowedDomains.splice(idx, 1);
    await chrome.storage.local.set({ allowedDomains });
    render(allowedDomains);
  }
}

addBtn.addEventListener('click', addDomain);
load();
