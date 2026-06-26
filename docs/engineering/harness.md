# Harness Engineering

本文档定义本项目的 Harness Engineering 体系。它的目标不是增加流程负担，而是让人、Agent 和 CI 在同一套规则下工作，减少误改、漏测、带敏感数据提交和不可复现发布。

这里的 Harness 指围绕软件工程 Agent 的运行时约束层。它负责管理 Agent 如何观察项目、选择上下文、调用工具、解释失败、验证结果和记录完成证据。

## 核心原则

- 文档定义约束。
- 脚本执行约束。
- 测试验证约束。
- CI 或发布流程固化约束。
- 失败先归因，再恢复。
- 完成必须绑定证据，而不是自然语言断言。

`AGENTS.md` 是仓库级总规则；本目录下的工程文档负责说明更具体的执行方式。

## H0-H3 落地模型

本项目采用 H3 作为目标 Harness 等级：

| 等级 | 含义 | 本项目对应物 |
| --- | --- | --- |
| H0 | 只有任务描述和仓库文件 | 原始代码仓库 |
| H1 | 增加工具清单和检查命令 | `package.json` scripts、本文档中的命令表 |
| H2 | 增加项目记忆和上下文协议 | `AGENTS.md`、`docs/engineering/*.md` |
| H3 | 增加失败归因和验证协议 | 失败归因分类、完成检查、验证报告要求 |

后续如果接入 CI，应把 H3 的验证协议固化为 `pnpm ci` 或 GitHub Actions / Harness.io Pipeline。

## 十一个 Harness 职责

| 职责 | 本项目落地方式 | 失败时表现 |
| --- | --- | --- |
| 任务接口 | 用户需求、完成标准、改动范围 | 做错目标或过度实现 |
| 上下文管理 | `AGENTS.md` 的上下文选择协议 | 读错文件、漏掉约束 |
| 工具注册 | package scripts、Git、Docker、构建命令 | 命令不可用或误用 |
| 项目记忆 | `docs/engineering/`、README、架构说明 | 重复探索、改错层 |
| 任务状态 | Agent 工作更新、计划、未解问题 | 漂移、重复劳动 |
| 可观测性 | 命令输出、日志、构建结果 | 无法判断是否成功 |
| 失败归因 | `context/tool/feedback/verify/recovery/entropy/model/unknown` | 盲目改代码 |
| 验证协议 | build、lint、test、diff check | 提前宣布完成 |
| 权限边界 | 受保护文件、提权审批、禁止破坏性命令 | 误删、泄露或覆盖用户数据 |
| 熵审计 | 检查无关改动、依赖 churn、生成残留 | 项目长期退化 |
| 干预记录 | final 中说明未完成、阻塞、用户决策点 | 人工帮助不可见 |

## 项目边界

- `core/` 是后端与自动化运行时边界。
- `web/` 是前端管理面板边界。
- `core/data/` 是本地运行数据边界，默认不允许 Agent 修改。
- `web/dist/` 是构建产物边界，默认不允许手工修改。
- `.env` 是本地环境边界，默认不允许提交或改写。

## 改动分类

### 后端改动

包括：

- `core/src/`
- `core/client.ts`
- `core/tsconfig*.json`
- `core/package.json`

建议检查：

```bash
pnpm -C core build:ts
pnpm -C core lint
```

涉及认证、账号、自动化调度、农场动作、好友动作、持久化时，应增加测试。

### 前端改动

包括：

- `web/src/`
- `web/vite.config.ts`
- `web/uno.config.ts`
- `web/tsconfig*.json`
- `web/package.json`

建议检查：

```bash
pnpm -C web build
pnpm -C web lint
```

### 跨包改动

包括：

- 根目录 `package.json`
- `pnpm-workspace.yaml`
- `pnpm-lock.yaml`
- Docker 或打包配置
- 前后端接口契约

建议检查：

```bash
pnpm build
pnpm lint
```

### 文档改动

包括：

- `README.md`
- `docs/**/*.md`
- `AGENTS.md`

建议检查：

```bash
git diff --check
```

## Agent 工作规则

Agent 开始修改前应先确认：

- 是否存在未提交的用户改动。
- 是否会触碰受保护运行数据。
- 改动属于后端、前端、跨包还是文档。
- 完成后应运行哪些最小检查。

Agent 不应：

- 主动重置、覆盖或回滚用户改动。
- 在未得到明确指示时编辑 `core/data/` 或 `.env`。
- 把真实账号、token、cookie、QQ code 写入代码、测试或文档。
- 为了让检查通过而删除功能、跳过验证或降低类型约束。

## 失败归因流程

当检查失败或行为异常时，按以下顺序处理：

1. 记录失败命令、退出码和关键错误。
2. 判断失败类型：`context`、`tool`、`feedback`、`verify`、`recovery`、`entropy`、`model`、`unknown`。
3. 针对归因选择下一步：补上下文、调整命令、增强日志、补测试、回退局部改动或拆分任务。
4. 重新运行能证明修复有效的最小检查。

不得在没有读懂失败的情况下连续进行无目标修改。

## Trace 证据

一次 Agent 任务最终应能回答：

- action trace：做了哪些关键动作。
- context trace：读了哪些关键文件，为什么读它们。
- tool trace：运行了哪些命令。
- verification trace：哪些需求被什么证据验证。
- failure attribution：如果失败，失败属于哪类。
- entropy audit：是否引入无关改动、依赖 churn、构建产物或敏感数据。

这些证据不一定需要单独落文件，但最终回复必须保留关键信息。

## 推荐脚本体系

当前项目已有这些根命令：

```bash
pnpm lint
pnpm build
pnpm dev:core
pnpm dev:web
pnpm package:release
```

后续建议补充：

```bash
pnpm typecheck
pnpm test
pnpm ci
```

其中 `pnpm ci` 应作为本地和 CI 的统一质量入口，最终至少覆盖：

- lint 检查
- TypeScript 检查
- 单元测试
- 构建检查

## 完成定义

一个工程任务只有在满足以下条件后，才算完成：

- 改动范围与用户请求一致。
- 没有触碰无关文件。
- 没有泄露敏感数据。
- 相关文档已同步。
- 已运行与改动范围匹配的检查。
- 无法运行的检查已说明原因。

完成报告建议格式：

```text
修改：
- ...

验证：
- 命令：...
- 结果：...

未验证：
- ...

风险：
- ...
```

## 关联文档

- `AGENTS.md`：仓库级 Agent 约束。
- `docs/engineering/testing.md`：测试策略。
- `docs/engineering/release.md`：构建与发布策略。
