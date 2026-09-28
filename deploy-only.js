#!/usr/bin/env node
/** 仅执行「wrangler pages deploy dist --project-name dailyecho」，用于已构建 dist 后的手动上线。 */
const { execFileSync } = require("child_process");
const path = require("path");
const ROOT = __dirname;

const args = ["pages", "deploy", "dist", "--project-name", "dailyecho", "--commit-dirty=true"];
execFileSync("wrangler", args, { cwd: ROOT, stdio: "inherit", shell: true });
console.log("🚀 部署完成：https://dailyecho.pages.dev");
