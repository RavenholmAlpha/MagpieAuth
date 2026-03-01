use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use uuid::Uuid;

use crate::crypto;

/// Represents a custom account label
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Label {
    pub id: String,
    pub name: String,
    pub color: String,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LabelPayload {
    pub name: String,
    pub color: String,
}

/// Represents a vault item as stored in the database
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultItem {
    pub id: String,
    pub title: String,
    pub account: Option<String>,
    pub encrypted_password: Option<Vec<u8>>,
    pub encrypted_totp_secret: Option<Vec<u8>>,
    pub label_id: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

/// Lightweight view sent to the frontend (no sensitive fields)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultItemBase {
    pub id: String,
    pub title: String,
    pub account: Option<String>,
    pub label_id: Option<String>,
    pub label_name: Option<String>,
    pub label_color: Option<String>,
    pub has_password: bool,
    pub has_totp: bool,
    pub created_at: i64,
    pub updated_at: i64,
}

/// Payload for creating/updating an item from the frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ItemPayload {
    pub title: String,
    pub account: Option<String>,
    pub password: Option<String>,
    pub totp_secret: Option<String>,
    pub label_id: Option<String>,
}

/// Get the database file path
pub fn get_db_path() -> PathBuf {
    let app_data = dirs::data_dir().expect("Failed to resolve app data directory");
    let magpie_dir = app_data.join("MagpieAuth");
    std::fs::create_dir_all(&magpie_dir).expect("Failed to create MagpieAuth data directory");
    magpie_dir.join("vault.db")
}

/// Initialize the database, creating tables if they don't exist
pub fn init_db() -> Result<Connection, rusqlite::Error> {
    let db_path = get_db_path();
    let conn = Connection::open(&db_path)?;

    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS vault_items (
            id                    TEXT PRIMARY KEY NOT NULL,
            title                 TEXT NOT NULL,
            account               TEXT,
            encrypted_password    BLOB,
            encrypted_totp_secret BLOB,
            created_at            INTEGER NOT NULL,
            updated_at            INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS labels (
            id         TEXT PRIMARY KEY NOT NULL,
            name       TEXT NOT NULL,
            color      TEXT NOT NULL,
            created_at INTEGER NOT NULL
        );",
    )?;

    // Safe migration: Add label_id to vault_items if it doesn't exist
    let _ = conn.execute("ALTER TABLE vault_items ADD COLUMN label_id TEXT", []);

    Ok(conn)
}

