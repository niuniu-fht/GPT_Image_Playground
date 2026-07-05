# GPT Image Playground 系统功能与配置指南

本文档用于说明当前项目的系统结构、主要功能、图片存储链路，以及后台配置应该怎么填写。

## 1. 当前推荐架构

当前项目已经把广场 API 融合进 Node 后端，主链路不再依赖 Cloudflare Worker。

```text
React 前端
  -> Node Server
     -> Postgres：用户、积分、模型、任务、广场分享记录
     -> Cloudflare R2：生成图片、广场图片文件
  -> assets.code2alita.com：公开访问 R2 图片
```

Cloudflare Worker 代码仍保留在 `workers/square-api`，但当前阶段作为未来可选外置部署，不是必须配置项。

## 2. 各模块职责

### 前端 Web

路径：`src/`

负责：

- 登录注册
- 生图工作台
- 任务画廊
- 图片详情、编辑、预览
- 广场列表、分享、详情
- 后台管理界面

访问地址：

```text
http://127.0.0.1:8080
```

### Node Server

路径：`server/`

负责：

- 用户登录、注册、会话
- 模型配置、上游渠道配置
- 积分、兑换码、套餐、订单
- 调用上游图片模型
- 下载上游返回的图片 URL
- 上传图片到 Cloudflare R2
- 生成任务记录
- 内置广场 API
- 广场分享、列表、详情、举报、审核
- 后台管理接口

访问地址：

```text
http://127.0.0.1:8787
```

健康检查：

```text
GET /api/health
```

### Postgres

负责保存业务数据：

- 用户
- 积分流水
- 模型配置
- 上游渠道
- 生成任务
- 平台设置
- 广场发布者
- 广场分享记录
- 广场图片资产记录
- 举报记录

Docker 本地端口：

```text
5432
```

### Cloudflare R2

负责保存图片文件。

当前用途：

- 生成图长期存储
- 广场图长期存储
- 图片公开访问

公开资源域名示例：

```text
https://assets.code2alita.com
```

## 3. 图片生成后的存储链路

上游可能返回两种图片格式：

```text
1. b64_json
2. image.url，例如 https://img.code2alita.com/generated-images/xxx.png
```

当前系统处理方式：

```text
上游返回图片
  -> Node Server 读取图片
  -> Node Server 上传到 Cloudflare R2
  -> 返回自己的图片地址
  -> 前端保存自己的远程图片 URL
```

最终前端应该拿到：

```text
https://assets.code2alita.com/generated/{taskId}/{index}.png
```

而不是长期依赖：

```text
https://img.code2alita.com/generated-images/xxx.png
```

## 4. 广场 API 与图片域名的区别

### 公开资源域名

例如：

```text
https://assets.code2alita.com
```

它只负责展示图片文件。

它不是 API 服务，不能处理：

- 创建分享
- 查询广场列表
- 审核内容
- 举报内容
- 用户身份

### 广场 API

现在广场 API 已内置在 Node Server 中：

```text
http://127.0.0.1:8787/api/v1
```

前端同源访问时走：

```text
/api/v1
```

它负责：

- `POST /api/v1/identity` 创建广场发布者身份
- `POST /api/v1/shares` 创建分享并上传图片
- `GET /api/v1/square` 读取广场列表
- `GET /api/v1/shares/:id` 读取分享详情
- `GET /api/v1/me/shares` 读取我的分享
- `POST /api/v1/shares/:id/delete` 删除自己的分享
- `POST /api/v1/shares/:id/report` 举报分享

## 5. 后台广场存储配置怎么填

位置：

```text
后台管理 -> 广场 -> 广场存储配置
```

### 外置 Worker API

当前可以留空。

```text
外置 Worker API（可选）：留空
外置 Worker Admin Token（可选）：留空
```

留空时使用内置 Node 广场 API。

### R2 Endpoint

Cloudflare R2 的 S3 API endpoint。

示例：

```text
https://<account-id>.r2.cloudflarestorage.com
```

### R2 Bucket

你的 R2 bucket 名称。

示例：

```text
max-canvas
```

### R2 Access Key

Cloudflare R2 API Token 的 Access Key ID。

### R2 Secret Key

Cloudflare R2 API Token 的 Secret Access Key。

保存后后台会脱敏，不会明文展示。

### 公开资源域名

绑定到 R2 的公开访问域名。

示例：

```text
https://assets.code2alita.com
```

前端展示图片时使用这个域名。

### 启用 R2 存储

建议开启。

```text
启用 R2 存储：开启
```

### 生成后自动同步到广场存储

建议开启。

```text
生成后自动同步到广场存储：开启
```

开启后，生成接口会把上游图片搬到 R2，再返回自己的图片地址。

## 6. Cloudflare 需要准备什么

当前融合方案只需要 Cloudflare R2，不必须部署 Worker。

你需要：

```text
1. 一个 R2 Bucket
2. 一个 R2 API Token
3. 一个绑定到 R2 的公开资源域名
```

建议公开资源域名：

```text
assets.code2alita.com
```

## 7. R2 CORS 建议

如果图片需要被浏览器 canvas、下载、预览等场景读取，建议 R2 公开域名允许你的站点跨域访问。

开发环境至少允许：

```text
http://localhost:8080
http://127.0.0.1:8080
```

生产环境允许你的正式站点域名。

如果简单处理，也可以对图片资源开放：

```text
Access-Control-Allow-Origin: *
```

## 8. Docker 启动

启动或重建：

```bash
docker compose up -d --build
```

只重建后端和前端：

```bash
docker compose up -d --build server web
```

查看状态：

```bash
docker compose ps
```

## 9. 常用验证

前端构建：

```bash
npm run build
```

后端构建：

```bash
npm run build:server
```

测试：

```bash
npm test -- --run
```

后端健康检查：

```bash
curl http://127.0.0.1:8787/api/health
```

## 10. 当前阶段建议

现在先使用融合方案：

```text
React -> Node Server -> Postgres + R2
```

不要急着部署 Worker。这样系统更简单，所有后台、用户、积分、模型、任务、广场记录都在同一个 Postgres 里。

等以后访问量变大，或者广场需要独立扩容，再考虑把 `workers/square-api` 部署成独立 Worker。
