# Blob 主存储迁移最终方案

## 1. 目标

本方案用于把当前项目的图片主存储从 `dataUrl` 迁移到 `Blob / 二进制`，同时满足以下目标：

- 新生成图片不再长期以超长 `dataUrl` 字符串保存在 IndexedDB 和内存缓存中
- 旧用户已经落在 IndexedDB 里的 `dataUrl` 图片继续可读，不需要清库
- 保留原图，不因为引入缩略图而丢失完整输出
- 画廊不再直接拿原图做缩略预览，优先使用本地缩略图
- 保留当前 SSE 拆块解析与 `partial_image` 防爆策略，不破坏现有大图稳定性

## 2. 当前问题

当前项目的图片主链路以 `dataUrl` 为中心：

- API 层最终产出 `dataUrl`
- IndexedDB 的 `images` 表直接存 `dataUrl`
- 运行时缓存 `imageCache` 直接缓存 `dataUrl`
- 画廊预览直接使用原图地址，不区分缩略图和原图
- 导入导出在 `dataUrl <-> bytes` 之间来回转换

这会带来几个直接问题：

- `dataUrl` 带有 base64 膨胀，长期存储成本高
- 大图进入缓存后会长期占用字符串内存
- 画廊缩略图直接解码原图，任务多时主线程和浏览器图像解码压力明显增大
- 旧链路里多处围绕 `string src`、`dataUrl`、`hashDataUrl` 构建，后续继续扩图库会越来越重

## 3. 方案原则

- 不推翻现有 `TaskRecord` 只存图片 `id` 的任务模型
- 不推翻当前 SSE 增量解析架构
- 不把 `partial_image` 写入正式图片库
- 不要求第一阶段改掉所有 `dataUrl` API 边界
- 先解决“存储主路径”和“画廊展示主路径”

## 4. 目标架构

迁移后整体架构如下：

```text
OpenAI / 中转返回 JSON / SSE
  -> base64
  -> Uint8Array / Blob
  -> IndexedDB: original Blob + thumbnail Blob
  -> 缓存层统一生成可显示 src
  -> 画廊优先读 thumbnail
  -> 详情 / 灯箱 / 编辑器按需读 original
```

## 5. 新的 StoredImage 结构

`StoredImage` 改为三态联合结构，兼容本地 Blob、远程 URL 和历史 `dataUrl`：

```ts
export type StoredImageKind = 'local_blob' | 'remote_url' | 'legacy_data_url'

export interface StoredImageBase {
  id: string
  kind: StoredImageKind
  createdAt?: number
  source?: 'upload' | 'generated'

  contentHash?: string | null
  mimeType?: string | null
  byteSize?: number | null

  width?: number | null
  height?: number | null
}

export interface StoredLocalBlobImage extends StoredImageBase {
  kind: 'local_blob'
  blob: Blob

  thumbnailBlob?: Blob | null
  thumbnailMimeType?: string | null
  thumbnailWidth?: number | null
  thumbnailHeight?: number | null

  migratedFromLegacyAt?: number | null
}

export interface StoredRemoteUrlImage extends StoredImageBase {
  kind: 'remote_url'
  remoteUrl: string
}

export interface StoredLegacyDataUrlImage extends StoredImageBase {
  kind: 'legacy_data_url'
  dataUrl: string
}

export type StoredImage =
  | StoredLocalBlobImage
  | StoredRemoteUrlImage
  | StoredLegacyDataUrlImage
```

### 5.1 设计理由

- `local_blob`
  - 新写入主路径
  - 保留完整原图 `blob`
  - 可附带 `thumbnailBlob`
- `remote_url`
  - 保留现有公网 URL 参考图能力
  - 不必强行下载并本地化
- `legacy_data_url`
  - 兼容历史数据
  - 允许惰性迁移，不阻塞启动

## 6. 主键与去重策略

### 6.1 规则

- `id`
  - 作为稳定引用主键
  - 继续供 `TaskRecord.inputImageIds / outputImages / editMaskImageId` 使用
