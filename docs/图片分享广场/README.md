# 图片分享广场方案

## 目标

图片分享广场是在现有本地优先工作台之外新增的远端公开能力。用户的数据仍默认存放在浏览器 IndexedDB，只有用户明确点击“分享到广场”时，才把可公开的图任务、任务链、提示词和缩略图上传到广场后端。

本方案第一版以后端实现为 Cloudflare Worker + D1 + R2，但前端只依赖稳定的 HTTP API 协议，不直接依赖 Worker、D1、R2 或 Cloudflare 专有概念。后续如果迁移到真实后端，只需要由新后端实现同一套接口，前端广场模块和分享模块应尽量不改或少改。

## 非目标

- 不做自动云同步。分享是显式动作，不是把本地画廊自动上传。
- 不分享用户的供应商配置、API Key、baseUrl、本地代理配置、错误调试日志。
- 不允许把用户自己上传的图片作为独立广场内容发布。
- 第一版不做实时协作、评论系统、关注系统和复杂账号体系。
- 第一版不把 R2 bucket 直接公开，图片读取优先经过后端接口，便于隐藏、删除、限流和审计。

## 核心原则

- 协议优先：前端只通过 `SquareApiClient` 调用 `/api/v1/*`，不感知具体后端实现。
- 实现可替换：Worker 是第一版实现，不是领域模型的一部分。
- 本地优先：本地任务、图片、提示词不因广场功能改变存储语义。
- 显式发布：每次公开分享都需要用户确认。
- 服务端强校验：前端可以提前拦截，但后端必须重新校验任务状态、文件大小、配额和字段。
- 可审核：所有公开内容都有 `status` 字段，允许隐藏、删除、举报和未来人工/自动审核。

## 领域概念

### Square Share

广场上的一条公开分享。协议层保留三类：

- `image`：围绕某个成功图任务输出图的分享卡片。
- `task`：围绕完整成功图任务和任务链的分享卡片。
- `prompt`：纯文本提示词分享。

`image` 和 `task` 都属于“图任务分享”配额，合计每个用户每天最多 3 条。`prompt` 使用独立文本配额，每个用户每天最多 99 条。

当前前端广场只展示 `task`、`prompt` 和“我分享的”入口，不再提供独立图片 tab。图片作为任务详情、任务链和封面资产展示。

### Square Asset

广场图片资产。包括原图和缩略图。资产只作为 Square Share 的组成部分存在，不作为独立领域对象出现在前端 API 中。

### Square Publisher

发布者身份。第一版使用匿名发布者，不要求用户登录。后端发放 `publisherId` 和发布 token，前端保存在本地。后端只保存 token hash。

### Share Manifest

分享内容的结构化描述。用于描述图任务、任务链、提示词、图片资产角色、生成参数和必要快照。Manifest 是跨后端实现的稳定数据契约。

### Lineage Snapshot

任务链快照。分享编辑输出时，必须把从当前任务向上追溯到源头的 Task Lineage 一起分享。这样其他用户看到的不只是最终结果，还能理解每一步如何从上游任务演化而来。

## 分享规则

### 图任务分享限制

图任务分享包括 `image` 和 `task` 两类。

- 每个发布者每天最多成功发布 3 条图任务分享。
- 只有 `TaskRecord.status === 'done'` 的任务允许分享。
- `running`、`error`、`partial_error`、已中止任务、回收站任务不允许分享。
- 任务必须至少有一张输出图。
- 输出图必须来自大模型生成结果，不能是用户自己上传的独立图片。
- 用户自己上传的图片不能作为独立 `image` 分享。
- 如果用户分享的是编辑输出，必须分享完整 Task Lineage。
- 如果编辑链的源头不是 Task，而是一张输入图片，可以把这张输入图作为链路源素材附带上传，但它不能作为独立广场卡片被发现或发布。
- 分享内容不能包含 `errorDebug`、API Key、baseUrl、本地代理配置、完整 Provider 配置。

### 提示词分享限制

- 每个发布者每天最多成功发布 99 条提示词分享。
- 提示词分享不上传图片。
- 提示词正文不能为空。
- 建议第一版限制提示词正文最大 8000 字符，标题最大 80 字符。

### 文件限制

建议第一版服务端强制以下限制：

