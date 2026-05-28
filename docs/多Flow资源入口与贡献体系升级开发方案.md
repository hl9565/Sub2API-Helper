# 多 Flow 贡献/使用教程组合入口与账号贡献体系开发方案

> 本文是唯一开发方案。目标固定为：用户在任意已发布 flow 中都能贡献当前 flow 产出的账号。OpenAI、Kiro、新增 flow 均通过统一账号贡献体系接入，不再把贡献能力绑定到 OpenAI OAuth。

## 实施状态

截至 2026-05-19，本方案已按开发清单落地到扩展与账号贡献门户：

1. 扩展端已统一使用 `accountContributionEnabled`、`contributionAdapterId`、`flowContributionRuntime` 与 `SET_ACCOUNT_CONTRIBUTION_MODE` / `START_FLOW_CONTRIBUTION` / `POLL_FLOW_CONTRIBUTION_STATUS`。
2. 扩展端不保留旧贡献 message 兼容入口；`contributionMode` 仅允许出现在一次性 storage migration 与迁移测试中。
3. 顶部“贡献/使用教程”是组合入口：点击后按当前 `activeFlowId` 打开当前 flow 教程 URL，并在可切换时开启当前 flow 的账号贡献模式。
4. OpenAI 与 Kiro 均已注册贡献 adapter；Kiro 使用 `kiro-builder-id`，步骤 8 产出 Builder ID 后自动提交公共贡献。
5. 账号贡献门户已新增统一 `POST /api/contributions`，可接收 OpenAI `openai-oauth`、`openai-codex-file`、`openai-sub2api-file` 与 Kiro `kiro-builder-id` artifact；旧 `/api/upload` 仅作为历史 HTTP 入口保留，并委托统一 intake。
6. 门户数据库、管理后台、内容摘要均补齐 `flow_id`、`adapter_id`、`artifact_kind` 或 flow/target 作用域，后台返回逐账号详情时会脱敏凭据。

## 0. 硬性目标

1. 任意已发布 flow 必须具备账号贡献入口。
2. 任意已发布 flow 必须注册 `ContributionAdapter`。
3. 任意已发布 flow 必须在门户端注册对应 `IntakeSpec`。
4. “贡献账号”和“使用教程”共用同一个顶部组合入口，点击后同时打开当前 flow 的教程/门户并开启当前 flow 的贡献模式。
5. OpenAI 历史贡献格式必须升级到统一 `ContributionArtifact + IntakeSpec` 体系。
6. OpenAI OAuth 贡献实现迁入 `openai-oauth` adapter，不作为其他 flow 的通用实现。
7. Kiro 账号贡献使用 `kiro-builder-id` 凭据包实现。
8. 新增 flow 没有 contribution adapter 时不得发布。
9. 扩展端不保留历史接口、历史 message、历史兼容入口，目的是让后续扩展开发只面对一套统一协议。
10. 扩展端只允许保留一次性 storage migration，用于把历史存储字段迁到新字段，迁移后运行时代码不得继续读取旧字段。
11. 服务器后端允许保留历史 HTTP 入口，目的是兼容仍在使用旧版本扩展、旧上传页面或外部旧请求的用户。
12. 服务器后端历史 HTTP 入口必须加注释说明，并且只能委托统一 intake，不能承载新业务逻辑。

开发结论：

1. 侧边栏顶部“贡献/使用教程”保持为单个组合按钮。
2. 点击组合按钮后按当前 `activeFlowId` 解析贡献 adapter。
3. 点击组合按钮后打开当前 flow 对应的教程/门户页面。
4. 点击组合按钮后开启当前 flow 的账号贡献模式。
5. 自动流程在账号产物 ready 后调用当前 flow 的 contribution adapter。
6. `codex`、`sub2api`、`openai-oauth`、`kiro-builder-id` 全部走统一 artifact envelope。
7. 贡献门户通过统一 API 接收不同 flow 的 artifact。
8. 贡献门户通过 intake registry 校验、去重、记录和展示不同 flow 的贡献。

## 1. 当前代码结论

### 1.1 侧边栏按钮

文件：`sidepanel/sidepanel.html`

当前按钮：

```html
<button type="button" id="btn-contribution-mode" class="header-link-button" title="进入贡献模式并打开官网页">贡献/使用教程</button>
```

现状问题：

1. 按钮文案包含“贡献”和“教程”。
2. 点击行为被 `sidepanel/contribution-mode.js` 绑定到 OpenAI 贡献模式。
3. 非 OpenAI flow 会被禁用并显示“当前 flow 不支持贡献模式”。
4. 内容更新提示绑定到 contribution 命名，但实际包含教程、公告。

开发处理：

1. 沿用顶部入口。
2. 顶部入口继续是“贡献/使用教程”组合动作。
3. 点击后打开当前 flow 对应教程/门户页面。
4. 点击后开启当前 flow 的账号贡献模式。
5. 贡献模式由 `activeFlowId` 选择 adapter，不再写死 OpenAI。

### 1.2 OpenAI 贡献逻辑

文件：

