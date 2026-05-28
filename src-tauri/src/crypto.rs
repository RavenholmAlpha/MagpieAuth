use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use argon2::Argon2;
use rand::RngCore;
use std::path::Path;
use zeroize::Zeroizing;

/// Error type for crypto operations
#[derive(Debug, thiserror::Error)]
pub enum CryptoError {
    #[error("Encryption failed: {0}")]
    EncryptionFailed(String),
    #[error("Decryption failed: {0}")]
    DecryptionFailed(String),
    #[error("Key derivation failed: {0}")]
    KeyDerivationFailed(String),
    #[error("Credential store error: {0}")]
    CredentialError(String),
}

// ============================================================
// Internal Master Key (IMK) Management
// ============================================================

/// Generate a new 256-bit Internal Master Key (wrapped in Zeroizing for auto-cleanup)
pub fn generate_imk() -> Zeroizing<[u8; 32]> {
    let mut key = Zeroizing::new([0u8; 32]);
    OsRng.fill_bytes(key.as_mut());
    key
}

#[cfg(windows)]
use windows::Win32::Security::Cryptography::{
    CryptProtectData, CryptUnprotectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
};

/// Store IMK using Windows DPAPI to a local file
pub fn store_imk(key: &[u8; 32]) -> Result<(), CryptoError> {
    let app_data =
        dirs::data_dir().ok_or_else(|| CryptoError::CredentialError("No app data dir".into()))?;
    let key_path = app_data.join("MagpieAuth").join(".imk_dpapi");

    std::fs::create_dir_all(key_path.parent().unwrap())
        .map_err(|e| CryptoError::CredentialError(e.to_string()))?;

    #[cfg(windows)]
    {
        let data_in = CRYPT_INTEGER_BLOB {
            cbData: key.len() as u32,
            pbData: key.as_ptr() as *mut u8,
        };
        let mut data_out = CRYPT_INTEGER_BLOB {
            cbData: 0,
            pbData: std::ptr::null_mut(),
        };

        // SAFETY: We provide valid pointers to CryptProtectData structure
        let res = unsafe {
            CryptProtectData(
                &data_in,
                None, // No description
                None, // No entropy
                None, // No reserved
                None, // No prompt struct
                CRYPTPROTECT_UI_FORBIDDEN,
                &mut data_out,
            )
        };

        if res.is_ok() {
            // Read output buffer
            let encrypted_data =
                unsafe { std::slice::from_raw_parts(data_out.pbData, data_out.cbData as usize) };

            // Base64 encode it for safe text storage
            use base64::{engine::general_purpose, Engine as _};
            let b64 = general_purpose::STANDARD.encode(encrypted_data);

            // Free the memory allocated by CryptProtectData
            unsafe {
                let _ = windows::Win32::Foundation::LocalFree(windows::Win32::Foundation::HLOCAL(
                    data_out.pbData as *mut core::ffi::c_void,
                ));
            }

            std::fs::write(&key_path, b64)
                .map_err(|e| CryptoError::CredentialError(e.to_string()))?;
            Ok(())
        } else {
            Err(CryptoError::CredentialError(
                "DPAPI Protection Failed".into(),
            ))
        }
    }

    #[cfg(not(windows))]
    {
        use base64::{engine::general_purpose, Engine as _};
        let b64 = general_purpose::STANDARD.encode(key);
        std::fs::write(&key_path, b64).map_err(|e| CryptoError::CredentialError(e.to_string()))?;
        Ok(())
    }
}

