#!/usr/bin/env node
/**
 * 同步流水线：把「每日英语单词 / 每日英语美文」合并进 dailyecho 网站并发布。
 *
 * 抓取来源（按序扫描）：
 *   1) 美文自动化产出目录 ESSAY_WS（english-essay-YYYY-MM-DD.html + 同名 mp3；单词 JSON 也写这里）
 *   2) 手动收件夹 content/inbox/（english-essay-*.html / words-*.json / words-*.txt）
 *
 * 处理流程：
 *   1) 解析 → 合并进 content/daily/<date>.json（essay 与 words 分别合并，互不覆盖）
 *   2) 复制美文语音到 content/audio/<date>_essay.mp3
 *   3) 补齐缺失语音（gen-audio.py，先删 0 字节避免被跳过）
 *   4) node build.js 构建 dist/
 *   5) wrangler pages deploy dist --project-name dailyecho
 *   6) git commit + push origin main（同步到 GitHub 仓库）
 * 无新内容时直接退出，不构建不部署。
 *
 * 幂等保护：
 *   - 已存在于 content/daily 的日期（= 已部署过）其源文件直接跳过，避免回退线上内容。
 *   - content/.sync-state.json 记录每个源文件「大小+修改时间」签名；未变化则跳过，变化（自动化重生成）则重新合并。
 *
 * 环境变量：
 *   SYNC_NO_DEPLOY=1   只构建不部署（本地测试用）
 *   SYNC_NO_PUSH=1     构建/部署后不推送到 GitHub
 *   ESSAY_WS=<path>    覆盖美文产出目录
 *   GEN_PYTHON=<path>  指定带 edge-tts 的 python
 *
 * 用法：
 *   node sync.js                                    自动扫描来源
 *   node sync.js "C:/path/english-essay-x.html"     手动导入单个文件（仍走合并+部署）
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = __dirname;
const INBOX = path.join(ROOT, "content", "inbox");
const DONE = path.join(INBOX, "done");
const AUDIO = path.join(ROOT, "content", "audio");
const DAILY = path.join(ROOT, "content", "daily");
const STATE_FILE = path.join(ROOT, "content", ".sync-state.json");
const ESSAY_WS = process.env.ESSAY_WS || "C:\\Users\\truth\\WorkBuddy\\2026-07-28-13-21-58";
const { parseEssayFile, mergeIntoDaily } = require("./import-essay.js");

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}
function dateOf(name) {
  const m = path.basename(name).match(/(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}
function sig(file) {
  try {
    const s = fs.statSync(file);
    return `${s.size}-${s.mtimeMs}`;
  } catch (_) {
    return "missing";
  }
}
function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch (_) {
    return { files: {} };
  }
}
function saveState(st) {
  ensureDir(path.dirname(STATE_FILE));
  fs.writeFileSync(STATE_FILE, JSON.stringify(st, null, 2), "utf8");
}
function existingDates() {
  if (!fs.existsSync(DAILY)) return new Set();
  return new Set(
    fs
      .readdirSync(DAILY)
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(/\.json$/, ""))
  );
}
function findPython() {
  if (process.env.GEN_PYTHON && fs.existsSync(process.env.GEN_PYTHON)) return process.env.GEN_PYTHON;
  const venv = "C:\\Users\\truth\\.workbuddy\\binaries\\python\\envs\\default\\Scripts\\python.exe";
  if (fs.existsSync(venv)) return venv;
  return "python3";
}
function parseWordsFile(file) {
  const ext = path.extname(file).toLowerCase();
  const date = dateOf(file) || "unknown";
  if (ext === ".json") {
    const arr = JSON.parse(fs.readFileSync(file, "utf8"));
    const words = Array.isArray(arr) ? arr : arr.words || [];
    return { date, words };
  }
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const words = lines.map((line) => {
    const [word, pos, meaning, enExample, zhExample, note] = line.split("|").map((s) => s.trim());
    const w = { word };
    if (pos) w.pos = pos;
    if (meaning) w.meaning = meaning;
    if (enExample) w.enExample = enExample;
    if (zhExample) w.zhExample = zhExample;
    if (note) w.note = note;
    return w;
  });
  return { date, words };
}
function copyEssayMp3(date, mp3src) {
  if (!mp3src) return;
  ensureDir(AUDIO);
  fs.copyFileSync(mp3src, path.join(AUDIO, `${date}_essay.mp3`));
}
function moveEssayToDone(srcDir, date) {
  // 把已处理的收件夹美文 html + 其 mp3 移到 done/
  for (const name of [`english-essay-${date}.html`, `english-essay-${date}.mp3`, `essay-${date}.mp3`]) {
    const from = path.join(srcDir, name);
    if (fs.existsSync(from)) {
      try {
        fs.renameSync(from, path.join(DONE, name));
      } catch (_) {}
    }
  }
}
function run(cmd, args) {
  // shell:true 让 Windows 能解析 wrangler.cmd、git 等可执行文件
  execFileSync(cmd, args, { cwd: ROOT, stdio: "inherit", shell: true });
}
function gitSync() {
  if (process.env.SYNC_NO_PUSH) {
    console.log("🔸 SYNC_NO_PUSH=1，跳过 GitHub 推送。");
    return;
  }
  try {
    const status = execFileSync("git", ["status", "--porcelain"], { cwd: ROOT, encoding: "utf8" }).trim();
    if (!status) {
      console.log("🔸 git 工作区无变更，跳过提交。");
      return;
    }
    run("git", ["add", "-A"]);
    const msg = "chore: 同步每日英语内容 " + new Date().toISOString().slice(0, 10);
    run("git", ["commit", "-q", "-m", msg]);
    run("git", ["push", "origin", "main"]);
    console.log("🔗 已推送至 GitHub：https://github.com/truth/daily-english");
  } catch (e) {
    console.error("⚠️ git 同步至 GitHub 失败（不影响站点部署）：", e.message);
  }
}

function main() {
  ensureDir(INBOX);
  ensureDir(DONE);
  const state = loadState();
  state.files = state.files || {};
  const existing = existingDates();
  const changed = [];
  const manual = process.argv[2];

  if (manual) {
    // 手动导入单个文件
    const f = manual;
    if (!fs.existsSync(f)) {
      console.error("文件不存在：", f);
      process.exit(1);
    }
    const base = path.basename(f);
    if (/english-essay-.*\.html$/i.test(base)) {
      const { date, essay, mp3src } = parseEssayFile(f);
      mergeIntoDaily(date, { essay });
      copyEssayMp3(date, mp3src);
      changed.push(`美文 ${date}`);
    } else if (/words-.*\.(json|txt)$/i.test(base)) {
      const { date, words } = parseWordsFile(f);
      mergeIntoDaily(date, { words });
      changed.push(`单词 ${date} (${words.length})`);
    } else {
      console.error("无法识别的文件类型：", base);
      process.exit(1);
    }
  } else {
    // 扫描来源：美文产出目录 + 收件夹
    const sources = [
      { dir: ESSAY_WS, move: false },
      { dir: INBOX, move: true },
    ];
    for (const src of sources) {
      if (!fs.existsSync(src.dir)) continue;
      const files = fs.readdirSync(src.dir);

      // 美文 HTML
      for (const f of files.filter((x) => /^english-essay-.*\.html$/i.test(x))) {
        const full = path.join(src.dir, f);
        const date = dateOf(f);
        const key = full;
        const s = sig(full);
        if (state.files[key] === s) continue; // 未变化，跳过
        if (existing.has(date)) {
          // 已部署过该日期，仅登记签名，不回退线上内容
          state.files[key] = s;
          continue;
        }
        try {
          const { date: d, essay, mp3src } = parseEssayFile(full);
          mergeIntoDaily(d, { essay });
          copyEssayMp3(d, mp3src);
          if (src.move) moveEssayToDone(src.dir, d);
          changed.push(`美文 ${d}`);
          state.files[key] = s;
        } catch (e) {
          console.error("解析失败：", f, e.message);
        }
      }

      // 单词 JSON / TXT
      for (const f of files.filter((x) => /^words-.*\.(json|txt)$/i.test(x))) {
        const full = path.join(src.dir, f);
        const date = dateOf(f);
        const key = full;
        const s = sig(full);
        if (state.files[key] === s) continue;
        if (existing.has(date)) {
          state.files[key] = s;
          continue;
        }
        try {
          const { date: d, words } = parseWordsFile(full);
          mergeIntoDaily(d, { words });
          if (src.move) {
            try { fs.renameSync(full, path.join(DONE, f)); } catch (_) {}
          }
          changed.push(`单词 ${d} (${words.length})`);
          state.files[key] = s;
        } catch (e) {
          console.error("解析失败：", f, e.message);
        }
      }
    }
  }

  if (!changed.length) {
    saveState(state);
    console.log("📭 无新内容，跳过构建与部署。");
    return;
  }
  console.log("🔄 新内容：" + changed.join("；"));

  // 补齐语音：先删 0 字节，再生成（已存在的美文 mp3 会被跳过，保留原版）
  if (fs.existsSync(AUDIO)) {
    for (const a of fs.readdirSync(AUDIO).filter((x) => x.endsWith(".mp3"))) {
      const p = path.join(AUDIO, a);
      if (fs.statSync(p).size === 0) fs.rmSync(p);
    }
  }
  run(findPython(), ["gen-audio.py"]);
  run("node", ["build.js"]);

  if (process.env.SYNC_NO_DEPLOY) {
    gitSync();
    saveState(state);
    console.log("🧪 SYNC_NO_DEPLOY=1，已构建 dist/ 但未部署。");
    return;
  }
  run("wrangler", ["pages", "deploy", "dist", "--project-name", "dailyecho"]);
  gitSync();
  saveState(state);
  console.log("🚀 已部署到 dailyecho（https://dailyecho.pages.dev）并同步至 GitHub。");
}

main();