/// Get all vault items as base summaries (no sensitive data)
pub fn get_all_items(conn: &Connection) -> Result<Vec<VaultItemBase>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT v.id, v.title, v.account, v.encrypted_password IS NOT NULL, v.encrypted_totp_secret IS NOT NULL, v.created_at, v.updated_at, v.label_id, l.name, l.color
         FROM vault_items v
         LEFT JOIN labels l ON v.label_id = l.id
         ORDER BY v.updated_at DESC"
    )?;

    let items = stmt
        .query_map([], |row| {
            Ok(VaultItemBase {
                id: row.get(0)?,
                title: row.get(1)?,
                account: row.get(2)?,
                has_password: row.get(3)?,
                has_totp: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
                label_id: row.get(7)?,
                label_name: row.get(8)?,
                label_color: row.get(9)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(items)
}

/// Search items by title or account
pub fn search_items(conn: &Connection, query: &str) -> Result<Vec<VaultItemBase>, rusqlite::Error> {
    let pattern = format!("%{}%", query);
    let mut stmt = conn.prepare(
        "SELECT v.id, v.title, v.account, v.encrypted_password IS NOT NULL, v.encrypted_totp_secret IS NOT NULL, v.created_at, v.updated_at, v.label_id, l.name, l.color
         FROM vault_items v
         LEFT JOIN labels l ON v.label_id = l.id
         WHERE v.title LIKE ?1 OR v.account LIKE ?1
         ORDER BY v.updated_at DESC"
    )?;

    let items = stmt
        .query_map(params![pattern], |row| {
            Ok(VaultItemBase {
                id: row.get(0)?,
                title: row.get(1)?,
                account: row.get(2)?,
                has_password: row.get(3)?,
                has_totp: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
                label_id: row.get(7)?,
                label_name: row.get(8)?,
                label_color: row.get(9)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(items)
}

/// Insert a new vault item (encrypts sensitive fields with IMK)
pub fn insert_item(
    conn: &Connection,
    payload: &ItemPayload,
    imk: &[u8; 32],
) -> Result<String, String> {
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp_millis();

    let encrypted_password = match &payload.password {
        Some(pw) if !pw.is_empty() => Some(
            crypto::encrypt_field(pw.as_bytes(), imk, id.as_bytes()).map_err(|e| e.to_string())?,
        ),
        _ => None,
    };

    let encrypted_totp_secret = match &payload.totp_secret {
        Some(secret) if !secret.is_empty() => Some(
            crypto::encrypt_field(secret.as_bytes(), imk, id.as_bytes())
                .map_err(|e| e.to_string())?,
        ),
        _ => None,
    };

    conn.execute(
        "INSERT INTO vault_items (id, title, account, encrypted_password, encrypted_totp_secret, label_id, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![id, payload.title, payload.account, encrypted_password, encrypted_totp_secret, payload.label_id, now, now],
    ).map_err(|e| e.to_string())?;

    Ok(id)
}

/// Update an existing vault item
/// If password or totp_secret is None/empty in payload, keep existing values
pub fn update_item(
    conn: &Connection,
    id: &str,
    payload: &ItemPayload,
    imk: &[u8; 32],
) -> Result<(), String> {
    let now = chrono::Utc::now().timestamp_millis();

    // Only update password if a new one is provided
    let has_new_password = payload.password.as_ref().map_or(false, |p| !p.is_empty());
    let has_new_totp = payload
        .totp_secret
        .as_ref()
        .map_or(false, |t| !t.is_empty());

    if has_new_password && has_new_totp {
        let enc_pw = crypto::encrypt_field(
            payload.password.as_ref().unwrap().as_bytes(),
            imk,
            id.as_bytes(),
        )
        .map_err(|e| e.to_string())?;
        let enc_totp = crypto::encrypt_field(
            payload.totp_secret.as_ref().unwrap().as_bytes(),
            imk,
            id.as_bytes(),
        )
        .map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE vault_items SET title = ?1, account = ?2, encrypted_password = ?3, encrypted_totp_secret = ?4, label_id = ?5, updated_at = ?6 WHERE id = ?7",
            params![payload.title, payload.account, enc_pw, enc_totp, payload.label_id, now, id],
        ).map_err(|e| e.to_string())?;
    } else if has_new_password {
        let enc_pw = crypto::encrypt_field(
            payload.password.as_ref().unwrap().as_bytes(),
            imk,
            id.as_bytes(),
        )
        .map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE vault_items SET title = ?1, account = ?2, encrypted_password = ?3, label_id = ?4, updated_at = ?5 WHERE id = ?6",
            params![payload.title, payload.account, enc_pw, payload.label_id, now, id],
        ).map_err(|e| e.to_string())?;
    } else if has_new_totp {
        let enc_totp = crypto::encrypt_field(
            payload.totp_secret.as_ref().unwrap().as_bytes(),
            imk,
            id.as_bytes(),
        )
        .map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE vault_items SET title = ?1, account = ?2, encrypted_totp_secret = ?3, label_id = ?4, updated_at = ?5 WHERE id = ?6",
            params![payload.title, payload.account, enc_totp, payload.label_id, now, id],
        ).map_err(|e| e.to_string())?;
    } else {
        // Only update title, account, label, and timestamp — keep encrypted fields
        conn.execute(
            "UPDATE vault_items SET title = ?1, account = ?2, label_id = ?3, updated_at = ?4 WHERE id = ?5",
            params![payload.title, payload.account, payload.label_id, now, id],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}

/// Delete a vault item by ID
pub fn delete_item(conn: &Connection, id: &str) -> Result<(), String> {
    conn.execute("DELETE FROM vault_items WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Get encrypted password blob for a specific item
pub fn get_encrypted_password(conn: &Connection, id: &str) -> Result<Option<Vec<u8>>, String> {
    let result = conn
        .query_row(
            "SELECT encrypted_password FROM vault_items WHERE id = ?1",
            params![id],
            |row| row.get::<_, Option<Vec<u8>>>(0),
        )
        .map_err(|e| e.to_string())?;
    Ok(result)
}

/// Get encrypted TOTP secret blob for a specific item
pub fn get_encrypted_totp_secret(conn: &Connection, id: &str) -> Result<Option<Vec<u8>>, String> {
    let result = conn
        .query_row(
            "SELECT encrypted_totp_secret FROM vault_items WHERE id = ?1",
            params![id],
            |row| row.get::<_, Option<Vec<u8>>>(0),
        )
        .map_err(|e| e.to_string())?;
    Ok(result)
}

/// Get all full vault items (for export — already encrypted blobs)
pub fn get_all_full_items(conn: &Connection) -> Result<Vec<VaultItem>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, title, account, encrypted_password, encrypted_totp_secret, label_id, created_at, updated_at
         FROM vault_items ORDER BY created_at ASC"
    )?;

    let items = stmt
        .query_map([], |row| {
            Ok(VaultItem {
                id: row.get(0)?,
                title: row.get(1)?,
                account: row.get(2)?,
                encrypted_password: row.get(3)?,
                encrypted_totp_secret: row.get(4)?,
                label_id: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(items)
}

// ============================================================
// Label CRUD
// ============================================================

pub fn get_all_labels(conn: &Connection) -> Result<Vec<Label>, rusqlite::Error> {
    let mut stmt =
        conn.prepare("SELECT id, name, color, created_at FROM labels ORDER BY name ASC")?;

    let labels = stmt
        .query_map([], |row| {
            Ok(Label {
                id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
                created_at: row.get(3)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(labels)
}

pub fn insert_label(conn: &Connection, payload: &LabelPayload) -> Result<String, String> {
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp_millis();

    conn.execute(
        "INSERT INTO labels (id, name, color, created_at) VALUES (?1, ?2, ?3, ?4)",
        params![id, payload.name, payload.color, now],
    )
    .map_err(|e| e.to_string())?;

    Ok(id)
}

pub fn update_label(conn: &Connection, id: &str, payload: &LabelPayload) -> Result<(), String> {
    conn.execute(
        "UPDATE labels SET name = ?1, color = ?2 WHERE id = ?3",
        params![payload.name, payload.color, id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

pub fn delete_label(conn: &Connection, id: &str) -> Result<(), String> {
    // We should also clear the label_id from any vault items using this label
    conn.execute(
        "UPDATE vault_items SET label_id = NULL WHERE label_id = ?1",
        params![id],
    )
    .map_err(|e| e.to_string())?;

    conn.execute("DELETE FROM labels WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    Ok(())
}