- 单张原图最大 10 MB。
- 单张缩略图最大 512 KB。
- 单次图任务分享最多上传 24 个图片资产；任务链中的大模型输出图应尽量完整上传，超过上限时直接拒绝分享。
- 单次图任务分享的任务链最多 12 个 Task 节点。
- 单次图任务分享的图片资产总数最多 24 个。
- 单次请求体最大 60 MB。超过后应改为两阶段上传。
- 允许 MIME：`image/png`、`image/jpeg`、`image/webp`。
- 缩略图优先使用 `image/webp`，最大边建议 320 或 512。

### 审核状态

所有分享都保留 `status`：

- `published`：公开展示。
- `pending_review`：等待审核。
- `hidden`：管理员或风控隐藏。
- `deleted`：发布者删除。
- `rejected`：审核拒绝。

第一版可以默认写入 `published`，但代码和数据库必须按 `status` 查询，前端只展示 `published`。

### 配额口径

配额以服务端时间计算，建议使用 UTC+8 自然日，字段名为 `quota_day`，格式 `YYYY-MM-DD`。如果未来面向全球用户，可以把配额日切换为 UTC 日，但 API 不需要变化。

配额只统计成功创建的分享：

- 图任务：`kind IN ('image', 'task')`，每天最多 3。
- 提示词：`kind = 'prompt'`，每天最多 99。

被发布者删除的内容是否返还配额，第一版建议不返还，避免刷配额。

## API 协议

所有接口使用版本前缀：

```text
/api/v1
```

前端通过环境变量配置 API 地址：

```text
VITE_SQUARE_API_URL=https://gpt-image-square-api.example.workers.dev
```

后续迁移到真实后端时，只切换这个地址。

### 统一响应

成功响应：

```json
{
  "ok": true,
  "data": {}
}
```

错误响应：

```json
{
  "ok": false,
  "error": {
    "code": "quota_exceeded",
    "message": "今日图任务分享次数已用完",
    "requestId": "req_xxx"
  }
}
```

建议错误码：

- `bad_request`
- `unauthorized`
- `forbidden`
- `not_found`
- `payload_too_large`
- `unsupported_media_type`
- `quota_exceeded`
- `rate_limited`
- `validation_failed`
- `content_hidden`
- `internal_error`

### 身份接口

```text
POST /api/v1/identity
```

创建匿名发布者身份。

响应：

```json
{
  "ok": true,
  "data": {
    "publisherId": "pub_xxx",
    "token": "plain-token-only-returned-once"
  }
}
```

之后前端请求需要携带：

```text
Authorization: Bearer <token>
```

### 广场列表

```text
GET /api/v1/square?kind=image&sort=latest&q=&cursor=&limit=30
GET /api/v1/square?kind=task&sort=latest&q=&cursor=&limit=30
GET /api/v1/square?kind=prompt&sort=latest&q=&cursor=&limit=30
```

响应：

```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "id": "shr_xxx",
        "kind": "task",
        "title": "城市夜景角色设计",
        "prompt": "提示词摘要",
        "coverAsset": {
          "assetId": "ast_xxx",
          "thumbUrl": "/api/v1/assets/ast_xxx?variant=thumb",
          "width": 1024,
          "height": 1024
        },
        "tags": ["角色", "夜景"],
        "createdAt": 1770000000000,
        "viewCount": 12
      }
    ],
    "nextCursor": "1770000000000_shr_xxx"
  }
}
```

分页使用 cursor，不使用大偏移量 `OFFSET`。cursor 建议由 `createdAt + id` 组成。

### 分享详情

```text
GET /api/v1/shares/:shareId
```

返回完整 Share Manifest、任务链和资产列表。只有 `status = 'published'` 的分享可以被普通用户读取。

### 创建分享

```text
POST /api/v1/shares
Content-Type: multipart/form-data
```

字段：

- `manifest`：JSON 字符串。
- `asset:<clientAssetId>:original`：原图文件。
- `asset:<clientAssetId>:thumb`：缩略图文件。

Manifest 示例：

