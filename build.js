/*
  Build-time pre-render: бере index.html (шаблон) + content/site.json,
  підставляє реальний текст у HTML ще до деплою — щоб краулери й
  соцмережі бачили готовий контент, а не порожні id-контейнери, які
  заповнює клієнтський JS.

  Клієнтський JS в index.html лишається без змін і продовжує заповнювати
  ту ж саму розмітку тими ж значеннями після завантаження — це просто
  "гідрація поверх" уже готового HTML, тож нічого для живих користувачів
  і для CMS (/admin, git-gateway) не міняється.
*/
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');

const { DEFAULT_CONTENT, deepMerge } = require('./content.default.js');

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function setInner(html, id, value) {
  const re = new RegExp('(<[a-zA-Z0-9]+[^>]*\\bid="' + id + '"[^>]*>)([^<]*)(</)');
  if (!re.test(html)) throw new Error('setInner: id not found or not empty: ' + id);
  return html.replace(re, (m, open, _old, closeStart) => open + value + closeStart);
}

function setAttr(html, id, attr, value) {
  // Матчимо весь тег окремо, а тоді міняємо атрибут усередині нього —
  // так це працює незалежно від того, в якому порядку йдуть атрибути в тезі.
  const tagRe = new RegExp('<[a-zA-Z0-9]+\\b[^>]*\\bid="' + id + '"[^>]*>');
  const tagMatch = html.match(tagRe);
  if (!tagMatch) throw new Error('setAttr: id not found: ' + id);
  const tag = tagMatch[0];
  const attrRe = new RegExp('\\b' + attr + '="[^"]*"');
  if (!attrRe.test(tag)) throw new Error('setAttr: attr not found: ' + id + ' / ' + attr);
  const newTag = tag.replace(attrRe, attr + '="' + escapeHtml(value) + '"');
  return html.slice(0, tagMatch.index) + newTag + html.slice(tagMatch.index + tag.length);
}

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

