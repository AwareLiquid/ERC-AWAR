# Toward ERC-83xx: Agent Experience Delta and Verifiable Memory Commitment

> Project SPEC · Draft v0.2 · 2026-06-27
> Repository: https://github.com/AwareLiquid/ERC-AWAR
> Status: **Draft / RFC** (pre-EIP, ERC number `83xx` reserved as placeholder)

---

## 0. 摘要 / Abstract

**中文**
AI Agent 已经在以太坊生态中逐步获得**身份**、**支付**与**合约**能力，但仍缺少对其**记忆（Memory）**演化的标准化管理。记忆需要可溯源、可同步、可版本化、不可篡改、可云端协调，并支持单向与多向的推理共享。本标准提出两个核心原语：

1. **Agent Experience Delta（AXD，智能体经验增量）** —— 记忆以"增量/补丁"为单位传递与版本化，类似 Git 的提交 DAG，使多 Agent / 多仓库协作时只同步差异，显著降低 Token 与带宽消耗。
2. **Verifiable Memory Commitment（VMC，可验证记忆承诺）** —— 仅将记忆状态的**哈希承诺（Merkle 根）**锚定上链（参考 IPFS / EthStorage 的"哈希上链、数据离链"思路），在不暴露与不全量上链原始数据的前提下，提供不可篡改、可归属、可验证的记忆演化证明。

在此之上构建**记忆市场（Memory Market）**，使个人或组织的 AI 记忆（如 Decision Workflow）可作为资产在链上被授权、调用或交易，实现知识产权的传承与变现。

**English**
AI agents are gaining on-chain **identity**, **payment**, and **execution** capabilities, yet lack a standard for how their **memory and internal state evolve over time**. Memory must be traceable, synchronizable, versioned, tamper-evident, cloud-coordinated, and shareable for one-way and multi-way reasoning — and that evolution must be committable, auditable, exportable, and revocable **without exposing private cognitive content**. This standard defines two primitives: **Agent Experience Delta (AXD)** — memory exchanged and versioned as content-addressed deltas over a commit DAG — and **Verifiable Memory Commitment (VMC)** — on-chain anchoring of a Merkle commitment over off-chain memory, providing immutability, attribution, and verifiability without publishing raw data. Together they enable a **Memory Market** where agent memory becomes a licensable, callable, tradable asset.

---

## 1. Positioning in the Agent Stack / 在 Agent 协议栈中的定位

Ethereum's emerging AI-agent standards are rapidly forming a **modular protocol stack** for autonomous systems. Existing and in-progress ERCs already cover identity, execution, bounded authority, inference verification, proof anchoring, and commerce. One critical layer remains underdefined: **how an agent's memory and internal state evolve over time**, and how that evolution can be committed, audited, exported, or revoked **without exposing private cognitive content**. ERC-83xx targets exactly this **memory-evolution layer**.

### 1.1 The current stack / 现有栈

| Layer | ERC(s) | Role | Answers |
|---|---|---|---|
| Identity & reputation | **ERC-8004** Trustless Agents | portable ERC-721 agent identity + reputation/validation registries (live on mainnet 2026-01-29) | *Who is this agent, and is it trusted?* |
| Execution / account | **ERC-4337** (account abstraction), **ERC-8196** Authenticated Wallet | smart-account execution, session keys | *Can this agent act, and through what account?* |
| Bounded authority | **ERC-8226** Regulated Agent Mandate | scoped, time-bounded, financially-capped delegation from a verified principal | *What is the agent allowed to do, within what limits?* |
| Inference verification | **ERC-8126** AI Agent Verification (ZK, risk score 0–100; finalized 2026-06), **ERC-8274** Inference Proof Verification Interfaces | multi-layer / ZK verification of agent & inference | *Is this agent / inference trustworthy?* |
| Proof anchoring | **ERC-8263** Onchain Proof (inference attestation), **ERC-8299** WYRIWE (input provenance) | anchor digests of inference **output** (8263) and **input** (8299) | *Did this agent actually produce this output, from this input?* |
| Commerce | **ERC-8183** AI Agent Commerce | agents hire / pay / settle disputes | *How do agents transact?* |
| **Memory evolution (this proposal)** | **ERC-83xx** (AXD + VMC) | versioned, committed, auditable memory deltas; off-chain content, on-chain commitment | ***How does the agent's memory change over time — and can we trust, share, and own that history?*** |

