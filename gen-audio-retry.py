#!/usr/bin/env python3
"""
带重试退避的语音补生成脚本（基于 gen-audio.py 改写）。
只处理「缺失」或「0 字节」的 mp3，已存在且非空的跳过，便于增量重试。
edge-tts 对 speech.platform.bing.com 的 SSL/超时是间歇性的，
故对单个文件重试最多 MAX_RETRIES 次、指数退避，最大化成功率。
"""
import os
import json
import glob
import asyncio
import edge_tts

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "content", "daily")
OUT = os.path.join(ROOT, "content", "audio")
VOICE = "en-US-AriaNeural"
MAX_RETRIES = 8
BASE_BACKOFF = 1.5


async def gen(text: str, path: str):
    if not text or not text.strip():
        return
    # 已存在且非空 -> 跳过
    if os.path.exists(path) and os.path.getsize(path) > 0:
        return
    last_err = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            comm = edge_tts.Communicate(text, VOICE)
            await comm.save(path)
            if os.path.exists(path) and os.path.getsize(path) > 0:
                print("  ->", os.path.basename(path))
                return
            last_err = "saved but empty"
        except Exception as e:  # 单个失败不影响整体
            last_err = e
        if attempt < MAX_RETRIES:
            await asyncio.sleep(BASE_BACKOFF * attempt)
    print("  FAILED", os.path.basename(path), ":", last_err)
    # 清理 0 字节残留，留给下一轮重试
    try:
        if os.path.exists(path) and os.path.getsize(path) == 0:
            os.remove(path)
    except Exception:
        pass


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
    print("✅ 语音生成完成（含重试），输出目录：", OUT)


if __name__ == "__main__":
    asyncio.run(main())
