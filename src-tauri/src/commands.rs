use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use tauri::State;

use crate::{auth, crypto, db, security, totp};

/// Shared app state holding the database connection and IMK
pub struct AppState {
    pub db: Mutex<rusqlite::Connection>,
    pub imk: [u8; 32],
    pub session: security::SecuritySession,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PasswordResponse {
    pub success: bool,
    pub plaintext: Option<String>,
    pub error: Option<String>,
}

// ============================================================
// Vault CRUD Commands
// ============================================================

#[tauri::command]
pub fn get_vault_items(state: State<'_, Arc<AppState>>) -> Result<Vec<db::VaultItemBase>, String> {
    state.session.require_unlocked()?;
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::get_all_items(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn search_items(
    state: State<'_, Arc<AppState>>,
    query: String,
) -> Result<Vec<db::VaultItemBase>, String> {
    state.session.require_unlocked()?;
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::search_items(&conn, &query).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_item(state: State<'_, Arc<AppState>>, payload: db::ItemPayload) -> Result<String, String> {
    state.session.require_unlocked()?;
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::insert_item(&conn, &payload, &state.imk)
}

#[tauri::command]
pub fn update_item(
    state: State<'_, Arc<AppState>>,
    id: String,
    payload: db::ItemPayload,
) -> Result<(), String> {
    state.session.require_unlocked()?;
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::update_item(&conn, &id, &payload, &state.imk)
}

#[tauri::command]
pub fn delete_item(state: State<'_, Arc<AppState>>, id: String) -> Result<(), String> {
    state.session.require_unlocked()?;
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::delete_item(&conn, &id)
}

// ============================================================
// Label CRUD Commands
// ============================================================

#[tauri::command]
pub fn get_labels(state: State<'_, Arc<AppState>>) -> Result<Vec<db::Label>, String> {
    state.session.require_unlocked()?;
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::get_all_labels(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_label(state: State<'_, Arc<AppState>>, payload: db::LabelPayload) -> Result<String, String> {
    state.session.require_unlocked()?;
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::insert_label(&conn, &payload)
}

#[tauri::command]
pub fn update_label(
    state: State<'_, Arc<AppState>>,
    id: String,
    payload: db::LabelPayload,
) -> Result<(), String> {
    state.session.require_unlocked()?;
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::update_label(&conn, &id, &payload)
}

#[tauri::command]
pub fn delete_label(state: State<'_, Arc<AppState>>, id: String) -> Result<(), String> {
    state.session.require_unlocked()?;
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::delete_label(&conn, &id)
}

// ============================================================
// Sensitive Data Access (requires system auth)
// ============================================================

#[tauri::command]
pub fn get_password_plaintext(state: State<'_, Arc<AppState>>, id: String) -> PasswordResponse {
    if let Err(e) = state.session.require_unlocked() {
        return PasswordResponse {
            success: false,
            plaintext: None,
            error: Some(e),
        };
    }

    let conn = match state.db.lock() {
        Ok(c) => c,
        Err(e) => {
            return PasswordResponse {
                success: false,
                plaintext: None,
                error: Some(e.to_string()),
            }
        }
    };

    match db::get_encrypted_password(&conn, &id) {
        Ok(Some(blob)) => match crypto::decrypt_field(&blob, &state.imk, id.as_bytes()) {
            Ok(plaintext) => PasswordResponse {
                success: true,
                plaintext: Some(String::from_utf8_lossy(&plaintext).to_string()),
                error: None,
            },
            Err(e) => PasswordResponse {
                success: false,
                plaintext: None,
                error: Some(e.to_string()),
            },
        },
        Ok(None) => PasswordResponse {
            success: false,
            plaintext: None,
            error: Some("No password stored for this item".into()),
        },
        Err(e) => PasswordResponse {
            success: false,
            plaintext: None,
            error: Some(e),
        },
    }
}

#[tauri::command]
pub fn get_totp_code(state: State<'_, Arc<AppState>>, id: String) -> totp::TotpCodeResponse {
    if let Err(e) = state.session.require_unlocked() {
        return totp::TotpCodeResponse {
            success: false,
            code: None,
            valid_until: None,
            step: None,
            error: Some(e),
        };
    }

    let conn = match state.db.lock() {
        Ok(c) => c,
        Err(e) => {
            return totp::TotpCodeResponse {
                success: false,
                code: None,
                valid_until: None,
                step: None,
                error: Some(e.to_string()),
            }
        }
    };

    match db::get_encrypted_totp_secret(&conn, &id) {
        Ok(Some(blob)) => match crypto::decrypt_field(&blob, &state.imk, id.as_bytes()) {
            Ok(secret_bytes) => {
                let secret_str = String::from_utf8_lossy(&secret_bytes).to_string();
                totp::generate_totp_code(&secret_str)
            }
            Err(e) => totp::TotpCodeResponse {
                success: false,
                code: None,
                valid_until: None,
                step: None,
                error: Some(e.to_string()),
            },
        },
        Ok(None) => totp::TotpCodeResponse {
            success: false,
            code: None,
            valid_until: None,
            step: None,
            error: Some("No TOTP secret stored for this item".into()),
        },
        Err(e) => totp::TotpCodeResponse {
            success: false,
            code: None,
            valid_until: None,
            step: None,
            error: Some(e),
        },
    }
}

// ============================================================
// System Auth & Pattern Auth
// ============================================================

#[tauri::command]
pub async fn verify_system_auth(
    window: tauri::Window,
    state: State<'_, Arc<AppState>>,
) -> Result<bool, String> {
    let verified = auth::verify_user(window).await?;
    if verified {
        state.session.unlock();
    }
    Ok(verified)
}

#[tauri::command]
pub async fn check_system_auth_available() -> bool {
    auth::is_auth_available().await
}

#[tauri::command]
pub fn set_pattern_lock(state: State<'_, Arc<AppState>>, pattern: String) -> Result<(), String> {
    if pattern.is_empty() {
        return Err("Pattern cannot be empty".into());
    }

    let has_existing_pattern = crypto::retrieve_pattern()
        .map_err(|e| e.to_string())?
        .is_some();
    let has_existing_items = {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        db::has_any_items(&conn).map_err(|e| e.to_string())?
    };

    if has_existing_pattern || has_existing_items {
        state.session.require_unlocked()?;
    }

    let hash = crypto::hash_pattern(&pattern).map_err(|e| e.to_string())?;
    crypto::store_pattern(&hash).map_err(|e| e.to_string())?;
    state.session.unlock();
    Ok(())
}

#[tauri::command]
pub fn verify_pattern_lock(state: State<'_, Arc<AppState>>, pattern: String) -> Result<bool, String> {
    match crypto::retrieve_pattern() {
        Ok(Some(hash)) => {
            let verified = crypto::verify_pattern(&pattern, &hash).map_err(|e| e.to_string())?;
            if verified {
                state.session.unlock();
            }
            Ok(verified)
        }
        Ok(None) => Err("No pattern set".into()),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn has_pattern_lock() -> bool {
    crypto::retrieve_pattern()
        .map(|opt| opt.is_some())
        .unwrap_or(false)
}

/// Parse an otpauth:// URI into its components
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OtpauthParseResult {
    pub success: bool,
    pub secret: Option<String>,
    pub issuer: Option<String>,
    pub account_name: Option<String>,
    pub error: Option<String>,
}

#[tauri::command]
pub fn parse_otpauth_uri(uri: String) -> OtpauthParseResult {
    match totp::parse_otpauth_uri(&uri) {
        Ok((secret, issuer, account_name)) => OtpauthParseResult {
            success: true,
            secret: Some(secret),
            issuer,
            account_name,
            error: None,
        },
        Err(e) => OtpauthParseResult {
            success: false,
            secret: None,
            issuer: None,
            account_name: None,
            error: Some(e),
        },
    }
}

#[tauri::command]
pub fn get_remaining_seconds() -> u64 {
    totp::get_remaining_seconds()
}

// ============================================================
// Export / Import
// ============================================================

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExportItem {
    id: String,
    title: String,
    account: Option<String>,
    password_plaintext: Option<String>,
    totp_secret_plaintext: Option<String>,
    label_id: Option<String>,
    created_at: i64,
    updated_at: i64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExportData {
    version: u32,
    exported_at: i64,
    items: Vec<ExportItem>,
    labels: Vec<db::Label>,
}

#[tauri::command]
pub async fn export_vault(
    window: tauri::Window,
    state: State<'_, Arc<AppState>>,
    password: String,
    file_path: String,
) -> Result<(), String> {
    // Verify user identity
    match auth::verify_user(window).await {
        Ok(true) => {}
        Ok(false) => return Err("Authentication denied".into()),
        Err(e) => return Err(format!("Authentication error: {}", e)),
    }

    let conn = state.db.lock().map_err(|e| e.to_string())?;

    // Get all items and decrypt sensitive fields for export
    let items = db::get_all_full_items(&conn).map_err(|e| e.to_string())?;

    let export_items: Vec<ExportItem> = items
        .iter()
        .map(|item| {
            let password_plaintext = item.encrypted_password.as_ref().and_then(|blob| {
                crypto::decrypt_field(blob, &state.imk, item.id.as_bytes())
                    .ok()
                    .map(|b| String::from_utf8_lossy(&b).to_string())
            });

            let totp_secret_plaintext = item.encrypted_totp_secret.as_ref().and_then(|blob| {
                crypto::decrypt_field(blob, &state.imk, item.id.as_bytes())
                    .ok()
                    .map(|b| String::from_utf8_lossy(&b).to_string())
            });

            ExportItem {
                id: item.id.clone(),
                title: item.title.clone(),
                account: item.account.clone(),
                password_plaintext,
                totp_secret_plaintext,
                label_id: item.label_id.clone(),
                created_at: item.created_at,
                updated_at: item.updated_at,
            }
        })
        .collect();

    let labels = db::get_all_labels(&conn).unwrap_or_default();

    let export_data = ExportData {
        version: 2,
        exported_at: chrono::Utc::now().timestamp_millis(),
        items: export_items,
        labels,
    };

    let json = serde_json::to_vec(&export_data).map_err(|e| e.to_string())?;
    let encrypted = crypto::encrypt_export(&json, &password).map_err(|e| e.to_string())?;

    std::fs::write(&file_path, &encrypted).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn import_vault(
    window: tauri::Window,
    state: State<'_, Arc<AppState>>,
    file_path: String,
    password: String,
) -> Result<u32, String> {
    match auth::verify_user(window).await {
        Ok(true) => {}
        Ok(false) => return Err("Authentication denied".into()),
        Err(e) => return Err(format!("Authentication error: {}", e)),
    }

    let file_bytes = std::fs::read(&file_path).map_err(|e| e.to_string())?;
    let decrypted = crypto::decrypt_import(&file_bytes, &password).map_err(|e| e.to_string())?;

    let export_data: ExportData =
        serde_json::from_slice(&decrypted).map_err(|e| format!("Invalid backup format: {}", e))?;

    let conn = state.db.lock().map_err(|e| e.to_string())?;

    // Import labels (if present in version 2 format)
    if export_data.version >= 2 {
        for label in export_data.labels {
            // Check if label already exists
            let stmt = conn.query_row(
                "SELECT id FROM labels WHERE id = ?1",
                rusqlite::params![label.id],
                |_| Ok(()),
            );
            if stmt.is_err() {
                // Not found, insert straight into raw DB to preserve the UUID instead of generating new ones
                let _ = conn.execute(
                    "INSERT INTO labels (id, name, color, created_at) VALUES (?1, ?2, ?3, ?4)",
                    rusqlite::params![label.id, label.name, label.color, label.created_at],
                );
            }
        }
    }

    let mut count = 0u32;

    for item in &export_data.items {
        let payload = db::ItemPayload {
            title: item.title.clone(),
            account: item.account.clone(),
            password: item
                .password_plaintext
                .clone()
                .map(db::SecretField::Set)
                .unwrap_or(db::SecretField::Clear),
            totp_secret: item
                .totp_secret_plaintext
                .clone()
                .map(db::SecretField::Set)
                .unwrap_or(db::SecretField::Clear),
            label_id: item.label_id.clone(),
        };
        db::insert_item(&conn, &payload, &state.imk)?;
        count += 1;
    }

    Ok(count)
}

// ============================================================
// Window Controls (Tauri V2 JS Proxy Bypass)
// ============================================================

#[tauri::command]
pub fn minimize_window(window: tauri::Window) {
    if let Err(e) = window.minimize() {
        eprintln!("Failed to minimize window: {}", e);
    }
}

#[tauri::command]
pub fn close_window(window: tauri::Window) {
    if let Err(e) = window.close() {
        eprintln!("Failed to close window: {}", e);
    }
}

#[tauri::command]
pub fn hide_window(window: tauri::Window) {
    if let Err(e) = window.hide() {
        eprintln!("Failed to hide window: {}", e);
    }
}

#[tauri::command]
pub fn exit_app(app: tauri::AppHandle) {
    app.exit(0);
}

// ============================================================
// Global Shortcuts
// ============================================================

#[tauri::command]
pub fn toggle_window_visibility(app: tauri::AppHandle) {
    use tauri::Manager;
    if let Some(window) = app.get_webview_window("main") {
        match window.is_visible() {
            Ok(false) => {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
            Ok(true) => {
                // If it is visible but minimized, unminimize it
                if let Ok(true) = window.is_minimized() {
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                } else if let Ok(false) = window.is_focused() {
                    // Visible and not minimized, but not focused -> bring to front
                    let _ = window.set_focus();
                } else {
                    // It is visible, not minimized, and focused -> hide it
                    let _ = window.hide();
                }
            }
            Err(_) => {}
        }
    }
}

#[tauri::command]
pub fn register_global_shortcut(app: tauri::AppHandle, shortcut: String) -> Result<(), String> {
    use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

    // Unregister all existing shortcuts
    let _ = app.global_shortcut().unregister_all();

    if shortcut.is_empty() {
        return Ok(());
    }

    let parsed_shortcut = match shortcut.parse::<Shortcut>() {
        Ok(s) => s,
        Err(_) => {
            return Err(format!("Invalid shortcut format: {}", shortcut));
        }
    };

    app.global_shortcut()
        .on_shortcut(parsed_shortcut, move |app, _shortcut, event| {
            if event.state() == ShortcutState::Pressed {
                toggle_window_visibility(app.clone());
            }
        })
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn sync_lock_state(
    lock_i: tauri::State<'_, tauri::menu::MenuItem<tauri::Wry>>,
    state: State<'_, Arc<AppState>>,
    is_locked: bool,
) {
    if is_locked {
        state.session.lock();
        let _ = lock_i.set_text("已锁定 (Locked)");
        let _ = lock_i.set_enabled(false);
    } else {
        let _ = lock_i.set_text("立刻锁定 (Lock)");
        let _ = lock_i.set_enabled(true);
    }
}
