import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PlatformApiError } from '../../lib/platformApi'
import type { TaskRecord } from '../../types'
import { callTaskImageApi, isRetryableGenerationRequestError } from '../taskApiRequest'

const platformMocks = vi.hoisted(() => ({
  generate: vi.fn(),
  getGenerationTask: vi.fn(),
}))

const storeMocks = vi.hoisted(() => ({
  currentUser: null as unknown,
  openAuthModal: vi.fn(),
  setCurrentUser: vi.fn(),
}))

vi.mock('../../lib/platformApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/platformApi')>()
  return {
    ...actual,
    platformApi: {
      ...actual.platformApi,
      generate: platformMocks.generate,
      getGenerationTask: platformMocks.getGenerationTask,
    },
  }
})

vi.mock('../imageAssets', () => ({
  getImageView: vi.fn(),
}))

vi.mock('../state', () => ({
  useStore: {
    getState: () => ({
      currentUser: storeMocks.currentUser,
      openAuthModal: storeMocks.openAuthModal,
      setCurrentUser: storeMocks.setCurrentUser,
    }),
  },
}))

function createTask(patch: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: 'local-task-1',
    taskKind: 'generation',
    generationRequestId: 'request-1',
    generationTaskId: null,
    providerId: null,
    providerName: 'provider',
    modelConfigId: 'model-1',
    modelName: 'model',
    modelDisplayName: 'Model',
    costCredits: 1,
    categoryId: null,
    categoryName: null,
    deletedAt: null,
    isFavorite: false,
    parentTaskId: null,
    parentImageId: null,
    prompt: 'test prompt',
    params: {
      size: '1024x1024',
      quality: 'medium',
      output_format: 'png',
      output_compression: null,
      moderation: 'auto',
      n: 1,
    },
    inputImageIds: [],
    editMaskImageId: null,
    editSourceImageId: null,
    editSelection: null,
    outputImages: [],
    responseMeta: null,
    errorDebug: null,
    isAborted: false,
    status: 'running',
    error: null,
    createdAt: 1,
    finishedAt: null,
    elapsed: null,
    ...patch,
  }
}

function createDoneResult(taskId = 'remote-task-1') {
  return {
    taskId,
    status: 'done' as const,
    images: [{ dataUrl: 'data:image/png;base64,AA==', mimeType: 'image/png' }],
    model: { id: 'model-1', displayName: 'Model', costCredits: 1 },
    user: null,
    responseMeta: {},
  }
}

