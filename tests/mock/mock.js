// WhatsApp Web'in davranışını kabaca taklit eder:
// - satıra tıkla → #main; Esc → kapat; başlığa tıkla → sağ panel (kişi bilgisi); + → sol açılır panel
// - arama kutusu listeyi süzer; bazı sohbetler yalnızca aramayla bulunur (Zeynep)
// - yazı kutusu: boşken mikrofon, doluyken gönder düğmesi; gönderince mesaj eklenir
// - window.__mockPaste = true iken yapıştırmayı WhatsApp'ın editörü gibi kendisi işler
const right = document.querySelector('.right');
const drawer = document.querySelector('.drawer');
const inner = document.querySelector('.drawer-inner');
const dl = document.querySelector('.dl');
const grid = document.querySelector('#pane-side .grid');
const sbox = document.querySelector('.sbox');
const intro = right.innerHTML;

const CHATS = [
  { name: 'Ayşe', snippet: 'Gizli önizleme metni', unread: 3, visible: true },
  { name: 'Aura ekip', snippet: 'Prova 18:00', visible: true },
  { name: 'Mehmet', snippet: 'Tamam', visible: true },
  { name: 'Zeynep', snippet: 'Görüşürüz', visible: false },
];
const sent = {}; // sohbet adı → gönderilen mesajlar

function renderList(q) {
  grid.textContent = '';
  const query = (q || '').trim().toLowerCase();
  CHATS.filter((c) => (query ? c.name.toLowerCase().includes(query) : c.visible)).forEach((c, i) => {
    const row = document.createElement('div');
    row.setAttribute('role', 'row');
    row.setAttribute('data-testid', 'list-item-' + i);
    row.className = 'row';
    row.dataset.chat = c.name;
    row.innerHTML = `<div class="avatar"></div><div><div class="name"><span dir="auto" title="${c.name}">${c.name}</span></div><div class="snippet"><span title="${c.snippet}">${c.snippet}</span></div></div>${c.unread ? `<span class="unread">${c.unread}</span>` : ''}`;
    grid.appendChild(row);
  });
}
// WhatsApp gibi: arama sonuçları biraz gecikmeyle gelir
let searchTimer = 0;
sbox.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => renderList(sbox.textContent), 250);
});

function msg(out, text, id, quote) {
  const cls = out ? 'message-out' : 'message-in';
  const q = quote ? '<div class="quote">Alıntı</div>' : '';
  return `<div role="row"><div data-id="${out ? 'true' : 'false'}_90555@c.us_${id}" class="${cls}"><div class="bubble"><span data-icon="tail-${out ? 'out' : 'in'}"></span>${q}<span class="selectable-text">${text}</span><span class="meta">12:0${id % 10}</span></div></div></div>`;
}

function updateSendButton() {
  const ed = document.querySelector('#main .composer');
  const slot = document.querySelector('#main .send-slot');
  if (!ed || !slot) return;
  const has = ed.innerText.replace(/​/g, '').trim() !== '';
  slot.innerHTML = has
    ? '<button class="send" type="button" aria-label="Gönder"><span data-icon="wds-ic-send-filled"></span></button>'
    : '<button class="mic" type="button" aria-label="Sesli mesaj"><span data-icon="mic-outlined"></span></button>';
}

// Medya: Aura ekip sohbetinde 2 görsel, 1 video, 1 belge. Görseller sohbette data: önizleme,
// görüntüleyicide blob: tam boy (WhatsApp gibi).
function swatch(w, h, color) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); g.fillStyle = color; g.fillRect(0, 0, w, h);
  g.fillStyle = '#fff'; g.fillRect(w / 3, h / 3, w / 3, h / 3);
  return c;
}
const MEDIA = [
  { kind: 'image', color: '#c0392b' },
  { kind: 'video', color: '#2980b9' },
  { kind: 'doc', name: 'Teklif.pdf' },
  { kind: 'image', color: '#27ae60' },
];
function mediaMsg(m, i) {
  const id = `true_90555@c.us_M${i}`;
  if (m.kind === 'doc') {
    return `<div role="row"><div data-id="${id}" class="message-out"><div class="bubble doc"><span data-icon="document-pdf-icon"></span><span title="${m.name}">${m.name}</span><button class="dl" type="button"><span data-icon="audio-download"></span></button><span class="meta">12:1${i}</span></div></div></div>`;
  }
  const src = swatch(240, 160, m.color).toDataURL('image/jpeg');
  const play = m.kind === 'video' ? '<span data-icon="media-play" class="play">▶</span>' : '';
  return `<div role="row"><div data-id="${id}" class="message-out"><div class="bubble media" data-kind="${m.kind}" data-color="${m.color}"><img class="thumb" src="${src}" width="240" height="160">${play}<span class="meta">12:1${i}</span></div></div></div>`;
}
let viewer = null;
function openViewer(kind, color) {
  viewer = document.createElement('div');
  viewer.className = 'viewer';
  document.body.appendChild(viewer);
  if (kind === 'video') {
    const v = document.createElement('video');
    v.src = URL.createObjectURL(new Blob([new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112])], { type: 'video/mp4' }));
    viewer.appendChild(v);
  } else {
    swatch(900, 600, color).toBlob((b) => {
      const im = document.createElement('img');
      im.src = URL.createObjectURL(b);
      if (viewer) viewer.appendChild(im);
    }, 'image/png');
  }
}

