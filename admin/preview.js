(function () {
  function get(entry, path, fallback) {
    var v = entry.getIn(['data'].concat(path));
    return (v === undefined || v === null) ? fallback : v;
  }

  function getList(entry, path) {
    var v = entry.getIn(['data'].concat(path));
    if (v && typeof v.toJS === 'function') return v.toJS();
    return Array.isArray(v) ? v : [];
  }

  function themeVars(entry) {
    return {
      '--void': get(entry, ['theme', 'void'], '#0d0c0e'),
      '--ink': get(entry, ['theme', 'ink'], '#17161a'),
      '--crimson': get(entry, ['theme', 'crimson'], '#8b1e3f'),
      '--crimson-bright': get(entry, ['theme', 'crimsonBright'], '#b23155'),
      '--bone': get(entry, ['theme', 'bone'], '#e7dcc9')
    };
  }

  function renderHero(entry) {
    return h('div', { className: 'p-section p-hero' },
      h('div', { className: 'p-section-title' }, 'Головний екран'),
      h('div', { className: 'p-eyebrow' }, get(entry, ['hero', 'eyebrow'], '')),
      h('h1', {},
        get(entry, ['hero', 'titleLine1'], ''), h('br', {}),
        get(entry, ['hero', 'titleLine2'], ''), h('br', {}),
        h('em', {}, get(entry, ['hero', 'titleEm'], '')), ' ', get(entry, ['hero', 'titleLine3'], '')
      ),
      h('p', {}, get(entry, ['hero', 'lead'], '')),
      h('div', { className: 'p-cta-row' },
        h('span', { className: 'p-btn primary' }, get(entry, ['hero', 'ctaPrimary'], '')),
        h('span', { className: 'p-btn' }, get(entry, ['hero', 'ctaSecondary'], ''))
      )
    );
  }

  function renderMaster(entry) {
    return h('div', { className: 'p-section' },
      h('div', { className: 'p-section-title' }, 'Майстер'),
      h('div', { className: 'p-master' },
        h('div', {},
          h('h2', {}, get(entry, ['master', 'name'], '')),
          h('p', {}, get(entry, ['master', 'bio1'], '')),
          h('p', {}, get(entry, ['master', 'bio2'], ''))
        ),
        h('div', { className: 'p-stats' },
          h('div', { className: 'p-stat' }, h('b', {}, get(entry, ['master', 'stat1Num'], '')), h('span', {}, get(entry, ['master', 'stat1Label'], ''))),
          h('div', { className: 'p-stat' }, h('b', {}, get(entry, ['master', 'stat2Num'], '')), h('span', {}, get(entry, ['master', 'stat2Label'], ''))),
          h('div', { className: 'p-stat' }, h('b', {}, get(entry, ['master', 'stat3Num'], '')), h('span', {}, get(entry, ['master', 'stat3Label'], '')))
        )
      )
    );
  }

  function renderStyles(styles) {
    return h('div', { className: 'p-section' },
      h('div', { className: 'p-section-title' }, 'Стилі роботи'),
      h('div', { className: 'p-styles-grid' },
        styles.map(function (s, i) {
          return h('div', { className: 'p-style-card', key: i },
            h('span', { className: 'num' }, '0' + (i + 1)),
            h('h3', {}, s.title),
            h('p', {}, s.text)
          );
        })
      )
    );
  }

  function renderProcess(process) {
    return h('div', { className: 'p-section' },
      h('div', { className: 'p-section-title' }, 'Як проходить запис'),
      h('div', {},
        process.map(function (p, i) {
          return h('div', { className: 'p-process-item', key: i },
            h('div', { className: 'p-process-num' }, '0' + (i + 1)),
            h('div', {},
              h('h3', {}, p.title),
              h('p', {}, p.text)
            )
          );
        })
      )
    );
  }

  function renderGallery(gallery, getAsset) {
    return h('div', { className: 'p-section' },
      h('div', { className: 'p-section-title' }, 'Галерея робіт'),
      h('div', { className: 'p-gallery-grid' },
        gallery.map(function (g, i) {
          if (!g.src) {
            return h('div', { className: 'p-gallery-cell img-missing', key: i });
          }
          var url = g.src;
          try {
            var asset = getAsset(g.src);
            if (asset) url = asset.toString();
          } catch (e) {}
          return h('div', { className: 'p-gallery-cell', key: i },
            h('img', { src: url, alt: g.caption || '' }),
            h('div', { className: 'cap' }, g.caption || '')
          );
        })
      )
    );
  }

  function renderPricing(entry, items) {
    return h('div', { className: 'p-section' },
      h('div', { className: 'p-section-title' }, 'Ціни'),
      h('div', { className: 'p-pricing-note' }, get(entry, ['pricing', 'note'], '')),
      h('div', { className: 'p-pricing-grid' },
        items.map(function (p, i) {
          return h('div', { className: 'p-price-card', key: i },
            h('div', { className: 'p-name' }, p.name),
            h('div', { className: 'p-price' }, p.price),
            h('div', { className: 'p-note' }, p.note)
          );
        })
      )
    );
  }

  function renderContact(entry) {
    var igLabel = get(entry, ['contactButtons', 'instagramLabel'], '');
    var viberUrl = get(entry, ['contactButtons', 'viberUrl'], '');
    var viberLabel = get(entry, ['contactButtons', 'viberLabel'], '') || 'Viber';
    var telegramUrl = get(entry, ['contactButtons', 'telegramUrl'], '');
    var telegramLabel = get(entry, ['contactButtons', 'telegramLabel'], '') || 'Telegram';

    var buttons = [h('span', { className: 'p-btn primary', key: 'ig' }, igLabel)];
    buttons.push(h('span', { className: 'p-btn', key: 'booking' }, 'Записатися'));
    if (viberUrl) buttons.push(h('span', { className: 'p-btn', key: 'vb' }, viberLabel));
    if (telegramUrl) buttons.push(h('span', { className: 'p-btn', key: 'tg' }, telegramLabel));

    return h('div', { className: 'p-section' },
      h('div', { className: 'p-section-title' }, 'Блок запису'),
      h('div', { className: 'p-contact' },
        h('h2', {}, get(entry, ['contact', 'heading'], '')),
        h('p', {}, get(entry, ['contact', 'text'], '')),
        h('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '14px' } }, buttons),
        h('div', { style: { marginTop: '20px' } },
          h('div', { className: 'p-contact-row' }, h('span', {}, 'Місто'), h('span', {}, get(entry, ['contact', 'city'], ''))),
          h('div', { className: 'p-contact-row' }, h('span', {}, 'Адреса'), h('span', {}, get(entry, ['booking', 'address'], ''))),
          h('div', { className: 'p-contact-row' }, h('span', {}, 'Графік'), h('span', {}, get(entry, ['booking', 'workHours'], ''))),
          h('div', { className: 'p-contact-row' }, h('span', {}, 'Формат'), h('span', {}, get(entry, ['contact', 'format'], ''))),
          h('div', { className: 'p-contact-row' }, h('span', {}, 'Канал'), h('span', {}, get(entry, ['contact', 'channel'], ''))),
          h('div', { className: 'p-contact-row' }, h('span', {}, 'Ескіз'), h('span', {}, get(entry, ['contact', 'sketch'], '')))
        )
      )
    );
  }

  var ContentPreview = createClass({
    render: function () {
      var entry = this.props.entry;
      var getAsset = this.props.getAsset;

      return h('div', { className: 'preview-root', style: themeVars(entry) },
        renderHero(entry),
        renderMaster(entry),
        renderStyles(getList(entry, ['styles'])),
        renderProcess(getList(entry, ['process'])),
        renderGallery(getList(entry, ['gallery']), getAsset),
        renderPricing(entry, getList(entry, ['pricing', 'items'])),
        renderContact(entry),
        h('div', { className: 'p-footer' }, get(entry, ['footer'], ''))
      );
    }
  });

  CMS.registerPreviewStyle('https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
  CMS.registerPreviewStyle('/admin/preview.css');
  CMS.registerPreviewTemplate('content', ContentPreview);
})();