describe('callTaskImageApi recovery', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    platformMocks.generate.mockReset()
    platformMocks.getGenerationTask.mockReset()
    storeMocks.currentUser = { id: 'user-1' }
    storeMocks.openAuthModal.mockReset()
    storeMocks.setCurrentUser.mockReset()
    storeMocks.setCurrentUser.mockImplementation((user) => {
      storeMocks.currentUser = user
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('retries a lost create response with the same idempotency key', async () => {
    platformMocks.generate
      .mockRejectedValueOnce(new PlatformApiError('network', { code: 'network_error', status: 0 }))
      .mockResolvedValueOnce(createDoneResult())
    const onTaskAccepted = vi.fn()

    const pendingResult = callTaskImageApi(createTask(), {} as never, { onTaskAccepted })
    await vi.advanceTimersByTimeAsync(0)
    expect(platformMocks.generate).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(2000)
    const result = await pendingResult

    expect(platformMocks.generate).toHaveBeenCalledTimes(2)
    expect(platformMocks.generate.mock.calls[0]?.[0].clientRequestId).toBe('request-1')
    expect(platformMocks.generate.mock.calls[1]?.[0].clientRequestId).toBe('request-1')
    expect(onTaskAccepted).toHaveBeenCalledWith('remote-task-1')
    expect(result.images).toHaveLength(1)
  })

  it('retries a hung create request after aborting the timed out attempt', async () => {
    platformMocks.generate
      .mockImplementationOnce((_input, signal: AbortSignal) => new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => {
          reject(new PlatformApiError('request timeout', { code: 'network_error', status: 0 }))
        })
      }))
      .mockResolvedValueOnce(createDoneResult())

    const pendingResult = callTaskImageApi(createTask(), {} as never)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(platformMocks.generate).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(2000)
    const result = await pendingResult

    expect(platformMocks.generate).toHaveBeenCalledTimes(2)
    expect(platformMocks.generate.mock.calls[0]?.[0].clientRequestId).toBe('request-1')
    expect(platformMocks.generate.mock.calls[1]?.[0].clientRequestId).toBe('request-1')
    expect(result.images).toHaveLength(1)
  })

  it('resumes from the persisted remote task id without creating another task', async () => {
    platformMocks.getGenerationTask
      .mockRejectedValueOnce(new PlatformApiError('network', { code: 'network_error', status: 0 }))
      .mockResolvedValueOnce(createDoneResult('remote-task-2'))

    const pendingResult = callTaskImageApi(
      createTask({ generationTaskId: 'remote-task-2' }),
      {} as never,
    )
    await vi.advanceTimersByTimeAsync(0)
    expect(platformMocks.getGenerationTask).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(2000)
    const result = await pendingResult

    expect(platformMocks.generate).not.toHaveBeenCalled()
    expect(platformMocks.getGenerationTask).toHaveBeenCalledTimes(2)
    expect(result.responseMeta?.generationTaskId).toBe('remote-task-2')
  })

  it('waits for the browser to come back online before resuming', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    platformMocks.getGenerationTask.mockResolvedValueOnce(createDoneResult('remote-task-3'))

    const pendingResult = callTaskImageApi(
      createTask({ generationTaskId: 'remote-task-3' }),
      {} as never,
    )
    await vi.advanceTimersByTimeAsync(1000)
    expect(platformMocks.getGenerationTask).not.toHaveBeenCalled()

    ;(globalThis.navigator as { onLine: boolean }).onLine = true
    await vi.advanceTimersByTimeAsync(500)
    const result = await pendingResult

    expect(platformMocks.getGenerationTask).toHaveBeenCalledTimes(1)
    expect(result.responseMeta?.generationTaskId).toBe('remote-task-3')
  })

  it('keeps the task running while login is restored', async () => {
    platformMocks.getGenerationTask
      .mockRejectedValueOnce(new PlatformApiError('unauthorized', { status: 401 }))
      .mockResolvedValueOnce(createDoneResult('remote-task-4'))

    const pendingResult = callTaskImageApi(
      createTask({ generationTaskId: 'remote-task-4' }),
      {} as never,
    )
    await vi.advanceTimersByTimeAsync(0)

    expect(storeMocks.setCurrentUser).toHaveBeenCalledWith(null)
    expect(storeMocks.openAuthModal).toHaveBeenCalledWith('login')
    expect(platformMocks.getGenerationTask).toHaveBeenCalledTimes(1)

    storeMocks.currentUser = { id: 'user-1' }
    await vi.advanceTimersByTimeAsync(500)
    const result = await pendingResult

    expect(platformMocks.getGenerationTask).toHaveBeenCalledTimes(2)
    expect(result.responseMeta?.generationTaskId).toBe('remote-task-4')
  })
})

describe('isRetryableGenerationRequestError', () => {
  it('only retries transient platform failures', () => {
    expect(isRetryableGenerationRequestError(
      new PlatformApiError('offline', { status: 0 }),
    )).toBe(true)
    expect(isRetryableGenerationRequestError(
      new PlatformApiError('server', { status: 503 }),
    )).toBe(true)
    expect(isRetryableGenerationRequestError(
      new PlatformApiError('truncated success response', { status: 200 }),
    )).toBe(true)
    expect(isRetryableGenerationRequestError(
      new PlatformApiError('maintenance', { code: 'generation_closed', status: 503 }),
    )).toBe(false)
    expect(isRetryableGenerationRequestError(
      new PlatformApiError('unauthorized', { status: 401 }),
    )).toBe(false)
    expect(isRetryableGenerationRequestError(new Error('unknown'))).toBe(false)
  })
})
