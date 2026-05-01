# GPT Image Playground

面向 OpenAI / GPT Image 工作流的本地优先图片生成与编辑工作台。前端管理任务的全生命周期：草稿准备、API 调用、结果存储、画廊展示与编辑链追踪。

## Language

### 核心实体

**Task** (TaskRecord):
一次图片生成或编辑操作的完整记录。包含提示词、参数、输入/输出图片引用、状态、编辑选区、任务链信息、分类与供应商快照，以及错误调试上下文。
_Avoid_: job, request, generation

**Task Draft**:
提交前的任务预备状态，未经持久化。由提示词、输入图片、参数组合而成，经校验与 staging 后转为 **Task**。
_Avoid_: pending task, input form state

**Task Run**:
**Task** 从提交到完成（成功/失败/中止）的执行生命周期。包含排队、重启、追加结果、失败收尾等阶段。
_Avoid_: execution, processing

**Task Lineage**:
通过 `parentTaskId` 串联的任务编辑历史链。一条 **Task** 可直接来源于另一条 **Task** 的编辑输出，形成上下游关系。
_Avoid_: task chain, edit history, parent-child chain

**Task Snapshot**:
**Task** 提交时记录的供应商名称和分类名称快照。即使供应商或分类后续被修改/删除，**Task** 仍保留原始信息。
_Avoid_: frozen state, historical record

### 图片

**Input Image** (InputImage):
UI 层面用户提交的图片。携带预览 data URL、可选蒙版、选区信息，以及来源追踪（来自哪条 **Task**、哪个 **Stored Image**）。
_Avoid_: uploaded image, reference image, source image

**Stored Image** (StoredImage):
IndexedDB 中持久化的图片，通过 SHA-256 哈希去重。有三种存储形式：本地 Blob、远程 URL、旧版 data URL。
_Avoid_: saved image, cached image, image asset, image file

### 生成参数

**Task Params** (TaskParams):
控制图片生成输出的参数集：尺寸、质量、输出格式、压缩率、审核强度、生成数量 n。
_Avoid_: generation options, output settings

### 供应商与配置

**Provider** (ProviderConfig):
包含 API 端点、密钥、模型、协议、传输模式等配置的供应商。**Task** 提交时通过 **Provider** 路由 API 请求。
_Avoid_: vendor, service, endpoint

**Protocol** (ApiProtocol):
API 调用所用的协议类型。支持 `images` 协议和 `responses` 协议，各自有不同的请求构建与响应解析路径。
_Avoid_: API type, communication mode

**Transport** (ResponsesTransportMode):
**Responses** 协议下的传输模式：`stream`（SSE 流式）、`json`（一次性 JSON 响应）、`auto`（自动选择）。
_Avoid_: delivery mode, response format

**Request Plan**:
API 调用的策略计划。由 **Planner** 根据协议、传输模式、图片输入方式等生成：包含一组按优先级排序的尝试计划，失败后自动退避/降级到下一个计划。
_Avoid_: strategy, attempt, call plan

**Planner**:
根据当前配置和输入条件生成 **Request Plan** 列表的策略模块。不同协议有不同的 Planner 逻辑。
_Avoid_: strategy engine, router

### 画廊

**Gallery**:
**Task** 的可视化展示区。支持标准模式（卡片网格）和图片模式（纯图片墙），以及搜索、筛选、多选批量操作。
_Avoid_: task list, grid view, task board

**Recycle Bin**:
标记为删除的 **Task** 暂存区。**Task** 进入回收站后保留一段时间再被保洁清理。
_Avoid_: trash, deleted items

### 提示词库

**Prompt Library**:
用户保存的可复用提示词集合。每条包含标题、正文和创建/更新时间。
_Avoid_: saved prompts, template library

### 图片分享广场

**Square Share**:
用户显式发布到图片分享广场的一条公开内容。协议层保留 `image`、`task`、`prompt` 三类，其中 `image` 与 `task` 都属于图任务分享配额；当前前端只把生成图作为 `task` 分享和展示，不提供独立图片 tab。
_Avoid_: post, publication, cloud sync

**Square Asset**:
Square Share 引用的远端图片资产，包括原图和缩略图。Square Asset 只作为广场内容的组成部分存在，不改变本地 **Stored Image** 的语义。
_Avoid_: remote stored image, public image record

