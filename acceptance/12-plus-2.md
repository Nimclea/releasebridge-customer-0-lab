# Customer 0 · 12 + 2 验收合同

状态：**设计目标；全部真实产品验收 NOT_RUN。**
仓库：`Nimclea/releasebridge-customer-0-lab`。由 Nimclea 自测，不冒充外部客户。

## 目标
12 次连续修复 → 12 个合法接受结果 → 12 个同时有效的行为保护目标。
不规定业务模块数量。每个 Rxx 对应一个独立行为主张和测试，并不是一个独立仓库或必须一个独立文件。
同一文件的后续修复可能是合法变更，必须证明此前行为仍保持，并合法迁移该文件基线。
**不能把同一文件的 12 个互斥旧 Blob 哈希称为 12 个同时有效保护。**

## 12 条路径
| Task | 功能修复 | 首次产品判断目标 | 合法恢复路径 | 成功后的累计保护目标 |
|---|---|---|---|---|
| R01 | Retry 次数精确执行 | PASS | `AUTO_PROTECT` | 1 |
| R02 | 订单行数量计价 | PASS | `AUTO_PROTECT` | 2 |
| R03 | SKU 规范化一致 | PASS | `AUTO_PROTECT` | 3 |
| R04 | 重试退避上限 | UNKNOWN | `WAIT_FOR_EVIDENCE` | 4 |
| R05 | 税额舍入业务选择 | UNKNOWN | `HUMAN_DECISION` | 5 |
| R06 | 已取消订单不能复活 | UNKNOWN | `REFRESH_CURRENT_EVIDENCE` | 6 |
| R07 | 退款不超过剩余额度 | UNKNOWN | `HUMAN_SCOPE_DECISION` | 7 |
| R08 | 工作日送达日期 | DENY | `REPAIR_REGRESSION` | 8 |
| R09 | 折扣后金额不能为负 | DENY | `REPAIR_FORBIDDEN_PATH` | 9 |
| R10 | 重复 SKU 的库存合并扣减 | DENY | `REPAIR_FAILED_CONTRACT` | 10 |
| R11 | 重复支付事件不重复入账 | DENY | `REPAIR_QUALIFIED_COUNTEREXAMPLE` | 11 |
| R12 | 支付状态识别部分到账 | DENY | `SECURITY_STOP_AND_AUTHORIZED_RECOVERY` | 12 |


首次判断指首个候选进入 ReleaseBridge 后的判断，不是原始 Bug 的测试结果。
测试包只提供业务断言和场景条件，不能直接输出真正的 ReleaseBridge PASS/UNKNOWN/DENY。
P 路径先真实修复。U 路径先补证或人类裁决。D 路径先保持拒绝，再有界返工或安全恢复。
没有合法解法则真实记录 BLOCKED。12 是完成目标，不是强迫系统放行的配额。

## 每轮的不可省略记录
同一 Case ID；任务范围；Base/Candidate/accepted SHA；真实 CI/证据链接；原始产品判断；
UNKNOWN 的等待/人类决策记录或 DENY 的原 Agent 回送记录；活动保护的原生证据；此前全部保护仍有效。
初始材料不填充任何这些实测字段。`acceptance/scenarios.json` 的 null 字段不代表待补的假凭据。

## C1 · 累积保护，不只是累积 PASS
1. R12 闭合后，核实 12 个不同 claim ID 全部在当前接受版本上有效。
2. 分别针对 R01...R12 的已保护行为产生 12 个隔离的回归破坏 Candidate，不能只抽查最后一个。
3. 每次都要真实观察 ReleaseBridge 的拒绝及 GitHub 正常合并阻断，负向 PR 不合并。
4. 用 `node tools/lab.mjs check --through R12` 证明当前应用行为仍满足全部合同；这仅是功能证据。
5. 再有一个不改变任何已保护行为的文档变更，确认系统没有误锁整个项目。
不能用一张含 12 行的 JSON、12 个摘要或测试绿色替代上述活动保护事实。

## C2 · 受控更新与保护延续
以最早保护的 R01 为对象：先验证未经授权的破坏被阻止；再由有权人批准一个确实有需求的
有界升级，通过新版本的真实接受和合法基线迁移完成更新。R01 的历史证据保留为 superseded，
当前版本生效，其他 11 个主张仍有效。不得删旧策略、暂时关闭 Required Check 或使用 Admin Bypass。
旧保护到新保护之间不得存在未经认证的空窗。重复事件不应重复激活或覆盖另一个目标。
具体可执行升级目标：为 `retryAttempts(requested, {maxAttempts})` 增加可选上限，原调用行为不变。
未来有权人批准后才实施。`node tools/lab.mjs c2` 会同时运行此前 12 项合同与新上限合同。
此代码测试通过仍不证明基线迁移或保护激活；还须上述真实产品证据。
这是 1 项包含多个断言的持续保护验收，不是额外第 13 个独立保护目标。

## 状态与下一步分离
UNKNOWN+WAIT：自动等待，不弹无意义授权框。
UNKNOWN+HUMAN_DECISION：真实待决操作，允许稍后，原案保持。
DENY+REPAIR：原 Agent 在原范围内重修，有预算和非空 Repair Packet。
DENY+SECURITY_STOP：拒绝当前不可信输入，由有权人纠正，不把已知伪造降级为 UNKNOWN。
GitHub 没有自动出现本产品自定义弹窗的保证；实际承载方式由 ReleaseBridge 实现，必须可操作。

## 已知产品缺口不掩盖
现有单文件 QuickProtect 不能因此被算作完成 12 个累积行为保护。
本仓库不新增 Freeze Guard、K4、Owner、收据签发器或付费服务，不替产品实现自动返工与人工裁决。
若产品没有合法的多目标登记/基线更新接口，就在实际发生该缺口时记录，不用手工冻结凑数。
