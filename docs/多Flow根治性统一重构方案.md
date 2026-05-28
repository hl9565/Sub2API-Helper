# 多Flow根治性统一重构方案

## 1. 背景

当前项目已经完成过多轮从单一 OpenAI 注册链路向多 flow 架构的重构，但现在的状态仍然属于“骨架已多 flow 化，核心 contract 仍保留 `openai + kiro` 双分支”。

这会带来三个持续性问题：

- 每新增一个 flow，都需要继续修改 core 语义，而不是只新增 flow 自己的模块。
- 文件命名、状态命名、配置命名仍带有明显历史负担，读代码和改代码都累。
- 每次重构都只能修表层，无法保证第三个 flow 接入时不再次爆炸。

本方案的目标不是“再修一轮兼容”，而是一次性把多 flow 架构收口成稳定合同，后续新增 flow 时不再改 core 语义。

## 2. 总目标

本次重构完成后，项目必须达到以下目标：

- 新增一个 flow 时，只新增该 flow 目录和注册项，不再修改 core 的配置合同、运行态合同和侧栏核心语义。
- 所有 flow 都使用同一套配置结构、同一套运行态结构、同一套 source/driver 注册模型。
- OpenAI 与 Kiro 的代码组织、文件命名、步骤命名、source 命名、driver 命名全部统一到同一规范。
- 删除长期存在的历史别名和双轨字段，避免后续维护继续被旧命名拖住。
- 旧配置不再作为运行时输入；旧数据只允许通过导入转换器映射到新 canonical 结构后进入系统。

## 3. 当前根问题

### 3.1 配置模型仍然是双轨

当前 `settings-schema` 只内建 `flows.openai` 和 `flows.kiro` 两套显式结构，同时继续派生：

- `openaiIntegrationTargetId`
- `kiroTargetId`
- `panelMode`

这不是多 flow 通用合同，而是两个 flow 的并排硬编码。第三个 flow 接入时，只能继续增加第三套特判。

### 3.2 运行态模型是裂开的

当前运行态存在两条体系：

- OpenAI 使用 `runtimeState.flowState.openai`
- Kiro 使用独立 `kiroRuntime`

这意味着“flow 私有运行态放哪里”没有统一答案。后续新增 flow 时，要么复制第三套运行态入口，要么继续在 core 写例外分支。

### 3.3 source / driver 仍未彻底注册化

虽然已经有 `flow-registry` 与 `source-registry`，但 core 里仍直接识别：

- OpenAI host
- Kiro host
- OpenAI / Kiro source family

这说明 source 系统还不是“flow 自带定义，core 只消费注册表”，而是“core 知道两个 flow 的页面事实”。

### 3.4 sidepanel 还是默认 flow 分支思维

当前 sidepanel 很多判断仍然是：

- 默认 flow 视为 OpenAI
- 非默认 flow 基本按 Kiro 处理

例如 target 读取、target 持久化、贡献页 target 解析、flow 切换后的字段同步，都带着明显的 `openai / kiro` 条件分支。

### 3.5 “按 flow 执行范围”表面通用，内部仍是双 flow 特判

`stepExecutionRangeByFlow` 在 UI 侧已经接近通用，但写回持久配置时仍只处理：

- `openai`
- `kiro`

这类设计最危险，因为它会制造“表面支持多 flow，实际只有两个 flow 真能落盘”的假通用。

### 3.6 文件和命名仍带历史语义

当前仍大量存在下列混合命名：

- `signup-page`
- `open-chatgpt`
- `platform-verify`
- `plus-checkout`
- `kiro-*`
- `vps-panel`

这些名字有的看起来像通用名，实际是 OpenAI 专属；有的则直接带品牌。继续保留会让后续架构再度滑回历史分支。

## 4. 重构原则

### 4.1 不做旧配置兼容，只做导入转换

本次不保留“先兼容着跑”的中间态。新系统上线后，运行时、持久化读写、sidepanel 消息、background 内部状态全部只认新合同。

原则是：

- 旧配置、旧账号记录、旧 flow 产物只能通过导入器转换
- 导入器是单向转换器，不是长期桥接层
- 导入完成后的数据必须完全符合新合同
- 除导入器外，任何模块都不再直接读写 `panelMode`、`openaiIntegrationTargetId`、`kiroTargetId`、`kiroRuntime` 等旧字段

### 4.2 通用层只负责“怎么跑一个 flow”

core 只解决这些问题：

- flow 注册
- source 注册
- driver 注册
- workflow 运行
- 状态存储
- sidepanel 动态渲染
- 通用服务接入

core 不再知道任何 OpenAI 或 Kiro 业务步骤语义。

### 4.3 flow 私有能力留在 flow 内部

以下能力继续保留为 flow 私有：

