//! Yerel kaynaktan güncelleme.
//!
//! derle.ps1 kurulum klasörüne `kaynak.txt` bırakır: proje klasörünün yolu. Uygulama oradaki
//! Cargo.toml sürümünü kendi sürümüyle karşılaştırır; daha yeniyse kurmayı önerir. Kurulum yine
//! derle.ps1'in sessiz kipiyle yapılır: önce derler, sonra uygulamayı kapatıp yenisini açar.

use std::path::{Path, PathBuf};

pub fn parse(v: &str) -> Option<(u32, u32, u32)> {
    let mut it = v.trim().trim_start_matches('v').split('.');
    let a = it.next()?.parse().ok()?;
    let b = it.next().unwrap_or("0").parse().ok()?;
    let c = it.next().unwrap_or("0").split(|ch: char| !ch.is_ascii_digit()).next()?.parse().ok()?;
    Some((a, b, c))
}

pub fn is_newer(candidate: &str, current: &str) -> bool {
    match (parse(candidate), parse(current)) {
        (Some(a), Some(b)) => a > b,
        _ => false,
    }
}

/// Kurulu uygulamanın yanındaki kaynak.txt'den proje klasörünü okur.
pub fn project_dir() -> Option<PathBuf> {
    let exe = std::env::current_exe().ok()?;
    let marker = exe.parent()?.join("kaynak.txt");
    let raw = std::fs::read_to_string(marker).ok()?;
    let path = PathBuf::from(raw.trim_start_matches('\u{feff}').trim());
    if path.join("Cargo.toml").is_file() && path.join("derle.ps1").is_file() {
        Some(path)
    } else {
        None
    }
}

/// Cargo.toml'daki [package] sürümünü okur.
pub fn project_version(dir: &Path) -> Option<String> {
    let text = std::fs::read_to_string(dir.join("Cargo.toml")).ok()?;
    version_from_manifest(&text)
}

pub fn version_from_manifest(text: &str) -> Option<String> {
    let mut in_package = false;
    for line in text.lines() {
        let l = line.trim();
        if l.starts_with('[') {
            in_package = l == "[package]";
            continue;
        }
        if in_package {
            if let Some(rest) = l.strip_prefix("version") {
                let rest = rest.trim_start();
                if let Some(v) = rest.strip_prefix('=') {
                    return Some(v.trim().trim_matches('"').to_string());
                }
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn versions() {
        assert!(is_newer("0.2.1", "0.2.0"));
        assert!(is_newer("0.10.0", "0.9.9"));
        assert!(!is_newer("0.2.0", "0.2.0"));
        assert!(!is_newer("0.1.9", "0.2.0"));
        assert!(!is_newer("bozuk", "0.2.0"));
    }

    #[test]
    fn manifest() {
        let t = "[package]\nname = \"x\"\nversion = \"0.2.3\"\n\n[dependencies]\nversion = \"9\"\n";
        assert_eq!(version_from_manifest(t).as_deref(), Some("0.2.3"));
        assert_eq!(version_from_manifest("[dependencies]\nversion = \"1\""), None);
    }
}
