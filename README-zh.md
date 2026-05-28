<div align="center">
  <img src="public/MPA.png" alt="MagpieAuth Logo" width="128" style="background: rgba(255,255,255,0.1); border-radius: 20px; padding: 10px;" />
  <br/>
  <h1>MagpieAuth</h1>
  <p><strong>离线安全的 2FA 验证器与密码管理器</strong></p>

  [![中文](https://img.shields.io/badge/Language-中文-red.svg)](README-zh.md)
  [![English](https://img.shields.io/badge/Language-English-blue.svg)](README.md)
  <br/>

  [![Tauri Shield](https://img.shields.io/badge/Tauri-v2-cyan?logo=tauri)](https://v2.tauri.app/)
  [![Rust](https://img.shields.io/badge/Rust-1.80+-orange?logo=rust)](https://www.rust-lang.org/)
  [![React](https://img.shields.io/badge/React-18-blue?logo=react)](https://react.dev/)
  [![Chrome Extension](https://img.shields.io/badge/Chrome-浏览器插件-green?logo=googlechrome)](browser-extension/)
  [![License](https://img.shields.io/badge/License-Dual-blue.svg)](LICENSE)
</div>

<br/>

MagpieAuth 是一款专为 Windows 系统打造的离线双因素验证（2FA）与密码管理器。它将凭证保险层与 Windows 操作系统的原生安全模块相集成，提供本地环境下的账号、密码以及时间验证码（TOTP）的安全存储。同时附带 **Chrome 浏览器插件**，可直接在浏览器中快速访问保险库。

---

## 核心特性

### 安全与存储
- **本地环境隔离**：MagpieAuth 不连接外部云服务，数据仅保存在本地设备。
- **AES-256-GCM 加密**：保存在 SQLite 数据库（`vault.db`）中的密码明文和 TOTP 密钥数据均被独立的 AES 引擎加密。
- **DPAPI 密钥保护**：负责解锁保险柜的内部主密钥 (Internal Master Key) 会被 Windows 内置的数据保护 API (`CryptProtectData`) 加密。数据的加解密过程与当前用户的 Windows 登录状态绑定。
- **双重验证**：同时支持 Windows Hello（指纹/人脸/PIN）和图案解锁 (Pattern Lock)，锁屏时两种方式任选其一。

### 验证器 (OTP)
- 在 Rust 底层解析标准的 `otpauth://` 链接。
- 零延迟同步计算获取 6 位数验证码。
- 以直观的弧形进度条展示当前验证码的剩余有效时间。

### 🌐 Chrome 浏览器插件
- **快速访问**：在浏览器弹窗中直接查看和复制 TOTP 验证码。
- **一键复制**：账号、密码、验证码一键复制到剪贴板。
- **图案解锁**：使用与桌面端相同的图案锁进行验证。
- **搜索过滤**：实时搜索快速找到目标条目。
- **倒计时进度条**：弧形 SVG 动画实时显示验证码剩余有效期。
- **自动检测**：自动检测桌面端运行状态。
- **毛玻璃 UI**：与桌面端一致的暗色玻璃质感设计。

### 交互界面
- 基于 Framer Motion 实现全界面的硬件加速动画。
- 包含跟随系统、明亮及深色模式的玻璃质感（Glassmorphism） UI。
- 支持全局快捷键绑定，默认可通过 `Ctrl+Shift+L` 快速呼出或隐藏主面板。
- 提供分类标签（Labels），可对大量账号进行标记与过滤。

### 辅助功能
- **闲置上锁 (Auto-Lock)**：侦测键鼠活动状态，支持设定时间段触发自动隐藏并上锁。
- **剪贴板支持**：按需复制账号、密码和验证码。
- **独立备份**：支持将凭据库打包成外部带密码的 AES 加密 JSON 文件，以便在不同的受信任设备间转移。

---

## 技术架构

| 层级 | 技术栈 |
|------|--------|
| **前端** | React 18, TypeScript, Vite, Tailwind CSS, Framer Motion |
| **后端** | Tauri v2, Rust, Axum（内嵌 HTTP 服务器） |
| **数据库** | SQLite (`rusqlite`) |
| **密码协议** | `aes-gcm`, `rand`, `windows-rs` (DPAPI), `totp-rs` |
| **浏览器插件** | Chrome Manifest V3, Vanilla JS, Canvas API |

---

## 本地部署指南

### 环境要求
- Node.js (v18+)
- Rust (v1.80+)
- Windows 10/11，系统需具备 Visual Studio C++ 构建工具组件。

### 开发构建

1. **克隆项目代码**
   ```bash
   git clone https://github.com/RavenholmAlpha/MagpieAuth.git
   cd MagpieAuth
   ```

2. **安装前端依赖**
   ```bash
   npm install
   ```

3. **运行开发模式**
   ```bash
   npm run tauri dev
   ```

### 编译安装包
生成正式发布的 Windows 安装文件：
```bash
npm run tauri build
```
编译完成后的安装包位于：
- `src-tauri/target/release/bundle/nsis/` — NSIS `.exe` 安装程序
- `src-tauri/target/release/bundle/msi/` — MSI 安装包

### 安装浏览器插件

1. 打开 Chrome，访问 `chrome://extensions/`
2. 开启右上角的**开发者模式**
3. 点击**加载已解压的扩展程序**，选择项目中的 `browser-extension/` 目录
4. MagpieAuth 图标将出现在工具栏
5. 使用插件前请确保桌面端正在运行

---

## 目录结构

```text
magpieauth/
├── src/                          # 前端 UI 层面板 (React + TypeScript)
│   ├── components/               # UI 界面组件 (锁屏、列表、设置等)
│   ├── hooks/                    # 抽离化状态钩子
│   ├── lib/                      # 全局通信层工具封装
│   ├── App.tsx                   # 路由和状态渲染主入口
│   └── index.css                 # Tailwind 和 CSS 基础变量
├── src-tauri/                    # 后端逻辑流 (Rust)
│   ├── src/
│   │   ├── auth.rs               # Windows Hello 环境验证
│   │   ├── commands.rs           # Tauri IPC 接口封装
│   │   ├── crypto.rs             # AES-GCM 和 DPAPI 访问控制
│   │   ├── db.rs                 # SQLite 表结构与查询实现
│   │   ├── http_server.rs        # 内嵌 Axum HTTP API 服务器
│   │   ├── http_auth.rs          # Bearer Token 会话管理
│   │   ├── security.rs           # 锁定状态与 HTTP 会话令牌
│   │   ├── totp.rs               # 一次性验证码生成内核算法
│   │   └── lib.rs                # 系统启动初始化配置入口
│   ├── Cargo.toml                # Rust 依赖声明
│   └── tauri.conf.json           # Tauri 打包配置文件
├── browser-extension/            # Chrome 浏览器插件 (Manifest V3)
│   ├── manifest.json             # 插件配置文件
│   ├── popup/                    # 弹窗 UI (HTML + CSS + JS)
│   ├── background/               # Service Worker 后台脚本
│   ├── lib/                      # API 客户端 & 图案锁组件
│   └── icons/                    # 插件图标
└── package.json                  # NPM 工程包管理
```

---

## 浏览器插件架构

浏览器插件通过嵌入在 Tauri 后端的**本地 HTTP API 服务器**与桌面端通信。

```
┌─────────────────────┐          HTTP REST          ┌─────────────────────┐
│  Chrome 浏览器插件   │ ◄──── localhost:19826 ────► │  MagpieAuth 桌面端  │
│  (Popup UI)         │                             │  (Axum + Tauri)     │
└─────────────────────┘                             └─────────────────────┘
```

**安全措施：**
- HTTP 服务器仅监听 `127.0.0.1`（回环地址，不可远程访问）
- CORS 仅允许 `chrome-extension://` 来源
- Bearer Token 认证，有效期 10 分钟
- 保险库锁定时自动清除所有 Token

**API 端点：**

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| `GET` | `/api/status` | — | 连接和锁定状态 |
| `POST` | `/api/auth/pattern` | — | 图案解锁 → Bearer Token |
| `GET` | `/api/vault/items` | Bearer | 获取保险库列表 |
| `GET` | `/api/vault/search?q=` | Bearer | 搜索条目 |
| `GET` | `/api/vault/items/{id}/password` | Bearer | 获取密码 |
| `GET` | `/api/vault/items/{id}/totp` | Bearer | 获取验证码 |
| `GET` | `/api/totp/remaining` | Bearer | 验证码剩余秒数 |

---

## 安全与设计思路

MagpieAuth 旨在将完整的数据控制权保留在本地，不依赖云端同步。为了在保证离线加密强度的同时免去用户记忆额外"主密码"的负担，项目选择调用 Windows 系统原生的数据保护 API（`DPAPI`）来保管数据库的主密钥。这使得数据的加解密过程与当前用户的 Windows 登录凭据环境深度绑定。即使物理设备上的数据库文件被拷贝或截取至其他机器，在未取得对应 Windows 账户授权环境的前提下，也无法解压出具体明文。

*注：当前的底层加密库（`crypto.rs`）是与 Windows 平台的 DPAPI 绑定的。未来如需跨平台发布至 macOS 或 Linux 系统，需要针对不同系统单独接入 Keychain 或 libsecret 等相应的安全组件以实现隔离。*

---

## 许可证
本项目采用双重授权模式（Dual-License）：
- **个人 / 非商业使用**：免费获取和修改。
- **商业使用**：需购买商业授权（闭源），或将您的二次开发/衍生项目遵循 AGPLv3 等开源协议全面开源。

详细条款请参阅根目录下的 [`LICENSE`](LICENSE) 文件。
