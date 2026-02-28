mod auth;
mod commands;
mod crypto;
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
            commands::parse_otpauth_uri,
            commands::get_remaining_seconds,
            commands::export_vault,
            commands::import_vault,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