- `contentHash`
  - 作为新二进制去重键
  - 仅对本地二进制图片强制要求

### 6.2 推荐语义

- 新本地图
  - `id = contentHash`
  - `contentHash = 二进制内容 hash`
- 新远程图
  - `id = 继续沿用 URL hash 语义`
  - `contentHash = null`
- 旧 `legacy_data_url` 图
  - 迁移到 Blob 时不改 `id`
  - 只补 `contentHash`

### 6.3 为什么不能直接重写旧 id

当前任务模型是按图片 `id` 关联，若重写旧 `id`，就必须同步回写所有任务记录，风险高且收益低。
因此旧记录迁移为 Blob 时，应该保持 `id` 不变。

## 7. IndexedDB 迁移方案

### 7.1 DB 版本

- `DB_VERSION: 1 -> 2`
- `images` store 继续保持 `keyPath: 'id'`

### 7.2 建议索引

- `kind`
- `contentHash`
- `createdAt`

`contentHash` 建议先使用非唯一索引，避免历史脏数据导致升级失败。

### 7.3 建议新增 DB Helper

```text
+----------------------------------+--------------------------------------+
| 函数                             | 作用                                 |
+----------------------------------+--------------------------------------+
| storeImageBlob(blob, meta)       | 新图主写入口                         |
+----------------------------------+--------------------------------------+
| storeRemoteImage(url, meta)      | 远程图写入口                         |
+----------------------------------+--------------------------------------+
| storeLegacyDataUrl(dataUrl, meta)| 旧数据兼容写入口                     |
+----------------------------------+--------------------------------------+
| getImageRecord(id)               | 读取完整记录                         |
+----------------------------------+--------------------------------------+
| getImageDisplaySource(id, variant)| 获取 UI 可显示地址                  |
+----------------------------------+--------------------------------------+
| getImageBlobForApi(id)           | 给 API / 下载 / 导出使用原图 Blob     |
+----------------------------------+--------------------------------------+
| getImageDataUrlForApi(id)        | 旧 API 边界按需转 dataUrl            |
+----------------------------------+--------------------------------------+
| migrateLegacyImageRecord(id)     | 单条旧图迁移                         |
+----------------------------------+--------------------------------------+
```

## 8. SSE / JSON 图片接收方案

## 8.1 核心原则

- 保留当前拆块 SSE parser
- 保留 split stream path
- 保留 `partial_image` 丢弃策略
- 只改最终图片落库存储方式

### 8.2 JSON 路径

当前是：

```text
base64 -> dataUrl -> string[] -> storeImage(dataUrl)
```

迁移后改为：

```text
base64 -> Uint8Array -> Blob -> storeImageBlob(blob)
```

### 8.3 SSE 路径

当前 split stream path 已经会在最终 `response.output_item.done` 事件里提取最终图片。
迁移后继续只认这个最终事件：

```text
SSE chunk
  -> 增量 parser
  -> 完整 response.output_item.done
  -> 取最终 base64
  -> 解码 Blob
  -> 入写队列
  -> storeImageBlob
```

### 8.4 不能动的部分

- 不要按 transport chunk 直接做 `base64 -> Blob`
- 不要为 `partial_image` 建正式记录
- 不要把 SSE 解析和 DB 写入强耦合在同一热路径里

### 8.5 需要特别注意的点

- Blob 化不能减少 SSE 里 base64 文本本身的体积
- Blob 化主要减少的是“事件结束之后”的常驻字符串成本
- 4K 大图的瞬时峰值仍要靠现有 chunked parser 控制
- `atob()` 建议分段解码，避免一次性解码超大串

## 9. 写入队列与后台处理

建议把“读流”和“落库”拆开：

- 解析层
  - 只负责拿到最终 `Blob`
- 写入队列
  - 计算 `contentHash`
  - 生成缩略图
  - 落 IndexedDB
  - 回填运行时状态

这样做的原因：

