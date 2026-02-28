# MagpieAuth - 安全与加密设计规范 (Security Spec)

安全是密码管理器的命脉。MagpieAuth 作为一款本地优先的轻量级工具，核心防御假设是：**保护静态数据免受非授权的本机进程读取、防止物理设备丢失或硬盘克隆导致的数据泄露。**

## 1. 密钥管理体系 (核心架构)

本项目最重要的安全设计在于：**我们不保存主密码，我们相信操作系统的安全基石。**

### 1.1 内部主密钥 (Internal Master Key - IMK)
- **生成**：应用首次启动时，由 Rust 层的安全随机数生成器 (`OsRng`) 生成一个高强度的 256 位宽度的对称密钥，称为 IMK。
- **作用**：用于对 SQLite 数据库中的 `encrypted_password` 和 `encrypted_totp_secret` 进行真正的底层加解密。
- **存储**：
  - IMK **绝对不会**作为明文存储在应用目录中。
  - Windows 环境下，调用 **Windows DPAPI (Data Protection API)** 或是通过 `wincred` Crate 将 IMK 托管保存到 **Windows 凭据管理器** 中（绑定于当前系统登陆账户 `CURRENT_USER` 或 `LOCAL_MACHINE` 的凭据安全岛中）。
- **优势**：哪怕黑客偷走了 `vault.db`，如果没有操作系统的密钥（即没有目标用户的 Windows 登录权限），数据库就只是一堆无意义的乱码。

### 1.2 系统身份验证 (PIN / Windows Hello)
- **触发时机**：用户在界面上点击 "显示密码"、"复制密码" 或 "导出数据"，甚至刚打开应用解锁保险库时。
- **流程**：
  1. 前端请求解密操作。
  2. Rust 后端挂起请求，调用 Windows 自带的 `UserConsentVerifier` 或旧版凭据验证提示窗口。
  3. 操作系统接管屏幕并弹出系统级的 PIN 码 / 指纹 / 面部识别框（黑客无法轻易通过按键精灵或注入代码绕过此原生 UI）。
  4. 验证成功后，操作系统将正确的 IMK 返还给 Rust 进程。
  5. Rust 使用 IMK 对 SQLite 中的特定密文字段进行 AES-GCM 解密，返回给前端。

## 2. 字段级加密算法规范

对每个需要加密保护的数据库字段，其实质操作如下：

- **算法**：`AES-256-GCM`（通过 `ring`、`aes-gcm` 等可信 Rust 密码学库实现）。
- **加密过程**：
  - 为本次加密生成随机的 12 字节 Nonce。
  - 核心明文（例如密码文本的 UTF-8 字节序）与 Nonce、IMK 共同参与加密。
  - 获得 Ciphertext 和 16 字节的 Authentication Tag (MAC)。
  - 数据库最终持久化的 BLOB 数据结构为：`[Nonce 12B][Tag 16B][Ciphertext]`。
- **解密过程**：
  - 提取 Nonce 和 Tag，如果在验证 Tag 时发现数据被篡改或密钥错误，加密库将明确抛出 `DecryptionError`。系统必须将其作为高危事件拦截，不返回任何猜测数据。

## 3. 2FA (TOTP) 安全机制

- **生成离线化**：`totp-rs` 在解析时，计算完全在本地 CPU 的寄存器/内存中完成，不允许任何涉及 Secret 的内容发送至外部。
- **反截屏保护**：后续可考虑在显示明文 TOTP 或密码时，调用 Windows API 禁用前端窗口的截屏功能 (`SetWindowDisplayAffinity` `WDA_MONITOR`)。

## 4. 导出备份文件的加解密流 (Export / Import Cryptography)

由于备份文件常常要发送到邮箱或存入 U 盘，脱离了本地系统的 DPAPI 保护，因此采用常规但极高强度的口令衍生加密体制。

### 4.1 导出过程
1. **密码输入**：用户输入自定义的强导出密码 `P`。
2. **生成 Salt**：生成随机的 16 字节 Salt (`S`)。
3. **密钥派生 (KDF)**：
   - 使用 **Argon2id** 算法。
   - 推荐参数：`m` (内存消耗) = 65536 (64MB) 或更高，`t` (迭代次数) = 3，`p` (并行度) = 4。
   - 输入 `P` + `S`，派生出 256 位（32字节）导出加密密钥 `Key_Export`。
4. **组装与加密**：
   - 将现有数据库记录解密后统一组合成单个 JSON 字节流（明文 `M`）。
   - 生成 12 字节的 `Nonce_EX`。
   - 用 `Key_Export` 并通过 `AES-GCM` 将 `M` 加密成密文 `C_EX` 和认证标签 `Tag_EX`。
5. **持久化输出**：按规范结构（详见 Data Schema 文档）将 Salt、Nonce_EX、Tag_EX、C_EX 拼接并写入磁盘文件。

### 4.2 导入过程
流程相反。需要特别注意的是，在 `Argon2id` 计算完成并得到解密后的 JSON 流后，**立刻清除内存在该过程中驻留的明文缓冲块 (Zeroize)**，并使用本机系统分配的全新 IMK 将密码分条目加密入库，确保外部导入密码的生命周期止于入库那一刻。
