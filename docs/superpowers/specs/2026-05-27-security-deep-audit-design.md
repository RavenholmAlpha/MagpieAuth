# MagpieAuth Deep Security Audit Design

Date: 2026-05-27
Scope: Full security audit of the current MagpieAuth working tree after the recent security fixes and Windows installer build.

## Goal

Run a comprehensive, evidence-driven security audit of the current project state. The audit should identify remaining security issues, verify whether prior findings are fixed, and separate real exploitable risks from acceptable residual risks or explicitly deferred items.

This is an audit-only phase. It does not change application behavior. Any fixes discovered by the audit will be handled in a later, separately approved implementation phase.

## Current Context

The project is a Tauri v2 password and TOTP manager with a React/Vite frontend and Rust backend. Recent uncommitted changes added backend session guarding, stricter TOTP validation, AES-GCM AAD enforcement, CSPRNG password generation, dependency updates, and installer packaging.

Known deferred item: non-Windows IMK storage and non-Windows system authentication are out of scope unless they create a Windows release risk. The current release target under review is Windows x64.

## Audit Surfaces

### Tauri Boundary

Review all registered Tauri commands and capability permissions. Confirm which commands are reachable from the WebView, which commands reveal secrets, which commands mutate vault state, and whether each command enforces authentication or an acceptable trust boundary.

Key files:

- `src-tauri/src/lib.rs`
- `src-tauri/src/commands.rs`
- `src-tauri/capabilities/default.json`
- `src-tauri/tauri.conf.json`

### Authentication And Session State

Review the backend unlock session model, system authentication, pattern authentication, lock synchronization, tray lock behavior, startup state, setup flow, and any mismatch between frontend state and backend state.

Key files:

- `src-tauri/src/auth.rs`
- `src-tauri/src/security.rs`
- `src/components/LockScreen.tsx`
- `src/components/SetupWizard.tsx`
- `src/App.tsx`

### Cryptography And Key Handling

Review IMK storage on Windows, field encryption/decryption, AAD usage, export encryption, Argon2 parameters, nonce handling, legacy compatibility, in-memory plaintext lifetime, and error behavior.

Key files:

- `src-tauri/src/crypto.rs`
- `src-tauri/src/db.rs`
- `src-tauri/src/commands.rs`

### Database And Data Integrity

Review SQLite schema, migrations, query parameterization, update semantics, label integrity, import duplication, deletion behavior, and corruption/rollback failure modes.

Key files:

- `src-tauri/src/db.rs`
- `docs/03_Data_Schema.md`

### Import, Export, And Upgrade Compatibility

Review `.magpie` import/export format, version handling, old backup compatibility, path handling, export password requirements, and whether import can weaken or corrupt current vault data.

Key files:

- `src-tauri/src/commands.rs`
- `src-tauri/src/crypto.rs`
- `src/components/ExportImportDialog.tsx`

### TOTP And QR Input

Review otpauth URI parsing, TOTP parameter validation, QR scanner input handling, JSON import handling, and frontend/backend consistency.

Key files:

- `src-tauri/src/totp.rs`
- `src/components/AddEditDialog.tsx`
- `src/components/QrScannerDialog.tsx`
- `src/components/TotpDisplay.tsx`

### Frontend Secret Handling

Review password/TOTP display, copy-to-clipboard behavior, state lifetime, localStorage use, XSS sinks, remote resources, CSP interaction, and UI flows that may desynchronize from backend security state.

Key files:

- `src/components/DetailDrawer.tsx`
- `src/components/VaultList.tsx`
- `src/lib/utils.ts`
- `src/index.css`
- `src/i18n.ts`

### Dependencies And Build Artifacts

Review npm and Cargo dependency state, build warnings, Tauri bundle output, generated installer paths, and risky development artifacts committed in the repo.

Key files and commands:

- `package.json`
- `package-lock.json`
- `src-tauri/Cargo.toml`
- `src-tauri/Cargo.lock`
- `npm audit`
- `cargo test`
- `cargo clippy --all-targets -- -D warnings`
- `npm run build`

## Method

1. Build a fresh threat model for the current working tree.
2. Inventory exposed commands, file paths, storage locations, and external inputs.
3. Review each audit surface manually with code evidence.
4. Run verification commands and record output.
5. For each candidate finding, identify attacker preconditions, source, sink, security control, impact, and exploit path.
6. Suppress or downgrade candidates when code evidence shows the path is not reachable or impact is low.
7. Produce a final report sorted by priority.

## Finding Format

Each finding should include:

- ID and title
- Priority: P1, P2, or P3
- Severity and confidence
- Affected files and line references
- Attack preconditions
- Concrete attack path
- Impact
- Validation evidence
- Recommended fix
- Compatibility considerations

## Non-Finding Ledger

The report should also include reviewed items that are not findings, such as:

- SQL injection paths that are parameterized
- XSS sinks not present
- Non-Windows issues deferred by release scope
- Build warnings that are informational only
- Risks already fixed by the current working tree

## Outputs

Write audit artifacts under a new scan directory:

- `C:\tmp\codex-security-scans\MagpieAuth\<current_commit>_<timestamp>\artifacts\threat_model.md`
- `runtime_inventory.md`
- `finding_discovery_report.md`
- `validation_report.md`
- `attack_path_analysis_report.md`
- `repository_coverage_ledger.md`
- Final report at `report.md`

The final chat summary should link to the report and list only the highest-priority findings plus validation status.

## Success Criteria

- All source and config files relevant to runtime security are covered or explicitly marked out of scope.
- Every reportable finding has a concrete source-to-sink path and code reference.
- Verification commands have fresh results.
- Known old findings are either confirmed fixed, reclassified, or carried forward with evidence.
- No fixes are made during this audit phase.

