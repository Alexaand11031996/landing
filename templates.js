function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function renderStyleCard(s, i) {
  return `<div class="style-card"><span class="num">0${i + 1}</span><h3>${escapeHtml(s.title)}</h3><p>${escapeHtml(s.text)}</p></div>`;
}

function renderProcessItem(p, i) {
  return `<div class="process-item"><div class="process-num">0${i + 1}</div><div><h3>${escapeHtml(p.title)}</h3><p>${escapeHtml(p.text)}</p></div></div>`;
}

function renderGalleryCell(g, i) {
  const altText = g.caption ? `${g.caption} — авторське татуювання в Karmazin Tattoo Studio` : 'Авторське татуювання Karmazin Tattoo Studio';
  return `<div class="gallery-cell" data-index="${i}"><img src="${escapeHtml(g.src)}" alt="${escapeHtml(altText)}" loading="lazy" onerror="this.parentElement.classList.add('img-error')">
      <div class="expand-hint"><svg viewBox="0 0 24 24"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" stroke="currentColor" stroke-width="1.6" fill="none"/></svg></div>
      <div class="cap">${escapeHtml(g.caption)}</div></div>`;
}

function renderPriceCard(p) {
  return `<div class="price-card"><div class="p-name">${escapeHtml(p.name)}</div><div class="p-price">${escapeHtml(p.price)}</div><div class="p-note">${escapeHtml(p.note)}</div></div>`;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { escapeHtml, renderStyleCard, renderProcessItem, renderGalleryCell, renderPriceCard };
}
