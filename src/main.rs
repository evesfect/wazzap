// Sürüm derlemesinde arkada konsol penceresi açılmasın.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod badge;
mod schedule;
mod settings;
mod update;

use base64::Engine;
use schedule::Status;
use settings::{Bounds, Settings, Theme};
use std::path::PathBuf;
use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::image::Image;
use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent};
use tauri::webview::{NewWindowResponse, PageLoadEvent};
use tauri::{
    AppHandle, Emitter, LogicalSize, Manager, PhysicalPosition, PhysicalSize, RunEvent, Url,
    WebviewUrl, WebviewWindow, WebviewWindowBuilder, WindowEvent, Wry,
};
use tauri_plugin_autostart::ManagerExt as _;
use tauri_plugin_global_shortcut::ShortcutState;
use tauri_plugin_notification::NotificationExt;

const WA_URL: &str = "https://web.whatsapp.com/";
const MAIN: &str = "main";
const SETTINGS_WIN: &str = "settings";
const TRAY: &str = "tray";
const TOGGLE_SHORTCUT: &str = "ctrl+shift+space";

const TRAY_PNG: &[u8] = include_bytes!("../icons/32x32.png");

struct AppState {
    settings: Mutex<Settings>,
    path: PathBuf,
    data_dir: PathBuf,
    unread: Mutex<u32>,
    ontop_item: Mutex<Option<CheckMenuItem<Wry>>>,
    /// Köprü bu sayfa yüklemesinde bağlandı mı (zamanlı mesaj ancak o zaman gönderilir).
    page_ready: AtomicBool,
    schedules: Mutex<schedule::Store>,
    last_send: Mutex<i64>,
    update_version: Mutex<Option<String>>,
    update_notified: Mutex<Option<String>>,
    update_item: Mutex<Option<MenuItem<Wry>>>,
    updating: AtomicBool,
    /// Mini pencereden çıkınca dönülecek mod.
    mini_return: Mutex<String>,
    /// GitHub'da bulunan, kurulmayı bekleyen sürüm.
    github_update: Mutex<Option<tauri_plugin_updater::Update>>,
    github_checking: AtomicBool,
    /// Pencere tam ekran mı (başlık çubuğundaki düğme simgesi için).
    maximized: AtomicBool,
    /// Medya toplayıcı belge indirirken indirmelerin gideceği klasör.
    download_target: Mutex<Option<PathBuf>>,
}

impl AppState {
    fn snapshot(&self) -> Settings {
        self.settings.lock().unwrap().clone()
    }
    fn save(&self) {
        let s = self.snapshot();
        s.save(&self.path);
    }
}

fn state(app: &AppHandle) -> tauri::State<'_, AppState> {
    app.state::<AppState>()
}

/// Kısa olay günlüğü: tanilama/olaylar.log. Mesaj içeriği yazılmaz.
fn log(app: &AppHandle, text: &str) {
    use std::io::Write;
    let Some(st) = app.try_state::<AppState>() else { return };
    let dir = st.data_dir.join("tanilama");
    let _ = std::fs::create_dir_all(&dir);
    let path = dir.join("olaylar.log");
    // Dosya büyümesin: 256 KB'ı geçince baştan başla.
    if std::fs::metadata(&path).map(|m| m.len() > 256 * 1024).unwrap_or(false) {
        let _ = std::fs::remove_file(&path);
    }
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(&path) {
        let _ = writeln!(f, "{secs} {text}");
    }
}

fn main_window(app: &AppHandle) -> Option<WebviewWindow> {
    app.get_webview_window(MAIN)
}

// ---------------------------------------------------------------------------
// Bildirimler
// ---------------------------------------------------------------------------

/// Bildirime tıklanınca ne olacağı (tıklama yalnızca Windows bildirimlerinde var).
#[derive(Clone)]
#[cfg_attr(not(windows), allow(dead_code))]
enum Click {
    Show,
    Chat(String),
    Settings,
}

#[cfg_attr(not(windows), allow(dead_code))]
fn handle_click(app: &AppHandle, click: &Click) {
    match click {
        Click::Show => show_main(app),
        Click::Chat(title) => {
            show_main(app);
            open_chat(app, title);
        }
        Click::Settings => open_settings(app),
    }
}

/// WhatsApp sayfasında adı verilen sohbeti açar (listede ya da aramayla bulur).
#[cfg_attr(not(windows), allow(dead_code))]
fn open_chat(app: &AppHandle, title: &str) {
    if let (Some(w), Ok(t)) = (main_window(app), serde_json::to_string(title)) {
        let _ = w.eval(format!("window.__wap && window.__wap.openChat({t}).catch(() => {{}});"));
    }
}

/// Bildirimi ana iş parçacığında gösterir (Windows bildirim API'si orada sorunsuz çalışıyor).
fn notify(app: &AppHandle, title: &str, body: &str, click: Click) {
    let h = app.clone();
    let (t, b) = (title.to_string(), body.to_string());
    let _ = app.run_on_main_thread(move || notify_now(&h, &t, &b, click));
}

/// Windows'ta tıklanabilir bildirim; tıklanınca `click` çalışır.
#[cfg(windows)]
fn notify_now(app: &AppHandle, title: &str, body: &str, click: Click) {
    use tauri_winrt_notification::Toast;
    let id = app.config().identifier.clone();
    let handle = app.clone();
    let toast = Toast::new(&id).title(title).text1(body).on_activated(move |_action| {
        let h = handle.clone();
        let c = click.clone();
        let _ = handle.run_on_main_thread(move || handle_click(&h, &c));
        Ok(())
    });
    if let Err(e) = toast.show() {
        log(app, &format!("bildirim gösterilemedi: {e}"));
        let _ = app.notification().builder().title(title).body(body).show();
    }
}

#[cfg(not(windows))]
fn notify_now(app: &AppHandle, title: &str, body: &str, _click: Click) {
    let _ = app.notification().builder().title(title).body(body).show();
}

// ---------------------------------------------------------------------------
// Enjekte katman
// ---------------------------------------------------------------------------

fn init_script(s: &Settings) -> String {
    let b64 = base64::engine::general_purpose::STANDARD;
    let boot = serde_json::json!({
        "settings": s,
        "css": {
            "base": include_str!("../inject/base.css"),
            "phone": include_str!("../inject/phone.css"),
        },
        "fonts": {
            "latin": b64.encode(include_bytes!("../ui/fonts/inter-latin-wght-normal.woff2")),
            "ext": b64.encode(include_bytes!("../ui/fonts/inter-latin-ext-wght-normal.woff2")),
        },
        "version": env!("CARGO_PKG_VERSION"),
    });
    format!(
        "window.__WAP_BOOT__ = {};\n{}",
        boot,
        include_str!("../inject/bridge.js")
    )
}

/// Güncel ayarları açık WhatsApp sayfasına uygular (tema, düzen, yakınlaştırma).
/// Sayfadaki başlık çubuğuna pencerenin tam ekran olup olmadığını bildirir (yalnızca değişince).
fn push_window_state(app: &AppHandle) {
    let Some(w) = main_window(app) else { return };
    let max = w.is_maximized().unwrap_or(false);
    if state(app).maximized.swap(max, Ordering::SeqCst) != max {
        let _ = w.eval(format!("window.__wap && window.__wap.win({{max:{max}}});"));
    }
}

fn push_to_page(app: &AppHandle) {
    let s = state(app).snapshot();
    if let Some(w) = main_window(app) {
        if let Ok(json) = serde_json::to_string(&s) {
            let _ = w.eval(format!("window.__wap && window.__wap.apply({json});"));
        }
        let _ = w.set_zoom(s.zoom_for_mode() as f64 / 100.0);
    }
}