- 避免流式读取线程被哈希、缩略图生成、落库阻塞
- 避免网络读取和磁盘写入互相拖慢
- 后续更容易把缩略图生成放到 `requestIdleCallback` 或 Worker

## 10. 画廊展示优化方案

当前画廊虽然不是全量一次性渲染，但它不是真正虚拟列表；更关键的是，它直接拿原图做缩略图展示。

迁移后统一使用下面的策略：

```text
+------------------+------------------------------------------+
| 场景             | 读取内容                                 |
+------------------+------------------------------------------+
| TaskCard 画廊卡片| thumbnailBlob / thumbnail object URL     |
+------------------+------------------------------------------+
| DetailModal      | original Blob object URL                 |
+------------------+------------------------------------------+
| Lightbox         | original Blob object URL                 |
+------------------+------------------------------------------+
| 编辑器           | original Blob -> 按需 dataUrl            |
+------------------+------------------------------------------+
```

### 10.1 缩略图策略

- 新生成图写入时同步或异步生成一份 `thumbnailBlob`
- 画廊统一读 `thumbnailBlob`
- 原图只在详情、灯箱、编辑器打开时才读

### 10.2 推荐缩略图参数

```text
+------------------+------------------------------------------+
| 项目             | 建议                                     |
+------------------+------------------------------------------+
| 缩略图最长边     | 320px                                    |
+------------------+------------------------------------------+
| 缩略图格式       | WebP 优先，失败则 PNG                    |
+------------------+------------------------------------------+
| 质量             | 0.70 ~ 0.78                              |
+------------------+------------------------------------------+
| 原图             | 保留完整 Blob                            |
+------------------+------------------------------------------+
| 透明图           | 允许保持 PNG / WebP                      |
+------------------+------------------------------------------+
```

### 10.3 元数据持久化

建议在写入时顺手记录：

- `width`
- `height`
- `byteSize`
- `mimeType`

这样任务卡可直接读元数据，不必再为每张封面额外 `new Image()` 解码一次。

## 11. 运行时缓存方案

当前缓存是 `Map<string, string>`，没有淘汰策略，也没有对象 URL 生命周期管理。
迁移后建议改成分级缓存：

```text
+------------------+------------------------------------------+
| 缓存             | 内容                                     |
+------------------+------------------------------------------+
| thumbSrcCache    | 缩略图 object URL / remote URL / dataUrl |
+------------------+------------------------------------------+
| originalSrcCache | 原图 object URL / remote URL / dataUrl   |
+------------------+------------------------------------------+
| pendingLoadCache | 并发读取 promise                         |
+------------------+------------------------------------------+
```

### 11.1 缓存行为

- `local_blob`
  - 生成 `blob:` URL
- `remote_url`
  - 直接返回 URL
- `legacy_data_url`
  - 直接返回原始 `dataUrl`

### 11.2 必做项

- `deleteCachedImage()` 时 `revokeObjectURL`
- `clearImageCaches()` 时批量 `revokeObjectURL`
- 引入简单 LRU
  - 缩略图缓存上限高于原图缓存

### 11.3 初始建议阈值

```text
+------------------+------------------------------------------+
| 缓存             | 初始上限                                 |
+------------------+------------------------------------------+
| thumbSrcCache    | 200 ~ 300 项                             |
+------------------+------------------------------------------+
| originalSrcCache | 12 ~ 24 项                               |
+------------------+------------------------------------------+
```

## 12. 输入图、蒙版、编辑链路

这一层第一阶段不建议整体重写。

当前输入图、蒙版、编辑器会大量使用：

- `InputImage.dataUrl`
- `maskDataUrl`
- `sourceImageDataUrl`

因此建议采用“存储主路径 Blob 化、API 边界按需转 `dataUrl`”的兼容策略：

- 存储层优先保存 Blob
- UI 展示时优先吃 `blob:` URL
- 调用旧 API 边界前，再 `Blob -> dataUrl`

这样能优先拿到存储和画廊收益，不用一次性改完整个编辑链路。

