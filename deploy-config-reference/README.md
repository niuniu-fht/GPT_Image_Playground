# 后台配置参考包

这个目录用于把本地当前后台配置带到服务器上参考填写。

## 文件

- `admin-config-reference.json`
  - `platformSettings`：后台「模型与系统 → 平台设置」里的注册、生成、维护、兑换码说明、首页轮播等配置。
  - `squareSettings`：后台「内容运营 → 广场」里的广场 API、R2、公开访问域名、自动上传等配置。
  - `models`：后台「模型与系统 → 模型」里的模型配置、积分消耗、质量/分辨率计费。
  - `upstreamProviders`：后台「模型与系统 → 上游渠道」里的转发地址、超时、优先级等。`apiKey` 已脱敏，需要服务器重新填。
  - `creditPackages`：后台「用户运营 → 套餐订单」里的积分套餐。
  - `redeemCodes`：后台「用户运营 → 兑换码」里的兑换码规则。
  - `announcements`：后台「内容运营 → 公告」里的公告配置。
  - `moderationRules`：后台风控/审核规则。

- `server.env.reference`
  - 服务器 `server/.env` 的参考模板，敏感项已脱敏。

## 使用方式

1. 服务器部署项目并启动 Docker。
2. 登录后台：`https://你的域名/admin`。
3. 按照 `admin-config-reference.json` 里的内容，在后台对应页面手动填写。
4. 密钥类配置不要直接复制脱敏值，需要去 Cloudflare / 上游平台重新获取并填写。

## 重点必填

- 上游渠道：baseUrl、apiKey、timeoutSeconds。
- 模型：name、displayName、upstreamModel、upstreamProvider、积分消耗。
- 广场/R2：r2Enabled、r2Endpoint、r2AccessKey、r2SecretKey、r2Bucket、publicBaseUrl、autoUploadGeneratedImages。
- 平台设置：registerBonusCredits、redeemDescription、landingHeroSlidesJson。

## 注意

- 这不是数据库完整备份，是“后台配置参考”。
- 如果你想完整迁移用户、任务、图片资产、订单、日志，需要单独做 Postgres dump 和 R2 文件迁移。
- `docker-data/postgres` 是本地数据库目录，服务器不要覆盖错。