// ---------------------------------------------------------------------------
// Pencere ve modlar
// ---------------------------------------------------------------------------

fn show_main(app: &AppHandle) {
    if let Some(w) = main_window(app) {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
}

fn toggle_main(app: &AppHandle) {
    if let Some(w) = main_window(app) {
        let visible = w.is_visible().unwrap_or(false);
        let minimized = w.is_minimized().unwrap_or(false);
        let focused = w.is_focused().unwrap_or(false);
        if visible && !minimized && focused {
            let _ = w.hide();
        } else {
            show_main(app);
        }
    }
}

fn remember_normal_bounds(app: &AppHandle) {
    let Some(w) = main_window(app) else { return };
    if w.is_minimized().unwrap_or(false) || w.is_maximized().unwrap_or(false) {
        return;
    }
    if !w.is_visible().unwrap_or(false) {
        return;
    }
    let st = state(app);
    let mut s = st.settings.lock().unwrap();
    if s.mode != "normal" {
        return;
    }
    if let (Ok(pos), Ok(size)) = (w.outer_position(), w.inner_size()) {
        if size.width > 200 && size.height > 200 {
            s.normal_bounds = Some(Bounds { x: pos.x, y: pos.y, w: size.width, h: size.height });
        }
    }
}

fn apply_on_top(app: &AppHandle) {
    let s = state(app).snapshot();
    let on = s.on_top();
    if let Some(w) = main_window(app) {
        let _ = w.set_always_on_top(on);
    }
    if let Some(item) = state(app).ontop_item.lock().unwrap().as_ref() {
        let _ = item.set_checked(on);
    }
}

/// Pencereyi moda göre boyutlandırır: normal / telefon (390×844) / kompakt (480×800).
fn set_mode(app: &AppHandle, mode: &str) {
    let Some(w) = main_window(app) else { return };
    {
        let current = state(app).snapshot().mode;
        if current == "normal" && mode != "normal" {
            remember_normal_bounds(app);
        }
    }
    {
        let st = state(app);
        let mut s = st.settings.lock().unwrap();
        if mode == "mini" && s.mode != "mini" {
            *st.mini_return.lock().unwrap() = s.mode.clone();
        }
        s.mode = mode.to_string();
    }
    let s = state(app).snapshot();
    let _ = w.unminimize();
    if w.is_maximized().unwrap_or(false) {
        let _ = w.unmaximize();
    }
    // Pencere her modda çerçevesiz; başlık çubuğunu sayfa çiziyor.
    let _ = w.set_decorations(false);

    match mode {
        "mini" => {
            let (lw, lh) = (360.0, 560.0);
            let _ = w.set_size(LogicalSize::new(lw, lh));
            if let Ok(Some(mon)) = w.current_monitor() {
                let wa = mon.work_area();
                let scale = mon.scale_factor();
                let margin = (16.0 * scale) as i32;
                if let Ok(outer) = w.outer_size() {
                    let x = wa.position.x + wa.size.width as i32 - outer.width as i32 - margin;
                    let y = wa.position.y + wa.size.height as i32 - outer.height as i32 - margin;
                    let _ = w.set_position(PhysicalPosition::new(x, y));
                }
            }
        }
        "normal" => {
            if let Some(b) = s.normal_bounds {
                let _ = w.set_size(PhysicalSize::new(b.w, b.h));
                let _ = w.set_position(PhysicalPosition::new(b.x, b.y));
                ensure_on_screen(&w);
            } else {
                let _ = w.set_size(LogicalSize::new(1100.0, 760.0));
                let _ = w.center();
            }
        }
        _ => {
            let (lw, lh) = if mode == "phone" { (390.0, 844.0) } else { (480.0, 800.0) };
            if let Ok(Some(mon)) = w.current_monitor() {
                let scale = mon.scale_factor();
                let wa = mon.work_area();
                // Başlık çubuğu payı bırakıp ekrana sığdır.
                let max_h = (wa.size.height as f64 / scale) - 48.0;
                let lh = if lh > max_h { max_h.max(480.0) } else { lh };
                let _ = w.set_size(LogicalSize::new(lw, lh));
                if s.phone_snap_right {
                    if let (Ok(outer), Ok(inner)) = (w.outer_size(), w.inner_size()) {
                        // Windows 10/11 pencerelerin kenarında görünmez bir yeniden boyutlama
                        // çerçevesi var; onu hesaba katınca pencere ekran kenarına tam oturur.
                        let border = (outer.width.saturating_sub(inner.width) / 2) as i32;
                        let right = wa.position.x + wa.size.width as i32;
                        let x = right - outer.width as i32 + border;
                        let y = wa.position.y
                            + ((wa.size.height as i32 - outer.height as i32) / 2).max(0);
                        let _ = w.set_position(PhysicalPosition::new(x, y));
                    }
                } else {
                    ensure_on_screen(&w);
                }
            } else {
                let _ = w.set_size(LogicalSize::new(lw, lh));
            }
        }
    }
    apply_on_top(app);
    push_to_page(app);
    state(app).save();
    let _ = app.emit_to(SETTINGS_WIN, "settings-changed", state(app).snapshot());
    let size = w.inner_size().map(|s| format!("{}x{}", s.width, s.height)).unwrap_or_default();
    let scale = w.scale_factor().unwrap_or(1.0);
    log(app, &format!("mod: {mode} -> pencere {size} (ölçek {scale})"));
}

/// Kayıtlı konum artık bağlı olmayan bir ekrandaysa pencereyi ortala.
fn ensure_on_screen(w: &WebviewWindow) {
    let Ok(pos) = w.outer_position() else { return };
    let Ok(monitors) = w.available_monitors() else { return };
    let visible = monitors.iter().any(|m| {
        let a = m.work_area();
        pos.x + 80 >= a.position.x
            && pos.x + 80 < a.position.x + a.size.width as i32
            && pos.y + 20 >= a.position.y
            && pos.y + 20 < a.position.y + a.size.height as i32
    });
    if !visible {
        let _ = w.center();
    }
}

fn change_zoom(app: &AppHandle, delta: i32) {
    {
        let st = state(app);
        let mut s = st.settings.lock().unwrap();
        let normal = s.mode == "normal";
        let z = if normal { &mut s.zoom } else { &mut s.phone_zoom };
        *z = if delta == 0 { 100 } else { (*z as i32 + delta).clamp(50, 200) as u32 };
    }
    push_to_page(app);
    state(app).save();
    let _ = app.emit_to(SETTINGS_WIN, "settings-changed", state(app).snapshot());
}

fn open_settings(app: &AppHandle) {
    if let Some(w) = app.get_webview_window(SETTINGS_WIN) {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
        return;
    }
    let _ = WebviewWindowBuilder::new(app, SETTINGS_WIN, WebviewUrl::App("index.html".into()))
        .title("Tellal · Ayarlar")
        .inner_size(1120.0, 760.0)
        .min_inner_size(720.0, 520.0)
        .background_color(tauri::window::Color(0, 0, 0, 255))
        .build();
}

fn run_action(app: &AppHandle, action: &str) {
    match action {
        "phone" | "normal" | "compact" => set_mode(app, action),
        "mini" => {
            let current = state(app).snapshot().mode;
            if current == "mini" {
                let back = state(app).mini_return.lock().unwrap().clone();
                set_mode(app, if back == "mini" { "normal" } else { &back });
            } else {
                show_main(app);
                set_mode(app, "mini");
            }
        }
        "drag" => {
            if let Some(w) = main_window(app) {
                let _ = w.start_dragging();
            }
        }
        "hide" => {
            if let Some(w) = main_window(app) {
                remember_normal_bounds(app);
                state(app).save();
                if state(app).snapshot().close_to_tray {
                    let _ = w.hide();
                } else {
                    app.exit(0);
                }
            }
        }
        "minimize" => {
            if let Some(w) = main_window(app) {
                let _ = w.minimize();
            }
        }
        "maximize" => {
            if let Some(w) = main_window(app) {
                if w.is_maximized().unwrap_or(false) {
                    let _ = w.unmaximize();
                } else {
                    remember_normal_bounds(app);
                    let _ = w.maximize();
                }
                push_window_state(app);
            }
        }
        "ontop" => {
            {
                let st = state(app);
                let mut s = st.settings.lock().unwrap();
                if s.mode == "normal" {
                    s.always_on_top = !s.always_on_top;
                } else if s.mode == "mini" {
                    s.mini_on_top = !s.mini_on_top;
                } else {
                    s.phone_on_top = !s.phone_on_top;
                }
            }
            apply_on_top(app);
            // Sayfadaki iğne simgesi yeni durumu görsün.
            push_to_page(app);
            state(app).save();
            let _ = app.emit_to(SETTINGS_WIN, "settings-changed", state(app).snapshot());
        }
        "settings" => open_settings(app),
        "devtools" => {
            if let Some(w) = main_window(app) {
                w.open_devtools();
            }
        }
        "reload" => {
            if let Some(w) = main_window(app) {
                let _ = w.reload();
            }
        }
        "zoom-in" => change_zoom(app, 10),
        "zoom-out" => change_zoom(app, -10),
        "zoom-reset" => change_zoom(app, 0),
        "toggle" => toggle_main(app),
        "update" => {
            if state(app).update_version.lock().unwrap().is_some() {
                if let Err(e) = start_update(app) {
                    notify(app, "Güncelleme başlatılamadı", &e, Click::Settings);
                }
            } else if update::project_dir().is_none() {
                github_check(app, true, true);
            } else if check_update(app, false).is_none() {
                notify(app, "Tellal güncel", &format!("Sürüm {}", env!("CARGO_PKG_VERSION")), Click::Show);
            }
        }
        "quit" => {
            remember_normal_bounds(app);
            state(app).save();
            app.exit(0);
        }
        _ => {}
    }
}

// ---------------------------------------------------------------------------
// Okunmamış rozeti
// ---------------------------------------------------------------------------

fn parse_unread(title: &str) -> u32 {
    // WhatsApp Web okunmamış sayısını başlığa "(3) WhatsApp" diye yazar.
    let t = title.trim_start();
    if let Some(rest) = t.strip_prefix('(') {
        if let Some(end) = rest.find(')') {
            return rest[..end].trim().parse().unwrap_or(0);
        }
    }
    0
}

fn set_unread(app: &AppHandle, count: u32) {
    {
        let st = state(app);
        let mut u = st.unread.lock().unwrap();
        if *u == count {
            return;
        }
        *u = count;
    }

    set_overlay(app, count);

    if let Some(tray) = app.tray_by_id(TRAY) {
        let _ = tray.set_icon(Some(tray_image(count > 0)));
        let tip = if count > 0 {
            format!("Tellal · {count} okunmamış")
        } else {
            "Tellal".to_string()
        };
        let _ = tray.set_tooltip(Some(tip));
    }
    if let Some(w) = main_window(app) {
        let title = if count > 0 { format!("({count}) Tellal") } else { "Tellal".into() };
        let _ = w.set_title(&title);
    }
}

/// Görev çubuğundaki ikonun köşesine okunmamış sayısını koyar (yalnızca Windows).
#[cfg(windows)]
fn set_overlay(app: &AppHandle, count: u32) {
    if let Some(w) = main_window(app) {
        if count > 0 {
            let (rgba, wd, ht) = badge::overlay(count);
            let _ = w.set_overlay_icon(Some(Image::new_owned(rgba, wd, ht)));
        } else {
            let _ = w.set_overlay_icon(None);
        }
    }
}

#[cfg(not(windows))]
fn set_overlay(_app: &AppHandle, _count: u32) {}

fn tray_image(dot: bool) -> Image<'static> {
    let base = Image::from_bytes(TRAY_PNG).expect("tepsi ikonu okunamadı");
    if !dot {
        return base;
    }
    let (w, h) = (base.width(), base.height());
    Image::new_owned(badge::with_dot(base.rgba(), w, h), w, h)
}

