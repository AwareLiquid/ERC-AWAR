# Toward ERC-83xx: Agent Experience Delta and Verifiable Memory Commitment

> Project SPEC · Draft v0.3 · 2026-06-27
> Repository: https://github.com/AwareLiquid/ERC-AWAR
> Tentative ERC title: *Agent Experience Delta and Memory Commitment Interface*
> Status: **Draft / RFC** (pre-EIP, ERC number `83xx` is a placeholder)

---

## 0. 摘要 / Abstract

**核心命题 / Thesis**

> Memory is not just what an agent recalls. Memory is **how an agent becomes accountable over time**.
> ERC-83xx upgrades AI memory from *off-chain storage* to **verifiable state transition**.

**中文**
AI Agent 正在以太坊上获得身份、执行、推理证明、商业等能力，但仍缺少一层：**Agent 的记忆与内部状态如何随时间演化**，以及这种演化如何在**不暴露私有认知内容**的前提下被提交、审计、导出与撤销。本标准把记忆视为**可验证的状态转移**，提出 **Experience Delta（经验增量）**：对一次记忆/状态变更的密码学承诺，记录"前序承诺 + 新内容承诺 + 记忆类型 + schema 哈希 + 推理锚点 + 输入哈希 + 前序 delta + 时间戳 + 版本 + 签名"，形成类似 Git 的记忆演化链。原始记忆加密离链，链上只存承诺、事件、引用与证明。

**English**
ERC-83xx defines the missing **memory-evolution layer** of the AI-agent stack. It treats an agent's memory as a **verifiable state transition** rather than passive storage. The central object is the **Experience Delta**: a cryptographic commitment to a change in an agent's memory or internal state, recording the prior memory commitment, the new content commitment, memory type, schema hash, related inference anchor, related input hash, previous delta, timestamp, version, and signature — forming a Git-like chain of memory evolution. Raw memory stays encrypted off-chain; the chain stores only commitments, events, references, and proofs.

---

## 1. Positioning in the Agent Stack / 在 Agent 协议栈中的定位

Ethereum's emerging AI-agent standards are forming a **modular protocol stack** for autonomous systems. Existing ERC discussions already cover identity, execution, input provenance, inference verification, proof anchoring, memory rights, memory portability, bounded authority, and commerce. One critical layer remains underdefined: **how an agent's memory and internal state evolve over time**, and how that evolution can be committed, audited, exported, or revoked **without exposing private cognitive content**.

### 1.1 The current AI-native Ethereum stack

| Layer | ERC | Role |
|---|---|---|
| Identity | **ERC-8004** | Trustless agent identity / reputation / validation. |
| Execution | **ERC-8301** | Dispatch tasks to agents + staged callbacks (`AgentTask`, `IAgentCaller`, `IAgentHandler`); workflow committed by hash. |
| Input Provenance | **ERC-8299 (WYRIWE)** | Triple-hash commitment over *raw input → sanitization pipeline → final model input*; an agent cannot silently rewrite the user's request. |
| Verification | **ERC-8274** | Minimal `IProofVerifier` interface unifying zkML / optimistic ML / TEE / oracle / multisig backends. |
| Anchoring | **ERC-8263** | On-chain inference attestation registry: digest of model, prompt hash, output hash, tool calls, metadata, signature. *Did this agent produce this output?* |
| Memory Rights | **ERC-8264** | AI Agent Memory Access Rights: an address (the memory subject) gets standardized rights to read / write / delete / export — mapping to access, rectification, erasure, portability. |
| Memory Portability | **ERC-8269** | Body leases & credential brokers: memory exported as encrypted capsules, movable across runtimes / hardware bodies / execution substrates while preserving revocability. |
| Bounded Authority | **ERC-8312** | Bounded agent actions: tracks how much of a delegated mandate an agent has consumed; separates **authorization** from **metering**. |
| Commerce / Settlement | **ERC-8183 / ERC-8275** | Agents hire / pay / settle. |
| **Memory Evolution (this proposal)** | **ERC-83xx** | **How the agent's memory changed — committed, typed, attested, versioned.** |

