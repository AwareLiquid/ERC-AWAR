# Toward ERC-83xx: Agent Experience Delta and Verifiable Memory Commitment

> Project SPEC · Draft v0.1 · 2026-06-27
> Repository: https://github.com/AwareLiquid/ERC-AWAR
> Status: **Draft / RFC** (pre-EIP, ERC number `83xx` reserved as placeholder)

---

## 0. 摘要 / Abstract

**中文**
AI Agent 已经在以太坊生态中逐步获得**身份**、**支付**与**合约**能力，但仍缺少对其**记忆（Memory）**的标准化管理。记忆需要可溯源、可同步、可版本化、不可篡改、可云端协调，并支持单向与多向的推理共享。本标准提出两个核心原语：

1. **Agent Experience Delta（AXD，智能体经验增量）** —— 记忆以"增量/补丁"为单位传递与版本化，类似 Git 的提交 DAG，使多 Agent / 多仓库协作时只同步差异，显著降低 Token 与带宽消耗。
2. **Verifiable Memory Commitment（VMC，可验证记忆承诺）** —— 仅将记忆状态的**哈希承诺（Merkle 根）**锚定上链（参考 IPFS / EthStorage 的"哈希上链、数据离链"思路），在不暴露与不全量上链原始数据的前提下，提供不可篡改、可归属、可验证的记忆证明。

在此之上构建**记忆市场（Memory Market）**，使个人或组织的 AI 记忆（如 Decision Workflow）可作为资产在链上被授权、调用或交易，实现知识产权的传承与变现。

**English**
AI agents are gaining on-chain **identity**, **payment**, and **contract** capabilities, yet lack a standard for managing their **memory**. Memory must be traceable, synchronizable, versioned, tamper-evident, cloud-coordinated, and shareable for one-way and multi-way reasoning. This standard defines two primitives: **Agent Experience Delta (AXD)** — memory exchanged and versioned as content-addressed deltas over a commit DAG — and **Verifiable Memory Commitment (VMC)** — on-chain anchoring of a Merkle commitment over off-chain memory, providing immutability, attribution, and verifiability without publishing raw data. Together they enable a **Memory Market** where agent memory becomes a licensable, callable, tradable asset.

---

## 1. Motivation / 动机

现有 AI 协作的两个核心痛点：

1. **上下文管理低效**：多仓库 / 多 Agent 协作中，上下文靠人工复制、论坛轮询、整段重复注入，Token 消耗大、信息割裂、无版本可追。
2. **记忆资产确权难**：Agent 产出的经验（决策、工作流、解法）无法被可信地归属、引用、复用或交易，缺少不可篡改的行为记录。

技术基础（已验证）：

- **Awareness**（https://github.com/everest-an/Awareness-Market）：本地优先的 MCP 记忆服务，采用 Markdown 记忆 + 知识卡片 + 混合检索（BM25/FTS5 + `all-MiniLM-L6-v2` 384 维向量 + RRF）+ 渐进式披露，在 **LongMemEval (ICLR 2025)** 上 **Recall@5 = 95.6%**，并可在 Claude 中节省约一半 Token。
- **浅空间多智能体（Shallow-space Multi-Agent，参考普林斯顿相关研究）**：以向量空间中的高效沟通与记忆召回替代长文本传递，是 AXD 增量同步的理论支撑。

**目标**：定义一份关于 AI 记忆**版本管理**与**卡片类型**的 EIP/ERC 标准，使记忆可被不可篡改地记录、跨 Agent 共享、并资产化。

---

## 2. Terminology / 术语

| 术语 | 定义 |
|---|---|
| **Memory Card（记忆卡片）** | 记忆的最小类型化单元，内容可寻址（content-addressed），有唯一卡片哈希。 |
| **Memory Graph（记忆图谱）** | 卡片及其关系构成的分层图（见 §4 八层模型）。 |
| **AXD / Delta（经验增量）** | 一组对记忆图谱的卡片级操作（add/update/deprecate/link），形成一次"提交"。 |
| **Commit（提交）** | 一次记忆状态变更，引用父提交，构成 Merkle DAG。 |
| **VMC / Commitment（记忆承诺）** | 对某一记忆状态计算的 Merkle 根，锚定上链。 |
| **Anchor（锚点）** | 上链记录的 `(memoryId, version, parent, root, uri, agent, sig)` 元组。 |
| **Memory Space（记忆空间）** | 一个可独立寻址、可授权的记忆命名空间（个人/组织/项目）。 |
| **Agent Identity（智能体身份）** | 复用现有 ERC 身份/账户标准（如账户抽象、ERC-8004 等）的可签名身份。 |

---

