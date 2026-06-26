# Release Process

本文档定义本项目的构建、打包和发布流程。

## 发布目标

发布流程应保证：

- 构建产物来自干净、可追踪的源码状态。
- 不包含本地 `.env`、账号数据或运行日志。
- 前端资源和后端运行时代码版本一致。
- Windows、Linux、macOS 打包命令可复现。
- 发布过程留下可审计证据。

## 发布前检查

发布前确认工作区状态：

```bash
git status --short
```

如果存在无关改动，先确认这些改动是否属于本次发布。

发布前需要做一次熵审计：

- 是否有无关文件改动。
- 是否有依赖版本无意变化。
- 是否有构建产物被手工修改。
- 是否有真实运行数据进入 diff。
- 是否有调试日志、临时文件或测试残留。

发布前建议运行：

```bash
pnpm install
pnpm lint
pnpm build
```

如果已接入测试，应运行：

```bash
pnpm test
```

## 构建流程

前端构建：

```bash
pnpm build:web
```

后端构建：

```bash
pnpm build:core
```

完整构建：

```bash
pnpm build
```

## 二进制打包

Windows：

```bash
pnpm package:win
```

Linux：

```bash
pnpm package:linux
```

macOS：

```bash
pnpm package:mac
```

全平台发布包：

```bash
pnpm package:release
```

打包产物输出目录：

```text
core/dist/bin/
```

## Docker 发布

本地构建并启动：

```bash
docker compose up -d --build
```

查看日志：

```bash
docker compose logs -f
```

停止：

```bash
docker compose down
```

Docker 发布前应确认 `.env` 不包含要提交的真实密钥。

## 敏感数据检查

发布前不得包含：

- `.env`
- 真实账号。
- QQ code。
- cookie。
- token。
- JWT。
- 本地运行日志。
- `core/data/` 中的真实用户数据。

如需提供示例配置，应使用：

```text
.env.example
docs/
core/test/fixtures/
```

检查重点：

```text
core/data/
.env
*.log
web/.codex-vite*.log
```

## 版本和变更说明

发布前应确认：

- `core/package.json` 版本是否需要更新。
- `web/package.json` 版本是否需要更新。
- `README.md` 是否需要更新。
- 发布说明是否列出用户可见变化、修复和升级注意事项。

发布说明建议包含：

- 新增功能。
- 修复问题。
- 兼容性变化。
- 配置变化。
- 已知风险。
- 验证命令和结果。

## 回滚策略

如果发布后发现问题：

- 优先回滚到上一个可用 release。
- 保留故障版本日志和产物，便于排查。
- 不要直接修改用户的 `core/data/` 文件作为回滚手段。
- 如果涉及数据结构变更，应提供迁移或恢复说明。

## 发布完成标准

一次发布只有满足以下条件后，才算完成：

- `pnpm build` 已通过。
- 必要测试已通过，或说明为什么暂未接入。
- 产物路径明确。
- 敏感数据检查完成。
- 发布说明已准备。
- 回滚路径明确。
