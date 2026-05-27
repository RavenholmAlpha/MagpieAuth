use rusqlite::{params, Connection};
use serde::{
    de::{Error as DeError, Visitor},
    Deserialize, Deserializer, Serialize, Serializer,
};
use std::fmt;
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

#[derive(Debug, Clone, PartialEq)]
pub enum SecretField {
    Keep,
    Clear,
    Set(String),
}

impl Default for SecretField {
    fn default() -> Self {
        Self::Keep
    }
}

impl Serialize for SecretField {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        match self {
            SecretField::Keep | SecretField::Clear => serializer.serialize_none(),
            SecretField::Set(value) => serializer.serialize_some(value),
        }
    }
}

impl<'de> Deserialize<'de> for SecretField {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        struct SecretFieldVisitor;

        impl<'de> Visitor<'de> for SecretFieldVisitor {
            type Value = SecretField;

            fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
                formatter.write_str("a string, null, or an omitted field")
            }

            fn visit_none<E>(self) -> Result<Self::Value, E>
            where
                E: DeError,
            {
                Ok(SecretField::Clear)
            }

            fn visit_unit<E>(self) -> Result<Self::Value, E>
            where
                E: DeError,
            {
                Ok(SecretField::Clear)
            }

            fn visit_some<D>(self, deserializer: D) -> Result<Self::Value, D::Error>
            where
                D: Deserializer<'de>,
            {
                let value = String::deserialize(deserializer)?;
                Ok(SecretField::Set(value))
            }
        }

        deserializer.deserialize_option(SecretFieldVisitor)
    }
}

/// Payload for creating/updating an item from the frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ItemPayload {
    pub title: String,
    pub account: Option<String>,
    #[serde(default)]
    pub password: SecretField,
    #[serde(default)]
    pub totp_secret: SecretField,
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
         WHERE v.title LIKE ?1 OR v.account LIKE ?1 OR l.name LIKE ?1
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

pub fn has_any_items(conn: &Connection) -> Result<bool, rusqlite::Error> {
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM vault_items", [], |row| row.get(0))?;
    Ok(count > 0)
}

/// Insert a new vault item (encrypts sensitive fields with IMK)
pub fn insert_item(
    conn: &Connection,
    payload: &ItemPayload,
    imk: &[u8; 32],
) -> Result<String, String> {
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp_millis();

    let encrypted_password = encrypt_secret_for_insert(&payload.password, imk, id.as_bytes())?;
    let encrypted_totp_secret =
        encrypt_secret_for_insert(&payload.totp_secret, imk, id.as_bytes())?;

    conn.execute(
        "INSERT INTO vault_items (id, title, account, encrypted_password, encrypted_totp_secret, label_id, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![id, payload.title, payload.account, encrypted_password, encrypted_totp_secret, payload.label_id, now, now],
    ).map_err(|e| e.to_string())?;

    Ok(id)
}

/// Update an existing vault item.
/// Omitted secret fields keep existing values. Null clears a stored secret.
pub fn update_item(
    conn: &Connection,
    id: &str,
    payload: &ItemPayload,
    imk: &[u8; 32],
) -> Result<(), String> {
    let now = chrono::Utc::now().timestamp_millis();

    let (existing_password, existing_totp): (Option<Vec<u8>>, Option<Vec<u8>>) = conn
        .query_row(
            "SELECT encrypted_password, encrypted_totp_secret FROM vault_items WHERE id = ?1",
            params![id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| e.to_string())?;

    let encrypted_password =
        resolve_secret_update(&payload.password, existing_password, imk, id.as_bytes())?;
    let encrypted_totp_secret =
        resolve_secret_update(&payload.totp_secret, existing_totp, imk, id.as_bytes())?;

    conn.execute(
        "UPDATE vault_items SET title = ?1, account = ?2, encrypted_password = ?3, encrypted_totp_secret = ?4, label_id = ?5, updated_at = ?6 WHERE id = ?7",
        params![payload.title, payload.account, encrypted_password, encrypted_totp_secret, payload.label_id, now, id],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

fn encrypt_secret_for_insert(
    secret: &SecretField,
    imk: &[u8; 32],
    aad: &[u8],
) -> Result<Option<Vec<u8>>, String> {
    match secret {
        SecretField::Set(value) if !value.is_empty() => {
            crypto::encrypt_field(value.as_bytes(), imk, aad)
                .map(Some)
                .map_err(|e| e.to_string())
        }
        SecretField::Keep | SecretField::Clear | SecretField::Set(_) => Ok(None),
    }
}

fn resolve_secret_update(
    secret: &SecretField,
    existing: Option<Vec<u8>>,
    imk: &[u8; 32],
    aad: &[u8],
) -> Result<Option<Vec<u8>>, String> {
    match secret {
        SecretField::Keep => Ok(existing),
        SecretField::Clear => Ok(None),
        SecretField::Set(value) if value.is_empty() => Ok(None),
        SecretField::Set(value) => crypto::encrypt_field(value.as_bytes(), imk, aad)
            .map(Some)
            .map_err(|e| e.to_string()),
    }
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

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn test_conn() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE vault_items (
                id                    TEXT PRIMARY KEY NOT NULL,
                title                 TEXT NOT NULL,
                account               TEXT,
                encrypted_password    BLOB,
                encrypted_totp_secret BLOB,
                created_at            INTEGER NOT NULL,
                updated_at            INTEGER NOT NULL,
                label_id              TEXT
            );
            CREATE TABLE labels (
                id         TEXT PRIMARY KEY NOT NULL,
                name       TEXT NOT NULL,
                color      TEXT NOT NULL,
                created_at INTEGER NOT NULL
            );",
        )
        .unwrap();
        conn
    }
    #[test]
    fn update_item_keeps_secret_fields_when_payload_omits_them() {
        let conn = test_conn();
        let imk = *generate_test_key();
        let item_id = insert_item(
            &conn,
            &serde_json::from_value(json!({
                "title": "GitHub",
                "account": "alice",
                "password": "old-password",
                "totpSecret": "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP",
                "labelId": null
            }))
            .unwrap(),
            &imk,
        )
        .unwrap();

        let payload: ItemPayload = serde_json::from_value(json!({
            "title": "GitHub Updated",
            "account": "alice",
            "labelId": null
        }))
        .unwrap();
        update_item(&conn, &item_id, &payload, &imk).unwrap();

        assert!(get_encrypted_password(&conn, &item_id).unwrap().is_some());
        assert!(get_encrypted_totp_secret(&conn, &item_id)
            .unwrap()
            .is_some());
    }

    #[test]
    fn update_item_clears_secret_fields_when_payload_sets_null() {
        let conn = test_conn();
        let imk = *generate_test_key();
        let item_id = insert_item(
            &conn,
            &serde_json::from_value(json!({
                "title": "GitHub",
                "account": "alice",
                "password": "old-password",
                "totpSecret": "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP",
                "labelId": null
            }))
            .unwrap(),
            &imk,
        )
        .unwrap();

        let payload: ItemPayload = serde_json::from_value(json!({
            "title": "GitHub",
            "account": "alice",
            "password": null,
            "totpSecret": null,
            "labelId": null
        }))
        .unwrap();
        update_item(&conn, &item_id, &payload, &imk).unwrap();

        assert!(get_encrypted_password(&conn, &item_id).unwrap().is_none());
        assert!(get_encrypted_totp_secret(&conn, &item_id)
            .unwrap()
            .is_none());
    }

    fn generate_test_key() -> zeroize::Zeroizing<[u8; 32]> {
        crate::crypto::generate_imk()
    }
}
