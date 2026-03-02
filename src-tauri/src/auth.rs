/// System authentication module
///
/// In production, this integrates with Windows Hello / UserConsentVerifier
/// to provide PIN/biometric authentication before revealing sensitive data.
///
/// Current implementation: development stub that always succeeds.
/// TODO: Integrate with Windows Hello via `windows-rs` crate:
///   - Windows.Security.Credentials.UI.UserConsentVerifier
///   - RequestVerificationAsync("MagpieAuth requires your identity")

#[cfg(windows)]
use windows::core::HSTRING;
#[cfg(windows)]
use windows::Security::Credentials::UI::{
    UserConsentVerificationResult, UserConsentVerifier, UserConsentVerifierAvailability,
};

/// Verify user identity via system authentication
/// Returns true if authenticated, false otherwise
pub async fn verify_user() -> Result<bool, String> {
    #[cfg(windows)]
    {
        let msg = HSTRING::from("MagpieAuth requires your identity to unlock the secure vault.");
        let future = UserConsentVerifier::RequestVerificationAsync(&msg)
            .map_err(|e| format!("Failed to request verification: {}", e))?;

        let result = future
            .await
            .map_err(|e| format!("Verification await failed: {}", e))?;

        Ok(result == UserConsentVerificationResult::Verified)
    }

    #[cfg(not(windows))]
    {
        // DEV STUB for non-windows
        Ok(true)
    }
}

/// Check if the system supports biometric/PIN authentication
pub async fn is_auth_available() -> bool {
    #[cfg(windows)]
    {
        if let Ok(future) = UserConsentVerifier::CheckAvailabilityAsync() {
            if let Ok(result) = future.await {
                return result == UserConsentVerifierAvailability::Available;
            }
        }
        false
    }

    #[cfg(not(windows))]
    {
        true
    }
}