## 3. Architecture Overview / 架构总览

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
└──────────────┴─────────────────────────────────────────────────┘
```

设计原则：**数据离链、承诺上链**。链上只承载验证与确权所需的最小信息（哈希、版本、归属、许可），原始记忆与向量存于离链可寻址存储。

---

## 4. Memory Card Schema & Card Types / 卡片模型与类型

### 4.1 Card 规范结构

每张卡片是一个 JSON 对象，使用**确定性规范序列化**（键排序、UTF-8、无多余空白；推荐 JCS / RFC 8785）后计算 `cardHash = keccak256(canonical(card))`。

```jsonc
{
  "schema": "erc83xx/card/v0",
  "type": "decision",            // 见 §4.2，13 种之一
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
    "author": "<agent-id>",
    "createdAt": "2026-06-27T00:00:00Z",
    "space": "<memorySpaceId>",
    "tags": ["…"]
  }
}
```

### 4.2 十三种卡片类型 / 13 Card Types

| # | Type | 用途 |
|---|---|---|
| 1 | `decision` | 决策及其理由（替代/被替代关系可追溯） |
| 2 | `solution` | 可复用的解法 / 修复 |
| 3 | `risk` | 风险、隐患、未知项 |
| 4 | `workflow` | 决策工作流 / 可执行流程（市场核心资产） |
| 5 | `fact` | 已验证的领域知识 |
| 6 | `preference` | 用户/组织/Agent 偏好与约束 |
| 7 | `reference` | 指向外部系统/资源的指针 |
| 8 | `task` | 目标 / 待办 / 进展 |
| 9 | `entity` | 实体节点（人/物/概念/服务） |
| 10 | `relation` | 实体之间的有类型关系（边） |
| 11 | `observation` | 原始观测 / 会话事件 / 日志 |
| 12 | `hypothesis` | 待验证的推理假设 |
| 13 | `reflection` | 元学习 / 经验教训 |

> 类型集合通过注册表的 `cardTypeRegistry` 可治理扩展；自定义类型使用 `x-<vendor>-<name>` 前缀，不占用保留命名空间。

---

## 5. Memory Graph — Eight Layers / 八层记忆图谱

| Layer | 名称 | 内容 |
|---|---|---|
| L0 | Raw / Event | `observation` 原始事件、日志 |
| L1 | Entity | 抽取的 `entity` 节点 |
| L2 | Relation | `relation` 类型化边 |
| L3 | Semantic / Embedding | 向量索引（语义召回） |
| L4 | Card | 类型化知识卡片（§4） |
| L5 | Workflow / Procedure | 由卡片组合的 `workflow` |
| L6 | Version / Commit | AXD 提交 DAG、归属与签名 |
| L7 | Commitment / Anchor | Merkle 根与链上锚点（§7） |

召回（recall）按需跨层下钻：L3 向量定位 → L4 卡片 → 经 L6 验证版本 → 经 L7 验证承诺。

---

## 6. Agent Experience Delta (AXD) / 经验增量

### 6.1 Delta 与提交

一次 **Delta** 是对记忆图谱的卡片级操作集合：

```jsonc
{
  "schema": "erc83xx/delta/v0",
  "space": "<memorySpaceId>",
  "parent": "<commitHash | null>",   // 父提交，构成 DAG
  "ops": [
    { "op": "add",        "card": { /* §4.1 */ } },
    { "op": "update",     "cardId": "card:…", "card": { /* 新版本 */ } },
    { "op": "deprecate",  "cardId": "card:…", "reason": "…" },
    { "op": "link",       "from": "card:…", "rel": "supersedes", "to": "card:…" }
  ],
  "author": "<agent-id>",
  "createdAt": "2026-06-27T00:00:00Z"
}
```

**提交哈希**：`commitHash = keccak256(canonical(delta_without_sig))`，再由作者身份签名 `sig`。提交形成 Merkle DAG（支持分支与合并，类似 Git）。

### 6.2 同步语义（单向 / 多向）

- **单向共享（one-way）**：源空间向目标 Agent 推送只读 Delta 流（订阅）。
- **多向共享（multi-way）**：多 Agent 各自提交 Delta，通过 DAG 合并 + 冲突解析（卡片级 last-writer-wins / 语义合并 / 人审）收敛。
- **传输只发增量**：同步基于 `parent` 指针做差集，避免全量上下文重复注入 —— 这是 Token 节省的来源。

---

## 7. Verifiable Memory Commitment (VMC) / 可验证记忆承诺

### 7.1 承诺构造

1. 收集某次提交可见的全部卡片哈希集合 `{cardHash_i}`。
2. 排序后构建 Merkle 树，得到 `root`。
3. `root` 与提交元数据一起锚定上链（§8）。

验证某张卡片属于某记忆状态：提供 `(leaf=cardHash, proof[])`，链上/链下用 `root` 校验 Merkle 证明。

### 7.2 不可篡改与归属

- **不可篡改**：任何对离链卡片的修改都会改变 `cardHash → root`，与链上锚点不符即被发现。
- **归属**：每次提交由 Agent 身份签名；锚点记录 `agent` 地址，形成可审计的行为链。
- **隐私**：链上只见哈希；敏感记忆可加密后离链存储，仅授权方持密钥解密（§9）。

---

## 8. On-chain Registry Interface / 链上注册表接口

参考接口（Solidity，草案，最终以 EIP 文本为准）：

```solidity
interface IERC83xx {
    // ---- 锚定 / Anchoring ----
    event MemoryCommitted(
        bytes32 indexed spaceId,
        bytes32 indexed commitHash,
        bytes32 parent,
        bytes32 root,
        address indexed agent,
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

    // ---- 市场 / Market ----
    event MemoryListed(bytes32 indexed spaceId, uint256 price, address payToken, uint8 licenseType);
    event MemoryLicensed(bytes32 indexed spaceId, address indexed licensee, uint64 untilVersion);

    function list(bytes32 spaceId, uint256 price, address payToken, uint8 licenseType) external;
    function license(bytes32 spaceId) external payable;        // 调用/订阅授权
    function hasLicense(bytes32 spaceId, address who) external view returns (bool);
}
```

设计要点：
- `commit` 为 append-only；链上不存内容，只存 `(commitHash, parent, root, version, uri, agent)`。
- `license` 与现有 **支付** 能力（原生币 / ERC-20）对接，授权可按版本区间或时间订阅。
- 身份签名校验复用现有 **ERC 身份 / 账户抽象** 标准，不在本 ERC 内重复定义。

---

## 9. Off-chain Storage & Privacy / 离链存储与隐私

- **存储后端**：IPFS（CID 即内容哈希，天然对齐承诺）、EthStorage（长期数据可用性）、Arweave（永久存储）。`uri` 使用对应协议 scheme。
- **加密**：私有记忆采用信封加密（数据密钥加密内容，授权方公钥包裹数据密钥）；市场授权时随许可分发密钥访问凭证。
- **承诺即可验证可用性**：`root` 锚定 + 离链 CID 使第三方可独立校验"链上承诺 ↔ 离链数据"一致。

---

## 10. Memory Market / 记忆市场

- **资产单元**：一个 Memory Space 或其中的 `workflow` / 卡片集合。
- **授权模式**：一次性调用、版本区间、时间订阅、可转让许可。
- **结算**：链上支付（原生币 / ERC-20）；可叠加版税（原作者在二次授权中分成）。
- **可组合**：被授权的记忆可作为另一 Agent 的输入，形成"记忆 → 推理 → 新记忆"的链上可追溯传承。

---

## 11. Security & Privacy Considerations / 安全与隐私

- **重放与冒充**：提交签名绑定 `(spaceId, commitHash, parent)`，防跨空间重放。
- **数据可用性**：链上承诺有效不代表离链数据长期可取；建议多后端冗余 + EthStorage 担保。
- **隐私泄露**：避免在 `tags` / `uri` 中泄露明文；嵌入向量可被反演，敏感空间只存向量承诺。
- **治理风险**：`cardTypeRegistry` 与市场参数需明确治理与升级路径。

---

## 12. Related ERCs / 相关标准与兼容

本标准只定义"记忆"层，刻意复用而非重造：

- **身份 / 账户**：账户抽象、Agent 身份标准（如 ERC-8004 方向）。
- **支付**：原生币 / ERC-20 / 订阅类支付。
- **存储寻址**：IPFS CID、EthStorage、Arweave。
- **NFT 化（可选）**：Memory Space 句柄可选地表示为 ERC-721 以便转让，但承诺与版本以本 ERC 注册表为准。

---

## 13. Reference Implementation Plan / 参考实现规划

1. **`packages/spec`** — 卡片/Delta JSON Schema、规范化（JCS）与哈希工具。
2. **`packages/axd-engine`** — Delta diff/patch、提交 DAG、合并与冲突解析；向量召回适配 Awareness。
3. **`contracts/`** — `ERC83xx` 注册表 + 市场（Foundry/Hardhat，含测试）。
4. **`packages/mcp-bridge`** — 将 Awareness 的 `record/recall` 映射到 AXD 提交与 VMC 锚定。
5. **`examples/`** — 多 Agent 单向/多向同步 Demo + 记忆市场授权 Demo。

---

## 14. Roadmap / 里程碑

| 阶段 | 目标 | 交付 |
|---|---|---|
| M0 | 本 SPEC 定稿（RFC） | `SPEC.md` + 术语/接口冻结 |
| M1 | Schema + 哈希/Merkle 工具 | `packages/spec` |
| M2 | AXD 引擎 + Awareness 桥接 | 增量同步可跑通 |
| M3 | 注册表 + 市场合约（测试网） | `contracts/` + 部署脚本 |
| M4 | EIP 草案提交 | 正式 EIP/ERC PR（确定 83xx 编号） |
| M5 | 端到端 Demo + 基准 | Token 节省 / 召回准确率报告 |

---

## 15. Repository Layout / 仓库结构（规划）

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

## 16. Open Questions / 待议

1. 提交 DAG 的合并冲突在卡片级的标准合并语义（自动 vs 人审边界）。
2. 向量召回结果是否需要可验证性（zkML / 承诺）以支持"可信召回"。
3. 市场版税与许可的链上标准化程度（内置 vs 留给上层合约）。
4. ERC 编号与既有 83xx 区段的最终对齐。
5. 跨链记忆空间的寻址与承诺同步。

---

*本 SPEC 为草案，欢迎以 Issue / PR 讨论。参考研究：腾讯会议纪要（docs.qq.com，需授权）、Awareness-Market、普林斯顿浅空间多智能体相关工作。*
