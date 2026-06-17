# Fork 项目同步上游更新 — 完整指南

> 本项目 fork 自 `https://github.com/liyangpengs/qq-farm-bot.git`（upstream）
> 你的 fork 地址: `https://github.com/zjydipingxian/qq-farm-bot.git`（origin）

---

## 核心原则

```
upstream/main ──●──●──●──●──●──  原作者的更新
                 \
你的 master ──────●──●──●──●──  ← 只用来同步上游，不加自己的改动
                    \
你的 dev ────────────●──●──●──  ← 所有魔改都在这里
```

**关键思想：`master` 分支只同步，`dev` 分支做魔改。**

这样每次上游更新，你只需要：
1. 把上游更新同步到 `master`
2. 把 `dev` rebase 到最新的 `master`

冲突范围会比直接 merge 小得多。

---

## 第一步：初始化分支结构（只需做一次）

### 1.1 确保 upstream 已添加

```bash
# 查看当前远程仓库
git remote -v

# 如果没有 upstream，添加它
git remote add upstream https://github.com/liyangpengs/qq-farm-bot.git
```

### 1.2 创建 dev 分支存放魔改

```bash
# 从当前 master 创建 dev 分支（如果还没有的话）
git checkout master
git checkout -b dev

# 把你之前魔改的文件提交到 dev 分支
git add .
git commit -m "我的魔改：xxx功能"
```

### 1.3 让 master 保持干净

```bash
# 切回 master，用上游版本重置（让 master 完全等于上游）
git checkout master
git fetch upstream
git reset --hard upstream/master
git push origin master --force-with-lease
```

> 做完这一步后，`master` = 上游原版，`dev` = 你的魔改版本。

---

## 第二步：日常同步上游更新（每次上游有新提交时执行）

### 方法 A：使用同步脚本（推荐）

```bash
# 确保在 master 分支
git checkout master

# 运行同步脚本（默认 rebase 模式）
node sync-upstream.mjs
```

脚本会自动：
1. fetch upstream
2. 比较差异，告诉你有几个新提交
3. rebase 到 upstream/master
4. 推送到你的 origin

然后同步 dev 分支：

```bash
git checkout dev
git rebase master
git push origin dev --force-with-lease
```

### 方法 B：手动执行

```bash
# 1. 切到 master
git checkout master

# 2. 拉取上游
git fetch upstream

# 3. 看上游有几个新提交
git log --oneline master..upstream/master

# 4. rebase 到上游最新
git rebase upstream/master

# 5. 推送到你的 fork
git push origin master --force-with-lease

# 6. 同步 dev 分支
git checkout dev
git rebase master
git push origin dev --force-with-lease
```

---

## 第三步：遇到冲突时怎么处理

### 3.1 rebase 过程中冲突了

Git 会暂停并提示你哪个文件有冲突：

```bash
# 1. 打开冲突文件，找到这样的标记：
# <<<<<<< HEAD
# 上游的代码
# =======
# 你的代码
# >>>>>>> 你的提交

# 2. 决定保留哪边（或合并两边），删掉标记

# 3. 标记为已解决
git add 冲突的文件

# 4. 继续 rebase
git rebase --continue

# 如果冲突太多想放弃，执行：
git rebase --abort
```

### 3.2 快捷方式：整个文件用上游的 or 用你的

```bash
# 这个文件完全用上游版本
git checkout --theirs path/to/file
git add path/to/file

# 这个文件完全保留你的版本
git checkout --ours path/to/file
git add path/to/file

# 然后继续
git rebase --continue
```

---

## 常见问题

### Q: 我之前直接在 master 上魔改了，现在怎么办？

```bash
# 1. 先把你的魔改保存到一个新分支
git checkout master
git checkout -b my-changes-backup
git add .
git commit -m "备份我的魔改"

# 2. 重置 master 为上游
git checkout master
git fetch upstream
git reset --hard upstream/master
git push origin master --force-with-lease

# 3. 之后在 dev 分支上 cherry-pick 你的提交，或重新做魔改
git checkout dev
git cherry-pick <你的commit hash>
```

### Q: rebase 和 merge 有什么区别？

| | rebase（推荐） | merge |
|---|---|---|
| 历史记录 | 线性，干净 | 会有合并提交，历史乱 |
| 冲突处理 | 逐个提交解决 | 一次性解决所有冲突 |
| 推送方式 | 需要 `--force-with-lease` | 普通 push |
| 适合场景 | 个人 fork 同步 | 多人协作分支 |

### Q: 多久同步一次？

建议**每周至少同步一次**，或者上游有重要更新时立刻同步。
小批量冲突远比攒了几十次更新后的一次性大冲突好处理。

### Q: `--force-with-lease` 和 `--force` 有什么区别？

- `--force`：无条件强推，不管远程有没有别人的新提交
- `--force-with-lease`：如果远程有你不知道的更新，会拒绝推送（更安全）

**永远优先用 `--force-with-lease`。**

---

## 快速命令速查表

```bash
# ---- 初始化 ----
git remote add upstream https://github.com/liyangpengs/qq-farm-bot.git

# ---- 同步 master（脚本）----
git checkout master
node sync-upstream.mjs

# ---- 同步 master（手动）----
git checkout master
git fetch upstream
git rebase upstream/master
git push origin master --force-with-lease

# ---- 同步 dev 分支 ----
git checkout dev
git rebase master
git push origin dev --force-with-lease

# ---- 冲突处理 ----
git add <冲突文件>
git rebase --continue      # 继续
git rebase --abort         # 放弃

# ---- 查看状态 ----
git log --oneline -10      # 看最近提交
git status                 # 看当前状态
git diff master dev        # 比较两个分支差异
```