1. `sidepanel/contribution-mode.js`
2. `background/contribution-oauth.js`
3. `background/message-router.js`

当前事实：

1. `contributionMode` 是全局布尔字段。
2. `isContributionModeAvailable()` 只允许 OpenAI。
3. `contribution-oauth.js` 是 OpenAI OAuth donation 实现。
4. message router 中的贡献消息是 OpenAI 语义。

开发处理：

1. `contributionMode` 只允许在一次性 storage migration 中读取，迁移完成后扩展运行时代码不再引用该字段。
2. 新增 canonical 字段 `accountContributionEnabled`。
3. 新增 canonical 字段 `contributionAdapterId`。
4. OpenAI OAuth 实现迁入 `openai-oauth` adapter。
5. OpenAI `codex/sub2api` 文件贡献迁入对应 adapter 和 intake。
6. 删除扩展端历史 contribution message 入口，所有调用点一次性改为新 flow contribution message。

### 1.3 Kiro 账号产物

文件：

1. `flows/kiro/background/state.js`
2. `flows/kiro/background/desktop-authorize-runner.js`
3. `flows/kiro/background/publisher-kiro-rs.js`
4. `data/step-definitions.js`

当前事实：

1. Kiro 已有步骤 7：启动桌面授权。
2. Kiro 已有步骤 8：完成桌面授权。
3. Kiro 已有步骤 9：上传凭据到 `kiro.rs`。
4. `kiroRuntime.desktopAuth` 保存 `refreshToken`、`clientId`、`clientSecret`、`region`。
5. `kiroRuntime.register` 保存 `email`。
6. `publisher-kiro-rs.js` 已能构建 Builder ID 凭据 payload。

开发处理：

1. Kiro contribution adapter 复用 Kiro runtime 中的 Builder ID 授权产物。
2. Kiro 公共贡献不依赖用户自己的 `kiro.rs` 地址和 API key。
3. Kiro 步骤 8 完成后提交公共贡献。
4. Kiro 步骤 9 继续负责用户私有 `kiro.rs` 发布。

### 1.4 贡献门户

目录：`账号贡献/contrib-portal`

当前事实：

1. `validation.py` 只识别 `codex` 和 `sub2api`。
2. `/api/upload` 只处理当前上传格式。
3. `ValidatedUpload`、`AccountRecord`、`uploads`、`account_keys` 已具备扩展新 kind 的基础。
4. `/api/content-summary` 是全局内容摘要，不区分 flow。

开发处理：

1. 将现有 `codex/sub2api` 校验迁入 intake registry。
2. 新增 `openai-oauth` intake。
3. 新增 `kiro-builder-id` intake。
4. 新增统一贡献 API：`POST /api/contributions`。
5. 服务器端 `/api/upload` 保留为历史 HTTP 入口，用于兼容旧版本扩展、旧上传页面和外部旧请求。
6. `/api/upload` 内部调用统一 intake registry。
7. `/api/upload` route 必须写代码注释，声明该入口仅为历史兼容入口，不允许新增业务逻辑。
8. 数据库记录增加 flow、target、artifact、adapter 字段。
9. 管理后台按 flow、kind、adapter 展示贡献记录。

## 2. 单一目标架构

### 2.1 ContributionTutorialEntry

`ContributionTutorialEntry` 是顶部“贡献/使用教程”组合入口。它不是单纯教程链接，也不是 OpenAI 专属贡献按钮；它在一次点击中完成两件事：

1. 打开当前 flow 对应的教程/门户页面。
2. 开启当前 flow 的账号贡献模式。

统一结构：

```js
{
  id: "kiro-contribution-tutorial",
  flowId: "kiro",
  label: "贡献/使用教程",
  portalUrl: "https://flowpilot.qlhazycoder.top/tutorial?flow=kiro&target=kiro-rs",
  contributionAdapterId: "kiro-builder-id",
  action: "open-portal-and-enable-contribution"
}
```

执行规则：

1. 先按 `activeFlowId` 获取当前 flow 的 entry。
2. 打开 `portalUrl`。
3. 设置 `accountContributionEnabled = true`。
4. 设置当前 flow 的 `contributionAdapterId`。
5. 刷新侧边栏贡献状态。

### 2.2 AccountContributionMode

`AccountContributionMode` 表示本次运行要提交账号贡献。

canonical 状态：

```js
{
  accountContributionEnabled: true,
  contributionAdapterId: "kiro-builder-id",
  contributionProfile: {
    contributorName: "",
    contributorKey: "",
    visibility: "public"
  }
}
```

一次性 storage migration：

```js
if (oldState.contributionMode === true) {
  nextState.accountContributionEnabled = true;
  nextState.contributionAdapterId = "openai-oauth";
}
delete nextState.contributionMode;
```

规则：

1. storage migration 是扩展端唯一允许读取 `contributionMode` 的位置。
2. 迁移后扩展运行时代码只读取 `accountContributionEnabled`。
3. 迁移后扩展运行时代码只读取 `contributionAdapterId`。
4. OpenAI 历史 `contributionMode: true` 迁移为 `contributionAdapterId = openai-oauth`。
5. Kiro 贡献模式使用 `contributionAdapterId = kiro-builder-id`。
6. 新增 flow 贡献模式使用该 flow 的默认 adapter。
7. 切换 flow 时根据当前 flow 重新解析 `contributionAdapterId`。

