"""
Köprü katmanı testi: sahte bir WhatsApp Web sayfasını gerçek Chromium'da açar,
Tauri'yi taklit eder ve tema, telefon modu, baloncuklar, bildirim ve kısayolları dener.

Kullanım:  python3 -I tests/bridge_test.py <proje klasörü> <ekran görüntüsü klasörü>
"""
import json
import os
import pathlib
import sys

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(sys.argv[1])
SHOTS = pathlib.Path(sys.argv[2])
SHOTS.mkdir(parents=True, exist_ok=True)
MOCK = ROOT / "tests" / "mock"
INIT = (ROOT / "tests" / ".init.js").read_text()

CSP = "default-src 'self' blob:; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self' blob:"

FAKE_TAURI = """
window.__calls = [];
window.__sched = [];
window.__TAURI_INTERNALS__ = {
  invoke(cmd, args) {
    window.__calls.push([cmd, args]);
    if (cmd === 'wa_settings') return Promise.resolve(window.__WAP_BOOT__ && window.__WAP_BOOT__.settings);
    if (cmd === 'wa_schedule') {
      const a = args.action, d = args.data || {};
      if (a === 'list') return Promise.resolve(window.__sched.filter((i) => !d.chat || i.chat === d.chat));
      if (a === 'add') { const it = { id: 's' + (window.__sched.length + 1), chat: d.chat, text: d.text, due: d.due, status: 'bekliyor' }; window.__sched.push(it); return Promise.resolve(it); }
      if (a === 'cancel') { window.__sched = window.__sched.filter((i) => i.id !== d.id); return Promise.resolve(null); }
      if (a === 'update') { const it = window.__sched.find((i) => i.id === d.id); it.text = d.text; it.due = d.due; return Promise.resolve(it); }
      return Promise.resolve(null);
    }
    if (cmd === 'wa_media') {
      if (args.action === 'save') { window.__saved = (window.__saved || []).concat([{ name: args.data.name, chat: args.data.chat, size: args.data.data.length }]); return Promise.resolve('C:/x/' + args.data.name); }
      return Promise.resolve(null);
    }
    return Promise.resolve(null);
  }
};
"""

failures = []


def check(name, cond, detail=""):
    print(("ok   " if cond else "FAIL ") + name + (f"  ({detail})" if detail and not cond else ""))
    if not cond:
        failures.append(name)


def serve(route):
    path = route.request.url.split("web.whatsapp.com", 1)[1].split("?")[0]
    files = {"/": ("index.html", "text/html"), "/mock.css": ("mock.css", "text/css"), "/mock.js": ("mock.js", "application/javascript")}
    if path not in files:
        return route.fulfill(status=404, body="")
    name, ctype = files[path]
    route.fulfill(status=200, body=(MOCK / name).read_text(), headers={"content-type": ctype + "; charset=utf-8", "content-security-policy": CSP})