// ---------------------------------------------------------------------------
// Sayfadan gelen olaylar (WhatsApp Web içindeki köprü)
// ---------------------------------------------------------------------------

#[tauri::command]
fn wa_event(app: AppHandle, kind: String, data: serde_json::Value) -> Result<(), String> {
    match kind.as_str() {
        "action" => {
            if let Some(a) = data.as_str() {
                log(&app, &format!("kısayol: {a}"));
                run_action(&app, a);
            }
        }
        "notify" => {
            let s = state(&app).snapshot();
            if !s.notifications {
                return Ok(());
            }
            let title = data.get("title").and_then(|v| v.as_str()).unwrap_or("WhatsApp");
            let body = if s.notify_preview {
                data.get("body").and_then(|v| v.as_str()).unwrap_or("").to_string()
            } else {
                "Yeni mesaj".to_string()
            };
            notify(&app, title, &body, Click::Chat(title.to_string()));
        }
        "scheduled-result" => schedule_result(&app, &data),
        "diag" => {
            let name: String = data
                .get("name")
                .and_then(|v| v.as_str())
                .unwrap_or("elle")
                .chars()
                .filter(|c| c.is_ascii_alphanumeric() || *c == '-')
                .take(32)
                .collect();
            let dir = state(&app).data_dir.join("tanilama");
            let _ = std::fs::create_dir_all(&dir);
            let file = dir.join(format!("{}.json", if name.is_empty() { "elle" } else { &name }));
            let text = serde_json::to_string_pretty(&data).map_err(|e| e.to_string())?;
            std::fs::write(&file, text).map_err(|e| e.to_string())?;
            log(&app, &format!("tanılama kaydedildi: {name}"));
            if name == "elle" {
                let _ = app.emit_to(SETTINGS_WIN, "diag-saved", file.display().to_string());
            }
        }
        _ => {}
    }
    Ok(())
}

/// Sayfa yeniden yüklendiğinde güncel ayarları çeker.
#[tauri::command]
fn wa_settings(app: AppHandle) -> Settings {
    log(&app, "köprü bağlandı (sayfa ayarları istedi)");
    state(&app).page_ready.store(true, Ordering::SeqCst);
    // Sayfa yeniden yüklendiyse başlık çubuğu tam ekran durumunu bilmez: yeniden bildir.
    state(&app).maximized.store(false, Ordering::SeqCst);
    push_window_state(&app);
    state(&app).snapshot()
}

// ---------------------------------------------------------------------------
// Zamanlı mesajlar
// ---------------------------------------------------------------------------

fn schedules_changed(app: &AppHandle) {
    let items = state(app).schedules.lock().unwrap().items.clone();
    let _ = app.emit_to(SETTINGS_WIN, "schedules-changed", items);
    // Sohbetteki önizleme baloncukları da yenilensin.
    if let Some(w) = main_window(app) {
        let _ = w.eval("window.__wap && window.__wap.schedulesChanged();");
    }
}

