# AGENTS.md

本仓库是一个基于 pnpm workspace 的 QQ 农场自动化项目。所有 Agent 在修改本项目时，必须优先遵守本文件。

本文件是本项目的 Agent Guide，也是 Harness Engineering 的入口约束。它把项目上下文、工具边界、权限边界和完成标准显式暴露给 Agent。

## 项目结构

- `core/`：Node.js 后端、自动化运行时、Express API、Socket.io、游戏逻辑、本地数据存储。
- `web/`：Vue 3 + Vite 前端管理面板。
- `docs/`：项目文档和工程文档。

## 通用规则

- 所有包管理操作统一使用 pnpm。
- 修改范围应尽量小，只处理当前任务相关内容。
- 优先沿用项目现有代码风格、目录结构和命名方式。
- 不要重写无关代码，不要做无关重构。
- 不要提交密钥、账号数据、token、cookie、QQ code、JWT 或本地运行状态。
- 不要修改构建产物，除非任务明确要求。
- 如果发现工作区已有他人改动，必须保留并绕开无关改动。

## Harness 等级

本项目按 H3 级 Harness 约束执行：

- H1：显式工具和检查命令。
- H2：显式项目记忆、上下文选择和任务状态。
- H3：显式失败归因、确定性验证和完成报告。

Agent 不应只给出自然语言结论；必须说明检查依据、无法验证的部分和剩余风险。

## 上下文选择协议

开始任务前，Agent 应先确认任务属于哪一类：

- 后端：`core/`
- 前端：`web/`
- 工程配置：根目录配置、pnpm workspace、Docker、打包脚本
- 文档：`README.md`、`docs/`、`AGENTS.md`

Agent 只读取和修改完成任务所需的最小文件集合。跨边界改动必须说明原因。

## 受保护的运行数据

以下文件可能包含本地运行数据或用户敏感数据：

- `core/data/accounts.json`
- `core/data/store.json`
- `core/data/users.json`
- `core/data/cards.json`
- `core/data/login-logs.json`
- `core/data/login-attempts.json`
- `core/data/card-claim.json`
- `core/data/steal_reports.json`
- `.env`

除非用户明确要求，否则 Agent 不得编辑这些文件。

测试或示例数据应放在 `core/test/fixtures/`，或使用临时目录。

## 失败归因协议

当命令失败、测试失败或行为不符合预期时，Agent 在继续修改前应先归因：

- `context`：上下文不足或读错文件。
- `tool`：工具、命令或依赖不可用。
- `feedback`：日志或错误信息不足。
- `verify`：无法证明需求满足。
- `recovery`：需要回滚、重试或拆分问题。
- `entropy`：改动引入维护负担。
- `model`：实现或推理错误。
- `unknown`：暂时无法判断。

不要在没有归因的情况下反复试错。

## 后端规则

后端代码位于 `core/`。

完成后端改动前，应运行：

```bash
pnpm -C core build:ts
pnpm -C core lint
```

如果改动涉及认证、账号管理、自动化调度、农场操作、好友操作或数据持久化，应补充或更新测试。

测试中不要调用真实网络接口。QQ 农场接口、定时器、文件存储、通知服务都应 mock。

## 前端规则

前端代码位于 `web/`。

完成前端改动前，应运行：

```bash
pnpm -C web build
pnpm -C web lint
```

遵循现有 Vue 3 Composition API 风格。

UI 改动应保持与当前布局、组件、Pinia store、路由结构一致。

## 常用命令

```bash
pnpm install
pnpm lint
pnpm build
pnpm dev:core
pnpm dev:web
```

打包命令：

```bash
pnpm package:win
pnpm package:linux
pnpm package:mac
pnpm package:release
```

## Lint 规则

不要把自动修复当成唯一质量检查。

如果新增 CI 脚本，优先使用只检查、不自动改文件的 lint 命令。

## 文档规则

当行为、启动方式、环境变量、发布流程或用户可见功能发生变化时，应同步更新文档。

工程文档放在 `docs/engineering/`：

- `docs/engineering/harness.md`
- `docs/engineering/testing.md`
- `docs/engineering/release.md`

## 安全规则

- 不要打印密码、token、cookie、QQ code、JWT 或账号凭据。
- 不要硬编码账号密码。
- `.env` 只用于本地环境。
- 用 `.env.example` 记录可配置环境变量。
- 自动化账号数据应视为敏感数据处理。

## 完成检查

在声明任务完成前，应确认已运行相关检查。

根据改动范围选择最小必要命令：

```bash
pnpm -C core build:ts
pnpm -C web build
pnpm lint
pnpm build
```

如果某个检查无法运行，需要说明原因。

完成回复至少应包含：

- 修改了哪些文件。
- 运行了哪些检查，结果是什么。
- 哪些检查未运行，原因是什么。
- 是否触碰受保护数据。