> 编号与状态以 EIP 流程为准；上表依据本提案权威设计文本整理（2026-06）。

### 1.2 The missing bridge / 缺失的桥

There is still a gap between **memory as a user right** and **memory as an agentic state transition**:

- **ERC-8264** gives the subject control over memory records, but does **not** define the *internal structure* of those records, the *categories* of memory, the *schema* used to interpret them, or *how updates should be attested*.
- **ERC-8263** can prove an inference happened, but **not** how that inference *changed* an agent's memory.
- **ERC-8301** standardizes how an agent is invoked, but **not** how the agent *loads, modifies, or persists* memory during execution.
- **ERC-8299 (WYRIWE)** proves what input was given, but **not** whether that input caused a *durable change* in the agent's future behavior.

ERC-83xx fills this gap.

---

## 2. Motivation / 动机

In conventional RAG systems memory is an application-local database: a user says something, the system stores a summary or embedding, future responses retrieve it. There is **no standard way** to prove *when* the memory changed, *what prior state* it replaced, *what input* caused the change, *what inference* produced it, or *whether the update was authorized*.

For agents that trade, sign, negotiate, govern, operate tools, or act across protocols, this is insufficient. Memory becomes part of the agent's **operational state**, and state transitions require **commitments**.

实践动机（已验证的技术基础）：

- **Awareness**（https://github.com/everest-an/Awareness-Market）— 本地优先 MCP 记忆服务。知识卡片实际为 `decisions / insights / solutions / workflows`，加 `memories`、`tasks`；混合检索 = SQLite FTS5/BM25 + 嵌入向量 + RRF + 渐进式披露；在 **LongMemEval (ICLR 2025)** 上 **Recall@5 = 95.6%**，在 Claude 中约省一半 Token。Awareness 提供 ERC-83xx 的离链记忆引擎与卡片 schema 参考。
- **LatentMAS**（论文 *Latent Collaboration in Multi-Agent Systems*, arXiv:2511.20639；代码 https://github.com/Gen-Verse/LatentMAS）— 多 Agent 在**连续潜空间**协作：以 last-layer 隐藏嵌入生成 "latent thoughts"，通过 **shared latent working memory**（实现上是跨 agent 传递的 KV-cache / hidden embeddings）无损交换，训练无关，输出 Token 降低约 70.8%–83.7%、推理快 4–4.3×、准确率最高 +14.6%。这为 `MEMORY_LATENT` / `MEMORY_SHARED_WORKING` 两类记忆与"只传增量"的 Token 节省提供了直接依据。

---

## 3. Core Concept: Memory as a Verifiable State Transition / 记忆即可验证状态转移

An AI agent's memory should be treated as a **verifiable state transition**, not passive storage. A memory update is:

```
previous memory state  +  verified input  +  verified inference  +  typed schema
        ──────────────────────────────────────────────────────────────────►
                              new committed memory state
```

This transforms memory from an opaque platform artifact into an **auditable protocol object**. The agent's lifecycle becomes:

```
input → inference → output → memory delta → future behavior
```

— the missing link between AI *execution* and AI *agency*.

---

## 4. Experience Delta / 经验增量

An **Experience Delta** is a cryptographic commitment to a change in an agent's memory or internal state. It does **not** store raw memory on-chain.

### 4.1 Delta record / 增量记录字段

