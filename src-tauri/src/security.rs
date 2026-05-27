use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

/// Represents an active HTTP bearer token session
#[derive(Debug, Clone)]
pub struct HttpSessionInfo {
    pub created_at: Instant,
    pub ttl: Duration,
}

#[derive(Default)]
pub struct SecuritySession {
    unlocked: Mutex<bool>,
    /// Active HTTP bearer token sessions (token -> session info)
    http_sessions: Mutex<HashMap<String, HttpSessionInfo>>,
}

impl SecuritySession {
    pub fn unlock(&self) {
        if let Ok(mut unlocked) = self.unlocked.lock() {
            *unlocked = true;
        }
    }

    pub fn lock(&self) {
        if let Ok(mut unlocked) = self.unlocked.lock() {
            *unlocked = false;
        }
        // Clear all HTTP sessions on lock
        if let Ok(mut sessions) = self.http_sessions.lock() {
            sessions.clear();
        }
    }

    pub fn require_unlocked(&self) -> Result<(), String> {
        match self.unlocked.lock() {
            Ok(unlocked) if *unlocked => Ok(()),
            Ok(_) => Err("Vault is locked".into()),
            Err(e) => Err(format!("Vault lock state error: {}", e)),
        }
    }

    /// Create a new HTTP session token with the given TTL.
    /// Returns the UUID v4 token string.
    pub fn create_http_session(&self, ttl: Duration) -> Result<String, String> {
        let token = uuid::Uuid::new_v4().to_string();
        let info = HttpSessionInfo {
            created_at: Instant::now(),
            ttl,
        };
        let mut sessions = self
            .http_sessions
            .lock()
            .map_err(|e| format!("Session lock error: {}", e))?;
        sessions.insert(token.clone(), info);
        Ok(token)
    }

    /// Validate an HTTP session token.
    /// Returns true if the token exists, hasn't expired, and the vault is still unlocked.
    /// Expired tokens are removed automatically.
    pub fn validate_http_session(&self, token: &str) -> bool {
        // Must be unlocked
        if self.require_unlocked().is_err() {
            return false;
        }

        let mut sessions = match self.http_sessions.lock() {
            Ok(s) => s,
            Err(_) => return false,
        };

        if let Some(info) = sessions.get(token) {
            if info.created_at.elapsed() < info.ttl {
                return true;
            }
            // Token expired, remove it
            sessions.remove(token);
        }
        false
    }

    /// Remove all expired HTTP sessions (housekeeping)
    #[allow(dead_code)]
    pub fn cleanup_expired_sessions(&self) {
        if let Ok(mut sessions) = self.http_sessions.lock() {
            sessions.retain(|_, info| info.created_at.elapsed() < info.ttl);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn session_starts_locked() {
        let session = SecuritySession::default();

        assert!(session.require_unlocked().is_err());
    }

    #[test]
    fn session_unlock_and_lock_transitions() {
        let session = SecuritySession::default();

        session.unlock();
        assert!(session.require_unlocked().is_ok());

        session.lock();
        assert!(session.require_unlocked().is_err());
    }

    #[test]
    fn http_session_lifecycle() {
        let session = SecuritySession::default();
        session.unlock();

        // Create a session
        let token = session
            .create_http_session(Duration::from_secs(600))
            .unwrap();
        assert!(session.validate_http_session(&token));

        // Lock clears sessions
        session.lock();
        assert!(!session.validate_http_session(&token));
    }

    #[test]
    fn http_session_invalid_token_rejected() {
        let session = SecuritySession::default();
        session.unlock();

        assert!(!session.validate_http_session("nonexistent-token"));
    }

    #[test]
    fn http_session_expired_token_rejected() {
        let session = SecuritySession::default();
        session.unlock();

        let token = session
            .create_http_session(Duration::from_millis(0))
            .unwrap();

        // Token should be expired immediately
        std::thread::sleep(Duration::from_millis(1));
        assert!(!session.validate_http_session(&token));
    }
}