- OpenAI 的 OAuth、Plus、接码、平台绑定
- Kiro 的 Builder ID、桌面授权、`kiro.rs` 上传
- 任意新 flow 的站点特有页面状态机、验证码规则、成功判定和产物结构

### 4.4 命名必须先统一，再谈长期可维护性

如果 contract 抽象了，但目录和文件名还保留历史语义，后续阅读成本依然很高。本次重构必须把命名一并统一。

## 5. 第一层功能边界：公共能力与私有能力

这一层只回答一个问题：哪些能力应该是扩展级公共能力，哪些能力必须收回到各 flow 自己内部。

本层结论确定后，后续所有 contract、目录结构和配置模型都必须服从这条边界，不允许再反向把 flow 私有语义塞回公共层。

### 5.1 扩展级公共能力

当前项目真正应保留为全局公共能力的只有四块：

- 项目壳层
- 邮箱服务
- 账户密码
- IP 代理

其中：

- `项目壳层` 只包括顶部容器、flow 切换、开始/停止/重试、日志与运行态展示这些外层承载能力。
- `邮箱服务` 是跨 flow 的身份与收件基础设施。
- `账户密码` 指侧栏中的“账户密码”文本框，它的语义是“注册目标账号时使用的共享密码”。
- `IP 代理` 是扩展级环境能力，不属于任何单独 flow。

### 5.2 邮箱服务需要继续重构统一

邮箱服务值得保留为公共层，但必须从历史 OpenAI 语义中继续剥离。

它在功能上只应该负责三类事情：

- 生成注册邮箱
- 提供收件与轮询能力
- 维护当前轮次的邮箱身份

邮箱服务不应该继续承接这些内容：

- 某个 flow 的验证码命中规则
- 某个 flow 的页面跳转语义
- 某个 flow 的身份保留分支
- 某个 flow 的注册成功或失败判断

因此邮箱层应拆成两部分：

- `公共邮箱服务`
  负责邮箱生成、收件、轮询、当前邮箱身份维护
- `flow 私有邮件规则`
  负责某个 flow 在某一步认哪封邮件、提取什么内容、何时算命中

结论：

- 邮箱服务是公共能力
- 邮件规则不是公共能力

### 5.3 “账户密码”是共享注册密码，不是公共凭据服务

当前侧栏的“账户密码”文本框，其真实产品语义已经确认：

- 它不是平台后台登录密码
- 它不是某个管理接口凭据
- 它不是统一的凭据中心配置
- 它只是“注册出来的目标账号要设置成什么密码”

因此这里不应再抽象出“公共凭据服务”。

正确做法是：

- 保留一个全局公共的 `共享注册密码`
- 各 flow 自己决定是否使用这份密码
- 各 flow 自己决定在哪一步使用
- 如果某个 flow 没有设置密码步骤，则直接忽略

这意味着：

- `账户密码` 是公共输入能力
- `凭据结构` 不是公共能力
- `凭据产物字段` 不是公共能力

### 5.4 凭据与账号产物必须保持 flow 私有

虽然不做公共凭据服务，但每个 flow 仍然会生成自己的账号产物。

例如：

- OpenAI 可能产出邮箱、密码、session、OAuth 结果、平台接入结果
- Kiro 可能产出邮箱、密码、refresh token、clientId、clientSecret、上传结果

这里允许公共的只有“外层展示容器”或“记录壳层”，不允许公共化的内容包括：

- 主身份字段
- token 字段
- 上传字段
- 绑定字段
- 各类平台回调字段

结论：

- 账号产物展示容器可以公共
- 账号产物字段结构必须 flow 私有

### 5.5 IP 代理属于扩展级环境能力

IP 代理应直接定义为：

- 扩展级公共能力
- 与 flow 无关
- 由 flow 声明“可用/必需/禁用”，但不拥有它

flow 最多只能声明：

- 当前 flow 是否允许代理
- 当前 flow 的哪些页面需要代理约束
- 当前 flow 是否需要代理检测或 fail-close 策略

但代理配置、切换、应用、检测、诊断，都不属于 flow 私有模型。

### 5.6 第一层最终边界

本次重构在功能边界上最终固定为：

#### 全局公共能力

- 项目壳层
- 邮箱服务
- 共享注册密码
- IP 代理

#### 仅允许公共容器，不允许公共字段语义

- 账号记录容器
- 产物展示容器

#### flow 私有能力

- 账号主身份模型
- 邮件命中规则
- 验证码规则
- 注册步骤
- 登录步骤
- OAuth / callback
- 支付
- 上传
- flow 最终凭据与产物字段结构

后续所有重构如果与这条边界冲突，以这条边界为准，不允许再为了省事把 flow 私有字段上提为公共模型。

## 6. 第二层产品模型：flow 与 target

