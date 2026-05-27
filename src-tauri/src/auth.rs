//! System authentication module.
//!
//! In production, this integrates with Windows Hello / UserConsentVerifier
//! to provide PIN/biometric authentication before revealing sensitive data.

#[cfg(windows)]
use windows::core::HSTRING;
#[cfg(windows)]
use windows::Security::Credentials::UI::{
    UserConsentVerificationResult, UserConsentVerifier, UserConsentVerifierAvailability,
};

#[cfg(windows)]
use windows::Win32::System::WinRT::IUserConsentVerifierInterop;

/// Verify user identity via system authentication
/// Returns true if authenticated, false otherwise
pub async fn verify_user(window: tauri::Window) -> Result<bool, String> {
    #[cfg(windows)]
    {
        let msg = HSTRING::from("MagpieAuth requires your identity to unlock the secure vault.");
        let hwnd_raw = window
            .hwnd()
            .map_err(|e| format!("Get HWND error: {}", e))?;
        let hwnd = windows::Win32::Foundation::HWND(hwnd_raw.0 as isize);

        // First attempt proper interop
        let interop_future = if let Ok(factory) =
            windows::core::factory::<UserConsentVerifier, IUserConsentVerifierInterop>()
        {
            unsafe { factory.RequestVerificationForWindowAsync(hwnd, &msg).ok() }
        } else {
            None
        };

        if let Some(future) = interop_future {
            let future: windows::Foundation::IAsyncOperation<UserConsentVerificationResult> =
                future;
            let result = future
                .await
                .map_err(|e| format!("Verification await failed: {}", e))?;
            return Ok(result == UserConsentVerificationResult::Verified);
        }

        // Fallback to standard request if Interop fails
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
