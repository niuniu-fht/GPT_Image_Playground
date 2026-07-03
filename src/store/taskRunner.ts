import type { TaskRecord } from "../types"
import { prepareCurrentTaskDraft } from "./taskDraft"
import { findProviderById, getProviderSettings } from "./domain"
import { useStore } from "./state"
import { executeTask } from "./taskExecutor"
import { enqueueTaskRun, requestAbortTaskRun, retryTaskRun } from "./taskRun"

function handlePrepareFailure(
  snapshot: ReturnType<typeof useStore.getState>,
  reason: "missing_login" | "missing_model" | "insufficient_credits" | "missing_prompt_or_inputs" | "too_many_masked_inputs",
) {
  if (reason === "missing_login") {
    snapshot.showToast("请先登录后再生成", "error")
    snapshot.openAuthModal("login")
    return
  }
  if (reason === "missing_model") {
    snapshot.showToast("暂无可用模型，请联系管理员配置", "error")
    return
  }
  if (reason === "insufficient_credits") {
    snapshot.showToast("积分不足，无法生成", "error")
    return
  }
  if (reason === "missing_prompt_or_inputs") {
    snapshot.showToast("请输入提示词或添加参考图", "error")
    return
  }
  snapshot.showToast("当前仅支持 1 张带蒙版的局部编辑参考图，请先清理多余蒙版后再提交", "error")
}

function resolveTaskRequestSettings(task: TaskRecord) {
  const snapshot = useStore.getState()
  const provider = findProviderById(snapshot.providers, task.providerId)
  return provider ? getProviderSettings(provider) : snapshot.settings
}

/** 提交当前输入区内容为一个新任务 */
export async function submitTask() {
  const snapshot = useStore.getState()
  const prepared = await prepareCurrentTaskDraft({
    settings: snapshot.settings,
    providers: snapshot.providers,
    categories: snapshot.categories,
    activeProviderId: snapshot.activeProviderId,
    activeCategoryFilter: snapshot.activeCategoryFilter,
    prompt: snapshot.prompt,
    inputImages: snapshot.inputImages,
    params: snapshot.params,
    currentUser: snapshot.currentUser,
    activeModelId: snapshot.activeModelId,
    models: snapshot.models,
  })
  if (!prepared.ok) {
    handlePrepareFailure(snapshot, prepared.reason)
    return
  }

  const { task, requestSettings, normalizedParamsPatch } = prepared.draft
  if (normalizedParamsPatch) {
    snapshot.setParams(normalizedParamsPatch)
  }
  await enqueueTaskRun(task)
  void executeTask(task.id, requestSettings)
}

/** 重试一个失败或被中止的任务 */
export async function retryTask(task: TaskRecord) {
  const currentTask = useStore.getState().tasks.find((item) => item.id === task.id) ?? task
  const retryResult = await retryTaskRun(currentTask)

  if (!retryResult.ok) {
    useStore.getState().showToast(retryResult.message, retryResult.toastType)
    return
  }

  useStore.getState().showToast(retryResult.message, "info")
  void executeTask(retryResult.task.id, resolveTaskRequestSettings(retryResult.task))
}

/** 中止一个正在运行的任务 */
export async function abortTask(task: TaskRecord) {
  const currentTask = useStore.getState().tasks.find((item) => item.id === task.id) ?? task
  const abortResult = requestAbortTaskRun(currentTask)
  if (!abortResult.ok) {
    useStore.getState().showToast(abortResult.message, abortResult.toastType)
    return
  }

  useStore.getState().showToast(abortResult.message, "info")
}