```json
{
  "kind": "task",
  "clientRequestId": "local_uuid",
  "title": "城市夜景角色设计",
  "prompt": "主任务提示词",
  "tags": ["角色", "夜景"],
  "source": {
    "app": "gpt-image-playground",
    "schemaVersion": 1
  },
  "taskShare": {
    "entryTaskId": "local_task_id",
    "entryOutputImageIds": ["local_image_id"],
    "lineage": [
      {
        "localTaskId": "task_a",
        "parentTaskId": null,
        "parentImageId": null,
        "prompt": "第一步提示词",
        "params": {
          "size": "1024x1024",
          "quality": "high",
          "output_format": "png",
          "output_compression": null,
          "moderation": "auto",
          "n": 1
        },
        "providerName": "OpenAI",
        "createdAt": 1770000000000,
        "outputAssetRefs": ["asset_output_a"]
      }
    ],
    "originAssets": [
      {
        "clientAssetId": "asset_origin_input",
        "role": "origin_input",
        "standaloneShareAllowed": false
      }
    ]
  },
  "assets": [
    {
      "clientAssetId": "asset_output_a",
      "role": "output",
      "localImageId": "local_image_id",
      "mimeType": "image/png",
      "width": 1024,
      "height": 1024,
      "byteSize": 1200000
    }
  ]
}
```

服务端需要校验：

- `clientRequestId` 在同一发布者下幂等。
- `kind` 合法。
- 当前发布者没有超过每日配额。
- `task` / `image` 分享包含有效任务链。
- `task` / `image` 分享不是失败、异常或运行中任务。
- 资产数量、单文件大小、总大小、MIME 合法。
- `origin_input` 只能作为链路素材，不能变成独立广场卡片。

### 读取资产

```text
GET /api/v1/assets/:assetId?variant=thumb
GET /api/v1/assets/:assetId?variant=original
```

后端根据 asset 所属分享的 `status` 决定是否返回。普通用户只能读取 `published` 分享的资产。

### 删除自己的分享

```text
POST /api/v1/shares/:shareId/delete
Authorization: Bearer <token>
```

第一版可以软删除：

```text
shares.status = 'deleted'
```

软删除后 Worker 会尽量立即删除该分享的 R2 图片资产并释放容量计数；如果删除失败，定时清理任务会后续重试。

### 管理用量

```text
GET /api/v1/admin/usage
Authorization: Bearer <ADMIN_TOKEN>
```

返回 D1 记录推算的 R2 存储用量、公开分享数量、总分享数量和当前限制。该值用于 Worker 自身限额保护，Cloudflare Dashboard 的账单统计仍是最终口径。

```text
POST /api/v1/admin/cleanup
Authorization: Bearer <ADMIN_TOKEN>
Content-Type: application/json

{
  "dryRun": true,
  "limit": 50,
  "prunePublished": true
}
```

清理顺序：

1. 清理已删除、已拒绝、隐藏或长期待审的分享。
2. 清理超过公开媒体保留期的已发布图任务分享，第一版默认 90 天。
3. 如果公开分享数量超过上限，清理最早发布的公开分享。
4. 如果 R2 估算用量超过上限，继续清理最早发布的公开分享，直到接近目标水位。

### 举报

```text
POST /api/v1/shares/:shareId/report
```

举报达到阈值后可以自动把 `status` 改为 `pending_review` 或 `hidden`。第一版至少要记录举报，便于后续人工处理。

## 前端设计

### 目录建议

```text
src/features/square/
├─ index.ts
├─ components/
│  ├─ SquarePage.tsx
│  ├─ SquareToolbar.tsx
│  ├─ SquareGrid.tsx
│  ├─ SquareCard.tsx
│  ├─ SquareDetailModal.tsx
│  └─ ShareToSquareModal.tsx
├─ hooks/
│  ├─ useSquareFeed.ts
│  └─ useShareToSquare.ts
└─ lib/
   ├─ buildShareManifest.ts
   ├─ squareApiClient.ts
   ├─ squareIdentity.ts
   └─ squareValidation.ts
```

### 前端 API 适配层

前端只依赖接口，不依赖 Worker：

```ts
export interface SquareApiClient {
  getIdentity(): Promise<SquareIdentity>
  listSquare(input: SquareListInput): Promise<SquareListResult>
  getShare(id: string): Promise<SquareShareDetail>
  createShare(input: SquareCreateShareInput): Promise<SquareShareCreated>
  deleteShare(id: string): Promise<void>
  reportShare(id: string, reason: string): Promise<void>
}
```

第一版实现为 `HttpSquareApiClient`：

```text
src/features/square/lib/squareApiClient.ts
```

迁移真实后端时保持 `SquareApiClient` 不变，只替换 API base URL 或 HTTP 细节。

### 应用入口

建议给应用增加主视图状态：

```ts
type AppView = 'local' | 'square'
```

