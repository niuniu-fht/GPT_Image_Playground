export const DB_NAME = 'gpt-image-playground'
export const DB_VERSION = 4
export const STORE_TASKS = 'tasks'
export const STORE_IMAGES = 'images'
export const IMAGE_INDEX_KIND = 'kind'
export const IMAGE_INDEX_CONTENT_HASH = 'contentHash'
export const IMAGE_INDEX_CREATED_AT = 'createdAt'

export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      const tx = req.transaction
      if (!tx) {
        throw new Error('IndexedDB 升级事务缺失')
      }

      if (!db.objectStoreNames.contains(STORE_TASKS)) {
        db.createObjectStore(STORE_TASKS, { keyPath: 'id' })
      }

      const imageStore = db.objectStoreNames.contains(STORE_IMAGES)
        ? tx.objectStore(STORE_IMAGES)
        : db.createObjectStore(STORE_IMAGES, { keyPath: 'id' })

      ensureImageIndexes(imageStore)
      backfillLegacyImageKinds(imageStore)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('打开 IndexedDB 失败'))
  })
}

export function ensureImageIndexes(store: IDBObjectStore) {
  if (!store.indexNames.contains(IMAGE_INDEX_KIND)) {
    store.createIndex(IMAGE_INDEX_KIND, 'kind')
  }
  if (!store.indexNames.contains(IMAGE_INDEX_CONTENT_HASH)) {
    store.createIndex(IMAGE_INDEX_CONTENT_HASH, 'contentHash')
  }
  if (!store.indexNames.contains(IMAGE_INDEX_CREATED_AT)) {
    store.createIndex(IMAGE_INDEX_CREATED_AT, 'createdAt')
  }
}

function inferLegacyStoredImageKindFromValue(
  value: Record<string, unknown>,
): 'legacy_data_url' | 'remote_url' | null {
  if (typeof value.kind === 'string') {
    if (value.kind === 'legacy_data_url' || value.kind === 'remote_url') {
      return value.kind
    }
    return null
  }

  const rawDataUrl = typeof value.dataUrl === 'string' ? value.dataUrl.trim() : ''
  if (!rawDataUrl) {
    return null
  }

  if (/^https?:\/\//i.test(rawDataUrl)) {
    return 'remote_url'
  }

  if (/^data:[^,]+,.+/i.test(rawDataUrl)) {
    return 'legacy_data_url'
  }

  return null
}

function backfillLegacyImageKinds(store: IDBObjectStore) {
  const request = store.openCursor()
  request.onsuccess = () => {
    const cursor = request.result
    if (!cursor) {
      return
    }

    const value = cursor.value
    if (typeof value === 'object' && value !== null) {
      const record = value as Record<string, unknown>
      const inferredKind = inferLegacyStoredImageKindFromValue(record)
      if (inferredKind && typeof record.kind !== 'string') {
        cursor.update(
          inferredKind === 'remote_url'
            ? {
                ...record,
                kind: inferredKind,
                remoteUrl:
                  typeof record.remoteUrl === 'string' && record.remoteUrl.trim()
                    ? record.remoteUrl
                    : record.dataUrl,
              }
            : {
                ...record,
                kind: inferredKind,
              },
        )
      }
    }

    cursor.continue()
  }
}

export function dbTransaction<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, mode)
        const store = tx.objectStore(storeName)
        const req = fn(store)

        const closeDB = () => {
          db.close()
        }

        req.onsuccess = () => resolve(req.result)
        req.onerror = () => {
          reject(req.error ?? new Error(`IndexedDB 请求失败：${storeName}`))
          closeDB()
        }
        tx.onabort = () => {
          reject(tx.error ?? new Error(`IndexedDB 事务已中止：${storeName}`))
          closeDB()
        }
        tx.oncomplete = closeDB
        tx.onerror = () => {
          reject(tx.error ?? new Error(`IndexedDB 事务失败：${storeName}`))
          closeDB()
        }
      }),
  )
}
