use axum::{
    extract::FromRequestParts,
    http::{request::Parts, StatusCode},
};
use std::sync::Arc;

use crate::commands::AppState;

/// Extractor that validates the Bearer token from the Authorization header.
/// If validation fails, a 401 Unauthorized response is returned automatically.
#[allow(dead_code)]
pub struct BearerAuth(pub String);

impl FromRequestParts<Arc<AppState>> for BearerAuth {
    type Rejection = (StatusCode, &'static str);

    async fn from_request_parts(
        parts: &mut Parts,
        state: &Arc<AppState>,
    ) -> Result<Self, Self::Rejection> {
        let auth_header = parts
            .headers
            .get("Authorization")
            .and_then(|v| v.to_str().ok())
            .ok_or((StatusCode::UNAUTHORIZED, "Missing Authorization header"))?;

        let token = auth_header
            .strip_prefix("Bearer ")
            .ok_or((StatusCode::UNAUTHORIZED, "Invalid Authorization format"))?;

        if !state.session.validate_http_session(token) {
            return Err((StatusCode::UNAUTHORIZED, "Invalid or expired token"));
        }

        Ok(BearerAuth(token.to_string()))
    }
}
