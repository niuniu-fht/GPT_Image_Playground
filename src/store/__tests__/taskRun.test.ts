import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TaskRecord } from '../../types'
import { discardUnsubmittedTaskRun } from '../taskRun'

const dbMocks = vi.hoisted(() => ({
  deleteTask: vi.fn(),
  putTask: vi.fn(),
}))

const storeMocks = vi.hoisted(() => ({
  state: {} as Record<string, unknown>,
}))

vi.mock('../../lib/db', () => ({
  deleteTask: dbMocks.deleteTask,
  putTask: dbMocks.putTask,
}))

vi.mock('../state', () => ({
  useStore: {
    getState: () => storeMocks.state,
    setState: (update: unknown) => {
      const patch = typeof update === 'function'
        ? (update as (state: Record<string, unknown>) => Record<string, unknown>)(storeMocks.state)
        : update as Record<string, unknown>
      storeMocks.state = { ...storeMocks.state, ...patch }
    },
  },
}))

function createTask(generationTaskId: string | null = null): TaskRecord {
  return {
    id: 'local-task-1',
    taskKind: 'generation',
    generationRequestId: 'request-1',
    generationTaskId,
    generationTimeoutSeconds: null,
    prompt: 'prompt',
    params: {
      size: '1024x1024',
      quality: 'medium',
      output_format: 'png',
      output_compression: null,
      moderation: 'auto',
      n: 1,
    },
    inputImageIds: [],
    outputImages: [],
    status: 'running',
    error: null,
    createdAt: Date.now(),
    finishedAt: null,
    elapsed: null,
  }
}

describe('discardUnsubmittedTaskRun', () => {
  beforeEach(() => {
    dbMocks.deleteTask.mockReset().mockResolvedValue(undefined)
    dbMocks.putTask.mockReset()
    const task = createTask()
    storeMocks.state = {
      tasks: [task],
      selectedTaskIds: [task.id],
      detailTaskId: task.id,
      setTasks: (tasks: TaskRecord[]) => {
        storeMocks.state.tasks = tasks
      },
    }
  })

  it('removes a task that never received a server task id', async () => {
    await expect(discardUnsubmittedTaskRun('local-task-1')).resolves.toBe(true)

    expect(storeMocks.state.tasks).toEqual([])
    expect(storeMocks.state.selectedTaskIds).toEqual([])
    expect(storeMocks.state.detailTaskId).toBeNull()
    expect(dbMocks.deleteTask).toHaveBeenCalledWith('local-task-1')
  })

  it('keeps tasks that were already accepted by the server', async () => {
    const task = createTask('remote-task-1')
    storeMocks.state.tasks = [task]

    await expect(discardUnsubmittedTaskRun(task.id)).resolves.toBe(false)

    expect(storeMocks.state.tasks).toEqual([task])
    expect(dbMocks.deleteTask).not.toHaveBeenCalled()
  })
})