落点：

- `src/store/contracts.ts`：新增 `appView`、`setAppView`。
- `src/store/slices/viewerSlice.ts` 或新增 `appSlice.ts`：维护主视图。
- `src/app/components/Header.tsx`：增加“本地 / 广场”入口。
- `src/App.tsx`：`appView === 'square'` 时渲染 `SquarePage`，否则渲染现有 Gallery。

广场内部当前有三个 tab：

```ts
type SquareTab = 'task' | 'prompt' | 'mine'
```

### 分享入口

图任务分享入口：

- 任务卡片动作区。
- 任务详情弹窗。
- 图片模式下的生成图右键菜单。

提示词分享入口：

- Prompt Library 列表项。
- 当前输入框提示词。

### 本地预校验

前端分享前应先做预校验，减少无效上传：

- 任务必须 `status === 'done'`。
- 任务不在 Recycle Bin。
- 任务有输出图。
- 不能分享用户上传图作为独立图片。
- 如果是编辑输出，必须能解析 Task Lineage。
- 必须能读取需要上传的 Stored Image。
- 原图和缩略图不能超过前端已知限制。

但这些只是体验优化，最终以后端校验为准。

### Task Lineage 打包

分享当前任务时：

1. 从当前 Task 作为 entry task。
2. 沿 `parentTaskId` 向上追溯。
3. 每个 Task 写入最小必要快照：prompt、params、providerName、createdAt、parentTaskId、parentImageId、outputImages。
4. 每个引用图片生成 asset ref。
5. 对于上游不存在 Task、但存在源输入图的情况，把源图作为 `origin_input` 附带。
6. `origin_input` 只能用于详情页展示链路上下文，不能出现在广场列表中。

### 图片处理

前端应复用现有 `buildImageThumbnail` 能力生成缩略图。上传时使用二进制 Blob，不把大图 base64 塞进 JSON。

如果现有图片读取能力只能拿到 data URL，后续实现时建议补一个内部工具把 Stored Image 转回 Blob：

```text
src/store/imageAssets.ts
```

或在 `src/lib/db/images.ts` 暴露已有 Blob 读取能力，供分享打包使用。

### 广场详情动作

第一版建议支持：

- 复制提示词。
- 将提示词填入输入框。
- 将公开任务参数复用到输入框。
- 查看任务链。
- 举报。

不要默认把广场任务导入本地 Gallery。导入会引入去重、来源标记、删除语义和版权边界，建议后续单独设计。

## Worker 实现设计

当前第一版实现目录：

```text
workers/square-api/
```

该实现遵循本方案的 `/api/v1` 协议。前端不直接依赖 Worker、D1 或 R2，后续可以由真实后端实现同一套接口替换。

### 目录建议

```text
workers/square-api/
├─ package.json
├─ wrangler.example.jsonc
├─ migrations/
│  ├─ 0001_init.sql
│  └─ 0002_storage_limits.sql
└─ src/
   ├─ index.ts
   ├─ config.ts
   ├─ cors.ts
   ├─ response.ts
   ├─ storage.ts
   ├─ routes/
   │  ├─ identity.ts
   │  ├─ square.ts
   │  ├─ shares.ts
   │  ├─ assets.ts
   │  ├─ reports.ts
   │  └─ admin.ts
   └─ validation.ts
```

路由层只处理 HTTP，业务规则放到 validation、db、storage 等独立模块。这样后续迁移真实后端时，规则更容易搬迁。

### Cloudflare 资源

- D1：结构化数据、列表查询、配额计数、举报。
- R2：原图和缩略图。
- Worker Env Vars：CORS 白名单、大小限制、默认审核状态、广场数量和 R2 容量水位。
- Worker Secrets：token hash secret、admin token、Turnstile secret。
- KV 可选：短期限流缓存。第一版可以先不用，D1 做权威配额。

### wrangler 配置示例

仓库提交 `wrangler.example.jsonc`，本地部署时复制为 `wrangler.jsonc` 并填入自己的 D1 database id、bucket name 和 CORS 域名。`wrangler.jsonc`、`.dev.vars` 和 `.wrangler/` 不提交到 git；真正的密钥使用 `wrangler secret put` 写入 Cloudflare。

