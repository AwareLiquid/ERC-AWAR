# ERC-AWAR — Toward ERC-83xx

**Agent Experience Delta (AXD) & Verifiable Memory Commitment (VMC)**

一个面向链上 AI 记忆管理的 EIP/ERC 标准草案：让 AI Agent 的记忆可**版本化、可溯源、不可篡改、可共享、可资产化**。

A draft EIP/ERC standard for on-chain AI memory: making agent memory **versioned, traceable, tamper-evident, shareable, and tradable**.

## 核心原语 / Primitives

- **Agent Experience Delta (AXD)** — 记忆以内容寻址的"增量提交"形式传递与版本化（类 Git DAG），多 Agent 协作只同步差异，显著节省 Token。
- **Verifiable Memory Commitment (VMC)** — 仅将 Merkle 承诺锚定上链（哈希上链、数据离链，参考 IPFS / EthStorage），提供不可篡改与归属证明。
- **Memory Market** — 个人/组织的 AI 记忆（如 Decision Workflow）作为资产在链上授权、调用、交易。

## 在 Agent 协议栈中的定位 / Positioning

以太坊 AI-Agent 标准正形成模块化协议栈：身份（**ERC-8004**）、执行/账户（**ERC-4337 / ERC-8196**）、有界授权（**ERC-8226**）、推理验证（**ERC-8126 / ERC-8274**）、证明锚定（**ERC-8263 / ERC-8299**）、商业（**ERC-8183**）。缺失的一层是**记忆随时间的演化**——ERC-83xx 正是这一层，复用而非重造上述标准。

## 设计基础 / Built on

- [Awareness-Market](https://github.com/everest-an/Awareness-Market) — 本地优先 MCP 记忆系统，混合检索，LongMemEval Recall@5 95.6%。
- 浅空间多智能体（Shallow-space Multi-Agent）向量空间沟通与召回。

## 文档 / Docs

- 📄 **[项目 SPEC](./SPEC.md)** — 完整规范（卡片模型、八层图谱、AXD、VMC、链上接口、市场、路线图）。

## 状态 / Status

`Draft / RFC` — ERC 编号 `83xx` 为占位符，待正式 EIP 流程确定。欢迎以 Issue / PR 参与讨论。

## License

待定 / TBD（建议 Apache-2.0，与 Awareness 一致）。
