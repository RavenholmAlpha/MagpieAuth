mod auth;
mod commands;
pub mod crypto;
mod db;
mod totp;

use commands::AppState;
use std::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize IMK (generates on first run, retrieves on subsequent runs)
    let imk = crypto::retrieve_imk().expect("Failed to initialize Internal Master Key");

    // Initialize database
    let conn = db::init_db().expect("Failed to initialize database");

    let state = AppState {
        db: Mutex::new(conn),
        imk,
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            use tauri::menu::{MenuBuilder, MenuItemBuilder};

            let show_i = MenuItemBuilder::with_id("show", "显示主界面 (Show)").build(app)?;
            let lock_i = MenuItemBuilder::with_id("lock", "立刻锁定 (Lock)").build(app)?;
            let quit_i = MenuItemBuilder::with_id("quit", "退出 (Exit)").build(app)?;

            let menu = MenuBuilder::new(app)
                .items(&[&show_i, &lock_i, &quit_i])
                .build()?;

            tauri::tray::TrayIconBuilder::with_id("main")
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("MagpieAuth")
                .menu(&menu)
                .on_menu_event(move |app, event| match event.id.as_ref() {
                    "show" => {
                        commands::toggle_window_visibility(app.clone());
                    }
                    "lock" => {
                        use tauri::Emitter;
                        let _ = app.emit("tray-lock-request", ());
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::Click {
                        button: tauri::tray::MouseButton::Left,
                        button_state: tauri::tray::MouseButtonState::Up,
                        ..
                    } = event
                    {
                        use tauri::Manager;
                        if let Some(window) = tray.app_handle().get_webview_window("main") {
                            let _ = window.unminimize();
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;
            Ok(())
        })
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            commands::get_vault_items,
            commands::search_items,
            commands::add_item,
            commands::update_item,
            commands::delete_item,
            commands::get_password_plaintext,
            commands::get_totp_code,
            commands::verify_system_auth,
            commands::check_system_auth_available,
            commands::set_pattern_lock,
            commands::verify_pattern_lock,
            commands::has_pattern_lock,
            commands::parse_otpauth_uri,
            commands::get_remaining_seconds,
            commands::export_vault,
            commands::import_vault,
            commands::minimize_window,
            commands::close_window,
            commands::hide_window,
            commands::exit_app,
            commands::toggle_window_visibility,
            commands::get_labels,
            commands::add_label,
            commands::update_label,
            commands::delete_label,
            commands::register_global_shortcut,
            commands::sync_lock_state,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
