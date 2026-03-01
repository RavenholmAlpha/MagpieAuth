// ============================================================
// MagpieAuth TypeScript Types
// Mirrors the Rust data structures for Tauri IPC
// ============================================================

export interface Label {
  id: string;
  name: string;
  color: string;
  createdAt: number;
}

export interface LabelPayload {
  name: string;
  color: string;
}

export interface VaultItemBase {
  id: string;
  title: string;
  account: string | null;
  labelId: string | null;
  labelName: string | null;
  labelColor: string | null;
  hasPassword: boolean;
  hasTotp: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface PasswordResponse {
  success: boolean;
  plaintext?: string;
  error?: string;
}

export interface TotpCodeResponse {
  success: boolean;
  code: string | null;
  validUntil: number | null;
  step: number | null;
  error: string | null;
}

export interface OtpauthParseResult {
  success: boolean;
  secret?: string;
  issuer?: string;
  accountName?: string;
  error?: string;
}

export interface ItemPayload {
  title: string;
  account: string | null;
  password: string | null;
  totpSecret: string | null;
  labelId: string | null;
}
