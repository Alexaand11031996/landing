const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');

const { DEFAULT_CONTENT, deepMerge } = require('./content.default.js');
const { escapeHtml, renderStyleCard, renderProcessItem, renderGalleryCell, renderPriceCard } = require('./templates.js');

function setInner(html, id, value) {
  const re = new RegExp('(<[a-zA-Z0-9]+[^>]*\\bid="' + id + '"[^>]*>)([^<]*)(</)');
  if (!re.test(html)) throw new Error('setInner: id not found or not empty: ' + id);
  return html.replace(re, (m, open, _old, closeStart) => open + value + closeStart);
}

function setAttr(html, id, attr, value) {
  const tagRe = new RegExp('<[a-zA-Z0-9]+\\b[^>]*\\bid="' + id + '"[^>]*>');
  const tagMatch = html.match(tagRe);
  if (!tagMatch) throw new Error('setAttr: id not found: ' + id);
  const tag = tagMatch[0];
  const attrRe = new RegExp('\\b' + attr + '="[^"]*"');
  if (!attrRe.test(tag)) throw new Error('setAttr: attr not found: ' + id + ' / ' + attr);
  const newTag = tag.replace(attrRe, attr + '="' + escapeHtml(value) + '"');
  return html.slice(0, tagMatch.index) + newTag + html.slice(tagMatch.index + tag.length);
}