这一层只回答两个问题：

- flow 在产品上到底是什么
- target 在产品上到底是什么

如果这一层不先定死，后面配置模型、侧栏模型和运行态模型就会继续在 `panelMode / integrationTarget / targetId` 之间摇摆。

### 6.1 flow 的产品定义

每个 flow 都应被定义为一条独立的“账号生产链路”。

它至少具备以下特征：

- 有独立入口
- 有独立步骤顺序
- 有独立成功判定
- 有独立最终产物
- 只按需消费公共能力，例如邮箱、共享注册密码、IP 代理

因此，flow 不是“几步流程的组合”，而是一个完整产品单元。

结论：

- `openai` 是一个完整 flow
- `kiro` 是一个完整 flow
- 未来新站点也必须是完整 flow
- 不允许再把新站点业务塞进现有 flow 里做条件分支

### 6.2 target 的产品定义

target 不应继续被理解为历史意义上的 `panelMode`。

正确的产品语义应该是：

- target 是这个 flow 最终产物的去向
- target 是这个 flow 最终服务的目标系统

例如：

- OpenAI flow 的 target 可以是 `CPA / SUB2API / Codex2API`
- Kiro flow 的 target 可以是 `kiro-rs`

因此：

- `flow` 回答“怎么产出账号或产物”
- `target` 回答“产出后要交给谁使用”

这两个概念必须严格分层，不允许再混用。

### 6.3 每个 flow 都必须自带 target 模型

以后不再允许：

- 只有 OpenAI flow 有 target
- Kiro flow 走另一套特殊 target 字段
- 默认 flow 使用 `panelMode`，其他 flow 使用 `targetId`

统一要求如下：

- 每个 flow 都必须有 `selectedTarget`
- 每个 flow 都必须有 `targets`
- 单 target flow 只是“只有一个 target”，不是“没有 target 概念”

即使某个 flow 当前只有一个 target，模型里也必须保留 target 层，只是在 UI 上可以隐藏选择器。

这样做的原因是：

- 未来该 flow 如果新增第二个 target，不需要再次改核心模型
- sidepanel 和 settings 不需要区分“哪个 flow 才有 target”

### 6.4 flow 的产品结构

从功能角度，每个 flow 都应至少包含以下部分：

- flow 基本信息
- flow 对公共能力的依赖声明
- flow 私有配置
- flow targets
- flow 产物定义

进一步展开：

- `flow 基本信息`
  - 名称
  - 说明
  - 是否可自动化
- `公共能力依赖声明`
  - 是否使用邮箱
  - 是否使用共享注册密码
  - 是否允许代理
- `flow 私有配置`
  - 仅该 flow 自己理解的设置
- `flow targets`
  - 一个或多个目标系统
- `flow 产物定义`
  - 该 flow 最终生成什么结果

### 6.5 第二层最终结论

本次重构在产品模型上最终固定为：

- `flow = 独立账号生产产品线`
- `target = flow 产物去向`
- 每个 flow 都必须天然支持自己的 target 模型
- 全局只保留“当前选中的 flow”
- 当前 target 永远从当前 flow 自己内部读取

由此带来的直接结果是：

- `panelMode` 只允许存在于导入器输入映射里
- `openaiIntegrationTargetId / kiroTargetId` 不再是长期 canonical 配置
- sidepanel 不再需要围绕“默认 flow 是 OpenAI”建立逻辑

后续所有设计如果与这层产品模型冲突，以这层定义为准。

## 7. 第三层运行模型：统一节点承载，不统一阶段语义

这一层只回答一个问题：

- 多 flow 体系下，到底应该统一什么样的运行流程模型

本层最终结论是：

- 统一节点承载方式
- 不统一跨 flow 的阶段语义

也就是说，core 只负责“如何承载一个 flow 的内部流程”，不负责替每个 flow 规定必须长成同一种产品流程形状。

### 7.1 不强制统一阶段

本次重构不再要求所有 flow 都映射到一套固定阶段，例如：

- 准备
- 进入
- 验证
- 成型
- 接入
- 交付

这种抽象在文档上容易显得整齐，但对真实多 flow 来说约束过强，后续会重新形成“表面通用、实际不好用”的壳层。

因此：

- OpenAI 保持自己的内部流程形状
- Kiro 保持自己的内部流程形状
- 新 flow 也不需要被迫套进统一阶段模型

### 7.2 真正需要统一的是节点运行模型

虽然不统一阶段语义，但所有 flow 仍然必须共享同一套“节点承载方式”。

每个 flow 的内部流程都应被理解为：

- 一组有顺序的节点
- 节点之间存在前后关系
- 每个节点都有清晰输入和结果
- 节点可以被手动执行、自动执行、停止和重试

也就是说，core 只统一：

