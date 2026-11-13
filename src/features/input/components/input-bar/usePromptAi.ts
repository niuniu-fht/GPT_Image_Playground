import { useCallback, useEffect, useRef, useState } from 'react'
import { platformApi } from '../../../../lib/platformApi'
import { useStore } from '../../../../store'
import {
  streamChatCompletion,
  type ChatApiContentPart,
} from '../../../../lib/chatApi'
import type { ChatImageAttachment } from '../../../../types'

export type PromptAiMode = 'optimize' | 'reverse'

interface PromptAiState {
  active: boolean
  mode: PromptAiMode | null
  text: string
  streaming: boolean
  error: string | null
}

const IDLE_PROMPT_AI_STATE: PromptAiState = {
  active: false,
  mode: null,
  text: '',
  streaming: false,
  error: null,
}

function buildOptimizeInstruction(prompt: string): string {
  return [
    '请把下面的生图提示词优化成高质量提示词：在不改变原意的前提下，补充主体细节、画面风格、光线、构图与画质关键词。',
    '直接输出优化后的提示词本身，不要任何解释、标题、引号或 markdown 格式。',
    '原文是中文就输出中文，原文是英文就输出英文。',
    '当前提示词：',
    prompt,
  ].join('\n')
}

const REVERSE_INSTRUCTION =
  '请根据这张图片反推用于生成它的生图提示词：描述主体、风格、光线、色彩、构图与画质关键词。' +
  '直接输出提示词本身（一段自然描述或逗号分隔的关键词），不要任何解释、标题或 markdown 格式，使用中文。'

export interface UsePromptAiOptions {
  prompt: string
  setPrompt: (value: string) => void
}

export function usePromptAi({ prompt, setPrompt }: UsePromptAiOptions) {
  const [state, setState] = useState<PromptAiState>(IDLE_PROMPT_AI_STATE)
  const [enabled, setEnabled] = useState(false)
  const [costCredits, setCostCredits] = useState(0)
  const [freePromotion, setFreePromotion] = useState(false)
  const controllerRef = useRef<AbortController | null>(null)
  const streamingRef = useRef(false)
  const promptRef = useRef(prompt)
  const textRef = useRef('')
  promptRef.current = prompt
  textRef.current = state.text
  // 限免期间实际费用为 0：不弹确认框、不扣积分
  const effectiveCost = freePromotion ? 0 : costCredits

  useEffect(() => {
    let disposed = false
    platformApi
      .getChatStatus()
      .then((status) => {
        if (disposed) return
        setEnabled(status.enabled)
        setCostCredits(status.costCredits)
        setFreePromotion(Boolean(status.freePromotion))
      })
      .catch(() => {
        if (!disposed) setEnabled(false)
      })
    return () => {
      disposed = true
      controllerRef.current?.abort()
    }
  }, [])

  const showToast = useStore((state) => state.showToast)
  const setConfirmDialog = useStore((state) => state.setConfirmDialog)

  /** 生成结束后同步服务端余额（扣费/退回都会反映到头像旁的积分显示）。 */
  const refreshCreditBalance = useCallback(async () => {
    try {
      const { user } = await platformApi.getMe()
      if (user) useStore.getState().setCurrentUser(user)
    } catch {
      // 余额刷新失败不影响主流程
    }
  }, [])

  const run = useCallback(
    async (mode: PromptAiMode, payload: { image?: ChatImageAttachment } = {}) => {
      if (streamingRef.current) return
      const instruction =
        mode === 'optimize' ? buildOptimizeInstruction(promptRef.current.trim()) : REVERSE_INSTRUCTION
      let content: string | ChatApiContentPart[] = instruction
      if (payload.image) {
        const parts: ChatApiContentPart[] = [{ type: 'text', text: instruction }]
        parts.push({ type: 'image_url', image_url: { url: payload.image.dataUrl } })
        content = parts
      }

      streamingRef.current = true
      setState({ active: true, mode, text: '', streaming: true, error: null })
      const controller = new AbortController()
      controllerRef.current = controller
      try {
        await streamChatCompletion({
          messages: [{ role: 'user', content }],
          signal: controller.signal,
          onDelta: (delta) => {
            setState((prev) => ({ ...prev, text: prev.text + delta }))
          },
        })
        setState((prev) => ({ ...prev, streaming: false }))
      } catch (error) {
        if (controller.signal.aborted) {
          // 用户手动停止：保留已生成的部分文本
          setState((prev) => ({ ...prev, streaming: false }))
        } else {
          setState((prev) => ({
            ...prev,
            streaming: false,
            error: error instanceof Error ? error.message : 'AI 处理失败，请稍后重试',
          }))
          if (effectiveCost > 0) {
            showToast('AI 生成失败，积分已退回', 'info')
          }
        }
      } finally {
        streamingRef.current = false
        controllerRef.current = null
        if (effectiveCost > 0) void refreshCreditBalance()
      }
    },
    [effectiveCost, refreshCreditBalance, showToast],
  )

  /** 弹出扣积分确认框；确认后执行。设置为 0 积分时直接执行不弹窗。 */
  const requestWithConfirm = useCallback(
    (mode: PromptAiMode, payload: { image?: ChatImageAttachment } = {}) => {
      if (streamingRef.current) return
      if (effectiveCost <= 0) {
        void run(mode, payload)
        return
      }
      const balance = useStore.getState().currentUser?.creditBalance ?? 0
      const actionLabel = mode === 'optimize' ? 'AI 优化提示词' : 'AI 反推提示词'
      setConfirmDialog({
        title: `确认使用${actionLabel}？`,
        message: `本次将消耗 ${effectiveCost} 积分（当前余额 ${balance} 积分）。生成失败会自动退回积分。`,
        confirmText: `确认生成（扣 ${effectiveCost} 积分）`,
        action: async () => {
          // 不等待流式完成：确认后立即关闭弹窗，生成进度在提示词下方的建议卡片里展示
          void run(mode, payload)
        },
      })
    },
    [effectiveCost, run, setConfirmDialog],
  )

  const runOptimize = useCallback(() => {
    if (!promptRef.current.trim()) return
    requestWithConfirm('optimize')
  }, [requestWithConfirm])

  const runReverse = useCallback(
    (image: ChatImageAttachment) => {
      requestWithConfirm('reverse', { image })
    },
    [requestWithConfirm],
  )

  const stop = useCallback(() => {
    controllerRef.current?.abort()
  }, [])

  const dismiss = useCallback(() => {
    if (streamingRef.current) return
    setState(IDLE_PROMPT_AI_STATE)
  }, [])

  const apply = useCallback(
    (applyMode: 'replace' | 'append') => {
      const suggestion = textRef.current.trim()
      if (!suggestion) return
      if (applyMode === 'replace') {
        setPrompt(suggestion)
      } else {
        const current = promptRef.current
        setPrompt(current.trim() ? `${current.replace(/\s+$/, '')}\n${suggestion}` : suggestion)
      }
      setState(IDLE_PROMPT_AI_STATE)
    },
    [setPrompt],
  )

  return {
    enabled,
    costCredits,
    freePromotion,
    active: state.active,
    mode: state.mode,
    text: state.text,
    streaming: state.streaming,
    error: state.error,
    runOptimize,
    runReverse,
    stop,
    dismiss,
    apply,
  }
}

export type PromptAiController = ReturnType<typeof usePromptAi>
