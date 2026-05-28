# Kiro Flow 官方入口升级开发方案

## 1. 目标

本方案把 Kiro flow 作为独立系统升级，不再把它塞进 OpenAI flow 的注册假设里，也不再保留旧入口的兼容分支。

最终链路固定为：

1. 打开 Kiro 官方登录页 `https://app.kiro.dev/signin`
2. 在 Kiro 登录页选择 Builder ID
3. 完成 AWS Builder ID 注册页的邮箱、姓名、验证码、密码与授权确认
4. 等待回到 Kiro Web 登录完成页，建立 Kiro Web 登录态
5. 基于已有 Kiro Web / Builder ID 浏览器会话打开桌面端授权页
6. 监听 localhost callback，用授权码与 PKCE 换取桌面端 Builder ID 凭据
7. 将 `refreshToken / profileArn / clientId / clientSecret / machineId / email` 等字段上传到 `kiro.rs`

这条链路的核心判断是：能被 `kiro.rs` 稳定使用的不是注册页里某个临时结果，而是 Kiro 桌面端授权链路产生的 Builder ID 凭据。

## 2. 需求符合性分析

### 2.1 与用户要求的对应关系

- **两套 flow 分开**：Kiro flow 独立使用 `background/kiro/*`、`content/kiro/*`、`kiroRuntime` 和自己的 9 个节点，不复用 OpenAI 的页面、接码、Plus、平台绑定逻辑。
- **只抽公共能力**：Kiro 只复用邮箱服务、账户密码生成、IP 代理和 `kiro.rs` 目标配置；这些能力本身是跨 flow 基础设施，不带 OpenAI 业务语义。
- **来源与目标清晰**：Kiro 的目标固定为 `kiro-rs`；运行页面来源按 runtime source 识别，注册子链路覆盖 Kiro Web 与 Builder ID 注册页，桌面授权子链路只覆盖 Builder ID authorize 页。
- **上传到 `kiro.rs`**：上传器只按 `kiro.rs` 新增凭据接口构建 payload，并固定上传 BuilderId 的 Kiro runtime `profileArn`；不引入本地账号管理项目里的私有字段。
- **不考虑旧兼容**：设计中不保留旧字段别名、不保留旧入口回退、不保留“失败后换旧链路”的分支。

### 2.2 完整性分析

当前设计覆盖 Kiro 自动注册所需的完整闭环：

- UI 配置：Kiro flow、`kiro.rs URL`、`API Key`、共享邮箱、共享密码、共享代理。
- 注册页面：官方 Kiro 登录页、Builder ID 注册页、授权确认页、Kiro Web 登录完成页。
- 桌面授权：OIDC client 注册、PKCE、authorize URL、localhost callback、token exchange。
- 上传：`kiro.rs` baseUrl 归一化、API Key 鉴权、payload 构建、BuilderId profileArn 固定映射、machineId 计算、上传状态回写。
- 自动运行：Kiro 9 节点 linear workflow，执行范围、状态、日志、失败停止与轮次汇总走通用 runner，但节点实现完全属于 Kiro。
- 测试：覆盖状态模型、source 归属、注册页状态机、桌面授权 gate、上传器 payload、sidepanel flow 选择。

### 2.3 正确性分析

正确性边界如下：

- 步骤 1 不能直接打开 AWS 注册页；必须先进入 Kiro 官方登录页，并由页面选择 Builder ID 入口。
- 步骤 6 不能只以 AWS 授权页按钮点击成功作为完成；必须等待 Kiro Web 登录完成页，写入 `webAuth.status = signed_in`。
- 步骤 7 不能在注册页刚授权后盲目开始；必须检查 `register.status = completed` 且 `webAuth.status = signed_in`。
- 步骤 8 的 token 必须来自桌面端授权码与 PKCE 交换结果。
- 步骤 9 的上传 payload 必须与 `kiro.rs` Admin API 的新增凭据模型一致。

### 2.4 规范一致性分析

