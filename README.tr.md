# Wazzap?

[English](README.md) · **Türkçe**

Windows için hafif bir WhatsApp Web masaüstü istemcisi. Resmi WhatsApp Web'i kendi penceresinde
açar; üstüne tema, telefon boyutu ve mini pencere, zamanlı mesajlar ve medya toplayıcı ekler.
Mesajlaşmaya dokunmaz: oturum, şifreleme ve bağlantı tamamen WhatsApp Web'in kendisidir.
Electron değil, Tauri + sistemdeki WebView2 kullanır; kurulum birkaç MB'tır.

![Wazzap?, Lacivert temasıyla (projenin test sayfasında)](docs/screenshot.png)

> **Not:** Wazzap? bağımsız bir projedir; WhatsApp LLC veya Meta Platforms ile bağlantılı değildir,
> onlar tarafından onaylanmamıştır. "WhatsApp" Meta'nın tescilli markasıdır. Zamanlı mesajlar
> WhatsApp Web arayüzünü senin yerine kullanarak gönderilir; WhatsApp otomatik mesajlaşmayı
> kurallarında kısıtlar. Kişisel, ara sıra kullanım için tasarlandı; toplu mesaj için kullanma.
> Kullanım kendi sorumluluğundadır.

## Kurulum

[Releases](../../releases/latest) sayfasından `Wazzap_*_x64-setup.exe` dosyasını indirip çalıştır.
Açılınca QR kodu telefonundan bir kere okut, oturum kalıcıdır. Uygulama yeni sürümleri kendisi
denetler ve tek tıkla kurar.

Kurulum dosyası imzalı olmadığı için Windows ilk açılışta "Windows bilgisayarınızı korudu"
uyarısı gösterebilir: **Ek bilgi → Yine de çalıştır**.

Arayüz Türkçe ve İngilizce. Windows'un diline göre açılır; Ayarlar → Masaüstü'nden değiştirilebilir.

### Kaynaktan derleme

`derle.bat` dosyasına çift tıkla. Betik ilk seferde eksikse **Rust** ve **Visual Studio C++
derleme araçlarını** winget ile kurar (bir kerelik, birkaç GB, yönetici izni ister), uygulamayı
derler, `%LOCALAPPDATA%\Programs\Wazzap` altına koyar ve kısayol ekler. Bu yolla kurulan kopya
güncellemeleri GitHub'dan değil, proje klasöründen alır (geliştirme için).

## Kısayollar

| Kısayol | İş |
| --- | --- |
| Ctrl + Shift + Boşluk | Pencereyi her yerden göster / gizle |
| Ctrl + 1 | Telefon modu (390 × 844, sağ kenara yapışır) |
| Ctrl + 2 | Normal mod |
| Ctrl + 3 | Kompakt (480 × 800) |
| Ctrl + 4 | Mini pencere (aç / kapat) |
| Ctrl + T | Her zaman üstte aç / kapat |
| Ctrl + , | Ayarlar ve tema editörü |
| Ctrl + + / − / 0 | Yakınlaştırma |
| Esc | Telefon modunda sohbetten listeye dön |
| Ctrl + Shift + Enter | Yazı kutusundaki mesajı zamanla |
| Ctrl + Shift + M | Açık sohbetin medya toplayıcısı |
| Ctrl + Shift + I | Geliştirici araçları |

Pencereyi kapatınca uygulama tepside çalışmaya devam eder; çıkış tepsi menüsünden.

## Tema

Temalar kaydedilebilir ve `.wptema` dosyası olarak dışa / içe aktarılabilir (Ayarlar → Tema).
Ayarlar penceresinde beş hazır tema var: Siyah (varsayılan, ev stili), Chrome, Y2K, Lacivert, Açık.
Her renk tek tek değiştirilebilir; değişiklikler anında WhatsApp'a uygulanır.

Tema, WhatsApp'ın renk değişkenlerini adlarına bakmadan, açıklık sırasına göre yeniden
haritalar. Bu yüzden WhatsApp arayüzünü güncellese bile büyük ölçüde tutar. Bir yer
tutmazsa: Ayarlar → Gelişmiş → **Tanılama dosyası oluştur**. Dosya yalnızca renk
değişkenlerini ve sayfa yapısını içerir; mesaj, kişi adı ya da numara yazılmaz.
Hızlı düzeltmeler için aynı bölümde **Özel CSS** alanı var.

En temiz sonuç için WhatsApp'ın kendi ayarlarından Koyu temayı seç.

## Zamanlı mesajlar

