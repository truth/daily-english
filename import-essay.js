#!/usr/bin/env node
/**
 * 将「每日英语美文」独立 HTML 文件解析为站点可用的当日内容，并合并进 content/daily/<date>.json。
 *
 * 支持两套自动化产出的 HTML 结构（解析器容错）：
 *   结构A（早期）：  .pair>.en/.zh  |  .word>.term/.pos/.def/.ex  |  .grammar>.pt/.ex/.note
 *   结构B（当前）：  .pair><p.en>/<p.zh>  |  .vocab>.word/.pos/<p>/.ex  |  .grammar>.g-title/.g-sent/<p>
 * 无论哪套，都统一抽出：
 *   essay.paragraphs   英文段落（数组）
 *   essay.translations 中文译文（数组，与段落对齐）
 *   essay.grammar     语法点 [{point, example, note}]
 *   essay.vocab       词汇/短语 [{term, pos, meaning, enExample, zhExample, note}]
 *
 * 注意：每日「5 个单词」来自单独的 words-YYYY-MM-DD.json（由单词自动化写出），
 *       不从此处抽取，避免与美文自带的词汇表混淆。
 *
 * 导出（供 sync.js 复用）：
 *   parseEssayFile(input) -> { date, essay, words:[], mp3src }
 *   mergeIntoDaily(date, patch) -> 合并 patch{essay?,words?} 进 content/daily/<date>.json
 *
 * 命令行：
 *   node import-essay.js <path-to-html>    导入并合并
 *   node import-essay.js                  默认尝试 ../english-essay-*.html
 */
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const OUT_DIR = path.join(ROOT, "content", "daily");
const AUDIO_DIR = path.join(ROOT, "content", "audio");

