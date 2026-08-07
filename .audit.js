#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const ROOT = __dirname;
const { parseEssayFile } = require("./import-essay.js");

const ESSAY_WS = "C:\\Users\\truth\\WorkBuddy\\2026-07-28-13-21-58";
const DAILY = path.join(ROOT, "content", "daily");
const audioDir = path.join(ROOT, "content", "audio");

const dates = ["2026-07-27","2026-07-28","2026-07-29","2026-07-30","2026-07-31","2026-08-01","2026-08-02","2026-08-03"];

function fsize(p){ try { return fs.statSync(p).size; } catch(e){ return -1; } }

console.log("========== A. 源 HTML 解析校验（用当前 import-essay.js 重新解析）==========");
for (const d of dates) {
  const html = path.join(ESSAY_WS, `english-essay-${d}.html`);
  if (!fs.existsSync(html)) { console.log(`  [${d}] 源HTML缺失`); continue; }
  try {
    const { essay } = parseEssayFile(html);
    const p = essay.paragraphs.length, t = (essay.translations||[]).length;
    const g = (essay.grammar||[]).length, v = (essay.vocab||[]).length;
    const flag = (p===0) ? "  ⚠️段落为空(格式可能不匹配!)" : (p!==t ? "  ⚠️段落/译文数不一致" : "");
    console.log(`  [${d}] 段落=${p} 译文=${t} 语法=${g} 词汇=${v}${flag}`);
  } catch(e){ console.log(`  [${d}] 解析异常: ${e.message}`); }
}

console.log("\n========== B. 源 words JSON 校验 ==========");
const wordSources = ["2026-07-29","2026-07-30","2026-08-02","2026-08-03"];
for (const d of dates) {
  const js = wordSources.includes(d) ? path.join(ESSAY_WS, `words-${d}.json`) : null;
  if (!js || !fs.existsSync(js)) { console.log(`  [${d}] 源单词JSON: 无`); continue; }
  try {
    const arr = JSON.parse(fs.readFileSync(js,"utf8"));
    const words = Array.isArray(arr) ? arr : (arr.words||[]);
    const bad = words.filter(w => !w.word || !w.meaning || !w.enExample);
    console.log(`  [${d}] 单词数=${words.length} 缺字段数=${bad.length} ${bad.length? "⚠️":""}`);
  } catch(e){ console.log(`  [${d}] JSON解析失败: ${e.message} ⚠️`); }
}

console.log("\n========== C. 已合并 content/daily 完整性 ==========");
for (const d of dates) {
  const f = path.join(DAILY, `${d}.json`);
  if (!fs.existsSync(f)) { console.log(`  [${d}] 缺失!`); continue; }
  let obj;
  try { obj = JSON.parse(fs.readFileSync(f,"utf8")); }
  catch(e){ console.log(`  [${d}] JSON损坏: ${e.message} ⚠️`); continue; }
  const words = obj.words||[];
  const essay = obj.essay;
  const p = essay ? (essay.paragraphs||[]).length : 0;
  const t = essay ? (essay.translations||[]).length : 0;
  const g = essay ? (essay.grammar||[]).length : 0;
  const v = essay ? (essay.vocab||[]).length : 0;
  const wBad = words.filter(w => !w.word || !w.meaning);
  const issues = [];
  if (words.length===0) issues.push("无单词");
  if (wBad.length) issues.push(`单词缺字段x${wBad.length}`);
  if (!essay) issues.push("无美文");
  else { if (p===0) issues.push("美文段落为空"); if (p!==t && t>0) issues.push(`段落${p}/译文${t}不一致`); }
  console.log(`  [${d}] 单词=${words.length} 段落=${p} 译文=${t} 语法=${g} 词汇=${v} ${issues.length? "⚠️ "+issues.join("; ") : "✅"}`);
}

console.log("\n========== D. 音频核对（单词 wN_ex.mp3 应存在且 >10KB）==========");
for (const d of dates) {
  const f = path.join(DAILY, `${d}.json`);
  let obj; try { obj = JSON.parse(fs.readFileSync(f,"utf8")); } catch(e){ continue; }
  const words = obj.words||[];
  let missing=0, tiny=0;
  words.forEach((w,i)=>{
    const ex = path.join(audioDir, `${d}_w${i}_ex.mp3`);
    const base = path.join(audioDir, `${d}_w${i}.mp3`);
    [base,ex].forEach(p=>{ const s=fsize(p); if(s<0) missing++; else if(s<10000) tiny++; });
  });
  const essayMp3 = path.join(audioDir, `${d}_essay.mp3`);
  const em = fsize(essayMp3);
  console.log(`  [${d}] 单词数=${words.length} 缺音频=${missing} 过小(<10KB)=${tiny} 美文音频=${em>0? em+"B":"缺失"} ${ (missing||tiny||em<0)?"⚠️":""}`);
}