### 2.3 ContributionAdapter

`ContributionAdapter` 是 flow 账号贡献实现。

统一接口：

```js
{
  id: "kiro-builder-id",
  flowId: "kiro",
  artifactKind: "kiro-builder-id",
  isReady(state) {},
  buildArtifact(state, context) {},
  validateArtifact(artifact) {},
  submitArtifact(artifact, context) {},
  redactForLog(value) {}
}
```

职责：

1. 判断当前 flow 是否已产出可贡献账号。
2. 构建当前 flow 的账号贡献 artifact。
3. 本地校验 artifact。
4. 调用门户贡献 API。
5. 保存贡献提交结果。
6. 对日志、错误、UI 状态做敏感信息脱敏。

### 2.4 ContributionArtifact

所有 flow 使用统一 envelope：

```json
{
  "schemaVersion": 1,
  "flowId": "kiro",
  "targetId": "kiro-rs",
  "artifactKind": "kiro-builder-id",
  "adapterId": "kiro-builder-id",
  "source": "codex-oauth-automation-extension",
  "createdAt": "2026-05-19T00:00:00.000Z",
  "contributor": {
    "key": "name:example",
    "name": "example",
    "visibility": "public"
  },
  "identity": {
    "email": "user@example.com",
    "canonicalId": "kiro-builder-id:<machineId>"
  },
  "credentials": {},
  "metadata": {}
}
```

### 2.5 IntakeSpec

门户端每种 artifact 对应一个 `IntakeSpec`。

统一结构：

```python
@dataclass(frozen=True)
class IntakeSpec:
    kind: str
    flow_id: str
    filename_patterns: tuple[Pattern[str], ...]
    max_bytes: int
    validate: Callable[[str, bytes], ValidatedUpload]
```

首批 intake：

1. `codex`：OpenAI Codex artifact。
2. `sub2api`：OpenAI Sub2API artifact。
3. `openai-oauth`：OpenAI OAuth artifact。
4. `kiro-builder-id`：Kiro Builder ID artifact。

统一升级规则：

1. `codex` 不再作为孤立文件格式处理，进入系统后必须转换为 `flowId=openai`、`artifactKind=codex` 的 `ContributionArtifact`。
2. `sub2api` 不再作为孤立文件格式处理，进入系统后必须转换为 `flowId=openai`、`artifactKind=sub2api` 的 `ContributionArtifact`。
3. `openai-oauth` 不再作为独立 OAuth 网关记录处理，进入系统后必须转换为 `flowId=openai`、`artifactKind=openai-oauth` 的 `ContributionArtifact`。
4. `kiro-builder-id` 使用同一 envelope，进入系统后写入 `flowId=kiro`、`artifactKind=kiro-builder-id`。
5. 所有 artifact 都由 intake registry 输出 `ValidatedUpload` 和 `AccountRecord`。
6. 所有 artifact 都写入统一 flow、target、artifact、adapter 字段。
7. 所有 artifact 都使用统一去重、审核、统计、展示链路。

## 3. Flow 贡献实现

### 3.1 OpenAI

OpenAI adapters：

```js
[
  {
    id: "openai-oauth",
    flowId: "openai",
    artifactKind: "openai-oauth",
    trigger: "interactive-oauth"
  },
  {
    id: "openai-codex-file",
    flowId: "openai",
    artifactKind: "codex",
    trigger: "manual-upload"
  },
  {
    id: "openai-sub2api-file",
    flowId: "openai",
    artifactKind: "sub2api",
    trigger: "manual-upload"
  }
]
```

处理规则：

1. `background/contribution-oauth.js` 的可复用逻辑迁入 `background/contribution/adapters/openai-oauth.js`。
2. `openai-oauth` adapter 输出统一 `ContributionArtifact`。
3. `openai-codex-file` adapter 将 Codex JSON 转换为统一 `ContributionArtifact`。
4. `openai-sub2api-file` adapter 将 Sub2API bundle 转换为统一 `ContributionArtifact`。
5. OpenAI 自动贡献和手动上传最终都提交到 `/api/contributions`。
6. 扩展端手动上传也调用 `/api/contributions`。
7. 扩展端删除 `SET_CONTRIBUTION_MODE`、`START_CONTRIBUTION_FLOW` 等历史 message 入口。
8. 扩展端所有调用点改为 `SET_ACCOUNT_CONTRIBUTION_MODE`、`START_FLOW_CONTRIBUTION`、`SUBMIT_FLOW_CONTRIBUTION`、`POLL_FLOW_CONTRIBUTION_STATUS`。
9. 扩展端测试必须断言历史 message 字符串不再出现在运行时代码中。

### 3.2 Kiro

Kiro adapter：

```js
{
  id: "kiro-builder-id",
  flowId: "kiro",
  artifactKind: "kiro-builder-id",
  trigger: "after-desktop-authorize"
}
```