function clean(s) {
  if (!s) return "";
  return s
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractAll(re, html) {
  const out = [];
  let m;
  while ((m = re.exec(html)) !== null) out.push(m);
  return out;
}

// 把「英文. 中文」拆成英文/中文（取首个中文字符分界）
function splitEnZh(t) {
  const cjk = t.search(/[一-鿿]/);
  if (cjk < 0) return { en: t, zh: "" };
  return { en: t.slice(0, cjk).trim(), zh: t.slice(cjk).trim() };
}

function parseWordEx(cleaned) {
  const idx = cleaned.indexOf("例：");
  if (idx === -1) return { enExample: "", zhExample: "", note: cleaned };
  const note = cleaned.slice(0, idx).trim().replace(/[；;。\s]+$/, "");
  const rest = cleaned.slice(idx + 2).trim();
  const m = rest.match(/^(.*?)\.\s*([一-鿿].*)$/);
  if (m) return { enExample: m[1].trim() + ".", zhExample: m[2].trim(), note };
  return { enExample: rest, zhExample: "", note };
}

// ---------- 双语段落 ----------
function parsePairs(html) {
  const re = /<div class="pair">\s*(?:<div class="en">|<p class="en">)([\s\S]*?)(?:<\/div>|<\/p>)\s*(?:<div class="zh">|<p class="zh">)([\s\S]*?)(?:<\/div>|<\/p>)\s*<\/div>/g;
  return extractAll(re, html).map((m) => ({ en: clean(m[1]), zh: clean(m[2]) }));
}

// ---------- 语法点 ----------
function parseGrammar(html) {
  const re = /<div class="grammar">([\s\S]*?)<\/div>\s*(?=<div class="grammar">|<\/section>)/g;
  return extractAll(re, html)
    .map((m) => {
      const g = m[1];
      const point =
        (g.match(/<div class="g-title">([\s\S]*?)<\/div>/) || g.match(/<div class="pt">([\s\S]*?)<\/div>/) || [])[1] || "";
      const example =
        (g.match(/<div class="g-sent">([\s\S]*?)<\/div>/) || g.match(/<div class="ex">([\s\S]*?)<\/div>/) || [])[1] || "";
      const note =
        (g.match(/<div class="note">([\s\S]*?)<\/div>/) || g.match(/<p>([\s\S]*?)<\/p>/) || [])[1] || "";
      return { point: clean(point), example: clean(example), note: clean(note) };
    })
    .filter((x) => x.point || x.example || x.note);
}

// ---------- 词汇/短语表 ----------
function parseVocab(html) {
  const out = [];
  // 结构B: .vocab
  const vocabRe = /<div class="vocab">([\s\S]*?)<\/div>\s*(?=<div class="vocab">|<\/section>)/g;
  for (const m of extractAll(vocabRe, html)) {
    const v = m[1];
    const term = (v.match(/<span class="word">([\s\S]*?)<\/span>/) || [])[1] || "";
    const pos = (v.match(/<span class="pos">([\s\S]*?)<\/span>/) || [])[1] || "";
    const ps = extractAll(/<p(?:\s+class="([^"]*)")?>([\s\S]*?)<\/p>/g, v);
    let meaning = "", enExample = "", zhExample = "", noteLines = [];
    for (const p of ps) {
      const cls = p[1] || "";
      const t = clean(p[2]);
      if (cls === "ex") {
        const s = splitEnZh(t);
        enExample = s.en; zhExample = s.zh;
      } else if (/词义/.test(t)) {
        meaning = t.replace(/^[^：:]*[：:]\s*/, "");
      } else if (t) {
        noteLines.push(t);
      }
    }
    out.push({ term: clean(term), pos: clean(pos), meaning, enExample, zhExample, note: noteLines.join("；") });
  }
  // 结构A: .word
  const wordRe = /<div class="word">([\s\S]*?)<\/div>\s*(?=<div class="word">|<\/section>)/g;
  for (const m of extractAll(wordRe, html)) {
    const w = m[1];
    const term = (w.match(/<div class="term">([\s\S]*?)<\/div>/) || [])[1] || "";
    const pos = (w.match(/<span class="pos">([\s\S]*?)<\/span>/) || [])[1] || "";
    const def = (w.match(/<div class="def">([\s\S]*?)<\/div>/) || [])[1] || "";
    const exRaw = (w.match(/<div class="ex">([\s\S]*?)<\/div>/) || [])[1] || "";
    const ex = parseWordEx(clean(exRaw));
    out.push({
      term: clean(term),
      pos: clean(pos),
      meaning: clean(def),
      enExample: ex.enExample,
      zhExample: ex.zhExample,
      note: ex.note,
    });
  }
  return out.filter((x) => x.term);
}

function parseEssayFile(input) {
  if (!fs.existsSync(input)) throw new Error("文件不存在：" + input);
  const html = fs.readFileSync(input, "utf8");
  const base = path.basename(input);
  const dm = base.match(/(\d{4}-\d{2}-\d{2})/);
  const date = dm ? dm[1] : "unknown";

  const titleM = html.match(/<h1>(.*?)<\/h1>/s);
  const title = titleM ? clean(titleM[1]) : "每日一词一文";

  const pairs = parsePairs(html);
  const paragraphs = pairs.map((p) => p.en);
  const translations = pairs.map((p) => p.zh);
  const grammar = parseGrammar(html);
  const vocab = parseVocab(html);

  const essay = { title, author: "佚名", paragraphs };
  if (translations.length) essay.translations = translations;
  if (grammar.length) essay.grammar = grammar;
  if (vocab.length) essay.vocab = vocab;

  // 同目录下的语音文件
  const dir = path.dirname(input);
  const cand = [
    path.join(dir, `english-essay-${date}.mp3`),
    path.join(dir, `essay-${date}.mp3`),
    path.join(dir, `${date}-essay.mp3`),
  ];
  const mp3src = cand.find((p) => fs.existsSync(p)) || null;

  return { date, essay, words: [], mp3src };
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function mergeIntoDaily(date, patch) {
  const file = path.join(OUT_DIR, `${date}.json`);
  let cur = { date, title: "每日一词一文", words: [], essay: null };
  if (fs.existsSync(file)) {
    try {
      cur = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (_) {}
  }
  if (patch.essay !== undefined) cur.essay = patch.essay;
  if (patch.words !== undefined) cur.words = patch.words;
  cur.date = date;
  if (!cur.title) cur.title = "每日一词一文";
  ensureDir(OUT_DIR);
  fs.writeFileSync(file, JSON.stringify(cur, null, 2), "utf8");
  return file;
}

function importEssayCli(input) {
  let target = input;
  if (!target) {
    const parent = path.resolve(ROOT, "..");
    const found = fs.readdirSync(parent).filter((f) => /^english-essay-.*\.html$/i.test(f));
    if (!found.length) {
      console.error("未找到 english-essay-*.html，请显式传入路径：node import-essay.js <file>");
      process.exit(1);
    }
    target = path.join(parent, found[0]);
  }
  const { date, essay, mp3src } = parseEssayFile(target);
  const out = mergeIntoDaily(date, { essay });
  if (mp3src) {
    ensureDir(AUDIO_DIR);
    fs.copyFileSync(mp3src, path.join(AUDIO_DIR, `${date}_essay.mp3`));
  }
  console.log(
    `✅ 已合并 ${out}\n   段落 ${essay.paragraphs.length} · 译文 ${essay.translations ? essay.translations.length : 0} · ` +
      `语法 ${essay.grammar ? essay.grammar.length : 0} · 词汇 ${essay.vocab ? essay.vocab.length : 0}`
  );
}

module.exports = { parseEssayFile, mergeIntoDaily };

if (require.main === module) importEssayCli(process.argv[2]);
