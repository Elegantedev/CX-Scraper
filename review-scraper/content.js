// Content script for picking elements and scraping reviews
let picking = false;
let pickType = '';
let highlightBox;
let lastTarget;

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'pick-element') startPicking(msg.kind);
  if (msg.type === 'scrape') startScrape();
});

function startPicking(kind) {
  pickType = kind;
  if (!highlightBox) {
    highlightBox = document.createElement('div');
    Object.assign(highlightBox.style, {
      position: 'absolute',
      zIndex: 999999,
      pointerEvents: 'none',
      border: '2px solid red'
    });
    document.body.appendChild(highlightBox);
  }
  picking = true;
  document.addEventListener('mousemove', onMove, true);
  document.addEventListener('click', onClick, true);
}

function stopPicking() {
  picking = false;
  highlightBox.style.display = 'none';
  document.removeEventListener('mousemove', onMove, true);
  document.removeEventListener('click', onClick, true);
}

function onMove(e) {
  if (!picking) return;
  const t = e.target;
  if (t !== lastTarget) {
    const r = t.getBoundingClientRect();
    Object.assign(highlightBox.style, {
      display: 'block',
      top: r.top + 'px',
      left: r.left + 'px',
      width: r.width + 'px',
      height: r.height + 'px'
    });
    lastTarget = t;
  }
}

function cssPath(el) {
  if (el.id) return '#' + el.id;
  const path = [];
  while (el && el.nodeType === 1 && path.length < 4) {
    let seg = el.tagName.toLowerCase();
    if (el.className) {
      const c = el.className.split(/\s+/)[0];
      if (c) seg += '.' + c;
    }
    const parent = el.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(ch => ch.tagName === el.tagName);
      if (siblings.length > 1) seg += `:nth-child(${siblings.indexOf(el) + 1})`;
    }
    path.unshift(seg);
    if (el.id) break;
    el = parent;
  }
  return path.join(' > ');
}

function onClick(e) {
  if (!picking) return;
  e.preventDefault();
  e.stopPropagation();
  stopPicking();
  const selector = cssPath(e.target);
  const key = pickType === 'card' ? 'cardSelector' : 'nextSelector';
  chrome.storage.local.set({ [key]: selector }).then(() => {
    alert(`Saved selector: ${selector}`);
  });
}

async function startScrape() {
  const { cardSelector, nextSelector } = await chrome.storage.local.get(['cardSelector', 'nextSelector']);
  if (!cardSelector) {
    alert('No review card selector saved.');
    return;
  }
  const robots = await fetch('/robots.txt').then(r => r.text()).catch(() => '');
  if (/Disallow:\s*\//i.test(robots)) {
    alert('Scraping disallowed by robots.txt');
    return;
  }
  const productName = document.querySelector('meta[property="og:title"]')?.content || document.title;
  const productURL = location.href;
  let next;
  while (true) {
    document.querySelectorAll(cardSelector).forEach(card => {
      const data = {
        username: card.querySelector('[itemprop="author"], .user, .author')?.textContent?.trim() || '',
        timestamp: card.querySelector('time')?.getAttribute('datetime') || card.querySelector('.date')?.textContent?.trim() || '',
        headline: card.querySelector('h3, .headline')?.textContent?.trim() || '',
        body: card.querySelector('.content, .body, p')?.textContent?.trim() || card.textContent.trim(),
        rating: card.querySelector('[aria-label*="star"], .rating')?.textContent?.trim() || '',
        productName,
        productURL
      };
      chrome.runtime.sendMessage({ type: 'review', data });
    });
    next = nextSelector ? document.querySelector(nextSelector) : null;
    if (!next || next.disabled) break;
    const prevHTML = document.body.innerHTML;
    next.click();
    await new Promise(r => setTimeout(r, 500));
    await new Promise(res => {
      const obs = new MutationObserver(() => {
        if (document.body.innerHTML !== prevHTML) {
          obs.disconnect();
          res();
        }
      });
      obs.observe(document, { childList: true, subtree: true });
      setTimeout(() => { obs.disconnect(); res(); }, 10000);
    });
  }
  chrome.runtime.sendMessage({ type: 'scrape-complete' });
}
