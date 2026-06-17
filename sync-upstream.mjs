#!/usr/bin/env node
// ============================================================
//  Sync Fork with Upstream - 自动同步原仓库更新到本地 Fork
//  上游仓库: https://github.com/liyangpengs/qq-farm-bot.git
//
//  推荐工作流:
//    master 分支 = 干净同步上游，不加自己的改动
//    dev/feature 分支 = 你的魔改，通过 rebase 叠加到最新 master
//
//  用法:
//    node sync-upstream.mjs                        # 默认: rebase 模式同步 master
//    node sync-upstream.mjs --mode merge           # 使用 merge 模式
//    node sync-upstream.mjs --branch dev --rebase  # 把 dev 分支 rebase 到最新上游
//    node sync-upstream.mjs --dry-run              # 预览模式，不执行任何操作
//    node sync-upstream.mjs --force                # 强制用上游覆盖（危险！）
// ============================================================

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

// ---------- 参数解析 ----------
const args = process.argv.slice(2);
function getArg(name, defaultVal) {
  const idx = args.indexOf(name);
  if (idx !== -1 && args[idx + 1]) return args[idx + 1];
  return defaultVal;
}
function hasFlag(name) {
  return args.includes(name);
}

const UPSTREAM_URL = getArg("--upstream", "https://github.com/liyangpengs/qq-farm-bot.git");
const BRANCH = getArg("--branch", "master");
const DRY_RUN = hasFlag("--dry-run");
const FORCE = hasFlag("--force");
// 同步模式: rebase(推荐) | merge
const MODE = getArg("--mode", "rebase");
// 是否只同步 master 不做 rebase（用于干净同步分支）
const SYNC_ONLY = hasFlag("--sync-only");

// ---------- 颜色输出 ----------
const c = {
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  gray: (s) => `\x1b[90m${s}\x1b[0m`,
  magenta: (s) => `\x1b[35m${s}\x1b[0m`,
};

const step = (msg) => console.log(`  ${c.cyan("[>]")} ${msg}`);
const ok = (msg) => console.log(`  ${c.green("[+]")} ${msg}`);
const warn = (msg) => console.log(`  ${c.yellow("[!]")} ${msg}`);
const err = (msg) => console.log(`  ${c.red("[x]")} ${msg}`);