- Kiro 运行态统一放在 `kiroRuntime` 下，避免新增节点时继续向全局 state 平铺字段。
- Kiro 页面脚本放在 `content/kiro/*`，后台执行器放在 `background/kiro/*`。
- 注册子链路和桌面授权子链路用不同 runtime source，避免同域 AWS 页面被误注入到错误脚本。
- 文案与日志使用清晰中文；页面按钮文本仍保留真实网页上的中英文按钮名用于匹配。
- 持久配置走 `flows.kiro.targets["kiro-rs"]`，不再出现隐藏的 Kiro 区域、优先级、endpoint 等配置面。

## 3. 最终架构

### 3.1 运行态模型

```js
kiroRuntime: {
  session: {
    status,
    startedAt,
    completedAt,
    email
  },
  register: {
    status,
    loginUrl,
    tabId,
    email,
    currentPageState,
    completedAt
  },
  webAuth: {
    status,
    completedAt,
    hasAccessToken,
    hasSessionToken
  },
  desktopAuth: {
    status,
    state,
    redirectUri,
    clientId,
    clientSecret,
    refreshToken,
    accessToken,
    completedAt
  },
  upload: {
    status,
    targetId,
    baseUrl,
    credentialId,
    completedAt,
    error
  }
}
```

### 3.2 步骤定义

1. `kiro-open-register-page`：清理 Kiro / Builder ID cookies，打开 Kiro 官方登录页，选择 Builder ID，等待邮箱页。
2. `kiro-submit-email`：通过共享邮箱服务获取邮箱，提交到 Builder ID 注册页，等待姓名页。
3. `kiro-submit-name`：填写姓名并继续，等待验证码页。
4. `kiro-submit-verification-code`：按注册邮箱轮询验证码，填入并继续，等待密码页。
5. `kiro-submit-password`：填写共享账户密码或自动生成密码，等待授权确认页。
6. `kiro-complete-register-consent`：点击确认与允许访问，等待 Kiro Web 登录完成页。
7. `kiro-start-desktop-authorize`：在 Kiro Web 登录态已建立后创建桌面授权请求并打开授权页。
8. `kiro-complete-desktop-authorize`：确认桌面授权，捕获 localhost callback，交换 token。
9. `kiro-upload-credential`：上传桌面端 Builder ID 凭据到 `kiro.rs`。

### 3.3 Source 归属

- Kiro 注册 source：`app.kiro.dev`、`kiro.dev`、Builder ID 注册相关页面。
- Kiro 桌面授权 source：Builder ID authorize 页面。
- 邮箱 source：继续由共享邮箱 provider 注册表管理。
- 代理 source：继续由共享 IP 代理模块管理，不进入 Kiro 页面状态机。

### 3.4 `kiro.rs` 上传合同

上传字段固定为：

```js
{
  refreshToken,
  profileArn,
  clientId,
  clientSecret,
  region,
  authRegion,
  apiRegion,
  machineId,
  email,
  proxyUrl,
  proxyUsername,
  proxyPassword,
  authMethod: 'idc'
}
```

其中：

- `machineId = sha256("KotlinNativeAPI/" + refreshToken)`
- `region / authRegion / apiRegion` 使用 Kiro 默认固定值
- `profileArn` 使用 BuilderId 固定值 `arn:aws:codewhisperer:us-east-1:638616132270:profile/AAAACCCCXXXX`
- `proxy*` 仅在当前共享代理存在且可解析时上传

## 4. 设计自检

### 4.1 是否满足“不要和 OpenAI flow 扯上关系”

满足。Kiro 节点、页面脚本、运行态、上传器都在 Kiro 自己的模块内。共享邮箱、密码、代理属于基础服务，不包含 OpenAI 业务分支。

### 4.2 是否存在上下设计冲突

当前无直接冲突。需要注意的边界是：