| Field | 说明 |
|---|---|
| `priorMemoryCommitment` | 前序内容承诺（genesis 为 0）。 |
| `newContentCommitment` | 新内容承诺（离链 payload 哈希）。 |
| `memoryType` | 类型化类别（见 §5 的 8 类 `MEMORY_*`）。 |
| `schemaHash` | 解释该承诺所需的 schema 哈希。 |
| `inferenceAnchor` | 关联的 **ERC-8263** 推理锚点（可空）。 |
| `inputHash` | 关联的 **ERC-8299 / WYRIWE** 输入承诺（可空）。 |
| `previousDelta` | 前序 delta，串成演化链（线性或分支 DAG）。 |
| `timestamp` | 时间戳。 |
| `version` | 版本号。 |
| `signature` | 作者（**ERC-8004** 身份）签名。 |

这创建了一条**记忆演化链**，类似 Git commit history 或状态转移日志：既能证明"发生了什么变更"，又能证明"由哪次可信输入与可信推理引起、替换了哪个前序状态、是否被授权"。

### 4.2 Sync semantics（单向 / 多向）

- **单向（one-way）**：源空间向目标 Agent 推送只读 delta 流（订阅）。
- **多向（multi-way）**：多 Agent 各自提交 delta，经 `previousDelta` 指针合并与冲突解析收敛。
- **只传增量**：同步基于 delta 链做差集，避免整段上下文重复注入 —— Token 节省的来源（与 LatentMAS 的潜空间增量传递动机一致）。

---

## 5. Typed Memory Categories / 类型化记忆类别

Memory is not uniform: a text memory ≠ an embedding ≠ a latent representation; a policy memory ≠ a tool trace; a shared working memory used by multiple agents ≠ a user's episodic memory. ERC-83xx defines **8 canonical on-chain categories**:

| Category | 含义 / 典型 schema |
|---|---|
| `MEMORY_TEXT` | 文本记忆；schema 为 JSON schema。 |
| `MEMORY_EMBEDDING` | 嵌入向量；schema 指定模型名与向量维度。 |
| `MEMORY_LATENT` | 潜表示（如 LatentMAS 的隐藏嵌入 / KV-cache 切片）；schema 指定 model family、layer、tensor shape、dtype、compression。 |
| `MEMORY_TOOL_TRACE` | 工具调用轨迹。 |
| `MEMORY_EPISODIC` | 归属于用户的情节记忆。 |
| `MEMORY_POLICY` | 策略 / 规则记忆。 |
| `MEMORY_SHARED_WORKING` | 多 Agent 共享工作记忆（对应 LatentMAS shared latent working memory）。 |
| `MEMORY_PROOF` | 证明类记忆（引用推理/验证证明）。 |

每个记忆对象携带 `schemaHash`，使离链验证者知道**如何解释承诺**。没有类型化与 schema 承诺，Agent 可能（无意或恶意地）将不兼容的记忆对象当作可互换 —— 这是必须杜绝的。

> **应用层 vs 规范层**：以上 8 类是**链上规范类型**。应用层卡片体系（如 Awareness 的 decisions/insights/solutions/workflows + memories + tasks）映射进这些类别（多为 `MEMORY_TEXT` / `MEMORY_EPISODIC` / `MEMORY_POLICY`）。本 ERC 不固定应用层卡片数量，仅固定 8 类规范类型与 `schemaHash` 机制。

---

## 6. On-chain Registry Interface / 链上注册表接口

参考接口（Solidity 草案，最终以 EIP 文本为准）：