/// Zamanlayıcının bir turu: kaçırılanları işaretler, sırası gelen mesajı sayfaya yollar.
fn scheduler_tick(app: &AppHandle) {
    let st = state(app);
    let now = schedule::now_ms();
    let last = *st.last_send.lock().unwrap();
    let ready = st.page_ready.load(Ordering::SeqCst) && main_window(app).is_some();
    let (tick, items) = {
        let mut store = st.schedules.lock().unwrap();
        // Sayfa hazır değilken gönderim başlatma; yalnızca kaçırılanları ve takılanları işle.
        let gap = if ready { last } else { now };
        let t = schedule::tick(&mut store.items, now, gap);
        if t.changed() {
            store.save();
        }
        (t, store.items.clone())
    };
    let find = |id: &str| items.iter().find(|i| i.id == id);
    for id in &tick.missed {
        if let Some(it) = find(id) {
            log(app, &format!("zamanlı mesaj kaçırıldı ({id})"));
            notify(app, "Zamanlı mesaj kaçırıldı", &format!("{} · göndermek için ayarlara bak", it.chat), Click::Settings);
        }
    }
    for id in &tick.timed_out {
        if let Some(it) = find(id) {
            log(app, &format!("zamanlı mesaj zaman aşımı ({id})"));
            notify(app, "Zamanlı mesaj gönderilemedi", &format!("{} · WhatsApp yanıt vermedi", it.chat), Click::Chat(it.chat.clone()));
        }
    }
    if let Some(id) = &tick.send {
        if let Some(it) = find(id) {
            *st.last_send.lock().unwrap() = now;
            let payload = serde_json::json!({ "id": it.id, "chat": it.chat, "text": it.text });
            log(app, &format!("zamanlı mesaj gönderiliyor ({id})"));
            let sent = main_window(app)
                .map(|w| w.eval(format!("window.__wap && window.__wap.sendScheduled({payload});")).is_ok())
                .unwrap_or(false);
            if !sent {
                let mut store = st.schedules.lock().unwrap();
                if let Some(x) = store.get_mut(id) {
                    x.status = Status::Bekliyor;
                    x.started_at = None;
                }
                store.save();
            }
        }
    }
    if tick.changed() {
        schedules_changed(app);
    }
}

/// Sayfa gönderimin sonucunu bildirdi.
fn schedule_result(app: &AppHandle, data: &serde_json::Value) {
    let id = data.get("id").and_then(|v| v.as_str()).unwrap_or_default().to_string();
    let ok = data.get("ok").and_then(|v| v.as_bool()).unwrap_or(false);
    let code = data.get("code").and_then(|v| v.as_str()).unwrap_or_default();
    let error = data.get("error").and_then(|v| v.as_str()).unwrap_or("bilinmeyen hata").to_string();
    let st = state(app);
    let mut outcome: Option<(bool, String)> = None;
    {
        let mut store = st.schedules.lock().unwrap();
        if let Some(it) = store.get_mut(&id) {
            if it.status == Status::Gonderiliyor {
                it.started_at = None;
                if ok {
                    it.status = Status::Gonderildi;
                    it.sent_at = Some(schedule::now_ms());
                    it.error = None;
                    outcome = Some((true, it.chat.clone()));
                } else if code == "hazir-degil" {
                    // WhatsApp henüz yüklenmemişti: süre dolmadıysa bir sonraki turda yeniden dene.
                    it.status = Status::Bekliyor;
                } else {
                    it.status = Status::Hata;
                    it.error = Some(error.clone());
                    outcome = Some((false, it.chat.clone()));
                }
            }
        }
        store.save();
    }
    match outcome {
        Some((true, chat)) => {
            log(app, &format!("zamanlı mesaj gönderildi ({id})"));
            notify(app, "Zamanlı mesaj gönderildi", &chat, Click::Chat(chat.clone()));
        }
        Some((false, chat)) => {
            log(app, &format!("zamanlı mesaj hata ({id}): {error}"));
            notify(app, "Zamanlı mesaj gönderilemedi", &format!("{chat} · {error}"), Click::Settings);
        }
        None => {}
    }
    schedules_changed(app);
}

/// WhatsApp sayfasından: sohbetteki zamanlama paneli.
#[tauri::command]
fn wa_schedule(app: AppHandle, action: String, data: serde_json::Value) -> Result<serde_json::Value, String> {
    let st = state(&app);
    let s = |k: &str| data.get(k).and_then(|v| v.as_str()).unwrap_or_default().to_string();
    let result = {
        let mut store = st.schedules.lock().unwrap();
        match action.as_str() {
            "add" => {
                let due = data.get("due").and_then(|v| v.as_i64()).ok_or("Zaman okunamadı")?;
                let item = store.add(&s("chat"), &s("text"), due)?;
                store.save();
                let mins = (item.due - schedule::now_ms()) / 60_000;
                log(&app, &format!("zamanlı mesaj eklendi ({}), {mins} dk sonra", item.id));
                serde_json::to_value(item).map_err(|e| e.to_string())?
            }
            "list" => {
                // Sohbet adı boşsa bütün açık kayıtlar (sohbet listesindeki "Zamanlanmış" bölümü için).
                let chat = s("chat");
                let items: Vec<_> = store
                    .items
                    .iter()
                    .filter(|it| chat.is_empty() || it.chat == chat)
                    .filter(|it| matches!(it.status, Status::Bekliyor | Status::Gonderiliyor | Status::Kacirildi | Status::Hata))
                    .cloned()
                    .collect();
                return serde_json::to_value(items).map_err(|e| e.to_string());
            }
            "cancel" | "send-now" => {
                let id = s("id");
                let it = store.get_mut(&id).ok_or("Kayıt bulunamadı")?;
                if it.status == Status::Gonderiliyor {
                    return Err("Şu an gönderiliyor".into());
                }
                if action == "cancel" {
                    it.status = Status::Iptal;
                } else {
                    it.status = Status::Bekliyor;
                    it.due = schedule::now_ms();
                    it.error = None;
                }
                store.save();
                log(&app, &format!("zamanlı mesaj: {action} ({id})"));
                serde_json::Value::Null
            }
            "update" => {
                let id = s("id");
                let due = data.get("due").and_then(|v| v.as_i64()).ok_or("Zaman okunamadı")?;
                let text = s("text");
                let pending = store.pending();
                let it = store.get_mut(&id).ok_or("Kayıt bulunamadı")?;
                if !matches!(it.status, Status::Bekliyor | Status::Kacirildi | Status::Hata) {
                    return Err("Bu mesaj artık düzenlenemez".into());
                }
                // Düzenlenen kayıt zaten bekleyenlerden biri olabilir: sınırı ona göre say.
                let others = if it.status == Status::Bekliyor { pending.saturating_sub(1) } else { pending };
                schedule::validate(&it.chat, &text, due, schedule::now_ms(), others)?;
                it.text = text.trim_end().to_string();
                it.due = due;
                it.status = Status::Bekliyor;
                it.error = None;
                let out = serde_json::to_value(it.clone()).map_err(|e| e.to_string())?;
                store.items.sort_by_key(|i| i.due);
                store.save();
                log(&app, &format!("zamanlı mesaj düzenlendi ({id})"));
                out
            }
            _ => return Err("bilinmeyen işlem".into()),
        }
    };
    schedules_changed(&app);
    Ok(result)
}

/// Ayarlar penceresi: bütün zamanlı mesajlar.
#[tauri::command]
fn schedules(app: AppHandle) -> Vec<schedule::Item> {
    state(&app).schedules.lock().unwrap().items.clone()
}

#[tauri::command]
fn schedule_action(app: AppHandle, id: String, action: String) -> Result<(), String> {
    {
        let st = state(&app);
        let mut store = st.schedules.lock().unwrap();
        match action.as_str() {
            "delete" => store.items.retain(|it| it.id != id || it.status == Status::Gonderiliyor),
            "cancel" | "send-now" => {
                let it = store.get_mut(&id).ok_or("Kayıt bulunamadı")?;
                if it.status == Status::Gonderiliyor {
                    return Err("Şu an gönderiliyor".into());
                }
                if action == "cancel" {
                    it.status = Status::Iptal;
                } else {
                    it.status = Status::Bekliyor;
                    it.due = schedule::now_ms();
                    it.error = None;
                }
            }
            _ => return Err("bilinmeyen işlem".into()),
        }
        store.save();
    }
    schedules_changed(&app);
    Ok(())
}