> ERC 编号以 EIP 流程为准；上表为撰写时（2026-06）公开可见的草案/已定稿状态，可能变动。

### 1.2 The missing layer / 缺失的一层

ERC-8263 anchors a cryptographic digest of a **single canonical inference payload** — model, prompt hash, output hash, tool calls, metadata, and signature — answering a point-in-time accountability question: *did this specific agent actually produce this output?* ERC-8299 (WYRIWE) complements it by committing to the **input** actually read. But neither captures the **longitudinal** dimension: an agent is not merely a sequence of isolated inferences — it **accumulates, revises, and prunes memory**. Today there is no standard way to:

- commit to a memory **state** and prove **how it evolved** (lineage / version DAG);
- **export / import / revoke** memory across agents without leaking private content;
- **attribute and own** the resulting knowledge as a transferable asset.

ERC-83xx fills this gap. **AXD** gives memory a versioned, content-addressed evolution model (delta commits over a DAG); **VMC** anchors only Merkle commitments on-chain, so the *evolution* is auditable while raw cognition stays private off-chain.

### 1.3 Composition with the stack / 与现有标准的组合

- **Identity (8004):** agent identity signs every AXD commit; the anchor's `agent` field reuses the 8004 identifier.
- **Proof anchoring (8263 / 8299):** an inference attestation or input-provenance digest can be referenced from an `observation` / `reference` card, linking *what was produced* to *what was remembered*.
- **Inference verification (8126 / 8274):** a memory space can carry a risk score; consumers may require a minimum trust level before licensing.
- **Bounded authority (8226):** read / export / revoke rights over a Memory Space can be gated by a scoped, time-bounded mandate.
- **Commerce (8183):** Memory-Market licensing and settlement reuse the agent-commerce rails rather than redefining payments.

ERC-83xx 刻意只定义"记忆演化"这一层，复用而非重造身份、支付、授权与推理证明。

---

## 2. Motivation / 动机

现有 AI 协作的两个核心痛点：

1. **上下文管理低效**：多仓库 / 多 Agent 协作中，上下文靠人工复制、论坛轮询、整段重复注入，Token 消耗大、信息割裂、无版本可追。
2. **记忆资产确权难**：Agent 产出的经验（决策、工作流、解法）无法被可信地归属、引用、复用或交易，缺少不可篡改的行为与演化记录。

技术基础（已验证）：

- **Awareness**（https://github.com/everest-an/Awareness-Market）：本地优先的 MCP 记忆服务，采用 Markdown 记忆 + 知识卡片 + 混合检索（BM25/FTS5 + `all-MiniLM-L6-v2` 384 维向量 + RRF）+ 渐进式披露，在 **LongMemEval (ICLR 2025)** 上 **Recall@5 = 95.6%**，并可在 Claude 中节省约一半 Token。
- **浅空间多智能体（Shallow-space Multi-Agent，参考普林斯顿相关研究）**：以向量空间中的高效沟通与记忆召回替代长文本传递，是 AXD 增量同步的理论支撑。

**目标**：定义一份关于 AI 记忆**版本管理**与**卡片类型**的 EIP/ERC 标准，使记忆可被不可篡改地记录、跨 Agent 共享、并资产化。

---

## 3. Terminology / 术语

