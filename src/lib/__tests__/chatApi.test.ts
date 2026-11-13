import { afterEach, describe, expect, it, vi } from 'vitest'
import { ChatApiError, streamChatCompletion, toChatApiMessages } from '../chatApi'
import type { ChatMessage } from '../../types'

function sseResponse(chunks: string[], init?: ResponseInit): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk))
      }
      controller.close()
    },
  })
  return new Response(stream, { status: 200, ...init })
}

function makeMessage(partial: Partial<ChatMessage> & { text: string }): ChatMessage {
  return {
    role: 'user',
    images: [],
    ...partial,
  }
}

describe('toChatApiMessages', () => {
  it('keeps assistant messages as plain text and user images as parts', () => {
    const history = [
      makeMessage({ role: 'user', text: '画一只猫', images: [{ id: 'img1', dataUrl: 'data:image/png;base64,xxx' }] }),
      makeMessage({ role: 'assistant', text: '好的' }),
    ]
    const result = toChatApiMessages(history)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      role: 'user',
      content: [
        { type: 'text', text: '画一只猫' },
        { type: 'image_url', image_url: { url: 'data:image/png;base64,xxx' } },
      ],
    })
    expect(result[1]).toEqual({ role: 'assistant', content: '好的' })
  })

  it('caps history at 30 messages', () => {
    const history = Array.from({ length: 40 }, (_, index) =>
      makeMessage({ role: index % 2 === 0 ? 'user' : 'assistant', text: `m${index}` }),
    )
    expect(toChatApiMessages(history)).toHaveLength(30)
  })
})

describe('streamChatCompletion', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('aggregates streamed deltas and stops at [DONE]', async () => {
    const sse = [
      'data: {"choices":[{"delta":{"content":"你"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"好"}}]}\n\n',
      'data: [DONE]\n\n',
    ]
    vi.stubGlobal('fetch', vi.fn(async () => sseResponse(sse)))

    let text = ''
    await streamChatCompletion({
      messages: [{ role: 'user', content: 'hi' }],
      signal: new AbortController().signal,
      onDelta: (delta) => {
        text += delta
      },
    })
    expect(text).toBe('你好')
  })

  it('handles split sse chunks across network frames', async () => {
    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"con'))
        controller.enqueue(encoder.encode('tent":"片段"}}]}\n\ndata: [DONE]\n\n'))
        controller.close()
      },
    })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(stream, { status: 200 })))

    let text = ''
    await streamChatCompletion({
      messages: [{ role: 'user', content: 'hi' }],
      signal: new AbortController().signal,
      onDelta: (delta) => {
        text += delta
      },
    })
    expect(text).toBe('片段')
  })

  it('surfaces upstream json errors as ChatApiError', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({ ok: false, code: 'chat_disabled', message: '对话功能暂未开放' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }),
    ))

    await expect(
      streamChatCompletion({
        messages: [{ role: 'user', content: 'hi' }],
        signal: new AbortController().signal,
        onDelta: () => undefined,
      }),
    ).rejects.toMatchObject({
      message: '对话功能暂未开放',
      code: 'chat_disabled',
      status: 403,
    } satisfies Partial<ChatApiError>)
  })

  it('raises inline stream errors sent by the proxy', async () => {
    const sse = ['data: {"__error":"对话流中断，请重试"}\n\ndata: [DONE]\n\n']
    vi.stubGlobal('fetch', vi.fn(async () => sseResponse(sse)))

    await expect(
      streamChatCompletion({
        messages: [{ role: 'user', content: 'hi' }],
        signal: new AbortController().signal,
        onDelta: () => undefined,
      }),
    ).rejects.toMatchObject({ message: '对话流中断，请重试' } satisfies Partial<ChatApiError>)
  })
})