```jsonc
{
  "name": "gpt-image-square-api",
  "main": "src/index.ts",
  "compatibility_date": "2026-05-01",
  "triggers": {
    "crons": ["17 19 * * *"]
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "gpt-image-square",
      "database_id": "<D1_DATABASE_ID>",
      "migrations_dir": "migrations"
    }
  ],
  "r2_buckets": [
    {
      "binding": "IMAGES",
      "bucket_name": "gpt-image-square-images"
    }
  ],
  "vars": {
    "API_VERSION": "v1",
    "ALLOWED_ORIGINS": "https://<your-pages-domain>,http://localhost:5173,http://127.0.0.1:5173",
    "DEFAULT_SHARE_STATUS": "published",
    "MAX_IMAGE_BYTES": "10485760",
    "MAX_THUMB_BYTES": "524288",
    "MAX_REQUEST_BYTES": "62914560",
    "DAILY_MEDIA_SHARE_LIMIT": "3",
    "DAILY_PROMPT_SHARE_LIMIT": "99",
    "MAX_R2_STORAGE_BYTES": "9663676416",
    "CLEANUP_TARGET_R2_STORAGE_BYTES": "8589934592",
    "MAX_PUBLISHED_SHARES": "3000",
    "MAX_STORED_SHARES": "5000",
    "CLEANUP_BATCH_LIMIT": "50",
    "CLEANUP_DELETED_RETENTION_DAYS": "1",
    "CLEANUP_HIDDEN_RETENTION_DAYS": "30",
    "CLEANUP_PUBLISHED_MEDIA_RETENTION_DAYS": "90",
    "CLEANUP_PRUNE_PUBLISHED": "true"
  }
}
```

### Worker 常用操作命令

以下命令示例使用 PowerShell，并假设当前已经进入仓库根目录。命令中的 `<...>` 都是占位符，不要把真实 Cloudflare 资源 ID、密钥、个人域名写进公共文档。

进入 Worker 目录：

```powershell
cd workers/square-api
```

首次准备：

```powershell
npm install
npx wrangler login
npx wrangler whoami
```

复制本地配置。`wrangler.jsonc` 用于本机部署，已被 `.gitignore` 忽略；仓库只提交 `wrangler.example.jsonc`。

```powershell
Copy-Item wrangler.example.jsonc wrangler.jsonc
```

首次创建 D1 和 R2：

```powershell
npx wrangler d1 create <database-name>
npx wrangler r2 bucket create <bucket-name>
```

创建后，把 Wrangler 输出的 `database_id`、D1 binding、R2 bucket binding 和 CORS 域名写入本地 `wrangler.jsonc`。示例：

```jsonc
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "<database-name>",
      "database_id": "<database-id>",
      "migrations_dir": "migrations"
    }
  ],
  "r2_buckets": [
    {
      "binding": "IMAGES",
      "bucket_name": "<bucket-name>"
    }
  ],
  "vars": {
    "ALLOWED_ORIGINS": "http://localhost:5173,https://<your-pages-domain>",
    "CLEANUP_PUBLISHED_MEDIA_RETENTION_DAYS": "90"
  }
}
```

设置 Worker 密钥。命令后面写的是密钥名，不是密钥值；执行后 Wrangler 会提示输入密钥值。

```powershell
npx wrangler secret put TOKEN_HASH_SECRET
npx wrangler secret put ADMIN_TOKEN
```

如果后续启用 Turnstile，再设置：

```powershell
npx wrangler secret put TURNSTILE_SECRET_KEY
```

执行数据库迁移。只有首次部署或 `migrations/*.sql` 有新增变更时需要执行。

```powershell
npm run db:migrate
```

部署 Worker。代码、`wrangler.jsonc` 变量、cron、binding 改动后都需要重新部署。

```powershell
npm run deploy
```

检查 Worker 是否在线：

```powershell
$api = "https://<your-worker-domain>"
Invoke-RestMethod "$api/api/v1/health"
```

查看线上日志：

```powershell
npx wrangler tail
```

查看广场用量。需要先设置 `ADMIN_TOKEN`。

```powershell
$api = "https://<your-worker-domain>"
$token = "<your-admin-token>"

Invoke-RestMethod "$api/api/v1/admin/usage" -Headers @{
  Authorization = "Bearer $token"
}
```

手动清理。先用 `dryRun: true` 预演，不会真的删除 R2 文件和 D1 记录。

