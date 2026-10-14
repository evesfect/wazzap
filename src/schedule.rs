//! Zamanlı mesajlar: kayıt, kalıcı depolama ve zamanlayıcı kararı.
//!
//! Gönderimin kendisi WhatsApp sayfasında, köprünün sohbeti açıp yazıp gönder'e basmasıyla olur.
//! Burada yalnızca "şimdi ne yapılmalı" kararı verilir; saf fonksiyon olduğu için test edilebilir.

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

/// Zamanı geçtikten sonra en fazla bu kadar gecikmeyle gönderilir; daha geç olursa "kaçırıldı".
pub const GRACE_MS: i64 = 10 * 60 * 1000;
/// Sayfa bu sürede sonuç bildirmezse gönderim "hata" sayılır.
pub const SEND_TIMEOUT_MS: i64 = 90 * 1000;
/// İki gönderim arasında en az bu kadar beklenir: toplu gönderim gibi görünmesin.
pub const MIN_GAP_MS: i64 = 20 * 1000;
/// Aynı anda bekleyebilecek en fazla mesaj.
pub const MAX_PENDING: usize = 100;
pub const MAX_TEXT: usize = 4000;

#[derive(Serialize, Deserialize, Clone, Copy, PartialEq, Eq, Debug)]
#[serde(rename_all = "lowercase")]
pub enum Status {
    Bekliyor,
    Gonderiliyor,
    Gonderildi,
    Kacirildi,
    Hata,
    Iptal,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Item {
    pub id: String,
    /// Sohbetin WhatsApp'ta görünen adı; gönderirken başlık bununla birebir eşleşmeli.
    pub chat: String,
    pub text: String,
    /// Gönderim zamanı, Unix milisaniye.
    pub due: i64,
    pub created: i64,
    pub status: Status,
    #[serde(default)]
    pub error: Option<String>,
    #[serde(default)]
    pub started_at: Option<i64>,
    #[serde(default)]
    pub sent_at: Option<i64>,
}

#[derive(Default, Debug, PartialEq)]
pub struct Tick {
    /// Bu turda "kaçırıldı" olanlar.
    pub missed: Vec<String>,
    /// Sonuç gelmediği için "hata" olanlar.
    pub timed_out: Vec<String>,
    /// Şimdi gönderilecek olan (durumu "gönderiliyor" yapıldı).
    pub send: Option<String>,
}

impl Tick {
    pub fn changed(&self) -> bool {
        !self.missed.is_empty() || !self.timed_out.is_empty() || self.send.is_some()
    }
}

/// Zamanlayıcının bir turu. `items` yerinde güncellenir.
pub fn tick(items: &mut [Item], now: i64, last_send: i64) -> Tick {
    let mut out = Tick::default();
    let mut in_flight = false;
    for it in items.iter_mut() {
        match it.status {
            Status::Gonderiliyor => {
                if now - it.started_at.unwrap_or(now) > SEND_TIMEOUT_MS {
                    it.status = Status::Hata;
                    it.error = Some("WhatsApp yanıt vermedi; sohbette gidip gitmediğini kontrol et".into());
                    it.started_at = None;
                    out.timed_out.push(it.id.clone());
                } else {
                    in_flight = true;
                }
            }
            Status::Bekliyor if now - it.due > GRACE_MS => {
                it.status = Status::Kacirildi;
                it.error = Some("Zamanında gönderilemedi (bilgisayar kapalı ya da uykudaydı)".into());
                out.missed.push(it.id.clone());
            }
            _ => {}
        }
    }
    if in_flight || now - last_send < MIN_GAP_MS {
        return out;
    }
    let next = items
        .iter_mut()
        .filter(|it| it.status == Status::Bekliyor && it.due <= now)
        .min_by_key(|it| it.due);
    if let Some(it) = next {
        it.status = Status::Gonderiliyor;
        it.started_at = Some(now);
        it.error = None;
        out.send = Some(it.id.clone());
    }
    out
}

/// Yeni kayıt için doğrulama. Hata metni kullanıcıya gösterilir.
pub fn validate(chat: &str, text: &str, due: i64, now: i64, pending: usize) -> Result<(), String> {
    if chat.trim().is_empty() {
        return Err("Sohbet adı okunamadı".into());
    }
    if text.trim().is_empty() {
        return Err("Mesaj boş".into());
    }
    if text.chars().count() > MAX_TEXT {
        return Err(format!("Mesaj en fazla {MAX_TEXT} karakter olabilir"));
    }
    if due < now + 30_000 {
        return Err("Zaman en az 30 saniye sonrası olmalı".into());
    }
    if due > now + 366 * 24 * 3600 * 1000 {
        return Err("Zaman en fazla bir yıl sonrası olabilir".into());
    }
    if pending >= MAX_PENDING {
        return Err(format!("En fazla {MAX_PENDING} bekleyen mesaj olabilir"));
    }
    Ok(())
}

pub fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

pub struct Store {
    pub items: Vec<Item>,
    path: PathBuf,
    counter: u32,
}

impl Store {
    pub fn load(path: &Path) -> Store {
        let mut items: Vec<Item> = std::fs::read_to_string(path)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default();
        // Uygulama gönderim ortasında kapandıysa sonucu bilinmiyor: kullanıcıya bırak.
        for it in items.iter_mut() {
            if it.status == Status::Gonderiliyor {
                it.status = Status::Hata;
                it.error = Some("Uygulama gönderim sırasında kapandı; sohbette kontrol et".into());
                it.started_at = None;
            }
        }
        Store { items, path: path.to_path_buf(), counter: 0 }
    }