Bir sohbette sol alttaki saat düğmesine ya da Ctrl + Shift + Enter'a bas, metni ve zamanı seç.
Zamanı gelince Wazzap? sohbeti açar, mesajı yazar ve gönderir, sonra baktığın sohbete geri döner.
Zamanlanmış mesajlar sohbetin en altında, saat simgeli soluk bir giden mesaj olarak görünür;
üstüne tıklayınca şimdi gönder / düzenle / iptal menüsü açılır. Sohbet listesinin en üstünde
"Zamanlanmış" bölümü vardır (WhatsApp'ın kendi sıralaması değişmez), listede de zamanlanmış
mesajı olan sohbetin adının yanında saat simgesi görünür. Hepsi ayrıca Ayarlar → Zamanlı
mesajlar'da listelenir.

WhatsApp'ın içine eklenen her şey (saat düğmesi, zamanlama penceresi, menü, önizleme baloncukları)
WhatsApp'ın kendi renk değişkenleriyle çizilir: tema neyse onlar da ona uyar. Wazzap?'ın kendi
görünümü yalnızca ayarlar penceresindedir.

- Mesajın gitmesi için Wazzap? açık (tepside de olur) ve bilgisayar uyanık olmalı.
- 10 dakikadan fazla geciken mesaj gönderilmez, "kaçırıldı" olarak bekler; istersen elle gönderirsin.
- Aynı anda tek mesaj gider, iki gönderim arasında en az 20 saniye olur.
- Hedef sohbette yarım kalmış bir taslak varsa mesaj gönderilmez, haber verilir.
- Sohbet adla bulunur: aynı adlı iki sohbet varsa listede üstte olan seçilir.

## Başlık çubuğu

Pencerenin Windows çerçevesi yok; yerine WhatsApp renklerinde ince bir çubuk var (her modda).
Sağında: mini pencere, iğne (her zaman üstte, açıkken renkli), alta al, tam ekran, kapat.
Çubuktan sürüklenir, çift tıklayınca tam ekran olur; ekran kenarına sürükleyip yapıştırma
(Windows Snap) ve kenarlardan boyutlandırma çalışır. Kapat, ayarlara göre tepsiye gizler ya da çıkar.
İğne her mod için ayrı hatırlanır (normal, telefon / kompakt, mini).

## Mini pencere

Ctrl + 4, çubuktaki düğme ya da tepsi → Mini pencere: pencere 360 × 560'a küçülür, sağ alt köşeye
oturur ve varsayılan olarak üstte kalır. Çubuk sohbetin adını gösterir; çift tıklamak ya da aynı
düğme önceki moda döndürür. Ayrı bir pencere değildir: WhatsApp Web aynı anda tek sekmede açık
kalabildiği için ana pencere küçülür.

## Medya toplayıcı

Bir sohbetteyken sol alttaki görsel düğmesine ya da Ctrl + Shift + M'ye bas. Sohbette yüklü
görseller, videolar ve belgeler sekmelere ayrılır; tek tek seçip ya da "Tümünü kaydet" ile
`İndirilenler\Wazzap\<sohbet adı>` klasörüne kaydedersin. Görsel ve videolar görüntüleyiciden
tam çözünürlükte alınır. Yalnızca ekrana yüklenmiş mesajlar görünür; "Daha eskileri yükle"
sohbeti yukarı kaydırıp eski medyayı da getirir.

## Bildirimler

Bildirime tıklayınca Wazzap? öne gelir ve o sohbet açılır.

## Güncelleme

Kurulum dosyasıyla kurulan uygulama GitHub'daki son sürüme birkaç saatte bir bakar; yeni sürüm
varsa bildirim gelir, tepside "Güncellemeyi kur" çıkar. Güncelleme indirilir, imzası doğrulanır,
kurulur ve uygulama yeniden açılır.

`derle.bat` ile kurulan kopyada ise uygulamanın yanında proje klasörünün yolu durur. Uygulama
10 dakikada bir bu klasördeki sürüme bakar; kurulum arka planda derler, sonra kapanıp yeni sürümle
açılır. Derleme hatası olursa `tanilama/guncelleme.log` dosyasına yazılır.

### Sürüm yayınlama

`Cargo.toml` ve `tauri.conf.json` içindeki sürümü yükselt, sonra `release` dalına gönder
(`git push origin main:release`); `v` etiketi otomatik oluşur. GitHub Actions kurulumu derleyip Releases'a yükler.
Bunun için depoda `TAURI_SIGNING_PRIVATE_KEY` adlı bir Actions sırrı olmalı (güncelleme imza
anahtarı; açık anahtarı `tauri.conf.json` içinde).

## Dosyalar

| Yol | Ne |
| --- | --- |
| `src/main.rs` | Pencere, modlar, tepsi, kısayollar, rozet, bildirimler |
| `src/settings.rs` | Ayarlar ve varsayılan tema |
| `src/badge.rs` | Görev çubuğu rozeti ve tepsi noktası |
| `src/schedule.rs` | Zamanlı mesaj kaydı ve zamanlayıcı kararı |
| `src/update.rs` | Proje klasöründen güncelleme denetimi (geliştirme kurulumu) |
| `inject/bridge.js` | WhatsApp sayfasına eklenen katman: tema motoru, telefon modu, köprü |
| `inject/phone.css` | Tek panel düzeni |
| `ui/index.html` | Ayarlar penceresi |
| `capabilities/` | İzinler: WhatsApp sayfası yalnızca dört köprü komutuna erişebilir (olaylar, ayarlar, zamanlama, medya kaydı) |
| `tests/` | Sahte WhatsApp sayfası üzerinde köprü testi (Playwright): `python3 tests/bridge_test.py . /tmp/shots`; Chromium yolu `CHROMIUM` ortam değişkeniyle verilebilir. Önce `WAP_DUMP=tests/.init.js cargo test dump` |
| `.github/workflows/` | CI (cargo test) ve sürüm yayınlama |

Ayarlar `%APPDATA%\com.kvbilai.wazzap\ayarlar.json`, zamanlı mesajlar aynı klasörde
`zamanli.json` dosyasında durur.

## Lisans

[MIT](LICENSE)