```powershell
Invoke-RestMethod "$api/api/v1/admin/cleanup" `
  -Method Post `
  -Headers @{
    Authorization = "Bearer $token"
    "Content-Type" = "application/json"
  } `
  -Body '{"dryRun":true,"limit":50}'
```

确认结果后再执行真实清理：

```powershell
Invoke-RestMethod "$api/api/v1/admin/cleanup" `
  -Method Post `
  -Headers @{
    Authorization = "Bearer $token"
    "Content-Type" = "application/json"
  } `
  -Body '{"dryRun":false,"limit":50}'
```

本地开发 Worker：

```powershell
npm run dev
```

前端接入 Worker 时，设置前端环境变量：

```text
VITE_SQUARE_API_URL=https://<your-worker-domain>
```

提交代码时应提交：

```text
workers/square-api/src/*
workers/square-api/migrations/*
workers/square-api/package.json
workers/square-api/package-lock.json
workers/square-api/tsconfig.json
workers/square-api/wrangler.example.jsonc
```

不要提交：

```text
workers/square-api/wrangler.jsonc
workers/square-api/.dev.vars
workers/square-api/.wrangler/
workers/square-api/node_modules/
```

### D1 表设计

```sql
CREATE TABLE publishers (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL,
  display_name TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
);

CREATE TABLE shares (
  id TEXT PRIMARY KEY,
  publisher_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('image', 'task', 'prompt')),
  title TEXT NOT NULL,
  prompt TEXT NOT NULL,
  manifest_json TEXT NOT NULL,
  cover_asset_id TEXT,
  tags_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'published',
  client_request_id TEXT NOT NULL,
  view_count INTEGER NOT NULL DEFAULT 0,
  report_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (publisher_id) REFERENCES publishers(id)
);

CREATE UNIQUE INDEX idx_shares_publisher_request
  ON shares(publisher_id, client_request_id);

CREATE INDEX idx_shares_feed
  ON shares(status, kind, created_at DESC, id DESC);

CREATE TABLE share_assets (
  id TEXT PRIMARY KEY,
  share_id TEXT NOT NULL,
  role TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  thumb_r2_key TEXT,
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  thumb_byte_size INTEGER NOT NULL DEFAULT 0,
  width INTEGER,
  height INTEGER,
  content_hash TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (share_id) REFERENCES shares(id)
);

CREATE INDEX idx_share_assets_share_id
  ON share_assets(share_id);

CREATE TABLE publisher_quota_days (
  publisher_id TEXT NOT NULL,
  quota_day TEXT NOT NULL,
  media_share_count INTEGER NOT NULL DEFAULT 0,
  prompt_share_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (publisher_id, quota_day)
);

CREATE TABLE storage_counters (
  key TEXT PRIMARY KEY,
  used_bytes INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE TABLE reports (
  id TEXT PRIMARY KEY,
  share_id TEXT NOT NULL,
  publisher_id TEXT,
  reason TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (share_id) REFERENCES shares(id)
);

CREATE INDEX idx_reports_share_id
  ON reports(share_id);
```

### R2 Key 设计

```text
shares/{shareId}/assets/{assetId}/original
shares/{shareId}/assets/{assetId}/thumb
```

D1 保存 MIME、尺寸、大小和 key。客户端永远不直接拼 R2 URL，只使用 `/api/v1/assets/:assetId`。

### 配额和限流

后端创建分享时必须在一个事务语义内完成：

1. 认证发布者。
2. 读取或创建当日 `publisher_quota_days`。
3. 判断 `kind` 对应配额。
4. 判断广场总数量、公开数量和 R2 估算容量。
5. 通过 `storage_counters` 预留本次上传容量。
6. 写入 R2、share 和 asset 记录。
7. 更新当日配额。

如果写库或上传失败，Worker 必须尽量删除已上传 R2 对象、释放 `storage_counters` 预留容量并回退本次配额计数。

D1 的并发写能力有限，第一版可以接受低并发。容量预留通过单行 `UPDATE ... WHERE used_bytes + incoming <= limit` 做原子保护，避免明显超过免费水位。如果后续用户量明显增长，可以把发布者配额和容量计数放到 Durable Object 或真实后端事务里。

额外建议：

- 未登录匿名用户每分钟最多 2 次发布请求。
- 同一 IP 每分钟最多 10 次发布请求。
- 读取广场列表可以走 Cache API，发布后短暂不实时刷新可接受。

### CORS

Worker 必须处理 `OPTIONS`：