Kiro artifact 必需字段：

```json
{
  "schemaVersion": 1,
  "flowId": "kiro",
  "targetId": "kiro-rs",
  "artifactKind": "kiro-builder-id",
  "adapterId": "kiro-builder-id",
  "identity": {
    "email": "user@example.com",
    "canonicalId": "kiro-builder-id:<machineId>"
  },
  "credentials": {
    "refreshToken": "...",
    "clientId": "...",
    "clientSecret": "...",
    "profileArn": "arn:aws:codewhisperer:us-east-1:638616132270:profile/AAAACCCCXXXX",
    "authMethod": "idc",
    "region": "us-east-1",
    "authRegion": "us-east-1",
    "apiRegion": "us-east-1"
  }
}
```

Kiro 本地校验：

1. `identity.email` 必须是合法邮箱。
2. `credentials.refreshToken` 必须非空。
3. `credentials.clientId` 必须非空。
4. `credentials.clientSecret` 必须非空。
5. `credentials.region`、`authRegion`、`apiRegion` 缺省写入 `us-east-1`。
6. `identity.canonicalId` 使用 `buildMachineId(refreshToken)` 生成。

Kiro 自动提交点：

1. 步骤 8 完成桌面授权后提交公共贡献。
2. 步骤 9 继续上传到用户自己的 `kiro.rs`。
3. 未配置 `kiro.rs` 时公共贡献仍执行。
4. 配置 `kiro.rs` 时公共贡献和私有上传分别记录状态。

### 3.3 新增 Flow

新增 flow 发布前必须提供：

1. `flowId`。
2. 默认 `targetId`。
3. `ContributionAdapter`。
4. `artifactKind`。
5. artifact builder。
6. 本地校验规则。
7. 门户 `IntakeSpec`。
8. 敏感字段脱敏规则。
9. UI 贡献入口测试。
10. 门户 intake 测试。

缺少任一项时，该 flow 不进入发布列表。

## 4. 扩展端开发内容

### 4.1 新增 `shared/contribution-registry.js`

职责：

1. 注册所有 flow 的 contribution adapters。
2. 提供 `getContributionAdapters(flowId)`。
3. 提供 `getDefaultContributionAdapter(flowId)`。
4. 校验已发布 flow 必须存在 adapter。
5. 为 sidepanel、background、tests 提供统一事实来源。

注册内容：

```js
const FLOW_CONTRIBUTION_ADAPTERS = {
  openai: [
    { id: "openai-oauth", artifactKind: "openai-oauth", trigger: "interactive-oauth" },
    { id: "openai-codex-file", artifactKind: "codex", trigger: "manual-upload" },
    { id: "openai-sub2api-file", artifactKind: "sub2api", trigger: "manual-upload" }
  ],
  kiro: [
    { id: "kiro-builder-id", artifactKind: "kiro-builder-id", trigger: "after-desktop-authorize" }
  ]
};
```

### 4.2 修改 `core/flow-kernel/flow-registry.js`

新增 capability：

```js
supportsAccountContribution: true
```

规则：

1. OpenAI 设置 `supportsAccountContribution: true`。
2. Kiro 设置 `supportsAccountContribution: true`。
3. `supportsContributionMode` 仅作为迁移字段映射到 `supportsAccountContribution`。
4. 新增 flow 只有在注册 adapter 后才能设置 `supportsAccountContribution: true`。

### 4.3 修改 `core/flow-kernel/flow-capabilities.js`

处理规则：

1. 删除贡献能力对 `activeFlowId === "openai"` 的通用依赖。
2. `canShowContributionMode()` 改为读取 `supportsAccountContribution`。
3. OpenAI OAuth 专属 UI 读取 `supportsOpenAiOAuthContribution`。
4. Kiro 贡献 UI 读取 `kiro-builder-id` adapter 是否存在。
5. `validateAutoRunStart()` 校验当前 flow 是否存在 adapter。

### 4.4 新增 background contribution manager

新增文件：

```text
background/contribution/manager.js
background/contribution/client.js
background/contribution/adapters/openai-oauth.js
background/contribution/adapters/kiro-builder-id.js
```

manager 职责：

1. 根据 `activeFlowId` 选择 adapter。
2. 读取 `accountContributionEnabled`。
3. 在账号产物 ready 后调用 adapter。
4. 保存 `flowContributionRuntime`。
5. 广播状态给 sidepanel。

runtime：

```js
flowContributionRuntime: {
  active: false,
  flowId: "",
  adapterId: "",
  artifactKind: "",
  status: "",
  uploadId: null,
  lastMessage: "",
  lastError: "",
  submittedAt: 0
}
```

### 4.5 新增 Kiro artifact helper

新增文件：

```text
flows/kiro/background/credential-artifact.js
```

职责：

1. 从 `kiroRuntime.desktopAuth` 读取授权凭据。
2. 从 `kiroRuntime.register` 读取邮箱。
3. 调用 `buildMachineId(refreshToken)` 生成 canonical id。
4. 构建 `kiro-builder-id` artifact。
5. 对 artifact 做本地校验。
6. 提供日志脱敏方法。

