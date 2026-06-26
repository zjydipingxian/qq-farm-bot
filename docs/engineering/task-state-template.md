# Task State Template

本模板用于长任务或复杂任务。普通小改动不一定需要单独建文件，但 Agent 应在工作过程中维护同等信息。

```md
# Task State

## Objective

[本次任务的目标]

## Scope

- In scope:
  - [允许修改的范围]
- Out of scope:
  - [明确不做的范围]

## Context Read

- `[path]`：[为什么读这个文件]

## Hypotheses

- [当前判断或假设]

## Open Questions

- [仍需确认的问题]

## Actions

- [已执行的关键动作]

## Failures

- Command: `[命令]`
- Result: `[退出码和关键错误]`
- Attribution: `context | tool | feedback | verify | recovery | entropy | model | unknown`
- Next step: `[下一步]`

## Verification

- [需求] -> [验证命令或证据]

## Entropy Audit

- Unrelated changes: yes/no
- Protected data touched: yes/no
- Dependency churn: yes/no
- Generated residue: yes/no
```
