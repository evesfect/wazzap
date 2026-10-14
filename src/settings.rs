use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

/// Tema: WhatsApp Web'in renkleri bu değerlere göre yeniden haritalanır.
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(default, rename_all = "camelCase")]
pub struct Theme {
    pub name: String,
    /// Nötr rampa: en koyu zeminden en açık yazıya (ya da tersi).
    pub bg: String,
    pub panel: String,
    pub line: String,
    pub dim: String,
    pub ink: String,
    /// Vurgu: okunmamış sayısı, gönder butonu, seçili öğeler.
    pub accent: String,
    pub accent_ink: String,
    /// Mesaj baloncukları.
    pub out_bubble: String,
    pub out_ink: String,
    pub in_bubble: String,
    pub in_ink: String,
    /// Sohbet arka planı: düz renk.
    pub chat_bg: String,
    /// Duvar kağıdı: boş, gradyan ya da url(data:...) değeri.
    pub wallpaper: String,
    pub font: String,
    /// Baloncuk köşe yuvarlaklığı (px). 0 = WhatsApp'ın kendisi.
    pub radius: u32,
    pub hide_tails: bool,
}

impl Default for Theme {
    fn default() -> Self {
        // ev stili
        Theme {
            name: "Siyah".into(),
            bg: "#000000".into(),
            panel: "#101010".into(),
            line: "#2A2A2A".into(),
            dim: "#8A8A8A".into(),
            ink: "#FFFFFF".into(),
            accent: "#EC2500".into(),
            accent_ink: "#000000".into(),
            out_bubble: "#1F1F1F".into(),
            out_ink: "#FFFFFF".into(),
            in_bubble: "#101010".into(),
            in_ink: "#FFFFFF".into(),
            chat_bg: "#000000".into(),
            wallpaper: String::new(),
            font: "Inter".into(),
            radius: 12,
            hide_tails: true,
        }
    }
}

fn is_hex(v: &str) -> bool {
    v.len() == 7 && v.starts_with('#') && v[1..].chars().all(|c| c.is_ascii_hexdigit())
}

/// Duvar kağıdı WhatsApp sayfasının CSS'ine girer: yalnızca gradyan ya da gömülü görsel kabul edilir,
/// dışarıya istek atabilecek ya da CSS'ten kaçabilecek her şey reddedilir.
pub fn safe_wallpaper(v: &str) -> bool {
    let v = v.trim();
    if v.is_empty() {
        return true;
    }
    if v.len() > 12_000_000 {
        return false;
    }
    if let Some(rest) = v.strip_prefix("url(\"data:image/") {
        let Some(body) = rest.strip_suffix("\")") else { return false };
        let Some((kind, data)) = body.split_once(";base64,") else { return false };
        return matches!(kind, "png" | "jpeg" | "webp" | "gif")
            && data.chars().all(|c| c.is_ascii_alphanumeric() || c == '+' || c == '/' || c == '=');
    }
    let gradient = v.split(", ").all(|part| {
        part.starts_with("linear-gradient(") || part.starts_with("radial-gradient(")
    }) || v.starts_with("linear-gradient(")
        || v.starts_with("radial-gradient(");
    gradient
        && v.len() < 2000
        && v.chars().all(|c| c.is_ascii_alphanumeric() || " #%(),.-".contains(c))
        && !v.to_ascii_lowercase().contains("url")
}

impl Theme {
    /// Dosyadan gelen temaya güvenme: renkler hex, yazı tipi listeden, duvar kağıdı güvenli olmalı.
    pub fn sanitized(mut self) -> Theme {
        let d = Theme::default();
        macro_rules! color {
            ($f:ident) => {
                if !is_hex(&self.$f) {
                    self.$f = d.$f.clone();
                }
            };
        }
        color!(bg);
        color!(panel);
        color!(line);
        color!(dim);
        color!(ink);
        color!(accent);
        color!(accent_ink);
        color!(out_bubble);
        color!(out_ink);
        color!(in_bubble);
        color!(in_ink);
        color!(chat_bg);
        if !matches!(self.font.as_str(), "Inter" | "Segoe UI" | "WhatsApp") {
            self.font = "Inter".into();
        }
        if !safe_wallpaper(&self.wallpaper) {
            self.wallpaper = String::new();
        }
        self.radius = self.radius.min(28);
        self.name = self.name.chars().filter(|c| !c.is_control()).take(40).collect::<String>().trim().to_string();
        if self.name.is_empty() {
            self.name = "Özel".into();
        }
        self
    }
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug)]
pub struct Bounds {
    pub x: i32,
    pub y: i32,
    pub w: u32,
    pub h: u32,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(default, rename_all = "camelCase")]