- 节点是什么
- 节点如何排序
- 节点如何连接
- 节点如何汇报状态

而不统一：

- 节点一定属于哪个阶段
- 某个数字步骤在所有 flow 里都代表什么

### 7.3 数字步骤只表示 flow 内部显示顺序

以后数字步骤只允许表达：

- 当前 flow 内部的展示顺序

不再允许表达：

- 跨 flow 的固定语义
- 全局共享的产品阶段
- 某个历史 OpenAI 10 步链路的编号意义

这意味着：

- `Step 4` 不再天然等于“验证码步骤”
- `Step 7` 不再天然等于“OAuth”
- `Step 9` 不再天然等于“平台验证”

这些语义都必须下沉为 flow 私有流程定义。

### 7.4 节点的最小公共合同

从产品功能角度，每个节点只需要满足以下最小公共合同：

- 有名称
- 有顺序
- 有前后关系
- 有明确成功结果
- 有明确失败结果
- 可以手动执行
- 可以自动执行
- 可以停止
- 可以重试

节点不应该再承载这些“假通用”要求：

- 必须属于固定阶段
- 必须服从跨 flow 的相同命名
- 必须让不同 flow 共享同一种页面语义

### 7.5 外层统一状态，不统一流程内容

扩展外层只需要理解统一运行状态，不需要理解每个 flow 的内部阶段。

建议外层只保留以下状态集合：

- 未开始
- 运行中
- 等待中
- 需人工处理
- 已停止
- 已失败
- 已完成

这些状态只服务于：

- 侧栏展示
- 自动运行控制
- 停止 / 重试入口
- 日志与记录

它们不应反过来要求 flow 把内部步骤硬映射成统一业务阶段。

### 7.6 执行范围绑定当前 flow 的节点顺序

`执行范围` 这个能力未来仍然保留，但其产品定义应明确为：

- 对当前 flow 可见节点顺序的执行限制

它不再代表：

- 全局统一步骤范围
- 跨 flow 的阶段范围
- OpenAI 历史编号的范围

也就是说，执行范围始终只作用于“当前 flow 自己的节点序列”。

### 7.7 第三层最终结论

本层最终固定为：

- 不统一所有 flow 的阶段语义
- 不统一所有 flow 的产品流程形状
- 每个 flow 自己定义内部流程
- core 只统一节点承载方式
- 数字步骤只代表当前 flow 的显示顺序
- 扩展外层只理解统一运行状态
- 执行范围只绑定当前 flow 的节点顺序

后续如果有设计要求把所有 flow 再次硬映射成一套跨 flow 固定阶段，以本层结论为准，默认不采纳。

## 8. 第四层界面分工：公共壳层与 flow 工作面

这一层只回答一个问题：

- sidepanel 到底哪些界面必须永远公共，哪些界面必须彻底交给 flow 自己

如果这层不先定死，后续所有 flow 接入都会继续把 `openai / kiro / new-flow` 的条件分支堆进侧栏主文件。

### 8.1 只保留两层界面

本次重构后，sidepanel 只保留两层界面：

- 公共壳层
- flow 工作面

不再增加第三层“伪通用业务面板”。

原因很简单：

- 公共壳层负责承载扩展级操作
- flow 工作面负责承载 flow 私有配置与流程内容

这样结构最稳，也最不容易重新膨胀。

### 8.2 公共壳层放什么

公共壳层只允许放扩展级公共入口与全局控制入口，包括：

- flow 选择
- target 选择
- 开始 / 停止 / 重试 / 自动
- 当前运行状态
- 日志区
- 账号记录入口
- 文档 / 引导 / 更新提示入口
- 贡献 / 使用教程按钮
- 公共能力入口
- 邮箱服务
- 共享注册密码
- IP 代理

这里的“贡献 / 使用教程”按钮属于公共壳层入口，但其功能逻辑必须按当前 flow 适配。

也就是说：

- 按钮入口位置是公共的
- 点击后的目标页面、说明内容、贡献适配逻辑由当前 flow 决定

不允许再把它写成某一个默认 flow 的固定行为。

### 8.3 flow 工作面放什么

flow 工作面只允许承载该 flow 自己的内容，包括：

- flow 私有配置
- flow 私有步骤列表
- flow 私有运行态展示
- flow 私有人工补位入口
- flow 私有产物展示字段

例如：

- OpenAI 的 Plus、OAuth、平台接入、手机验证，只能放在 OpenAI 工作面
- Kiro 的桌面授权、上传到 `kiro.rs`，只能放在 Kiro 工作面

未来新增 flow 也必须遵守同样规则。

### 8.4 步骤列表属于 flow 私有界面

步骤列表不属于公共界面。

公共壳层最多只负责：

- 放置步骤列表容器
- 提供统一骨架样式
- 提供统一按钮状态和颜色规则