**Square Publisher**:
广场发布者身份。第一版可以是匿名发布者，前端只保存发布 token，后端只保存 token hash。
_Avoid_: account, owner, user profile

**Share Manifest**:
前端向广场后端提交的结构化分享描述，包含分享类型、标题、提示词、标签、任务链快照、资产引用和 schemaVersion。它是 Worker 与未来真实后端之间保持兼容的接口契约。
_Avoid_: payload, post body, upload metadata

### 局部编辑

**Image Edit Session** (ImageEditSession):
局部编辑的会话上下文：指定源图片、选区、提示词，通过 **Task** 提交后应用编辑。
_Avoid_: inpainting session, edit context

### 导入导出

**Export**:
将所有数据（设置、供应商、分类、提示词库、**Task** 记录、**Stored Image**）打包为单个 ZIP 文件。
_Avoid_: backup, download all

## Relationships

- 一个 **Task** 属于一个 **Provider**（通过提交时的 **Task Snapshot**）
- 一个 **Task** 属于一个 **Category**（通过提交时的 **Task Snapshot**）
- 一个 **Task** 包含零或多个 **Input Image**
- 一个 **Task** 产生零或多个 **Stored Image**（作为输出）
- 一个 **Task** 可以有一个上游 **Task**（通过 **Task Lineage**）
- 一个 **Stored Image** 可以被多条 **Task** 引用（通过 SHA-256 去重）
- 一个 **Provider** 包含一组 **Protocol** / **Transport** 配置
- **Planner** 根据 **Provider** 配置和 **Task Params** 生成 **Request Plan** 列表
- **Gallery** 展示 **Task** 列表，支持按分类、状态、搜索词筛选
- **Recycle Bin** 是 **Task** 的暂存状态（`deletedAt` 不为 null），保洁定期清理过期项
- **Square Share** 从用户显式选择的 **Task** 或 **Prompt Library** 项生成，不自动同步本地数据
- **Share Manifest** 可以包含 **Task Lineage** 快照和对应 **Square Asset** 引用，但不得包含 Provider 密钥、baseUrl 或错误调试日志

## Example dialogue

> **Dev:** "当用户提交了一个 **Task Draft**，流程是怎样的？"
> **Domain expert:** "**Task Draft** 先经过校验，确保提示词和参数合法。然后 staging 阶段从 **Input Image** 提取图片并存入 IndexedDB 成为 **Stored Image**。Builder 将其组装为 **Task**。最后 **Task Run** 接管：排入队列，由 **Planner** 生成 **Request Plan** 列表，按优先级尝试调用 API，逐张保存输出 **Stored Image**。成功则进入 **Gallery**，失败则记录 **Task Error Debug Info**。"

> **Dev:** "**Task Lineage** 和 **Task Snapshot** 的区别是什么？"
> **Domain expert:** "**Task Lineage** 记录的是任务之间的来源关系——这条任务是从哪条任务编辑而来的。而 **Task Snapshot** 记录的是任务提交时的环境信息——用的是哪个供应商、存在哪个分类下。两者互不依赖：一条任务可以没有 lineage（直接从输入面板新建），但一定有 snapshot（提交时必然有选中供应商和分类）。"

> **Dev:** "**Request Plan** 中的退避是怎么工作的？"
> **Domain expert:** "**Planner** 生成多个 **Request Plan**，例如 stream → file_id → json 的顺序。Executor 逐一尝试，第一个成功的 **Request Plan** 的结果被采用。如果所有计划都失败，**Task** 标记为 error。"

## Flagged ambiguities

- "source" 曾同时指代 `InputImage.sourceTaskId`（来源任务）和 `StoredImage.source`（图片来源：upload/generated）。已澄清：前者用 **Task Lineage** 语义，后者是 **Stored Image** 的来源标记。
- "image" 曾同时指代 UI 输入图片（**Input Image**）、持久化图片（**Stored Image**）和输出图片（output image）。已澄清：这三个概念严格区分，**Input Image** 是 UI 层、**Stored Image** 是持久化层、输出图片是 **Stored Image** 的一个子集（`source: 'generated'`）。