```solidity
interface IERC83xx {
    enum MemoryType {
        TEXT, EMBEDDING, LATENT, TOOL_TRACE,
        EPISODIC, POLICY, SHARED_WORKING, PROOF
    }

    struct ExperienceDelta {
        bytes32   spaceId;               // 记忆主体/命名空间 (ERC-8264 subject)
        bytes32   priorMemoryCommitment; // 前序承诺 (genesis = 0)
        bytes32   newContentCommitment;  // 新内容承诺 (离链 payload hash)
        MemoryType memoryType;
        bytes32   schemaHash;            // 如何解释承诺
        bytes32   inferenceAnchor;       // ERC-8263 (可空)
        bytes32   inputHash;             // ERC-8299 / WYRIWE (可空)
        bytes32   previousDelta;         // 演化链指针
        uint64    timestamp;
        uint64    version;
    }

    event ExperienceCommitted(
        bytes32 indexed spaceId,
        bytes32 indexed deltaId,
        bytes32 previousDelta,
        MemoryType memoryType,
        address indexed agent,           // ERC-8004 identity
        string  uri                      // ipfs:// | ethstorage:// | ar://
    );
    event MemoryRevoked(bytes32 indexed spaceId, bytes32 indexed deltaId, address by);
    event DeletionProven(bytes32 indexed spaceId, bytes32 indexed deltaId, bytes32 evidence);

    /// 提交一次经验增量（仅承诺上链）；返回 deltaId = keccak256(canonical(delta))
    function commitDelta(
        ExperienceDelta calldata d,
        string calldata uri,
        bytes calldata signature
    ) external returns (bytes32 deltaId);

    /// 某空间的最新承诺
    function head(bytes32 spaceId) external view returns (
        bytes32 deltaId, bytes32 commitment, uint64 version
    );

    /// 撤销（受 ERC-8264 权利 / ERC-8312 mandate 约束）
    function revoke(bytes32 spaceId, bytes32 deltaId) external;

    /// 删除证明：存储系统提交"payload 已移除 / 密钥已轮换或销毁"的密码学证据
    function proveDeletion(bytes32 spaceId, bytes32 deltaId, bytes calldata evidence) external;
}
```

设计要点：链上 append-only，只存承诺/事件/引用/证明；身份签名复用 **ERC-8004**；不把原始 prompt、私有记忆、嵌入、潜状态写入 calldata。

---

## 7. Composition with the Stack / 与现有标准的组合

ERC-83xx 直接与现有 AI-Agent ERC 栈组合：

- **ERC-8263（锚定）**：每个 Experience Delta 可引用 `inferenceAnchor`，证明该记忆更新跟随某次已承诺的推理。
- **ERC-8299（输入溯源）**：每个 delta 可引用 `inputHash`，证明同一用户/净化后输入是因果链的一部分。
- **ERC-8301（执行）**：任务执行可要求在特定工作流阶段提交记忆变更。
- **ERC-8274（验证）**：证明不仅验证模型输出，也可验证**记忆变换**本身。
- **ERC-8264（记忆权利）**：`writeMemory` / `deleteMemory` 可发出 Experience Delta 事件，而非不透明存储操作。
- **ERC-8269（可迁移）**：导出的记忆胶囊可包含**有序 delta 链**，使 Agent 跨 body / runtime / chain / 执行基底迁移。
- **ERC-8312（有界授权）**：记忆写入可作为有界权限的一部分被**计量**，防止失控的记忆增长或未授权的自我修改。
- **ERC-8004（身份）/ ERC-8183·8275（商业）**：签名归属与市场结算复用既有层。

---

## 8. Off-chain Storage & Privacy / 离链存储与隐私

- **存储后端**：IPFS（CID = 内容哈希，天然对齐承诺）、EthStorage（长期可用性）、Arweave（永久）。`uri` 使用对应 scheme（`ipfs://` / `ethstorage://` / `ar://` / `https://`）。**local-first** 场景（如 Awareness 本地记忆库）使用 `awareness://` 表示载荷驻留在本地授权存储，发布到公共后端时再替换为对应 CID/URI。
- **加密**：私有记忆采用信封加密；市场授权时随许可分发密钥访问凭证。
- **承诺即可验证可用性**：`root`/承诺锚定 + 离链 CID 使第三方可独立校验"链上承诺 ↔ 离链数据"一致。
- 链只作为**承诺层**（provenance、permissions、versioning、accountability）；原始记忆始终加密离链。

---

## 9. Compliance & Sovereignty / 合规与主权