但以下内容都必须由 flow 自己决定：

- 有哪些步骤
- 步骤叫什么
- 步骤显示什么说明
- 哪些步骤可执行
- 哪些步骤可跳过
- 哪些步骤需要人工补位

### 8.5 账号记录采用“公共入口 + 私有内容”

账号记录建议固定为：

- 公共入口
- flow 私有内容

也就是说：

- 记录页或记录弹层入口是公共的
- 分页、筛选、基础容器可以公共
- 每条记录里显示哪些字段，按当前 flow 决定

这样既保留统一入口，也避免为了统一记录展示而把所有 flow 的产物字段重新揉成一个假通用结构。

### 8.6 公共能力入口的边界

公共区可以保留三类公共能力入口：

- 邮箱服务
- 共享注册密码
- IP 代理

但这些公共入口只负责：

- 配置
- 当前状态展示
- 基础校验

它们不负责：

- 解释某个 flow 的业务步骤
- 解释某个 flow 的页面语义
- 承载某个 flow 的专属运行逻辑

这意味着：

- OpenAI 专属邮箱模式说明，应回到 OpenAI 工作面
- Kiro 专属密码说明，应回到 Kiro 工作面
- 某个 flow 的代理特殊策略，也应由该 flow 自己声明和解释

### 8.7 target 选择器仍属于公共壳层

target 虽然属于当前 flow 的内部模型，但从用户交互角度，它属于“开跑前的全局决策”。

因此：

- target 选择器放在公共壳层
- target 的可选项由当前 flow 决定
- target 的说明文案也由当前 flow 决定

这样用户能在统一入口完成“跑哪个 flow、产物交给谁”的全局决策。

### 8.8 第四层最终结论

本层最终固定为：

- sidepanel 只保留“公共壳层 + flow 工作面”两层
- 公共壳层承载扩展级入口和全局控制
- flow 工作面承载 flow 私有配置、步骤、运行态和产物
- 步骤列表属于 flow 私有界面
- 账号记录采用“公共入口 + 私有内容”
- 贡献 / 使用教程按钮属于公共壳层入口，但功能逻辑必须按当前 flow 适配
- 不允许再把任何 OpenAI / Kiro / 新 flow 的专属业务配置继续堆进公共区

## 9. 目标架构

建议收口为以下目录形态：

```txt
core/
  flow-kernel/
    flow-registry.js
    source-registry.js
    driver-registry.js
    settings-schema.js
    runtime-state.js
    workflow-engine.js
    step-registry.js
    tab-runtime.js
    logging-status.js

flows/
  index.js

  openai/
    flow.js
    settings.js
    state.js
    sources.js
    drivers.js
    steps/
    content/
    mail/
      rules.js
    contribution/

  kiro/
    flow.js
    settings.js
    state.js
    sources.js
    drivers.js
    steps/
    content/
    contribution/

imports/
  legacy/
    settings-importer.js
    account-records-importer.js
    flow-artifacts/
      openai.js
      kiro.js
```

第一阶段可以不强制先物理移动到 `core/flow-kernel/`，但逻辑上必须先收成这套边界。

补充要求：

- `imports/legacy/` 是全仓库唯一允许理解旧字段、旧结构、旧命名的目录。
- `core/` 与 `flows/` 不再保留任何旧字段回写逻辑。

## 10. 统一合同

### 10.1 配置合同

唯一 canonical 配置结构：

```js
settingsState = {
  schemaVersion,
  activeFlowId,
  services: {
    account,
    email,
    proxy,
  },
  flows: {
    [flowId]: {
      selectedTargetId,
      targets: {
        [targetId]: {}
      },
      autoRun: {
        stepExecutionRange,
      },
      ui: {},
      features: {},
    }
  }
}
```

要求：

- `selectedTargetId + targets[targetId]` 是唯一 target 入口。
- 不再以 `openaiIntegrationTargetId`、`kiroTargetId` 作为 canonical 字段。
- `panelMode` 不再作为内部真实配置语义，也不再出现在 sidepanel payload、background 持久化写入路径和运行时配置读取路径中。
- 每个 flow 都必须使用 `selectedTargetId + targets[targetId]` 组合。
- target 专属字段只能挂在对应 `targets[targetId]` 下，不再允许提升到 flow 顶层或全局顶层。
- 旧配置文件不能被直接加载运行，只能先经过导入转换器。

### 10.2 运行态合同

唯一 canonical 运行态结构：

```js
runtimeState = {
  activeFlowId,
  activeRunId,
  currentNodeId,
  nodeStatuses,
  sharedState: {},
  serviceState: {
    account: {},
    email: {},
    proxy: {},
  },
  flowState: {
    [flowId]: {
      session: {},
      nodes: {},
      artifacts: {},
      ui: {},
    }
  }
}
```

