# 每日一词一文 · Daily Words & Essays

把每天的**英语单词**和一篇**英文美文**整理成静态站点，发布到 **Cloudflare Pages**，并带一个导引导航首页。

零运行时依赖，纯 Node 静态生成，方便长期维护与自动部署。

---

## 目录结构

```
daily-english/
├── build.js              # 静态站点生成器（零依赖）
├── new-day.js            # 一键生成当天内容模板
├── serve.js              # 零依赖本地预览服务器
├── wrangler.toml         # Cloudflare Pages 配置
├── package.json
├── content/
│   └── daily/
│       ├── 2026-07-28.json   # 每天一个文件
│       └── 2026-07-27.json
├── src/
│   └── style.css         # 站点样式
└── dist/                 # 构建产物（部署目录，自动生成）
```

## 内容格式

每天一个 JSON 文件，放在 `content/daily/`。字段：

```json
{
  "date": "2026-07-28",
  "title": "每日一词一文",
  "words": [
    {
      "word": "serendipity",
      "phonetic": "/ˌserənˈdɪpəti/",
      "pos": "n.",
      "meaning": "机缘巧合",
      "enExample": "A happy serendipity.",
      "zhExample": "一次幸运的机缘巧合。"
    }
  ],
  "essay": {
    "title": "The Beauty of Slowing Down",
    "author": "Anonymous",
    "paragraphs": ["段落一", "段落二"]
  }
}
```

> 想快速新建一天？运行 `npm run new`（默认今天，也可 `node new-day.js 2026-08-01`）。

## 本地使用

```bash
npm run new      # 新建当天内容模板 -> content/daily/今天.json
# 编辑该 json 填入单词与美文
npm run build    # 生成 dist/
npm run serve    # 本地预览 http://localhost:4173
# 或一步到位：
npm run dev
```

## 发布到 Cloudflare Pages

### 方式 A：连接 Git 自动部署（推荐）

1. 本项目已托管在 GitHub：**https://github.com/truth/daily-english**
2. 在 Cloudflare Pages 控制台「创建项目」→ 连接该仓库。
3. 构建设置：
   - **构建命令 (Build command)：** `node build.js`
   - **构建输出目录 (Build output directory)：** `dist`
4. 保存并部署。之后每次 `git push` 都会自动重建并发布。

> 注意：`dist/` 与 `content/audio/*.mp3` 由本地生成/提交进仓库，Cloudflare 构建时直接复用，无需在云端重新生成语音。

### 方式 B：命令行直接部署

```bash
npm install -g wrangler      # 首次需要
npm run deploy               # 构建并部署 dist/ 到 Cloudflare Pages
```

部署完成后，Cloudflare 会给你一个 `*.pages.dev` 域名，也可在控制台绑定自定义域名。

## GitHub 仓库与每日自动同步

仓库地址：https://github.com/truth/daily-english

### 每日自动化流水线（`sync.js`）

每天 9:30 的自动化会运行 `node sync.js`，自动完成：

1. 扫描来源：美文产出目录（`english-essay-*.html` + 同名 mp3，以及 `words-*.json`）和手动收件夹 `content/inbox/`。
2. 解析并合并进 `content/daily/<日期>.json`（美文与单词分别合并，互不覆盖）；抽取词汇表、语法点、双语对照。
3. 复制美文语音、补齐缺失的单词/例句语音（edge-tts）。
4. `node build.js` 构建 `dist/`。
5. `wrangler pages deploy dist --project-name dailyecho` 部署到 Cloudflare Pages。
6. `git add -A && commit && push origin main` 把更新同步到 GitHub 仓库。

> 无新内容时直接退出，不构建不部署、也不推送。
> 环境变量开关：`SYNC_NO_DEPLOY=1`（只构建不部署）、`SYNC_NO_PUSH=1`（不推 GitHub）。

### 手动同步

```bash
npm run sync                 # 扫描来源 → 合并 → 构建 → 部署 → 推 GitHub
node sync.js "C:/path/english-essay-2026-08-01.html"   # 手动导入单个美文
```

## 生成的页面

- `index.html` —— 首页：今日推荐 + 导引导航卡片 + 最近更新
- `daily/<date>.html` —— 每日详情（单词 + 美文）
- `words.html` —— 单词本（全部单词汇总）
- `essays.html` —— 美文库（全部美文列表）
- `archive.html` —— 归档（按日期浏览）

每天只需新增一个 JSON 并重新构建，站点即自动更新。