- 只允许 `ALLOWED_ORIGINS` 中的来源。
- 允许方法：`GET, POST, OPTIONS`。
- 允许 headers：`Content-Type, Authorization`。
- 不使用 `*` 搭配凭据。

### Turnstile

建议在创建分享时接入 Turnstile。第一版可以先预留 manifest 字段：

```json
{
  "turnstileToken": "xxx"
}
```

后端有 `TURNSTILE_SECRET_KEY` 时强制校验，没有配置时只做大小限制和配额限制。

## 迁移到真实后端的策略

### 前端不变点

- `SquareApiClient` 接口不变。
- API 路径 `/api/v1/*` 不变。
- 请求/响应 JSON 结构不变。
- `manifest` schemaVersion 向后兼容。
- `VITE_SQUARE_API_URL` 切到新后端域名。

### 后端可替换点

Worker 实现：

- D1 替代关系型数据库。
- R2 替代对象存储。
- Worker route 替代常规控制器。

真实后端实现：

- PostgreSQL / MySQL 保存 publishers、shares、assets、quota、reports。
- S3 / R2 / OSS 保存图片。
- 常规服务层实现相同的分享校验和配额。
- CDN 或后端流式返回图片。

### 建议保留的契约资产

后续实现时可以在本目录补充：

```text
docs/图片分享广场/api-contract.md
docs/图片分享广场/manifest-schema.json
```

第一版可以先在代码中定义 TypeScript 类型，等接口稳定后再沉淀 OpenAPI 或 JSON Schema。

## 实施阶段

### 阶段 1：协议和 Worker 基础

- 新增 `workers/square-api`。
- 建立 D1 migration。
- 建立 R2 binding。
- 实现 CORS、统一响应、health。
- 实现匿名 identity。
- 实现只读广场列表和详情的空数据路径。

### 阶段 2：前端广场只读页

- 新增 `src/features/square`。
- 增加 `appView`，支持本地画廊与广场切换。
- 实现任务、提示词、我分享的三个 tab。
- 实现分页、空状态、错误状态。

### 阶段 3：提示词分享

- Prompt Library 增加分享入口。
- 实现 `prompt` manifest。
- 后端实现每日 99 条提示词配额。
- 广场提示词 tab 支持复制和填入输入框。

### 阶段 4：图任务分享

- 任务卡片和详情弹窗增加分享入口。
- 实现成功任务校验。
- 实现 Task Lineage 打包。
- 实现缩略图生成和 multipart 上传。
- 后端实现每日 3 条图任务配额。
- 后端保存图片到 R2，结构化记录到 D1。

### 阶段 5：删除、举报和审核

- 发布者删除自己的分享。
- 普通用户举报。
- 管理端可以先不做 UI，用 Cloudflare 控制台或临时脚本修改 `status`。
- 前端只展示 `published` 内容。

### 阶段 6：真实后端迁移准备

- 补齐 API contract 文档。
- 补齐 manifest JSON Schema。
- 给 `SquareApiClient` 增加契约测试。
- Worker 和真实后端共用相同请求样例。

## 关键风险

- 公共上传一定会遇到滥用，必须从第一版就限制大小、频率、配额和状态。
- 用户上传图的边界要清晰：不能独立分享，但可以作为编辑任务链的源素材附带。
- 任务链打包不能泄露本地配置，尤其是 Provider 配置、API Key、baseUrl 和 errorDebug。
- 大图上传不应使用 base64 JSON，必须走二进制文件。
- D1 适合第一版和中小规模广场；高并发配额写入、复杂搜索和审核工作流后续可能需要真实后端或专门服务。

## 第一版验收标准

- 用户可以打开广场，按任务、提示词、我分享的三个 tab 浏览和管理公开内容。
- 用户可以把成功图任务分享到广场，失败和异常任务会被前端拦截，后端也会拒绝。
- 用户每天最多成功分享 3 条图任务。
- 用户每天最多成功分享 99 条提示词。
- 用户不能把自己上传的图片作为独立内容分享到广场。
- 编辑输出分享会包含完整 Task Lineage；源头是输入图时，该图只能作为链路源素材展示。
- 所有广场内容都有 `status`，列表只展示 `published`。
- 图片读取通过后端资产接口完成，不直接暴露存储桶。
- 前端只依赖 `SquareApiClient` 和 `/api/v1` 协议，切换真实后端不需要改 UI 组件。