function build() {
  const siteJsonPath = path.join(ROOT, 'content', 'site.json');
  const siteJson = JSON.parse(fs.readFileSync(siteJsonPath, 'utf8'));
  const C = deepMerge(DEFAULT_CONTENT, siteJson);
  const seo = C.seo || {};
  const fallbackImage = 'https://karmazin.netlify.app/images/master-at-work.jpg';

  let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

  // --- <head> SEO ---
  html = setInner(html, 'page-title', escapeHtml(seo.title || 'Karmazin Tattoo Studio'));
  html = setAttr(html, 'meta-description', 'content', seo.description || '');
  html = setAttr(html, 'meta-robots', 'content', seo.robots || 'index, follow');
  html = setAttr(html, 'meta-author', 'content', seo.author || 'Karmazin Tattoo Studio');
  html = setAttr(html, 'canonical-link', 'href', seo.canonicalUrl || 'https://karmazin.netlify.app/');
  html = setAttr(html, 'og-title', 'content', seo.ogTitle || seo.title || 'Karmazin Tattoo Studio');
  html = setAttr(html, 'og-description', 'content', seo.ogDescription || seo.description || '');
  html = setAttr(html, 'og-image', 'content', seo.ogImage || fallbackImage);
  html = setAttr(html, 'og-url', 'content', seo.ogUrl || seo.canonicalUrl || 'https://karmazin.netlify.app/');
  html = setAttr(html, 'twitter-title', 'content', seo.twitterTitle || seo.ogTitle || seo.title || 'Karmazin Tattoo Studio');
  html = setAttr(html, 'twitter-description', 'content', seo.twitterDescription || seo.ogDescription || seo.description || '');
  html = setAttr(html, 'twitter-image', 'content', seo.twitterImage || seo.ogImage || fallbackImage);

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'TattooParlor',
    name: 'Karmazin Tattoo Studio',
    url: seo.canonicalUrl || 'https://karmazin.netlify.app/',
    image: seo.ogImage || fallbackImage,
    telephone: C.phone || '',
    address: { '@type': 'PostalAddress', addressLocality: (C.contact && C.contact.city) || '', addressCountry: 'UA' },
    openingHours: (C.booking && C.booking.workHours) || ''
  };
  html = html.replace(
    /(<script type="application\/ld\+json" id="schema-json">)([^<]*)(<\/script>)/,
    (m, open, _old, close) => open + JSON.stringify(schema) + close
  );

  // --- header ---
  html = setAttr(html, 'nav-instagram', 'href', C.instagramUrl);
  html = setAttr(html, 'nav-instagram-mobile', 'href', C.instagramUrl);
  html = setAttr(html, 'nav-phone', 'href', 'tel:' + String(C.phone || '').replace(/[^\d+]/g, ''));
  html = setInner(html, 'nav-phone-text', escapeHtml(C.phone || ''));

  // --- hero ---
  html = setInner(html, 'hero-eyebrow', escapeHtml(C.hero.eyebrow));
  html = setInner(html, 'hero-title',
    `${escapeHtml(C.hero.titleLine1)}<br>${escapeHtml(C.hero.titleLine2)}<br><em>${escapeHtml(C.hero.titleEm)}</em> ${escapeHtml(C.hero.titleLine3)}`);
  html = setInner(html, 'hero-lead', escapeHtml(C.hero.lead));
  html = setAttr(html, 'hero-cta-primary', 'href', C.instagramUrl);
  html = setInner(html, 'hero-cta-primary', escapeHtml(C.hero.ctaPrimary));
  html = setInner(html, 'hero-cta-secondary', escapeHtml(C.hero.ctaSecondary));
  html = setInner(html, 'hero-stamp',
    `${escapeHtml(C.hero.stampSmall)}<span class="big">${escapeHtml(C.hero.stampBig)}</span>${escapeHtml(C.hero.stampBottom)}`);

  // --- master ---
  html = setInner(html, 'master-name', escapeHtml(C.master.name));
  html = setInner(html, 'master-bio1', escapeHtml(C.master.bio1));
  html = setInner(html, 'master-bio2', escapeHtml(C.master.bio2));
  html = setInner(html, 'stat1-num', escapeHtml(C.master.stat1Num));
  html = setInner(html, 'stat1-label', escapeHtml(C.master.stat1Label));
  html = setInner(html, 'stat2-num', escapeHtml(C.master.stat2Num));
  html = setInner(html, 'stat2-label', escapeHtml(C.master.stat2Label));
  html = setInner(html, 'stat3-num', escapeHtml(C.master.stat3Num));
  html = setInner(html, 'stat3-label', escapeHtml(C.master.stat3Label));

  // --- styles / process / gallery / pricing (ті самі шаблони, що й у клієнтському JS) ---
  const stylesHtml = C.styles.map((s, i) =>
    `<div class="style-card"><span class="num">0${i + 1}</span><h3>${escapeHtml(s.title)}</h3><p>${escapeHtml(s.text)}</p></div>`
  ).join('');
  html = setInner(html, 'styles-grid', stylesHtml);

  const processHtml = C.process.map((p, i) =>
    `<div class="process-item"><div class="process-num">0${i + 1}</div><div><h3>${escapeHtml(p.title)}</h3><p>${escapeHtml(p.text)}</p></div></div>`
  ).join('');
  html = setInner(html, 'process-list', processHtml);

  const galleryHtml = C.gallery.map((g, i) => {
    const altText = g.caption ? `${g.caption} — авторське татуювання в Karmazin Tattoo Studio` : 'Авторське татуювання Karmazin Tattoo Studio';
    return `<div class="gallery-cell" data-index="${i}"><img src="${escapeHtml(g.src)}" alt="${escapeHtml(altText)}" loading="lazy">
      <div class="expand-hint"><svg viewBox="0 0 24 24"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" stroke="currentColor" stroke-width="1.6" fill="none"/></svg></div>
      <div class="cap">${escapeHtml(g.caption)}</div></div>`;
  }).join('');
  html = setInner(html, 'gallery-grid', galleryHtml);

  html = setInner(html, 'pricing-note', escapeHtml(C.pricing.note));
  const pricingHtml = C.pricing.items.map(p =>
    `<div class="price-card"><div class="p-name">${escapeHtml(p.name)}</div><div class="p-price">${escapeHtml(p.price)}</div><div class="p-note">${escapeHtml(p.note)}</div></div>`
  ).join('');
  html = setInner(html, 'pricing-grid', pricingHtml);

  // --- contact ---
  html = setInner(html, 'contact-heading', escapeHtml(C.contact.heading));
  html = setInner(html, 'contact-text', escapeHtml(C.contact.text));
  html = setAttr(html, 'contact-cta', 'href', C.instagramUrl);
  html = setInner(html, 'contact-cta', escapeHtml(C.contact.ctaPrimary));
  html = setInner(html, 'contact-city', escapeHtml(C.contact.city));
  html = setInner(html, 'contact-format', escapeHtml(C.contact.format));
  html = setInner(html, 'contact-channel', escapeHtml(C.contact.channel));
  html = setInner(html, 'contact-sketch', escapeHtml(C.contact.sketch));

  // --- lightbox / footer ---
  html = setAttr(html, 'lb-instagram', 'href', C.instagramUrl);
  html = setInner(html, 'site-footer', escapeHtml(C.footer));

  // --- зібрати dist/: копіюємо все, що реально потрібно на сайті, і кладемо готовий index.html ---
  if (fs.existsSync(DIST)) fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });

  const assetsToCopy = ['images', 'admin', 'content', 'content.default.js', 'favicon.ico', 'favicon-32.png', 'apple-touch-icon.png', 'robots.txt', 'sitemap.xml'];
  for (const name of assetsToCopy) {
    const src = path.join(ROOT, name);
    if (fs.existsSync(src)) copyRecursive(src, path.join(DIST, name));
  }

  fs.writeFileSync(path.join(DIST, 'index.html'), html, 'utf8');

  console.log('Build OK: dist/ generated with pre-rendered content from content/site.json');
}

build();
