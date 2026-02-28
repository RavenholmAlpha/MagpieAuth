# MagpieAuth - 系统架构设计

## 1. 架构概览
考虑到 "轻量化"、"本地化" 以及 "高级 UI 质感" 的需求，MagpieAuth 将采用 **Tauri v2** 框架进行构建。
Tauri 兼具极小的打包体积与极低的资源消耗，完美契合本项目对性能的苛刻要求。

- **前端 (Frontend)**：React + TypeScript + Tailwind CSS + Shadcn/UI (构建具有高级毛玻璃质感的极简 UI)。
- **后端 (Backend / Core)**：Rust (提供高性能、高安全性的本地系统调用、加密运算和数据存储)。
- **持久化 (Storage)**：Rust 集成 SQLite (通过 `rusqlite` 构建结构化数据存储)。

## 2. 核心模块划分

### 2.1 表现层 (Frontend: React)
负责与用户交互，呈现经过精心设计的暗黑风格 UI 界面。
- **Auth Guard View**：拦截所有请求，当应用刚启动或失去焦点一段时间后，展示锁定界面。
- **Vault View**：密码列表和 2FA 列表的混合视图。利用 Shadcn/UI 的 Card 和 List 组件，实现平滑滚动。
- **Detail/Edit View**：密码或 2FA 条目的详细检视与编辑抽屉 (Drawer) / 弹窗 (Dialog)。
- **Scanner Module**：利用前端 JS `html5-qrcode` 或类似库截取屏幕图像以识别二维码 `otpauth://`。

### 2.2 逻辑与桥接层 (Tauri Commands)
Tauri 的 IPC (进程间通信) 机制负责前端到后端 Rust 逻辑的调用。
暴露以下核心 Command：
- `get_vault_items()`: 获取条目概览（不含密码明文）。
- `get_password_plaintext(id)`: 触发系统 PIN 码验证，验证通过后返回密码明文。
- `get_totp_code(id)`: 解析 2FA 密钥，生成并返回当前 6 位验证码。
- `add_item(payload)`: 增加新密码/2FA 条目。
- `export_vault(password)`: 使用自定义密码加密导出完整的 Vault。
- `import_vault(file_path, password)`: 使用密码解密并导入 Vault。

### 2.3 核心业务层 (Rust)
#### A. 系统认证集成模块 (System Auth Module)
- 基于 Windows 平台，通过 Rust 调用 **Windows 凭据管理器 (Windows Credential Manager) / Windows Hello API (如 `windows-rs` 中的 `Windows.Security.Credentials.UI`)** 提供系统级别的 PIN 验证 / 生物识别。
- **逻辑**：当前端请求查看或复制密码时，Rust 挂起请求，调起系统的安全提示框 (Prompt)。只有当系统 API 返回 `CredentialsVerified == true` 时，Rust 层才执行数据库读取和解密操作并返回结果。

#### B. 数据加解密模块 (Cryptography Module)
基于 Rust 的高性能加密库 (如 `ring` 或 `aes-gcm` 和 `argon2`)。
- **运行时数据保护**：对于存储在 SQLite 中的每个 "密码" 或 "2FA Secret"，在写入数据库时进行透明化 AES-256-GCM 加密，加密使用的内部主密钥 (Internal Master Key) 可以通过 DPAPI (Data Protection API) 安全存储于操作系统的凭据管理器中。
- **导出入加解密**：
  1. 用户输入导出密码 -> 经过 `Argon2id` 派生出 256位 (32字节) 的加密密钥 `K`.
  2. 生成 96位 (12字节) 的随机 Nonce.
  3. 将整个数据库内容按 JSON 序列化后，使用 `AES-256-GCM` 算法以 `K` 和 `Nonce` 进行加密，生成 `Ciphertext` 和 `Auth Tag` (即 MAC)。
  4. 将组合数据 `[Nonce || Auth Tag || Ciphertext]` 写入导出文件 (.magpie)。

#### C. TOTP 生成引擎 (TOTP Engine)
- 使用 Rust 标准库如 `totp-rs` 来解析 `otpauth://totp/...` 协议字符串。
- 封装生成算法，根据当前系统时间戳动态生成 6 位或 8 位数字验证码。

### 2.4 数据存储层 (Data Layer)
- **Local DB**：采用嵌入式 SQLite（`rusqlite`）。放置于系统标准的应用数据目录（如 `%APPDATA%\MagpieAuth\vault.db`）。
- **字段级加密**：数据库结构中，敏感字段（如 `EncryptedPassword`, `EncryptedTotpSecret`）只存储密文。非敏感字段（如 `Title`, `Account`, `CreatedAt`）明文存储以支持高效的本地全文检索。

## 3. 部署与打包体系
- **开发环境**：`npm run dev` (同时拉起 Vite React Server 与 Tauri Rust 后端进程)。
- **系统打包**：使用 `tauri build` 打包。最终产出应为一个独立、不依赖环境的 `MagpieAuth_setup.exe` 与独立的绿色便携版二进制文件（可选），实现真正的轻量化和免打扰。
