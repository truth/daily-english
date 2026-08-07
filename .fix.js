#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { mergeIntoDaily } = require("./import-essay.js");

const ESSAY_WS = "C:\\Users\\truth\\WorkBuddy\\2026-07-28-13-21-58";
const DAILY = path.join(__dirname, "content", "daily");

// ---- 07-31 单词（主题：What the River Knows 河流/耐心/流动）----
const words0731 = [
  { word:"meander", pos:"v.", phonetic:"/miˈændər/", meaning:"蜿蜒流淌；闲逛，曲折前行", enExample:"The river meanders through the quiet valley.", zhExample:"河水蜿蜒流过寂静的山谷。", note:"近义：wander；常用于形容河流、道路或思路的曲折延伸" },
  { word:"current", pos:"n.", phonetic:"/ˈkɜːrənt/", meaning:"（水/空气的）流；潮流", enExample:"He swam against the current.", zhExample:"他逆着水流往前游。", note:"也可作形容词“当前的”；常见搭配 electric current（电流）" },
  { word:"patience", pos:"n.", phonetic:"/ˈpeɪʃns/", meaning:"耐心；忍耐", enExample:"The river teaches us patience.", zhExample:"河流教会我们耐心。", note:"形容词 patient；反义：impatience" },
  { word:"steady", pos:"adj.", phonetic:"/ˈstedi/", meaning:"稳定的；持续的", enExample:"A steady flow carves the deepest canyon.", zhExample:"持续的水流凿出最深的峡谷。", note:"副词 steadily；反义：unsteady" },
  { word:"erode", pos:"v.", phonetic:"/ɪˈroʊd/", meaning:"侵蚀；逐渐削弱", enExample:"Water slowly erodes the stone.", zhExample:"水慢慢侵蚀着石头。", note:"名词 erosion（侵蚀）；也可指信心、信任被逐渐“侵蚀”" }
];

// ---- 08-01 单词（主题：The Friends Who Stay 友谊/陪伴）----
const words0801 = [
  { word:"companion", pos:"n.", phonetic:"/kəmˈpæniən/", meaning:"同伴；伴侣", enExample:"A loyal companion stays through every storm.", zhExample:"忠诚的同伴会陪你度过每一场风暴。", note:"动词 accompany（陪伴）；近义：partner, friend" },
  { word:"loyal", pos:"adj.", phonetic:"/ˈlɔɪəl/", meaning:"忠诚的；忠实的", enExample:"True friends are loyal even when it is hard.", zhExample:"真正的朋友即便艰难也忠贞不渝。", note:"名词 loyalty（忠诚）；反义：disloyal" },
  { word:"bond", pos:"n.", phonetic:"/bɑːnd/", meaning:"纽带；联结", enExample:"Years of trust built a quiet bond between them.", zhExample:"多年的信任在他们之间筑起了一条无声的纽带。", note:"动词 bond（建立亲密关系）；近义：tie, connection" },
  { word:"cherish", pos:"v.", phonetic:"/ˈtʃerɪʃ/", meaning:"珍惜；珍爱", enExample:"Cherish the friends who stay.", zhExample:"请珍惜那些留下来的人。", note:"近义：treasure；反义：neglect" },
  { word:"reunion", pos:"n.", phonetic:"/riˈjuːniən/", meaning:"重聚；团圆", enExample:"Their reunion felt like no time had passed.", zhExample:"他们的重聚让人觉得时光从未流逝。", note:"动词 reunite（重逢）；re-（重新）+ union（联合）" }
];

// ---- 注入 07-31 / 08-01 单词（保留美文）----
mergeIntoDaily("2026-07-31", { words: words0731 });
console.log("✅ 已注入 2026-07-31 单词 x" + words0731.length);
mergeIntoDaily("2026-08-01", { words: words0801 });
console.log("✅ 已注入 2026-08-01 单词 x" + words0801.length);

// ---- 修复 07-28 单词 golden 缺字段 ----
{
  const f = path.join(DAILY, "2026-07-28.json");
  const o = JSON.parse(fs.readFileSync(f, "utf8"));
  const w = o.words[4];
  if (w && w.word === "golden") {
    w.phonetic = "/ˈɡoʊldən/";
    w.enExample = "We spent a slow and golden afternoon by the lake.";
    w.zhExample = "我们在湖边度过了一个缓慢而金色的午后。";
    mergeIntoDaily("2026-07-28", { words: o.words });
    console.log("✅ 已补全 2026-07-28 golden 的 phonetic/enExample/zhExample");
  } else {
    console.log("⚠️ 2026-07-28 words[4] 不是 golden，跳过");
  }
}

// ---- 把脏源 07-30 JSON 重写为合法 JSON（取自已合并的正确内容）----
{
  const src = path.join(ESSAY_WS, "words-2026-07-30.json");
  const daily = path.join(DAILY, "2026-07-30.json");
  if (fs.existsSync(daily)) {
    const o = JSON.parse(fs.readFileSync(daily, "utf8"));
    fs.writeFileSync(src, JSON.stringify(o.words, null, 2), "utf8");
    console.log("✅ 已重写 words-2026-07-30.json 为合法 JSON（x" + (o.words||[]).length + " 词）");
  }
}
