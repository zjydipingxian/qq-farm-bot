# Verification Report Template

本模板用于复杂改动、修复缺陷、发布前检查或需要明确交付证据的任务。

```md
# Verification Report

## Summary

[一句话说明完成了什么]

## Requirements Checked

- [需求 1] -> [证据]
- [需求 2] -> [证据]

## Commands Run

```bash
[命令]
```

Result:

```text
[退出码和关键输出]
```

## Manual Checks

- [手动检查步骤和结果]

## Not Verified

- [未验证项及原因]

## Failure Attribution

- [如果发生失败，写明归因和处理]

## Entropy Audit

- Unrelated changes: yes/no
- Protected data touched: yes/no
- Dependency churn: yes/no
- Generated residue: yes/no

## Residual Risk

- [剩余风险]
```
