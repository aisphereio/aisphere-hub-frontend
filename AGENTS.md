<!-- OPENWIKI:START -->

## OpenWiki

This repository uses OpenWiki for recurring code documentation. Start with `openwiki/quickstart.md`, then follow its links to architecture, workflows, domain concepts, operations, integrations, testing guidance, and source maps.

The scheduled OpenWiki GitHub Actions workflow refreshes the repository wiki. Do not hand-edit generated OpenWiki pages unless explicitly asked; prefer updating source code/docs and letting OpenWiki regenerate.

<!-- OPENWIKI:END -->

## Agile V 追溯链规范

本仓库使用 Agile V 框架管理需求→组件→测试的全链路追溯。

### 追溯链结构

```
REQ (requirements.md) ──→ ART (BUILD_MANIFEST.md) ──→ TC (TEST_SPEC.md)
需求                     组件/实现路径                 测试用例
```

### 变更工作流

每次提交代码必须按以下顺序操作：

```
Step 1: 写/改需求
        → 更新 .agile-v/REQUIREMENTS.md
        → 每个需求必须有唯一 REQ-FE-XXXX-NNN 编号

Step 2: 写/改代码
        → 在 BUILD_MANIFEST.md 中添加 ART 条目
        → 格式: | ART-FE-NNN | REQ-FE-XXXX-NNN | 组件路径 | 说明 |

Step 3: 写/改测试
        → 在 TEST_SPEC.md 中添加 TC 条目
        → 格式: | TC-FE-NNN | REQ-FE-XXXX-NNN | 说明 | 类型 | 状态 |
        → 状态标记: ✅ 已实现 / ❌ 缺失

Step 4: 运行测试
        → npm test
```

### 追溯覆盖率目标

| 指标 | 当前 | 目标 |
|------|------|------|
| REQ→ART 覆盖率 | 100% | 100% |
| REQ→Test 覆盖率 | 0% | 100% |

### 文件位置

```
.agile-v/
├── REQUIREMENTS.md          # 需求定义（REQ）
├── BUILD_MANIFEST.md        # 实现清单（ART）
├── TEST_SPEC.md             # 测试规格（TC）
├── ATM.md                   # 追溯矩阵摘要
├── DECISION_LOG.md          # 决策日志
├── EVAL_RESULTS.md          # 评估结果
├── STATE.md                 # 当前状态
└── CONTROL_MATRIX.yaml      # 控制矩阵
```