### 4.6 修改 Kiro 自动流程

修改位置：

1. `flows/kiro/background/desktop-authorize-runner.js`
2. `flows/kiro/background/publisher-kiro-rs.js`
3. Kiro runner 调度处

处理规则：

1. 步骤 8 完成后调用 `maybeSubmitFlowContribution()`。
2. 贡献失败不写入完整 secret。
3. 贡献失败按照配置决定是否中断本轮。
4. 步骤 9 私有上传状态与公共贡献状态分开。

默认失败策略：

1. 公共贡献接口不可达：记录 warn，不阻断 Kiro 注册成功。
2. artifact 本地校验失败：记录 error，阻断贡献提交，不阻断私有上传。
3. 用户显式要求“贡献失败即停止”时，中断自动流程。

### 4.7 修改 sidepanel

新增文件：

```text
sidepanel/flow-contribution.js
sidepanel/contribution-tutorial-entry.js
```

UI 规则：

1. 顶部按钮保持 `贡献/使用教程`。
2. 点击按钮后打开当前 flow 对应教程/门户。
3. 点击按钮后开启当前 flow 的账号贡献模式。
4. OpenAI 点击后使用 `openai-oauth` adapter。
5. Kiro 点击后使用 `kiro-builder-id` adapter。
6. 不再对 Kiro 显示“当前 flow 不支持贡献模式”。

## 5. 门户端开发内容

### 5.1 新增 `POST /api/contributions`

请求：

```json
{
  "flow_id": "kiro",
  "target_id": "kiro-rs",
  "kind": "kiro-builder-id",
  "adapter_id": "kiro-builder-id",
  "contributor_name": "example",
  "contributor_key": "name:example",
  "artifact": {}
}
```

响应：

```json
{
  "ok": true,
  "upload_id": 123,
  "new_accounts": 1,
  "updated_accounts": 0,
  "message": "贡献已提交"
}
```

### 5.2 修改数据库

`uploads` 表新增字段：

```sql
flow_id TEXT NOT NULL DEFAULT 'openai'
target_id TEXT NOT NULL DEFAULT ''
artifact_kind TEXT NOT NULL DEFAULT ''
contribution_method TEXT NOT NULL DEFAULT 'manual_upload'
adapter_id TEXT NOT NULL DEFAULT ''
```

`upload_account_reviews` 增加字段：

```sql
flow_id TEXT NOT NULL DEFAULT 'openai'
artifact_kind TEXT NOT NULL DEFAULT ''
```

迁移规则：

1. 历史 `kind = codex` 记录补齐 `flow_id = openai`、`artifact_kind = codex`、`adapter_id = openai-codex-file`。
2. 历史 `kind = sub2api` 记录补齐 `flow_id = openai`、`artifact_kind = sub2api`、`adapter_id = openai-sub2api-file`。
3. 历史 OAuth 记录补齐 `flow_id = openai`、`artifact_kind = openai-oauth`、`adapter_id = openai-oauth`。
4. 新 Kiro 记录写入 `flow_id = kiro`、`artifact_kind = kiro-builder-id`、`adapter_id = kiro-builder-id`。
5. 新增记录不得缺失 flow、artifact、adapter 字段。

### 5.3 修改 `validation.py`

新增 intake registry：

```python
INTAKE_SPECS = {
    "codex": CodexIntakeSpec(),
    "sub2api": Sub2ApiIntakeSpec(),
    "openai-oauth": OpenAiOAuthIntakeSpec(),
    "kiro-builder-id": KiroBuilderIdIntakeSpec(),
}
```

`kiro-builder-id` 校验：

1. payload 必须是 JSON object。
2. `flowId` 必须等于 `kiro`。
3. `artifactKind` 必须等于 `kiro-builder-id`。
4. `identity.email` 必须是合法邮箱。
5. `identity.canonicalId` 必须非空。
6. `credentials.refreshToken` 必须非空。
7. `credentials.clientId` 必须非空。
8. `credentials.clientSecret` 必须非空。
9. secret 字段长度必须有上限。
10. 输出 `ValidatedUpload(kind="kiro-builder-id")`。

OpenAI intake 统一校验：

1. `codex` 校验逻辑迁入 `CodexIntakeSpec`。
2. `sub2api` 校验逻辑迁入 `Sub2ApiIntakeSpec`。
3. `openai-oauth` 校验逻辑迁入 `OpenAiOAuthIntakeSpec`。
4. 三类 OpenAI intake 都必须输出统一 `ValidatedUpload`。
5. 三类 OpenAI intake 都必须写入 `flow_id = openai`。
6. 三类 OpenAI intake 都必须写入对应 `artifact_kind` 和 `adapter_id`。
7. `/api/upload` 与 `/api/contributions` 使用同一套 OpenAI intake 代码。
8. `/api/upload` 文件顶部或 route 附近必须有注释说明：

```python
# 历史 HTTP 入口：保留给旧上传页面和外部旧请求。
# 新开发不得在本 route 内新增贡献业务逻辑。
# 所有格式校验、去重、入库必须委托 unified contribution intake registry。
```

