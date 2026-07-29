#!/usr/bin/env node
/**
 * 零依赖本地预览服务器。仅用于本地查看 dist/ 构建结果。
 * 用法：node serve.js  [port]   默认端口 4173
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const DIST = path.join(__dirname, "dist");
const PORT = parseInt(process.argv[2] || "4173", 10);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
};

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";

  // 防目录穿越
  const safe = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
  let filePath = path.join(DIST, safe);

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    // 尝试加 .html（如 /daily/2026-07-28）
    const tryHtml = filePath + ".html";
    if (fs.existsSync(tryHtml)) filePath = tryHtml;
    else filePath = path.join(DIST, "index.html"); // SPA 回退
  }

  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, () => {
  console.log(`📖 本地预览：http://localhost:${PORT}`);
  console.log("   按 Ctrl+C 停止。");
});
