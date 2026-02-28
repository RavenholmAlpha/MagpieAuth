import { invoke } from "@tauri-apps/api/core";
import type {
  VaultItemBase,
  PasswordResponse,
  TotpCodeResponse,
  OtpauthParseResult,
  ItemPayload,
} from "../types";

// ============================================================
// Vault CRUD
// ============================================================

export async function getVaultItems(): Promise<VaultItemBase[]> {
  return invoke<VaultItemBase[]>("get_vault_items");
}

export async function searchItems(query: string): Promise<VaultItemBase[]> {
  return invoke<VaultItemBase[]>("search_items", { query });
}

export async function addItem(payload: ItemPayload): Promise<string> {
  return invoke<string>("add_item", { payload });
}

export async function updateItem(
  id: string,
  payload: ItemPayload
): Promise<void> {
  return invoke<void>("update_item", { id, payload });
}

export async function deleteItem(id: string): Promise<void> {
  return invoke<void>("delete_item", { id });
}

// ============================================================
// Sensitive Data Access
// ============================================================

export async function getPasswordPlaintext(
  id: string
): Promise<PasswordResponse> {
  return invoke<PasswordResponse>("get_password_plaintext", { id });
}

export async function getTotpCode(id: string): Promise<TotpCodeResponse> {
  return invoke<TotpCodeResponse>("get_totp_code", { id });
}

export async function parseOtpauthUri(uri: string): Promise<OtpauthParseResult> {
  return invoke<OtpauthParseResult>("parse_otpauth_uri", { uri });
}

export async function getRemainingSeconds(): Promise<number> {
  return invoke<number>("get_remaining_seconds");
}

// ============================================================
// System Auth
// ============================================================

export async function verifySystemAuth(): Promise<boolean> {
  return invoke<boolean>("verify_system_auth");
}

// ============================================================
// Export / Import
// ============================================================

export async function exportVault(
  password: string,
  filePath: string
): Promise<void> {
  return invoke<void>("export_vault", { password, filePath });
}

export async function importVault(
  filePath: string,
  password: string
): Promise<number> {
  return invoke<number>("import_vault", { filePath, password });
}