// ---------------------------------------------------------------------------
// Medya toplayıcı
// ---------------------------------------------------------------------------

/// Dosya / klasör adı olarak güvenli metin.
fn safe_name(raw: &str, fallback: &str) -> String {
    let cleaned: String = raw
        .chars()
        .map(|c| if c.is_control() || "<>:\"/\\|?*".contains(c) { '_' } else { c })
        .collect();
    let cleaned = cleaned.trim().trim_matches('.').trim();
    let mut out: String = cleaned.chars().take(100).collect();
    if out.is_empty() {
        out = fallback.to_string();
    }
    out
}

fn media_dir(app: &AppHandle, chat: &str) -> Result<PathBuf, String> {
    let base = app.path().download_dir().map_err(|e| e.to_string())?;
    let dir = base.join("Tellal").join(safe_name(chat, "Sohbet"));
    std::fs::create_dir_all(&dir).map_err(|e| format!("Klasör açılamadı: {e}"))?;
    Ok(dir)
}

/// Aynı adlı dosya varsa "ad (2).uzantı" gibi boş bir ad bulur.
fn unique_path(dir: &std::path::Path, name: &str) -> PathBuf {
    let first = dir.join(name);
    if !first.exists() {
        return first;
    }
    let (stem, ext) = match name.rfind('.') {
        Some(i) if i > 0 => (&name[..i], &name[i..]),
        _ => (name, ""),
    };
    for n in 2..10_000 {
        let p = dir.join(format!("{stem} ({n}){ext}"));
        if !p.exists() {
            return p;
        }
    }
    first
}

/// WhatsApp sayfasından: medya kaydetme, belge indirme hedefi, klasörü açma.
#[tauri::command]
fn wa_media(app: AppHandle, action: String, data: serde_json::Value) -> Result<serde_json::Value, String> {
    let s = |k: &str| data.get(k).and_then(|v| v.as_str()).unwrap_or_default().to_string();
    match action.as_str() {
        "save" => {
            let dir = media_dir(&app, &s("chat"))?;
            let b64 = s("data");
            if b64.len() > 300 * 1024 * 1024 {
                return Err("Dosya çok büyük".into());
            }
            let bytes = base64::engine::general_purpose::STANDARD
                .decode(b64.as_bytes())
                .map_err(|_| "Dosya okunamadı".to_string())?;
            let path = unique_path(&dir, &safe_name(&s("name"), "medya"));
            std::fs::write(&path, bytes).map_err(|e| format!("Kaydedilemedi: {e}"))?;
            Ok(serde_json::json!(path.display().to_string()))
        }
        "target" => {
            let chat = s("chat");
            let target = if chat.is_empty() { None } else { Some(media_dir(&app, &chat)?) };
            *state(&app).download_target.lock().unwrap() = target;
            Ok(serde_json::Value::Null)
        }
        "open" => {
            let dir = media_dir(&app, &s("chat"))?;
            tauri_plugin_opener::open_path(dir.display().to_string(), None::<&str>).map_err(|e| e.to_string())?;
            Ok(serde_json::Value::Null)
        }
        _ => Err("bilinmeyen işlem".into()),
    }
}

// ---------------------------------------------------------------------------
// Tema dosyaları
// ---------------------------------------------------------------------------

#[tauri::command]
async fn theme_export(app: AppHandle, theme: Theme) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let theme = theme.sanitized();
    let file_name: String = theme
        .name
        .chars()
        .map(|c| if c.is_alphanumeric() || c == ' ' || c == '-' { c } else { '-' })
        .collect();
    let picked = app
        .dialog()
        .file()
        .set_title("Temayı dışa aktar")
        .add_filter("Tellal teması", &["wptema"])
        .set_file_name(format!("{}.wptema", file_name.trim()))
        .blocking_save_file();
    let Some(fp) = picked else { return Ok(None) };
    let path = fp.into_path().map_err(|e| e.to_string())?;
    let doc = serde_json::json!({ "format": "tellal-tema", "version": 1, "theme": theme });
    let text = serde_json::to_string_pretty(&doc).map_err(|e| e.to_string())?;
    std::fs::write(&path, text).map_err(|e| format!("Yazılamadı: {e}"))?;
    Ok(Some(path.display().to_string()))
}

#[tauri::command]
async fn theme_import(app: AppHandle) -> Result<Option<Theme>, String> {
    use tauri_plugin_dialog::DialogExt;
    let picked = app
        .dialog()
        .file()
        .set_title("Tema dosyası seç")
        .add_filter("Tellal teması", &["wptema", "json"])
        .blocking_pick_file();
    let Some(fp) = picked else { return Ok(None) };
    let path = fp.into_path().map_err(|e| e.to_string())?;
    let text = std::fs::read_to_string(&path).map_err(|e| format!("Okunamadı: {e}"))?;
    parse_theme_file(&text).map(Some)
}

fn parse_theme_file(text: &str) -> Result<Theme, String> {
    let v: serde_json::Value = serde_json::from_str(text.trim_start_matches('\u{feff}'))
        .map_err(|_| "Bu bir Tellal tema dosyası değil".to_string())?;
    let inner = v.get("theme").cloned().unwrap_or(v);
    if !inner.is_object() || inner.get("bg").is_none() {
        return Err("Bu bir Tellal tema dosyası değil".into());
    }
    let theme: Theme = serde_json::from_value(inner).map_err(|_| "Tema dosyası bozuk".to_string())?;
    Ok(theme.sanitized())
}

// ---------------------------------------------------------------------------
// Güncelleme: proje klasöründen (derle.bat ile kurulduysa) ya da GitHub sürümlerinden
// ---------------------------------------------------------------------------

fn update_status_value(app: &AppHandle) -> serde_json::Value {
    let st = state(app);
    serde_json::json!({
        "current": env!("CARGO_PKG_VERSION"),
        "available": *st.update_version.lock().unwrap(),
        "updating": st.updating.load(Ordering::SeqCst),
        "project": update::project_dir().map(|p| p.display().to_string()),
        "source": if update::project_dir().is_some() { "proje" } else { "github" },
    })
}

fn refresh_update_ui(app: &AppHandle) {
    let st = state(app);
    let available = st.update_version.lock().unwrap().clone();
    let updating = st.updating.load(Ordering::SeqCst);
    if let Some(item) = st.update_item.lock().unwrap().as_ref() {
        let text = if updating {
            "Güncelleniyor…".to_string()
        } else if let Some(v) = &available {
            format!("Güncellemeyi kur · v{v}")
        } else {
            "Güncellemeleri denetle".to_string()
        };
        let _ = item.set_text(text);
        let _ = item.set_enabled(!updating);
    }
    let _ = app.emit_to(SETTINGS_WIN, "update-status", update_status_value(app));
}

/// Daha yeni bir sürüm var mı? Varsa sürümü döndürür. GitHub kipinde denetim arka planda
/// yürür; dönen değer son bilinen sonuçtur.
fn check_update(app: &AppHandle, notify_user: bool) -> Option<String> {
    if update::project_dir().is_none() {
        github_check(app, notify_user, false);
        return state(app).update_version.lock().unwrap().clone();
    }
    let found = update::project_dir()
        .and_then(|dir| update::project_version(&dir))
        .filter(|v| update::is_newer(v, env!("CARGO_PKG_VERSION")));
    let st = state(app);
    *st.update_version.lock().unwrap() = found.clone();
    refresh_update_ui(app);
    if let Some(v) = &found {
        let mut notified = st.update_notified.lock().unwrap();
        if notify_user && notified.as_deref() != Some(v.as_str()) {
            *notified = Some(v.clone());
            drop(notified);
            log(app, &format!("güncelleme hazır: {v}"));
            notify(app, &format!("Tellal v{v} hazır"), "Kurmak için tıkla. Birkaç dakika sürer, sonra uygulama yeniden açılır.", Click::Settings);
        }
    }
    found
}