/// Retrieve IMK from DPAPI storage (wrapped in Zeroizing for auto-cleanup)
pub fn retrieve_imk() -> Result<[u8; 32], CryptoError> {
    let app_data =
        dirs::data_dir().ok_or_else(|| CryptoError::CredentialError("No app data dir".into()))?;
    let magpie_dir = app_data.join("MagpieAuth");
    let key_path = magpie_dir.join(".imk_dpapi");
    let vault_path = magpie_dir.join("vault.db");

    if key_path.exists() {
        let file_data = std::fs::read_to_string(&key_path)
            .map_err(|e| CryptoError::CredentialError(e.to_string()))?;

        use base64::{engine::general_purpose, Engine as _};
        if let Ok(encrypted_data) = general_purpose::STANDARD.decode(file_data.trim()) {
            #[cfg(windows)]
            {
                let data_in = CRYPT_INTEGER_BLOB {
                    cbData: encrypted_data.len() as u32,
                    pbData: encrypted_data.as_ptr() as *mut u8,
                };
                let mut data_out = CRYPT_INTEGER_BLOB {
                    cbData: 0,
                    pbData: std::ptr::null_mut(),
                };

                let res = unsafe {
                    CryptUnprotectData(
                        &data_in,
                        None,
                        None,
                        None,
                        None,
                        CRYPTPROTECT_UI_FORBIDDEN,
                        &mut data_out,
                    )
                };

                if res.is_ok() {
                    let decrypted_data = unsafe {
                        std::slice::from_raw_parts(data_out.pbData, data_out.cbData as usize)
                    };

                    if decrypted_data.len() == 32 {
                        let mut key = [0u8; 32];
                        key.copy_from_slice(decrypted_data);

                        unsafe {
                            let _ = windows::Win32::Foundation::LocalFree(
                                windows::Win32::Foundation::HLOCAL(
                                    data_out.pbData as *mut core::ffi::c_void,
                                ),
                            );
                        }

                        return Ok(key);
                    }

                    unsafe {
                        let _ = windows::Win32::Foundation::LocalFree(
                            windows::Win32::Foundation::HLOCAL(
                                data_out.pbData as *mut core::ffi::c_void,
                            ),
                        );
                    }
                }
            }

            #[cfg(not(windows))]
            {
                if encrypted_data.len() == 32 {
                    let mut key = [0u8; 32];
                    key.copy_from_slice(&encrypted_data);
                    return Ok(key);
                }
            }
        }
    }

    ensure_can_generate_new_imk(&vault_path)?;

    // First run: generate and store a new IMK only when no vault exists yet.
    let imk = generate_imk();
    store_imk(&imk)?;
    Ok(*imk)
}

fn ensure_can_generate_new_imk(vault_path: &Path) -> Result<(), CryptoError> {
    if vault_path.exists() {
        return Err(CryptoError::CredentialError(
            "Internal Master Key is unavailable while vault database exists; refusing to generate a new key".into(),
        ));
    }

    Ok(())
}

// ============================================================
// Pattern Lock Management (Argon2id Hash Storage)
// ============================================================

/// Hash a pattern string (e.g., "[0,1,5,9]") using Argon2id with a random salt
pub fn hash_pattern(pattern: &str) -> Result<String, CryptoError> {
    let mut salt = [0u8; 16];
    OsRng.fill_bytes(&mut salt);

    let params = argon2::Params::new(65536, 3, 4, Some(32))
        .map_err(|e| CryptoError::KeyDerivationFailed(e.to_string()))?;
    let argon2 = Argon2::new(argon2::Algorithm::Argon2id, argon2::Version::V0x13, params);

    let mut hash = [0u8; 32];
    argon2
        .hash_password_into(pattern.as_bytes(), &salt, &mut hash)
        .map_err(|e| CryptoError::KeyDerivationFailed(e.to_string()))?;

    // Combine salt and hash into a single hex string for easy storage
    let salt_hex = hex::encode(salt);
    let hash_hex = hex::encode(hash);
    Ok(format!("{}:{}", salt_hex, hash_hex))
}

/// Verify a pattern string against a stored hash
pub fn verify_pattern(pattern: &str, stored_hash: &str) -> Result<bool, CryptoError> {
    let parts: Vec<&str> = stored_hash.split(':').collect();
    if parts.len() != 2 {
        return Ok(false);
    }

    let salt = hex::decode(parts[0]).unwrap_or_default();
    let expected_hash = hex::decode(parts[1]).unwrap_or_default();

    if salt.len() != 16 || expected_hash.len() != 32 {
        return Ok(false);
    }

    let params = argon2::Params::new(65536, 3, 4, Some(32))
        .map_err(|e| CryptoError::KeyDerivationFailed(e.to_string()))?;
    let argon2 = Argon2::new(argon2::Algorithm::Argon2id, argon2::Version::V0x13, params);

    let mut actual_hash = [0u8; 32];
    argon2
        .hash_password_into(pattern.as_bytes(), &salt, &mut actual_hash)
        .map_err(|e| CryptoError::KeyDerivationFailed(e.to_string()))?;

    Ok(actual_hash == expected_hash.as_slice())
}

/// Store the pattern hash in AppData
pub fn store_pattern(hash: &str) -> Result<(), CryptoError> {
    let app_data =
        dirs::data_dir().ok_or_else(|| CryptoError::CredentialError("No app data dir".into()))?;
    let key_path = app_data.join("MagpieAuth").join(".pattern");
    std::fs::create_dir_all(key_path.parent().unwrap())
        .map_err(|e| CryptoError::CredentialError(e.to_string()))?;
    std::fs::write(&key_path, hash).map_err(|e| CryptoError::CredentialError(e.to_string()))?;
    Ok(())
}

