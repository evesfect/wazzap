fn main() {
    // Uygulama komutları için izin listesi. WhatsApp sayfası (uzak adres) yalnızca
    // capabilities/whatsapp.json içinde açıkça izin verilen iki komuta erişebilir.
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "wa_event",
            "wa_settings",
            "get_settings",
            "set_settings",
            "set_mode_cmd",
            "run_diagnostics",
            "open_data_dir",
            "app_info",
            "wa_schedule",
            "wa_media",
            "schedules",
            "schedule_action",
            "theme_export",
            "theme_import",
            "update_status",
            "update_install",
        ]),
    ))
    .expect("tauri-build başarısız");
}