/// GitHub'daki son sürümü (latest.json) denetler. Ağ işi ana iş parçacığını tutmasın diye arka planda.
/// `announce_none`: elle denetimde "güncel" bildirimi de göster.
fn github_check(app: &AppHandle, notify_user: bool, announce_none: bool) {
    let st = state(app);
    if st.github_checking.swap(true, Ordering::SeqCst) {
        return;
    }
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        use tauri_plugin_updater::UpdaterExt;
        let result = match app.updater() {
            Ok(u) => u.check().await.map_err(|e| e.to_string()),
            Err(e) => Err(e.to_string()),
        };
        let st = state(&app);
        st.github_checking.store(false, Ordering::SeqCst);
        match result {
            Ok(Some(update)) => {
                let v = update.version.clone();
                *st.update_version.lock().unwrap() = Some(v.clone());
                *st.github_update.lock().unwrap() = Some(update);
                refresh_update_ui(&app);
                let mut notified = st.update_notified.lock().unwrap();
                if (notify_user || announce_none) && notified.as_deref() != Some(v.as_str()) {
                    *notified = Some(v.clone());
                    drop(notified);
                    log(&app, &format!("güncelleme hazır (GitHub): {v}"));
                    notify(&app, &format!("Tellal v{v} hazır"), "Kurmak için tıkla. İndirilir, sonra uygulama yeniden açılır.", Click::Settings);
                }
            }
            Ok(None) => {
                *st.update_version.lock().unwrap() = None;
                *st.github_update.lock().unwrap() = None;
                refresh_update_ui(&app);
                if announce_none {
                    notify(&app, "Tellal güncel", &format!("Sürüm {}", env!("CARGO_PKG_VERSION")), Click::Show);
                }
            }
            Err(e) => {
                log(&app, &format!("güncelleme denetlenemedi: {e}"));
                if announce_none {
                    notify(&app, "Güncelleme denetlenemedi", "İnternet bağlantısını kontrol et.", Click::Settings);
                }
            }
        }
    });
}

/// GitHub'dan indirilen kurulumu çalıştırır (Windows'ta kurulum uygulamayı kapatıp yenisini açar).
fn start_github_update(app: &AppHandle) -> Result<(), String> {
    let st = state(app);
    let update = st.github_update.lock().unwrap().clone().ok_or("Kurulacak yeni sürüm yok")?;
    if st.updating.swap(true, Ordering::SeqCst) {
        return Err("Güncelleme zaten sürüyor".into());
    }
    log(app, &format!("GitHub güncellemesi indiriliyor: {}", update.version));
    refresh_update_ui(app);
    if let Some(tray) = app.tray_by_id(TRAY) {
        let _ = tray.set_tooltip(Some("Tellal · güncelleniyor"));
    }
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        state(&app).save();
        let res = update.download_and_install(|_, _| {}, || {}).await;
        match res {
            Ok(()) => app.restart(),
            Err(e) => {
                let st = state(&app);
                st.updating.store(false, Ordering::SeqCst);
                refresh_update_ui(&app);
                log(&app, &format!("güncelleme kurulamadı: {e}"));
                notify(&app, "Güncelleme kurulamadı", &e.to_string(), Click::Settings);
            }
        }
    });
    Ok(())
}

/// derle.ps1'i sessiz kipte çalıştırır: derler, uygulamayı kapatır, yenisini kurup açar.
fn start_update(app: &AppHandle) -> Result<(), String> {
    let st = state(app);
    let Some(dir) = update::project_dir() else {
        return start_github_update(app);
    };
    if st.updating.swap(true, Ordering::SeqCst) {
        return Err("Güncelleme zaten sürüyor".into());
    }
    let log_path = st.data_dir.join("tanilama").join("guncelleme.log");
    let _ = std::fs::create_dir_all(log_path.parent().unwrap_or(&st.data_dir));
    let _ = std::fs::remove_file(&log_path);
    log(app, "güncelleme başlatıldı");
    refresh_update_ui(app);
    if let Some(tray) = app.tray_by_id(TRAY) {
        let _ = tray.set_tooltip(Some("Tellal · güncelleniyor"));
    }
    match spawn_update(&dir, &log_path) {
        Ok(mut child) => {
            let handle = app.clone();
            std::thread::spawn(move || {
                let ok = child.wait().map(|s| s.success()).unwrap_or(false);
                // Başarılıysa betik bu süreci kapatıp yenisini açar; buraya genelde dönülmez.
                let st = state(&handle);
                st.updating.store(false, Ordering::SeqCst);
                refresh_update_ui(&handle);
                if !ok {
                    log(&handle, "güncelleme derlenemedi");
                    notify(&handle, "Güncelleme kurulamadı", "Ayrıntı: tanilama/guncelleme.log", Click::Settings);
                }
            });
            Ok(())
        }
        Err(e) => {
            st.updating.store(false, Ordering::SeqCst);
            refresh_update_ui(app);
            Err(e)
        }
    }
}

#[cfg(windows)]
fn spawn_update(dir: &std::path::Path, log_path: &std::path::Path) -> Result<std::process::Child, String> {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    std::process::Command::new("powershell")
        .args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-File"])
        .arg(dir.join("derle.ps1"))
        .arg("-Sessiz")
        .arg("-Log")
        .arg(log_path)
        .current_dir(dir)
        .creation_flags(CREATE_NO_WINDOW)
        .spawn()
        .map_err(|e| format!("PowerShell başlatılamadı: {e}"))
}

#[cfg(not(windows))]
fn spawn_update(_dir: &std::path::Path, _log_path: &std::path::Path) -> Result<std::process::Child, String> {
    Err("Güncelleme yalnızca Windows'ta".into())
}

#[tauri::command]
fn update_status(app: AppHandle) -> serde_json::Value {
    check_update(&app, false);
    update_status_value(&app)
}

#[tauri::command]
fn update_install(app: AppHandle) -> Result<(), String> {
    if check_update(&app, false).is_none() {
        return Err("Kurulacak yeni sürüm yok".into());
    }
    start_update(&app)
}

// ---------------------------------------------------------------------------
// Ayarlar penceresi komutları
// ---------------------------------------------------------------------------

#[tauri::command]
fn get_settings(app: AppHandle) -> Settings {
    state(&app).snapshot()
}

#[tauri::command]
fn set_settings(app: AppHandle, settings: Settings) -> Settings {
    let autostart_changed;
    {
        let st = state(&app);
        let mut s = st.settings.lock().unwrap();
        let mut next = settings.sanitized();
        // Pencere durumu çekirdeğe ait; ayarlar sayfasındaki eski kopya üstüne yazmasın.
        next.mode = s.mode.clone();
        next.normal_bounds = s.normal_bounds;
        autostart_changed = next.autostart != s.autostart;
        *s = next;
    }
    if autostart_changed {
        let on = state(&app).snapshot().autostart;
        let al = app.autolaunch();
        let _ = if on { al.enable() } else { al.disable() };
    }
    apply_on_top(&app);
    push_to_page(&app);
    state(&app).save();
    state(&app).snapshot()
}

#[tauri::command]
fn set_mode_cmd(app: AppHandle, mode: String) {
    if matches!(mode.as_str(), "normal" | "phone" | "compact" | "mini") {
        set_mode(&app, &mode);
    }
}