| 术语 | 定义 |
|---|---|
| **Memory Card（记忆卡片）** | 记忆的最小类型化单元，内容可寻址（content-addressed），有唯一卡片哈希。 |
| **Memory Graph（记忆图谱）** | 卡片及其关系构成的分层图（见 §5 八层模型）。 |
| **AXD / Delta（经验增量）** | 一组对记忆图谱的卡片级操作（add/update/deprecate/link），形成一次"提交"。 |
| **Commit（提交）** | 一次记忆状态变更，引用父提交，构成 Merkle DAG。 |
| **VMC / Commitment（记忆承诺）** | 对某一记忆状态计算的 Merkle 根，锚定上链。 |
| **Anchor（锚点）** | 上链记录的 `(spaceId, commitHash, parent, root, version, uri, agent, sig)` 元组。 |
| **Memory Space（记忆空间）** | 一个可独立寻址、可授权的记忆命名空间（个人/组织/项目）。 |
| **Agent Identity（智能体身份）** | 复用现有 ERC 身份标准（ERC-8004 / 账户抽象 ERC-4337）的可签名身份。 |

---

## 4. Architecture Overview / 架构总览

```
┌──────────────────────────────────────────────────────────────┐
│  Agents / IDEs (Claude Code, Cursor, ...)                      │
│        │  record / recall (MCP)        │  delta sync           │
├────────┴───────────────────────────────┴──────────────────────┤
│  AXD Engine        — diff/patch、版本 DAG、向量召回             │
│  Card & Graph      — 13 类卡片、8 层图谱、规范化序列化         │
├────────────────────────────────────────────────────────────────┤
│  VMC Layer         — Merkle 承诺、签名、归属                    │
├──────────────┬─────────────────────────────────────────────────┤
│ Off-chain    │  IPFS / EthStorage / Arweave  (全量卡片 + 嵌入)   │
│ On-chain     │  ERC-83xx Registry (仅锚定哈希 + 元数据 + 市场)   │
│              │  composes with 8004 / 8263 / 8226 / 8183          │
└──────────────┴─────────────────────────────────────────────────┘
```

设计原则：**数据离链、承诺上链**。链上只承载验证与确权所需的最小信息（哈希、版本、归属、许可），原始记忆与向量存于离链可寻址存储。

---

## 5. Memory Card Schema & Card Types / 卡片模型与类型

### 5.1 Card 规范结构

每张卡片是一个 JSON 对象，使用**确定性规范序列化**（键排序、UTF-8、无多余空白；推荐 JCS / RFC 8785）后计算 `cardHash = keccak256(canonical(card))`。

```jsonc
{
  "schema": "erc83xx/card/v0",
  "type": "decision",            // 见 §5.2，13 种之一
  "id": "card:<uuid>",           // 稳定逻辑 ID（跨版本不变）
  "content": { /* 类型相关字段 */ },
  "embedding": {                 // 可选；为隐私只存承诺
    "model": "all-MiniLM-L6-v2",
    "dim": 384,
    "hash": "0x…"               // 向量本体存离链
  },
  "links": [                     // 指向其他卡片/实体的有类型边
    { "rel": "supersedes", "target": "card:<uuid>" }
  ],
  "meta": {
    "author": "<agent-id>",      // 复用 ERC-8004 身份
    "createdAt": "2026-06-27T00:00:00Z",
    "space": "<memorySpaceId>",
    "tags": ["…"]
  }
}
```

### 5.2 十三种卡片类型 / 13 Card Types

| # | Type | 用途 |
|---|---|---|
| 1 | `decision` | 决策及其理由（替代/被替代关系可追溯） |
| 2 | `solution` | 可复用的解法 / 修复 |
| 3 | `risk` | 风险、隐患、未知项 |
| 4 | `workflow` | 决策工作流 / 可执行流程（市场核心资产） |
| 5 | `fact` | 已验证的领域知识 |
| 6 | `preference` | 用户/组织/Agent 偏好与约束 |
| 7 | `reference` | 指向外部系统/资源的指针（可指向 8263/8299 推理证明） |
| 8 | `task` | 目标 / 待办 / 进展 |
| 9 | `entity` | 实体节点（人/物/概念/服务） |
| 10 | `relation` | 实体之间的有类型关系（边） |
| 11 | `observation` | 原始观测 / 会话事件 / 日志（可锚定推理 attestation） |
| 12 | `hypothesis` | 待验证的推理假设 |
| 13 | `reflection` | 元学习 / 经验教训 |

