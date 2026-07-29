#!/usr/bin/env node
/**
 * daily-english 静态站点生成器（零依赖）
 *
 * 读取 content/daily/*.json  ->  生成 dist/ 下全部页面：
 *   index.html      首页（导引导航 + 今日推荐 + 最近更新）
 *   daily/<date>.html  每日详情（单词 + 美文）
 *   words.html      单词本（全部单词聚合）
 *   essays.html     美文库（全部美文列表）
 *   archive.html    归档（按日期浏览）
 *   assets/style.css
 *   audio/*.mp3     （由 gen-audio.py 生成的语音，会被一起复制部署）
 *
 * 语音处理：若 content/audio/<name>.mp3 存在则渲染 <audio> 播放器；
 *          否则渲染「🔊 朗读」按钮，由浏览器 Web Speech API 实时合成。
 */

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const CONTENT_DIR = path.join(ROOT, "content", "daily");
const AUDIO_SRC = path.join(ROOT, "content", "audio");
// 可用环境变量 OUT_DIR 覆盖输出目录（本地预览会锁定 dist/，验证时可指定其他目录）
const DIST_DIR = process.env.OUT_DIR ? path.resolve(process.env.OUT_DIR) : path.join(ROOT, "dist");
const ASSETS_DIR = path.join(DIST_DIR, "assets");
const AUDIO_DIST = path.join(DIST_DIR, "audio");
const CSS_SRC = path.join(ROOT, "src", "style.css");

// ---------- 工具 ----------
const esc = (s = "") =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const audioExists = (name) =>
  AUDIO_SRC && fs.existsSync(path.join(AUDIO_SRC, name));

/**
 * 返回音频播放器或朗读按钮。
 * @param {string} name  音频文件名（位于 content/audio/）
 * @param {string} text  无音频时用于浏览器合成的文本
 * @param {string} label 按钮文案
 */
function audioOrSpeak(name, text, label) {
  if (audioExists(name)) {
    return `<audio controls preload="none" src="/audio/${esc(name)}"></audio>`;
  }
  return `<button class="speak-btn" type="button" data-text="${esc(text)}">🔊 ${esc(label || "朗读")}</button>`;
}

function readEntries() {
  if (!fs.existsSync(CONTENT_DIR)) return [];
  const files = fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith(".json"));
  const entries = files.map((f) => JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, f), "utf8")));
  entries.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return entries;
}

function fmtDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d)) return dateStr;
  const week = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][d.getDay()];
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${week}`;
}
const WEEKDAY_EN = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
function fmtDateEn(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d)) return dateStr;
  return `${WEEKDAY_EN[d.getDay()]}, ${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
const ensureDir = (p) => fs.mkdirSync(p, { recursive: true });

// 安全写入：先删除目标以破除被预览/其他进程持有的文件锁（Windows EPERM）
function safeWrite(file, data) {
  try { fs.rmSync(file, { force: true }); } catch (_) {}
  fs.writeFileSync(file, data);
}
function safeCopy(src, dest) {
  try { fs.rmSync(dest, { force: true }); } catch (_) {}
  fs.copyFileSync(src, dest);
}

// ---------- 页面骨架 ----------
function layout({ title, desc, body, active }) {
  const nav = (href, label) =>
    `<a href="${href}"${active === href ? ' style="color:var(--accent-ink);font-weight:700"' : ""}>${label}</a>`;
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc || "每日英语单词与美文")}" />
<link rel="stylesheet" href="/assets/style.css" />
</head>
<body>
<header class="topbar">
  <div class="wrap">
    <a class="brand" href="/index.html">
      <span class="logo">英</span><span>每日一词一文</span>
    </a>
    <nav class="nav">
      ${nav("/index.html", "首页")}
      ${nav("/words.html", "单词本")}
      ${nav("/essays.html", "美文库")}
      ${nav("/archive.html", "归档")}
    </nav>
  </div>
</header>
<main class="wrap">
${body}
</main>
<footer class="foot">
  <div class="wrap">每日英语单词与美文 · 由 Cloudflare Pages 静态托管 · 内容每日更新</div>