#[tauri::command]
fn run_diagnostics(app: AppHandle) -> Result<(), String> {
    let w = main_window(&app).ok_or("WhatsApp penceresi yok")?;
    w.eval("window.__wap && window.__wap.diagnose();").map_err(|e| e.to_string())
}

#[tauri::command]
fn open_data_dir(app: AppHandle) -> Result<(), String> {
    let dir = state(&app).data_dir.clone();
    let _ = std::fs::create_dir_all(&dir);
    tauri_plugin_opener::open_path(dir.display().to_string(), None::<&str>).map_err(|e| e.to_string())
}

#[tauri::command]
fn app_info(app: AppHandle) -> serde_json::Value {
    let st = state(&app);
    serde_json::json!({
        "version": env!("CARGO_PKG_VERSION"),
        "dataDir": st.data_dir.display().to_string(),
        "settingsPath": st.path.display().to_string(),
        "unread": *st.unread.lock().unwrap(),
        "shortcut": "Ctrl + Shift + Boşluk",
    })
}

// ---------------------------------------------------------------------------
// Kurulum
// ---------------------------------------------------------------------------

fn is_internal(url: &Url) -> bool {
    match url.scheme() {
        "about" | "blob" | "data" => true,
        "https" => url.host_str() == Some("web.whatsapp.com"),
        _ => false,
    }
}

fn open_external(url: &Url) {
    if matches!(url.scheme(), "http" | "https" | "mailto" | "tel") {
        let _ = tauri_plugin_opener::open_url(url.as_str(), None::<&str>);
    }
}

fn build_main(app: &AppHandle, s: &Settings) -> tauri::Result<WebviewWindow> {
    let url: Url = WA_URL.parse().expect("geçerli adres");
    let w = WebviewWindowBuilder::new(app, MAIN, WebviewUrl::External(url))
        .title("Tellal")
        .decorations(false)
        .inner_size(1100.0, 760.0)
        .min_inner_size(320.0, 460.0)
        .visible(false)
        .background_color(tauri::window::Color(0, 0, 0, 255))
        .initialization_script(init_script(s))
        .on_document_title_changed(|w, title| {
            set_unread(w.app_handle(), parse_unread(&title));
        })
        .on_navigation(|url| {
            if is_internal(url) {
                true
            } else {
                open_external(url);
                false
            }
        })
        .on_new_window(|url, _features| {
            // Dış bağlantılar varsayılan tarayıcıda açılır.
            if url.scheme() == "blob" {
                return NewWindowResponse::Allow;
            }
            open_external(&url);
            NewWindowResponse::Deny
        })
        .on_download(|w, event| {
            let app = w.app_handle().clone();
            match event {
                tauri::webview::DownloadEvent::Requested { destination, .. } => {
                    // Medya toplayıcı açıkken belgeler sohbetin klasörüne gider.
                    if let Some(dir) = state(&app).download_target.lock().unwrap().clone() {
                        let name = destination
                            .file_name()
                            .map(|n| n.to_string_lossy().to_string())
                            .unwrap_or_else(|| "belge".into());
                        *destination = unique_path(&dir, &safe_name(&name, "belge"));
                    }
                }
                tauri::webview::DownloadEvent::Finished { path, success, .. } => {
                    let name = path
                        .as_ref()
                        .and_then(|p| p.file_name())
                        .map(|n| n.to_string_lossy().to_string())
                        .unwrap_or_default();
                    if let (Some(w), Ok(n)) = (main_window(&app), serde_json::to_string(&name)) {
                        let _ = w.eval(format!("window.__wap && window.__wap.mediaDownloaded({success}, {n});"));
                    }
                }
                _ => {}
            }
            true
        })
        .on_page_load(|w, payload| {
            let url = payload.url();
            let what = if payload.event() == PageLoadEvent::Finished { "yüklendi" } else { "yükleniyor" };
            log(w.app_handle(), &format!("sayfa {what}: {}{}", url.host_str().unwrap_or(""), url.path()));
            if payload.event() == PageLoadEvent::Started {
                state(w.app_handle()).page_ready.store(false, Ordering::SeqCst);
            }
            if payload.event() == PageLoadEvent::Finished {
                push_to_page(w.app_handle());
            }
        })
        .build()?;
    Ok(w)
}

fn build_tray(app: &AppHandle) -> tauri::Result<TrayIcon> {
    let s = state(app).snapshot();
    let on = s.on_top();
    let toggle = MenuItem::with_id(app, "toggle", "Göster / gizle", true, Some("Ctrl+Shift+Space"))?;
    let phone = MenuItem::with_id(app, "phone", "Telefon modu", true, Some("Ctrl+1"))?;
    let compact = MenuItem::with_id(app, "compact", "Kompakt", true, Some("Ctrl+3"))?;
    let normal = MenuItem::with_id(app, "normal", "Normal mod", true, Some("Ctrl+2"))?;
    let mini = MenuItem::with_id(app, "mini", "Mini pencere", true, Some("Ctrl+4"))?;
    let ontop = CheckMenuItem::with_id(app, "ontop", "Her zaman üstte", true, on, Some("Ctrl+T"))?;
    let settings = MenuItem::with_id(app, "settings", "Ayarlar ve tema", true, Some("Ctrl+,"))?;
    let reload = MenuItem::with_id(app, "reload", "Yeniden yükle", true, None::<&str>)?;
    let devtools = MenuItem::with_id(app, "devtools", "Geliştirici araçları", true, None::<&str>)?;
    let update = MenuItem::with_id(app, "update", "Güncellemeleri denetle", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Çıkış", true, None::<&str>)?;
    let sep = || PredefinedMenuItem::separator(app);
    let menu = Menu::with_items(
        app,
        &[
            &toggle, &sep()?, &phone, &compact, &normal, &mini, &ontop, &sep()?, &settings, &reload,
            &devtools, &update, &sep()?, &quit,
        ],
    )?;
    *state(app).ontop_item.lock().unwrap() = Some(ontop);
    *state(app).update_item.lock().unwrap() = Some(update);

    TrayIconBuilder::with_id(TRAY)
        .icon(tray_image(false))
        .tooltip("Tellal")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| {
            log(app, &format!("tepsi menüsü: {}", event.id().as_ref()));
            run_action(app, event.id().as_ref())
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                toggle_main(tray.app_handle());
            }
        })
        .build(app)
}

/// Windows bildirimlerinin görünmesi için uygulama kimliğini kayıt defterine yazar.
/// Kurulumsuz (portable) uygulamalarda bu kayıt olmadan bildirimler sessizce düşer.
#[cfg(windows)]
fn register_toast_identity(app: &AppHandle, data_dir: &std::path::Path) {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    let id = app.config().identifier.clone();
    let icon = data_dir.join("bildirim-ikonu.png");
    let _ = std::fs::create_dir_all(data_dir);
    let _ = std::fs::write(&icon, include_bytes!("../icons/128x128.png"));
    let key = format!("HKCU\\Software\\Classes\\AppUserModelId\\{id}");
    let values = [
        ("DisplayName", "Tellal".to_string()),
        ("IconUri", icon.display().to_string()),
    ];
    for (name, value) in values {
        let _ = std::process::Command::new("reg")
            .args(["add", &key, "/v", name, "/t", "REG_SZ", "/d", &value, "/f"])
            .creation_flags(CREATE_NO_WINDOW)
            .status();
    }
}

/// Uygulamanın eski kimliği (WhatsApp+ adıyla kullanılan veri klasörü).
const OLD_IDENTIFIER: &str = "com.kvbilai.whatsappplus";

