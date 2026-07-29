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

1. 把本项目推到 GitHub / GitLab。
2. 在 Cloudflare Pages 控制台「创建项目」→ 连接仓库。
3. 构建设置：
   - **构建命令 (Build command)：** `node build.js`
   - **构建输出目录 (Build output directory)：** `dist`
4. 保存并部署。之后每次 `git push` 都会自动重建并发布。

### 方式 B：命令行直接部署

```bash
npm install -g wrangler      # 首次需要
npm run deploy               # 构建并部署 dist/ 到 Cloudflare Pages
```

部署完成后，Cloudflare 会给你一个 `*.pages.dev` 域名，也可在控制台绑定自定义域名。

## 生成的页面

- `index.html` —— 首页：今日推荐 + 导引导航卡片 + 最近更新
- `daily/<date>.html` —— 每日详情（单词 + 美文）
- `words.html` —— 单词本（全部单词汇总）
- `essays.html` —— 美文库（全部美文列表）
- `archive.html` —— 归档（按日期浏览）

每天只需新增一个 JSON 并重新构建，站点即自动更新。
