//! Arayüz dili. Metinler kaynakta Türkçe yazılır; İngilizce seçiliyse buradaki tablodan çevrilir.
//! `{0}`, `{1}`: yer tutucular.

/// Ayardaki dili ("auto" / "tr" / "en") gerçek dile çevirir. "auto": sistem dili Türkçeyse
/// Türkçe, değilse İngilizce.
pub fn resolve(language: &str) -> &'static str {
    match language {
        "tr" => "tr",
        "en" => "en",
        _ => match sys_locale::get_locale() {
            Some(l) if l.to_ascii_lowercase().starts_with("tr") => "tr",
            _ => "en",
        },
    }
}

const EN: &[(&str, &str)] = &[
    // tepsi
    ("Göster / gizle", "Show / hide"),
    ("Telefon modu", "Phone mode"),
    ("Kompakt", "Compact"),
    ("Normal mod", "Normal mode"),
    ("Mini pencere", "Mini window"),
    ("Her zaman üstte", "Always on top"),
    ("Ayarlar ve tema", "Settings and theme"),
    ("Yeniden yükle", "Reload"),
    ("Geliştirici araçları", "Developer tools"),
    ("Güncellemeleri denetle", "Check for updates"),
    ("Paket yöneticisiyle güncelle", "Update with your package manager"),
    ("Çıkış", "Quit"),
    ("Güncelleniyor…", "Updating…"),
    ("Güncellemeyi kur · v{0}", "Install update · v{0}"),
    ("Wazzap? · güncelleniyor", "Wazzap? · updating"),
    ("Wazzap? · {0} okunmamış", "Wazzap? · {0} unread"),
    ("Ayarlar", "Settings"),
    // bildirimler
    ("Güncelleme başlatılamadı", "Could not start the update"),
    ("Wazzap? güncel", "Wazzap? is up to date"),
    ("Sürüm {0}", "Version {0}"),
    ("Zamanlı mesaj kaçırıldı", "Scheduled message missed"),
    ("{0} · göndermek için ayarlara bak", "{0} · open settings to send it"),
    ("Zamanlı mesaj gönderilemedi", "Scheduled message not sent"),
    ("{0} · WhatsApp yanıt vermedi", "{0} · WhatsApp did not respond"),
    ("Zamanlı mesaj gönderildi", "Scheduled message sent"),
    ("Wazzap? v{0} hazır", "Wazzap? v{0} is ready"),
    (
        "Kurmak için tıkla. Birkaç dakika sürer, sonra uygulama yeniden açılır.",
        "Click to install. It takes a few minutes, then the app restarts.",
    ),
    ("Kurmak için tıkla. İndirilir, sonra uygulama yeniden açılır.", "Click to install. It downloads, then the app restarts."),
    ("Güncelleme denetlenemedi", "Could not check for updates"),
    ("İnternet bağlantısını kontrol et.", "Check your internet connection."),
    ("Güncelleme kurulamadı", "Could not install the update"),
    ("Ayrıntı: tanilama/guncelleme.log", "Details: tanilama/guncelleme.log"),
    ("Yeni mesaj", "New message"),
    // hatalar
    ("Zaman okunamadı", "Could not read the time"),
    ("Kayıt bulunamadı", "Item not found"),
    ("Şu an gönderiliyor", "It is being sent right now"),
    ("Bu mesaj artık düzenlenemez", "This message can no longer be edited"),
    ("bilinmeyen işlem", "unknown action"),
    ("Klasör açılamadı", "Could not open the folder"),
    ("Dosya çok büyük", "File is too large"),
    ("Dosya okunamadı", "Could not read the file"),
    ("Temayı dışa aktar", "Export theme"),
    ("Tema dosyası seç", "Choose a theme file"),
    ("Wazzap? teması", "Wazzap? theme"),
    ("Yazılamadı", "Could not write"),
    ("Okunamadı", "Could not read"),
    ("Bu bir Wazzap? tema dosyası değil", "This is not a Wazzap? theme file"),
    ("Tema dosyası bozuk", "The theme file is damaged"),
    ("Kurulacak yeni sürüm yok", "There is no new version to install"),
    ("Güncelleme zaten sürüyor", "An update is already running"),
    ("PowerShell başlatılamadı", "Could not start PowerShell"),
    ("Güncelleme yalnızca Windows'ta", "Updates only work on Windows"),
    // zamanlı mesaj kayıtları
    ("Sohbet adı okunamadı", "Could not read the chat name"),
    ("Mesaj boş", "Message is empty"),
    ("Mesaj en fazla {0} karakter olabilir", "A message can be at most {0} characters"),
    ("Zaman en az 30 saniye sonrası olmalı", "The time must be at least 30 seconds from now"),
    ("Zaman en fazla bir yıl sonrası olabilir", "The time can be at most a year from now"),
    ("En fazla {0} bekleyen mesaj olabilir", "There can be at most {0} pending messages"),
    (
        "WhatsApp yanıt vermedi; sohbette gidip gitmediğini kontrol et",
        "WhatsApp did not respond; check the chat to see whether it went out",
    ),
    (
        "Zamanında gönderilemedi (bilgisayar kapalı ya da uykudaydı)",
        "Could not be sent on time (the computer was off or asleep)",
    ),
    ("Uygulama gönderim sırasında kapandı; sohbette kontrol et", "The app closed while sending; check the chat"),
];

fn lookup(text: &str) -> Option<&'static str> {
    EN.iter().find(|(k, _)| *k == text).map(|(_, v)| *v)
}

/// Metni çevirir ve {0}, {1}… yer tutucularını doldurur.
pub fn t(lang: &str, text: &str, args: &[&str]) -> String {
    let mut out = if lang == "en" { lookup(text).unwrap_or(text).to_string() } else { text.to_string() };
    for (i, a) in args.iter().enumerate() {
        out = out.replace(&format!("{{{i}}}"), a);
    }
    out
}

/// Kullanıcıya dönen hata metnini çevirir. "Önek: ayrıntı" biçiminde öneki çevirir;
/// sayı içeren bilinen kalıpları da tanır.
pub fn err(lang: &str, text: &str) -> String {
    if lang != "en" {
        return text.to_string();
    }
    if let Some(v) = lookup(text) {
        return v.to_string();
    }
    if let Some((head, rest)) = text.split_once(": ") {
        if let Some(v) = lookup(head) {
            return format!("{v}: {rest}");
        }
    }
    // Sayı içeren kalıplar: rakamları {0} yapıp ara.
    let digits: String = text.chars().filter(|c| c.is_ascii_digit()).collect();
    if !digits.is_empty() {
        let key = text.replacen(&digits, "{0}", 1);
        if let Some(v) = lookup(&key) {
            return v.replace("{0}", &digits);
        }
    }
    text.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn translates() {
        assert_eq!(t("en", "Çıkış", &[]), "Quit");
        assert_eq!(t("tr", "Çıkış", &[]), "Çıkış");
        assert_eq!(t("en", "Sürüm {0}", &["1.2"]), "Version 1.2");
        assert_eq!(t("en", "bilinmeyen metin", &[]), "bilinmeyen metin");
        assert_eq!(err("en", "Okunamadı: erişim reddedildi"), "Could not read: erişim reddedildi");
        assert_eq!(err("en", "En fazla 100 bekleyen mesaj olabilir"), "There can be at most 100 pending messages");
        assert_eq!(resolve("tr"), "tr");
        assert_eq!(resolve("en"), "en");
    }
}
