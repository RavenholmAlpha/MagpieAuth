# MagpieAuth - 数据库与数据结构设计 (Data Schema)

本系统采用单一 SQLite 数据库文件作为核心数据存储方案，结合 Rust 的 `rusqlite` 与强类型序列化库 `serde`，确保数据存储的强一致性和高安全性。

## 1. 数据库基础信息
- **数据库路径**：`%APPDATA%\MagpieAuth\vault.db`
- **加密策略**：为了保证轻量和检索效率，不使用 SQLite 的全库加密拓展 (如 SQLCipher)，而是采用**字段级加密**策略。检索相关的元数据（标题、账号、时间）以明文存储，而核心密钥数据（密码、TOTP Secret）在入库前由 Rust 业务层加解密。

## 2. 核心数据表设计

### 2.1 表：`vault_items`
存储所有的密码和 2FA 条目。一个条目可以同时包含密码和 2FA，也可以只有其一。

| 字段名 | 数据类型 | 约束 | 说明 |
| :--- | :--- | :--- | :--- |
| `id` | TEXT (UUID) | PRIMARY KEY, NOT NULL | 唯一标识符，基于 UUIDv4 生成 |
| `title` | TEXT | NOT NULL | 用户自定义的名称（如"GitHub"），支持模糊搜索 |
| `account` | TEXT | | 账号/用户名/邮箱等，辅助识别与搜索 |
| `encrypted_password` | BLOB | | 用内部主密钥 AES-256-GCM 加密后的密码明文及 Nonce/Tag。格式通常为 `[Nonce 12B][Tag 16B][Ciphertext]` |
| `encrypted_totp_secret`| BLOB | | 用内部主密钥 AES-256-GCM 加密后的 TOTP Secret（Base32 编码原文） |
| `created_at` | INTEGER | NOT NULL | 创建时间的时间戳 (Unix Timestamp, UTC 毫秒) |
| `updated_at` | INTEGER | NOT NULL | 最后修改时间戳 |

> **安全注记**：`encrypted_password` 与 `encrypted_totp_secret` 在脱离了操作系统的凭据管理器（存放着内部主密钥）后，对于任何直接查看 `vault.db` 的攻击者而言都是无法解密的乱码。

## 3. 内存与传输数据结构 (Rust & TypeScript)

前端与 Rust 侧交互时，密码和 Secret 是分离获取的，以避免一次性内存暴露。

### 3.1 概览列表 (Frontend -> `get_vault_items`)
```typescript
interface VaultItemBase {
  id: string;
  title: string;
  account: string | null;
  hasPassword: boolean; // boolean 标识是否有密码
  hasTotp: boolean;     // boolean 标识是否有 2FA
  createdAt: number;
  updatedAt: number;
}
```

### 3.2 密码获取 (Frontend -> `get_password_plaintext(id)`)
```typescript
// 必须经过系统 PIN 验证后，Rust 返回解密后的字符串
type PasswordResponse = {
  success: boolean;
  plaintext?: string;
  error?: string;
};
```

### 3.3 TOTP 获取 (Frontend -> `get_totp_code(id)`)
```typescript
interface TotpCodeResponse {
  success: boolean;
  code?: string;      // 例如 "123456"
  validUntil?: number; // 当前验证码的过期时间戳，方便前端画倒计时进度条
  error?: string;
}
```

## 4. 导出文件结构 (.magpie)
导出的备份文件格式约定为加密的二进制文件或 Base64 字符串，内部包装为 JSON 结构。

### 4.1 导出前明文 JSON 结构：
```json
{
  "version": 1,
  "exported_at": 1698765432100,
  "items": [
    {
      "id": "uuid-here",
      "title": "GitHub",
      "account": "user@email.com",
      "password_plaintext": "super_secret_password",
      "totp_secret_plaintext": "JBSWY3DPEHPK3PXP",
      "created_at": 1698765432100,
      "updated_at": 1698765432100
    }
  ]
}
```

### 4.2 文件物理结构：
用户指定强密码导出后，文件 `.magpie` 结构为：
- `[Salt (16 bytes)]`：用于 Argon2id 密钥派生。
- `[Nonce (12 bytes)]`：用于 AES-256-GCM 加密。
- `[Auth Tag (16 bytes)]`：MAC 校验。
- `[Ciphertext (Variable Length)]`：上述 JSON 的加密数据。

导入时，通过用户输入的密码 + 提取的 Salt 重新派生密钥，验证 Tag 并解密 Ciphertext，最后执行数据库的反向插入（入库时重新使用内部主密钥进行字段级加密）。
