use axum::{
    extract::{Path, Query, State},
    http::{HeaderValue, Method},
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Duration;
use tower_http::cors::CorsLayer;

use crate::commands::AppState;
use crate::http_auth::BearerAuth;
use crate::{crypto, db, totp};

/// HTTP server listen address (loopback only for security)
const LISTEN_ADDR: &str = "127.0.0.1:19826";

/// Default token TTL: 10 minutes
const TOKEN_TTL_SECS: u64 = 600;

// ============================================================
// Request / Response Types
// ============================================================

#[derive(Serialize)]
struct StatusResponse {
    ok: bool,
    unlocked: bool,
    version: &'static str,
}

#[derive(Deserialize)]
struct PatternAuthRequest {
    pattern: String,
}

#[derive(Serialize)]
struct AuthResponse {
    success: bool,
    token: Option<String>,
    error: Option<String>,
}

#[derive(Serialize)]
struct ErrorResponse {
    error: String,
}

#[derive(Deserialize)]
struct SearchQuery {
    q: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PasswordPlaintextResponse {
    success: bool,
    plaintext: Option<String>,
    error: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct TotpResponse {
    success: bool,
    code: Option<String>,
    remaining: Option<u64>,
    error: Option<String>,
}

#[derive(Serialize)]
struct RemainingResponse {
    remaining: u64,
}

// ============================================================
// Server Startup
// ============================================================

/// Start the HTTP API server.
/// If port binding fails, logs an error but does NOT panic.
pub async fn start_http_server(state: Arc<AppState>) {
    let cors = CorsLayer::new()
        .allow_origin(tower_http::cors::AllowOrigin::predicate(
            |origin: &HeaderValue, _request_parts: &_| {
                origin
                    .to_str()
                    .map(|s| s.starts_with("chrome-extension://"))
                    .unwrap_or(false)
            },
        ))
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers(tower_http::cors::Any);

    let app = Router::new()
        // Public endpoints (no token required)
        .route("/api/status", get(handle_status))
        .route("/api/auth/pattern", post(handle_pattern_auth))
        // Protected endpoints (require Bearer token)
        .route("/api/vault/items", get(handle_get_vault_items))
        .route("/api/vault/search", get(handle_search_items))
        .route(
            "/api/vault/items/{id}/password",
            get(handle_get_password),
        )
        .route("/api/vault/items/{id}/totp", get(handle_get_totp))
        .route("/api/totp/remaining", get(handle_totp_remaining))
        .layer(cors)
        .with_state(state);

    let listener = match tokio::net::TcpListener::bind(LISTEN_ADDR).await {
        Ok(l) => l,
        Err(e) => {
            eprintln!(
                "[MagpieAuth HTTP] Failed to bind to {}: {}. Browser extension API will be unavailable.",
                LISTEN_ADDR, e
            );
            return;
        }
    };

    eprintln!(
        "[MagpieAuth HTTP] API server listening on {}",
        LISTEN_ADDR
    );

    if let Err(e) = axum::serve(listener, app).await {
        eprintln!("[MagpieAuth HTTP] Server error: {}", e);
    }
}

// ============================================================
// Route Handlers — Public
// ============================================================

/// GET /api/status — Check connection and lock status (no auth required)
async fn handle_status(State(state): State<Arc<AppState>>) -> Json<StatusResponse> {
    let unlocked = state.session.require_unlocked().is_ok();
    Json(StatusResponse {
        ok: true,
        unlocked,
        version: env!("CARGO_PKG_VERSION"),
    })
}

/// POST /api/auth/pattern — Authenticate with pattern, returns bearer token
async fn handle_pattern_auth(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<PatternAuthRequest>,
) -> Json<AuthResponse> {
    // Rate limiting: reject if too many failed attempts
    if let Err(remaining_secs) = state.session.check_rate_limit() {
        return Json(AuthResponse {
            success: false,
            token: None,
            error: Some(format!(
                "Too many failed attempts. Try again in {} seconds.",
                remaining_secs
            )),
        });
    }

    // Retrieve the stored pattern hash
    let stored_hash = match crypto::retrieve_pattern() {
        Ok(Some(hash)) => hash,
        Ok(None) => {
            return Json(AuthResponse {
                success: false,
                token: None,
                error: Some("No pattern lock configured".into()),
            });
        }
        Err(e) => {
            return Json(AuthResponse {
                success: false,
                token: None,
                error: Some(format!("Pattern retrieval error: {}", e)),
            });
        }
    };

    // Verify the pattern (this is CPU-intensive due to Argon2id)
    match crypto::verify_pattern(&payload.pattern, &stored_hash) {
        Ok(true) => {
            // Reset rate limiter on successful auth
            state.session.reset_failed_attempts();

            // Unlock the vault session
            state.session.unlock();

            // Create an HTTP session token
            match state
                .session
                .create_http_session(Duration::from_secs(TOKEN_TTL_SECS))
            {
                Ok(token) => Json(AuthResponse {
                    success: true,
                    token: Some(token),
                    error: None,
                }),
                Err(e) => Json(AuthResponse {
                    success: false,
                    token: None,
                    error: Some(format!("Session creation error: {}", e)),
                }),
            }
        }
        Ok(false) => {
            // Record failed attempt for rate limiting
            state.session.record_failed_attempt();

            Json(AuthResponse {
                success: false,
                token: None,
                error: Some("Invalid pattern".into()),
            })
        }
        Err(e) => Json(AuthResponse {
            success: false,
            token: None,
            error: Some(format!("Pattern verification error: {}", e)),
        }),
    }
}

// ============================================================
// Route Handlers — Protected (require BearerAuth)
// ============================================================

/// GET /api/vault/items — List all vault items
async fn handle_get_vault_items(
    State(state): State<Arc<AppState>>,
    _auth: BearerAuth,
) -> Result<Json<Vec<db::VaultItemBase>>, (axum::http::StatusCode, Json<ErrorResponse>)> {
    let conn = state
        .db
        .lock()
        .map_err(|e| internal_error(e.to_string()))?;
    let items = db::get_all_items(&conn).map_err(|e| internal_error(e.to_string()))?;
    Ok(Json(items))
}

/// GET /api/vault/search?q=xxx — Search vault items
async fn handle_search_items(
    State(state): State<Arc<AppState>>,
    _auth: BearerAuth,
    Query(params): Query<SearchQuery>,
) -> Result<Json<Vec<db::VaultItemBase>>, (axum::http::StatusCode, Json<ErrorResponse>)> {
    let query = params.q.unwrap_or_default();
    if query.is_empty() {
        // Return all items if no query
        let conn = state
            .db
            .lock()
            .map_err(|e| internal_error(e.to_string()))?;
        let items = db::get_all_items(&conn).map_err(|e| internal_error(e.to_string()))?;
        return Ok(Json(items));
    }

    let conn = state
        .db
        .lock()
        .map_err(|e| internal_error(e.to_string()))?;
    let items = db::search_items(&conn, &query).map_err(|e| internal_error(e.to_string()))?;
    Ok(Json(items))
}

/// GET /api/vault/items/:id/password — Get password plaintext
async fn handle_get_password(
    State(state): State<Arc<AppState>>,
    _auth: BearerAuth,
    Path(id): Path<String>,
) -> Json<PasswordPlaintextResponse> {
    let conn = match state.db.lock() {
        Ok(c) => c,
        Err(e) => {
            return Json(PasswordPlaintextResponse {
                success: false,
                plaintext: None,
                error: Some(e.to_string()),
            })
        }
    };

    match db::get_encrypted_password(&conn, &id) {
        Ok(Some(blob)) => match crypto::decrypt_field(&blob, &state.imk, id.as_bytes()) {
            Ok(plaintext) => Json(PasswordPlaintextResponse {
                success: true,
                plaintext: Some(String::from_utf8_lossy(&plaintext).to_string()),
                error: None,
            }),
            Err(e) => Json(PasswordPlaintextResponse {
                success: false,
                plaintext: None,
                error: Some(e.to_string()),
            }),
        },
        Ok(None) => Json(PasswordPlaintextResponse {
            success: false,
            plaintext: None,
            error: Some("No password stored for this item".into()),
        }),
        Err(e) => Json(PasswordPlaintextResponse {
            success: false,
            plaintext: None,
            error: Some(e),
        }),
    }
}

/// GET /api/vault/items/:id/totp — Get current TOTP code
async fn handle_get_totp(
    State(state): State<Arc<AppState>>,
    _auth: BearerAuth,
    Path(id): Path<String>,
) -> Json<TotpResponse> {
    let conn = match state.db.lock() {
        Ok(c) => c,
        Err(e) => {
            return Json(TotpResponse {
                success: false,
                code: None,
                remaining: None,
                error: Some(e.to_string()),
            })
        }
    };

    match db::get_encrypted_totp_secret(&conn, &id) {
        Ok(Some(blob)) => match crypto::decrypt_field(&blob, &state.imk, id.as_bytes()) {
            Ok(secret_bytes) => {
                let secret_str = String::from_utf8_lossy(&secret_bytes).to_string();
                let totp_result = totp::generate_totp_code(&secret_str);
                Json(TotpResponse {
                    success: totp_result.success,
                    code: totp_result.code,
                    remaining: Some(totp::get_remaining_seconds()),
                    error: totp_result.error,
                })
            }
            Err(e) => Json(TotpResponse {
                success: false,
                code: None,
                remaining: None,
                error: Some(e.to_string()),
            }),
        },
        Ok(None) => Json(TotpResponse {
            success: false,
            code: None,
            remaining: None,
            error: Some("No TOTP secret stored for this item".into()),
        }),
        Err(e) => Json(TotpResponse {
            success: false,
            code: None,
            remaining: None,
            error: Some(e),
        }),
    }
}

/// GET /api/totp/remaining — Get seconds until next TOTP rotation
async fn handle_totp_remaining(_auth: BearerAuth) -> Json<RemainingResponse> {
    Json(RemainingResponse {
        remaining: totp::get_remaining_seconds(),
    })
}

// ============================================================
// Helpers
// ============================================================

fn internal_error(msg: String) -> (axum::http::StatusCode, Json<ErrorResponse>) {
    (
        axum::http::StatusCode::INTERNAL_SERVER_ERROR,
        Json(ErrorResponse { error: msg }),
    )
}