- 通用 auto-run runner 仍负责调度所有 flow，但它只按节点执行器表调用 Kiro 节点，不理解 Kiro 内部字段。
- `source-registry` 是全局基础设施，但 Kiro 注册 source 与桌面授权 source 已分开，避免同域页面误判。
- `chrome.storage.local` 保存 Kiro 目标配置，`chrome.storage.session` 保存 Kiro 运行态；二者职责不冲突。

### 4.3 方案自身缺陷与规避

- **页面跳转期间 content script 断连**：统一使用页面恢复等待和较长加载预算，错误文案明确提示页面刚刷新或代理异常。
- **Kiro Web 登录完成但 cookie 名称变化**：运行态只保存登录态摘要，不把具体 cookie 当成后续协议输入；真正桌面授权仍以 authorize callback 与 token exchange 为准。
- **代理导致页面卡住**：Kiro flow 必须 fail-close 停止，让用户切换代理，不应自动进入下一步。
- **`kiro.rs` API Key 配置为空或未持久化**：侧栏字段必须走 settings schema 持久配置；上传前从当前配置读取并校验。
- **后续新增 Kiro 节点**：只扩展 Kiro step definitions、Kiro runner 和 Kiro runtime，不在 OpenAI flow 里加隐藏条件。

## 5. 开发清单

### 阶段 1：官方入口与 source 升级

开发内容：

- 步骤 1 打开 `https://app.kiro.dev/signin`
- content script 识别 Kiro 官方登录页并点击 Builder ID
- source registry 支持 Kiro Web 域名
- 删除旧入口启动逻辑

阶段自检：

- 搜索核心代码，不应存在旧入口启动函数与旧注册授权字段。
- 步骤 1 必须能从 Kiro 官方登录页进入 Builder ID 邮箱页。
- source 不得把桌面授权页误归为注册页，反之亦然。
- touched 文件中文不能乱码。

### 阶段 2：Kiro Web 登录态闭环

开发内容：

- 注册页状态机识别 Kiro Web 登录完成页。
- 步骤 6 等待 `kiro_web_signed_in`，不再只看授权按钮点击结果。
- `kiroRuntime.webAuth` 保存登录态摘要。

阶段自检：

- 步骤 6 未回到 Kiro Web 时不能标记成功。
- 成功后必须写入 `webAuth.status = signed_in`。
- 只保存布尔摘要，不保存敏感 cookie 值。
- 日志必须是中文且能说明正在等待 Kiro Web 登录态。

### 阶段 3：桌面授权前置 gate

开发内容：

- 步骤 7 检查 `register.completed + webAuth.signed_in`。
- 未完成 Kiro Web 登录态时直接停止并给出明确中文错误。
- 桌面授权 token 继续写入 `kiroRuntime.desktopAuth`。

阶段自检：

- 手动跳过前 6 步不能直接执行桌面授权。
- gate 不读取 OpenAI 状态。
- 上传器仍只读取桌面授权凭据，不读取注册页临时字段。

### 阶段 4：文档、全量测试与提交

开发内容：

- 更新项目完整链路说明。
- 更新项目文件结构说明。
- 更新本开发方案，确保文档与代码合同一致。
- 跑全量测试、diff 检查、提交。

阶段自检：

- 文档不再把 Kiro 描述为旧入口链路。
- `npm test` 通过。
- `git diff --check` 无空白错误。
- `git status` 只包含本次计划内文件。
- 最终提交信息清晰描述 Kiro 官方入口升级。

## 6. 最终审查清单

- Kiro flow 是否仍能上传到 `kiro.rs`。
- Kiro flow 是否没有复用 OpenAI 接码、Plus、贡献模式、平台绑定逻辑。
- Kiro 设置是否通过 `flows.kiro.targets["kiro-rs"]` 持久化。
- Kiro 自动运行是否不会跳回 OpenAI flow。
- Kiro 页面等待是否统一走足够的加载预算。
- Kiro 失败日志是否清晰中文。
- Kiro touched 文件是否无乱码。
- 测试是否覆盖入口、状态、source、桌面授权、上传器和 sidepanel。
