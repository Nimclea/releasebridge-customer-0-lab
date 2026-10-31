# ReleaseBridge · Customer 0 Lab

**12 次连续修复 → 12 个合法接受结果 → 12 份持续有效保护。**

Nimclea 的公开第一方试用仓库。示例应用为 ParcelDesk 订单处理内核：计价、SKU/库存、
配送/重试、支付/退款。代码按业务职责组织，**没有固定业务模块数量，也不是一任务一文件**。
这些 Bug 是刻意预置的验收缺陷，不是外部客户事故。

## 现在有什么
- 12 个独立行为目标，每个有一份可执行测试和一份任务说明。
- 首次产品裁决目标：3 PASS、4 UNKNOWN、5 DENY；每条路径有合法恢复要求。
- 后续修复重复触及同一文件，故必须保持此前行为并合法更新物理保护基线。
- C1 累积保护、C2 非法回归拦截与合法更新合同。
- 普通 Node.js 应用 CI，无 npm 依赖、无真实支付、无外部数据。

**没有预装 ReleaseBridge，没有活动保护，没有接受收据，没有外部客户成功案例。**
当前仓库只是可运行的试验对象，不是 Auto-Protect 的新实现。

## 运行
需要 Node.js 20+。无需 npm install。

```sh
node src/demo.mjs
node tools/lab.mjs smoke
node tools/lab.mjs baseline
node tools/lab.mjs inventory
node tools/lab.mjs check --only R01
node tools/lab.mjs check --through R01
```

`baseline` 验证初始样本：5 个 smoke 检查通过，12 个缺陷都确实触发断言失败。
它返回 0 表示“缺陷样本准备正确”，**不是修复通过**。
`check` 返回非零表示代码合同失败；初始 R01..R12 均应失败。
未来修复不影响今天的建库，修复后不要再把 `baseline` 当 CI。

## 每轮操作
1. 从 `tasks/R01.md` 开始，按 R01...R12 顺序，只启动当前一项已授权真实 Agent 任务。
2. 使用 `repair/R01-description` 这样的分支提交 Candidate。
3. CI 对该分支自动运行 smoke + R01...当前轮的累计代码合同。
4. ReleaseBridge 自己完成实际判断、UNKNOWN 处理或 DENY 返工、合法接受和自动保护。
5. 记录实际证据，再处理下一轮。不能把应用 CI 或计划表当保护生效证明。

普通 main push / 非 repair 分支仅运行应用 smoke，明确标为 lab health。
代码 CI 不配置 Required Check，不修改任何仓库 Ruleset，也不执行 `pull_request_target` 候选代码。
产品安装和权限由后续真实客户流程单独完成。

## 验收地图
- [12 + 2 总合同](acceptance/12-plus-2.md)
- [12 场景机器可读计划](acceptance/scenarios.json)
- [场景条件与恢复方式](acceptance/scenario-control.md)
- [0 号客户操作记录](acceptance/customer-journey.md)
- [每轮实测证据模板](acceptance/evidence-template.md)
- [R01 首个任务](tasks/R01.md)

`UNKNOWN` 不是永久停工：能自动等待/补证的自动做，真正的业务和权限决定才交给人。
`DENY` 拒绝当前输入：可修复技术问题返原 Agent；安全冲突先由有权人处理。
人类批准不直接变成 PASS，必须重新核验精确版本。

## 12 份保护到底是什么
每个 Rxx 有独立 claim ID 与行为合同。它们必须同时在当前接受版本上有效。
不是 12 个文件数量，不是 12 行日志，不是同一文件的 12 个旧哈希。
共享文件升级必须保留或重新证明以前的主张；旧历史可 supersede，但主张不能悄悄丢失。

## 公开数据边界
只放合成样例。不上传真实客户信息、身份凭证、付费信息、原始 Agent 对话或私有 Case。
这不是退款、税务或生产交易系统。测试不能证明实际生产财务计算正确。

## CI 的信任边界
分支名选择本次应用测试范围，不授予保护或接受资格。产品消费者必须自己核验正确任务 ID、
精确 SHA、完整必要证据以及测试/工作流是否被篡改。不能只凭本仓库的绿灯批准冻结。
测试可能在同一文件内新增修复；单 Blob 永久锁定若阻碍合法后续修复，就记录真实产品缺口。

C2 未来的有界升级合同可单独运行 `node tools/lab.mjs c2`；初始包不会自动执行或接受该升级。