/// Yeni veri klasörü yoksa eskisini adını değiştirerek taşır; taşınamazsa (dosya kilitli)
/// ayarlar ve zamanlı mesaj dosyalarını kopyalar.
fn migrate_old_dir(new_dir: &std::path::Path) {
    let Some(parent) = new_dir.parent() else { return };
    let old = parent.join(OLD_IDENTIFIER);
    if !old.is_dir() {
        return;
    }
    let fresh = !new_dir.exists()
        || std::fs::read_dir(new_dir).map(|mut d| d.next().is_none()).unwrap_or(false);
    if !fresh {
        return;
    }
    let _ = std::fs::remove_dir(new_dir);
    // Eski sürümün WebView süreçleri kapanırken klasör birkaç saniye kilitli kalabilir.
    for _ in 0..20 {
        if std::fs::rename(&old, new_dir).is_ok() {
            return;
        }
        std::thread::sleep(std::time::Duration::from_millis(250));
    }
    let _ = std::fs::create_dir_all(new_dir);
    for name in ["ayarlar.json", "zamanli.json"] {
        let _ = std::fs::copy(old.join(name), new_dir.join(name));
    }
}

fn main() {
    let start_hidden = std::env::args().any(|a| a == "--gizli");

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| show_main(app)))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_shortcuts([TOGGLE_SHORTCUT])
                .expect("kısayol tanımı")
                .with_handler(|app, _shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        toggle_main(app);
                    }
                })
                .build(),
        )
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--gizli"]),
        ))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            wa_event,
            wa_settings,
            get_settings,
            set_settings,
            set_mode_cmd,
            run_diagnostics,
            open_data_dir,
            app_info,
            wa_schedule,
            wa_media,
            schedules,
            schedule_action,
            theme_export,
            theme_import,
            update_status,
            update_install
        ])
        .setup(move |app| {
            let handle = app.handle().clone();
            let config_dir = app.path().app_config_dir()?;
            let data_dir = app.path().app_data_dir()?;
            // WhatsApp+ adından taşınma: ayarlar, zamanlı mesajlar ve WhatsApp oturumu kalsın.
            if let Ok(local) = app.path().app_local_data_dir() {
                migrate_old_dir(&local);
            }
            migrate_old_dir(&config_dir);
            let path = config_dir.join("ayarlar.json");
            let settings = Settings::load(&path);
            if settings.autostart {
                // Başlangıç kaydı yeni adla ve yeni yolla yazılsın.
                let _ = app.autolaunch().enable();
            }

            #[cfg(windows)]
            register_toast_identity(&handle, &data_dir);

            let store = schedule::Store::load(&data_dir.join("zamanli.json"));
            app.manage(AppState {
                settings: Mutex::new(settings.clone()),
                path,
                data_dir,
                unread: Mutex::new(0),
                ontop_item: Mutex::new(None),
                page_ready: AtomicBool::new(false),
                schedules: Mutex::new(store),
                last_send: Mutex::new(0),
                update_version: Mutex::new(None),
                update_notified: Mutex::new(None),
                update_item: Mutex::new(None),
                updating: AtomicBool::new(false),
                mini_return: Mutex::new("normal".into()),
                github_update: Mutex::new(None),
                github_checking: AtomicBool::new(false),
                maximized: AtomicBool::new(false),
                download_target: Mutex::new(None),
            });

            log(&handle, &format!("başladı, sürüm {}", env!("CARGO_PKG_VERSION")));
            build_tray(&handle)?;
            let w = build_main(&handle, &settings)?;

            // Kaydedilen modla aç.
            let mode = settings.mode.clone();
            if mode == "normal" {
                if let Some(b) = settings.normal_bounds {
                    let _ = w.set_size(PhysicalSize::new(b.w, b.h));
                    let _ = w.set_position(PhysicalPosition::new(b.x, b.y));
                    ensure_on_screen(&w);
                } else {
                    let _ = w.center();
                }
                apply_on_top(&handle);
                let _ = w.set_zoom(settings.zoom as f64 / 100.0);
            } else {
                set_mode(&handle, &mode);
            }
            if !start_hidden {
                let _ = w.show();
                let _ = w.set_focus();
            }
            if std::env::var_os("WAP_OPEN_SETTINGS").is_some() {
                open_settings(&handle);
            }

            // Zamanlayıcı: 5 saniyede bir.
            let h = handle.clone();
            std::thread::spawn(move || loop {
                std::thread::sleep(std::time::Duration::from_secs(5));
                scheduler_tick(&h);
            });
            // Güncelleme denetimi: açılıştan 20 sn sonra, sonra 10 dakikada bir.
            let h = handle.clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_secs(20));
                let mut n: u32 = 0;
                loop {
                    // Proje klasörü yerelde: 10 dakikada bir. GitHub: 3 saatte bir.
                    if update::project_dir().is_some() || n % 18 == 0 {
                        check_update(&h, true);
                    }
                    n = n.wrapping_add(1);
                    std::thread::sleep(std::time::Duration::from_secs(600));
                }
            });
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() != MAIN {
                return;
            }
            let app = window.app_handle();
            match event {
                WindowEvent::CloseRequested { api, .. } => {
                    remember_normal_bounds(app);
                    state(app).save();
                    if state(app).snapshot().close_to_tray {
                        api.prevent_close();
                        let _ = window.hide();
                    }
                }
                WindowEvent::Moved(_) => {
                    remember_normal_bounds(app);
                }
                WindowEvent::Resized(_) => {
                    remember_normal_bounds(app);
                    if window.label() == MAIN {
                        push_window_state(app);
                    }
                }
                _ => {}
            }
        })
        .build(tauri::generate_context!())
        .expect("Tellal başlatılamadı")
        .run(|app, event| {
            if let RunEvent::Exit = event {
                state(app).save();
            }
        });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unread_from_title() {
        assert_eq!(parse_unread("(3) WhatsApp"), 3);
        assert_eq!(parse_unread("(125) WhatsApp"), 125);
        assert_eq!(parse_unread("WhatsApp"), 0);
        assert_eq!(parse_unread("(x) WhatsApp"), 0);
    }

    #[test]
    fn internal_urls() {
        assert!(is_internal(&"https://web.whatsapp.com/".parse().unwrap()));
        assert!(is_internal(&"blob:https://web.whatsapp.com/abc".parse().unwrap()));
        assert!(!is_internal(&"https://example.com/".parse().unwrap()));
        assert!(!is_internal(&"https://faq.whatsapp.com/".parse().unwrap()));
    }

    #[test]
    fn theme_file() {
        let t = Theme::default();
        let doc = serde_json::json!({ "format": "tellal-tema", "version": 1, "theme": t });
        assert_eq!(parse_theme_file(&doc.to_string()).unwrap().bg, "#000000");
        let bare = serde_json::to_string(&Theme::default()).unwrap();
        assert!(parse_theme_file(&bare).is_ok());
        assert!(parse_theme_file("{}").is_err());
        assert!(parse_theme_file("çöp").is_err());
        let evil = r##"{"theme":{"bg":"#000000","wallpaper":"url(https://x.y/z.png)"}}"##;
        assert_eq!(parse_theme_file(evil).unwrap().wallpaper, "");
    }

    #[test]
    fn init_script_has_boot() {
        let s = init_script(&Settings::default());
        assert!(s.starts_with("window.__WAP_BOOT__ = {"));
        assert!(s.contains("__wap"));
    }
}

#[cfg(test)]
mod dump {
    /// Testler için: WAP_DUMP=dosya cargo test dump_init ile enjekte betiği diske yazar.
    #[test]
    fn dump_init() {
        if let Ok(p) = std::env::var("WAP_DUMP") {
            std::fs::write(p, super::init_script(&super::Settings::default())).unwrap();
        }
    }
}
