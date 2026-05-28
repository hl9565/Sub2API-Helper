# Sub2API Helper

`Sub2API Helper` 是一个用于辅助 SUB2API OpenAI OAuth 错误账号重新授权的 Chrome 侧边栏扩展。

本项目基于 `FlowPilot` 改造而来，当前版本只聚焦 SUB2API 重新授权场景，不作为 FlowPilot 全功能版本使用。

## 主要功能

- 使用侧边栏里填写的 SUB2API 地址、账号和密码登录 SUB2API。
- 自动进入账号管理，筛选 `OpenAI / OAuth / error` 状态账号。
- 支持按账号邮箱后缀过滤待重新授权账号。
- 支持维护“跳过邮箱”列表，已经成功或失败写备注的邮箱会自动加入，避免重复跑同一个账号。
- 自动生成 SUB2API 重授权链接，并复用 OpenAI 登录、邮箱验证码、OAuth 确认链路。
- 成功后把新的 OAuth credentials 写回原 SUB2API 账号，并清除错误状态。
- 失败时会把失败原因和建议重试时间写入 SUB2API 账号备注，方便排查。

## 安装方式

1. 解压 `Sub2API-Helper-0.0.1.zip`。
2. 打开 Chrome 的 `chrome://extensions/`。
3. 开启右上角“开发者模式”。
4. 点击“加载已解压的扩展程序”。
5. 选择解压后的目录。
6. 打开扩展侧边栏开始配置。

## 使用前配置

- `SUB2API`：填写你的 SUB2API 后台地址，例如 `https://your-domain/admin/accounts`。
- `账号 / 密码`：填写 SUB2API 登录账号和密码。
- `OpenAI 密码`：填写待重新授权账号对应的 OpenAI 登录密码。
- `账号后缀`：可选，例如 `@example.com`，留空则不过滤账号邮箱后缀。
- `跳过邮箱`：可选，一行一个邮箱；这里的邮箱不会再被自动选择。
- `邮箱服务`：选择验证码接收方式，例如 iCloud、163、QQ 等。
- `邮箱接码设置`：可调整验证码等待时间、轮询间隔、轮询次数和自动重发次数。

## 打包

本仓库自带打包脚本：

```bash
npm run package
```

生成产物：

```bash
dist/Sub2API-Helper-0.0.1.zip
```

打包脚本会排除测试、文档、本地数据、`.DS_Store`、`data/generated-emails.db`、`config.json` 等不适合发给用户的文件。

## 权限说明

扩展会请求较多 Chrome 权限，包括 tabs、cookies、browsingData、debugger、proxy 和 `<all_urls>`。

这些权限主要用于打开和操作 OpenAI 授权页面、邮箱页面、SUB2API 后台页面、清理登录态以及处理代理/验证码相关流程。请只安装来自可信来源的压缩包。

本项目链接并认可 [LINUX DO](https://linux.do/) 社区。欢迎在社区讨论帖中反馈问题、分享使用体验或提出改进建议。