function openChat(name) {
  const history = (sent[name] || []).map((t, i) => msg(true, t.replace(/\n/g, '<br>'), 50 + i)).join('');
  right.innerHTML = `<div id="main" data-testid="conversation-panel-wrapper"><header data-testid="conversation-header"><div class="avatar small"></div><div role="button" data-testid="conversation-info-header"><span dir="auto">${name}</span><div class="meta status">çevrimiçi</div></div></header>
  <div class="chat-body" data-testid="conversation-panel-body"><div data-testid="conversation-background-default_chat_wallpaper"></div><div class="scroll" data-testid="conversation-panel-messages"><div class="msgs" data-tab="8">
  ${msg(false, 'Gizli mesaj metni, numara 0555 123 45 67', 1)}${msg(true, 'Merhaba! Yarın prova var mı?', 2, true)}${msg(false, 'Evet, 18:00 stüdyoda.', 3)}${msg(true, 'Süper, görüşürüz', 4)}${name === 'Aura ekip' ? MEDIA.map(mediaMsg).join('') : ''}${history}
  </div></div></div><footer><div data-testid="compose-box" class="cbox"><div class="composer input" contenteditable="true" role="textbox" aria-label="Bir mesaj yazın"></div><span class="send-slot"></span></div></footer></div>`;
  const ed = document.querySelector('#main .composer');
  if (drafts[name]) ed.innerText = drafts[name];
  ed.addEventListener('input', updateSendButton);
  ed.addEventListener('paste', (e) => {
    if (!window.__mockPaste) return; // varsayılan: tarayıcı sentetik yapıştırmayı yok sayar
    e.preventDefault();
    const t = e.clipboardData.getData('text/plain');
    t.split('\n').forEach((line, i) => {
      if (i) document.execCommand('insertLineBreak');
      if (line) document.execCommand('insertText', false, line);
    });
    updateSendButton();
  });
  document.querySelector('#main footer').addEventListener('click', (e) => {
    if (!e.target.closest('.send')) return;
    const text = ed.innerText.replace(/​/g, '').replace(/\n$/, '');
    (sent[name] = sent[name] || []).push(text);
    ed.textContent = '';
    updateSendButton();
    document.querySelector('#main .msgs').insertAdjacentHTML('beforeend', msg(true, text.replace(/\n/g, '<br>'), 99));
  });
  updateSendButton();
  document.querySelector('#main .msgs').addEventListener('click', (e) => {
    const b = e.target.closest('.bubble.media');
    if (b) { openViewer(b.dataset.kind, b.dataset.color); return; }
    if (e.target.closest('.dl')) setTimeout(() => window.__wap && window.__wap.mediaDownloaded(true, 'Teklif.pdf'), 200);
  });
  document.querySelector('#main header [data-testid="conversation-info-header"]').addEventListener('click', () => {
    inner.innerHTML = '<div class="info">Kişi bilgisi</div>';
    drawer.classList.add('open');
  });
}
const drafts = {};
window.__mockDraft = (name, text) => { drafts[name] = text; };
window.__mockSent = () => sent;

grid.addEventListener('click', (e) => {
  const row = e.target.closest('[role=row]');
  if (row) openChat(row.dataset.chat);
});
document.querySelector('.newchat').addEventListener('click', () => dl.classList.add('open'));
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (viewer) { viewer.remove(); viewer = null; return; }
  if (dl.classList.contains('open')) { dl.classList.remove('open'); return; }
  if (drawer.classList.contains('open')) { drawer.classList.remove('open'); inner.innerHTML = ''; return; }
  if (document.getElementById('main')) right.innerHTML = intro;
});
window.__mockNotify = () => { new Notification('Ayşe', { body: 'Gizli bildirim metni', tag: 'x' }); };
renderList('');