### 5.4 管理后台

管理后台必须展示：

1. flow。
2. target。
3. artifact kind。
4. adapter。
5. contributor。
6. total accounts。
7. new accounts。
8. duplicate accounts。
9. review status。

敏感信息展示规则：

1. `refreshToken` 不展示完整值。
2. `clientSecret` 不展示完整值。
3. proxy password 不展示完整值。
4. 导出数据按管理员权限控制。
5. 错误日志不包含完整 secret。

## 6. 自动流程接入点

### 6.1 通用接入函数

新增：

```js
await maybeSubmitFlowContribution({
  flowId,
  targetId,
  state,
  nodeId,
  reason: "artifact-ready"
});
```

执行条件：

1. `accountContributionEnabled === true`。
2. 当前 flow 存在 adapter。
3. adapter `isReady(state)` 返回 true。
4. 本次运行未提交同一个 canonical id。
5. 本地校验通过。

### 6.2 OpenAI 接入点

OpenAI 接入：

1. OAuth callback 完成。
2. Codex session artifact ready。
3. Sub2API artifact ready。

### 6.3 Kiro 接入点

Kiro 接入：

1. 步骤 8 完成桌面授权后提交公共贡献。
2. 步骤 9 上传到 `kiro.rs` 后更新私有发布状态。
3. 公共贡献状态与私有发布状态分开显示。

## 7. 开发阶段清单

### 阶段 1：贡献 registry 与能力矩阵

开发内容：

1. 新增 `shared/contribution-registry.js`。
2. 注册 OpenAI adapters。
3. 注册 Kiro `kiro-builder-id` adapter。
4. 修改 `flow-registry.js`，加入 `supportsAccountContribution`。
5. 修改 `flow-capabilities.js`，去掉贡献能力的 OpenAI-only 判断。

自检：

1. `canShowContributionMode()` 对 Kiro 返回 true。
2. OpenAI OAuth 专属能力仍只对 OpenAI 返回 true。
3. 未注册 adapter 的 flow 在测试中失败。
4. 正式 flow 不出现“当前 flow 不支持贡献模式”。
5. 新增中文文案无乱码。

测试：

1. contribution registry 测试。
2. flow capability 测试。
3. Kiro contribution capability 测试。
4. 未注册 adapter 阻断发布测试。

### 阶段 2：通用贡献状态与消息协议

开发内容：

1. 新增 `accountContributionEnabled`。
2. 新增 `contributionAdapterId`。
3. 新增 `flowContributionRuntime`。
4. 新增并唯一使用 background messages：

```text
SET_ACCOUNT_CONTRIBUTION_MODE
START_FLOW_CONTRIBUTION
SUBMIT_FLOW_CONTRIBUTION
POLL_FLOW_CONTRIBUTION_STATUS
```

5. 删除扩展端历史 OpenAI contribution messages。
6. 更新所有 sidepanel、background、tests 调用点，不保留扩展端旧 message shim。
7. 新增 storage migration，把历史 `contributionMode` 字段迁移到 `accountContributionEnabled` 后删除。

自检：

1. 扩展运行时代码中不存在 `SET_CONTRIBUTION_MODE`。
2. 扩展运行时代码中不存在 `START_CONTRIBUTION_FLOW`。
3. 扩展运行时代码中不存在 `POLL_CONTRIBUTION_STATUS`。
4. `contributionMode` 只出现在 storage migration 和迁移测试中。
5. Kiro 能开启贡献模式。
6. flow 切换后 adapter 不串 flow。
7. 定时任务 payload 使用统一 contribution payload。
8. storage 读写无乱码。

测试：

1. 历史 message 字符串删除测试。
2. storage migration 测试。
3. Kiro contribution mode message 测试。
4. flow switch 状态隔离测试。
5. 定时任务 contribution payload 测试。

### 阶段 3：Kiro adapter 与 artifact builder

开发内容：

1. 新增 `flows/kiro/background/credential-artifact.js`。
2. 新增 `background/contribution/adapters/kiro-builder-id.js`。
3. 复用 Kiro runtime 产物构建 artifact。
4. 增加本地校验。
5. 增加日志脱敏。
6. 步骤 8 后调用 `maybeSubmitFlowContribution()`。

自检：

1. 缺 `refreshToken` 时不提交。
2. 缺 `clientId` 时不提交。
3. 缺 `clientSecret` 时不提交。
4. 缺 email 时不提交。
5. 日志不包含完整 token。
6. 未配置 `kiro.rs` 时仍提交公共贡献。

测试：

1. Kiro artifact builder 成功测试。
2. Kiro artifact 缺字段失败测试。
3. Kiro 步骤 8 自动贡献测试。
4. Kiro secret redact 测试。
5. 未配置 `kiro.rs` 仍贡献测试。

### 阶段 4：门户 intake 与贡献 API

开发内容：

