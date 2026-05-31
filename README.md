# 拾遗补阙 · 论文灵感助手

> 微信小程序｜上传论文初稿，AI 生成小红书风格审稿卡片，帮人文社科研究者快速发现盲区、补全文献。

<p align="center">
  <img src="logo/logo.png" alt="拾遗补阙 Logo" width="120" />
</p>

---

## 📺 产品演示

https://github.com/user-attachments/assets/6af1cef3-89e0-432c-8af4-5780c9a01c18

<video src="https://raw.githubusercontent.com/jiayusu/Hackthon_xiaoyaoyou/master/拾遗补阙_小程序.mp4" controls width="100%" poster="logo/logo.png"></video>

---

## 🧭 产品定位

**拾遗补阙** 是一款面向人文社科研究者（初学者）的微信小程序。你只需上传论文初稿或研究想法，系统会调用多个 AI Agent 并行审稿，并以「小红书风格」卡片流的形式呈现反馈——包括审稿意见、文献补全、同类研究对比等。阅读卡片时支持收藏与笔记，最后可通过「洞察」功能将收藏内容提炼为一篇深度认知报告。

### 我们解决的问题

| 痛点 | 方案 |
|------|------|
| 论文写完无人审阅，不知道写得怎么样 | 多 Agent 并行审稿，多视角反馈 |
| 文献综述耗时耗力，容易遗漏关键论文 | 自动检索相关文献，生成关联分析卡片 |
| 审稿意见太长太干，看不下去 | 小红书卡片瀑布流，标题+摘要一眼扫完 |
| 碎片化灵感难以沉淀 | 收藏 → 笔记 → 洞察，形成认知闭环 |

---

## ✨ 核心功能

### 1. 🚀 上传 & 多 Agent 审稿
- 支持输入文本 / 上传 TXT、MD 文件
- 后端调用多 Agent 并行处理
- 实时进度反馈（进度条动画）

### 2. 🃏 卡片瀑布流
- 审稿结果以两列图文卡片展示（类似小红书）
- 支持上下滑动触发实时刷新、加载更多卡片
- 每张卡片：图片（AI 生成 SVG）+ 标题 + 摘要

### 3. 📚 拾遗补阙（文献补全）
- 自动检索与用户研究主题相关的学术文献
- 生成关联分析卡片（含论文标题、DOI、链接、被引次数）

### 4. 🧠 洞察
- 基于用户收藏的卡片文字 + 笔记，AI 生成深度认知报告
- 流式输出，实时打字效果
---

## 🎨 设计规范

| 属性 | 值 |
|------|-----|
| 主色 | `#7785AC`（灰蓝 / 学术感） |
| 辅色 | `#360568` `#5b2a86` `#9ac6c5` `#a5e6ba` |
| 字体 | 非衬线体（系统默认） |
| 卡片布局 | 双列瀑布流，图在上、文在下 |
| 交互风格 | 小红书风格卡片 + 流畅动效 |

---

## 🛠 技术架构

```
┌──────────────────────────────────────┐
│           微信小程序前端              │
│  splash → upload → main（三页面）     │
│  canvas-render / md-parser / svg-gen │
└──────────────┬───────────────────────┘
               │ wx.request (stream)
┌──────────────▼───────────────────────┐
│          DeepSeek Chat API           │
│  · 24 Agent 并行审稿                  │
│  · 文献检索 & 关联分析                │
│  · 洞察报告生成（流式）               │
└──────────────────────────────────────┘
```

- **框架**: 微信小程序原生（Skyline 渲染引擎 + glass-easel 组件）
- **AI**: DeepSeek Chat API（`deepseek-chat`）
- **渲染**: Canvas SVG 生成 + Markdown 解析
- **存储**: wx.Storage（本地持久化）+ JSON 序列化

---

## 📁 项目结构

```
拾遗补阙/
├── app.js / app.json / app.wxss     # 小程序入口 & 全局配置
├── project.config.json              # 微信开发者工具配置
├── sitemap.json
├── pages/
│   ├── splash/                      # 开屏动画页
│   ├── upload/                      # 上传资源页
│   └── main/                        # 主页（相关 / 历史 / 洞察）
├── components/
│   ├── navigation-bar/              # 自定义顶栏
│   └── loading-modal/               # 加载进度弹窗
├── utils/
│   ├── api.js                       # DeepSeek API 请求封装
│   ├── syb-api.js                   # 拾遗补阙文献检索
│   ├── syb-agent.js                 # 智能体 & 卡片生成流水线
│   ├── svg-gen.js                   # AI SVG 卡片生成
│   ├── canvas-render.js             # Canvas 占位图渲染
│   ├── card-templates.js            # 卡片模板库
│   ├── md-parser.js                 # Markdown 解析器
│   ├── config.example.js            # 配置文件模板
│   └── config.js                    # 本地配置（已 gitignore）
├── icons/                           # SVG 图标
├── logo/                            # Logo 资源
└── README.md
```

---

## 🚀 快速开始

### 前置条件
- [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
- 微信小程序 AppID（在 `project.config.json` 中配置）
- DeepSeek API Key（[获取地址](https://platform.deepseek.com/)）

### 1. 克隆项目

```bash
git clone https://github.com/jiayusu/Hackthon_xiaoyaoyou.git
```

### 2. 配置 API Key

```bash
cp utils/config.example.js utils/config.js
```

编辑 `utils/config.js`，将 `YOUR_API_KEY_HERE` 替换为你的 DeepSeek API Key。

### 3. 导入开发者工具

打开微信开发者工具 → 导入项目 → 选择项目根目录 → 填入 AppID → 开始开发。

---

## ⚙️ 配置说明

`utils/config.js`（需自行创建，不会被提交到 Git）：

```js
module.exports = {
  apiBaseUrl: 'https://api.deepseek.com',
  apiKey: 'sk-xxxxxxxxxxxxxxxx',  // 替换为你的 Key
  model: 'deepseek-chat'
};
```

---

## 📄 License

MIT

---

<p align="center">
  <sub>Made with ❤️ by Hackathon Team · 拾遗补阙</sub>
</p>