</footer>
<script>
document.querySelectorAll('.speak-btn').forEach(function(b){
  b.addEventListener('click', function(){
    if(!('speechSynthesis' in window)){ alert('当前浏览器不支持语音朗读'); return; }
    window.speechSynthesis.cancel();
    var u=new SpeechSynthesisUtterance(b.getAttribute('data-text'));
    u.lang='en-US'; u.rate=0.92;
    u.onend=function(){ b.textContent='🔊 朗读'; };
    u.onerror=function(){ b.textContent='🔊 朗读'; };
    b.textContent='🔊 朗读中…';
    window.speechSynthesis.speak(u);
  });
});
</script>
</body>
</html>`;
}

// ---------- 各页面 ----------
function buildIndex(entries) {
  const latest = entries[0];
  const recent = entries.slice(0, 8);

  let todayInner = "";
  if (latest) {
    const w = latest.words && latest.words[0];
    const e = latest.essay;
    todayInner = `
    <section class="today">
      <div class="today-head">
        <span class="label">今日推荐</span>
        <span class="date">${fmtDate(latest.date)}</span>
      </div>
      <div class="today-body">
        <div class="today-col">
          <h3>单词 · Words</h3>
          ${w ? `<div><span class="word">${esc(w.word)}</span><span class="phon">${esc(w.phonetic || "")}</span></div>
          <div class="mean">${esc(w.pos || "")} ${esc(w.meaning || "")}</div>` : "<div class='mean'>暂无单词</div>"}
        </div>
        <div class="today-col">
          <h3>美文 · Essay</h3>
          ${e ? `<div class="essay-title">${esc(e.title)}</div>
          <div class="essay-meta">${esc(e.author || "佚名")}</div>
          <div class="essay-excerpt">${esc((e.paragraphs && e.paragraphs[0]) || "")}</div>` : "<div class='mean'>暂无美文</div>"}
        </div>
      </div>
      <div class="today-foot"><a href="/daily/${esc(latest.date)}.html">查看 ${latest.date} 完整内容 →</a></div>
    </section>`;
  }

  const cards = [
    { ico: "📅", t: "今日 / 最新", d: "当天单词与美文", href: latest ? `/daily/${esc(latest.date)}.html` : "/archive.html" },
    { ico: "📚", t: "单词本", d: "全部单词汇总", href: "/words.html" },
    { ico: "✒️", t: "美文库", d: "精选英文美文", href: "/essays.html" },
    { ico: "🗂️", t: "归档", d: "按日期浏览", href: "/archive.html" },
  ]
    .map((c) => `<a class="card" href="${c.href}"><div class="ico">${c.ico}</div><div class="t">${c.t}</div><div class="d">${c.d}</div></a>`)
    .join("");

  const recentList = recent
    .map((e) => {
      const wn = e.words ? e.words.length : 0;
      const et = e.essay ? e.essay.title : "—";
      return `<li>
        <div class="meta">
          <span class="day">${esc(e.date)}</span>
          <span class="sub">${wn} 个单词 · 美文《${esc(et)}》</span>
        </div>
        <a class="go" href="/daily/${esc(e.date)}.html">查看 →</a>
      </li>`;
    })
    .join("");

  const body = `
  <section class="hero">
    <div class="eyebrow">Daily Words & Essays</div>
    <h1>每天一点英语，积少成多</h1>
    <p>在这里整理每天的英语单词与一篇英文美文，温故知新，让阅读成为习惯。</p>
  </section>
  ${todayInner}
  <div class="cards">${cards}</div>
  <h2 class="section-title">最近更新</h2>
  <ul class="recent">${recentList}</ul>
  `;

  return layout({ title: "每日一词一文 · 首页", desc: "每日英语单词与美文整理站", body, active: "/index.html" });
}

function wordBlock(words, date, withAudio) {
  return (words || [])
    .map((w, i) => {
      const an = `${date}_w${i}.mp3`;
      const player = withAudio ? `<div class="player">${audioOrSpeak(an, w.word, "朗读单词")}</div>` : "";
      const exPlayer = withAudio && w.enExample
        ? `<div class="player">${audioOrSpeak(an.replace(".mp3", "_ex.mp3"), w.enExample, "读例句")}</div>`
        : "";
      return `<div class="word-item">
      <div class="top">
        <span class="w">${esc(w.word)}</span>
        ${w.phonetic ? `<span class="ph">${esc(w.phonetic)}</span>` : ""}
        ${w.pos ? `<span class="pos">${esc(w.pos)}</span>` : ""}
      </div>
      ${w.meaning ? `<p class="m">${esc(w.meaning)}</p>` : ""}
      ${w.enExample ? `<p class="ex">${esc(w.enExample)}</p>` : ""}
      ${w.zhExample ? `<p class="ex"><b>译：</b>${esc(w.zhExample)}</p>` : ""}
      ${w.note ? `<p class="note">💡 ${esc(w.note)}</p>` : ""}
      ${player}${exPlayer}
    </div>`;
    })
    .join("");
}

function buildDay(e) {
  const wordsHtml = wordBlock(e.words, e.date, true);
  const essay = e.essay;
  const essayHtml = essay
    ? `<div class="essay">
        <div class="e-title">${esc(essay.title)}</div>
        <div class="e-author">${esc(essay.author || "佚名")}</div>
        <div class="player">${audioOrSpeak(`${e.date}_essay.mp3`, (essay.paragraphs || []).join(" "), "朗读全文")}</div>
        <div class="pairs">
          ${(essay.paragraphs || []).map((p, i) => `
            <div class="pair">
              <p class="en">${esc(p)}</p>
              ${essay.translations && essay.translations[i] ? `<p class="zh">${esc(essay.translations[i])}</p>` : ""}
            </div>`).join("")}
        </div>
        ${essay.grammar && essay.grammar.length ? `
        <div class="grammar">
          <h3>语法点 · Grammar Notes</h3>
          ${essay.grammar.map((g) => `
            <div class="g-item">
              <div class="g-point">${esc(g.point)}</div>
              ${g.example ? `<div class="g-ex"><b>例：</b>${esc(g.example)}</div>` : ""}
              ${g.note ? `<div class="g-note">${esc(g.note)}</div>` : ""}
            </div>`).join("")}
        </div>` : ""}
        ${(essay.vocab && essay.vocab.length) ? `
        <div class="vocab-sec">
          <h3>词汇与短语 · Vocabulary</h3>
          ${essay.vocab.map((v) => `
            <div class="vocab-item">
              <div class="v-top"><span class="v-term">${esc(v.term)}</span>${v.pos ? `<span class="v-pos">${esc(v.pos)}</span>` : ""}</div>
              ${v.meaning ? `<p class="v-mean">${esc(v.meaning)}</p>` : ""}
              ${v.enExample ? `<p class="v-ex"><b class="v-label">EN</b> ${esc(v.enExample)}</p>` : ""}
              ${v.zhExample ? `<p class="v-ex"><b class="v-label">中</b> ${esc(v.zhExample)}</p>` : ""}
              ${v.note ? `<p class="v-note">${esc(v.note)}</p>` : ""}
            </div>`).join("")}
        </div>` : ""}
      </div>`
    : `<p class="m">今日暂无美文。</p>`;

  const body = `
  <div class="page-head">
    <div class="crumb"><a href="/index.html">首页</a> / ${esc(e.date)}</div>
    <h1>${esc(e.title || "每日一词一文")}</h1>
    <div class="date">${fmtDate(e.date)} · ${fmtDateEn(e.date)}</div>
  </div>
  <section class="block">
    <h2>单词 · Words</h2>
    ${wordsHtml || '<p class="m">今日暂无单词。</p>'}
  </section>
  <section class="block">
    <h2>美文 · Essay</h2>
    ${essayHtml}
  </section>
  `;
  return layout({ title: `${e.date} · 每日一词一文`, desc: e.title || "每日英语单词与美文", body, active: "" });
}

function buildWords(entries) {
  const items = [];
  entries.forEach((e) => (e.words || []).forEach((w, i) => items.push({ ...w, date: e.date, idx: i })));
  const list = items
    .map((w) => {
      const an = `${w.date}_w${w.idx}.mp3`;
      const player = `<div class="player">${audioOrSpeak(an, w.word, "朗读")}</div>`;
      return `<li>
      <div class="top" style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap">
        <span class="tag">${esc(w.date)}</span>
        <span class="w" style="font-family:var(--serif);font-size:20px;font-weight:700">${esc(w.word)}</span>
        ${w.phonetic ? `<span class="ph" style="color:var(--muted)">${esc(w.phonetic)}</span>` : ""}
        ${w.pos ? `<span class="pos" style="font-size:12px;color:#fff;background:var(--accent);padding:1px 8px;border-radius:20px">${esc(w.pos)}</span>` : ""}
      </div>
      ${w.meaning ? `<p class="m" style="margin:6px 0 0;color:var(--ink-soft)">${esc(w.meaning)}</p>` : ""}
      ${player}
    </li>`;
    })
    .join("");
  const body = `
  <div class="page-head">
    <div class="crumb"><a href="/index.html">首页</a> / 单词本</div>
    <h1>单词本</h1>
    <div class="date">共收录 ${items.length} 个单词</div>
  </div>
  <ul class="list">${list || '<li>暂无单词，去 content/daily/ 添加吧。</li>'}</ul>
  `;
  return layout({ title: "单词本 · 每日一词一文", body, active: "/words.html" });
}

function buildEssays(entries) {
  const list = entries
    .filter((e) => e.essay)
    .map((e) => {
      const ex = (e.essay.paragraphs && e.essay.paragraphs[0]) || "";
      const exZh = (e.essay.translations && e.essay.translations[0]) || "";
      const player = `<div class="player">${audioOrSpeak(`${e.date}_essay.mp3`, (e.essay.paragraphs || []).join(" "), "朗读全文")}</div>`;
      return `<li>
        <span class="tag">${esc(e.date)}</span>
        <a href="/daily/${esc(e.date)}.html" style="font-family:var(--serif);font-size:18px;font-weight:700">${esc(e.essay.title)}</a>
        <div class="essay-meta" style="color:var(--muted);font-size:13px;margin:4px 0">${esc(e.essay.author || "佚名")}</div>
        <div class="pair" style="margin:6px 0">
          <p class="en" style="margin:0 0 4px;font-size:15px;line-height:1.8">${esc(ex)}</p>
          ${exZh ? `<p class="zh" style="margin:0;font-size:14px">${esc(exZh)}</p>` : ""}
        </div>
        ${player}
      </li>`;
    })
    .join("");
  const body = `
  <div class="page-head">
    <div class="crumb"><a href="/index.html">首页</a> / 美文库</div>
    <h1>美文库</h1>
    <div class="date">共 ${entries.filter((e) => e.essay).length} 篇美文</div>
  </div>
  <ul class="list">${list || '<li>暂无美文。</li>'}</ul>
  `;
  return layout({ title: "美文库 · 每日一词一文", body, active: "/essays.html" });
}

function buildArchive(entries) {
  const list = entries
    .map((e) => {
      const wn = e.words ? e.words.length : 0;
      const et = e.essay ? e.essay.title : "—";
      return `<li>
        <div class="meta" style="display:flex;align-items:center;gap:14px">
          <span class="day" style="font-family:var(--serif);font-weight:700">${esc(e.date)}</span>
          <span class="sub" style="font-size:13px;color:var(--muted)">${wn} 个单词 · 美文《${esc(et)}》</span>
        </div>
        <a class="go" href="/daily/${esc(e.date)}.html" style="font-size:13px;color:var(--accent-ink)">查看 →</a>
      </li>`;
    })
    .join("");
  const body = `
  <div class="page-head">
    <div class="crumb"><a href="/index.html">首页</a> / 归档</div>
    <h1>归档</h1>
    <div class="date">共 ${entries.length} 天内容</div>
  </div>
  <ul class="list">${list || '<li>暂无内容。</li>'}</ul>
  `;
  return layout({ title: "归档 · 每日一词一文", body, active: "/archive.html" });
}

// ---------- 主流程 ----------
function copyAudio() {
  if (!fs.existsSync(AUDIO_SRC)) return 0;
  ensureDir(AUDIO_DIST);
  const files = fs.readdirSync(AUDIO_SRC).filter((f) => f.endsWith(".mp3"));
  files.forEach((f) => safeCopy(path.join(AUDIO_SRC, f), path.join(AUDIO_DIST, f)));
  return files.length;
}

function main() {
  const entries = readEntries();
  ensureDir(DIST_DIR);
  ensureDir(ASSETS_DIR);
  ensureDir(path.join(DIST_DIR, "daily"));

  safeCopy(CSS_SRC, path.join(ASSETS_DIR, "style.css"));
  const audioCount = copyAudio();

  safeWrite(path.join(DIST_DIR, "index.html"), buildIndex(entries));
  entries.forEach((e) =>
    safeWrite(path.join(DIST_DIR, "daily", `${e.date}.html`), buildDay(e))
  );
  safeWrite(path.join(DIST_DIR, "words.html"), buildWords(entries));
  safeWrite(path.join(DIST_DIR, "essays.html"), buildEssays(entries));
  safeWrite(path.join(DIST_DIR, "archive.html"), buildArchive(entries));

  console.log(
    `✅ 构建完成：${entries.length} 天内容 -> dist/（首页 + ${entries.length} 每日页 + 单词本/美文库/归档；含 ${audioCount} 个语音文件）`
  );
}

main();