## 13. 旧数据兼容与迁移方式

### 13.1 兼容读

`getImageDisplaySource()` 必须兼容 3 种记录：

- `local_blob -> blob URL`
- `remote_url -> remoteUrl`
- `legacy_data_url -> dataUrl`

### 13.2 惰性迁移

不建议启动时一次性全量转码。

建议两段式：

#### A. 读时惰性迁移

当读取到 `legacy_data_url`：

- 先正常返回旧图
- 再在空闲时把它转成 `Blob`
- 生成缩略图
- 回写为 `local_blob`
- 补齐 `contentHash / mimeType / width / height`

#### B. 后台分批迁移

应用初始化完成后，低优先级分批迁移剩余旧图，不阻塞首屏。

## 14. 导入导出方案

当前导出 manifest 为 `version: 6`。
迁移后建议升级为 `version: 7`。

### 14.1 新的 imageFiles 结构

```ts
imageFiles: Record<string, {
  kind: 'local_blob' | 'remote_url'
  path?: string
  thumbnailPath?: string
  url?: string
  createdAt?: number
  source?: 'upload' | 'generated'
  mimeType?: string | null
  width?: number | null
  height?: number | null
  byteSize?: number | null
  contentHash?: string | null
}>
```

### 14.2 兼容导入策略

- 导入 `v6`
  - `url` -> `remote_url`
  - `path` -> `bytes -> Blob -> putImage`
  - 不再 `bytes -> dataUrl -> putImage`
- 导入 `v7`
  - `path` -> original Blob
  - `thumbnailPath` -> thumbnail Blob

## 15. 实施顺序

```text
+----------+----------------------------------------------+----------+
| 阶段     | 动作                                         | 风险     |
+----------+----------------------------------------------+----------+
| P0       | types/db helper/cache 兼容改造              | 低       |
+----------+----------------------------------------------+----------+
| P1       | 生成结果图 Blob 主写入 + 缩略图生成         | 中       |
+----------+----------------------------------------------+----------+
| P2       | 画廊切缩略图优先 + 元数据直读               | 中       |
+----------+----------------------------------------------+----------+
| P3       | 旧 dataUrl 惰性迁移 + 导入导出 v7           | 中       |
+----------+----------------------------------------------+----------+
| P4       | 输入图/蒙版按需 dataUrl 化 + 真正虚拟列表   | 中高     |
+----------+----------------------------------------------+----------+
```

## 16. 风险与处理

```text
+----------------------+------------------------------------------+
| 风险                 | 处理                                     |
+----------------------+------------------------------------------+
| 旧 id 失效           | 旧记录迁移时不改 id                      |
+----------------------+------------------------------------------+
| blob URL 泄漏        | 缓存层统一 revokeObjectURL               |
+----------------------+------------------------------------------+
| 4K SSE 瞬时峰值      | 保留拆流 parser，最终事件再分段解码 Blob |
+----------------------+------------------------------------------+
| partial_image 膨胀   | 继续只做临时预览，不入正式库             |
+----------------------+------------------------------------------+
| 画廊仍卡             | 缩略图 + 元数据持久化 + 后续虚拟列表     |
+----------------------+------------------------------------------+
| 导入旧备份失败       | v6 / v7 双版本兼容读取                   |
+----------------------+------------------------------------------+
```

## 17. 最终结论

最终可落地方案是：

- `StoredImage` 改成 `local_blob / remote_url / legacy_data_url` 三态兼容
- 新图一律 Blob 主写入，原图完整保留
- 新增 `thumbnailBlob`，画廊统一读缩略图
- 旧 `dataUrl` 图继续可读，并在空闲时惰性迁移
- 保留现有 SSE 拆流和 `partial_image` 防爆策略
- API / 编辑链路暂时继续按需 `Blob -> dataUrl` 兼容
- 后续再收真正虚拟列表和筛选计算优化

这套方案能在不打碎现有稳定流式链路的前提下，逐步完成存储重构和画廊性能治理。