> 类型集合通过注册表的 `cardTypeRegistry` 可治理扩展；自定义类型使用 `x-<vendor>-<name>` 前缀，不占用保留命名空间。

---

## 6. Memory Graph — Eight Layers / 八层记忆图谱

| Layer | 名称 | 内容 |
|---|---|---|
| L0 | Raw / Event | `observation` 原始事件、日志 |
| L1 | Entity | 抽取的 `entity` 节点 |
| L2 | Relation | `relation` 类型化边 |
| L3 | Semantic / Embedding | 向量索引（语义召回） |
| L4 | Card | 类型化知识卡片（§5） |
| L5 | Workflow / Procedure | 由卡片组合的 `workflow` |
| L6 | Version / Commit | AXD 提交 DAG、归属与签名 |
| L7 | Commitment / Anchor | Merkle 根与链上锚点（§8） |

召回（recall）按需跨层下钻：L3 向量定位 → L4 卡片 → 经 L6 验证版本 → 经 L7 验证承诺。

---

## 7. Agent Experience Delta (AXD) / 经验增量

### 7.1 Delta 与提交

一次 **Delta** 是对记忆图谱的卡片级操作集合：

```jsonc
{
  "schema": "erc83xx/delta/v0",
  "space": "<memorySpaceId>",
  "parent": "<commitHash | null>",   // 父提交，构成 DAG
  "ops": [
    { "op": "add",        "card": { /* §5.1 */ } },
    { "op": "update",     "cardId": "card:…", "card": { /* 新版本 */ } },
    { "op": "deprecate",  "cardId": "card:…", "reason": "…" },
    { "op": "link",       "from": "card:…", "rel": "supersedes", "to": "card:…" }
  ],
  "author": "<agent-id>",
  "createdAt": "2026-06-27T00:00:00Z"
}
```

**提交哈希**：`commitHash = keccak256(canonical(delta_without_sig))`，再由作者身份（ERC-8004）签名 `sig`。提交形成 Merkle DAG（支持分支与合并，类似 Git）。

### 7.2 同步语义（单向 / 多向）

- **单向共享（one-way）**：源空间向目标 Agent 推送只读 Delta 流（订阅）。
- **多向共享（multi-way）**：多 Agent 各自提交 Delta，通过 DAG 合并 + 冲突解析（卡片级 last-writer-wins / 语义合并 / 人审）收敛。
- **传输只发增量**：同步基于 `parent` 指针做差集，避免全量上下文重复注入 —— 这是 Token 节省的来源。

---

## 8. Verifiable Memory Commitment (VMC) / 可验证记忆承诺

### 8.1 承诺构造

1. 收集某次提交可见的全部卡片哈希集合 `{cardHash_i}`。
2. 排序后构建 Merkle 树，得到 `root`。
3. `root` 与提交元数据一起锚定上链（§9）。

验证某张卡片属于某记忆状态：提供 `(leaf=cardHash, proof[])`，链上/链下用 `root` 校验 Merkle 证明。

### 8.2 不可篡改与归属

- **不可篡改**：任何对离链卡片的修改都会改变 `cardHash → root`，与链上锚点不符即被发现。
- **归属**：每次提交由 Agent 身份（ERC-8004）签名；锚点记录 `agent` 地址，形成可审计的行为链。
- **隐私**：链上只见哈希；敏感记忆可加密后离链存储，仅授权方持密钥解密（§10）。
- **与推理证明互补**：8263/8299 证明"单次推理可信"，VMC 证明"记忆状态随时间的演化可信"——前者是点，后者是线。

---

## 9. On-chain Registry Interface / 链上注册表接口

参考接口（Solidity，草案，最终以 EIP 文本为准）：

