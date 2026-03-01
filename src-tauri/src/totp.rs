use serde::{Deserialize, Serialize};
use totp_rs::{Algorithm, Secret, TOTP};

/// TOTP code response sent to frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TotpCodeResponse {
    pub success: bool,
    pub code: Option<String>,
    pub valid_until: Option<i64>,
    pub step: Option<u64>,
    pub error: Option<String>,
}

/// Generate a TOTP code from a Base32-encoded secret
pub fn generate_totp_code(secret_base32: &str) -> TotpCodeResponse {
    match generate_totp_internal(secret_base32) {
        Ok((code, valid_until, step)) => TotpCodeResponse {
            success: true,
            code: Some(code),
            valid_until: Some(valid_until),
            step: Some(step),
            error: None,
        },
        Err(e) => TotpCodeResponse {
            success: false,
            code: None,
            valid_until: None,
            step: None,
            error: Some(e),
        },
    }
}

fn generate_totp_internal(secret_str: &str) -> Result<(String, i64, u64), String> {
    let mut raw_secret = secret_str.to_string();
    let mut algorithm = Algorithm::SHA1;
    let mut digits = 6;
    let mut step = 30;

    // If it's a full URI (e.g. from QR scan saved in DB), extract the custom parameters!
    // We parse manually because totp_rs::TOTP::from_url strictly rejects standard 80-bit length secrets.
    if secret_str.starts_with("otpauth://totp/") {
        let without_scheme = &secret_str["otpauth://totp/".len()..];
        let query_part = if let Some(idx) = without_scheme.find('?') {
            &without_scheme[idx + 1..]
        } else {
            ""
        };

        for param in query_part.split('&') {
            if let Some((k, v)) = param.split_once('=') {
                match k {
                    "secret" => raw_secret = v.replace("%3D", "=").replace("%20", ""),
                    "digits" => {
                        if let Ok(d) = v.parse::<usize>() {
                            digits = d;
                        }
                    }
                    "period" => {
                        if let Ok(p) = v.parse::<u64>() {
                            step = p;
                        }
                    }
                    "algorithm" => {
                        algorithm = match v.to_uppercase().as_str() {
                            "SHA256" => Algorithm::SHA256,
                            "SHA512" => Algorithm::SHA512,
                            _ => Algorithm::SHA1,
                        };
                    }
                    _ => {}
                }
            }
        }
    }

    // Remove padding to ensure base32 crate decodes it properly
    let unpadded = raw_secret.trim_end_matches('=');
    let secret_bytes = base32::decode(base32::Alphabet::Rfc4648 { padding: false }, unpadded)
        .ok_or_else(|| "Invalid base32 secret".to_string())?;

    // Use new_unchecked to bypass the strict 128-bit minimum key length check
    // This allows standard 16-char (80-bit) Google Authenticator secrets to work
    let totp = TOTP::new_unchecked(
        algorithm,
        digits,
        1,
        step,
        secret_bytes,
        None,
        String::new(),
    );

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| format!("System time error: {}", e))?;

    let code = totp.generate(now.as_secs());

    // Calculate when this code expires
    let current_step = now.as_secs() / step;
    let valid_until = ((current_step + 1) * step) as i64 * 1000; // in milliseconds

    Ok((code, valid_until, step))
}

/// Parse an otpauth:// URI and extract the secret, issuer, and account
pub fn parse_otpauth_uri(uri: &str) -> Result<(String, Option<String>, Option<String>), String> {
    // Manually parse to avoid TOTP::from_url which enforces 128-bit secret length
    if !uri.starts_with("otpauth://totp/") {
        return Err("Only otpauth://totp/ URIs are supported".into());
    }

    let without_scheme = &uri["otpauth://totp/".len()..];
    let (path_part, query_part) = if let Some(idx) = without_scheme.find('?') {
        (&without_scheme[..idx], &without_scheme[idx + 1..])
    } else {
        (without_scheme, "")
    };

    // Parse path: "Issuer:account" or just "account"
    // URL decoding normally required, but we'll do a simple %20 -> space for basic support
    let path_decoded = path_part.replace("%20", " ");
    let mut issuer_from_path = None;
    let mut account_name = None;

    if let Some((i, a)) = path_decoded.split_once(':') {
        issuer_from_path = Some(i.trim().to_string());
        account_name = Some(a.trim().to_string());
    } else if !path_decoded.is_empty() {
        account_name = Some(path_decoded);
    }

    // Parse query params
    let mut secret = None;
    let mut issuer_from_query = None;

    for param in query_part.split('&') {
        if let Some((k, v)) = param.split_once('=') {
            let val_decoded = v.replace("%20", " ");
            if k == "secret" {
                secret = Some(val_decoded.replace("%3D", "=")); // In case of padding
            } else if k == "issuer" {
                issuer_from_query = Some(val_decoded);
            }
        }
    }

    let secret = secret.ok_or_else(|| "Missing secret parameter in URI".to_string())?;
    // Strip padding and ensure uppercase base32
    let clean_secret = secret.replace('=', "").to_uppercase();

    let issuer = issuer_from_query.or(issuer_from_path);

    Ok((clean_secret, issuer, account_name))
}

/// Get remaining seconds until next TOTP rotation
pub fn get_remaining_seconds() -> u64 {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    30 - (now.as_secs() % 30)
}

// ============================================================
// Unit Tests
// ============================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_otpauth_uri() {
        let uri = "otpauth://totp/Example:alice@google.com?secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP&issuer=Example";
        let (secret, issuer, account) = parse_otpauth_uri(uri).unwrap();
        assert_eq!(secret, "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP");
        assert_eq!(issuer, Some("Example".to_string()));
        assert_eq!(account, Some("alice@google.com".to_string()));
    }

    #[test]
    fn test_generate_totp() {
        let res = generate_totp_code("JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP");
        assert!(res.success);
        assert!(res.code.is_some());
        assert_eq!(res.code.unwrap().len(), 6);
    }
}