用户应能：查看哪些记忆涉及自己、纠正过时记录、撤销访问、导出记忆历史、请求删除（对齐 ERC-8264 的访问/纠正/擦除/可携权）。

但公链上的"删除"本质困难。本标准区分四种语义：

1. **On-chain revocation（链上撤销）**：停止未来访问与新增承诺（`revoke`）。
2. **Off-chain payload deletion（离链载荷删除）**：从授权存储移除明文。
3. **Key destruction（密钥销毁/轮换）**：使密文不可再解。
4. **Optional proof-of-deletion（可选删除证明）**：`proveDeletion` 允许存储系统提交密码学证据，证明某 payload 已从特定授权存储移除、或相关解密密钥已轮换/销毁。

> 删除证明**不**等于"全网普遍删除"，但提供了一个可落地的合规原语。

---

## 10. Memory Market / 记忆市场

- **资产单元**：一个 Memory Space 或其中的 `workflow` / 记忆集合。
- **授权模式**：一次性调用、版本区间、时间订阅、可转让许可。
- **结算**：复用 **ERC-8183 / ERC-8275** 商业层与 ERC-20；可叠加版税。
- **可组合**：被授权记忆可作为另一 Agent 的输入，形成"记忆 → 推理（8263 可证）→ 新记忆"的链上可追溯传承。
- **经济可读性（开放）**：记忆更新可被经济化 —— 对有用的记忆形成给予奖励，对损坏/陈旧/未授权的更新施加惩罚（见 §13）。

---

## 11. Recursive Experiential Cognition (REC) / 递归经验认知

ERC-83xx 连接更宽的研究方向 **REC**。关键问题不是系统是否"有意识"，而是它能否：跨时间保持连续性、观察自身状态变化、整合错误、更新目标、修订记忆、用先验经验约束未来行动。

**ERC-83xx 不声称证明 AI 意识；它定义验证"类经验状态转移"的基础设施。** 由此，Agent 从无状态推理端点，变为拥有**可验证适应历史**的系统：

```
input → inference → output → memory delta → future behavior
```

Agent 可对外暴露高层状态变化指标（version、salience、confidence、policy update、error integration），而无需泄露专有内部表征 —— 即**可验证的自建模（agent self-modeling）**。

---

## 12. Benefits / 收益

1. **Auditability（可审计）**：用户、保险方、监管者、协议不仅能追踪 Agent 产出了什么，还能追踪其内部承诺如何随时间变化。
2. **Privacy（隐私）**：只有承诺与 schema 哈希公开，原始记忆加密离链。
3. **Composability（可组合）**：记忆更新可链接到身份、执行、输入溯源、推理证明、记忆权利、胶囊、有界 mandate。
4. **Agent self-modeling（自建模）**：暴露高层状态变化指标而不泄露内部表示。

> 本质：这不是一个记忆数据库，而是一个**记忆状态转移协议（memory state-transition protocol）**。

---

## 13. Open Design Questions / 待议设计问题

1. 记忆历史应是**线性链**还是允许**分支状态图**？分支可表达替代假设、自我反思、竞争性记忆解释，但增加验证复杂度。
2. salience / confidence / self-model 指标应**标准化进 ERC-83xx**，还是留给后续 introspection 标准？
3. 删除证明（proof-of-deletion）应**内置本 ERC**，还是独立成标准？
4. 跨链记忆 delta 锚定应采用 **CAIP 风格链无关标识符**，还是定义以太坊自有的规范 anchor 格式？
5. 记忆更新应否**经济可读**（对有用记忆形成奖励、对损坏/陈旧/未授权更新惩罚）？
6. 应用层卡片体系到 8 类 `MEMORY_*` 的标准映射与一致性校验。

---

## 14. Security Considerations / 安全