/// Retrieve the pattern hash from AppData (returns None if not set)
pub fn retrieve_pattern() -> Result<Option<String>, CryptoError> {
    let app_data =
        dirs::data_dir().ok_or_else(|| CryptoError::CredentialError("No app data dir".into()))?;
    let key_path = app_data.join("MagpieAuth").join(".pattern");

    if !key_path.exists() {
        return Ok(None);
    }

    let data = std::fs::read_to_string(&key_path)
        .map_err(|e| CryptoError::CredentialError(e.to_string()))?;
    Ok(Some(data.trim().to_string()))
}

// ============================================================
// Field-Level AES-256-GCM Encryption
// ============================================================

/// Encrypt a plaintext field using AES-256-GCM
/// Returns: [Nonce 12B][Tag 16B][Ciphertext]
pub fn encrypt_field(plaintext: &[u8], imk: &[u8; 32], aad: &[u8]) -> Result<Vec<u8>, CryptoError> {
    let cipher =
        Aes256Gcm::new_from_slice(imk).map_err(|e| CryptoError::EncryptionFailed(e.to_string()))?;

    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let payload = aes_gcm::aead::Payload {
        msg: plaintext,
        aad,
    };

    let ciphertext = cipher
        .encrypt(nonce, payload)
        .map_err(|e| CryptoError::EncryptionFailed(e.to_string()))?;

    // AES-GCM appends the tag to ciphertext by default in aes-gcm crate
    // The output format is: [Nonce 12B][Ciphertext+Tag]
    let mut result = Vec::with_capacity(12 + ciphertext.len());
    result.extend_from_slice(&nonce_bytes);
    result.extend_from_slice(&ciphertext);

    Ok(result)
}

/// Decrypt a field encrypted with encrypt_field
/// Input format: [Nonce 12B][Ciphertext+Tag]
pub fn decrypt_field(blob: &[u8], imk: &[u8; 32], aad: &[u8]) -> Result<Vec<u8>, CryptoError> {
    if blob.len() < 12 {
        return Err(CryptoError::DecryptionFailed("Data too short".into()));
    }

    let cipher =
        Aes256Gcm::new_from_slice(imk).map_err(|e| CryptoError::DecryptionFailed(e.to_string()))?;

    let nonce = Nonce::from_slice(&blob[..12]);
    let ciphertext = &blob[12..];

    let payload = aes_gcm::aead::Payload {
        msg: ciphertext,
        aad,
    };

    cipher
        .decrypt(nonce, payload)
        .map_err(|e| CryptoError::DecryptionFailed(e.to_string()))
}

// ============================================================
// Export/Import Encryption (Argon2id + AES-256-GCM)
// ============================================================

/// Derive an export encryption key from password + salt using Argon2id
pub fn derive_export_key(password: &[u8], salt: &[u8; 16]) -> Result<[u8; 32], CryptoError> {
    let params = argon2::Params::new(65536, 3, 4, Some(32))
        .map_err(|e| CryptoError::KeyDerivationFailed(e.to_string()))?;
    let argon2 = Argon2::new(argon2::Algorithm::Argon2id, argon2::Version::V0x13, params);

    let mut key = [0u8; 32];
    argon2
        .hash_password_into(password, salt, &mut key)
        .map_err(|e| CryptoError::KeyDerivationFailed(e.to_string()))?;

    Ok(key)
}

/// Encrypt export data: returns [Salt 16B][Nonce 12B][Ciphertext+Tag]
pub fn encrypt_export(plaintext_json: &[u8], password: &str) -> Result<Vec<u8>, CryptoError> {
    let mut salt = [0u8; 16];
    OsRng.fill_bytes(&mut salt);

    let key = derive_export_key(password.as_bytes(), &salt)?;

    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|e| CryptoError::EncryptionFailed(e.to_string()))?;

    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plaintext_json)
        .map_err(|e| CryptoError::EncryptionFailed(e.to_string()))?;

    // Format: [Salt 16B][Nonce 12B][Ciphertext+Tag]
    let mut result = Vec::with_capacity(16 + 12 + ciphertext.len());
    result.extend_from_slice(&salt);
    result.extend_from_slice(&nonce_bytes);
    result.extend_from_slice(&ciphertext);

    Ok(result)
}