要求：

- 删除独立 `kiroRuntime` 作为长期入口。
- OpenAI、Kiro、未来新 flow 的私有运行态全部进入 `runtimeState.flowState[flowId]`。
- 顶层不再持久化任何 flow 私有扁平字段。
- 运行态不做旧快照导入；导入只处理持久配置与持久产物，导入完成后从新运行态起跑。
- 如需便捷读取视图，只能从 canonical `flowState` 派生，不能再反向写出独立运行态入口。

### 10.3 flow 定义合同

每个 flow 统一导出：

```js
{
  id,
  label,
  services,
  capabilities,
  settingsGroups,
  targets,
  settingsShape,
  runtimeStateShape,
  sources,
  drivers,
  workflow,
  artifactSchema,
  importers,
  contributionAdapters,
}
```

要求：

- `flow-registry` 只合并 flow 定义。
- `settings-schema`、`source-registry`、`driver-registry`、`step-registry` 都只消费 flow 导出的定义。
- flow 私有导入转换规则也由 flow 自己提供，core 只负责分发到对应 importer。
- core 不再直接声明某个 flow 的 target、source、driver。

### 10.4 source 合同

每个 source 至少声明：

- `id`
- `flowId`
- `kind`
- `label`
- `hostPatterns`
- `familyMatcher`
- `injectFiles`
- `readyPolicy`
- `cleanupScopes`
- `tabReusePolicy`

要求：

- host 判断由 flow source 定义驱动。
- `unknown-source` 仅做诊断，不自动回退到任意业务 source。
- callback cleanup 必须由 `cleanupScope -> ownerSource` 注册表驱动。

### 10.5 driver 合同

每个 driver 至少声明：

- `id`
- `sourceId`
- `commands`
- `injectFiles`

要求：

- driver 负责“页面能做什么”
- source 负责“页面是什么、如何识别、如何复用、如何清理”

### 10.6 step 合同

每个 step 统一使用：

- `id`
- `order`
- `key`
- `title`
- `sourceId`
- `driverId`
- `command`
- `mailRuleId`

要求：

- `step key` 只表达 flow 内语义，不再混入历史平台词和伪通用词。
- `background/steps/*.js` 这种共享目录最终要消失，改由各 flow 自己维护 `steps/`。

## 11. 命名统一方案

### 11.1 flow 目录命名

- `flows/openai/`
- `flows/kiro/`

未来新增 flow 一律使用 `flows/<flow-id>/`

### 11.2 source 命名

统一格式：

```txt
<flow-id>-<page-role>
mail-<provider>
panel-<target>
```

例如：

- `openai-auth`
- `openai-entry`
- `openai-checkout`
- `openai-paypal`
- `openai-gopay`
- `kiro-register`
- `kiro-desktop-authorize`
- `panel-sub2api`
- `panel-cpa`
- `mail-gmail`

### 11.3 driver 命名

统一格式：

```txt
flows/<flow-id>/content/<page-role>.js
flows/<flow-id>/steps/<step-role>.js
```

不再使用历史伪通用名作为全局 driver 语义。

### 11.4 OpenAI 文件重命名建议

以下文件建议统一迁移：

- `flows/openai/content/openai-auth.js` -> `flows/openai/content/openai-auth.js`
- `flows/openai/content/plus-checkout.js` -> `flows/openai/content/checkout-page.js`
- `flows/openai/content/paypal-flow.js` -> `flows/openai/content/paypal-page.js`
- `flows/openai/content/gopay-flow.js` -> `flows/openai/content/gopay-page.js`
- `flows/openai/content/sub2api-panel.js` -> `flows/openai/content/sub2api-panel-page.js`
- `flows/openai/content/vps-panel.js` -> `flows/openai/content/cpa-panel-page.js`

- `flows/openai/background/steps/open-chatgpt.js` -> `flows/openai/steps/open-entry.js`
- `flows/openai/background/steps/submit-signup-email.js` -> `flows/openai/steps/submit-identifier.js`
- `flows/openai/background/steps/fill-password.js` -> `flows/openai/steps/submit-password.js`
- `flows/openai/background/steps/fetch-signup-code.js` -> `flows/openai/steps/submit-signup-code.js`
- `flows/openai/background/steps/fill-profile.js` -> `flows/openai/steps/submit-profile.js`
- `flows/openai/background/steps/wait-registration-success.js` -> `flows/openai/steps/wait-register-complete.js`
- `flows/openai/background/steps/oauth-login.js` -> `flows/openai/steps/start-oauth-login.js`
- `flows/openai/background/steps/fetch-login-code.js` -> `flows/openai/steps/submit-login-code.js`
- `flows/openai/background/steps/confirm-oauth.js` -> `flows/openai/steps/confirm-oauth-consent.js`
- `flows/openai/background/steps/platform-verify.js` -> `flows/openai/steps/complete-platform-bind.js`

