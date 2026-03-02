import i18n from "i18next";
import { initReactI18next } from "react-i18next";

// English translations
const resources = {
  en: {
    translation: {
      "app": {
        "title": "MagpieAuth",
        "searchPlaceholder": "Search vault...",
        "addNewItem": "Add New Item",
        "settings": "Settings",
        "lockVault": "Lock Vault",
      },
      "lockScreen": {
        "welcome": "Welcome Back",
        "enterPin": "Enter your OS PIN / Windows Hello to unlock",
        "enterPattern": "Draw your 4x4 pattern to unlock",
        "unlocking": "Unlocking...",
        "unlock": "Unlock Vault",
        "wrongPattern": "Incorrect pattern",
        "noPatternFallback": "No pattern configured. Please switch to System Auth in Settings.",
        "authFailed": "Authentication failed",
      },
      "vaultList": {
        "empty": "Your vault is empty",
        "clickAdd": "Click the + button to add your first item.",
        "noResults": "No matching items found",
        "clearSearch": "Try clearing your search query.",
        "password": "Password",
        "totp": "Authenticator"
      },
      "detailDrawer": {
        "password": "Password",
        "authenticator": "Authenticator",
        "tapToReveal": "Tap to reveal code",
        "copy": "Copy",
        "copied": "Copied!",
        "edit": "Edit",
        "delete": "Delete",
        "confirmDelete": "Delete this item?",
        "cannotUndo": "This action cannot be undone.",
        "cancel": "Cancel",
        "codeMatches": "Code matches system time",
        "codeDesync": "Code might be out of sync"
      },
      "addEdit": {
        "addTitle": "Add Vault Item",
        "editTitle": "Edit Vault Item",
        "titleLabel": "Title*",
        "titlePlaceholder": "e.g., Google, GitHub",
        "accountLabel": "Account / Username",
        "accountPlaceholder": "user@example.com",
        "passwordLabel": "Password",
        "passwordPlaceholder": "Leave blank if only storing 2FA",
        "totpLabel": "Authenticator Secret (TOTP)",
        "totpPlaceholder": "otpauth://totp/... OR Base32 Secret",
        "scanQr": "Scan QR Code",
        "cancel": "Cancel",
        "save": "Save Item",
        "scanError": "Failed to access camera",
        "invalidQr": "No valid TOTP secret found in QR code."
      },
      "exportImport": {
        "exportTitle": "Export Vault",
        "importTitle": "Import Vault",
        "exportDesc": "Your vault data will be encrypted with a password of your choice and saved as a .magpie file.",
        "importDesc": "Select a .magpie backup file and enter the password you used to export it.",
        "passwordLabel": "Backup Password*",
        "passwordPlaceholder": "Enter a strong password",
        "cancel": "Cancel",
        "exportBtn": "Export Data",
        "importBtn": "Select File & Import",
        "exportSuccess": "Vault exported successfully",
        "importSuccess": "items imported successfully"
      },
      "settings": {
        "title": "Settings",
        "dataManagement": "Data Management",
        "exportVault": "Export Vault",
        "exportDesc": "Create encrypted .magpie backup",
        "importVault": "Import Vault",
        "importDesc": "Restore from .magpie backup",
        "securityAutoLock": "Security & Auto-Lock",
        "autoLockBehavior": "Auto-Lock Behavior",
        "strict": "strict",
        "normal": "normal",
        "relaxed": "relaxed",
        "strictDesc": "Locks instantly on lost focus or idle timeout.",
        "normalDesc": "Locks only on idle timeout. Backgrounding app is allowed.",
        "relaxedDesc": "Never auto-locks. Use the lock button in the header.",
        "idleTimeout": "Idle Timeout",
        "about": "About",
        "aboutDesc": "A lightweight, local-first password & 2FA manager. All data stays on your device. No cloud. No telemetry. Just security.",
        "language": "Language",
        "chooseLanguage": "Select Interface Language",
        "systemAuth": "System Authentication",
        "systemAuthDesc": "MagpieAuth uses your system's PIN / Windows Hello for identity verification. Passwords are encrypted with AES-256-GCM and the master key is protected by your OS credential manager.",
        "authMethod": "Authentication Method",
        "patternAuth": "Pattern Lock",
        "setPattern": "Set / Change Pattern",
        "patternAuthDesc": "MagpieAuth uses a highly secure 16-node 4x4 coordinate pattern alternative. Your pattern is securely hashed using the Argon2id algorithm.",
        "advanced": "Advanced / System",
        "globalShortcut": "Global Shortcut",
        "globalShortcutDesc": "Press this key combination anywhere in Windows to quickly toggle MagpieAuth visibility.",
        "shortcutPlaceholder": "Click and press keys to set shortcut (Backspace to clear)",
        "appearance": "Appearance",
        "theme": "Theme",
        "light": "Light",
        "dark": "Dark",
        "system": "System",
        "closeBehavior": "Close Button Behavior",
        "closeBehavior_close": "Close",
        "closeBehavior_tray": "Minimize to Tray",
        "closeBehavior_ask": "Ask",
        "closeBehaviorDesc": "Choose what happens when you click the window close (X) button."
      },
      "patternSetup": {
        "drawTitle": "Draw New Pattern",
        "drawDesc": "Connect at least 4 dots to secure your vault",
        "confirmTitle": "Confirm Pattern",
        "confirmDesc": "Draw exactly the same pattern to confirm",
        "tooShort": "Pattern too short! Connect at least 4 dots.",
        "mismatch": "Patterns do not match. Try again."
      },
      "closeConfirm": {
        "title": "Close Application",
        "desc": "Do you want to exit the application completely or run in the background?",
        "minimize": "Minimize to Tray",
        "exit": "Exit completely"
      }
    }
  },
  zh: {
    translation: {
      "app": {
        "title": "MagpieAuth",
        "searchPlaceholder": "搜索密码库...",
        "addNewItem": "添加新项目",
        "settings": "设置",
        "lockVault": "锁定密码库",
      },
      "lockScreen": {
        "welcome": "欢迎回来",
        "enterPin": "输入系统 PIN / Windows Hello 解锁",
        "enterPattern": "绘制 4x4 滑动图案解锁",
        "unlocking": "正在解锁...",
        "unlock": "解锁密码库",
        "wrongPattern": "解锁图案不正确",
        "noPatternFallback": "尚未配置解锁图案，请临时切换回系统级身份验证进行设置。",
        "authFailed": "身份验证失败",
      },
      "vaultList": {
        "empty": "您的密码库是空的",
        "clickAdd": "点击右上角 + 按钮添加第一项。",
        "noResults": "未找到匹配项",
        "clearSearch": "请尝试换个搜索词。",
        "password": "密码",
        "totp": "二步验证"
      },
      "detailDrawer": {
        "password": "密码",
        "authenticator": "二步验证",
        "tapToReveal": "点击显示代码",
        "copy": "复制",
        "copied": "已复制!",
        "edit": "编辑",
        "delete": "删除",
        "confirmDelete": "确认删除此项吗？",
        "cannotUndo": "此操作将永久抹除数据，无法撤销。",
        "cancel": "取消",
        "codeMatches": "代码时间同步正常",
        "codeDesync": "代码可能会有延迟"
      },
      "addEdit": {
        "addTitle": "添加项目",
        "editTitle": "编辑项目",
        "titleLabel": "标题*",
        "titlePlaceholder": "如：Google、GitHub",
        "accountLabel": "账号 / 用户名",
        "accountPlaceholder": "user@example.com",
        "passwordLabel": "密码",
        "passwordPlaceholder": "如果仅仅存放二步验证代码，此项可留空",
        "totpLabel": "二步验证密钥 (TOTP Secret)",
        "totpPlaceholder": "otpauth://totp/... 或 Base32 密钥",
        "scanQr": "扫描二维码",
        "cancel": "取消",
        "save": "保存项目",
        "scanError": "无法访问摄像头",
        "invalidQr": "二维码中未提取到有效的 TOTP 密钥。"
      },
      "exportImport": {
        "exportTitle": "导出密码库",
        "importTitle": "导入密码库",
        "exportDesc": "您的数据将被高强度加密并保存为 .magpie 格式文件，请务必牢记您设置的密码。",
        "importDesc": "由于数据经过加密，请提供导出该数据时所使用的密码。",
        "passwordLabel": "备份加密密码*",
        "passwordPlaceholder": "请设置/输入密码",
        "cancel": "取消",
        "exportBtn": "导出数据",
        "importBtn": "选择文件并导入",
        "exportSuccess": "密码库导出成功",
        "importSuccess": "条数据已成功导入"
      },
      "settings": {
        "title": "设置",
        "dataManagement": "数据管理",
        "exportVault": "导出密码库",
        "exportDesc": "创建高强度加密的 .magpie 备份",
        "importVault": "导入密码库",
        "importDesc": "从现有的 .magpie 备份恢复",
        "securityAutoLock": "安全与自动锁定",
        "autoLockBehavior": "自动锁定策略",
        "strict": "严格模式",
        "normal": "常规模式",
        "relaxed": "宽松模式",
        "strictDesc": "当窗口失去焦点或无操作超时后立即锁定。",
        "normalDesc": "仅在无操作超时后锁定。允许应用在后台安全挂机。",
        "relaxedDesc": "从不自动锁定。点击顶部黑锁图标可手动锁定。",
        "idleTimeout": "静置超时时间",
        "about": "关于",
        "aboutDesc": "一款轻量、本地优先的密码及二步验证管家。没有任何云端，没有任何遥测，所有数据全部留在您的设备上。做纯粹的安全软件。",
        "language": "语言 / Language",
        "chooseLanguage": "选择界面语言",
        "systemAuth": "系统验证",
        "systemAuthDesc": "MagpieAuth 使用操作系统的底层 PIN 或 Windows Hello 等生物识别来进行身份验证。所有密码均已使用 AES-256-GCM 工业级加密，主密钥由操作系统硬件凭据管理器进行高强度物理保护。",
        "authMethod": "身份验证方式",
        "patternAuth": "图案解锁",
        "setPattern": "设置 / 更改解锁图案",
        "patternAuthDesc": "MagpieAuth 支持安全性极高的 4x4 (16个节点) 复杂滑动解锁备用方案。您的滑动坐标将通过 Argon2id 算法进行高强度哈希处理并保存在本地以防破解。",
        "advanced": "高级 / 系统功能",
        "globalShortcut": "全局唤醒快捷键",
        "globalShortcutDesc": "在操作系统的任何位置按下此按键组合以快速唤醒或隐藏 MagpieAuth。",
        "shortcutPlaceholder": "点击并按下键盘按键即可设置（使用退格键清空）",
        "appearance": "外观 / 主题",
        "theme": "主题模式",
        "light": "日间模式",
        "dark": "夜间模式",
        "system": "跟随系统",
        "closeBehavior": "关闭按钮行为",
        "closeBehavior_close": "完全退出",
        "closeBehavior_tray": "缩小到托盘",
        "closeBehavior_ask": "每次询问",
        "closeBehaviorDesc": "请选择当您点击窗口右上角的关闭 (X) 按钮时程序发生的事情。"
      },
      "patternSetup": {
        "drawTitle": "绘制新图案",
        "drawDesc": "请至少连接 4 个点以保障安全",
        "confirmTitle": "确认图案",
        "confirmDesc": "请再次绘制完全相同的图案以确认",
        "tooShort": "图案太短！请至少连接 4 个点。",
        "mismatch": "两次绘制的图案不一致，请重试。"
      },
      "closeConfirm": {
        "title": "关闭程序",
        "desc": "您希望完全退出程序，还是将程序缩小至系统托盘？",
        "minimize": "缩小到托盘",
        "exit": "完全退出"
      }
    }
  }
};

const savedLanguage = localStorage.getItem("magpie_language") || "en";

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: savedLanguage,
    fallbackLng: "en",
    interpolation: {
      escapeValue: false // React runs HTML escaping naturally
    }
  });

export default i18n;
