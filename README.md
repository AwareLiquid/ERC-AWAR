# ERC-AWAR — Toward ERC-83xx

**Agent Experience Delta & Verifiable Memory Commitment**
*(tentative ERC title: Agent Experience Delta and Memory Commitment Interface)*

把 AI Agent 的记忆从"离链存储"升级为**可验证的状态转移**。链上只存承诺、事件、引用与证明；原始记忆加密离链。

> Memory is not just what an agent recalls. Memory is **how an agent becomes accountable over time**.

## 核心原语 / Primitives

- **Experience Delta（经验增量）** — 对一次记忆/状态变更的密码学承诺：`前序承诺 + 新内容承诺 + 记忆类型 + schemaHash + 推理锚点(8263) + 输入哈希(8299) + 前序delta + 时间戳 + 版本 + 签名`，串成类 Git 的记忆演化链。
- **公式**：`previous memory state + verified input + verified inference + typed schema = new committed memory state`
- **8 类规范记忆类型**：`MEMORY_TEXT / EMBEDDING / LATENT / TOOL_TRACE / EPISODIC / POLICY / SHARED_WORKING / PROOF`，各带 `schemaHash`。
- **合规原语**：链上撤销 / 离链载荷删除 / 密钥销毁 / `proveDeletion` 删除证明。
- **记忆市场**：记忆作为资产授权、调用、交易。

## 在 Agent 协议栈中的定位 / Positioning

| Layer | ERC |
|---|---|
| Identity | ERC-8004 |
| Execution | ERC-8301 |
| Input Provenance | ERC-8299 (WYRIWE) |
| Verification | ERC-8274 |
| Anchoring | ERC-8263 |
| Memory Rights | ERC-8264 |
| Memory Portability | ERC-8269 |
| Bounded Authority | ERC-8312 |
| Commerce / Settlement | ERC-8183 / ERC-8275 |
| **Memory Evolution（本提案）** | **ERC-83xx** |

ERC-83xx 只定义"记忆演化"层，复用而非重造身份/执行/证明/授权/商业。

## 设计基础 / Built on

- [LatentMAS](https://github.com/Gen-Verse/LatentMAS) — *Latent Collaboration in Multi-Agent Systems* (arXiv:2511.20639)：多 Agent 在连续潜空间协作，shared latent working memory 无损传递，输出 Token 降低 ~70–84%。对应 `MEMORY_LATENT` / `MEMORY_SHARED_WORKING`。
- [Awareness-Market](https://github.com/everest-an/Awareness-Market) — 本地优先 MCP 记忆系统，混合检索，LongMemEval Recall@5 95.6%。

## 文档 / Docs

📄 **[项目 SPEC](./SPEC.md)** — 完整规范（栈定位、Experience Delta、8 类记忆、链上接口、组合、合规删除、REC、市场、路线图、待议）。

## 状态 / Status

`Draft / RFC` — ERC 编号 `83xx` 为占位符，待正式 EIP 流程确定。欢迎以 Issue / PR 参与讨论。

## License

待定 / TBD（建议 Apache-2.0，与 Awareness 一致）。