// ---------- Git 命令执行 ----------
function run(cmd, opts = {}) {
  try {
    return execSync(cmd, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"], ...opts }).trim();
  } catch (e) {
    if (opts.noThrow) return null;
    return null;
  }
}

function runOrFail(cmd, failMsg) {
  try {
    const out = execSync(cmd, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
    return out;
  } catch (e) {
    err(`${failMsg}: ${e.stderr?.trim() || e.message}`);
    process.exit(1);
  }
}

// ============================================================
//  主流程
// ============================================================

console.log("");
console.log(c.magenta("=== Sync Fork with Upstream ==="));
console.log("");

// 1. 确认在 Git 仓库中
if (!existsSync(".git")) {
  err("当前目录不是一个 Git 仓库，请在仓库根目录下运行此脚本。");
  process.exit(1);
}
ok("Git 仓库确认");

// 2. 获取 origin 信息
const originUrl = run("git remote get-url origin");
if (!originUrl) {
  err("无法获取 origin 远程仓库地址");
  process.exit(1);
}
step(`origin 地址: ${originUrl}`);

// 3. 检测 / 添加 upstream
const existingUpstream = run("git remote get-url upstream");
if (existingUpstream) {
  ok(`upstream 已存在: ${existingUpstream}`);
} else {
  step(`添加 upstream: ${UPSTREAM_URL}`);
  if (!DRY_RUN) {
    runOrFail(`git remote add upstream "${UPSTREAM_URL}"`, "添加 upstream 失败");
  }
  ok("upstream 已添加");
}

// 4. 检查是否有未提交的更改
if (!FORCE) {
  const status = run("git status --porcelain");
  if (status) {
    warn("工作区有未提交的更改，请先处理：");
    status.split("\n").forEach((line) => console.log(`        ${c.gray(line)}`));
    console.log("");
    warn("可使用 --force 参数忽略此检查（不推荐）");
    process.exit(1);
  }
}

// 5. Fetch upstream
step("拉取 upstream 最新代码...");
if (!DRY_RUN) {
  runOrFail("git fetch upstream", "fetch upstream 失败");
}
ok("fetch 完成");

// 6. 检测当前分支
const currentBranch = run("git branch --show-current");
step(`当前分支: ${currentBranch}`);

if (currentBranch !== BRANCH) {
  step(`切换到目标分支: ${BRANCH}`);
  if (!DRY_RUN) {
    runOrFail(`git checkout ${BRANCH}`, `切换到分支 ${BRANCH} 失败`);
  }
}

// 7. 比较差异
step("比较差异...");
if (!DRY_RUN) {
  const logOutput = run(`git log --oneline ${BRANCH}..upstream/${BRANCH}`);

  if (!logOutput) {
    ok("已经是最新的，无需同步！");
    console.log("");
    console.log(c.green("=== 同步完成 ==="));
    process.exit(0);
  }

  const commits = logOutput.split("\n").filter(Boolean);
  ok(`发现 ${commits.length} 个新提交：`);
  commits.forEach((line) => console.log(`        ${c.gray(line)}`));
  console.log("");

  // 8. 合并 / Rebase
  if (FORCE) {
    warn("强制模式: 使用 reset 覆盖本地所有更改（你的魔改会丢失！）");
    step(`git reset --hard upstream/${BRANCH}`);
    runOrFail(`git reset --hard upstream/${BRANCH}`, "reset 失败");
  } else if (MODE === "rebase") {
    step(`rebase 到 upstream/${BRANCH} ...`);
    console.log("");
    console.log(c.cyan("  [i] Rebase 模式说明:"));
    console.log(c.gray("      你的本地提交会被临时取下，更新上游代码后再逐一放回去。"));
    console.log(c.gray("      如果某个提交有冲突，Git 会暂停让你手动解决。"));
    console.log("");

    const rebaseResult = run(`git rebase upstream/${BRANCH}`, { noThrow: true });
    if (rebaseResult === null) {
      // rebase 可能冲突
      const rebaseStatus = run("git status --short", { noThrow: true });
      if (rebaseStatus && rebaseStatus.includes("UU")) {
        err("Rebase 过程中存在冲突，请手动解决后执行:");
        console.log("");
        console.log(c.yellow("        # 1. 编辑冲突文件，解决冲突"));
        console.log(c.yellow("        # 2. git add <冲突文件>"));
        console.log(c.yellow("        # 3. git rebase --continue"));
        console.log(c.yellow("        # 4. 如果想放弃 rebase: git rebase --abort"));
        console.log("");

        // 显示冲突文件列表
        const conflictFiles = rebaseStatus
          .split("\n")
          .filter((l) => l.includes("UU") || l.includes("AA"))
          .map((l) => l.trim().replace(/^(UU|AA)\s+/, ""));
        if (conflictFiles.length > 0) {
          warn("冲突文件:");
          conflictFiles.forEach((f) => console.log(`        ${c.red(f)}`));
          console.log("");
        }
        process.exit(1);
      }
      err("Rebase 失败，请检查 Git 状态");
      process.exit(1);
    }
    ok("Rebase 完成！");
  } else {
    // merge 模式
    step(`merge upstream/${BRANCH} ...`);
    runOrFail(`git merge upstream/${BRANCH} --no-edit`, "合并失败，可能存在冲突，请手动解决");
  }

  // 9. 推送到 origin
  if (!SYNC_ONLY) {
    step("推送到 origin...");
    if (MODE === "rebase" && !FORCE) {
      // rebase 后需要 force push（因为历史被改写了）
      step("rebase 模式使用 force-with-lease 推送（安全强推）...");
      runOrFail(`git push origin ${BRANCH} --force-with-lease`, "推送到 origin 失败");
    } else {
      runOrFail(`git push origin ${BRANCH}`, "推送到 origin 失败");
    }
    ok("推送完成");
  } else {
    ok("--sync-only 模式，跳过推送");
  }
}

// 10. 输出后续建议
console.log("");
console.log(c.green("=== 同步完成 ==="));
if (MODE === "rebase" && BRANCH === "master") {
  console.log("");
  console.log(c.cyan("  [i] 后续操作建议:"));
  console.log(c.gray("      如果你的魔改在其他分支（如 dev），执行以下命令 rebase:"));
  console.log(c.gray("        git checkout dev"));
  console.log(c.gray("        git rebase master"));
  console.log(c.gray("        git push origin dev --force-with-lease"));
}
console.log("");