/// Decrypt import data: input format [Salt 16B][Nonce 12B][Ciphertext+Tag]
pub fn decrypt_import(file_bytes: &[u8], password: &str) -> Result<Vec<u8>, CryptoError> {
    if file_bytes.len() < 28 {
        return Err(CryptoError::DecryptionFailed("File too short".into()));
    }

    let mut salt = [0u8; 16];
    salt.copy_from_slice(&file_bytes[..16]);

    let nonce = Nonce::from_slice(&file_bytes[16..28]);
    let ciphertext = &file_bytes[28..];

    let key = derive_export_key(password.as_bytes(), &salt)?;

    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|e| CryptoError::DecryptionFailed(e.to_string()))?;

    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_e| CryptoError::DecryptionFailed("Wrong password or corrupted file".into()))?;

    Ok(plaintext)
}

// ============================================================
// Unit Tests
// ============================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        let imk = generate_imk();
        let plaintext = b"Hello, MagpieAuth!";
        let aad = b"test_id";
        let encrypted = encrypt_field(plaintext, &imk, aad).expect("encryption failed");
        let decrypted = decrypt_field(&encrypted, &imk, aad).expect("decryption failed");
        assert_eq!(plaintext.to_vec(), decrypted);
    }

    #[test]
    fn test_encrypt_different_nonces() {
        let imk = generate_imk();
        let plaintext = b"same text";
        let aad = b"id_123";
        let enc1 = encrypt_field(plaintext, &imk, aad).unwrap();
        let enc2 = encrypt_field(plaintext, &imk, aad).unwrap();
        // Different nonces → different ciphertext
        assert_ne!(enc1, enc2);
        // But both decrypt to the same plaintext
        assert_eq!(decrypt_field(&enc1, &imk, aad).unwrap(), plaintext.to_vec());
        assert_eq!(decrypt_field(&enc2, &imk, aad).unwrap(), plaintext.to_vec());
    }

    #[test]
    fn test_wrong_key_fails() {
        let imk1 = generate_imk();
        let imk2 = generate_imk();
        let aad = b"id";
        let encrypted = encrypt_field(b"secret", &imk1, aad).unwrap();
        let result = decrypt_field(&encrypted, &imk2, aad);
        assert!(result.is_err());
    }

    #[test]
    fn test_short_blob_fails() {
        let imk = generate_imk();
        let result = decrypt_field(&[0u8; 5], &imk, b"id");
        assert!(result.is_err());
    }

    #[test]
    fn test_export_import_roundtrip() {
        let data = b"{\"items\":[]}";
        let password = "test_password_123";
        let encrypted = encrypt_export(data, password).expect("export encryption failed");
        let decrypted = decrypt_import(&encrypted, password).expect("import decryption failed");
        assert_eq!(data.to_vec(), decrypted);
    }

    #[test]
    fn test_export_wrong_password_fails() {
        let data = b"{\"items\":[]}";
        let encrypted = encrypt_export(data, "correct_password").unwrap();
        let result = decrypt_import(&encrypted, "wrong_password");
        assert!(result.is_err());
    }

    #[test]
    fn test_empty_plaintext() {
        let imk = generate_imk();
        let encrypted = encrypt_field(b"", &imk, b"id").expect("encryption failed");
        let decrypted = decrypt_field(&encrypted, &imk, b"id").expect("decryption failed");
        assert_eq!(decrypted, b"".to_vec());
    }

    #[test]
    fn test_no_aad_ciphertext_is_rejected_when_aad_is_required() {
        let imk = generate_imk();
        let cipher = Aes256Gcm::new_from_slice(&*imk).unwrap();
        let nonce_bytes = [7u8; 12];
        let nonce = Nonce::from_slice(&nonce_bytes);
        let ciphertext = cipher
            .encrypt(
                nonce,
                aes_gcm::aead::Payload {
                    msg: b"secret",
                    aad: b"",
                },
            )
            .unwrap();
        let mut blob = Vec::with_capacity(12 + ciphertext.len());
        blob.extend_from_slice(&nonce_bytes);
        blob.extend_from_slice(&ciphertext);

        let result = decrypt_field(&blob, &imk, b"item-id");

        assert!(result.is_err());
    }

    #[test]
    fn refuses_to_generate_new_imk_when_vault_db_already_exists() {
        let dir = std::env::temp_dir().join(format!("magpieauth-imk-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let vault_path = dir.join("vault.db");
        std::fs::write(&vault_path, b"existing vault").unwrap();

        let err = ensure_can_generate_new_imk(&vault_path).unwrap_err();

        assert!(err.to_string().contains("vault database exists"));
        let _ = std::fs::remove_dir_all(&dir);
    }
}