function normalizeTelegramUrl(value) {
  const v = String(value || '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  return 'https://t.me/' + v.replace(/^@/, '');
}

function setRootVar(html, varName, defaultValue, newValue) {
  if (!newValue) return html;
  const re = new RegExp('(--' + varName + ':)' + defaultValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ';');
  if (!re.test(html)) throw new Error('setRootVar: default value not found for --' + varName);
  return html.replace(re, '$1' + newValue + ';');
}

function setOptionalLink(html, id, url, label) {
  if (url && String(url).trim()) {
    html = setAttr(html, id, 'href', url);
    html = setAttr(html, id, 'style', '');
    if (label && String(label).trim()) {
      html = setInner(html, id, escapeHtml(label));
    }
  }
  return html;
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

function warnIfEmpty(label, value) {
  if (!value || !String(value).trim()) {
    console.warn('Build warning: "' + label + '" is empty in content/site.json');
  }
}

function verifyContent(C) {
  warnIfEmpty('hero.titleLine1', C.hero && C.hero.titleLine1);
  warnIfEmpty('phone', C.phone);
  warnIfEmpty('instagramUrl', C.instagramUrl);
  warnIfEmpty('master.name', C.master && C.master.name);
  warnIfEmpty('contact.city', C.contact && C.contact.city);
  warnIfEmpty('seo.title', C.seo && C.seo.title);
}

function collectImageRefs(C) {
  const refs = (C.gallery || []).filter(item => item.src).map(item => ({ item, key: 'src' }));
  if (C.master && C.master.photo) refs.push({ item: C.master, key: 'photo' });
  return refs;
}

function verifyGalleryImages(C) {
  collectImageRefs(C).forEach(({ item, key }) => {
    const filePath = path.join(ROOT, item[key]);
    if (!fs.existsSync(filePath)) {
      console.warn('Build warning: image file is missing on disk: ' + item[key]);
    }
  });
}

const HEIC_RE = /\.(heic|heif)$/i;

async function convertHeicImages(C) {
  const heicConvert = require('heic-convert');
  for (const { item, key } of collectImageRefs(C)) {
    const src = item[key];
    if (!HEIC_RE.test(src)) continue;
    const srcPath = path.join(ROOT, src);
    if (!fs.existsSync(srcPath)) continue;
    try {
      const inputBuffer = fs.readFileSync(srcPath);
      const outputBuffer = await heicConvert({ buffer: inputBuffer, format: 'JPEG', quality: 0.9 });
      const newSrc = src.replace(HEIC_RE, '.jpg');
      const destPath = path.join(DIST, newSrc);
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.writeFileSync(destPath, outputBuffer);
      console.log('Converted HEIC/HEIF image for browser compatibility: ' + src + ' -> ' + newSrc);
      item[key] = newSrc;
    } catch (err) {
      console.warn('Build warning: failed to convert HEIC image ' + src + ': ' + err.message);
    }
  }
}

const IMAGE_MAX_WIDTH = 1600;

async function optimizeImages(C) {
  const sharp = require('sharp');
  for (const { item, key } of collectImageRefs(C)) {
    const src = item[key];
    const filePath = path.join(DIST, src);
    if (!fs.existsSync(filePath)) continue;
    try {
      const inputBuffer = fs.readFileSync(filePath);
      const ext = path.extname(src).toLowerCase();
      let pipeline = sharp(inputBuffer).rotate();
      const meta = await pipeline.metadata();
      if (meta.width && meta.width > IMAGE_MAX_WIDTH) {
        pipeline = pipeline.resize({ width: IMAGE_MAX_WIDTH });
      }
      const outputBuffer = ext === '.png'
        ? await pipeline.png({ compressionLevel: 9 }).toBuffer()
        : await pipeline.jpeg({ quality: 82, mozjpeg: true }).toBuffer();
      if (outputBuffer.length < inputBuffer.length) {
        fs.writeFileSync(filePath, outputBuffer);
        console.log('Optimized image: ' + src + ' (' + Math.round(inputBuffer.length / 1024) + 'KB -> ' + Math.round(outputBuffer.length / 1024) + 'KB)');
      }
    } catch (err) {
      console.warn('Build warning: failed to optimize image ' + src + ': ' + err.message);
    }
  }
}

async function build() {
  const siteJsonPath = path.join(ROOT, 'content', 'site.json');
  const siteJson = JSON.parse(fs.readFileSync(siteJsonPath, 'utf8'));
  const C = deepMerge(DEFAULT_CONTENT, siteJson);
  verifyContent(C);
  verifyGalleryImages(C);
  const seo = C.seo || {};
  const fallbackImage = 'https://karmazin.space/' + (C.master.photo || 'images/master-at-work.jpg');

  if (fs.existsSync(DIST)) fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });

  const assetsToCopy = ['images', 'admin', 'content', 'content.default.js', 'templates.js', 'favicon.ico', 'favicon-32.png', 'favicon-96.png', 'apple-touch-icon.png', 'robots.txt', 'sitemap.xml', 'googlec5a8428c6a8d807b.html', 'privacy.html'];
  for (const name of assetsToCopy) {
    const src = path.join(ROOT, name);
    if (fs.existsSync(src)) copyRecursive(src, path.join(DIST, name));
  }

  await convertHeicImages(C);
  await optimizeImages(C);

  let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

  const theme = C.theme || {};
  html = setRootVar(html, 'void', '#0d0c0e', theme.void);
  html = setRootVar(html, 'ink', '#17161a', theme.ink);
  html = setRootVar(html, 'crimson', '#8b1e3f', theme.crimson);
  html = setRootVar(html, 'crimson-bright', '#b23155', theme.crimsonBright);
  html = setRootVar(html, 'bone', '#e7dcc9', theme.bone);

  const embeddedJson = JSON.stringify(C).replace(/</g, '\\u003c');
  html = html.replace(
    /(<script type="application\/json" id="site-content-data">)([^<]*)(<\/script>)/,
    (m, open, _old, close) => open + embeddedJson + close
  );

  html = setInner(html, 'page-title', escapeHtml(seo.title || 'Karmazin Tattoo Studio'));
  html = setAttr(html, 'meta-description', 'content', seo.description || '');
  html = setAttr(html, 'meta-robots', 'content', seo.robots || 'index, follow');
  html = setAttr(html, 'meta-author', 'content', seo.author || 'Karmazin Tattoo Studio');
  html = setAttr(html, 'canonical-link', 'href', seo.canonicalUrl || 'https://karmazin.space/');
  html = setAttr(html, 'og-title', 'content', seo.ogTitle || seo.title || 'Karmazin Tattoo Studio');
  html = setAttr(html, 'og-description', 'content', seo.ogDescription || seo.description || '');
  html = setAttr(html, 'og-image', 'content', seo.ogImage || fallbackImage);
  html = setAttr(html, 'og-url', 'content', seo.ogUrl || seo.canonicalUrl || 'https://karmazin.space/');
  html = setAttr(html, 'twitter-title', 'content', seo.twitterTitle || seo.ogTitle || seo.title || 'Karmazin Tattoo Studio');
  html = setAttr(html, 'twitter-description', 'content', seo.twitterDescription || seo.ogDescription || seo.description || '');
  html = setAttr(html, 'twitter-image', 'content', seo.twitterImage || seo.ogImage || fallbackImage);

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'TattooParlor',
    name: 'Karmazin Tattoo Studio',
    url: seo.canonicalUrl || 'https://karmazin.space/',
    image: seo.ogImage || fallbackImage,
    telephone: C.phone || '',
    address: { '@type': 'PostalAddress', addressLocality: (C.contact && C.contact.city) || '', addressCountry: 'UA' },
    openingHours: (C.booking && C.booking.workHours) || ''
  };
  html = html.replace(
    /(<script type="application\/ld\+json" id="schema-json">)([^<]*)(<\/script>)/,
    (m, open, _old, close) => open + JSON.stringify(schema) + close
  );

  html = setAttr(html, 'nav-instagram', 'href', C.instagramUrl);
  html = setAttr(html, 'nav-instagram-mobile', 'href', C.instagramUrl);
  html = setAttr(html, 'nav-phone', 'href', 'tel:' + String(C.phone || '').replace(/[^\d+]/g, ''));
  html = setInner(html, 'nav-phone-text', escapeHtml(C.phone || ''));

  html = setInner(html, 'hero-eyebrow', escapeHtml(C.hero.eyebrow));
  html = setInner(html, 'hero-title',
    `${escapeHtml(C.hero.titleLine1)}<br>${escapeHtml(C.hero.titleLine2)}<br><em>${escapeHtml(C.hero.titleEm)}</em> ${escapeHtml(C.hero.titleLine3)}`);
  html = setInner(html, 'hero-lead', escapeHtml(C.hero.lead));
  html = setAttr(html, 'hero-cta-primary', 'href', C.instagramUrl);
  html = setInner(html, 'hero-cta-primary', escapeHtml(C.hero.ctaPrimary));
  html = setInner(html, 'hero-cta-secondary', escapeHtml(C.hero.ctaSecondary));
  html = setInner(html, 'hero-stamp',
    `${escapeHtml(C.hero.stampSmall)}<span class="big">${escapeHtml(C.hero.stampBig)}</span>${escapeHtml(C.hero.stampBottom)}`);

  html = setAttr(html, 'master-photo', 'src', C.master.photo || 'images/master-at-work.jpg');
  html = setInner(html, 'master-name', escapeHtml(C.master.name));
  html = setInner(html, 'master-bio1', escapeHtml(C.master.bio1));
  html = setInner(html, 'master-bio2', escapeHtml(C.master.bio2));
  html = setInner(html, 'stat1-num', escapeHtml(C.master.stat1Num));
  html = setInner(html, 'stat1-label', escapeHtml(C.master.stat1Label));
  html = setInner(html, 'stat2-num', escapeHtml(C.master.stat2Num));
  html = setInner(html, 'stat2-label', escapeHtml(C.master.stat2Label));
  html = setInner(html, 'stat3-num', escapeHtml(C.master.stat3Num));
  html = setInner(html, 'stat3-label', escapeHtml(C.master.stat3Label));

  html = setInner(html, 'styles-grid', C.styles.map(renderStyleCard).join(''));
  html = setInner(html, 'process-list', C.process.map(renderProcessItem).join(''));
  html = setInner(html, 'gallery-grid', C.gallery.map(renderGalleryCell).join(''));
  html = setInner(html, 'pricing-note', escapeHtml(C.pricing.note));
  html = setInner(html, 'pricing-grid', C.pricing.items.map(renderPriceCard).join(''));

  html = setInner(html, 'contact-heading', escapeHtml(C.contact.heading));
  html = setInner(html, 'contact-text', escapeHtml(C.contact.text));
  const cb = C.contactButtons || {};
  html = setAttr(html, 'contact-cta', 'href', cb.instagramUrl || C.instagramUrl);
  html = setInner(html, 'contact-cta', escapeHtml(cb.instagramLabel || ''));
  html = setOptionalLink(html, 'contact-cta-viber', cb.viberUrl, cb.viberLabel);
  html = setOptionalLink(html, 'contact-cta-telegram', normalizeTelegramUrl(cb.telegramUrl), cb.telegramLabel);
  html = setInner(html, 'contact-city', escapeHtml(C.contact.city));
  html = setInner(html, 'contact-address', escapeHtml((C.booking && C.booking.address) || ''));
  html = setInner(html, 'contact-workhours', escapeHtml((C.booking && C.booking.workHours) || ''));
  html = setInner(html, 'contact-format', escapeHtml(C.contact.format));
  html = setInner(html, 'contact-channel', escapeHtml(C.contact.channel));
  html = setInner(html, 'contact-sketch', escapeHtml(C.contact.sketch));

  html = setAttr(html, 'lb-instagram', 'href', C.instagramUrl);
  html = setInner(html, 'site-footer', escapeHtml(C.footer));

  fs.writeFileSync(path.join(DIST, 'index.html'), html, 'utf8');

  console.log('Build OK: dist/ generated with pre-rendered content from content/site.json');
}

build().catch(err => {
  console.error(err);
  process.exit(1);
});