pub struct Settings {
    pub theme_enabled: bool,
    pub theme: Theme,
    /// Sayfa yakınlaştırması, yüzde.
    pub zoom: u32,
    pub phone_zoom: u32,
    /// Bu genişliğin (CSS px) altında düzen tek panele geçer.
    pub phone_breakpoint: u32,
    pub phone_on_top: bool,
    /// Mini pencere her zaman üstte mi (başlık çubuğundaki iğneyle değişir).
    pub mini_on_top: bool,
    pub phone_snap_right: bool,
    pub always_on_top: bool,
    pub close_to_tray: bool,
    pub autostart: bool,
    pub notifications: bool,
    pub notify_preview: bool,
    /// "normal" | "phone" | "compact" | "mini"
    pub mode: String,
    pub normal_bounds: Option<Bounds>,
    pub custom_css: String,
    /// Kullanıcının kaydettiği temalar (ayarlarda çip olarak görünür).
    pub saved_themes: Vec<Theme>,
}

impl Default for Settings {
    fn default() -> Self {
        Settings {
            theme_enabled: true,
            theme: Theme::default(),
            zoom: 100,
            phone_zoom: 90,
            phone_breakpoint: 600,
            phone_on_top: true,
            mini_on_top: true,
            phone_snap_right: true,
            always_on_top: false,
            close_to_tray: true,
            autostart: false,
            notifications: true,
            notify_preview: true,
            mode: "normal".into(),
            normal_bounds: None,
            custom_css: String::new(),
            saved_themes: Vec::new(),
        }
    }
}

impl Settings {
    /// Geçerli modda pencere her zaman üstte mi.
    pub fn on_top(&self) -> bool {
        match self.mode.as_str() {
            "normal" => self.always_on_top,
            "mini" => self.mini_on_top,
            _ => self.phone_on_top,
        }
    }

    pub fn load(path: &Path) -> Settings {
        std::fs::read_to_string(path)
            .ok()
            .and_then(|s| serde_json::from_str::<Settings>(&s).ok())
            .map(|s| s.sanitized())
            .unwrap_or_default()
    }

    pub fn save(&self, path: &Path) {
        if let Some(dir) = path.parent() {
            let _ = std::fs::create_dir_all(dir);
        }
        if let Ok(json) = serde_json::to_string_pretty(self) {
            // Önce geçici dosyaya yaz, sonra taşı: yarım kalan yazım ayarları bozmasın.
            let tmp: PathBuf = path.with_extension("json.tmp");
            if std::fs::write(&tmp, json).is_ok() {
                let _ = std::fs::rename(&tmp, path);
            }
        }
    }

    pub fn sanitized(mut self) -> Settings {
        self.zoom = self.zoom.clamp(50, 200);
        self.phone_zoom = self.phone_zoom.clamp(50, 200);
        self.phone_breakpoint = self.phone_breakpoint.clamp(320, 1200);
        self.theme.radius = self.theme.radius.min(28);
        if !matches!(self.mode.as_str(), "normal" | "phone" | "compact" | "mini") {
            self.mode = "normal".into();
        }
        self.theme = self.theme.sanitized();
        self.saved_themes = self.saved_themes.into_iter().take(40).map(|t| t.sanitized()).collect();
        self
    }

    pub fn zoom_for_mode(&self) -> u32 {
        if self.mode == "normal" { self.zoom } else { self.phone_zoom }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn wallpaper_filter() {
        assert!(safe_wallpaper(""));
        assert!(safe_wallpaper("linear-gradient(160deg, #2A2F36 0%, #0B0C0E 42%)"));
        assert!(safe_wallpaper("radial-gradient(120% 80% at 0% 0%, #3B0A5E 0%, rgba(59,10,94,0) 60%), radial-gradient(120% 80% at 100% 100%, #062B4F 0%, rgba(6,43,79,0) 60%)"));
        assert!(safe_wallpaper("url(\"data:image/jpeg;base64,AAAA/+==\")"));
        assert!(!safe_wallpaper("url(https://example.com/a.png)"));
        assert!(!safe_wallpaper("linear-gradient(red, blue); } body { display:none"));
        assert!(!safe_wallpaper("url(\"data:image/svg+xml;base64,AAAA\")"));
    }

    #[test]
    fn theme_sanitize() {
        let mut t = Theme::default();
        t.bg = "red; }".into();
        t.font = "Comic".into();
        t.name = "".into();
        let t = t.sanitized();
        assert_eq!(t.bg, "#000000");
        assert_eq!(t.font, "Inter");
        assert_eq!(t.name, "Özel");
    }
}