def css(page, sel, prop):
    return page.evaluate("([s,p]) => { const e = document.querySelector(s); return e ? getComputedStyle(e)[p] : null; }", [sel, prop])


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get("CHROMIUM") or None, args=["--no-sandbox"])
    page = browser.new_page(viewport={"width": 1100, "height": 760})
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.route("https://web.whatsapp.com/**", serve)
    page.add_init_script(FAKE_TAURI)
    page.add_init_script(INIT)
    page.goto("https://web.whatsapp.com/")
    page.wait_for_timeout(500)

    # --- tema
    check("köprü yüklendi", page.evaluate("typeof window.__wap === 'object'"))
    check("gövde zemini siyah", css(page, "body", "backgroundColor") == "rgb(0, 0, 0)", css(page, "body", "backgroundColor"))
    panel = page.evaluate("getComputedStyle(document.body).getPropertyValue('--panel-background').trim()")
    check("panel rengi siyaha haritalandı", panel.startswith("rgb(") and max(map(int, panel[4:-1].split(","))) <= 16, panel)
    header = page.evaluate("getComputedStyle(document.body).getPropertyValue('--panel-header-background').trim()")
    check("başlık rengi koyu gri", header.startswith("rgb(") and header != "rgb(0, 0, 0)", header)
    teal = page.evaluate("getComputedStyle(document.body).getPropertyValue('--teal').trim()")
    check("yeşil vurgu turuncuya döndü", teal == "rgb(236, 37, 0)", teal)
    tri = page.evaluate("getComputedStyle(document.body).getPropertyValue('--rgb-teal').trim()")
    check("üçlü renk (rgb-teal) de haritalandı", tri in ("", "236, 37, 0"), tri)
    font = page.evaluate("getComputedStyle(document.querySelector('.name')).fontFamily")
    check("Inter yazı tipi uygulandı", "WAP Inter" in font, font)
    check("Inter yüklendi (CSP altında)", page.evaluate("document.fonts.check('14px \"WAP Inter\"')"))

    # --- düzen
    check("bölünmüş düzen bulundu", page.evaluate("!!document.querySelector('.two[data-wap-split]')"))
    check("liste paneli işaretlendi", page.evaluate("document.querySelector('.left').getAttribute('data-wap-pane')") == "list")
    check("sohbet paneli işaretlendi", page.evaluate("document.querySelector('.right').getAttribute('data-wap-pane')") == "chat")
    check("gezinme şeridi işaretlendi", page.evaluate("document.querySelector('.rail').getAttribute('data-wap-pane')") == "rail")
    check("katmanlar ayrı işaretlendi", page.evaluate("['.ov-full','.ov-side','.modal-layer'].every(s => document.querySelector(s).getAttribute('data-wap-pane') === 'overlay')"))
    check("sağ panel işaretlendi", page.evaluate("document.querySelector('.drawer').getAttribute('data-wap-pane')") == "drawer")
    check("normal genişlikte telefon modu kapalı", not page.evaluate("document.documentElement.classList.contains('wap-phone')"))

    page.click("[data-chat='Ayşe']")
    page.wait_for_timeout(400)
    check("sohbet açıldı", page.evaluate("document.documentElement.classList.contains('wap-chat')"))
    check("kapalı sağ panel açık sanılmadı", not page.evaluate("document.documentElement.classList.contains('wap-drawer')"))
    out_bg = css(page, "[data-wap-bubble=out]", "backgroundColor")
    in_bg = css(page, "[data-wap-bubble=in]", "backgroundColor")
    check("giden baloncuk işaretlendi ve boyandı", out_bg == "rgb(31, 31, 31)", str(out_bg))
    check("gelen baloncuk işaretlendi ve boyandı", in_bg == "rgb(16, 16, 16)", str(in_bg))
    check("baloncuk sayısı doğru", page.evaluate("document.querySelectorAll('[data-wap-bubble]').length") == 4)
    check("alıntı kutusu baloncuk sayılmadı", page.evaluate("!document.querySelector('.quote[data-wap-bubble]')"))
    check("baloncuk köşeleri yuvarlak", css(page, "[data-wap-bubble=out]", "borderTopRightRadius") == "12px", css(page, "[data-wap-bubble=out]", "borderTopRightRadius"))
    check("kuyruklar gizlendi", css(page, "[data-icon=tail-out]", "display") == "none")
    check("sohbet zemini tema rengi", css(page, "[data-testid^=conversation-background]", "backgroundImage") == "none")
    page.screenshot(path=str(SHOTS / "1-normal.png"))

    # --- bildirim
    page.evaluate("window.__mockNotify()")
    page.wait_for_timeout(50)
    calls = page.evaluate("window.__calls")
    notes = [c for c in calls if c[0] == "wa_event" and c[1]["kind"] == "notify"]
    check("bildirim Rust'a iletildi", len(notes) == 1 and notes[0][1]["data"]["title"] == "Ayşe", json.dumps(notes))
    check("bildirim izni verildi görünüyor", page.evaluate("Notification.permission") == "granted")

    # --- kısayollar
    page.keyboard.press("Control+1")
    page.keyboard.press("Control+t")
    page.keyboard.press("Control+Comma")
    page.wait_for_timeout(50)
    acts = [c[1]["data"] for c in page.evaluate("window.__calls") if c[0] == "wa_event" and c[1]["kind"] == "action"]
    check("Ctrl+1 / Ctrl+T / Ctrl+, iletildi", acts == ["phone", "ontop", "settings"], str(acts))

    # --- telefon modu
    page.set_viewport_size({"width": 390, "height": 800})
    page.wait_for_timeout(400)
    check("dar pencerede telefon modu", page.evaluate("document.documentElement.classList.contains('wap-phone')"))
    check("sohbet görünümünde liste gizli", css(page, ".left", "display") == "none")
    check("sohbet şerit dışında tam genişlik", page.evaluate("Math.round(document.querySelector('.right').getBoundingClientRect().width)") >= 390 - 66,
          str(page.evaluate("document.querySelector('.right').getBoundingClientRect().width")))
    check("geri oku görünür", css(page, "#wap-back", "display") == "flex")
    check("yatay kaydırma yok", page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), str(page.evaluate("document.documentElement.scrollWidth")))
    page.screenshot(path=str(SHOTS / "2-telefon-sohbet.png"))

    page.click("#main [data-testid=conversation-info-header]")
    page.wait_for_timeout(400)
    check("kişi bilgisi açılınca sohbetin yerini aldı", css(page, ".right", "display") == "none" and css(page, ".drawer", "display") != "none")
    page.screenshot(path=str(SHOTS / "3-telefon-bilgi.png"))
    page.keyboard.press("Escape")
    page.wait_for_timeout(400)
    check("Esc ile bilgi kapandı, sohbet döndü", css(page, ".right", "display") != "none")

    page.click("#wap-back")
    page.wait_for_timeout(400)
    check("geri ile listeye dönüldü", not page.evaluate("document.documentElement.classList.contains('wap-chat')"))
    check("WhatsApp tarafında da sohbet kapandı", not page.evaluate("!!document.getElementById('main')"))
    check("liste görünür", css(page, ".left", "display") != "none")
    check("liste şerit dışında tam genişlik", page.evaluate("Math.round(document.querySelector('.left').getBoundingClientRect().width)") >= 390 - 66,
          str(page.evaluate("document.querySelector('.left').getBoundingClientRect().width")))
    check("şerit görünür", css(page, ".rail", "display") != "none")
    check("boş sağ panel yer kaplamıyor", page.evaluate("document.querySelector('.drawer').getBoundingClientRect().width") <= 1)
    page.click(".newchat")
    page.wait_for_timeout(300)
    dlw = page.evaluate("Math.round(document.querySelector('.dl').getBoundingClientRect().width)")
    check("yeni sohbet paneli şerit dışında tam genişlik", dlw >= 390 - 66, str(dlw))
    page.screenshot(path=str(SHOTS / "5-telefon-yeni-sohbet.png"))
    page.keyboard.press("Escape")
    page.wait_for_timeout(200)
    page.screenshot(path=str(SHOTS / "4-telefon-liste.png"))

    page.click("[data-chat='Aura ekip']")
    page.wait_for_timeout(400)
    check("listeden ikinci sohbet açıldı", page.evaluate("document.documentElement.classList.contains('wap-chat')"))
    page.mouse.click(5, 5, button="right")  # yoksay, sadece olay akışı

    # --- tanılama gizliliği
    info = page.evaluate("window.__wap.diagnose()")
    blob = json.dumps(info, ensure_ascii=False)
    check("tanılama mesaj metni içermiyor", "Gizli" not in blob and "0555" not in blob and "Ayşe" not in blob and "prova" not in blob.lower())
    check("tanılama renk değişkenlerini içeriyor", len(info["colorVars"]) >= 10, str(len(info["colorVars"])))

    # --- ayar değişikliği canlı uygulanıyor
    page.evaluate("""() => { const s = JSON.parse(JSON.stringify(window.__WAP_BOOT__.settings));
      s.theme.outBubble = '#7B2FF7'; s.theme.accent = '#FF4FD8'; window.__wap.apply(s); }""")
    page.wait_for_timeout(300)
    check("yeni tema canlı uygulandı", css(page, "[data-wap-bubble=out]", "backgroundColor") == "rgb(123, 47, 247)", str(css(page, "[data-wap-bubble=out]", "backgroundColor")))
    page.evaluate("""() => { const s = JSON.parse(JSON.stringify(window.__WAP_BOOT__.settings)); s.themeEnabled = false; window.__wap.apply(s); }""")
    page.wait_for_timeout(200)
    check("tema kapatılınca WhatsApp renkleri döndü", css(page, "body", "backgroundColor") == "rgb(12, 19, 23)", css(page, "body", "backgroundColor"))

    # --- açık kaynak tema → koyu tema
    page.evaluate("""() => { document.body.classList.remove('dark'); const s = JSON.parse(JSON.stringify(window.__WAP_BOOT__.settings)); window.__wap.apply(s); }""")
    page.wait_for_timeout(300)
    panel2 = page.evaluate("getComputedStyle(document.body).getPropertyValue('--panel-background').trim()")
    check("WhatsApp açık moddayken de zemin koyu", panel2.startswith("rgb(") and max(map(int, panel2[4:-1].split(","))) <= 10, panel2)
    prim = page.evaluate("getComputedStyle(document.body).getPropertyValue('--primary').trim()")
    check("WhatsApp açık moddayken de yazı açık", prim.startswith("rgb(") and min(map(int, prim[4:-1].split(","))) >= 225, prim)

    # --- kendiliğinden tanılama: geçişlerde gönderildi, mesaj metni yok
    diags = [c[1]["data"] for c in page.evaluate("window.__calls") if c[0] == "wa_event" and c[1]["kind"] == "diag"]
    names = sorted({d.get("name") for d in diags})
    check("otomatik tanılamalar gönderildi", {"acilis", "sohbet", "telefon"} <= set(names), str(names))
    blob = json.dumps(diags, ensure_ascii=False)
    check("otomatik tanılama gizli metin içermiyor", "Gizli" not in blob and "0555" not in blob and "Ayşe" not in blob and "90555" not in blob)
    check("tanılama sayfa iskeletini içeriyor", any(d.get("tree") and d["tree"].get("id") == "app" for d in diags))

    # --- güvenlik ağı: telefon düzeni boş ekran verirse geri alınır
    page.set_viewport_size({"width": 1100, "height": 760})
    page.wait_for_timeout(300)
    page.evaluate("""() => { const st = new CSSStyleSheet(); st.replaceSync('#pane-side{display:none !important}');
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, st]; }""")
    page.keyboard.press("Escape")
    page.wait_for_timeout(300)
    page.set_viewport_size({"width": 390, "height": 800})
    page.wait_for_timeout(2600)
    check("bozuk düzende telefon modu geri alındı", not page.evaluate("document.documentElement.classList.contains('wap-phone')"))
    diags = [c[1]["data"] for c in page.evaluate("window.__calls") if c[0] == "wa_event" and c[1]["kind"] == "diag"]
    check("hata tanılaması gönderildi", any(d.get("name") == "telefon-hata" for d in diags))

    # --- yakınlaştırma eşiği: %50'de 900 CSS px = 450 mantıksal px → telefon
    page.evaluate("""() => { const st = [...document.adoptedStyleSheets]; st.pop(); document.adoptedStyleSheets = st;
      const s = JSON.parse(JSON.stringify(window.__WAP_BOOT__.settings)); s.zoom = 50; window.__wap.apply(s); }""")
    page.set_viewport_size({"width": 1600, "height": 760})
    page.wait_for_timeout(300)
    check("%50 yakınlaştırmada 1600 CSS px normal düzen", not page.evaluate("document.documentElement.classList.contains('wap-phone')"))
    page.set_viewport_size({"width": 900, "height": 760})
    page.wait_for_timeout(500)
    check("yakınlaştırma hesaba katıldı", page.evaluate("document.documentElement.classList.contains('wap-phone')"))

    # --- sohbet açma (bildirim tıklaması) ve zamanlı gönderim
    page.evaluate("""() => { const s = JSON.parse(JSON.stringify(window.__WAP_BOOT__.settings)); window.__wap.apply(s); }""")
    page.set_viewport_size({"width": 1100, "height": 760})
    page.wait_for_timeout(400)
    title = lambda: page.evaluate("(() => { const s = document.querySelector('#main [data-testid=conversation-info-header] span[dir=auto]'); return s ? s.textContent : null; })()")
    results = lambda: {c[1]["data"]["id"]: c[1]["data"] for c in page.evaluate("window.__calls") if c[0] == "wa_event" and c[1]["kind"] == "scheduled-result"}
    page.evaluate("window.__wap.openChat('Mehmet')")
    page.wait_for_timeout(800)
    check("sohbet listeden açıldı", title() == "Mehmet", str(title()))
    page.evaluate("window.__wap.openChat('Zeynep')")
    page.wait_for_timeout(2200)
    check("listede olmayan sohbet aramayla açıldı", title() == "Zeynep", str(title()))
    page.wait_for_timeout(400)
    check("arama kutusu temizlendi", page.evaluate("document.querySelector('.sbox').textContent") == "")
    check("liste eski haline döndü", page.evaluate("document.querySelectorAll('#pane-side [role=row]').length") == 3)

    page.evaluate("window.__mockPaste = true")
    page.evaluate("window.__wap.openChat('Ayşe')")
    page.wait_for_timeout(800)
    page.evaluate("window.__wap.sendScheduled({id: 't1', chat: 'Mehmet', text: 'Satır bir\\nSatır iki'})")
    page.wait_for_timeout(4000)
    r = results().get("t1")
    check("zamanlı mesaj gönderildi (yapıştırma yolu)", bool(r and r["ok"]), str(r))
    check("mesaj iki satır olarak gitti", page.evaluate("window.__mockSent()['Mehmet']") == ["Satır bir\nSatır iki"], str(page.evaluate("window.__mockSent()")))
    check("gönderimden sonra önceki sohbete dönüldü", title() == "Ayşe", str(title()))

    page.evaluate("window.__mockPaste = false")
    page.evaluate("window.__wap.sendScheduled({id: 't2', chat: 'Zeynep', text: 'Yedek yol\\nikinci satır'})")
    page.wait_for_timeout(6000)
    r = results().get("t2")
    check("zamanlı mesaj gönderildi (yazma yolu, aramayla)", bool(r and r["ok"]), str(r))
    check("yazma yolunda da iki satır", page.evaluate("window.__mockSent()['Zeynep']") == ["Yedek yol\nikinci satır"], str(page.evaluate("window.__mockSent()")))

    page.evaluate("window.__mockDraft('Aura ekip', 'yarım kalmış')")
    page.evaluate("window.__wap.sendScheduled({id: 't3', chat: 'Aura ekip', text: 'x'})")
    page.wait_for_timeout(2500)
    r = results().get("t3")
    check("taslak varken gönderilmedi", bool(r and not r["ok"] and "taslak" in (r["error"] or "")), str(r))
    check("taslağa dokunulmadı", "Aura ekip" not in page.evaluate("window.__mockSent()"))

    page.evaluate("window.__wap.sendScheduled({id: 't4', chat: 'Olmayan Kişi', text: 'x'})")
    page.wait_for_timeout(7500)
    r = results().get("t4")
    check("bilinmeyen sohbete gönderilmedi", bool(r and not r["ok"] and "bulunamadı" in (r["error"] or "")), str(r))

    # --- zamanlama paneli
    page.evaluate("window.__wap.openChat('Ayşe')")
    page.wait_for_timeout(800)
    check("saat düğmesi görünür", css(page, ".wap-fab", "display") == "flex")
    check("saat düğmesi en üst katmanda", page.evaluate("""(() => { const f = document.querySelector('.wap-fab'); const r = f.getBoundingClientRect();
      return f.contains(document.elementFromPoint(r.left + 18, r.top + 18)); })()"""))
    # WhatsApp'ın bir penceresi sohbetin üstünü kaplarsa düğme gizlenmeli
    page.evaluate("""() => { const m = document.querySelector('.modal-layer'); const d = document.createElement('div');
      d.id = 'mock-modal'; d.style.cssText = 'position:absolute;inset:0;background:#000;pointer-events:auto'; m.appendChild(d); }""")
    page.wait_for_timeout(400)
    check("üstü kapanınca saat düğmesi gizlendi", css(page, ".wap-fab", "display") == "none")
    page.evaluate("document.getElementById('mock-modal').remove()")
    page.wait_for_timeout(400)
    check("kaplama kalkınca saat düğmesi geri geldi", css(page, ".wap-fab", "display") == "flex")
    page.click("#main .composer")
    page.keyboard.type("Akşam ara beni")
    page.keyboard.press("Control+Shift+Enter")
    page.wait_for_timeout(300)
    check("Ctrl+Shift+Enter paneli açtı", page.evaluate("!!document.querySelector('.wap-panel')"))
    check("panel yazı kutusundaki metni aldı", page.evaluate("document.querySelector('.wap-ta').value") == "Akşam ara beni")
    page.click(".wap-chip:has-text('Yarın 09:00')")
    check("hızlı seçim zamanı ayarladı", page.evaluate("document.querySelector('.wap-dt').value").endswith("T09:00"))
    when = page.evaluate("document.querySelector('.wap-when').textContent")
    check("zamanın yanında ne kadar sonra olduğu yazıyor", when.startswith("Yarın 09:00 · ") and "sonra" in when, when)
    page.keyboard.type(" lütfen")  # hızlı seçimden sonra odak yazı alanına dönmüş olmalı
    check("panelde yazarken tuşlar WhatsApp'a gitmedi", page.evaluate("document.querySelector('.wap-ta').value") == "Akşam ara beni lütfen")
    page.screenshot(path=str(SHOTS / "6-zamanla-panel.png"))
    page.click(".wap-go")
    page.wait_for_timeout(600)
    adds = [c[1] for c in page.evaluate("window.__calls") if c[0] == "wa_schedule" and c[1]["action"] == "add"]
    check("zamanlama kaydı Rust'a gitti", len(adds) == 1 and adds[0]["data"]["chat"] == "Ayşe" and adds[0]["data"]["text"] == "Akşam ara beni lütfen", str(adds))
    check("yazı kutusu temizlendi", page.evaluate("document.querySelector('#main .composer').innerText.trim()") == "")
    check("zamanlayınca panel kapandı", page.evaluate("!document.querySelector('.wap-panel')"))

    # --- sohbette önizleme baloncuğu
    ghost = lambda: page.evaluate("""(() => { const g = document.querySelector('.wap-ghost'); if (!g) return null;
      const box = document.querySelector('[data-testid=conversation-panel-messages]'); const r = g.getBoundingClientRect(), b = box.getBoundingClientRect();
      return { text: g.querySelector('.wap-ghost-text').textContent, meta: g.querySelector('.wap-ghost-meta').textContent,
        last: box.lastElementChild === g.closest('.wap-sched-zone'), gapR: Math.round(b.right - r.right), n: document.querySelectorAll('.wap-ghost').length }; })()""")
    g = ghost()
    check("zamanlanmış mesaj sohbette baloncuk olarak görünüyor", bool(g and g["text"] == "Akşam ara beni lütfen"), str(g))
    check("baloncuk sohbetin en altında", bool(g and g["last"]), str(g))
    check("baloncukta gönderim zamanı yazıyor", bool(g and "Yarın 09:00" in g["meta"]), str(g))
    out_r = page.evaluate("Math.round(document.querySelector('[data-testid=conversation-panel-messages]').getBoundingClientRect().right - document.querySelector('[data-wap-bubble=out]').getBoundingClientRect().right)")
    check("baloncuk gerçek giden mesajlarla aynı hizada", bool(g and abs(g["gapR"] - out_r) <= 2), f"{g} / gerçek {out_r}")
    page.screenshot(path=str(SHOTS / "7-sohbette-zamanlanmis.png"))
    page.evaluate("window.__wap.openChat('Mehmet')")
    page.wait_for_timeout(800)
    check("başka sohbette baloncuk yok", page.evaluate("document.querySelectorAll('.wap-ghost').length") == 0)
    page.evaluate("window.__wap.openChat('Ayşe')")
    page.wait_for_timeout(800)
    check("sohbete dönünce baloncuk geri geldi", (ghost() or {}).get("n") == 1)

    # menü: düzenle
    page.click(".wap-ghost")
    page.wait_for_timeout(200)
    items = page.evaluate("[...document.querySelectorAll('.wap-menu-item')].map(b => b.textContent)")
    check("baloncuğa tıklayınca menü açıldı", items == ["Şimdi gönder", "Düzenle", "Zamanlamayı iptal et"], str(items))
    page.click(".wap-menu-item:has-text('Düzenle')")
    page.wait_for_timeout(300)
    check("düzenleme paneli metni getirdi", page.evaluate("document.querySelector('.wap-ta') && document.querySelector('.wap-ta').value") == "Akşam ara beni lütfen")
    page.fill(".wap-ta", "Akşam 9'da ara")
    page.click(".wap-go")
    page.wait_for_timeout(600)
    ups = [c[1] for c in page.evaluate("window.__calls") if c[0] == "wa_schedule" and c[1]["action"] == "update"]
    check("düzenleme kaydedildi", len(ups) == 1 and ups[0]["data"]["text"] == "Akşam 9'da ara", str(ups))
    check("baloncuk güncellendi", (ghost() or {}).get("text") == "Akşam 9'da ara", str(ghost()))
    page.screenshot(path=str(SHOTS / "8-menu.png")) if False else None

    # menü: iptal
    page.click(".wap-ghost")
    page.wait_for_timeout(200)
    page.screenshot(path=str(SHOTS / "8-menu.png"))
    page.click(".wap-menu-item:has-text('iptal')")
    page.wait_for_timeout(600)
    check("iptal edince baloncuk kalktı", page.evaluate("document.querySelectorAll('.wap-ghost').length") == 0)

    # Esc: önce panel kapanır, sohbet açık kalır
    page.click(".wap-fab")
    page.wait_for_timeout(200)
    page.keyboard.press("Escape")
    page.wait_for_timeout(200)
    check("Esc paneli kapattı, sohbet açık kaldı", page.evaluate("!document.querySelector('.wap-panel') && !!document.getElementById('main')"))

    # --- sohbet listesinde zamanlanmış mesajlar
    page.evaluate("""() => { const t = Date.now();
      window.__sched = [
        { id: 'a1', chat: 'Zeynep', text: 'Yarın kahve?', due: t + 3600e3, status: 'bekliyor' },
        { id: 'a2', chat: 'Mehmet', text: 'Fatura ekte', due: t + 7200e3, status: 'bekliyor' },
        { id: 'a3', chat: 'Mehmet', text: 'İkinci mesaj', due: t + 9000e3, status: 'bekliyor' },
      ];
      window.__wap.schedulesChanged(); }""")
    page.wait_for_timeout(600)
    rows = page.evaluate("[...document.querySelectorAll('.wap-sched-row .wap-sched-name')].map(e => e.textContent)")
    check("listenin üstünde zamanlanmış bölümü, en yakın önce", rows == ["Zeynep", "Mehmet"], str(rows))
    check("bölüm listenin hemen üstünde", page.evaluate("document.querySelector('.wap-sched-list').nextElementSibling === document.getElementById('pane-side')"))
    check("önizleme metni görünüyor", page.evaluate("document.querySelector('.wap-sched-row .wap-sched-snip').textContent") == "Yarın kahve?")
    check("birden fazla mesaj sayısı gösteriliyor", page.evaluate("document.querySelectorAll('.wap-sched-row')[1].querySelector('.wap-sched-badge').textContent") == "2")
    check("gerçek satırda adın yanında saat var", page.evaluate("!!document.querySelector('[data-chat=\"Mehmet\"] .wap-row-clock') && !document.querySelector('[data-chat=\"Ayşe\"] .wap-row-clock')"))
    h_sched = page.evaluate("Math.round(document.querySelector('.wap-sched-row').getBoundingClientRect().height)")
    h_real = page.evaluate("Math.round(document.querySelector('#pane-side [role=row]').getBoundingClientRect().height)")
    check("bölüm satırı gerçek satırla aynı yükseklikte", h_sched == h_real, f"{h_sched} / {h_real}")
    page.screenshot(path=str(SHOTS / "9-liste-zamanlanmis.png"))
    page.click(".wap-sched-row:has-text('Zeynep')")
    page.wait_for_timeout(2500)
    check("bölümden tıklayınca sohbet açıldı (listede olmayan bile)", title() == "Zeynep", str(title()))
    page.evaluate("() => { window.__sched = []; window.__wap.schedulesChanged(); }")
    page.wait_for_timeout(500)
    check("zamanlanmış kalmayınca bölüm ve saatler kalktı", page.evaluate("!document.querySelector('.wap-sched-list') && !document.querySelector('.wap-row-clock')"))

    # --- medya toplayıcı
    page.evaluate("window.__wap.openChat('Aura ekip')")
    page.wait_for_timeout(900)
    pos = page.evaluate("(() => { const b = document.querySelector('#main [data-testid=conversation-panel-messages]'); return [Math.round(b.scrollTop + b.clientHeight), b.scrollHeight]; })()")
    check("sohbet açılınca en altta (son mesaj görünür)", pos[1] > pos[0] - 1 and pos[0] >= pos[1] - 2, str(pos))
    page.evaluate("window.__wap.openChat('Mehmet')")
    page.wait_for_timeout(300)
    page.evaluate("window.__wap.openChat('Aura ekip')")
    page.wait_for_timeout(200)
    bb = page.evaluate("(() => { const r = document.querySelector('#main [data-testid=conversation-panel-messages]').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()")
    page.mouse.move(bb[0], bb[1])
    page.mouse.wheel(0, -200)
    page.evaluate("document.querySelector('#main [data-testid=conversation-panel-messages]').scrollTop = 0")
    page.wait_for_timeout(400)
    check("kullanıcı kaydırınca sabitleme bırakıyor", page.evaluate("document.querySelector('#main [data-testid=conversation-panel-messages]').scrollTop") < 50)
    # yeni mesaj gelince altta kal (odak yokken de); yukarı kaydırılmışsa dokunma
    page.evaluate("window.__wap.openChat('Mehmet')")
    page.wait_for_timeout(300)
    page.evaluate("window.__wap.openChat('Aura ekip')")
    page.wait_for_timeout(3000)
    add = """(n) => { const m = document.querySelector('#main .msgs'); for (let i = 0; i < n; i++) { const d = document.createElement('div'); d.setAttribute('role', 'row'); d.innerHTML = '<div class="message-in"><div class="bubble"><span class="selectable-text">yeni ' + i + '</span></div></div>'; m.appendChild(d); } }"""
    page.evaluate("window.dispatchEvent(new Event('blur'))")
    page.evaluate(add, 3)
    page.wait_for_timeout(200)
    gap = page.evaluate("(() => { const b = document.querySelector('#main [data-testid=conversation-panel-messages]'); return Math.round(b.scrollHeight - b.scrollTop - b.clientHeight); })()")
    check("yeni mesaj gelince en altta kaldı", gap <= 2, str(gap))
    page.evaluate("document.querySelector('#main [data-testid=conversation-panel-messages]').scrollTop = 0")
    page.wait_for_timeout(150)
    page.evaluate(add, 2)
    page.wait_for_timeout(200)
    check("yukarı kaydırılmışken yeni mesaj konumu değiştirmedi", page.evaluate("document.querySelector('#main [data-testid=conversation-panel-messages]').scrollTop") < 5)
    check("medya düğmesi görünür", css(page, ".wap-fab-media", "display") == "flex")
    page.keyboard.press("Control+Shift+M")
    page.wait_for_timeout(400)
    tabs = page.evaluate("[...document.querySelectorAll('.wap-media-tabs .wap-chip')].map(b => b.textContent)")
    check("medya türlere göre sayıldı", tabs == ["Görseller 2", "Videolar 1", "Belgeler 1"], str(tabs))
    check("panel sohbetin üstünü kaplıyor", page.evaluate("""(() => { const a = document.querySelector('.wap-media').getBoundingClientRect(), b = document.getElementById('main').getBoundingClientRect();
      return Math.abs(a.left - b.left) < 2 && Math.abs(a.width - b.width) < 2; })()"""))
    page.screenshot(path=str(SHOTS / "10-medya.png"))
    page.click(".wap-media-go")
    page.wait_for_timeout(4000)
    saved = page.evaluate("window.__saved || []")
    check("iki görsel tam boy kaydedildi", len(saved) == 2 and all(x["name"].endswith(".png") and x["size"] > 2000 for x in saved), str([(x['name'], x['size']) for x in saved]))
    check("görüntüleyici kapatıldı, sohbet açık", page.evaluate("!document.querySelector('.viewer') && !!document.getElementById('main')"))
    page.click(".wap-media-tabs .wap-chip:has-text('Videolar')")
    page.click(".wap-media-go")
    page.wait_for_timeout(2500)
    saved = page.evaluate("window.__saved || []")
    check("video kaydedildi", len(saved) == 3 and saved[2]["name"].endswith(".mp4"), str([x['name'] for x in saved]))
    page.click(".wap-media-tabs .wap-chip:has-text('Belgeler')")
    page.click(".wap-media-go")
    page.wait_for_timeout(1500)
    targets = [c[1]["data"]["chat"] for c in page.evaluate("window.__calls") if c[0] == "wa_media" and c[1]["action"] == "target"]
    check("belge indirmesi sohbet klasörüne yönlendirildi", "Aura ekip" in targets and targets[-1] == "", str(targets))
    check("belge kaydedildi işaretlendi", page.evaluate("!!document.querySelector('.wap-media-docs .wap-media-ok')"))
    check("medya açıkken geri düğmesi gizli", page.evaluate("document.documentElement.classList.contains('wap-media-open') && (!document.getElementById('wap-back') || getComputedStyle(document.getElementById('wap-back')).display === 'none')"))
    page.keyboard.press("Escape")
    page.wait_for_timeout(300)
    check("Esc medya panelini kapattı, sohbet açık", page.evaluate("!document.querySelector('.wap-media') && !!document.getElementById('main')"))

    # --- mini pencere
    page.evaluate("""() => { const s = JSON.parse(JSON.stringify(window.__WAP_BOOT__.settings)); s.mode = 'mini'; s.phoneZoom = 100; window.__wap.apply(s); }""")
    page.set_viewport_size({"width": 360, "height": 560})
    page.wait_for_timeout(800)
    check("mini: çubuk görünür ve sohbet adını yazıyor", page.evaluate("(document.querySelector('.wap-minibar-title') || {}).textContent") == "Aura ekip")
    check("mini: tek panel, sohbet tam genişlik", page.evaluate("Math.round(document.getElementById('main').getBoundingClientRect().width)") >= 358)
    check("mini: gezinme şeridi görünmüyor", page.evaluate("document.querySelector('.rail').getBoundingClientRect().right") <= 1)
    check("mini: içerik çubuğun altında başlıyor", page.evaluate("Math.round(document.getElementById('main').getBoundingClientRect().top)") == 30)
    page.screenshot(path=str(SHOTS / "11-mini.png"))
    page.click(".wap-minibar-btn[aria-label^='Büyüt']")
    page.wait_for_timeout(100)
    acts = [c[1]["data"] for c in page.evaluate("window.__calls") if c[0] == "wa_event" and c[1]["kind"] == "action"]
    check("mini: büyüt düğmesi moddan çıkmayı istedi", acts[-1] == "mini", str(acts[-3:]))
    page.evaluate("""() => { const s = JSON.parse(JSON.stringify(window.__WAP_BOOT__.settings)); window.__wap.apply(s); }""")
    page.set_viewport_size({"width": 1100, "height": 760})
    page.wait_for_timeout(400)
    check("mini kapanınca mini sınıfı kalktı", page.evaluate("!document.documentElement.classList.contains('wap-mini')"))

    # --- başlık çubuğu her modda
    check("normal: başlık çubuğu var, başlık Wazzap?", page.evaluate("(document.querySelector('.wap-minibar-title') || {}).textContent") == "Wazzap?")
    check("normal: içerik çubuğun altında", page.evaluate("Math.round(document.getElementById('app').getBoundingClientRect().top)") == 30)
    check("normal: tam ekran düğmesi görünür", page.evaluate("!document.querySelector('.wap-bar-max').hidden"))
    bar = page.evaluate("(() => { const r = document.querySelector('.wap-minibar').getBoundingClientRect(); const c = document.querySelector('.wap-cap-close').getBoundingClientRect(); return [r.top, r.height, Math.round(c.right)]; })()")
    check("çubuk üstte, 30px, kapat sağ kenarda", bar[0] == 0 and round(bar[1]) == 30 and bar[2] == 1100, str(bar))
    before = len(page.evaluate("window.__calls"))
    for sel in [".wap-bar-pin", ".wap-cap[aria-label='Alta al']", ".wap-bar-max", ".wap-cap-close", ".wap-bar-mini"]:
        page.click(sel)
    page.wait_for_timeout(100)
    acts = [c[1]["data"] for c in page.evaluate("window.__calls")[before:] if c[0] == "wa_event" and c[1]["kind"] == "action"]
    check("çubuk düğmeleri doğru eylemleri istedi", acts == ["ontop", "minimize", "maximize", "hide", "mini"], str(acts))
    page.evaluate("""() => { const s = JSON.parse(JSON.stringify(window.__WAP_BOOT__.settings)); s.alwaysOnTop = true; window.__wap.apply(s); window.__wap.win({ max: true }); }""")
    page.wait_for_timeout(100)
    check("iğne üstte kalma durumunu gösteriyor", page.evaluate("document.querySelector('.wap-bar-pin').classList.contains('on')"))
    check("tam ekranda düğme 'Önceki boyut' oldu", page.evaluate("document.querySelector('.wap-bar-max').title") == "Önceki boyut")
    before = len(page.evaluate("window.__calls"))
    page.mouse.click(500, 15, click_count=2)
    page.wait_for_timeout(100)
    acts = [c[1]["data"] for c in page.evaluate("window.__calls")[before:] if c[0] == "wa_event" and c[1]["kind"] == "action"]
    check("çubuğa çift tık: sürükle + tam ekran", acts == ["drag", "maximize"], str(acts))
    page.evaluate("""() => { const s = JSON.parse(JSON.stringify(window.__WAP_BOOT__.settings)); s.mode = 'phone'; s.phoneZoom = 80; window.__wap.apply(s); window.__wap.win({ max: false }); }""")
    page.wait_for_timeout(200)
    z = page.evaluate("(() => { const b = document.querySelector('.wap-minibar'); return [b.style.zoom, getComputedStyle(document.documentElement).getPropertyValue('--wap-bar-h').trim()]; })()")
    check("yakınlaştırmada çubuk aynı boyda kalıyor", z == ["1.25", "38px"], str(z))
    page.screenshot(path=str(SHOTS / "12-baslik.png"), clip={"x": 0, "y": 0, "width": 1100, "height": 120})
    page.evaluate("""() => { const s = JSON.parse(JSON.stringify(window.__WAP_BOOT__.settings)); s.mode = 'phone'; s.phoneOnTop = false; window.__wap.apply(s); }""")
    page.wait_for_timeout(100)
    pin = page.evaluate("(() => { const p = document.querySelector('.wap-bar-pin'); return [p.classList.contains('on'), getComputedStyle(p).color, getComputedStyle(document.querySelector('.wap-cap')).color]; })()")
    check("iğne bırakılınca vurgu rengi gitti", not pin[0] and pin[1] == pin[2], str(pin))

    # --- Lacivert teması (ayarlardaki hazır temayla aynı değerler)
    page.evaluate("""() => { const s = JSON.parse(JSON.stringify(window.__WAP_BOOT__.settings)); s.mode = 'normal'; s.phoneZoom = 100; s.alwaysOnTop = true;
      s.theme = Object.assign({}, s.theme, { name: 'Lacivert', bg:'#000000', panel:'#080A1A', line:'#1C225A', dim:'#8C93C7', ink:'#FFFFFF',
        accent:'#3D4ACA', accentInk:'#FFFFFF', outBubble:'#2C358D', outInk:'#FFFFFF', inBubble:'#0F122F', inInk:'#FFFFFF',
        chatBg:'#000000', wallpaper:'linear-gradient(135deg, #2C358D 0%, #000000 32%, #000000 68%, #2C358D 100%)', radius:12, hideTails:true });
      window.__wap.apply(s); }""")
    page.wait_for_timeout(400)
    page.screenshot(path=str(SHOTS / "13-discord.png"))

    # --- dış bağlantılar
    page.evaluate("""() => { const m = document.querySelector('#main .msgs') || document.body;
      const a = document.createElement('a'); a.href = 'https://example.com/x?y=1'; a.target = '_blank'; a.id = 'ext'; a.textContent = 'link';
      a.style.cssText = 'position:fixed;left:600px;top:300px;z-index:1;display:block;padding:10px;background:#fff';
      document.body.appendChild(a); }""")
    before = len(page.evaluate("window.__calls"))
    page.click("#ext")
    w = page.evaluate("(() => { const w = window.open('', '_blank'); w.location = 'https://example.org/'; const w2 = window.open('http://example.net/', '_blank', 'noopener'); return [!!w, !!w2]; })()")
    page.wait_for_timeout(200)
    opened = [c[1]["data"] for c in page.evaluate("window.__calls")[before:] if c[0] == "wa_event" and c[1]["kind"] == "open"]
    check("linkler tarayıcıda açılıyor (tık, boş pencere, window.open)", opened == ["https://example.com/x?y=1", "https://example.org/", "http://example.net/"] and w == [True, True], str(opened))
    check("link sayfayı değiştirmedi", page.evaluate("location.protocol") != "https:" or "example" not in page.evaluate("location.href"))

    check("tanılamadan sonra tema yerinde", page.evaluate("document.adoptedStyleSheets.length") >= 4)
    check("sayfa hatası yok", not errors, " | ".join(errors[:5]))
    browser.close()

print()
print("TÜMÜ GEÇTİ" if not failures else f"{len(failures)} HATA")
sys.exit(1 if failures else 0)
