#!/usr/bin/env node
/**
 * 新建一天的单词+美文内容模板。
 * 用法：
 *   node new-day.js            -> 使用今天日期
 *   node new-day.js 2026-08-01 -> 指定日期
 * 生成文件：content/daily/<date>.json
 */
const fs = require("fs");
const path = require("path");

const CONTENT_DIR = path.join(__dirname, "content", "daily");

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const date = process.argv[2] || todayStr();
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  console.error("日期格式应为 YYYY-MM-DD，例如 2026-08-01");
  process.exit(1);
}

const target = path.join(CONTENT_DIR, `${date}.json`);
if (fs.existsSync(target)) {
  console.error(`⚠️  ${date}.json 已存在，跳过。`);
  process.exit(0);
}

const template = {
  date: date,
  title: "每日一词一文",
  wordsTitle: "今日单词",
  essayTitle: "今日美文",
  words: [
    {
      word: "serendipity",
      phonetic: "/ˌserənˈdɪpəti/",
      pos: "n.",
      meaning: "机缘巧合；意外发现美好事物的能力",
      enExample: "A fortunate stroke of serendipity led to the discovery.",
      zhExample: "一次幸运的机缘巧合促成了这一发现。",
    },
    {
      word: "ephemeral",
      phonetic: "/ɪˈfemərəl/",
      pos: "adj.",
      meaning: "短暂的；瞬息的",
      enExample: "Fame can be ephemeral.",
      zhExample: "名声可能转瞬即逝。",
    },
  ],
  essay: {
    title: "The Beauty of Slowing Down",
    author: "Anonymous",
    paragraphs: [
      "In a world that never stops moving, we often forget the quiet joy of simply being present.",
      "Slowing down is not about doing less, but about noticing more—the light on the wall, the warmth of a cup, the rhythm of your own breath.",
      "Give yourself permission to pause. The most beautiful things tend to appear when we stop rushing past them.",
    ],
  },
};

fs.writeFileSync(target, JSON.stringify(template, null, 2), "utf8");
console.log(`✅ 已创建 ${path.relative(__dirname, target)}`);
console.log("   编辑该文件后运行  npm run build  重新生成站点。");
