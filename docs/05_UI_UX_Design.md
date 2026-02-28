# MagpieAuth - UI/UX 设计规范与交互指南

MagpieAuth 的视觉核心哲学是："安静的高级感"。作为一款管理敏感信息的工具，不应有任何花哨、分散注意力的元素。我们将采用 **Classic Minimalist Black/White/Gray/Silver (经典极简黑/白/灰/银)** 配以 **Frosted Glass (毛玻璃)** 的拟态材质质感。

## 1. 视觉基调与技术栈
- **设计语言**：极简、去线框化、基于间距 (Whitespace)、玻璃拟态 (Glassmorphism)。
- **深色模式优先 (Dark Mode First)**：默认并强烈推荐使用深色模式构建。
- **前端工具链**：`Tailwind CSS` + `Shadcn/UI` + `Lucide React` (用于极简线条图标) + `Framer Motion` (用于页面级微动画)。
- **字体排版 (Typography)**：
  - 核心字体组：`Inter`, `Roboto`, 配合 `SF Pro Display/Text` (系统级回退)。
  - 字重：标题使用 `Medium (500)` 或 `SemiBold (600)`，内容区使用 `Regular (400)`。

## 2. 核心色彩令牌 (Color Tokens)

在 `tailwind.config.ts` 中的定制：

| 类别 | 变量名 | 深色模式 (Dark) | 浅色模式 (Light) | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| **背景 (Background)** | `bg-background` | `#0A0A0A` (深邃黑) | `#FAFAFA` (极浅灰) | 软件大底色 |
| **毛玻璃容器 (Surface)**| `bg-surface/60` | `#1A1A1A` 配 `backdrop-blur-md` | `#FFFFFF` 配 `backdrop-blur-md`| 用于卡片、侧边栏，营造亚克力/毛玻璃透明感 |
| **边框 (Border)** | `border-border` | `#27272A` (含蓄的深灰) | `#E4E4E7` (淡银灰) | 仅在必要时划分层级，优先使用阴影与透明度过度 |
| **主文本 (Text - Pri)**| `text-primary` | `#F4F4F5` (近白) | `#18181B` (近黑) | 强调信息、标题 |
| **次文本 (Text - Sec)**| `text-muted` | `#A1A1AA` (中灰) | `#71717A` (中灰) | 账号信息、时间戳、次要提示 |
| **高亮行为 (Accent)** | `bg-accent` | `#3F3F46` (选中的银灰块) | `#E4E4E7` (浅灰块) | 按钮的 Hover 态、高亮态 |

*（注：不使用红、蓝、绿等高饱和度主色调，仅在严重警告或错误状态时使用降饱和的红色或暗红色提示。）*

## 3. 核心布局 (Layout)

系统采用典型的左右分栏（或移动优先的抽屉）结构：
- **左侧边栏 (Sidebar)**：
  - 极细的透明侧栏，包含 Logo、Search Bar (全局搜索框)、"All Items", "Favorites" 等极简导航项，底部包含 Settings 齿轮。
- **主内容区 (Main Content)**：
  - 宽敞明亮/深邃的条目列表区。
  - **List Item (核心组件)**：
    - 左侧为根据 `title` 首字母生成的纯色或微渐变极简 Avatar。
    - 中间为主 Title (加粗) 与下方跟单行 Account (次灰色)。
    - 右侧为拷贝按钮与快速操作区，采用 `opacity-0 hover:opacity-100` 的悬浮显现设计，保持常规视野的极致干净。
- **详细面板 / 右侧 Drawer**：
  - 点击条目后，从右侧滑出浮在半空的毛玻璃面板 (Drawer)。
  - 内部呈现巨大的 TOTP 倒计时圆环或数字，紧接着是被 `***` 遮挡的密码。
  - Hover 及按住 "眼睛" 图标才调用系统 PIN 码并在成功后显示明文密码。

## 4. 微交互与动画 (Micro-Animations & Interaction)

一款具有"高级感"的 UI，交互的极致丝滑是核心。
- **路由切换**：使用 Framer Motion，页面切换需包含极为短暂的透明度过渡 (`opacity: 0 -> 1` 配合 `y: 5 -> 0`)，Duration: 150ms-250ms，不可拖拽卡顿。
- **Button Hover**：所有按钮不要使用僵硬的色彩跳变。使用 `transition-all duration-300` 配合 `bg-accent` 给予渐显的背景反光或轻微的压入感。
- **TOTP 复制与变化**：
  - 当 TOTP 时间到期时，旧数字的淡出和新数字的淡入要有连贯性（类似翻页时钟的细微动效）。
  - 点击复制时，原始图标变为一个优雅的绿色/白色 "Check (勾)" 并在一秒后渐隐回原样，无需笨重的 Toast 破坏画面。
- **解锁屏幕 (Lock Screen)**：启动时整个屏幕为高斯模糊的磨砂玻璃，仅中心留白一个优雅的高级密码输入框或 "点击验证 (Touch to unlock)" 按钮。验证通过后，毛玻璃迅速消散，展现背后的主界面。

## 5. 组件级建议 (基于 Shadcn/UI)
- 改造 `Input` 组件，去除粗糙的高亮边框，转为在聚焦时给予底部一条细微的银白色下划线或仅改变背景色的亮度，符合整体极简氛围。
- `Dialog` 与 `Sheet` 组件强制叠加 `backdrop-blur` 属性。