    pub fn save(&mut self) {
        // Biten kayıtlar 30 gün sonra silinir, liste 300 kayıtta tutulur.
        let cutoff = now_ms() - 30 * 24 * 3600 * 1000;
        self.items.retain(|it| {
            matches!(it.status, Status::Bekliyor | Status::Gonderiliyor | Status::Kacirildi | Status::Hata)
                || it.sent_at.unwrap_or(it.due) > cutoff
        });
        if self.items.len() > 300 {
            let drop = self.items.len() - 300;
            self.items.drain(0..drop);
        }
        if let Some(dir) = self.path.parent() {
            let _ = std::fs::create_dir_all(dir);
        }
        if let Ok(json) = serde_json::to_string_pretty(&self.items) {
            let tmp = self.path.with_extension("json.tmp");
            if std::fs::write(&tmp, json).is_ok() {
                let _ = std::fs::rename(&tmp, &self.path);
            }
        }
    }

    pub fn pending(&self) -> usize {
        self.items.iter().filter(|it| it.status == Status::Bekliyor).count()
    }

    pub fn add(&mut self, chat: &str, text: &str, due: i64) -> Result<Item, String> {
        let now = now_ms();
        validate(chat, text, due, now, self.pending())?;
        self.counter = self.counter.wrapping_add(1);
        let item = Item {
            id: format!("{now}-{}", self.counter),
            chat: chat.trim().to_string(),
            text: text.trim_end().to_string(),
            due,
            created: now,
            status: Status::Bekliyor,
            error: None,
            started_at: None,
            sent_at: None,
        };
        self.items.push(item.clone());
        self.items.sort_by_key(|it| it.due);
        Ok(item)
    }

    pub fn get_mut(&mut self, id: &str) -> Option<&mut Item> {
        self.items.iter_mut().find(|it| it.id == id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn item(id: &str, due: i64, status: Status) -> Item {
        Item {
            id: id.into(),
            chat: "Ayşe".into(),
            text: "Merhaba".into(),
            due,
            created: 0,
            status,
            error: None,
            started_at: None,
            sent_at: None,
        }
    }

    #[test]
    fn sends_due_item() {
        let mut v = vec![item("a", 1_000, Status::Bekliyor), item("b", 5_000_000, Status::Bekliyor)];
        let t = tick(&mut v, 2_000, -MIN_GAP_MS);
        assert_eq!(t.send.as_deref(), Some("a"));
        assert_eq!(v[0].status, Status::Gonderiliyor);
        assert_eq!(v[1].status, Status::Bekliyor);
    }

    #[test]
    fn one_at_a_time_and_gap() {
        let mut v = vec![item("a", 1_000, Status::Bekliyor), item("b", 1_500, Status::Bekliyor)];
        let now = 100_000;
        assert_eq!(tick(&mut v, now, 0).send.as_deref(), Some("a"));
        // a henüz sonuçlanmadı: b beklemeli
        assert_eq!(tick(&mut v, now + 1_000, 0).send, None);
        v[0].status = Status::Gonderildi;
        // son gönderimden 20 sn geçmedi
        assert_eq!(tick(&mut v, now + 5_000, now).send, None);
        assert_eq!(tick(&mut v, now + 25_000, now).send.as_deref(), Some("b"));
    }

    #[test]
    fn late_items_are_missed_not_sent() {
        let mut v = vec![item("a", 0, Status::Bekliyor)];
        let t = tick(&mut v, GRACE_MS + 1, 0);
        assert_eq!(t.missed, vec!["a".to_string()]);
        assert_eq!(t.send, None);
        assert_eq!(v[0].status, Status::Kacirildi);
    }

    #[test]
    fn slightly_late_still_sent() {
        let mut v = vec![item("a", 0, Status::Bekliyor)];
        assert_eq!(tick(&mut v, GRACE_MS - 1, -MIN_GAP_MS).send.as_deref(), Some("a"));
    }

    #[test]
    fn stuck_send_times_out() {
        let mut v = vec![item("a", 0, Status::Gonderiliyor)];
        v[0].started_at = Some(0);
        let t = tick(&mut v, SEND_TIMEOUT_MS + 1, 0);
        assert_eq!(t.timed_out, vec!["a".to_string()]);
        assert_eq!(v[0].status, Status::Hata);
    }

    #[test]
    fn validation() {
        let now = 1_000_000;
        assert!(validate("Ayşe", "selam", now + 60_000, now, 0).is_ok());
        assert!(validate("", "selam", now + 60_000, now, 0).is_err());
        assert!(validate("Ayşe", "  ", now + 60_000, now, 0).is_err());
        assert!(validate("Ayşe", "selam", now + 1_000, now, 0).is_err());
        assert!(validate("Ayşe", "selam", now + 60_000, now, MAX_PENDING).is_err());
    }

    #[test]
    fn interrupted_send_becomes_error_on_load() {
        let dir = std::env::temp_dir().join(format!("wap-test-{}", now_ms()));
        let path = dir.join("zamanli.json");
        let mut s = Store { items: vec![item("a", 0, Status::Gonderiliyor)], path: path.clone(), counter: 0 };
        s.save();
        let s2 = Store::load(&path);
        assert_eq!(s2.items[0].status, Status::Hata);
        let _ = std::fs::remove_dir_all(dir);
    }
}
