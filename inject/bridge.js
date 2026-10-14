/*
 * Wazzap? köprüsü
 * WhatsApp Web'in üstüne giydirilen katman: tema, telefon modu, kısayollar,
 * bildirim köprüsü. Mesajlaşmaya, ağ trafiğine ve sayfanın kendi koduna dokunmaz.
 * Bu dosya Rust tarafında window.__WAP_BOOT__ ile birlikte sayfaya eklenir.
 */
(() => {
  'use strict';
  if (location.hostname !== 'web.whatsapp.com') return;
  if (window.__wap) return;

  const BOOT = window.__WAP_BOOT__ || {};
  let S = BOOT.settings || {};
  // Belge oluşturulurken documentElement henüz olmayabilir: her seferinde taze oku.
  const root = () => document.documentElement;

  /* ------------------------------------------------------------------ IPC */

  function invoke(cmd, args) {
    const t = window.__TAURI_INTERNALS__;
    if (!t || typeof t.invoke !== 'function') return Promise.reject(new Error('ipc yok'));
    return t.invoke(cmd, args || {});
  }
  const send = (kind, data) =>
    invoke('wa_event', { kind, data: data === undefined ? null : data }).catch(() => {});

  /* ------------------------------------------------------------------ dil */
  // Metinler Türkçe yazılır; İngilizce seçiliyse bu tablodan çevrilir. {0}, {1}: yer tutucular.
  const EN = {
      "Mini pencere (Ctrl+4)": "Mini window (Ctrl+4)",
      "Her zaman üstte (Ctrl+T)": "Always on top (Ctrl+T)",
      "Alta al": "Minimise",
      "Tam ekran": "Maximise",
      "Kapat": "Close",
      "Büyüt (Ctrl+4)": "Expand (Ctrl+4)",
      "Üstte kalmayı bırak (Ctrl+T)": "Stop staying on top (Ctrl+T)",
      "Önceki boyut": "Restore",
      "Sohbetlere dön (Esc)": "Back to chats (Esc)",
      "Sohbetlere dön": "Back to chats",
      "sohbet adı boş": "chat name is empty",
      "arama kutusu bulunamadı": "search box not found",
      "\"{0}\" adlı sohbet bulunamadı": "no chat named \"{0}\" found",
      "sohbet açılamadı": "could not open the chat",
      "mesaj yazı kutusuna yazılamadı": "could not type into the message box",
      "gönder düğmesi çalışmadı; mesaj yazı kutusunda bekliyor": "the send button did not work; the message is waiting in the message box",
      "yazı kutusu bulunamadı": "message box not found",
      "sohbette yarım kalmış bir taslak var; sil ve \"Şimdi gönder\"e bas": "the chat has an unsent draft; clear it and press \"Send now\"",
      "10 dakika sonra": "In 10 minutes",
      "1 saat sonra": "In 1 hour",
      "Bu akşam 21:00": "Tonight 21:00",
      "Yarın 09:00": "Tomorrow 09:00",
      "Zamanlı mesaj (Ctrl+Shift+Enter)": "Scheduled message (Ctrl+Shift+Enter)",
      "Zamanlı mesaj": "Scheduled message",
      "Zamanlanmış mesajı düzenle": "Edit scheduled message",
      "Mesajı zamanla": "Schedule message",
      "Mesaj yazın": "Type a message",
      "Gönderim zamanı": "Send time",
      "Kaydet": "Save",
      "Zamanla": "Schedule",
      "Mesaj boş": "Message is empty",
      "Zaman seçin": "Pick a time",
      "Yazı kutusundaki metni silin; yoksa gönderim takılır.": "Clear the message box, otherwise sending will get stuck.",
      "geçmişte": "in the past",
      "şimdi": "now",
      "{0} dakika sonra": "in {0} min",
      "{0} saat {1} dakika sonra": "in {0} h {1} min",
      "{0} saat sonra": "in {0} h",
      "{0} gün sonra": "in {0} days",
      "Bugün {0}": "Today {0}",
      "Yarın {0}": "Tomorrow {0}",
      "Yarın": "Tomorrow",
      "Zamanlanmış mesaj": "Scheduled message",
      "{0} zamanlanmış mesaj": "{0} scheduled messages",
      "Zamanlanmış mesaj, {0}": "Scheduled message, {0}",
      "Gönderiliyor": "Sending",
      "Kaçırıldı · {0}": "Missed · {0}",
      "Gönderilemedi": "Failed to send",
      "Şimdi gönder": "Send now",
      "Düzenle": "Edit",
      "Zamanlamayı iptal et": "Cancel schedule",
      "Gönderiliyor…": "Sending…",
      "Zamanlanmış": "Scheduled",
      "Gönderilmedi": "Not sent",
      "Daha az göster": "Show less",
      "{0} sohbet daha": "{0} more chats",
      "Zamanlanmış mesaj var": "Has a scheduled message",
      "Medya toplayıcı (Ctrl+Shift+M)": "Media collector (Ctrl+Shift+M)",
      "Medya toplayıcı": "Media collector",
      "Medya": "Media",
      "Klasörü aç": "Open folder",
      "Görseller": "Images",
      "Videolar": "Videos",
      "Belgeler": "Documents",
      "Yüklenmiş mesajlarda bu türde medya yok. Aşağıdan daha eski mesajları yükleyebilirsin.": "No media of this type in the loaded messages. You can load older messages below.",
      "Daha eskileri yükle": "Load older",
      "Durdur": "Stop",
      "{0} öğeyi kaydet": "Save {0} items",
      "Tümünü kaydet": "Save all",
      "Eski mesajlar yükleniyor": "Loading older messages",
      "Sohbetin başına ulaşıldı": "Reached the start of the chat",
      "mesaj artık sayfada değil; sohbette ona kaydır": "the message is no longer on the page; scroll to it in the chat",
      "belge düğmesi bulunamadı": "document button not found",
      "indirme başlamadı": "download did not start",
      "indirme başarısız": "download failed",
      "video açılamadı": "could not open the video",
      "görsel açılamadı": "could not open the image",
      "{0} / {1} kaydediliyor": "Saving {0} / {1}",
      "Durduruldu · {0} kaydedildi": "Stopped · {0} saved",
      "{0} kaydedildi, {1} kaydedilemedi": "{0} saved, {1} failed",
      "{0} öğe kaydedildi": "{0} items saved",
      "{0} öğe İndirilenler/Wazzap klasörüne kaydedildi": "{0} items saved to Downloads/Wazzap"
  };
  const isEn = () => (S.lang || 'tr') === 'en';
  const LOC = () => (isEn() ? 'en-GB' : 'tr-TR');
  function L(text, ...args) {
    let out = isEn() && EN[text] ? EN[text] : text;
    args.forEach((a, i) => { out = out.split('{' + i + '}').join(String(a)); });
    return out;
  }

  /* ------------------------------------------------------- dış bağlantılar */
  // Mesajlardaki linkler varsayılan tarayıcıda açılsın. WhatsApp bazen boş bir pencere açıp
  // adresini sonradan veriyor; pencere isteği uygulamada yakalanamadığı için burada çözülür.
  const isExternal = (u) => !!u && /^(https?|mailto|tel):$/.test(u.protocol)
    && !(u.protocol === 'https:' && u.host === 'web.whatsapp.com');
  const toUrl = (v) => { try { return new URL(String(v), location.href); } catch (e) { return null; } };
  function openExternal(v) {
    const u = toUrl(v);
    if (isExternal(u)) { send('open', u.href); return true; }
    return false;
  }
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || (e.button !== 0 && e.button !== 1)) return;
    const a = e.target && e.target.closest && e.target.closest('a[href]');
    if (!a || a.closest('.wap-panel, .wap-media, .wap-menu')) return;
    if (!isExternal(toUrl(a.getAttribute('href')))) return;
    e.preventDefault();
    e.stopPropagation();
    openExternal(a.href);
  }, true);
  document.addEventListener('auxclick', (e) => {
    const a = e.button === 1 && e.target && e.target.closest && e.target.closest('a[href]');
    if (a && isExternal(toUrl(a.getAttribute('href')))) { e.preventDefault(); e.stopPropagation(); openExternal(a.href); }
  }, true);
  const nativeOpen = window.open;
  window.open = function (url, target, features) {
    const u = url === undefined || url === null || url === '' ? null : toUrl(url);
    if (u && !isExternal(u)) return nativeOpen.call(window, url, target, features);
    if (u) { send('open', u.href); }
    // Boş pencere: adres sonradan verilince tarayıcıda aç.
    let done = !!u;
    const go = (v) => { if (!done && openExternal(v)) done = true; };
    const loc = { assign: go, replace: go, toString: () => 'about:blank' };
    Object.defineProperty(loc, 'href', { get: () => 'about:blank', set: go });
    const stub = { closed: false, opener: null, close() { this.closed = true; }, focus() {}, blur() {}, postMessage() {} };
    Object.defineProperty(stub, 'location', { get: () => loc, set: go });
    return stub;
  };

  /* ------------------------------------------------------- bildirim köprüsü */
  // WhatsApp Web bildirimleri tarayıcı Notification API'siyle gösterir. Burada onu
  // Windows bildirimine yönlendiriyoruz; izin her zaman "verildi" görünür.

  (function shimNotifications() {
    class WapNotification extends EventTarget {
      constructor(title, opts) {
        super();
        opts = opts || {};
        this.title = String(title == null ? '' : title);
        this.body = String(opts.body == null ? '' : opts.body);
        this.tag = String(opts.tag == null ? '' : opts.tag);
        this.icon = opts.icon || '';
        this.data = opts.data;
        this.silent = !!opts.silent;
        this.onclick = this.onclose = this.onerror = this.onshow = null;
        send('notify', { title: this.title, body: this.body, tag: this.tag });
        setTimeout(() => {
          const ev = new Event('show');
          this.dispatchEvent(ev);
          if (typeof this.onshow === 'function') this.onshow(ev);
        }, 0);
      }
      close() {}
      static get permission() { return 'granted'; }
      static requestPermission(cb) {
        if (typeof cb === 'function') cb('granted');
        return Promise.resolve('granted');
      }
      static get maxActions() { return 0; }
    }
    try {
      Object.defineProperty(window, 'Notification', {
        value: WapNotification, configurable: true, writable: true,
      });
    } catch (e) { /* yoksay */ }
    try {
      const perms = navigator.permissions;
      if (perms && perms.query) {
        const q = perms.query.bind(perms);
        perms.query = (d) => (d && d.name === 'notifications')
          ? Promise.resolve({
              state: 'granted', status: 'granted', name: 'notifications', onchange: null,
              addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; },
            })
          : q(d);
      }
    } catch (e) { /* yoksay */ }
    try {
      if (window.ServiceWorkerRegistration) {
        ServiceWorkerRegistration.prototype.showNotification = function (title, opts) {
          new WapNotification(title, opts);
          return Promise.resolve();
        };
      }
    } catch (e) { /* yoksay */ }
  })();

  /* ------------------------------------------------------------- stiller */
  // Sayfanın CSP kuralları <style> eklemeyi engelleyebilir; oluşturulabilir
  // stil sayfaları (adoptedStyleSheets) bundan etkilenmez.

  const sheets = {
    base: new CSSStyleSheet(),
    phone: new CSSStyleSheet(),
    theme: new CSSStyleSheet(),
    custom: new CSSStyleSheet(),
  };
  const OURS = [sheets.base, sheets.phone, sheets.theme, sheets.custom];
  const safeReplace = (sheet, text) => { try { sheet.replaceSync(text || ''); } catch (e) { /* geçersiz CSS */ } };
  safeReplace(sheets.base, BOOT.css && BOOT.css.base);
  safeReplace(sheets.phone, BOOT.css && BOOT.css.phone);

  function ensureSheets() {
    try {
      const cur = document.adoptedStyleSheets;
      if (OURS.every((s) => cur.includes(s))) return;
      document.adoptedStyleSheets = [...cur.filter((s) => !OURS.includes(s)), ...OURS];
    } catch (e) { /* yoksay */ }
  }
  ensureSheets();

  /* ------------------------------------------------------------- yazı tipi */
  // Inter, uygulamanın içinden bayt olarak yüklenir: sayfa dışarıdan font çekemez.

  (function loadFonts() {
    const F = BOOT.fonts || {};
    const ranges = {
      latin: 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
      ext: 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF',
    };
    for (const k of ['latin', 'ext']) {
      if (!F[k]) continue;
      try {
        const bin = atob(F[k]);
        const buf = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
        const face = new FontFace('WAP Inter', buf.buffer, {
          weight: '100 900', style: 'normal', unicodeRange: ranges[k],
        });
        document.fonts.add(face);
        face.load().catch(() => {});
      } catch (e) { /* yoksay */ }
    }
  })();

  /* ------------------------------------------------------------- renkler */

  const ctx = document.createElement('canvas').getContext('2d');
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const SKIP = /^(inherit|initial|unset|revert|none|transparent|currentcolor|auto|normal)$/i;

  function parseColor(v) {
    v = String(v || '').trim();
    if (!v || v.length > 80 || SKIP.test(v)) return null;
    // WhatsApp bazı renkleri "0, 168, 132" gibi üçlü olarak tutuyor: rgba(var(--x), .5)
    const tri = v.match(/^(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})$/);
    if (tri) return { r: +tri[1], g: +tri[2], b: +tri[3], a: 1, triplet: true };
    if (!/^(#|rgba?\(|hsla?\(|hwb\(|[a-z]+$)/i.test(v)) return null;
    ctx.fillStyle = '#010203';
    ctx.fillStyle = v;
    const out = String(ctx.fillStyle);
    if (out === '#010203' && v.toLowerCase() !== '#010203') return null;
    if (out[0] === '#') {
      return { r: parseInt(out.slice(1, 3), 16), g: parseInt(out.slice(3, 5), 16), b: parseInt(out.slice(5, 7), 16), a: 1 };
    }
    const m = out.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(',').map((s) => parseFloat(s));
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  }

  function hexToRgb(h) {
    const c = parseColor(h);
    return c ? [c.r, c.g, c.b] : [0, 0, 0];
  }
  const mix = (a, b, t) => [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t);
  const fmt = (rgb, a, triplet) => {
    const [r, g, b] = rgb.map((v) => Math.round(clamp(v, 0, 255)));
    if (triplet) return `${r}, ${g}, ${b}`;
    return a >= 0.999 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${+a.toFixed(3)})`;
  };
  function hsl(c) {
    const r = c.r / 255, g = c.g / 255, b = c.b / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const l = (mx + mn) / 2, d = mx - mn;
    let h = 0;
    if (d) {
      if (mx === r) h = ((g - b) / d) % 6;
      else if (mx === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    return { h, l, chroma: d };
  }
  const luminance = (rgb) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
  };

  /* ------------------------------------------------------- tema motoru */
  // WhatsApp'ın renk değişkenlerini adlarından bağımsız olarak yeniden haritalar:
  // nötr griler açıklık sırasına göre temanın zemin → yazı rampasına, yeşiller vurguya,
  // giden baloncuk tonu temanın baloncuk rengine gider. Ad ipuçları varsa önceliklidir.

  const KNOWN = [
    '--app-background', '--app-background-stripe', '--background-default', '--background-default-active',
    '--background-default-hover', '--background-lighter', '--background-lighter-active', '--background-lighter-hover',
    '--border-list', '--border-panel', '--border-stronger', '--bubble-meta', '--chat-meta',
    '--compose-input-background', '--compose-input-border', '--compose-panel-background',
    '--conversation-panel-background', '--drawer-background', '--drawer-background-deep',
    '--drawer-section-background', '--dropdown-background', '--dropdown-background-hover', '--icon',
    '--icon-high-emphasis', '--icon-lighter', '--incoming-background', '--incoming-background-deeper',
    '--intro-background', '--intro-border', '--list-meta', '--message-primary', '--modal-background',
    '--outgoing-background', '--outgoing-background-deeper', '--panel-background', '--panel-background-colored',
    '--panel-background-deeper', '--panel-background-lighter', '--panel-header-background', '--panel-header-icon',
    '--popup-panel-background', '--primary', '--primary-strong', '--primary-stronger', '--primary-strongest',
    '--primary-title', '--progress-primary', '--rich-text-panel-background', '--search-input-background',
    '--search-input-container-background', '--secondary', '--secondary-lighter', '--secondary-stronger',
    '--startup-background', '--system-message-background', '--teal', '--teal-hover', '--teal-lighter',
    '--unread-marker-background', '--unread-marker-text', '--button-primary-background',
    '--WDS-surface-default', '--WDS-surface-emphasized', '--WDS-surface-highlight', '--WDS-content-default',
    '--WDS-content-deemphasized', '--WDS-content-action-emphasized', '--WDS-accent', '--WDS-accent-deemphasized',
    '--WDS-bubble-surface-outgoing', '--WDS-bubble-surface-incoming', '--WDS-systems-bubble-surface-outgoing',
    '--WDS-systems-bubble-surface-incoming', '--WDS-surface-wallpaper',
  ];

  function probes() {
    const app = document.getElementById('app');
    return [root(), document.body, app, app && app.firstElementChild].filter(Boolean);
  }

  function collectNames() {
    const names = new Set(KNOWN);
    let enumerated = 0;
    for (const el of probes()) {
      try {
        const cs = getComputedStyle(el);
        for (let i = 0; i < cs.length; i++) {
          const p = cs[i];
          if (p.startsWith('--') && !p.startsWith('--wap-')) { names.add(p); enumerated++; }
        }
        for (let i = 0; i < el.style.length; i++) {
          const p = el.style[i];
          if (p.startsWith('--') && !p.startsWith('--wap-')) names.add(p);
        }
      } catch (e) { /* yoksay */ }
    }
    for (const sh of document.styleSheets) {
      let rules;
      try { rules = sh.cssRules; } catch (e) { continue; } // başka kökenden stil: okunamaz
      const walk = (list) => {
        for (const r of list) {
          if (r.style) for (let i = 0; i < r.style.length; i++) {
            const p = r.style[i];
            if (p.startsWith('--') && !p.startsWith('--wap-')) names.add(p);
          }
          if (r.cssRules) walk(r.cssRules);
        }
      };
      try { walk(rules); } catch (e) { /* yoksay */ }
    }
    return { names, enumerated };
  }

  /** Kendi tema katmanımızı kısa süre çıkarıp sayfanın özgün renklerini okur. */
  function readSource() {
    let cur = [];
    // Kopya al: adoptedStyleSheets canlı bir dizi, yerinde değişir.
    try { cur = [...document.adoptedStyleSheets]; } catch (e) { /* yoksay */ }
    try { document.adoptedStyleSheets = cur.filter((s) => s !== sheets.theme && s !== sheets.custom); } catch (e) { /* yoksay */ }
    const { names, enumerated } = collectNames();
    const values = new Map();
    for (const el of probes()) {
      const cs = getComputedStyle(el);
      for (const n of names) {
        const v = cs.getPropertyValue(n).trim();
        if (v) values.set(n, v);
      }
    }
    const vars = [];
    for (const [name, value] of values) {
      const c = parseColor(value);
      if (c) vars.push({ name, value, c, h: hsl(c) });
    }
    // Kaynak koyu mu açık mı?
    let srcDark = null;
    for (const el of [document.body, document.getElementById('app'), root()]) {
      if (!el) continue;
      const bg = parseColor(getComputedStyle(el).backgroundColor);
      if (bg && bg.a > 0.5) { srcDark = luminance([bg.r, bg.g, bg.b]) < 0.2; break; }
    }
    if (srcDark === null) {
      const cls = ((document.body && document.body.className) || '') + ' ' + (root() ? root().className : '');
      if (/\bdark\b/.test(cls)) srcDark = true;
      else if (/\blight\b/.test(cls)) srcDark = false;
      else srcDark = matchMedia('(prefers-color-scheme: dark)').matches;
    }
    try { document.adoptedStyleSheets = cur; } catch (e) { /* yoksay */ }
    return { vars, srcDark, nameCount: names.size, enumerated };
  }

  function themeRamp(T) {
    const stops = [
      [0, hexToRgb(T.bg)], [0.09, hexToRgb(T.panel)], [0.17, hexToRgb(T.line)],
      [0.6, hexToRgb(T.dim)], [1, hexToRgb(T.ink)],
    ];
    return (t) => {
      t = clamp(t, 0, 1);
      for (let i = 1; i < stops.length; i++) {
        if (t <= stops[i][0]) {
          const [t0, c0] = stops[i - 1], [t1, c1] = stops[i];
          return mix(c0, c1, (t - t0) / (t1 - t0 || 1));
        }
      }
      return stops[stops.length - 1][1];
    };
  }

  function mapVars(src, T) {
    const ramp = themeRamp(T);
    const bg = hexToRgb(T.bg), out = hexToRgb(T.outBubble), inn = hexToRgb(T.inBubble);
    const chat = hexToRgb(T.chatBg), accent = hexToRgb(T.accent);
    const neutrals = src.vars.filter((v) => v.c.a >= 0.9 && v.h.chroma < 0.12).map((v) => v.h.l);
    let lo = Math.min(...neutrals), hi = Math.max(...neutrals);
    if (neutrals.length < 4 || !(hi - lo > 0.3)) { lo = 0.04; hi = 0.96; }
    const decls = [];
    // Kişi fotoğrafı yer tutucuları, ses dalgası ve iş hesabı rozetleri kendi renginde kalsın.
    const KEEP = /profile-photo|ptt-|audio-|waveform|spinner|business|e2e|status-ring|presence/;
    for (const v of src.vars) {
      const n = v.name.toLowerCase();
      if (KEEP.test(n)) continue;
      const deeper = /deeper|deep\b|stronger/.test(n);
      let rgb = null;
      if (/outgoing|bubble-out|message-out|bubble-surface-outgoing/.test(n)) rgb = deeper ? mix(out, bg, 0.22) : out;
      else if (/incoming|bubble-in|message-in|bubble-surface-incoming/.test(n)) rgb = deeper ? mix(inn, bg, 0.22) : inn;
      else if (/wallpaper|conversation-panel-background|chat-background|conversation-background/.test(n)) rgb = chat;
      else if (v.c.a < 0.9 && !v.c.triplet) {
        // Yarı saydam griler: yazı tarafındaysa temanın yazı rengine, zemin tarafındaysa zemin rengine
        // döner; saydamlık korunur. (Açık modda soluk yazı "yarı saydam siyah"tır; koyu temada
        // olduğu gibi kalsa görünmez olurdu.) Gölgeler ve renkliler dokunulmadan kalır.
        if (v.h.chroma < 0.12 && !/shadow/.test(n)) {
          const inkSide = src.srcDark ? v.h.l > 0.5 : v.h.l < 0.5;
          rgb = inkSide ? hexToRgb(T.ink) : bg;
        }
      }
      else if (v.h.chroma < 0.12) {
        const t = src.srcDark ? (v.h.l - lo) / (hi - lo) : (hi - v.h.l) / (hi - lo);
        rgb = ramp(t);
      } else if (v.h.h >= 80 && v.h.h <= 200) {
        // WhatsApp yeşilleri: koyu modda koyu yeşil / açık modda açık yeşil = giden baloncuk tonu
        const bubbleTone = src.srcDark ? v.h.l < 0.3 : v.h.l > 0.78;
        rgb = bubbleTone ? out : accent;
      }
      if (rgb) decls.push(`${v.name}: ${fmt(rgb, v.c.a, v.c.triplet)} !important`);
    }
    return decls;
  }

  function fontStack(font) {
    if (!font || font === 'WhatsApp') return null;
    const fam = font === 'Inter' ? '"WAP Inter"' : `"${String(font).replace(/"/g, '')}"`;
    return `${fam}, "Segoe UI", system-ui, "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
  }

  let lastSource = null;

  function buildThemeCss() {
    const T = S.theme || {};
    const src = readSource();
    lastSource = src;
    const decls = mapVars(src, T);
    const dark = luminance(hexToRgb(T.bg)) < 0.3;
    const radius = +T.radius || 0;
    const font = fontStack(T.font);
    const wall = (T.wallpaper || '').trim();
    const scope = ':root, html, body, #app, #app > div, #app > div > div, #side, #main, [data-wap-pane], [data-wap-split]';
    let css = '';
    if (decls.length) css += `${scope} { ${decls.join('; ')}; }\n`;
    css += `:root {
      --wap-bg: ${T.bg}; --wap-panel: ${T.panel}; --wap-line: ${T.line}; --wap-dim: ${T.dim};
      --wap-ink: ${T.ink}; --wap-accent: ${T.accent}; --wap-accent-ink: ${T.accentInk};
      --wap-out: ${T.outBubble}; --wap-out-ink: ${T.outInk}; --wap-in: ${T.inBubble}; --wap-in-ink: ${T.inInk};
      --wap-chat-bg: ${T.chatBg};
      color-scheme: ${dark ? 'dark' : 'light'};
    }
    html, body { background: var(--wap-bg) !important; }
    #main { background-color: var(--wap-chat-bg) !important; }
    [data-wap-wall], #main [data-asset-chat-background-dark], #main [data-asset-chat-background-light], #main [data-testid^="conversation-background"] {
      background-color: var(--wap-chat-bg) !important;
      background-image: ${wall ? wall : 'none'} !important;
      background-size: cover !important; background-position: center !important;
      background-repeat: no-repeat !important; opacity: 1 !important;
    }
    [data-wap-bubble="out"] { background-color: var(--wap-out) !important; color: var(--wap-out-ink) !important; }
    [data-wap-bubble="in"] { background-color: var(--wap-in) !important; color: var(--wap-in-ink) !important; }
    ::selection { background: var(--wap-accent); color: var(--wap-accent-ink); }
    * { scrollbar-color: var(--wap-line) transparent; }
    `;
    if (radius > 0) css += `[data-wap-bubble] { border-radius: ${radius}px !important; }\n`;
    if (T.hideTails) css += `#main [data-icon^="tail-"], #main [data-icon*="tail-in"], #main [data-icon*="tail-out"] { display: none !important; }\n`;
    if (font) {
      css += `body, #app, #app :is(div, span, p, a, button, input, textarea, label, h1, h2, h3, h4, li, [contenteditable]) { font-family: ${font} !important; }\n`;
    }
    return css;
  }

  function rebuildTheme() {
    if (S.themeEnabled === false) {
      safeReplace(sheets.theme, '');
      return;
    }
    try {
      safeReplace(sheets.theme, buildThemeCss());
    } catch (e) {
      console.warn('[Wazzap] tema kurulamadı', e);
    }
  }

  /* ------------------------------------------------- düzen ve telefon modu */

  const ST = { split: null, list: null, chat: null, chatOpen: false, mainEl: null, header: '', drawer: false, wantPhone: null, failed: false, diagChat: false };
  let backBtn = null;

  function lca(a, b) {
    const seen = new Set();
    for (let n = a; n; n = n.parentElement) seen.add(n);
    for (let n = b; n; n = n.parentElement) if (seen.has(n)) return n;
    return null;
  }
  function childOf(anc, node) {
    let n = node;
    while (n && n.parentElement !== anc) n = n.parentElement;
    return n;
  }
  function setAttr(el, name, value) {
    if (el && el.getAttribute(name) !== value) el.setAttribute(name, value);
  }
  const follows = (a, b) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

  function discover() {
    const side = document.getElementById('side');
    if (!side) return;
    const main = document.getElementById('main');
    const app = document.getElementById('app');
    let split = ST.split && ST.split.isConnected && ST.split.contains(side) ? ST.split : null;
    if (main) {
      const a = lca(side, main);
      if (a && a !== side && a !== main) split = a;
    }
    if (!split) {
      // Sohbet açık değilken: #side'dan yukarı çıkıp yanında geniş bir kardeş olan ilk ataya bak.
      let el = side;
      while (el.parentElement && el.parentElement !== app && el !== document.body) {
        const p = el.parentElement;
        const wide = [...p.children].find((k) => k !== el && follows(el, k) && k.getBoundingClientRect().width > 200);
        if (wide) { split = p; break; }
        el = p;
      }
    }
    if (!split) return;

    if (split !== ST.split) {
      document.querySelectorAll('[data-wap-split],[data-wap-chain],[data-wap-pane]').forEach((n) => {
        n.removeAttribute('data-wap-split'); n.removeAttribute('data-wap-chain'); n.removeAttribute('data-wap-pane');
      });
      ST.split = split;
      split.setAttribute('data-wap-split', '');
      for (let n = split.parentElement; n && n !== app && n !== document.body; n = n.parentElement) {
        n.setAttribute('data-wap-chain', '');
      }
    }

    const list = childOf(split, side);
    setAttr(list, 'data-wap-pane', 'list');
    ST.list = list;

    let chat = main ? childOf(split, main) : null;
    if (!chat && ST.chat && ST.chat.parentElement === split) chat = ST.chat;
    if (!chat) {
      chat = [...split.children].find((k) => k !== list && follows(list, k) && k.getBoundingClientRect().width > 200) || null;
    }
    if (chat) { setAttr(chat, 'data-wap-pane', 'chat'); ST.chat = chat; }

    // WhatsApp'ın 2025 düzeni: [gezinme şeridi] [katmanlar: drawer-fullscreen, drawer-left/middle]
    // [liste] [sohbet] [modal katmanı] [sağ panel: kişi bilgisi] [bildirim kutusu].
    // Mutlak/sabit konumlu kardeşler katmandır: düzene girmezler, dokunulmaz.
    const drawers = [];
    for (const k of split.children) {
      if (k === list || k === chat) continue;
      const pos = getComputedStyle(k).position;
      if (pos === 'absolute' || pos === 'fixed') {
        setAttr(k, 'data-wap-pane', 'overlay');
      } else if (follows(k, list)) {
        // Listenin solunda kalan dar sütun: gezinme şeridi.
        if (k.getBoundingClientRect().width < 100) setAttr(k, 'data-wap-pane', 'rail');
      } else if (chat && follows(chat, k)) {
        setAttr(k, 'data-wap-pane', 'drawer');
        drawers.push(k);
      }
    }
    // Sağ panel açık mı? Telefon düzeni panelin genişliğini değiştirdiği için ölçümü
    // kendi kuralımızı bir an kaldırıp yapıyoruz (aynı karede, ekrana yansımaz).
    const r = root();
    const hidden = ['wap-drawer', 'wap-phone'].filter((c) => r.classList.contains(c));
    hidden.forEach((c) => r.classList.remove(c));
    let drawerOpen = false;
    for (const k of drawers) {
      const open = k.childElementCount > 0 && k.getBoundingClientRect().width > 1;
      if (open) drawerOpen = true;
      if (open !== k.hasAttribute('data-wap-open')) k.toggleAttribute('data-wap-open', open);
    }
    hidden.forEach((c) => r.classList.add(c));
    if (drawerOpen !== ST.drawer) {
      ST.drawer = drawerOpen;
      r.classList.toggle('wap-drawer', drawerOpen);
    }
  }

  // Eşik pencerenin gerçek (mantıksal) genişliğine göre: sayfa yakınlaştırması
  // CSS genişliğini büyüttüğü için innerWidth tek başına yanıltır.
  function zoomFactor() {
    const z = (!S.mode || S.mode === 'normal') ? S.zoom : S.phoneZoom;
    return (+z || 100) / 100;
  }
  const logicalWidth = () => window.innerWidth * zoomFactor();

  function updatePhone() {
    if (!root()) return;
    const mini = S.mode === 'mini';
    const want = mini || logicalWidth() < (+S.phoneBreakpoint || 600);
    if (want !== ST.wantPhone) {
      const first = ST.wantPhone === null;
      ST.wantPhone = want;
      ST.failed = false;
      if (want) setTimeout(() => safe('verify', verifyPhone), 700);
      if (!first) autoDiag(want ? 'telefon' : 'normal');
    }
    // Yapı tanınmadıysa telefon düzenini hiç açma: boş ekran yerine sıkışık ama çalışan düzen.
    const ready = !!(ST.split && ST.split.isConnected && ST.list && ST.list.isConnected);
    root().classList.toggle('wap-phone', want && ready && !ST.failed);
    root().classList.toggle('wap-mini', mini);
    if (mini && ST.split) {
      // Gezinme şeridini görünür alanın soluna it: açılır paneller konumlarını ona göre hesaplıyor.
      const rail = ST.split.querySelector(':scope > [data-wap-pane="rail"]');
      const w = rail ? rail.offsetWidth : 0;
      if (w) root().style.setProperty('--wap-rail-w', w + 'px');
    }
    ensureMiniBar();
  }

  /* ------------------------------------------------------------ başlık çubuğu */
  // Pencere çerçevesiz: başlık çubuğunu sayfa çiziyor (her modda). Sürükle, mini, sabitle,
  // alta al, tam ekran, kapat. Windows'taki gibi çift tık tam ekran yapar (mini pencerede büyütür).
  let miniBar = null;
  const WIN = { max: false };
  function capIcon(d) {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    for (const [k, v] of Object.entries({ width: 10, height: 10, viewBox: '0 0 10 10', fill: 'none', stroke: 'currentColor',
      'stroke-width': 1, 'shape-rendering': 'crispEdges', 'aria-hidden': 'true' })) svg.setAttribute(k, String(v));
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', d);
    svg.appendChild(p);
    return svg;
  }
  const PIN_D = 'M9 3h6M10 3v6l-3 4h10l-3-4V3M12 13v8';
  const onTop = () => (S.mode === 'mini' ? S.miniOnTop !== false : (!S.mode || S.mode === 'normal') ? !!S.alwaysOnTop : !!S.phoneOnTop);
  function barButton(cls, label, icon, action) {
    const b = iconButton('wap-minibar-btn ' + cls, label, icon);
    b.addEventListener('click', (e) => { e.stopPropagation(); send('action', action); });
    return b;
  }
  function ensureMiniBar() {
    if (!document.body) return;
    if (!miniBar || !miniBar.isConnected) {
      miniBar = mk('div', 'wap-minibar');
      miniBar.setAttribute('role', 'toolbar');
      const title = mk('span', 'wap-minibar-title', 'Wazzap?');
      const sep = mk('span', 'wap-minibar-sep');
      miniBar.append(
        title,
        barButton('wap-bar-mini', L('Mini pencere (Ctrl+4)'), svgIcon('M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7', 14), 'mini'),
        barButton('wap-bar-pin', L('Her zaman üstte (Ctrl+T)'), svgIcon(PIN_D, 14), 'ontop'),
        sep,
        barButton('wap-cap', L('Alta al'), capIcon('M0 5.5h10'), 'minimize'),
        barButton('wap-cap wap-bar-max', L('Tam ekran'), capIcon('M0.5 0.5h9v9h-9z'), 'maximize'),
        barButton('wap-cap wap-cap-close', L('Kapat'), capIcon('M0 0l10 10M10 0L0 10'), 'hide'),
      );
      // Tauri'nin sürükleme bölgesi gibi: ilk basış sürükler, ikinci basış (çift tık) büyütür.
      // Sürükleme Windows'un taşıma döngüsüne girdiği için dblclick olayı güvenilir gelmez.
      miniBar.addEventListener('mousedown', (e) => {
        if (e.button !== 0 || e.target.closest('button')) return;
        e.preventDefault();
        if (e.detail === 2) send('action', S.mode === 'mini' ? 'mini' : 'maximize');
        else if (e.detail === 1) send('action', 'drag');
      });
      document.body.appendChild(miniBar);
      miniBar.dataset.state = '';
    }
    root().classList.add('wap-bar');
    // Sayfa yakınlaştırması çubuğu büyütüp küçültmesin: her yakınlıkta aynı boyda kalsın.
    const zf = zoomFactor();
    const h = Math.round(30 / zf);
    root().style.setProperty('--wap-bar-h', h + 'px');
    miniBar.style.zoom = String(1 / zf);
    miniBar.style.fontFamily = waFont();
    const mini = S.mode === 'mini';
    const pinned = onTop();
    const key = [mini, pinned, WIN.max].join('|');
    if (miniBar.dataset.state !== key) {
      miniBar.dataset.state = key;
      const m = miniBar.querySelector('.wap-bar-mini');
      m.replaceChildren(svgIcon(mini ? 'M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7' : 'M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7', 14));
      m.title = mini ? L('Büyüt (Ctrl+4)') : L('Mini pencere (Ctrl+4)');
      m.setAttribute('aria-label', m.title);
      const p = miniBar.querySelector('.wap-bar-pin');
      p.classList.toggle('on', pinned);
      p.setAttribute('aria-pressed', String(pinned));
      p.title = pinned ? L('Üstte kalmayı bırak (Ctrl+T)') : L('Her zaman üstte (Ctrl+T)');
      const x = miniBar.querySelector('.wap-bar-max');
      x.replaceChildren(capIcon(WIN.max ? 'M2.5 2.5V0.5h7v7h-2M0.5 2.5h7v7h-7z' : 'M0.5 0.5h9v9h-9z'));
      x.title = WIN.max ? L('Önceki boyut') : L('Tam ekran');
      x.setAttribute('aria-label', x.title);
      x.hidden = mini;
    }
    const t = miniBar.querySelector('.wap-minibar-title');
    const chat = mini ? currentChatTitle() : '';
    const name = chat || 'Wazzap?';
    if (t.textContent !== name) t.textContent = name;
  }
  function setWin(next) {
    if (next && typeof next === 'object') Object.assign(WIN, next);
    safe('bar', ensureMiniBar);
  }

  /** Telefon düzeni açıldıktan sonra gerçekten bir panel görünüyor mu? Görünmüyorsa geri al. */
  function verifyPhone() {
    if (!root().classList.contains('wap-phone')) return;
    const drawer = ST.drawer && ST.split
      ? ST.split.querySelector(':scope > [data-wap-pane="drawer"][data-wap-open]')
      : null;
    const pane = !ST.chatOpen ? (document.getElementById('pane-side') || ST.list)
      : (drawer || document.getElementById('main') || ST.chat);
    const r = pane ? pane.getBoundingClientRect() : null;
    const ok = r && r.width >= window.innerWidth * 0.7 && r.height >= window.innerHeight * 0.4
      && r.left > -20 && r.left < window.innerWidth * 0.3;
    if (!ok) {
      ST.failed = true;
      root().classList.remove('wap-phone');
      note('telefon düzeni doğrulanamadı', r ? [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)].join(',') : 'panel yok');
      autoDiag('telefon-hata', true);
    }
  }

  function setChat(open) {
    ST.chatOpen = open;
    root().classList.toggle('wap-chat', open);
  }

  function headerKey(main) {
    const h = main.querySelector('header');
    if (!h) return '';
    const name = h.querySelector('span[dir="auto"]') || h.querySelector('span[title]');
    return name ? (name.textContent || '').slice(0, 120) : '';
  }

  function trackChat() {
    const main = document.getElementById('main');
    if (!main) {
      if (ST.mainEl) { ST.mainEl = null; ST.header = ''; setChat(false); }
      return;
    }
    const key = headerKey(main);
    if (main !== ST.mainEl || (key && key !== ST.header)) {
      ST.mainEl = main;
      ST.header = key;
      setChat(true);
      STICK.at = true;
      pinToBottom();
    }
    ensureStick();
  }

  /* Sohbet açılınca son mesaj en altta görünsün. WhatsApp okunmamış mesajlara ya da
     yerleşim oturmadan önceki bir konuma kaydırabiliyor (telefon düzeninde panel genişliği
     açılıştan hemen sonra değişiyor). Kısa bir süre en alta sabitle; kullanıcı kendisi
     kaydırırsa hemen bırak. */
  let pinTimer = 0;
  function chatScroller() {
    const box = messagesBox();
    if (box && box.scrollHeight > box.clientHeight) return box;
    // Yedek: son mesajın kaydırılabilen atası.
    const rows = document.querySelectorAll('#main [role="row"]');
    let el = rows.length ? rows[rows.length - 1] : null;
    while (el && el !== document.body) {
      const cs = getComputedStyle(el);
      if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight) return el;
      el = el.parentElement;
    }
    return box;
  }
  /* Alta yapışma: sohbetin en altındayken yeni mesaj gelirse (pencere odakta olmasa da)
     en altta kal. WhatsApp pencere odakta değilken yeni mesajları okunmamış sayıp konumu
     koruyor; bu yüzden bazen mesaj aşağıda, görünüm yukarıda kalıyordu. Kullanıcı yukarı
     kaydırmışsa dokunulmaz. */
  const STICK = { box: null, content: null, at: true, mo: null, ro: null };
  const nearBottom = (b) => b.scrollHeight - b.scrollTop - b.clientHeight < 80;
  function stickNow() {
    const b = STICK.box;
    if (b && b.isConnected && STICK.at) b.scrollTop = b.scrollHeight;
  }
  function ensureStick() {
    const box = document.getElementById('main') ? chatScroller() : null;
    const content = box ? box.firstElementChild : null;
    if (box === STICK.box && content === STICK.content) return;
    if (STICK.mo) STICK.mo.disconnect();
    if (STICK.ro) STICK.ro.disconnect();
    STICK.box = box;
    STICK.content = content;
    if (!box) return;
    if (box !== STICK.lastBox) { STICK.at = true; STICK.lastBox = box; }
    STICK.mo = new MutationObserver(stickNow);
    STICK.mo.observe(box, { childList: true, subtree: true });
    if (window.ResizeObserver && content) {
      // Görseller sonradan yüklenip yüksekliği değiştirdiğinde de altta kal.
      STICK.ro = new ResizeObserver(stickNow);
      STICK.ro.observe(content);
    }
  }
  document.addEventListener('scroll', (e) => {
    if (e.target === STICK.box) STICK.at = nearBottom(STICK.box);
  }, true);
  window.addEventListener('focus', () => safe('stick', stickNow));

  function pinToBottom() {
    clearInterval(pinTimer);
    const started = Date.now();
    let stopped = false;
    let lastBox = null;
    const stop = () => { stopped = true; };
    const opts = { passive: true, capture: true };
    const watch = (box) => {
      ['wheel', 'touchstart', 'pointerdown', 'keydown'].forEach((t) => box.addEventListener(t, stop, opts));
    };
    const unwatch = (box) => {
      ['wheel', 'touchstart', 'pointerdown', 'keydown'].forEach((t) => box.removeEventListener(t, stop, opts));
    };
    pinTimer = setInterval(() => {
      const box = chatScroller();
      if (box && box !== lastBox) { if (lastBox) unwatch(lastBox); watch(box); lastBox = box; }
      if (stopped || Date.now() - started > 2500 || !document.getElementById('main')) {
        clearInterval(pinTimer);
        if (lastBox) unwatch(lastBox);
        return;
      }
      if (box) box.scrollTop = box.scrollHeight;
    }, 60);
  }

  function goBack() {
    setChat(false);
    // Sohbeti WhatsApp tarafında da kapat: açık ama görünmez sohbetteki yeni
    // mesajlar okundu sayılmasın. WhatsApp Web'de Esc sohbeti kapatır.
    const target = document.activeElement && document.activeElement !== document.body
      ? document.activeElement
      : (document.getElementById('main') || document.body);
    const init = { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true };
    try {
      target.dispatchEvent(new KeyboardEvent('keydown', init));
      target.dispatchEvent(new KeyboardEvent('keyup', init));
    } catch (e) { /* yoksay */ }
  }

  function ensureBackButton() {
    if (backBtn && backBtn.isConnected) return;
    if (!document.body) return;
    backBtn = document.createElement('button');
    backBtn.id = 'wap-back';
    backBtn.type = 'button';
    backBtn.title = L('Sohbetlere dön (Esc)');
    backBtn.setAttribute('aria-label', L('Sohbetlere dön'));
    // innerHTML yerine DOM ile: sayfa ileride Trusted Types açarsa da çalışsın.
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    for (const [k, v] of Object.entries({ width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
      'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' })) svg.setAttribute(k, String(v));
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', 'M15 18l-6-6 6-6');
    svg.appendChild(path);
    backBtn.appendChild(svg);
    backBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); goBack(); });
    document.body.appendChild(backBtn);
  }

  function placeBackButton() {
    if (!backBtn || !ST.chatOpen) return;
    const h = document.querySelector('#main header');
    if (!h) return;
    const r = h.getBoundingClientRect();
    if (!r.height) return;
    backBtn.style.top = Math.round(r.top + r.height / 2 - 16) + 'px';
    backBtn.style.left = Math.round(r.left + 6) + 'px';
  }

  /* --------------------------------------------------- mesaj baloncukları */

  const isClear = (bg) => !bg || bg === 'transparent' || /rgba\(\s*0,\s*0,\s*0,\s*0\s*\)/.test(bg);

  function findBubble(row) {
    const rw = row.getBoundingClientRect().width || 1;
    const queue = [[row, 0]];
    while (queue.length) {
      const [el, depth] = queue.shift();
      if (depth > 8) continue;
      for (const k of el.children) {
        if (k.tagName === 'svg' || k.tagName === 'IMG' || k.tagName === 'CANVAS') continue;
        const cs = getComputedStyle(k);
        if (!isClear(cs.backgroundColor) && cs.backgroundImage === 'none') {
          const r = k.getBoundingClientRect();
          if (r.width > 24 && r.width < rw * 0.97 && r.height > 16) return k;
        }
        queue.push([k, depth + 1]);
      }
    }
    return null;
  }

  function tagBubbles(main) {
    const rows = main.querySelectorAll('[data-id]:not([data-wap-seen])');
    let n = 0;
    for (const row of rows) {
      if (n++ > 120) break; // bir turda en fazla bu kadar; kalanlar sonraki turda
      row.setAttribute('data-wap-seen', '');
      const id = row.getAttribute('data-id') || '';
      const outCls = row.matches('.message-out') || !!row.querySelector('.message-out');
      const inCls = row.matches('.message-in') || !!row.querySelector('.message-in');
      const idOut = /^true_/.test(id), idIn = /^false_/.test(id);
      if (!outCls && !inCls && !idOut && !idIn) continue;
      const out = outCls || (!inCls && idOut);
      const b = findBubble(row);
      if (b) b.setAttribute('data-wap-bubble', out ? 'out' : 'in');
    }
    return rows.length > n;
  }

  function tagWallpaper(main) {
    if (main.querySelector('[data-wap-wall]')) return;
    if (main.querySelector('[data-asset-chat-background-dark],[data-asset-chat-background-light]')) return;
    const mr = main.getBoundingClientRect();
    const area = mr.width * mr.height;
    if (!area) return;
    const all = main.querySelectorAll('div');
    for (let i = 0; i < all.length && i < 60; i++) {
      const el = all[i];
      const bi = getComputedStyle(el).backgroundImage;
      if (bi && bi.includes('url(')) {
        const r = el.getBoundingClientRect();
        if (r.width * r.height > area * 0.5) { el.setAttribute('data-wap-wall', ''); return; }
      }
    }
  }

  /* ------------------------------------------------------------ döngü */

  let pending = false;
  let themedOnce = false;

  // Her adım ayrı korunur: biri patlarsa diğerleri çalışmaya devam eder, hata tanılamaya yazılır.
  const ERRORS = [];
  function note(at, msg, stack) {
    if (ERRORS.length >= 40) return;
    ERRORS.push({ at, msg: String(msg).slice(0, 300), stack: stack ? String(stack).split('\n').slice(0, 4).join(' | ').slice(0, 600) : undefined, t: Math.round(performance.now()) });
  }
  function safe(at, fn) {
    try { return fn(); } catch (e) { note(at, (e && e.message) || e, e && e.stack); return undefined; }
  }

  function process() {
    pending = false;
    safe('sheets', ensureSheets);
    safe('back', ensureBackButton);
    safe('discover', discover);
    safe('chat', trackChat);
    safe('phone', updatePhone);
    safe('backpos', placeBackButton);
    safe('fab', () => { ensureFab(); placeFab(); placePanel(); ensureMediaFab(); placeMediaFab(); placeMediaPanel(); });
    if (mediaPanel && mediaPanel.dataset.chat !== currentChatTitle()) closeMedia();
    else if (mediaPanel && !MEDIA.busy) safe('media-scan', () => { const n = MEDIA.items.size; scanMedia(); if (MEDIA.items.size !== n) renderMedia(); });
    safe('ghosts', () => { if (currentChatTitle() !== ghostChat) refreshGhosts(); else renderGhosts(); });
    safe('sched-list', renderSchedList);
    safe('row-clocks', markRows);
    if (!ST.allLoaded && document.getElementById('pane-side')) { ST.allLoaded = true; refreshAll(); }
    if (panel && panel.dataset.chat !== currentChatTitle()) closePanel();
    if (!themedOnce && document.getElementById('side')) {
      themedOnce = true;
      safe('theme', rebuildTheme); // WhatsApp'ın stilleri artık yüklü: renkleri yeniden oku
      autoDiag('acilis');
    }
    const main = document.getElementById('main');
    if (main && !ST.diagChat) { ST.diagChat = true; autoDiag('sohbet'); }
    if (main && S.themeEnabled !== false) {
      safe('wall', () => tagWallpaper(main));
      if (safe('bubbles', () => tagBubbles(main))) schedule();
    }
  }

  function schedule() {
    if (pending) return;
    pending = true;
    setTimeout(process, 120);
  }

  /* ------------------------------------------- sohbet açma, yazma, gönderme */
  // Bildirime tıklayınca sohbeti açmak ve zamanlı mesajlar için. WhatsApp'ın kendi
  // arayüzünü kullanır: listeden ya da aramadan sohbeti seçer, yazı kutusuna yazar, gönder'e basar.

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, ms, step) {
    const end = Date.now() + ms;
    for (;;) {
      const v = safe('wait', fn);
      if (v) return v;
      if (Date.now() >= end) return null;
      await sleep(step || 100);
    }
  }
  // Yön işaretleri ve sıfır genişlikli karakterler adlarda görünmez ama karşılaştırmayı bozar.
  const norm = (s) => String(s == null ? '' : s).replace(/[​-‏‪-‮⁦-⁩﻿]/g, '').replace(/\s+/g, ' ').trim();
  const coded = (code, msg) => { const e = new Error(msg); e.code = code; return e; };

  function currentChatTitle() {
    const main = document.getElementById('main');
    if (!main) return null;
    const h = main.querySelector('[data-testid="conversation-info-header"]') || main.querySelector('header');
    if (!h) return null;
    const sp = h.querySelector('span[dir="auto"]') || h.querySelector('span[title]');
    return sp ? norm(sp.textContent || sp.getAttribute('title')) : null;
  }

  function findRow(title) {
    const pane = document.getElementById('pane-side');
    if (!pane) return null;
    for (const row of pane.querySelectorAll('[role="row"], [role="listitem"]')) {
      const name = row.querySelector('span[title]'); // satırdaki ilk başlıklı metin sohbet adıdır
      if (name && norm(name.getAttribute('title')) === title) return row;
    }
    return null;
  }

  function press(el) {
    const r = el.getBoundingClientRect();
    const o = {
      bubbles: true, cancelable: true, view: window, button: 0, buttons: 1,
      clientX: r.left + Math.min(r.width / 2, 80), clientY: r.top + r.height / 2,
    };
    const up = Object.assign({}, o, { buttons: 0 });
    el.dispatchEvent(new PointerEvent('pointerdown', o));
    el.dispatchEvent(new MouseEvent('mousedown', o));
    el.dispatchEvent(new PointerEvent('pointerup', up));
    el.dispatchEvent(new MouseEvent('mouseup', up));
    el.dispatchEvent(new MouseEvent('click', up));
  }

  function searchBox() {
    const c = document.querySelector('[data-testid="chat-list-search-container"]') || document.getElementById('side');
    return c && (c.querySelector('[contenteditable="true"]') || c.querySelector('input'));
  }

  function selectAllIn(el) {
    el.focus();
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') { el.select(); return; }
    const sel = getSelection();
    sel.removeAllRanges();
    const range = document.createRange();
    range.selectNodeContents(el);
    sel.addRange(range);
  }

  function setSearch(text) {
    const box = searchBox();
    if (!box) return false;
    selectAllIn(box);
    if (text) document.execCommand('insertText', false, text);
    else document.execCommand('delete');
    return true;
  }

  async function openChat(title) {
    const want = norm(title);
    if (!want) throw new Error(L('sohbet adı boş'));
    if (!await waitFor(() => document.getElementById('pane-side'), 20000, 250)) {
      throw coded('hazir-degil', 'WhatsApp henüz yüklenmedi');
    }
    if (currentChatTitle() === want) return true;
    let row = findRow(want);
    let searched = false;
    try {
      if (!row) {
        if (!setSearch(title)) throw new Error(L('arama kutusu bulunamadı'));
        searched = true;
        row = await waitFor(() => findRow(want), 6000, 150);
      }
      if (!row) throw new Error(L('"{0}" adlı sohbet bulunamadı', want));
      row.scrollIntoView({ block: 'nearest' });
      press(row.querySelector('span[title]') || row);
      if (!await waitFor(() => currentChatTitle() === want, 6000, 120)) throw new Error(L('sohbet açılamadı'));
      setChat(true);
      return true;
    } finally {
      if (searched) safe('search-clear', () => { setSearch(''); const b = searchBox(); if (b) b.blur(); });
    }
  }

  function composer() {
    const box = document.querySelector('#main [data-testid="compose-box"]') || document.querySelector('#main footer');
    return box ? box.querySelector('[contenteditable="true"]') : null;
  }
  const textOf = (el) => norm(el ? (el.innerText || el.textContent || '') : '');

  function clearComposer() {
    const el = composer();
    if (!el || textOf(el) === '') return true;
    selectAllIn(el);
    document.execCommand('delete');
    return textOf(el) === '';
  }

  async function insertComposer(el, text) {
    const want = norm(text);
    el.focus();
    const sel = getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
    // 1) Yapıştırma: WhatsApp'ın yazı kutusu çok satırlı metni en temiz böyle alıyor.
    try {
      const dt = new DataTransfer();
      dt.setData('text/plain', text);
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    } catch (e) { /* yoksay */ }
    if (await waitFor(() => textOf(el) === want, 800, 80)) return 'paste';
    // 2) Yedek yol: satır satır yaz, satır sonları için Shift+Enter.
    if (textOf(el) !== '') { selectAllIn(el); document.execCommand('delete'); }
    el.focus();
    text.split('\n').forEach((line, i) => {
      if (i > 0) {
        const ev = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, shiftKey: true, bubbles: true, cancelable: true });
        if (el.dispatchEvent(ev)) document.execCommand('insertLineBreak');
      }
      if (line) document.execCommand('insertText', false, line);
    });
    if (await waitFor(() => textOf(el) === want, 1200, 80)) return 'type';
    throw new Error(L('mesaj yazı kutusuna yazılamadı'));
  }

  function sendButton() {
    const box = document.querySelector('#main footer') || document.getElementById('main');
    if (!box) return null;
    const icon = box.querySelector('[data-icon*="send"]');
    if (icon) return icon.closest('button, [role="button"]') || icon;
    return box.querySelector('button[aria-label="Gönder"], button[aria-label="Send"], [role="button"][aria-label="Gönder"]');
  }

  async function sendComposer(el) {
    const btn = await waitFor(sendButton, 1500, 100);
    if (btn) press(btn);
    else el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
    if (!await waitFor(() => textOf(el) === '', 5000, 100)) throw new Error(L('gönder düğmesi çalışmadı; mesaj yazı kutusunda bekliyor'));
  }

  let sending = false;
  async function sendScheduled(item) {
    const report = (ok, error, code) => send('scheduled-result', { id: item.id, ok, error: error || null, code: code || null });
    if (sending) { report(false, 'başka bir gönderim sürüyor', 'hazir-degil'); return; }
    sending = true;
    const prev = currentChatTitle();
    const target = norm(item.chat);
    try {
      await openChat(item.chat);
      const el = await waitFor(composer, 4000, 100);
      if (!el) throw new Error(L('yazı kutusu bulunamadı'));
      if (textOf(el) !== '') throw new Error(L('sohbette yarım kalmış bir taslak var; sil ve "Şimdi gönder"e bas'));
      await insertComposer(el, String(item.text || ''));
      await sendComposer(el);
      report(true);
    } catch (e) {
      report(false, (e && e.message) || String(e), e && e.code);
    } finally {
      sending = false;
      // Kullanıcının baktığı yere geri dön.
      try {
        if (prev && prev !== target) await openChat(prev);
        else if (!prev && currentChatTitle() === target) goBack();
      } catch (e) { /* yoksay */ }
    }
  }

  /* ------------------------------------------------------ zamanlama paneli */

  let fab = null;
  let panel = null;
  const mk = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  function clockIcon(size) {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    for (const [k, v] of Object.entries({ width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
      'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' })) svg.setAttribute(k, String(v));
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', '12'); c.setAttribute('cy', '12'); c.setAttribute('r', '9');
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', 'M12 7v5l3 2');
    svg.append(c, p);
    return svg;
  }

  const pad = (n) => String(n).padStart(2, '0');
  function toLocalInput(ms) {
    const d = new Date(ms);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  const fromLocalInput = (v) => (v ? new Date(v).getTime() : NaN);
  function at(daysAhead, h, m) {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    d.setHours(h, m, 0, 0);
    return d.getTime();
  }
  function inAnHour() {
    const d = new Date(Date.now() + 3600 * 1000);
    d.setSeconds(0, 0);
    d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5);
    return d.getTime();
  }
  function minutesFromNow(n) {
    const d = new Date(Date.now() + n * 60 * 1000);
    d.setSeconds(0, 0);
    return d.getTime();
  }
  function quickTimes() {
    const out = [[L('10 dakika sonra'), () => minutesFromNow(10)], [L('1 saat sonra'), inAnHour]];
    if (new Date().getHours() < 20) out.push([L('Bu akşam 21:00'), () => at(0, 21, 0)]);
    out.push([L('Yarın 09:00'), () => at(1, 9, 0)]);
    return out;
  }

  function ensureFab() {
    if (fab && fab.isConnected) return;
    if (!document.body) return;
    fab = mk('button', 'wap-fab');
    fab.type = 'button';
    fab.title = L('Zamanlı mesaj (Ctrl+Shift+Enter)');
    fab.setAttribute('aria-label', L('Zamanlı mesaj'));
    fab.appendChild(clockIcon(20));
    fab.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (panel) closePanel(); else openPanelFromComposer();
    });
    document.body.appendChild(fab);
  }

  function composeBox() {
    return document.querySelector('#main [data-testid="compose-box"]') || document.querySelector('#main footer');
  }

  function placeFab() {
    if (!fab) return;
    const box = composeBox();
    const hidden = !box || panel || (root().classList.contains('wap-phone') && ST.drawer);
    if (hidden) {
      fab.style.display = 'none';
      if (panel && !box) closePanel();
      return;
    }
    const r = box.getBoundingClientRect();
    if (!r.width) { fab.style.display = 'none'; return; }
    // Sol alt: sağ altta WhatsApp'ın "en alta in" oku çıkıyor.
    const left = Math.round(r.left + 14);
    const top = Math.round(r.top - 42 - 12);
    fab.style.display = 'flex';
    fab.style.left = left + 'px';
    fab.style.top = top + 'px';
    // Düğmenin altında sohbet yoksa (medya görüntüleyici, açılır pencere vb. üstünü kaplıyorsa) gizle.
    const under = document.elementsFromPoint(left + 21, top + 21).find((n) => n !== fab && !fab.contains(n));
    const main = document.getElementById('main');
    const ok = !!(under && main && main.contains(under));
    if (!ok) fab.style.display = 'none';
    ST.fab = { shown: ok, at: [left, top], under: under ? describe(under) : null };
  }

  function placePanel() {
    if (!panel) return;
    const box = composeBox();
    if (!box) { closePanel(); return; }
    const r = box.getBoundingClientRect();
    const w = Math.max(260, Math.min(380, r.width - 16));
    panel.style.width = w + 'px';
    panel.style.left = Math.round(Math.max(8, Math.min(r.left + 8, window.innerWidth - w - 8))) + 'px';
    panel.style.bottom = Math.round(window.innerHeight - r.top + 8) + 'px';
  }

  function closePanel() {
    if (panel) panel.remove();
    panel = null;
    placeFab();
  }

  function openPanelFromComposer() {
    const c = composer();
    const draft = c ? String(c.innerText || '').replace(/​/g, '').trim() : '';
    openPanel({ text: draft, fromComposer: draft !== '' });
  }

  // WhatsApp'ın yazı tipini al: panel <body> içinde, WhatsApp'ın yazı tipi kuralları #app altında.
  function waFont() {
    const ref = document.getElementById('main') || document.getElementById('side') || document.body;
    return ref ? getComputedStyle(ref).fontFamily : '';
  }

  function iconButton(cls, label, icon) {
    const b = mk('button', cls);
    b.type = 'button';
    b.setAttribute('aria-label', label);
    b.title = label;
    b.appendChild(icon);
    return b;
  }
  function svgIcon(d, size) {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    for (const [k, v] of Object.entries({ width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
      'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' })) svg.setAttribute(k, String(v));
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', d);
    svg.appendChild(p);
    return svg;
  }

  /**
   * Zamanlama paneli. opts: { text, fromComposer, item } — item verilirse düzenleme kipi.
   * Görünüm WhatsApp'ın kendi açılır pencereleri gibi; renkler WhatsApp değişkenlerinden.
   */
  function openPanel(opts) {
    opts = opts || {};
    const title = currentChatTitle();
    if (!title) return;
    const editing = opts.item || null;
    let fromComposer = !!opts.fromComposer;
    if (panel) panel.remove();
    closeMenu();
    panel = mk('div', 'wap-panel');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', editing ? L('Zamanlanmış mesajı düzenle') : L('Mesajı zamanla'));
    panel.dataset.chat = title;
    panel.style.fontFamily = waFont();

    const head = mk('div', 'wap-panel-head');
    const x = iconButton('wap-icon-btn', L('Kapat'), svgIcon('M18 6 6 18M6 6l12 12', 20));
    x.addEventListener('click', closePanel);
    const titles = mk('div', 'wap-panel-titles');
    titles.append(mk('div', 'wap-panel-title', editing ? L('Zamanlanmış mesajı düzenle') : L('Mesajı zamanla')), mk('div', 'wap-panel-sub', title));
    head.append(x, titles);

    const ta = mk('textarea', 'wap-input wap-ta');
    ta.rows = 3;
    ta.placeholder = L('Mesaj yazın');
    ta.value = editing ? editing.text : (opts.text || '');

    const due0 = editing ? Math.max(editing.due, Date.now() + 5 * 60 * 1000) : inAnHour();
    const dt = mk('input', 'wap-input wap-dt');
    dt.type = 'datetime-local';
    dt.step = 60;
    dt.value = toLocalInput(due0);
    dt.setAttribute('aria-label', L('Gönderim zamanı'));

    const when = mk('div', 'wap-when');
    const updateWhen = () => {
      const due = fromLocalInput(dt.value);
      when.textContent = Number.isFinite(due) ? relTime(due) + ' · ' + untilText(due) : '';
      when.classList.toggle('wap-when-bad', Number.isFinite(due) && due < Date.now() + 30000);
    };
    const whenTimer = setInterval(() => { if (!when.isConnected) clearInterval(whenTimer); else updateWhen(); }, 20000);

    const chips = mk('div', 'wap-chips');
    for (const [label, fn] of quickTimes()) {
      const b = mk('button', 'wap-chip', label);
      b.type = 'button';
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', () => {
        dt.value = toLocalInput(fn());
        chips.querySelectorAll('.wap-chip').forEach((c) => c.setAttribute('aria-pressed', String(c === b)));
        updateWhen();
        ta.focus();
        ta.setSelectionRange(ta.value.length, ta.value.length);
      });
      chips.appendChild(b);
    }
    dt.addEventListener('input', () => {
      chips.querySelectorAll('.wap-chip').forEach((c) => c.setAttribute('aria-pressed', 'false'));
      updateWhen();
    });

    const foot = mk('div', 'wap-panel-foot');
    const st = mk('span', 'wap-st');
    const go = mk('button', 'wap-go', editing ? L('Kaydet') : L('Zamanla'));
    go.type = 'button';
    foot.append(st, go);

    const body = mk('div', 'wap-panel-body');
    body.append(ta, chips, dt, when);
    updateWhen();
    panel.append(head, body, foot);
    document.body.appendChild(panel);
    placePanel();
    placeFab();

    go.addEventListener('click', async () => {
      const due = fromLocalInput(dt.value);
      if (!ta.value.trim()) { st.textContent = L('Mesaj boş'); ta.focus(); return; }
      if (!Number.isFinite(due)) { st.textContent = L('Zaman seçin'); return; }
      go.disabled = true;
      st.textContent = '';
      try {
        if (editing) {
          await invoke('wa_schedule', { action: 'update', data: { id: editing.id, text: ta.value, due } });
        } else {
          await invoke('wa_schedule', { action: 'add', data: { chat: title, text: ta.value, due } });
        }
        let warn = '';
        if (fromComposer && !clearComposer()) warn = L('Yazı kutusundaki metni silin; yoksa gönderim takılır.');
        fromComposer = false;
        closePanel();
        if (warn) toast(warn);
        refreshGhosts(true);
        refreshAll();
      } catch (e) {
        st.textContent = String((e && e.message) || e);
        go.disabled = false;
      }
    });
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
  }

  // Kısa bilgi kutusu, WhatsApp'ın alttaki bildirim şeridi gibi.
  let toastTimer = 0;
  function toast(text) {
    let t = document.querySelector('.wap-toast');
    if (!t) { t = mk('div', 'wap-toast'); document.body.appendChild(t); }
    t.style.fontFamily = waFont();
    t.textContent = text;
    t.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('on'), 4000);
  }

  /* ---------------------------------------- sohbetteki zamanlanmış mesajlar */
  // Sohbetin en altında, gönderilmemiş giden mesaj gibi görünen önizleme baloncukları.
  // WhatsApp'ın bekleyen mesajlarda kullandığı saat simgesiyle, gönderim zamanını gösterir.

  let ghostItems = [];
  let ghostChat = null;
  let ghostKey = '';
  let ghostZone = null;
  let ghostFetch = 0;
  let menu = null;

  /** "34 dakika sonra", "2 saat 5 dakika sonra", "3 gün sonra" */
  function untilText(ms) {
    const min = Math.round((ms - Date.now()) / 60000);
    if (min < 1) return min < -1 ? L('geçmişte') : L('şimdi');
    if (min < 60) return L('{0} dakika sonra', min);
    const h = Math.floor(min / 60), m = min % 60;
    if (h < 24) return m ? L('{0} saat {1} dakika sonra', h, m) : L('{0} saat sonra', h);
    return L('{0} gün sonra', Math.round(h / 24));
  }

  function relTime(ms) {
    const d = new Date(ms);
    const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((day(d) - day(new Date())) / 86400000);
    const hm = d.toLocaleTimeString(LOC(), { hour: '2-digit', minute: '2-digit' });
    if (diff === 0) return L('Bugün {0}', hm);
    if (diff === 1) return L('Yarın {0}', hm);
    if (diff > 1 && diff < 7) return d.toLocaleDateString(LOC(), { weekday: 'long' }) + ' ' + hm;
    return d.toLocaleDateString(LOC(), { day: 'numeric', month: 'long' }) + ' ' + hm;
  }

  function messagesBox() {
    return document.querySelector('#main [data-testid="conversation-panel-messages"]');
  }

  async function refreshGhosts(force) {
    const chat = currentChatTitle();
    if (!chat) { ghostItems = []; ghostChat = null; renderGhosts(); return; }
    if (!force && chat === ghostChat) return;
    ghostChat = chat;
    const ticket = ++ghostFetch;
    let items = [];
    try { items = (await invoke('wa_schedule', { action: 'list', data: { chat } })) || []; } catch (e) { /* yoksay */ }
    if (ticket !== ghostFetch) return; // bu arada başka sohbete geçildi
    ghostItems = items.slice().sort((a, b) => a.due - b.due);
    renderGhosts();
  }

  function clockGlyph() {
    // WhatsApp'ın gönderilmeyi bekleyen mesajlarda gösterdiği küçük saat
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    for (const [k, v] of Object.entries({ width: 14, height: 14, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor',
      'stroke-width': 1.4, 'stroke-linecap': 'round', 'aria-hidden': 'true' })) svg.setAttribute(k, String(v));
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', '8'); c.setAttribute('cy', '8'); c.setAttribute('r', '6');
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', 'M8 4.8V8l2.2 1.4');
    svg.append(c, p);
    return svg;
  }

  /** Sayfadaki gerçek bir giden mesaj baloncuğunu ölçüp önizlemeye aynı biçimi verir. */
  let bubbleMeasured = null;
  function measureBubble(box) {
    const main = document.getElementById('main');
    if (!main || !box) return;
    const probe = document.createElement('span');
    probe.style.background = 'var(--WDS-systems-bubble-surface-outgoing, var(--outgoing-background))';
    main.appendChild(probe);
    const want = getComputedStyle(probe).backgroundColor;
    probe.remove();
    const br = box.getBoundingClientRect();
    const rows = [...main.querySelectorAll('[data-id]')].slice(-15).reverse();
    for (const row of rows) {
      const queue = [[row, 0]];
      while (queue.length) {
        const [el, depth] = queue.shift();
        if (depth > 8) continue;
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        if (cs.backgroundColor === want && r.width > 40 && r.height > 20) {
          const radii = [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomLeftRadius, cs.borderBottomRightRadius].map(parseFloat);
          const textEl = el.querySelector('.selectable-text, span[dir="ltr"], span[dir="auto"]');
          bubbleMeasured = {
            radius: Math.max(...radii.filter((x) => Number.isFinite(x)), 6) + 'px',
            pad: cs.padding,
            gapR: Math.max(8, Math.round(br.right - r.right - (box.offsetWidth - box.clientWidth))) + 'px',
            font: textEl ? getComputedStyle(textEl).fontSize : cs.fontSize,
          };
          return;
        }
        for (const k of el.children) if (k.tagName !== 'svg' && k.tagName !== 'IMG') queue.push([k, depth + 1]);
      }
    }
  }
  function applyBubbleLook(zone) {
    if (!bubbleMeasured) return;
    zone.style.setProperty('--wap-bubble-radius', bubbleMeasured.radius);
    if (bubbleMeasured.pad && bubbleMeasured.pad !== '0px') zone.style.setProperty('--wap-bubble-pad', bubbleMeasured.pad);
    zone.style.setProperty('--wap-gap-r', bubbleMeasured.gapR);
    zone.style.setProperty('--wap-gap-l', bubbleMeasured.gapR);
    if (bubbleMeasured.font) zone.style.setProperty('--wap-bubble-font', bubbleMeasured.font);
  }

  function renderGhosts() {
    const box = messagesBox();
    const chat = currentChatTitle();
    const items = chat && chat === ghostChat ? ghostItems : [];
    const key = chat + '|' + JSON.stringify(items.map((i) => [i.id, i.due, i.status, i.text]));
    if (!items.length || !box) {
      if (ghostZone) { ghostZone.remove(); ghostZone = null; }
      ghostKey = '';
      return;
    }
    const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 120;
    if (key !== ghostKey || !ghostZone) {
      ghostKey = key;
      if (!ghostZone) ghostZone = mk('div', 'wap-sched-zone');
      ghostZone.replaceChildren();
      safe('bubble-measure', () => measureBubble(box));
      applyBubbleLook(ghostZone);
      const sep = mk('div', 'wap-sched-sep');
      sep.append(mk('span', null, items.length === 1 ? L('Zamanlanmış mesaj') : L('{0} zamanlanmış mesaj', items.length)));
      ghostZone.appendChild(sep);
      for (const it of items) {
        const row = mk('div', 'wap-ghost-row');
        const b = mk('div', 'wap-ghost');
        b.tabIndex = 0;
        b.setAttribute('role', 'button');
        b.setAttribute('aria-label', L('Zamanlanmış mesaj, {0}', relTime(it.due)));
        b.dataset.id = it.id;
        if (it.status !== 'bekliyor' && it.status !== 'gonderiliyor') b.classList.add('wap-ghost-problem');
        const text = mk('span', 'wap-ghost-text', it.text);
        const meta = mk('span', 'wap-ghost-meta');
        const label = it.status === 'gonderiliyor' ? L('Gönderiliyor')
          : it.status === 'kacirildi' ? L('Kaçırıldı · {0}', relTime(it.due))
          : it.status === 'hata' ? L('Gönderilemedi')
          : relTime(it.due);
        meta.append(mk('span', null, label), clockGlyph());
        b.append(text, mk('span', 'wap-ghost-spacer'), meta);
        b.title = it.error && it.status !== 'bekliyor' ? it.error : untilText(it.due);
        const open = (e) => { e.preventDefault(); e.stopPropagation(); openMenu(b, it); };
        b.addEventListener('click', open);
        b.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') open(e); });
        row.appendChild(b);
        ghostZone.appendChild(row);
      }
    }
    if (ghostZone.parentElement !== box || box.lastElementChild !== ghostZone) {
      box.appendChild(ghostZone);
      if (nearBottom) box.scrollTop = box.scrollHeight;
    }
  }

  function closeMenu() {
    if (menu) menu.remove();
    menu = null;
  }

  function openMenu(anchor, it) {
    closeMenu();
    menu = mk('div', 'wap-menu');
    menu.setAttribute('role', 'menu');
    menu.style.fontFamily = waFont();
    const add = (label, fn, danger) => {
      const m = mk('button', 'wap-menu-item' + (danger ? ' wap-danger' : ''), label);
      m.type = 'button';
      m.setAttribute('role', 'menuitem');
      m.addEventListener('click', async (e) => {
        e.stopPropagation();
        closeMenu();
        try { await fn(); } catch (err) { toast(String((err && err.message) || err)); }
        refreshGhosts(true);
        refreshAll();
      });
      menu.appendChild(m);
    };
    if (it.status !== 'gonderiliyor') {
      add(L('Şimdi gönder'), () => invoke('wa_schedule', { action: 'send-now', data: { id: it.id } }));
      add(L('Düzenle'), () => openPanel({ item: it }));
      add(L('Zamanlamayı iptal et'), () => invoke('wa_schedule', { action: 'cancel', data: { id: it.id } }), true);
    } else {
      add(L('Gönderiliyor…'), () => {});
    }
    document.body.appendChild(menu);
    const r = anchor.getBoundingClientRect();
    const mw = menu.offsetWidth, mh = menu.offsetHeight;
    menu.style.left = Math.round(Math.max(8, Math.min(r.right - mw, window.innerWidth - mw - 8))) + 'px';
    const below = r.bottom + 4 + mh < window.innerHeight - 8;
    menu.style.top = Math.round(below ? r.bottom + 4 : Math.max(8, r.top - mh - 4)) + 'px';
    const first = menu.querySelector('button');
    if (first) first.focus();
  }

  document.addEventListener('pointerdown', (e) => {
    if (menu && !menu.contains(e.target)) closeMenu();
  }, true);

  /* ------------------------------------ sohbet listesinde zamanlanmış mesajlar */
  // 1) Listede, zamanlanmış mesajı olan sohbetin adının yanında küçük bir saat.
  // 2) Listenin en üstünde "Zamanlanmış" bölümü: WhatsApp satırlarıyla aynı görünümde,
  //    tıklayınca sohbeti açar. WhatsApp'ın kendi sıralamasına dokunulmaz.

  let allItems = [];
  let allFetch = 0;
  let schedSection = null;
  let schedKey = '';
  let schedOpen = false; // 3'ten fazlaysa "daha fazla" açık mı

  async function refreshAll() {
    const ticket = ++allFetch;
    let items = [];
    try { items = (await invoke('wa_schedule', { action: 'list', data: { chat: '' } })) || []; } catch (e) { /* yoksay */ }
    if (ticket !== allFetch) return;
    allItems = items.filter((i) => i.status !== 'gonderildi' && i.status !== 'iptal').sort((a, b) => a.due - b.due);
    schedKey = '';
    safe('sched-list', renderSchedList);
    safe('row-clocks', markRows);
  }

  function chatRows() {
    const pane = document.getElementById('pane-side');
    return pane ? [...pane.querySelectorAll('[role="row"], [role="listitem"]')] : [];
  }

  /** Listedeki gerçek bir satırı ölçer: yükseklik, avatar boyu, ad ve önizleme yazı biçimi. */
  function measureRow() {
    const row = chatRows().find((r) => r.getBoundingClientRect().height > 40);
    if (!row) return null;
    const spans = row.querySelectorAll('span[title]');
    const name = spans[0], snip = spans[1];
    const avatar = row.querySelector('img') || [...row.querySelectorAll('div')].find((d) => {
      const r = d.getBoundingClientRect();
      return r.width >= 36 && r.width <= 64 && Math.abs(r.width - r.height) < 2 && parseFloat(getComputedStyle(d).borderTopLeftRadius) >= r.width / 3;
    });
    const font = (el) => {
      if (!el) return null;
      const cs = getComputedStyle(el);
      return { size: cs.fontSize, weight: cs.fontWeight, color: cs.color, line: cs.lineHeight };
    };
    const rr = row.getBoundingClientRect();
    const ar = avatar ? avatar.getBoundingClientRect() : null;
    return {
      height: Math.round(rr.height),
      avatar: ar ? Math.round(ar.width) : 49,
      padL: ar ? Math.round(ar.left - rr.left) : 13,
      name: font(name),
      snip: font(snip),
    };
  }

  function avatarFor(chat) {
    // Görünürdeki satırdan avatarı kopyala; yoksa baş harf.
    for (const row of chatRows()) {
      const n = row.querySelector('span[title]');
      if (n && norm(n.getAttribute('title')) === chat) {
        const img = row.querySelector('img');
        if (img && img.src) {
          const copy = document.createElement('img');
          copy.src = img.src;
          copy.alt = '';
          copy.draggable = false;
          return copy;
        }
      }
    }
    return mk('span', 'wap-sched-initial', (chat.trim()[0] || '?').toLocaleUpperCase('tr-TR'));
  }

  function shortWhen(ms) {
    const d = new Date(ms);
    const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((day(d) - day(new Date())) / 86400000);
    if (diff === 0) return d.toLocaleTimeString(LOC(), { hour: '2-digit', minute: '2-digit' });
    if (diff === 1) return L('Yarın');
    if (diff > 1 && diff < 7) return d.toLocaleDateString(LOC(), { weekday: 'long' });
    return d.toLocaleDateString(LOC(), { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function renderSchedList() {
    const pane = document.getElementById('pane-side');
    const host = pane && pane.parentElement;
    if (!host) return;
    if (!allItems.length) {
      if (schedSection) { schedSection.remove(); schedSection = null; }
      schedKey = '';
      return;
    }
    // Sohbet başına tek satır: en yakın zamanlı mesaj, yanında kaç tane olduğu.
    const byChat = new Map();
    for (const it of allItems) {
      if (!byChat.has(it.chat)) byChat.set(it.chat, { first: it, count: 0, problem: false });
      const g = byChat.get(it.chat);
      g.count++;
      if (it.status === 'kacirildi' || it.status === 'hata') g.problem = true;
    }
    const groups = [...byChat.entries()];
    const key = JSON.stringify([schedOpen, groups.map(([c, g]) => [c, g.first.id, g.first.due, g.first.text, g.count, g.problem])]);
    if (!schedSection || key !== schedKey) {
      schedKey = key;
      if (!schedSection) schedSection = mk('div', 'wap-sched-list');
      schedSection.style.fontFamily = waFont();
      const m = measureRow();
      if (m) {
        schedSection.style.setProperty('--wap-row-h', m.height + 'px');
        schedSection.style.setProperty('--wap-row-avatar', m.avatar + 'px');
        schedSection.style.setProperty('--wap-row-padl', m.padL + 'px');
        if (m.name) { schedSection.style.setProperty('--wap-row-name-size', m.name.size); schedSection.style.setProperty('--wap-row-name-weight', m.name.weight); }
        if (m.snip) { schedSection.style.setProperty('--wap-row-snip-size', m.snip.size); }
      }
      schedSection.replaceChildren();
      const head = mk('div', 'wap-sched-head');
      head.append(clockGlyph(), mk('span', null, L('Zamanlanmış')), mk('span', 'wap-sched-count', String(allItems.length)));
      schedSection.appendChild(head);
      const visible = schedOpen ? groups : groups.slice(0, 3);
      for (const [chat, g] of visible) {
        const row = mk('div', 'wap-sched-row');
        row.setAttribute('role', 'button');
        row.tabIndex = 0;
        row.title = g.first.text;
        const av = mk('div', 'wap-sched-avatar');
        av.appendChild(avatarFor(chat));
        const body = mk('div', 'wap-sched-body');
        const top = mk('div', 'wap-sched-top');
        top.append(mk('span', 'wap-sched-name', chat), mk('span', 'wap-sched-time' + (g.problem ? ' wap-sched-bad' : ''), g.problem ? L('Gönderilmedi') : shortWhen(g.first.due)));
        const bottom = mk('div', 'wap-sched-bottom');
        const prev = mk('span', 'wap-sched-snip');
        prev.append(clockGlyph(), mk('span', null, g.first.text.replace(/\s+/g, ' ')));
        bottom.appendChild(prev);
        if (g.count > 1) bottom.appendChild(mk('span', 'wap-sched-badge', String(g.count)));
        body.append(top, bottom);
        row.append(av, body);
        const go = (e) => { e.preventDefault(); openChat(chat).catch((err) => toast(String((err && err.message) || err))); };
        row.addEventListener('click', go);
        row.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(e); });
        schedSection.appendChild(row);
      }
      if (groups.length > 3) {
        const more = mk('button', 'wap-sched-more', schedOpen ? L('Daha az göster') : L('{0} sohbet daha', groups.length - 3));
        more.type = 'button';
        more.addEventListener('click', () => { schedOpen = !schedOpen; schedKey = ''; renderSchedList(); });
        schedSection.appendChild(more);
      }
    }
    if (schedSection.parentElement !== host || schedSection.nextElementSibling !== pane) host.insertBefore(schedSection, pane);
  }

  /** Gerçek liste satırlarında adın yanına saat simgesi. Satırlar yeniden kullanıldığı için her turda denetlenir. */
  function markRows() {
    const pending = new Set(allItems.map((i) => i.chat));
    for (const row of chatRows()) {
      const n = row.querySelector('span[title]');
      if (!n) continue;
      const has = pending.has(norm(n.getAttribute('title')));
      let icon = n.parentElement && n.parentElement.querySelector(':scope > .wap-row-clock');
      if (has && !icon) {
        icon = mk('span', 'wap-row-clock');
        icon.title = L('Zamanlanmış mesaj var');
        icon.appendChild(clockGlyph());
        n.insertAdjacentElement('afterend', icon);
      } else if (!has && icon) {
        icon.remove();
      }
    }
  }

  /* --------------------------------------------------------- medya toplayıcı */
  // Sohbette yüklenmiş mesajlardaki görsel, video ve belgeleri toplar; seçilenleri
  // İndirilenler/Wazzap/<sohbet> klasörüne kaydeder. Tam çözünürlük için her öğe
  // WhatsApp'ın kendi görüntüleyicisinde açılıp oradan alınır.

  let mediaFab = null;
  let mediaPanel = null;
  const MEDIA = { chat: null, items: new Map(), tab: 'image', selected: new Set(), busy: false, cancel: false, docWait: null };
  const DOC_EXT = /\.(pdf|docx?|xlsx?|pptx?|zip|rar|7z|txt|csv|psd|ai|indd|png|jpe?g|webp|heic|mp4|mov|wav|mp3|aiff?|key|pages|numbers|apk|exe|svg|eps|tiff?)$/i;

  function mediaKind(row) {
    const icons = [...row.querySelectorAll('[data-icon]')].map((e) => e.getAttribute('data-icon') || '');
    const docTitle = [...row.querySelectorAll('[title]')].map((e) => e.getAttribute('title') || '').find((t) => DOC_EXT.test(t.trim()));
    const imgs = [...row.querySelectorAll('img')].filter((im) => {
      const r = im.getBoundingClientRect();
      const src = im.currentSrc || im.src || '';
      return r.width >= 60 && r.height >= 60 && /^(blob:|data:image)/.test(src);
    });
    const isDoc = icons.some((i) => /document|doc-|pdf|xls|ppt|zip|audio-file/.test(i)) || (!!docTitle && !imgs.length);
    if (isDoc) return { type: 'doc', name: (docTitle || 'belge').trim() };
    if (!imgs.length) return null;
    const isVideo = icons.some((i) => /video|play|gif/.test(i)) || !!row.querySelector('video');
    return { type: isVideo ? 'video' : 'image', thumb: imgs[0].currentSrc || imgs[0].src };
  }

  function scanMedia() {
    const main = document.getElementById('main');
    const chat = currentChatTitle();
    if (!main || !chat) return;
    if (chat !== MEDIA.chat) {
      MEDIA.chat = chat;
      MEDIA.items = new Map();
      MEDIA.selected = new Set();
    }
    let n = MEDIA.items.size;
    for (const row of main.querySelectorAll('[data-id]')) {
      const id = row.getAttribute('data-id');
      if (!id) continue;
      const kind = safe('media-kind', () => mediaKind(row));
      if (!kind) continue;
      const old = MEDIA.items.get(id);
      if (old) { if (kind.thumb) old.thumb = kind.thumb; continue; }
      MEDIA.items.set(id, Object.assign({ id, order: n++, saved: false, error: null }, kind));
    }
  }

  function rowById(id) {
    const main = document.getElementById('main');
    if (!main) return null;
    for (const r of main.querySelectorAll('[data-id]')) if (r.getAttribute('data-id') === id) return r;
    return null;
  }

  function ensureMediaFab() {
    if (mediaFab && mediaFab.isConnected) return;
    if (!document.body) return;
    mediaFab = iconButton('wap-fab wap-fab-media', L('Medya toplayıcı (Ctrl+Shift+M)'),
      svgIcon('M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5M15.5 9.5h.01', 20));
    mediaFab.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); if (mediaPanel) closeMedia(); else openMedia(); });
    document.body.appendChild(mediaFab);
  }

  function placeMediaFab() {
    if (!mediaFab) return;
    if (!fab || fab.style.display === 'none' || mediaPanel || panel) { mediaFab.style.display = 'none'; return; }
    mediaFab.style.display = 'flex';
    mediaFab.style.left = fab.style.left;
    mediaFab.style.top = (parseFloat(fab.style.top) - 42 - 10) + 'px';
  }

  function placeMediaPanel() {
    if (!mediaPanel) return;
    const main = document.getElementById('main');
    if (!main) { closeMedia(); return; }
    const r = main.getBoundingClientRect();
    Object.assign(mediaPanel.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
  }

  function closeMedia() {
    if (MEDIA.busy) MEDIA.cancel = true;
    if (mediaPanel) mediaPanel.remove();
    mediaPanel = null;
    root().classList.remove('wap-media-open');
    invoke('wa_media', { action: 'target', data: { chat: '' } }).catch(() => {});
    placeMediaFab();
  }

  function openMedia() {
    const chat = currentChatTitle();
    if (!chat) return;
    closePanel();
    closeMenu();
    scanMedia();
    mediaPanel = mk('div', 'wap-media');
    mediaPanel.setAttribute('role', 'dialog');
    mediaPanel.setAttribute('aria-label', L('Medya toplayıcı'));
    mediaPanel.dataset.chat = chat;
    mediaPanel.style.fontFamily = waFont();
    document.body.appendChild(mediaPanel);
    root().classList.add('wap-media-open');
    placeMediaPanel();
    placeMediaFab();
    renderMedia();
  }

  function setMediaStatus(text) {
    const st = mediaPanel && mediaPanel.querySelector('.wap-media-st');
    if (st) st.textContent = text || '';
  }

  function renderMedia() {
    if (!mediaPanel) return;
    const all = [...MEDIA.items.values()].sort((a, b) => b.order - a.order);
    const counts = { image: 0, video: 0, doc: 0 };
    all.forEach((i) => counts[i.type]++);
    const list = all.filter((i) => i.type === MEDIA.tab);

    mediaPanel.replaceChildren();
    const head = mk('div', 'wap-panel-head');
    const x = iconButton('wap-icon-btn', L('Kapat'), svgIcon('M18 6 6 18M6 6l12 12', 20));
    x.addEventListener('click', closeMedia);
    const titles = mk('div', 'wap-panel-titles');
    titles.append(mk('div', 'wap-panel-title', L('Medya')), mk('div', 'wap-panel-sub', MEDIA.chat));
    const folder = iconButton('wap-icon-btn', L('Klasörü aç'), svgIcon('M3 7h6l2 2h10v10H3z', 20));
    folder.style.marginLeft = 'auto';
    folder.addEventListener('click', () => invoke('wa_media', { action: 'open', data: { chat: MEDIA.chat } }).catch((e) => toast(String(e))));
    head.append(x, titles, folder);

    const tabs = mk('div', 'wap-chips wap-media-tabs');
    for (const [k, label] of [['image', L('Görseller')], ['video', L('Videolar')], ['doc', L('Belgeler')]]) {
      const b = mk('button', 'wap-chip', `${label} ${counts[k]}`);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(MEDIA.tab === k));
      b.addEventListener('click', () => { MEDIA.tab = k; renderMedia(); });
      tabs.appendChild(b);
    }

    const grid = mk('div', MEDIA.tab === 'doc' ? 'wap-media-docs' : 'wap-media-grid');
    if (!list.length) {
      grid.appendChild(mk('div', 'wap-media-empty', L('Yüklenmiş mesajlarda bu türde medya yok. Aşağıdan daha eski mesajları yükleyebilirsin.')));
    }
    for (const it of list) {
      const cell = mk('button', 'wap-media-cell');
      cell.type = 'button';
      cell.setAttribute('aria-pressed', String(MEDIA.selected.has(it.id)));
      if (it.type === 'doc') {
        cell.append(svgIcon('M6 2h9l5 5v15H6zM14 2v6h6', 22), mk('span', 'wap-media-docname', it.name));
      } else {
        const im = document.createElement('img');
        im.src = it.thumb;
        im.alt = '';
        im.draggable = false;
        cell.appendChild(im);
        if (it.type === 'video') cell.appendChild(mk('span', 'wap-media-play', '▶'));
      }
      if (it.saved) cell.appendChild(mk('span', 'wap-media-ok', '✓'));
      if (it.error) { cell.classList.add('wap-media-err'); cell.title = it.error; }
      cell.appendChild(mk('span', 'wap-media-check'));
      cell.addEventListener('click', () => {
        if (MEDIA.selected.has(it.id)) MEDIA.selected.delete(it.id); else MEDIA.selected.add(it.id);
        cell.setAttribute('aria-pressed', String(MEDIA.selected.has(it.id)));
        updateMediaFoot();
      });
      grid.appendChild(cell);
    }

    const foot = mk('div', 'wap-media-foot');
    const older = mk('button', 'wap-btn-text', L('Daha eskileri yükle'));
    older.type = 'button';
    older.addEventListener('click', loadOlder);
    const st = mk('span', 'wap-st wap-media-st');
    const go = mk('button', 'wap-go wap-media-go', '');
    go.type = 'button';
    go.addEventListener('click', () => {
      if (MEDIA.busy) { MEDIA.cancel = true; return; }
      const pick = list.filter((i) => MEDIA.selected.size ? MEDIA.selected.has(i.id) : true);
      saveMedia(pick);
    });
    foot.append(older, st, go);
    mediaPanel.append(head, tabs, grid, foot);
    updateMediaFoot();
  }

  function updateMediaFoot() {
    const go = mediaPanel && mediaPanel.querySelector('.wap-media-go');
    if (!go) return;
    if (MEDIA.busy) { go.textContent = L('Durdur'); go.disabled = false; return; }
    const list = [...MEDIA.items.values()].filter((i) => i.type === MEDIA.tab);
    const sel = list.filter((i) => MEDIA.selected.has(i.id)).length;
    go.textContent = sel ? L('{0} öğeyi kaydet', sel) : L('Tümünü kaydet');
    go.disabled = !list.length;
  }

  async function loadOlder() {
    const box = messagesBox();
    if (!box || MEDIA.busy) return;
    MEDIA.busy = true;
    MEDIA.cancel = false;
    updateMediaFoot();
    let same = 0;
    for (let i = 0; i < 12 && same < 2 && !MEDIA.cancel; i++) {
      const h = box.scrollHeight;
      setMediaStatus(L('Eski mesajlar yükleniyor'));
      box.scrollTop = 0;
      await sleep(1300);
      scanMedia();
      same = box.scrollHeight === h ? same + 1 : 0;
    }
    MEDIA.busy = false;
    setMediaStatus(same >= 2 ? L('Sohbetin başına ulaşıldı') : '');
    renderMedia();
  }

  function viewerMedia(kind) {
    // Görüntüleyici sohbetin dışında açılır: mesaj alanının dışındaki en büyük blob görsel / video.
    const box = messagesBox();
    let best = null, area = 0;
    for (const el of document.querySelectorAll(kind === 'video' ? 'video' : 'img')) {
      const src = el.currentSrc || el.src || '';
      if (!src.startsWith('blob:')) continue;
      if (box && box.contains(el)) continue;
      if (mediaPanel && mediaPanel.contains(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width * r.height > area) { area = r.width * r.height; best = el; }
    }
    return area > 20000 ? best : null;
  }

  function closeViewer() {
    const init = { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true };
    // Tek bir Esc: ikincisi WhatsApp'ta sohbeti kapatır.
    (document.activeElement || document.body).dispatchEvent(new KeyboardEvent('keydown', init));
  }

  async function blobToB64(url) {
    const blob = await (await fetch(url)).blob();
    const buf = new Uint8Array(await blob.arrayBuffer());
    let bin = '';
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return { data: btoa(bin), type: blob.type || '' };
  }

  const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' };
  const stamp = () => { const d = new Date(); return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`; };

  async function saveOne(it, index) {
    const row = rowById(it.id);
    if (it.type === 'doc') {
      if (!row) throw new Error(L('mesaj artık sayfada değil; sohbette ona kaydır'));
      const ctl = row.querySelector('[data-icon*="download"]');
      const target = (ctl && (ctl.closest('button, [role="button"]') || ctl))
        || [...row.querySelectorAll('[title]')].find((e) => DOC_EXT.test((e.getAttribute('title') || '').trim()));
      if (!target) throw new Error(L('belge düğmesi bulunamadı'));
      const done = new Promise((resolve) => { MEDIA.docWait = resolve; });
      press(target);
      const ok = await Promise.race([done, sleep(30000).then(() => null)]);
      MEDIA.docWait = null;
      if (ok === null) throw new Error(L('indirme başlamadı'));
      if (!ok) throw new Error(L('indirme başarısız'));
      return;
    }
    let url = null;
    let opened = false;
    if (row) {
      const im = [...row.querySelectorAll('img')].find((x) => /^(blob:|data:image)/.test(x.currentSrc || x.src || '') && x.getBoundingClientRect().width >= 60);
      if (im) {
        press(im);
        opened = true;
        const el = await waitFor(() => viewerMedia(it.type), it.type === 'video' ? 15000 : 6000, 150);
        if (el) url = el.currentSrc || el.src;
      }
    }
    if (!url && it.type === 'image' && /^blob:/.test(it.thumb || '')) url = it.thumb; // yedek: sohbetteki görsel
    try {
      if (!url) throw new Error(it.type === 'video' ? L('video açılamadı') : L('görsel açılamadı'));
      const { data, type } = await blobToB64(url);
      const ext = EXT[type] || (it.type === 'video' ? 'mp4' : 'jpg');
      const name = `${MEDIA.chat} ${stamp()} ${String(index + 1).padStart(3, '0')}.${ext}`;
      await invoke('wa_media', { action: 'save', data: { chat: MEDIA.chat, name, data } });
    } finally {
      // Yalnızca gerçekten bir görüntüleyici açıksa Esc gönder; yoksa Esc sohbeti kapatır.
      if (opened && (viewerMedia('image') || viewerMedia('video'))) {
        closeViewer();
        await waitFor(() => !viewerMedia('image') && !viewerMedia('video'), 3000, 100);
        await sleep(250);
      }
    }
  }

  async function saveMedia(list) {
    if (!list.length || MEDIA.busy) return;
    MEDIA.busy = true;
    MEDIA.cancel = false;
    updateMediaFoot();
    if (list.some((i) => i.type === 'doc')) await invoke('wa_media', { action: 'target', data: { chat: MEDIA.chat } }).catch(() => {});
    let ok = 0, bad = 0;
    for (let i = 0; i < list.length && !MEDIA.cancel; i++) {
      const it = list[i];
      setMediaStatus(L('{0} / {1} kaydediliyor', i + 1, list.length));
      try { await saveOne(it, i); it.saved = true; it.error = null; ok++; } catch (e) { it.error = (e && e.message) || String(e); bad++; }
    }
    MEDIA.busy = false;
    invoke('wa_media', { action: 'target', data: { chat: '' } }).catch(() => {});
    renderMedia();
    setMediaStatus(MEDIA.cancel ? L('Durduruldu · {0} kaydedildi', ok) : bad ? L('{0} kaydedildi, {1} kaydedilemedi', ok, bad) : L('{0} öğe kaydedildi', ok));
    if (ok) toast(L('{0} öğe İndirilenler/Wazzap klasörüne kaydedildi', ok));
  }

  /* ------------------------------------------------------------- girişler */

  // Panel açıkken tuşlar WhatsApp'a ulaşmasın (yazarken odağı kendi kutusuna çekmesin).
  for (const type of ['keydown', 'keypress', 'keyup']) {
    window.addEventListener(type, (e) => {
      if (mediaPanel && type === 'keydown' && e.key === 'Escape' && e.isTrusted && !MEDIA.busy) {
        e.preventDefault();
        e.stopImmediatePropagation();
        closeMedia();
        return;
      }
      if (menu && type === 'keydown' && e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        closeMenu();
        return;
      }
      if (!panel) return;
      if (!panel.contains(e.target)) {
        // Panel açıkken Esc önce paneli kapatır, sohbeti değil.
        if (type === 'keydown' && e.key === 'Escape') {
          e.preventDefault();
          e.stopImmediatePropagation();
          closePanel();
        }
        return;
      }
      e.stopImmediatePropagation();
      if (type !== 'keydown') return;
      if (e.key === 'Escape') {
        e.preventDefault();
        closePanel();
        const c = composer();
        if (c) c.focus();
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const go = panel.querySelector('.wap-go');
        if (go) go.click();
      }
    }, true);
  }

  const KEYS = { Digit1: 'phone', Digit2: 'normal', Digit3: 'compact', Digit4: 'mini', Numpad1: 'phone', Numpad2: 'normal', Numpad3: 'compact', Numpad4: 'mini' };

  window.addEventListener('keydown', (e) => {
    if (!e.isTrusted) return;
    const ctrl = e.ctrlKey || e.metaKey;
    if (!ctrl || e.altKey) return;
    let action = null;
    if (!e.shiftKey) {
      if (KEYS[e.code]) action = KEYS[e.code];
      else if (e.key === 't' || e.key === 'T') action = 'ontop';
      else if (e.key === ',') action = 'settings';
      else if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') action = 'zoom-in';
      else if (e.key === '-' || e.code === 'NumpadSubtract') action = 'zoom-out';
      else if (e.code === 'Digit0' || e.code === 'Numpad0') action = 'zoom-reset';
    } else if (e.key === 'I' || e.key === 'i') {
      action = 'devtools';
    } else if ((e.key === 'M' || e.key === 'm') && document.getElementById('main')) {
      e.preventDefault();
      e.stopImmediatePropagation();
      safe('media', () => { if (mediaPanel) closeMedia(); else openMedia(); });
      return;
    } else if (e.key === 'Enter' && document.getElementById('main')) {
      // Ctrl+Shift+Enter: yazı kutusundaki metni zamanla
      e.preventDefault();
      e.stopImmediatePropagation();
      safe('panel', openPanelFromComposer);
      return;
    }
    if (action) {
      e.preventDefault();
      e.stopImmediatePropagation();
      send('action', action);
    }
  }, true);

  // Farenin geri tuşu: telefon modunda sohbetten listeye döner, sayfayı geri götürmez.
  for (const type of ['mouseup', 'auxclick']) {
    window.addEventListener(type, (e) => {
      if (e.button !== 3 && e.button !== 4) return;
      e.preventDefault();
      if (type === 'mouseup' && e.button === 3 && root().classList.contains('wap-phone') && ST.chatOpen) goBack();
    }, true);
  }

  // Listeden bir sohbete tıklanınca (aynı sohbet yeniden açılsa bile) sohbet görünümüne geç.
  document.addEventListener('click', (e) => {
    if (!ST.list || !ST.list.contains(e.target)) return;
    if (!e.target.closest('[role="listitem"], [role="row"], [role="gridcell"], [role="option"]')) return;
    setTimeout(() => { if (document.getElementById('main')) setChat(true); }, 80);
  }, true);

  window.addEventListener('resize', () => { safe('phone', updatePhone); safe('fab', () => { placeFab(); placePanel(); placeMediaFab(); placeMediaPanel(); }); schedule(); });

  /* ------------------------------------------------------------- tanılama */
  // Yalnızca yapı bilgisi: renk değişkenleri, etiket/sınıf adları, boyutlar.
  // Mesaj metni, kişi adı ya da numara toplanmaz.

  function describe(el) {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      tag: el.tagName.toLowerCase(),
      id: el.id || undefined,
      role: el.getAttribute('role') || undefined,
      cls: typeof el.className === 'string' ? el.className.slice(0, 200) : undefined,
      dataAttrs: [...el.attributes].map((a) => a.name).filter((n) => n.startsWith('data-')),
      wap: el.getAttribute('data-wap-pane') || (el.hasAttribute('data-wap-split') ? 'split' : undefined),
      display: getComputedStyle(el).display,
      size: [Math.round(r.width), Math.round(r.height)],
      children: el.childElementCount,
    };
  }
  function chain(el) {
    const out = [];
    for (let n = el; n && n !== document.documentElement && out.length < 14; n = n.parentElement) out.push(describe(n));
    return out;
  }

  // Sayfa iskeleti: etiket, id, rol, sınıf, boyut ve yerleşim stilleri. Metin, aria-label,
  // title ve data-* değerleri alınmaz (data-id telefon numarası içerir); yalnızca adları.
  const SAFE_DATA = new Set(['data-icon', 'data-tab', 'data-testid', 'data-wap-pane', 'data-wap-bubble', 'data-animate-modal-popup', 'data-animate-modal-body']);
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'LINK', 'META', 'NOSCRIPT', 'TEMPLATE']);
  function skel(el, depth, budget) {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const o = { t: el.tagName.toLowerCase() };
    if (el.id) o.id = el.id.slice(0, 60);
    const role = el.getAttribute('role');
    if (role) o.role = role;
    const cls = el.getAttribute('class');
    if (cls) o.c = cls.slice(0, 160);
    const d = {};
    for (const a of el.attributes) {
      if (a.name.startsWith('data-')) d[a.name] = SAFE_DATA.has(a.name) ? a.value.slice(0, 60) : '·';
    }
    if (Object.keys(d).length) o.d = d;
    o.r = [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)];
    const st = [cs.display, cs.position];
    if (cs.display.includes('flex')) st.push('dir:' + cs.flexDirection);
    if (cs.flex !== '0 1 auto') st.push('flex:' + cs.flex);
    if (cs.display.includes('grid')) st.push('cols:' + cs.gridTemplateColumns.slice(0, 120), 'areas:' + cs.gridTemplateAreas.slice(0, 120));
    if (cs.minWidth !== '0px' && cs.minWidth !== 'auto') st.push('minW:' + cs.minWidth);
    if (cs.maxWidth !== 'none') st.push('maxW:' + cs.maxWidth);
    if (cs.overflow !== 'visible') st.push('ov:' + cs.overflow);
    if (cs.transform !== 'none') st.push('tf');
    if (cs.visibility !== 'visible') st.push('vis:' + cs.visibility);
    o.s = st.join(' ');
    if (depth > 0 && budget.n > 0) {
      const kids = [...el.children].filter((k) => !SKIP_TAGS.has(k.tagName));
      const keep = kids.filter((k) => {
        if (k.id || k.querySelector('#side,#main,#pane-side')) return true;
        const kr = k.getBoundingClientRect();
        return kr.width >= 24 && kr.height >= 24;
      }).slice(0, 16);
      if (keep.length) o.k = keep.map((k) => { budget.n--; return skel(k, depth - 1, budget); });
      if (kids.length > keep.length) o.more = kids.length - keep.length;
    }
    return o;
  }

  function diagnose(name) {
    const src = readSource();
    const main = document.getElementById('main');
    const bubble = document.querySelector('[data-wap-bubble]');
    const app = document.getElementById('app');
    const side = document.getElementById('side');
    const budget = { n: 1500 };
    const info = {
      app: 'Wazzap?', version: BOOT.version, name: name || 'elle',
      time: new Date().toISOString(),
      userAgent: navigator.userAgent,
      viewport: [innerWidth, innerHeight], dpr: devicePixelRatio, zoom: zoomFactor(), logicalWidth: Math.round(logicalWidth()),
      mode: S.mode, breakpoint: S.phoneBreakpoint,
      tz: (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) { return null; } })(),
      tzOffsetMin: -new Date().getTimezoneOffset(),
      localTime: new Date().toString().slice(0, 33),
      htmlClass: root().className, bodyClass: document.body ? document.body.className : null,
      phone: root().classList.contains('wap-phone'), wantPhone: !!ST.wantPhone, phoneFailed: !!ST.failed,
      chatOpen: ST.chatOpen, drawer: ST.drawer,
      fab: ST.fab || null,
      errors: ERRORS.slice(),
      tree: app ? safe('skel', () => skel(app, 11, budget)) : null,
      sideTree: side ? safe('skel-side', () => skel(side, 5, { n: 300 })) : null,
      mainTree: main ? safe('skel-main', () => skel(main, 5, { n: 300 })) : null,
      theme: { enabled: S.themeEnabled !== false, srcDark: src.srcDark, varNames: src.nameCount, enumerated: src.enumerated },
      colorVars: src.vars.map((v) => ({ name: v.name, value: v.value })),
      counts: {
        side: !!document.getElementById('side'), main: !!main,
        paneSide: !!document.getElementById('pane-side'),
        dataIdRows: main ? main.querySelectorAll('[data-id]').length : 0,
        messageIn: document.querySelectorAll('.message-in').length,
        messageOut: document.querySelectorAll('.message-out').length,
        bubblesTagged: document.querySelectorAll('[data-wap-bubble]').length,
        tailIcons: document.querySelectorAll('[data-icon^="tail-"]').length,
        chatBgAsset: document.querySelectorAll('[data-asset-chat-background-dark],[data-asset-chat-background-light]').length,
        wallTagged: document.querySelectorAll('[data-wap-wall]').length,
        mainHeader: !!document.querySelector('#main header'),
      },
      split: ST.split ? { self: describe(ST.split), children: [...ST.split.children].map(describe) } : null,
      sideChain: chain(document.getElementById('side')),
      mainChain: chain(main),
      bubble: bubble ? { el: describe(bubble), parent: describe(bubble.parentElement), bg: getComputedStyle(bubble).backgroundColor } : null,
    };
    send('diag', info);
    return info;
  }

  // Kendiliğinden tanılama: açılışta, ilk sohbette, telefon / normal geçişinde ve bir hata olunca.
  // Her ad sayfa başına bir kez (zorla verilmedikçe) ve kısa bir gecikmeyle, düzen otursun diye.
  const diagDone = new Set();
  function autoDiag(name, force) {
    if (!force && diagDone.has(name)) return;
    diagDone.add(name);
    setTimeout(() => safe('diag', () => diagnose(name)), name === 'acilis' ? 4000 : 1500);
  }

  /* --------------------------------------------------------------- dışa */

  function apply(next) {
    const prevLang = S.lang;
    if (next && typeof next === 'object') S = next;
    if (prevLang !== S.lang) {
      // Dil değişti: kendi düğmelerimizi yeni dille yeniden kur.
      [miniBar, fab, mediaFab, backBtn].forEach((el) => { if (el) el.remove(); });
      closePanel();
      closeMenu();
      if (mediaPanel) closeMedia();
      schedKey = '';
      ghostKey = '';
    }
    ensureSheets();
    rebuildTheme();
    safeReplace(sheets.custom, S.customCss || '');
    safe('phone', updatePhone);
    if (root().classList.contains('wap-phone')) setTimeout(() => safe('verify', verifyPhone), 700);
    schedule();
  }

  Object.defineProperty(window, '__wap', {
    value: Object.freeze({
      apply,
      diagnose: () => diagnose('elle'),
      openChat: (title) => openChat(title).catch((e) => { note('openChat', e && e.message); throw e; }),
      sendScheduled: (item) => { sendScheduled(item); },
      schedulesChanged: () => { refreshGhosts(true); refreshAll(); },
      win: setWin,
      mediaDownloaded: (ok) => { if (MEDIA.docWait) MEDIA.docWait(!!ok); },
      version: BOOT.version,
    }),
    enumerable: false, configurable: false, writable: false,
  });

  /* ------------------------------------------------------------- açılış */

  function boot() {
    ensureSheets();
    rebuildTheme();
    safeReplace(sheets.custom, S.customCss || '');
    safe('phone', updatePhone);
    const mo = new MutationObserver(schedule);
    mo.observe(root(), { childList: true, subtree: true });
    // WhatsApp kendi temasını değiştirince (açık/koyu) renkleri yeniden oku.
    // Kendi eklediğimiz wap-* sınıfları sayılmaz; yoksa her sohbet açılışında tema yeniden kurulur.
    const themeKey = () => [root().className, root().getAttribute('data-theme'),
      document.body && document.body.className, document.body && document.body.getAttribute('data-theme')]
      .join('|').replace(/\bwap-[\w-]+/g, '');
    let lastKey = themeKey();
    const themeWatch = new MutationObserver(() => {
      const k = themeKey();
      if (k !== lastKey) { lastKey = k; rebuildTheme(); }
    });
    themeWatch.observe(root(), { attributes: true, attributeFilter: ['class', 'data-theme'] });
    if (document.body) themeWatch.observe(document.body, { attributes: true, attributeFilter: ['class', 'data-theme'] });
    schedule();
    // Ayarlar sayfa yeniden yüklenmeden değişmiş olabilir: güncelini iste.
    invoke('wa_settings').then((s) => { if (s) apply(s); }).catch(() => {});
  }

  if (document.readyState === 'loading') {
    // Açılışta beyaz flaş olmasın: gövde gelmeden zemini boya.
    rebuildTheme();
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
  window.addEventListener('load', () => { rebuildTheme(); schedule(); }, { once: true });
})();
