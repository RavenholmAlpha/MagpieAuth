use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

use crate::{auth, crypto, db, totp};

/// Shared app state holding the database connection and IMK
pub struct AppState {
    pub db: Mutex<rusqlite::Connection>,
    pub imk: [u8; 32],
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
pub fn get_vault_items(state: State<'_, AppState>) -> Result<Vec<db::VaultItemBase>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::get_all_items(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn search_items(
    state: State<'_, AppState>,
    query: String,
) -> Result<Vec<db::VaultItemBase>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::search_items(&conn, &query).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_item(state: State<'_, AppState>, payload: db::ItemPayload) -> Result<String, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::insert_item(&conn, &payload, &state.imk)
}

#[tauri::command]
pub fn update_item(
    state: State<'_, AppState>,
    id: String,
    payload: db::ItemPayload,
) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::update_item(&conn, &id, &payload, &state.imk)
}

#[tauri::command]
pub fn delete_item(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::delete_item(&conn, &id)
}

// ============================================================
// Sensitive Data Access (requires system auth)
// ============================================================

#[tauri::command]
pub fn get_password_plaintext(state: State<'_, AppState>, id: String) -> PasswordResponse {
    // Verify user identity first
    match auth::verify_user() {
        Ok(true) => {}
        Ok(false) => {
            return PasswordResponse {
                success: false,
                plaintext: None,
                error: Some("Authentication denied".into()),
            }
        }
        Err(e) => {
            return PasswordResponse {
                success: false,
                plaintext: None,
                error: Some(format!("Authentication error: {}", e)),
            }
        }
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
        Ok(Some(blob)) => match crypto::decrypt_field(&blob, &state.imk) {
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
pub fn get_totp_code(state: State<'_, AppState>, id: String) -> totp::TotpCodeResponse {
    let conn = match state.db.lock() {
        Ok(c) => c,
        Err(e) => {
            return totp::TotpCodeResponse {
                success: false,
                code: None,
                valid_until: None,
                error: Some(e.to_string()),
            }
        }
    };

    match db::get_encrypted_totp_secret(&conn, &id) {
        Ok(Some(blob)) => match crypto::decrypt_field(&blob, &state.imk) {
            Ok(secret_bytes) => {
                let secret_str = String::from_utf8_lossy(&secret_bytes).to_string();
                totp::generate_totp_code(&secret_str)
            }
            Err(e) => totp::TotpCodeResponse {
                success: false,
                code: None,
                valid_until: None,
                error: Some(e.to_string()),
            },
        },
        Ok(None) => totp::TotpCodeResponse {
            success: false,
            code: None,
            valid_until: None,
            error: Some("No TOTP secret stored for this item".into()),
        },
        Err(e) => totp::TotpCodeResponse {
            success: false,
            code: None,
            valid_until: None,
            error: Some(e),
        },
    }
}

// ============================================================
// System Auth
// ============================================================

#[tauri::command]
pub fn verify_system_auth() -> Result<bool, String> {
    auth::verify_user()
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
    created_at: i64,
    updated_at: i64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExportData {
    version: u32,
    exported_at: i64,
    items: Vec<ExportItem>,
}

#[tauri::command]
pub fn export_vault(
    state: State<'_, AppState>,
    password: String,
    file_path: String,
) -> Result<(), String> {
    // Verify user identity
    match auth::verify_user() {
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
                crypto::decrypt_field(blob, &state.imk)
                    .ok()
                    .map(|b| String::from_utf8_lossy(&b).to_string())
            });

            let totp_secret_plaintext = item.encrypted_totp_secret.as_ref().and_then(|blob| {
                crypto::decrypt_field(blob, &state.imk)
                    .ok()
                    .map(|b| String::from_utf8_lossy(&b).to_string())
            });

            ExportItem {
                id: item.id.clone(),
                title: item.title.clone(),
                account: item.account.clone(),
                password_plaintext,
                totp_secret_plaintext,
                created_at: item.created_at,
                updated_at: item.updated_at,
            }
        })
        .collect();

    let export_data = ExportData {
        version: 1,
        exported_at: chrono::Utc::now().timestamp_millis(),
        items: export_items,
    };

    let json = serde_json::to_vec(&export_data).map_err(|e| e.to_string())?;
    let encrypted = crypto::encrypt_export(&json, &password).map_err(|e| e.to_string())?;

    std::fs::write(&file_path, &encrypted).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn import_vault(
    state: State<'_, AppState>,
    file_path: String,
    password: String,
) -> Result<u32, String> {
    let file_bytes = std::fs::read(&file_path).map_err(|e| e.to_string())?;
    let decrypted = crypto::decrypt_import(&file_bytes, &password).map_err(|e| e.to_string())?;

    let export_data: ExportData =
        serde_json::from_slice(&decrypted).map_err(|e| format!("Invalid backup format: {}", e))?;

    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let mut count = 0u32;

    for item in &export_data.items {
        let payload = db::ItemPayload {
            title: item.title.clone(),
            account: item.account.clone(),
            password: item.password_plaintext.clone(),
            totp_secret: item.totp_secret_plaintext.clone(),
        };
        db::insert_item(&conn, &payload, &state.imk)?;
        count += 1;
    }

    Ok(count)
}