1. 新增 `POST /api/contributions`。
2. 新增 intake registry。
3. 将 `codex` 校验迁入 `CodexIntakeSpec`。
4. 将 `sub2api` 校验迁入 `Sub2ApiIntakeSpec`。
5. 将 OpenAI OAuth 校验迁入 `OpenAiOAuthIntakeSpec`。
6. 新增 `KiroBuilderIdIntakeSpec`。
7. 服务器端保留 `/api/upload` 历史 HTTP 入口。
8. `/api/upload` route 只委托统一 intake registry，不写贡献业务逻辑。
9. `/api/upload` route 附近写明历史入口注释。
10. 数据库新增 flow/artifact/adapter 字段。
11. 管理后台显示 flow 贡献记录。

自检：

1. `codex` 上传进入 `CodexIntakeSpec`。
2. `sub2api` 上传进入 `Sub2ApiIntakeSpec`。
3. OpenAI OAuth 进入 `OpenAiOAuthIntakeSpec`。
4. `kiro-builder-id` 进入 `KiroBuilderIdIntakeSpec`。
5. 四类 artifact 都写入 flow/artifact/adapter 字段。
6. 四类 artifact 都使用统一去重记录。
7. 管理后台不泄露 secret。
8. `/api/upload` route 有历史入口注释。
9. `/api/upload` 内没有新增贡献业务逻辑。
10. 数据库迁移默认值正确。

测试：

1. OpenAI Codex intake 测试。
2. OpenAI Sub2API intake 测试。
3. OpenAI OAuth intake 测试。
4. Kiro contribution API 成功测试。
5. Kiro 缺字段拒绝测试。
6. Kiro 重复账号测试。
7. `/api/upload` 与 `/api/contributions` 共用 intake 测试。
8. `/api/upload` 历史入口注释检查。
9. 管理后台 flow 筛选测试。

### 阶段 5：侧边栏贡献/使用教程组合入口

开发内容：

1. 新增 `sidepanel/flow-contribution.js`。
2. 新增 `sidepanel/contribution-tutorial-entry.js`。
3. 顶部按钮保持 `贡献/使用教程`。
4. 点击按钮打开当前 flow 对应教程/门户。
5. 点击按钮开启当前 flow 的账号贡献模式。
6. OpenAI 点击后进入 `openai-oauth` 贡献模式。
7. Kiro 点击后进入 `kiro-builder-id` 贡献模式。

自检：

1. Kiro 下 `贡献/使用教程` 按钮可点击。
2. Kiro 下点击按钮会打开 Kiro 教程/门户。
3. Kiro 下点击按钮会开启 Kiro 贡献模式。
4. Kiro 下不显示“不支持贡献模式”。
5. OpenAI 组合入口会进入统一 `openai-oauth` adapter。
6. 中文文案无乱码。

测试：

1. Kiro 组合按钮渲染测试。
2. Kiro 组合按钮打开教程/门户测试。
3. Kiro 组合按钮开启贡献模式测试。
4. OpenAI 组合按钮统一 adapter 测试。

### 阶段 6：贡献/教程内容 summary 按 flow 隔离

开发内容：

1. 将 contribution content service 迁移为 flow contribution content service。
2. `/api/content-summary` 支持 `flow`、`target`。
3. 缓存 key 加入 flow/target。
4. Kiro 只接收 Kiro 相关教程和公告提示。
5. OpenAI 只接收 OpenAI 相关贡献和教程提示。

自检：

1. Kiro 不收到 OpenAI-only 内容提示。
2. OpenAI 不丢失原有公告提示。
3. summary 网络失败不阻塞自动运行。
4. 无 `flow/target` 的历史 summary 请求会转换为 `flow=openai` 默认 scope。
5. 中文提示无乱码。

测试：

1. Kiro summary query 测试。
2. OpenAI summary query 测试。
3. 缓存隔离测试。
4. API 失败降级测试。

### 阶段 7：命名清理与版本记录

开发内容：

1. 通用贡献文件统一使用 `account-contribution` 或 `flow-contribution` 命名。
2. OpenAI OAuth adapter 统一使用 `openai-oauth` 命名。
3. contribution tutorial entry 文件同时负责打开教程/门户和开启贡献模式。
4. 更新测试名称。
5. 更新版本记录。

自检：

1. `contribution` 命名只指真实账号贡献。
2. `contribution-tutorial-entry` 命名只指顶部组合入口。
3. 历史 DOM id 映射逻辑有测试覆盖。
4. 文档与代码命名一致。
5. 无乱码。

## 8. 正确性分析

### 8.1 是否符合要求

符合。方案将“任意 flow 贡献账号”作为强制能力：

1. OpenAI 通过 `openai-oauth/codex/sub2api` 接入。
2. Kiro 通过 `kiro-builder-id` 接入。
3. 新增 flow 必须通过 adapter 和 intake 接入。
4. `贡献/使用教程` 是组合入口，点击后同时打开当前 flow 教程/门户并开启当前 flow 贡献模式。

### 8.2 是否完善

完善。方案覆盖：

1. UI 入口。
2. capability。
3. settings migration。
4. background manager。
5. Kiro artifact。
6. OpenAI 历史格式统一升级。
7. portal API。
8. portal validation。
9. database migration。
10. admin display。
11. tests。
12. self-check。