```solidity
interface IERC83xx {
    // ---- 锚定 / Anchoring ----
    event MemoryCommitted(
        bytes32 indexed spaceId,
        bytes32 indexed commitHash,
        bytes32 parent,
        bytes32 root,
        address indexed agent,   // ERC-8004 identity
        uint64  version,
        string  uri            // 离链存储定位 (ipfs://, ethstorage://, ar://)
    );

    /// 锚定一次记忆提交（仅哈希上链）
    function commit(
        bytes32 spaceId,
        bytes32 commitHash,
        bytes32 parent,
        bytes32 root,
        uint64  version,
        string calldata uri,
        bytes  calldata signature
    ) external;

    /// 读取某空间的最新承诺
    function head(bytes32 spaceId) external view returns (
        bytes32 commitHash, bytes32 root, uint64 version, string memory uri
    );

    /// 校验某卡片属于某承诺
    function verify(
        bytes32 root, bytes32 leaf, bytes32[] calldata proof
    ) external pure returns (bool);

    // ---- 市场 / Market（结算可复用 ERC-8183 商业层）----
    event MemoryListed(bytes32 indexed spaceId, uint256 price, address payToken, uint8 licenseType);
    event MemoryLicensed(bytes32 indexed spaceId, address indexed licensee, uint64 untilVersion);

    function list(bytes32 spaceId, uint256 price, address payToken, uint8 licenseType) external;
    function license(bytes32 spaceId) external payable;        // 调用/订阅授权
    function hasLicense(bytes32 spaceId, address who) external view returns (bool);
}
```

设计要点：
- `commit` 为 append-only；链上不存内容，只存 `(commitHash, parent, root, version, uri, agent)`。
- `license` 与现有 **支付/商业** 能力（ERC-8183、ERC-20）对接，授权可按版本区间或时间订阅。
- 身份签名校验复用 **ERC-8004 / ERC-4337**，不在本 ERC 内重复定义。
- 读取/导出/撤销权限可由 **ERC-8226** 有界授权 mandate 约束。

---

## 10. Off-chain Storage & Privacy / 离链存储与隐私

- **存储后端**：IPFS（CID 即内容哈希，天然对齐承诺）、EthStorage（长期数据可用性）、Arweave（永久存储）。`uri` 使用对应协议 scheme。
- **加密**：私有记忆采用信封加密（数据密钥加密内容，授权方公钥包裹数据密钥）；市场授权时随许可分发密钥访问凭证。
- **承诺即可验证可用性**：`root` 锚定 + 离链 CID 使第三方可独立校验"链上承诺 ↔ 离链数据"一致。

---

## 11. Memory Market / 记忆市场

- **资产单元**：一个 Memory Space 或其中的 `workflow` / 卡片集合。
- **授权模式**：一次性调用、版本区间、时间订阅、可转让许可。
- **结算**：复用 ERC-8183 商业层 / ERC-20 支付；可叠加版税（原作者在二次授权中分成）。
- **可组合**：被授权的记忆可作为另一 Agent 的输入，形成"记忆 → 推理（可经 8263 证明）→ 新记忆"的链上可追溯传承。

---

## 12. Security & Privacy Considerations / 安全与隐私

- **重放与冒充**：提交签名绑定 `(spaceId, commitHash, parent)`，防跨空间重放。
- **数据可用性**：链上承诺有效不代表离链数据长期可取；建议多后端冗余 + EthStorage 担保。
- **隐私泄露**：避免在 `tags` / `uri` 中泄露明文；嵌入向量可被反演，敏感空间只存向量承诺。
- **撤销语义**：撤销（revoke）只能停止未来访问与新增承诺；已分发的明文无法链上回收，须配合加密 + 密钥轮换。
- **治理风险**：`cardTypeRegistry` 与市场参数需明确治理与升级路径。

---

## 13. Related ERCs & Composition / 相关标准与组合

本标准只定义"记忆演化"层，刻意复用而非重造（编号以 EIP 流程为准）：

