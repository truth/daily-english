#!/usr/bin/env python3
"""
生成每日内容的英文语音文件（Edge TTS，免费、无需密钥）。
输出到 content/audio/，再由 build.js 复制进 dist/audio/ 一并部署。

文件名规则（与 build.js 中 audioOrSpeak 的命名一致）：
  单词：      <date>_w<index>.mp3          （单词 + 例句）
  单词例句：  <date>_w<index>_ex.mp3       （仅例句）
  美文：      <date>_essay.mp3             （标题 + 全文）

已存在的文件会跳过，便于增量更新。
依赖：pip install edge-tts
"""
import os
import json
import glob
import asyncio
import edge_tts

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "content", "daily")
OUT = os.path.join(ROOT, "content", "audio")
VOICE = "en-US-AriaNeural"  # 英文女声，可换成 en-US-GuyNeural 等


async def gen(text: str, path: str):
    if not text or not text.strip():
        return
    if os.path.exists(path):
        return
    try:
        comm = edge_tts.Communicate(text, VOICE)
        await comm.save(path)
        print("  ->", os.path.basename(path))
    except Exception as e:  # 单个失败不影响整体
        print("  FAILED", os.path.basename(path), ":", e)


async def main():
    os.makedirs(OUT, exist_ok=True)
    files = sorted(glob.glob(os.path.join(SRC, "*.json")))
    if not files:
        print("未找到 content/daily/*.json")
        return
    for f in files:
        with open(f, encoding="utf-8") as fh:
            data = json.load(fh)
        date = data.get("date", "unknown")
        print("处理", date)
        for i, w in enumerate(data.get("words", [])):
            word = w.get("word", "")
            ex = w.get("enExample", "")
            await gen(f"{word}. {ex}" if ex else word, os.path.join(OUT, f"{date}_w{i}.mp3"))
            if ex:
                await gen(ex, os.path.join(OUT, f"{date}_w{i}_ex.mp3"))
        ess = data.get("essay")
        if ess:
            text = (ess.get("title", "") + ". ") + " ".join(ess.get("paragraphs", []))
            await gen(text, os.path.join(OUT, f"{date}_essay.mp3"))
    print("✅ 语音生成完成，输出目录：", OUT)


if __name__ == "__main__":
    asyncio.run(main())
