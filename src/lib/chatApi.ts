import type { ChatMessage } from '../types'

export interface ChatApiTextPart {
  type: 'text'
  text: string
}

export interface ChatApiImagePart {
  type: 'image_url'
  image_url: { url: string }
}

export type ChatApiContentPart = ChatApiTextPart | ChatApiImagePart

export interface ChatApiMessage {
  role: 'user' | 'assistant'
  content: string | ChatApiContentPart[]
}

export class ChatApiError extends Error {
  code: string
  status: number

  constructor(message: string, code: string, status: number) {
    super(message)
    this.code = code
    this.status = status
  }
}

/** 把本地消息转成上游协议：图片只随用户消息发送。 */
export function toChatApiMessages(history: ChatMessage[]): ChatApiMessage[] {
  return history
    .filter((message) => message.text.trim().length > 0 || message.images.length > 0)
    .slice(-30)
    .map((message) => {
      if (message.role === 'assistant' || message.images.length === 0) {
        return { role: message.role, content: message.text }
      }
      const parts: ChatApiContentPart[] = []
      if (message.text.trim()) {
        parts.push({ type: 'text', text: message.text })
      }
      for (const image of message.images) {
        parts.push({ type: 'image_url', image_url: { url: image.dataUrl } })
      }
      return { role: message.role, content: parts }
    })
}

interface SsePayload {
  choices?: Array<{ delta?: { content?: string | Array<{ type?: string; text?: string }> } }>
  __error?: string
}

function extractDeltaText(payload: SsePayload): string {
  const delta = payload.choices?.[0]?.delta?.content
  if (typeof delta === 'string') return delta
  if (Array.isArray(delta)) {
    return delta.map((part) => (typeof part?.text === 'string' ? part.text : '')).join('')
  }
  return ''
}

/**
 * 调用后端 /api/chat/completions，SSE 流式返回助手增量文本。
 * 流结束（[DONE]）或出错时返回；出错抛出 ChatApiError。
 */
export async function streamChatCompletion(options: {
  messages: ChatApiMessage[]
  signal: AbortSignal
  onDelta: (text: string) => void
}): Promise<void> {
  const { messages, signal, onDelta } = options

  let response: Response
  try {
    response = await fetch('/api/chat/completions', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
      signal,
    })
  } catch (error) {
    if (signal.aborted) return
    throw new ChatApiError('网络连接异常，请检查网络后重试', 'network_error', 0)
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { ok?: boolean; code?: string; message?: string } | null
    const message = payload?.message || '对话服务暂时不可用，请稍后重试'
    throw new ChatApiError(message, payload?.code ?? 'chat_error', response.status)
  }

  const body = response.body
  if (!body) {
    throw new ChatApiError('对话服务返回了空响应', 'empty_response', response.status)
  }

  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let streamError: ChatApiError | null = null

  const processSseChunk = (chunk: string): boolean => {
    // 返回 true 表示流应结束（收到 [DONE] 或错误）
    for (const rawLine of chunk.split('\n')) {
      const line = rawLine.trim()
      if (!line.startsWith('data:')) continue
      const data = line.slice(5).trim()
      if (!data || data === '[DONE]') {
        if (data === '[DONE]') return true
        continue
      }
      let payload: SsePayload | null = null
      try {
        payload = JSON.parse(data) as SsePayload
      } catch {
        continue
      }
      if (payload?.__error) {
        streamError = new ChatApiError(payload.__error, 'stream_error', 502)
        return true
      }
      const text = extractDeltaText(payload ?? {})
      if (text) onDelta(text)
    }
    return false
  }

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const segments = buffer.split('\n\n')
      buffer = segments.pop() ?? ''
      for (const segment of segments) {
        if (processSseChunk(segment)) {
          reader.cancel().catch(() => undefined)
          if (streamError) throw streamError
          return
        }
      }
    }
    if (buffer.trim()) processSseChunk(buffer)
  } catch (error) {
    if (signal.aborted) return
    if (error instanceof ChatApiError) throw error
    throw new ChatApiError('对话流中断，请重试', 'stream_error', 502)
  } finally {
    reader.releaseLock()
  }

  if (streamError) throw streamError
}