### 11.5 Kiro 文件重命名建议

以下文件建议统一迁移：

- `flows/kiro/background/register-runner.js` -> `flows/kiro/steps/register-flow.js`
- `flows/kiro/background/desktop-authorize-runner.js` -> `flows/kiro/steps/desktop-authorize-flow.js`
- `flows/kiro/background/publisher-kiro-rs.js` -> `flows/kiro/steps/upload-credential.js`
- `flows/kiro/background/state.js` -> `flows/kiro/state.js`
- `flows/kiro/content/register-page.js` -> `flows/kiro/content/register-page.js`
- `flows/kiro/content/desktop-authorize-page.js` -> `flows/kiro/content/desktop-authorize-page.js`

## 12. 替换式升级与导入转换策略

### 阶段 1：先定 canonical contract 与最终目录边界

目标：

- 定义统一的 settings、runtime、flow、source、driver、step 合同
- 定义 `core/`、`flows/`、`imports/legacy/` 三层边界
- 明确旧字段只允许出现在导入器中

产出：

- 更新设计文档
- 明确迁移边界

完成标准：

- 不再允许出现“新 flow 以后再看放哪”这种模糊点

### 阶段 2：统一配置模型

目标：

- 让所有 flow 都走 `settingsState.flows[flowId]`
- 停止所有新代码对旧配置字段的直接读写

动作：

- 重写 `core/flow-kernel/settings-schema.js`
- 把 `selectedTargetId` 作为统一 target 入口
- 改写 `background.js` 中 `buildSettingsStatePatchFromFlatUpdates`、`buildAutoRunFreshResetSettingsState`、`buildFreshAutoRunKeepState`
- 改写 `background/message-router.js` 与 `sidepanel/sidepanel.js` 的设置写入路径，只提交 canonical patch
- 将 `panelMode / openaiIntegrationTargetId / kiroTargetId` 从运行时和持久化写入路径移除

完成标准：

- 任意 flow 都可通过相同 API 读取当前 target 和 flow 设置
- 正常保存、导出、恢复流程里不再出现旧 target 字段

### 阶段 3：统一运行态模型

目标：

- 把 `kiroRuntime` 并入 `runtimeState.flowState.kiro`
- 让 OpenAI 与 Kiro 都按同一种 flow 私有运行态承载方式工作

动作：

- 重写 `core/flow-kernel/runtime-state.js`
- 把 `flows/kiro/background/state.js` 合并或迁入 `flows/kiro/state.js`
- 给 OpenAI 与 Kiro 都定义 flow 私有状态 shape 与 reset 规则
- 删除独立 Kiro 运行态主入口
- 停止持久化所有 flow 私有顶层扁平字段

完成标准：

- core 不再区分“OpenAI 私有状态”与“Kiro 私有状态”的存储方式
- 自动运行、fresh reset、日志回写都只消费统一运行态结构

### 阶段 4：建立单向导入转换器

目标：

- 让旧数据只能通过导入器进入新系统
- 明确“导入”与“运行时兼容”是两件不同的事

动作：

- 新建 `imports/legacy/settings-importer.js`
- 新建 `imports/legacy/account-records-importer.js`
- 按需新增 `flows/openai/importers/*` 与 `flows/kiro/importers/*` 用于旧产物字段映射
- 导入器负责识别 `panelMode`、`openaiIntegrationTargetId`、`kiroTargetId`、`stepExecutionRangeByFlow`、`kiroRuntime` 以及旧账号记录结构
- 导入结果统一输出为新 `settingsState`、新账号记录结构、新 flow 产物结构
- 明确不导入旧运行态快照

完成标准：

- 旧配置文件只能通过“导入”按钮进入系统，不能被直接加载运行
- 导入完成后，系统内部不再保留旧字段副本

### 阶段 5：统一 flow 注册与 source/driver 注册

目标：

- 让 flow 目录自带 source、driver、workflow、state、settings 定义

动作：

- 新建 `flows/index.js`
- 把 flow 相关定义从 `core/flow-kernel/flow-registry.js`、`core/flow-kernel/source-registry.js`、`core/flow-kernel/flow-capabilities.js`、`data/step-definitions.js`、`core/flow-kernel/step-registry.js` 拆到各 flow 内
- `source-registry` 改为只做合并与查询
- `workflow-engine` 与 step registry 改为只消费 flow 导出定义

完成标准：

- 新增 flow 时只新增 flow 定义，不改 core host 判断语义

### 阶段 6：统一 sidepanel 驱动方式

目标：

- sidepanel 完全按 registry 驱动，而不是按 `openai / kiro` 条件分支

动作：

