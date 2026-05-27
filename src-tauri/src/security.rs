use std::sync::Mutex;

#[derive(Default)]
pub struct SecuritySession {
    unlocked: Mutex<bool>,
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
    }

    pub fn require_unlocked(&self) -> Result<(), String> {
        match self.unlocked.lock() {
            Ok(unlocked) if *unlocked => Ok(()),
            Ok(_) => Err("Vault is locked".into()),
            Err(e) => Err(format!("Vault lock state error: {}", e)),
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
}
