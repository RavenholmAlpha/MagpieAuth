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
            commands::toggle_window_visibility,
            commands::get_labels,
            commands::add_label,
            commands::update_label,
            commands::delete_label,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