| ERC | 名称 | 与 ERC-83xx 的关系 |
|---|---|---|
| **ERC-8004** | Trustless Agents（身份/声誉/验证） | 提供签名身份；AXD 提交与锚点的 `agent` 字段即 8004 身份。 |
| **ERC-4337** | Account Abstraction | 智能账户执行与 session key，承载 commit 交易。 |
| **ERC-8196** | AI Agent Authenticated Wallet | Agent 可认证钱包，签名记忆提交。 |
| **ERC-8226** | Regulated Agent Mandate（有界授权） | 约束谁可读取/导出/撤销某 Memory Space（scoped/time-bounded/capped）。 |
| **ERC-8126** | AI Agent Verification（ZK 风险分 0–100） | 记忆空间可携带可信度评分，消费方设最低门槛。 |
| **ERC-8274** | Inference Proof Verification Interfaces | 推理证明的验证接口，可被 `observation` 卡片引用。 |
| **ERC-8263** | Onchain Proof（推理输出 attestation） | 证明单次产出；VMC 证明记忆演化——点与线互补。 |
| **ERC-8299** | WYRIWE（推理输入 provenance） | 证明输入来源；可与记忆中的 `reference` 卡片绑定。 |
| **ERC-8183** | AI Agent Commerce | 记忆市场的授权结算与争议处理复用其商业层。 |
| **ERC-721** | NFT（可选） | Memory Space 句柄可选地表示为 ERC-721 以便转让，但承诺与版本以本 ERC 注册表为准。 |
| 存储 | IPFS / EthStorage / Arweave | 离链内容寻址与可用性。 |

---

## 14. Reference Implementation Plan / 参考实现规划

1. **`packages/spec`** — 卡片/Delta JSON Schema、规范化（JCS）与哈希工具。
2. **`packages/axd-engine`** — Delta diff/patch、提交 DAG、合并与冲突解析；向量召回适配 Awareness。
3. **`contracts/`** — `ERC83xx` 注册表 + 市场（Foundry/Hardhat，含测试）。
4. **`packages/mcp-bridge`** — 将 Awareness 的 `record/recall` 映射到 AXD 提交与 VMC 锚定。
5. **`examples/`** — 多 Agent 单向/多向同步 Demo + 记忆市场授权 Demo。

---

## 15. Roadmap / 里程碑

| 阶段 | 目标 | 交付 |
|---|---|---|
| M0 | 本 SPEC 定稿（RFC） | `SPEC.md` + 术语/接口冻结 |
| M1 | Schema + 哈希/Merkle 工具 | `packages/spec` |
| M2 | AXD 引擎 + Awareness 桥接 | 增量同步可跑通 |
| M3 | 注册表 + 市场合约（测试网） | `contracts/` + 部署脚本 |
| M4 | EIP 草案提交 | 正式 EIP/ERC PR（确定 83xx 编号） |
| M5 | 端到端 Demo + 基准 | Token 节省 / 召回准确率报告 |

---

## 16. Repository Layout / 仓库结构（规划）

```
ERC-AWAR/
├── SPEC.md                 # 本文档
├── README.md
├── eip/                    # EIP 正式草案文本
├── packages/
│   ├── spec/               # schema + 规范化 + 哈希
│   ├── axd-engine/         # delta / 版本 DAG / 召回
│   └── mcp-bridge/         # Awareness ↔ ERC-83xx
├── contracts/              # 注册表 + 市场
└── examples/               # 多 Agent / 市场 demo
```

---

## 17. Open Questions / 待议

1. 提交 DAG 的合并冲突在卡片级的标准合并语义（自动 vs 人审边界）。
2. 向量召回结果是否需要可验证性（zkML / 承诺）以支持"可信召回"，并与 ERC-8126 风险分对接。
3. 市场版税与许可的链上标准化程度（内置 vs 复用 ERC-8183）。
4. ERC 编号与既有 81xx/82xx Agent 区段的最终对齐（83xx 为占位）。
5. 跨链记忆空间的寻址与承诺同步。
6. 撤销（revoke）在"已分发明文不可回收"前提下的可执行边界。

---

*本 SPEC 为草案，欢迎以 Issue / PR 讨论。参考研究：腾讯会议纪要（docs.qq.com，需授权）、Awareness-Market、普林斯顿浅空间多智能体相关工作；ERC 栈编号据 2026-06 公开草案/定稿状态整理，可能变动。*