- 重写 `sidepanel/sidepanel.js`
- 调整 `sidepanel/contribution-mode.js`、`sidepanel/account-records-manager.js`、相关 flow 私有展示逻辑
- flow selector、target selector、visible groups、capability 全部从 registry 派生
- `stepExecutionRange` 改成真正按当前 flow 通用读写
- 账号记录区改成“公共列表壳层 + flow 私有渲染器”

完成标准：

- sidepanel 不再依赖默认 flow 是 OpenAI 的假设
- sidepanel 不再直接处理 `panelMode` 与 `kiroTargetId` 两套并列写法

### 阶段 7：统一目录与文件命名

目标：

- 把 OpenAI 与 Kiro 都迁入 `flows/<flow-id>/`

动作：

- 重命名文件
- 更新所有 import / `importScripts` / 注入列表 / 测试引用
- 删除历史伪通用文件名
- 将 `content/*.js`、`background/steps/*.js`、`background/kiro/*` 分别迁入对应 flow 目录

完成标准：

- 新人看目录时能立即分清 core 与 flow 私有实现

### 阶段 8：删除旧兼容层与旧字段路径

目标：

- 删除所有只为迁移存在的旧字段、旧别名、旧路径和旧命名

动作：

- 删除 `signup-page -> openai-auth` 长期别名
- 删除 `kiroRuntime` 独立入口
- 删除 `panelMode` 作为内部真实 target 语义
- 删除 `background.js`、`background/message-router.js`、`background/navigation-utils.js`、`background/auto-run-controller.js` 里所有核心旧字段桥接逻辑
- 删除所有 `activeFlowId === 'kiro'` / `activeFlowId === DEFAULT_ACTIVE_FLOW_ID` 的核心结构分支
- 用新的 canonical contract 测试替换旧兼容写回测试；旧字段只保留导入器测试

完成标准：

- 仓库里只有 `imports/legacy/` 与其测试还认识旧字段
- core 只理解“某个已注册 flow”，不理解“OpenAI 还是 Kiro”

## 13. 实施顺序要求

为了避免第三次半重构，本次必须按顺序推进：

1. 先收口 contract
2. 再统一 settings
3. 再统一 runtime
4. 再建立导入转换器
5. 再拆 flow registry/source/driver
6. 再统一 sidepanel
7. 再迁目录和文件名
8. 最后删旧字段与旧桥接逻辑

禁止的做法：

- 先新增第三个 flow，再回头修 core
- 先重命名文件，但 contract 仍旧双轨
- 为了快，继续在 sidepanel 或 background 增加新的 `openai / kiro / new-flow` 三分支
- 一边写 canonical 结构，一边继续保留旧字段双写
- 让旧配置在启动时被直接读取并“尽量凑合可用”

## 14. 完成判定

本次重构只有在满足以下条件时才算完成：

- 新增一个新 flow 时，不需要修改 `settings-schema` 核心结构。
- 新增一个新 flow 时，不需要修改 `runtime-state` 核心结构。
- 新增一个新 flow 时，不需要在 sidepanel 主逻辑中增加 flow 名称判断分支。
- 新增一个新 flow 时，不需要在 `source-registry` core 里写新 host 判断。
- OpenAI 与 Kiro 都已经迁入统一命名体系。
- `background.js`、`background/message-router.js`、`sidepanel/sidepanel.js` 的正常运行路径不再读写 `panelMode`、`openaiIntegrationTargetId`、`kiroTargetId`、`kiroRuntime`。
- 旧配置文件不能直接运行，只能通过导入转换器进入新结构。
- 旧运行态快照不再支持恢复。
- 历史旧字段只允许存在于 `imports/legacy/` 及其测试中。

## 15. 非目标

本方案当前不解决：

- 新增具体第三个 flow 的业务实现
- OpenAI 私有流程本身的业务优化
- Kiro 私有流程本身的业务优化
- 所有公共工具立即物理迁移到 `core/` 目录
- 旧配置的自动无感兼容启动
- 旧运行态快照的兼容恢复

本方案只解决“以后再加 flow 时，不要再从根上出结构问题”。

## 16. 最终结论

这次重构必须被当成一次“彻底替换式升级”，不是普通功能开发。

如果继续在现有 `openai + kiro` 双轨基础上补第三个 flow，后续仍会再次进入：

- core 继续膨胀
- 命名继续污染
- 兼容层继续叠加
- 每次改动都更累

因此本次必须一次性完成：

- 统一 contract
- 统一命名
- 统一目录边界
- 删除长期双轨
- 取消旧配置运行时兼容
- 只保留单向导入转换器

完成后，后续 flow 才能真正变成“新增模块”，而不是“继续改核心”；旧世界也只能通过导入器进入新世界，而不能再反向定义新系统的结构。