### 8.3 是否完整

完整。账号贡献链路从用户点击到门户入库闭环：

1. 用户开启贡献。
2. 当前 flow 产出账号 artifact。
3. adapter 本地校验。
4. extension 提交到 portal。
5. portal intake 校验。
6. portal 去重入库。
7. admin 展示审核。
8. UI 展示贡献结果。

### 8.4 是否正确

正确。方案基于当前代码事实：

1. OpenAI 已有 OAuth 与文件上传贡献能力。
2. Kiro 已有 Builder ID 凭据产物。
3. 门户已有 `ValidatedUpload` 和 `AccountRecord` 扩展基础。
4. 现有 OpenAI-only capability 是必须修改的冲突点。

### 8.5 是否规范一致

一致。方案遵守多 flow 边界：

1. OpenAI 专属逻辑留在 OpenAI adapter。
2. Kiro 专属逻辑留在 Kiro adapter。
3. 通用逻辑放在 contribution registry 和 manager。
4. 新增 flow 通过声明式 adapter 接入。
5. 不在 sidepanel 堆 flow 特判。

### 8.6 方案自身缺陷

已识别缺陷和处理方式：

1. 跨 extension 与 portal，按阶段开发并逐阶段自检。
2. `contributionMode` 只存在于 storage migration 和迁移测试，扩展运行时代码不保留历史接口。
3. Kiro artifact 含 secret，所有日志和 UI 必须走脱敏。
4. 数据库迁移影响历史记录，迁移规则固定补齐 OpenAI flow/artifact/adapter 字段。
5. 公共贡献与私有 `kiro.rs` 上传是两条链路，状态分开记录。

### 8.7 上下设计冲突

必须解决的冲突：

1. `supportsContributionMode` 当前只允许 OpenAI，与任意 flow 贡献冲突。
2. Kiro 贡献 UI 当前被禁用，与 Kiro 必须贡献冲突。
3. 门户 `infer_kind()` 当前不识别 Kiro，与 Kiro intake 冲突。
4. 顶部按钮当前直接进入 OpenAI contribution，与 flow-aware 组合入口冲突。
5. 现有测试断言单一 OpenAI contribution button，测试必须更新。

不允许引入的新冲突：

1. 不允许 Kiro 复用 OpenAI OAuth。
2. 不允许 OpenAI phone/Plus/LuckMail 自动扩散到 Kiro。
3. 不允许把 `贡献/使用教程` 拆成只打开教程而不开启贡献模式的入口。
4. 不允许公共贡献依赖用户私有 `kiro.rs` 配置。
5. 不允许日志输出完整凭据。

## 9. 验收标准

### 9.1 Kiro

1. Kiro flow 下显示 `贡献/使用教程` 组合按钮。
2. Kiro 贡献模式能开启。
3. Kiro 步骤 8 后生成 `kiro-builder-id` artifact。
4. 未配置 `kiro.rs` 时仍提交公共贡献。
5. 配置 `kiro.rs` 时公共贡献和私有上传都执行。
6. 门户接收 Kiro artifact。
7. 门户按 `kiro-builder-id` 去重。
8. 管理后台显示 Kiro 贡献记录。
9. 日志和 UI 不泄露完整 `refreshToken/clientSecret`。
10. 点击 Kiro `贡献/使用教程` 同时打开 Kiro 教程/门户并开启 Kiro 贡献模式。

### 9.2 OpenAI

1. OpenAI OAuth 贡献进入 `openai-oauth` adapter 和 `OpenAiOAuthIntakeSpec`。
2. `codex/sub2api` 上传进入对应 OpenAI intake spec。
3. 扩展运行时代码不接收历史 `contributionMode` payload。
4. 新通用贡献状态能映射到 OpenAI adapter。
5. 点击 OpenAI `贡献/使用教程` 同时打开 OpenAI 教程/门户并开启 OpenAI 贡献模式。

### 9.3 新增 Flow

1. 未注册 adapter 的 flow 不能发布。
2. 注册 adapter 后显示贡献入口。
3. artifact builder 和 intake spec 都有测试。
4. 门户能按 flow、kind、adapter 筛选贡献记录。
5. 不同 flow 的贡献状态互相隔离。

## 10. 禁止事项

1. 禁止只做教程入口不做贡献入口。
2. 禁止发布没有 contribution adapter 的 flow。
3. 禁止把 OpenAI OAuth adapter 复用给 Kiro 或其他 flow。
4. 禁止在 sidepanel 到处新增 flow 特判。
5. 禁止在日志、toast、错误信息中输出完整 token。
6. 禁止公共贡献依赖用户私有 target 配置。
7. 禁止门户新增 kind 但不加去重规则。
8. 禁止只改 extension 不改 portal intake。
9. 禁止扩展端保留历史 message shim 或历史接口入口。
10. 禁止扩展端运行时代码继续读取 `contributionMode`。
11. 禁止把服务端历史 HTTP 入口当成新开发入口。
12. 禁止服务器端历史 HTTP 入口承载新业务逻辑。
13. 禁止服务器端保留历史 HTTP 入口但不写注释说明。