- **重放与冒充**：签名绑定 `(spaceId, deltaId, previousDelta)`，防跨空间/跨链重放。
- **数据可用性**：链上承诺有效 ≠ 离链数据长期可取；建议多后端冗余 + EthStorage 担保。
- **隐私泄露**：避免在 `uri` / 元数据泄露明文；嵌入/潜向量可被反演，敏感空间只存承诺。
- **未授权自我修改**：通过 ERC-8312 计量记忆写入，约束失控增长与越权改写。
- **撤销边界**：已分发明文无法链上回收，须配合加密 + 密钥销毁 + `proveDeletion`。

---

## 15. Reference Implementation Plan / 参考实现规划

1. **`packages/spec`** — Experience Delta / 8 类 MemoryType / schema 的 JSON Schema、规范化（JCS, RFC 8785）、承诺与 deltaId 哈希工具。
2. **`packages/delta-engine`** — delta diff/patch、演化链（线性 + 分支）、合并与冲突解析；对接 Awareness 的离链记忆与混合检索。
3. **`contracts/`** — `IERC83xx` 注册表 + 删除证明 + 市场（Foundry/Hardhat，含测试），与 8263/8299/8264/8312 的组合适配器。
4. **`packages/mcp-bridge`** — 将 Awareness `record/recall` 映射为 `commitDelta` 与承诺锚定；LatentMAS `MEMORY_LATENT` 适配。
5. **`examples/`** — 多 Agent 单向/多向同步 + 记忆市场授权 + 删除证明 Demo。

---

## 16. Roadmap / 里程碑

| 阶段 | 目标 | 交付 |
|---|---|---|
| M0 | 本 SPEC 定稿（RFC） | `SPEC.md` + 术语/接口冻结 |
| M1 | Schema + 哈希/承诺工具 | `packages/spec` |
| M2 | Delta 引擎 + Awareness 桥接 | 增量同步可跑通 |
| M3 | 注册表 + 删除证明 + 市场（测试网） | `contracts/` + 部署脚本 |
| M4 | EIP 草案提交 | 正式 EIP/ERC PR（确定 83xx 编号） |
| M5 | 端到端 Demo + 基准 | Token 节省 / 召回准确率 / 组合性报告 |

---

## 17. Repository Layout / 仓库结构（规划）

```
ERC-AWAR/
├── SPEC.md                 # 本文档
├── README.md
├── eip/                    # EIP 正式草案文本
├── packages/
│   ├── spec/               # schema + 规范化 + 承诺哈希
│   ├── delta-engine/       # experience delta / 演化链 / 召回
│   └── mcp-bridge/         # Awareness ↔ ERC-83xx
├── contracts/              # 注册表 + 删除证明 + 市场
└── examples/               # 多 Agent / 市场 / 删除证明 demo
```

---

## 18. References / 参考

- **LatentMAS** — *Latent Collaboration in Multi-Agent Systems*, arXiv:2511.20639. Code: https://github.com/Gen-Verse/LatentMAS （潜空间协作、shared latent working memory、token 效率）。
- **Awareness** — https://github.com/everest-an/Awareness-Market （本地优先 MCP 记忆、混合检索、LongMemEval Recall@5 95.6%）。
- AI-Agent ERC 栈：ERC-8004 / 8301 / 8299 / 8274 / 8263 / 8264 / 8269 / 8312 / 8183 / 8275（编号据 2026-06 公开草案整理，可能变动）。
- 设计文本：本提案 *Agent Experience Delta and Memory Commitment Interface* 草案；REC（Recursive Experiential Cognition）研究方向。

---

*本 SPEC 为草案，欢迎以 Issue / PR 讨论。*

> ERC-8263 proves that an inference happened. ERC-8274 proves it can be verified. ERC-8299 proves what input was processed. ERC-8301 standardizes how the agent was invoked. ERC-8264 gives the subject rights over memory. ERC-8269 makes memory portable across bodies. ERC-8312 meters agent authority. **ERC-83xx proves how the agent's memory changed.** This is the missing primitive.
